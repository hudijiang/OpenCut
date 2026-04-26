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

function assertLocalEndpoint(endpoint: string): URL {
	const trimmed = endpoint.trim();
	if (trimmed.length === 0) {
		throw new TtsServiceError("Local XTTS endpoint is required");
	}

	try {
		const url = new URL(trimmed);
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new TtsServiceError("Local XTTS endpoint must use http or https");
		}
		return url;
	} catch (error) {
		if (error instanceof TtsServiceError) {
			throw error;
		}
		throw new TtsServiceError("Local XTTS endpoint is invalid");
	}
}

function isCoquiTtsServerEndpoint(url: URL): boolean {
	return url.pathname.replace(/\/+$/, "").endsWith("/api/tts");
}

function containsCjkText(text: string): boolean {
	return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/u.test(text);
}

async function parseLocalXttsErrorResponse(response: Response): Promise<string> {
	const fallback = `Local XTTS request failed with status ${response.status}`;
	const responseClone = response.clone();
	try {
		const data: unknown = await response.json();
		const schema = z.object({
			detail: z
				.union([z.string(), z.object({ message: z.string().optional() })])
				.optional(),
			error: z.string().optional(),
			message: z.string().optional(),
		});
		const parsed = schema.safeParse(data);
		if (!parsed.success) {
			const text = await responseClone.text();
			return text.trim() || fallback;
		}

		return (
			(typeof parsed.data.detail === "string"
				? parsed.data.detail
				: parsed.data.detail?.message) ??
			parsed.data.error ??
			parsed.data.message ??
			fallback
		);
	} catch {
		try {
			const text = await responseClone.text();
			return text.trim() || fallback;
		} catch {
			return fallback;
		}
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

export async function synthesizeLocalXttsSegment({
	text,
	language,
	endpoint,
	requestFormat,
	speakerSample,
	speakerWav,
}: {
	text: string;
	language: string;
	endpoint: string;
	requestFormat: "multipart" | "json";
	speakerSample?: Blob;
	speakerWav: string;
}): Promise<{ audioBuffer: ArrayBuffer; contentType: string }> {
	const url = assertLocalEndpoint(endpoint);

	if (text.trim().length === 0) {
		throw new TtsServiceError("Text is required");
	}

	try {
		const response = isCoquiTtsServerEndpoint(url)
			? await fetch(buildCoquiTtsServerUrl({ url, text, language, speakerWav }), {
					method: "GET",
					headers: {
						accept: "audio/wav",
					},
				})
			: requestFormat === "multipart"
				? await fetch(url, {
						method: "POST",
						body: buildLocalXttsFormData({
							text,
							language,
							speakerSample,
							speakerWav,
						}),
					})
				: await fetch(url, {
						method: "POST",
						headers: {
							"content-type": "application/json",
						},
						body: JSON.stringify({
							text,
							language,
							speaker_wav: speakerWav,
						}),
					});

		if (!response.ok) {
			const errorMessage = await parseLocalXttsErrorResponse(response);
			throw new TtsServiceError(
				isCoquiTtsServerEndpoint(url)
					? buildCoquiTtsServerErrorMessage({
							errorMessage,
							language,
							text,
						})
					: errorMessage,
			);
		}

		return {
			audioBuffer: await response.arrayBuffer(),
			contentType: response.headers.get("content-type") ?? "audio/wav",
		};
	} catch (error) {
		if (error instanceof TtsServiceError) {
			throw error;
		}
		throw new TtsServiceError(
			error instanceof Error ? error.message : "Local XTTS synthesis failed",
		);
	}
}

function buildCoquiTtsServerErrorMessage({
	errorMessage,
	language,
	text,
}: {
	errorMessage: string;
	language: string;
	text: string;
}): string {
	if (containsCjkText(text)) {
		return `Coqui TTS server failed while synthesizing ${language} text. Your current server model appears unable to synthesize CJK text; start Coqui with an XTTS v2 multilingual model or choose a supported target language.`;
	}

	if (errorMessage.trim().startsWith("<!doctype html>")) {
		return "Coqui TTS server returned 500. Check the Coqui server console for the Python traceback and confirm the model supports voice cloning, the selected language, and the reference audio file.";
	}

	return errorMessage;
}

function buildCoquiTtsServerUrl({
	url,
	text,
	language,
	speakerWav,
}: {
	url: URL;
	text: string;
	language: string;
	speakerWav: string;
}): URL {
	const requestUrl = new URL(url);
	requestUrl.searchParams.set("text", text);
	requestUrl.searchParams.set("speaker_id", "");
	requestUrl.searchParams.set("speaker_wav", speakerWav);
	requestUrl.searchParams.set("style_wav", "");
	requestUrl.searchParams.set("language_id", language);
	return requestUrl;
}

function buildLocalXttsFormData({
	text,
	language,
	speakerSample,
	speakerWav,
}: {
	text: string;
	language: string;
	speakerSample: Blob | undefined;
	speakerWav: string;
}): FormData {
	const formData = new FormData();
	formData.append("text", text);
	formData.append("language", language);

	if (speakerSample) {
		formData.append("speaker_wav", toSampleFile({ audioSample: speakerSample, index: 0 }));
		formData.append("speaker_sample", toSampleFile({ audioSample: speakerSample, index: 0 }));
	} else {
		formData.append("speaker_wav", speakerWav);
	}

	return formData;
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
