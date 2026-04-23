import { z } from "zod";
import type { SpeakerDiarization, SpeakerSegment } from "@/lib/dubbing/types";

const ASSEMBLY_AI_BASE_URL = "https://api.assemblyai.com/v2";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 180;

const uploadResponseSchema = z.object({
	upload_url: z.string().url(),
});

const transcriptionSubmitResponseSchema = z.object({
	id: z.string().min(1),
});

const transcriptWordSchema = z.object({
	text: z.string(),
	start: z.number(),
	end: z.number(),
	confidence: z.number(),
	speaker: z.string().optional(),
});

const diarizationUtteranceSchema = z.object({
	speaker: z.string(),
	start: z.number(),
	end: z.number(),
	text: z.string(),
	confidence: z.number().optional(),
	words: z.array(transcriptWordSchema).optional(),
});

const diarizationResponseSchema = z.object({
	id: z.string(),
	status: z.enum(["queued", "processing", "completed", "error"]),
	text: z.string().optional(),
	language_code: z.string().optional(),
	language_confidence: z.number().optional(),
	error: z.string().optional(),
	words: z.array(transcriptWordSchema).optional(),
	utterances: z.array(diarizationUtteranceSchema).optional(),
});

class DubbingServiceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DubbingServiceError";
	}
}

async function parseErrorResponse(response: Response): Promise<string> {
	try {
		const data: unknown = await response.json();
		const schema = z.object({
			error: z.string().optional(),
			message: z.string().optional(),
		});
		const parsed = schema.safeParse(data);
		if (!parsed.success) {
			return `Request failed with status ${response.status}`;
		}
		return (
			parsed.data.error ??
			parsed.data.message ??
			`Request failed with status ${response.status}`
		);
	} catch {
		return `Request failed with status ${response.status}`;
	}
}

function assertApiKey(apiKey: string): void {
	if (apiKey.trim().length === 0) {
		throw new DubbingServiceError("AssemblyAI API key is required");
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export async function submitAudioForTranscription(
	audioBlob: Blob,
	apiKey: string,
): Promise<string> {
	assertApiKey(apiKey);

	try {
		const uploadResponse = await fetch(`${ASSEMBLY_AI_BASE_URL}/upload`, {
			method: "POST",
			headers: {
				authorization: apiKey,
				"content-type": "application/octet-stream",
			},
			body: audioBlob,
		});

		if (!uploadResponse.ok) {
			throw new DubbingServiceError(await parseErrorResponse(uploadResponse));
		}

		const uploadData: unknown = await uploadResponse.json();
		const uploadPayload = uploadResponseSchema.parse(uploadData);

		const transcriptResponse = await fetch(
			`${ASSEMBLY_AI_BASE_URL}/transcript`,
			{
				method: "POST",
				headers: {
					authorization: apiKey,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					audio_url: uploadPayload.upload_url,
					speaker_labels: true,
					language_detection: true,
				}),
			},
		);

		if (!transcriptResponse.ok) {
			throw new DubbingServiceError(
				await parseErrorResponse(transcriptResponse),
			);
		}

		const transcriptData: unknown = await transcriptResponse.json();
		const transcriptPayload =
			transcriptionSubmitResponseSchema.parse(transcriptData);

		return transcriptPayload.id;
	} catch (error) {
		if (error instanceof DubbingServiceError || error instanceof z.ZodError) {
			throw error;
		}
		throw new DubbingServiceError(
			error instanceof Error
				? error.message
				: "Failed to submit audio for transcription",
		);
	}
}

export async function pollTranscriptionResult(
	transcriptId: string,
	apiKey: string,
): Promise<SpeakerDiarization> {
	assertApiKey(apiKey);

	for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
		try {
			const response = await fetch(
				`${ASSEMBLY_AI_BASE_URL}/transcript/${encodeURIComponent(transcriptId)}`,
				{
					method: "GET",
					headers: {
						authorization: apiKey,
					},
				},
			);

			if (!response.ok) {
				throw new DubbingServiceError(await parseErrorResponse(response));
			}

			const responseData: unknown = await response.json();
			const payload = diarizationResponseSchema.parse(responseData);

			if (payload.status === "completed") {
				return payload;
			}

			if (payload.status === "error") {
				throw new DubbingServiceError(
					payload.error ?? "AssemblyAI transcription failed",
				);
			}
		} catch (error) {
			if (error instanceof DubbingServiceError || error instanceof z.ZodError) {
				throw error;
			}
			throw new DubbingServiceError(
				error instanceof Error
					? error.message
					: "Failed to poll transcription result",
			);
		}

		await sleep(POLL_INTERVAL_MS);
	}

	throw new DubbingServiceError("Transcription polling timed out");
}

export function extractSpeakerAudioSegments(
	audioBuffer: AudioBuffer,
	segments: ReadonlyArray<
		Pick<SpeakerSegment, "speakerId" | "startTime" | "endTime">
	>,
): Map<string, AudioBuffer[]> {
	const speakerBuffers = new Map<string, AudioBuffer[]>();

	for (const segment of segments) {
		const startFrame = Math.max(
			0,
			Math.floor((segment.startTime / 1000) * audioBuffer.sampleRate),
		);
		const endFrame = Math.min(
			audioBuffer.length,
			Math.ceil((segment.endTime / 1000) * audioBuffer.sampleRate),
		);
		const frameLength = Math.max(0, endFrame - startFrame);

		if (frameLength === 0) {
			continue;
		}

		const slicedBuffer = new AudioBuffer({
			length: frameLength,
			numberOfChannels: audioBuffer.numberOfChannels,
			sampleRate: audioBuffer.sampleRate,
		});

		for (
			let channel = 0;
			channel < audioBuffer.numberOfChannels;
			channel += 1
		) {
			const source = audioBuffer.getChannelData(channel);
			const target = slicedBuffer.getChannelData(channel);
			target.set(source.subarray(startFrame, endFrame));
		}

		const currentBuffers = speakerBuffers.get(segment.speakerId) ?? [];
		currentBuffers.push(slicedBuffer);
		speakerBuffers.set(segment.speakerId, currentBuffers);
	}

	return speakerBuffers;
}
