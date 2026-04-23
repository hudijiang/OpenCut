import { z } from "zod";
import type { VoiceCloneResult } from "@/lib/dubbing/types";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

const voiceCloneResponseSchema = z.object({
	voice_id: z.string().min(1),
});

const languageCodeMap = new Map<string, string>([
	["ar", "ar"],
	["de", "de"],
	["en", "en"],
	["es", "es"],
	["fr", "fr"],
	["hi", "hi"],
	["id", "id"],
	["it", "it"],
	["ja", "ja"],
	["ko", "ko"],
	["ms", "ms"],
	["nl", "nl"],
	["pl", "pl"],
	["pt", "pt"],
	["ru", "ru"],
	["th", "th"],
	["tr", "tr"],
	["uk", "uk"],
	["vi", "vi"],
	["zh", "zh"],
]);

class TtsServiceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TtsServiceError";
	}
}

async function parseErrorResponse(response: Response): Promise<string> {
	try {
		const data: unknown = await response.json();
		const schema = z.object({
			detail: z
				.object({
					message: z.string().optional(),
				})
				.optional(),
			message: z.string().optional(),
		});
		const parsed = schema.safeParse(data);
		if (!parsed.success) {
			return `ElevenLabs request failed with status ${response.status}`;
		}
		return (
			parsed.data.detail?.message ??
			parsed.data.message ??
			`ElevenLabs request failed with status ${response.status}`
		);
	} catch {
		return `ElevenLabs request failed with status ${response.status}`;
	}
}

function assertApiKey(apiKey: string): void {
	if (apiKey.trim().length === 0) {
		throw new TtsServiceError("ElevenLabs API key is required");
	}
}

function toSampleFile({
	audioSample,
	index,
}: {
	audioSample: Blob;
	index: number;
}): File {
	if (audioSample instanceof File) {
		return audioSample;
	}

	return new File([audioSample], `sample-${index + 1}.wav`, {
		type: audioSample.type || "audio/wav",
	});
}

export function mapElevenLabsLanguageCode(languageCode: string): string {
	return languageCodeMap.get(languageCode) ?? "en";
}

export async function cloneVoice(
	speakerId: string,
	audioSamples: Blob[],
	apiKey: string,
): Promise<VoiceCloneResult> {
	assertApiKey(apiKey);

	if (audioSamples.length === 0) {
		throw new TtsServiceError("At least one audio sample is required");
	}

	try {
		const formData = new FormData();
		formData.append("name", `OpenCut ${speakerId}`);
		formData.append(
			"description",
			`Temporary OpenCut dubbing clone for ${speakerId}`,
		);

		for (const [index, audioSample] of audioSamples.entries()) {
			formData.append("files", toSampleFile({ audioSample, index }));
		}

		// Assumes the ElevenLabs v1 voice cloning REST shape as of April 2026.
		const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/add`, {
			method: "POST",
			headers: {
				"xi-api-key": apiKey,
			},
			body: formData,
		});

		if (!response.ok) {
			throw new TtsServiceError(await parseErrorResponse(response));
		}

		const cloneData: unknown = await response.json();
		const payload = voiceCloneResponseSchema.parse(cloneData);

		return {
			speakerId,
			voiceId: payload.voice_id,
		};
	} catch (error) {
		if (error instanceof TtsServiceError || error instanceof z.ZodError) {
			throw error;
		}
		throw new TtsServiceError(
			error instanceof Error ? error.message : "Voice cloning failed",
		);
	}
}

export async function synthesizeSegment(
	text: string,
	voiceId: string,
	targetLang: string,
	apiKey: string,
): Promise<ArrayBuffer> {
	assertApiKey(apiKey);

	try {
		// ElevenLabs was chosen for multilingual dubbing because its REST API and
		// cloned voices are materially more stable than the alternatives we tested.
		const response = await fetch(
			`${ELEVENLABS_BASE_URL}/text-to-speech/${encodeURIComponent(voiceId)}`,
			{
				method: "POST",
				headers: {
					"xi-api-key": apiKey,
					"content-type": "application/json",
					accept: "audio/mpeg",
				},
				body: JSON.stringify({
					text,
					model_id: "eleven_turbo_v2_5",
					language_code: mapElevenLabsLanguageCode(targetLang),
				}),
			},
		);

		if (!response.ok) {
			throw new TtsServiceError(await parseErrorResponse(response));
		}

		return await response.arrayBuffer();
	} catch (error) {
		if (error instanceof TtsServiceError) {
			throw error;
		}
		throw new TtsServiceError(
			error instanceof Error ? error.message : "Speech synthesis failed",
		);
	}
}

export async function deleteClonedVoice(
	voiceId: string,
	apiKey: string,
): Promise<void> {
	assertApiKey(apiKey);

	try {
		const response = await fetch(
			`${ELEVENLABS_BASE_URL}/voices/${encodeURIComponent(voiceId)}`,
			{
				method: "DELETE",
				headers: {
					"xi-api-key": apiKey,
				},
			},
		);

		if (!response.ok) {
			throw new TtsServiceError(await parseErrorResponse(response));
		}
	} catch (error) {
		if (error instanceof TtsServiceError) {
			throw error;
		}
		throw new TtsServiceError(
			error instanceof Error ? error.message : "Failed to delete cloned voice",
		);
	}
}
