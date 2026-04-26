import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { alignAudioDuration } from "../mixer";

const SAMPLE_RATE = 1000;

const originalAudioBuffer = globalThis.AudioBuffer;
const originalOfflineAudioContext = globalThis.OfflineAudioContext;

class TestAudioBuffer {
	readonly length: number;
	readonly sampleRate: number;
	readonly numberOfChannels: number;
	private readonly channels: Float32Array[];

	constructor({
		length,
		sampleRate,
		numberOfChannels,
	}: AudioBufferOptions) {
		this.length = Math.max(1, length);
		this.sampleRate = sampleRate;
		this.numberOfChannels = Math.max(1, numberOfChannels);
		this.channels = Array.from(
			{ length: this.numberOfChannels },
			() => new Float32Array(this.length),
		);
	}

	get duration(): number {
		return this.length / this.sampleRate;
	}

	getChannelData(channel: number): Float32Array {
		const channelData = this.channels[channel];
		if (!channelData) {
			throw new Error(`Missing channel ${channel}`);
		}

		return channelData;
	}
}

class TestOfflineAudioContext {
	private sourceBuffer: AudioBuffer | null = null;
	private playbackRate = 1;

	constructor(
		private readonly numberOfChannels: number,
		private readonly length: number,
		private readonly sampleRate: number,
	) {}

	createBufferSource(): AudioBufferSourceNode {
		const sourceNode = {
			buffer: null as AudioBuffer | null,
			playbackRate: { value: 1 },
			connect: () => undefined,
			start: () => {
				this.sourceBuffer = sourceNode.buffer;
				this.playbackRate = sourceNode.playbackRate.value;
			},
		};

		return sourceNode as unknown as AudioBufferSourceNode;
	}

	async startRendering(): Promise<AudioBuffer> {
		const output = new TestAudioBuffer({
			length: this.length,
			sampleRate: this.sampleRate,
			numberOfChannels: this.numberOfChannels,
		});

		for (let channel = 0; channel < output.numberOfChannels; channel += 1) {
			const outputData = output.getChannelData(channel);
			const sourceChannelIndex = Math.min(
				channel,
				(this.sourceBuffer?.numberOfChannels ?? 1) - 1,
			);
			const sourceData = this.sourceBuffer?.getChannelData(sourceChannelIndex);

			for (let index = 0; index < output.length; index += 1) {
				const sourceIndex = Math.floor(index * this.playbackRate);
				outputData[index] = sourceData?.[sourceIndex] ?? 0;
			}
		}

		return output as unknown as AudioBuffer;
	}
}

function installWebAudioTestDoubles(): void {
	Object.defineProperty(globalThis, "AudioBuffer", {
		configurable: true,
		writable: true,
		value: TestAudioBuffer,
	});
	Object.defineProperty(globalThis, "OfflineAudioContext", {
		configurable: true,
		writable: true,
		value: TestOfflineAudioContext,
	});
}

function restoreWebAudioGlobals(): void {
	Object.defineProperty(globalThis, "AudioBuffer", {
		configurable: true,
		writable: true,
		value: originalAudioBuffer,
	});
	Object.defineProperty(globalThis, "OfflineAudioContext", {
		configurable: true,
		writable: true,
		value: originalOfflineAudioContext,
	});
}

function createBuffer(durationSec: number): AudioBuffer {
	const buffer = new TestAudioBuffer({
		length: Math.ceil(durationSec * SAMPLE_RATE),
		sampleRate: SAMPLE_RATE,
		numberOfChannels: 1,
	});
	const channel = buffer.getChannelData(0);
	for (let index = 0; index < channel.length; index += 1) {
		channel[index] = index / channel.length;
	}

	return buffer as unknown as AudioBuffer;
}

beforeAll(() => {
	installWebAudioTestDoubles();
});

afterAll(() => {
	restoreWebAudioGlobals();
});

describe("alignAudioDuration", () => {
	test("keeps in-range TTS at the target duration", async () => {
		const aligned = await alignAudioDuration(createBuffer(1.2), 1);

		expect(aligned.length).toBe(SAMPLE_RATE);
		expect(aligned.duration).toBe(1);
	});

	test("pads short TTS to the target duration", async () => {
		const aligned = await alignAudioDuration(createBuffer(0.2), 1);

		expect(aligned.length).toBe(SAMPLE_RATE);
		expect(aligned.duration).toBe(1);
	});

	test("does not truncate TTS that exceeds the maximum stretch rate", async () => {
		const aligned = await alignAudioDuration(createBuffer(1.5), 1);

		expect(aligned.length).toBe(Math.ceil((1.5 / 1.3) * SAMPLE_RATE));
		expect(aligned.duration).toBeGreaterThan(1);
	});
});
