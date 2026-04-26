import type { SpeakerSegment } from "@/lib/dubbing/types";

const MAX_STRETCH_RATE = 1.3;
const MIN_STRETCH_RATE = 0.7;
const OUTPUT_CHANNELS = 2;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function createEmptyAudioBuffer({
	length,
	sampleRate,
	numberOfChannels,
}: {
	length: number;
	sampleRate: number;
	numberOfChannels: number;
}): AudioBuffer {
	return new AudioBuffer({
		length: Math.max(1, length),
		sampleRate,
		numberOfChannels: Math.max(1, numberOfChannels),
	});
}

async function decodeBlobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
	const audioContext = new AudioContext();

	try {
		const arrayBuffer = await blob.arrayBuffer();
		return await audioContext.decodeAudioData(arrayBuffer.slice(0));
	} finally {
		await audioContext.close();
	}
}

export async function alignAudioDuration(
	sourceBuffer: AudioBuffer,
	targetDurationSec: number,
): Promise<AudioBuffer> {
	const safeTargetDuration = Math.max(targetDurationSec, 0.001);
	const targetLength = Math.max(
		1,
		Math.ceil(safeTargetDuration * sourceBuffer.sampleRate),
	);
	const requiredPlaybackRate = sourceBuffer.duration / safeTargetDuration;

	// Keep time-stretching within +/-30%; outside that range we render with the
	// closest safe playback rate. Short audio is padded, while long audio keeps
	// its full rendered length so translated speech is not cut off.
	const appliedPlaybackRate = clamp(
		requiredPlaybackRate,
		MIN_STRETCH_RATE,
		MAX_STRETCH_RATE,
	);
	const renderedDurationSec = sourceBuffer.duration / appliedPlaybackRate;
	const renderedLength = Math.max(
		1,
		Math.ceil(renderedDurationSec * sourceBuffer.sampleRate),
	);
	const channelCount = Math.max(
		1,
		Math.min(OUTPUT_CHANNELS, sourceBuffer.numberOfChannels),
	);

	const offlineContext = new OfflineAudioContext(
		channelCount,
		renderedLength,
		sourceBuffer.sampleRate,
	);
	const source = offlineContext.createBufferSource();
	source.buffer = sourceBuffer;
	source.playbackRate.value = appliedPlaybackRate;
	source.connect(offlineContext.destination);
	source.start(0);

	const rendered = await offlineContext.startRendering();
	const output = createEmptyAudioBuffer({
		length: Math.max(targetLength, rendered.length),
		sampleRate: sourceBuffer.sampleRate,
		numberOfChannels: channelCount,
	});
	const copyLength = Math.min(rendered.length, output.length);

	for (let channel = 0; channel < output.numberOfChannels; channel += 1) {
		const sourceChannelIndex = Math.min(channel, rendered.numberOfChannels - 1);
		const renderedData = rendered.getChannelData(sourceChannelIndex);
		const outputData = output.getChannelData(channel);
		outputData.set(renderedData.subarray(0, copyLength), 0);
	}

	return output;
}

export async function buildDubbingAudioBuffer(
	segments: SpeakerSegment[],
	originalDurationSec: number,
	sampleRate: number,
): Promise<AudioBuffer> {
	const totalLength = Math.max(1, Math.ceil(originalDurationSec * sampleRate));
	const output = createEmptyAudioBuffer({
		length: totalLength,
		sampleRate,
		numberOfChannels: OUTPUT_CHANNELS,
	});

	for (const segment of segments) {
		if (!segment.audioBlob) {
			continue;
		}

		const decodedBuffer = await decodeBlobToAudioBuffer(segment.audioBlob);
		const segmentDurationSec = Math.max(
			0.001,
			(segment.endTime - segment.startTime) / 1000,
		);
		const alignedBuffer = await alignAudioDuration(
			decodedBuffer,
			segmentDurationSec,
		);
		const startFrame = Math.max(
			0,
			Math.floor((segment.startTime / 1000) * sampleRate),
		);

		for (let channel = 0; channel < output.numberOfChannels; channel += 1) {
			const target = output.getChannelData(channel);
			const sourceChannelIndex = Math.min(
				channel,
				alignedBuffer.numberOfChannels - 1,
			);
			const source = alignedBuffer.getChannelData(sourceChannelIndex);
			const availableLength = Math.max(0, output.length - startFrame);
			const mixLength = Math.min(source.length, availableLength);

			for (let index = 0; index < mixLength; index += 1) {
				const sampleIndex = startFrame + index;
				target[sampleIndex] = clamp(target[sampleIndex] + source[index], -1, 1);
			}
		}
	}

	return output;
}

export async function buildAlignedDubbingSegmentFiles(
	segments: SpeakerSegment[],
): Promise<
	Array<{ segment: SpeakerSegment; file: File; actualDurationSec: number }>
> {
	const files: Array<{
		segment: SpeakerSegment;
		file: File;
		actualDurationSec: number;
	}> = [];

	for (const segment of segments) {
		if (!segment.audioBlob) {
			continue;
		}

		const decodedBuffer = await decodeBlobToAudioBuffer(segment.audioBlob);
		const segmentDurationSec = Math.max(
			0.001,
			(segment.endTime - segment.startTime) / 1000,
		);
		const alignedBuffer = await alignAudioDuration(
			decodedBuffer,
			segmentDurationSec,
		);
		files.push({
			segment,
			actualDurationSec: alignedBuffer.duration,
			file: audioBufferToMediaFile(
				alignedBuffer,
				`opencut-dubbed-${segment.id}.wav`,
			),
		});
	}

	return files;
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
	const channelCount = Math.max(
		1,
		Math.min(OUTPUT_CHANNELS, buffer.numberOfChannels),
	);
	const bitsPerSample = 16;
	const bytesPerSample = bitsPerSample / 8;
	const dataSize = buffer.length * channelCount * bytesPerSample;
	const output = new ArrayBuffer(44 + dataSize);
	const view = new DataView(output);

	writeAsciiString({ view, offset: 0, value: "RIFF" });
	view.setUint32(4, 36 + dataSize, true);
	writeAsciiString({ view, offset: 8, value: "WAVE" });
	writeAsciiString({ view, offset: 12, value: "fmt " });
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, channelCount, true);
	view.setUint32(24, buffer.sampleRate, true);
	view.setUint32(28, buffer.sampleRate * channelCount * bytesPerSample, true);
	view.setUint16(32, channelCount * bytesPerSample, true);
	view.setUint16(34, bitsPerSample, true);
	writeAsciiString({ view, offset: 36, value: "data" });
	view.setUint32(40, dataSize, true);

	let dataOffset = 44;
	for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
		for (let channel = 0; channel < channelCount; channel += 1) {
			const channelData = buffer.getChannelData(
				Math.min(channel, buffer.numberOfChannels - 1),
			);
			const sample = clamp(channelData[sampleIndex] ?? 0, -1, 1);
			const int16Sample =
				sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
			view.setInt16(dataOffset, int16Sample, true);
			dataOffset += 2;
		}
	}

	return new Blob([output], { type: "audio/wav" });
}

export function audioBufferToMediaFile(
	buffer: AudioBuffer,
	fileName = "opencut-dubbed-track.wav",
): File {
	const wavBlob = audioBufferToWavBlob(buffer);
	return new File([wavBlob], fileName, {
		type: "audio/wav",
		lastModified: Date.now(),
	});
}

function writeAsciiString({
	view,
	offset,
	value,
}: {
	view: DataView;
	offset: number;
	value: string;
}): void {
	for (let index = 0; index < value.length; index += 1) {
		view.setUint8(offset + index, value.charCodeAt(index));
	}
}
