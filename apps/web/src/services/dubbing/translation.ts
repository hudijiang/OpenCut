import { z } from "zod";
import type { SpeakerSegment } from "@/lib/dubbing/types";

const DEEPSEEK_CHAT_COMPLETIONS_URL =
	"https://api.deepseek.com/chat/completions";
const TRANSLATION_BATCH_SIZE = 20;
const TRANSLATION_MODEL = "deepseek-v4-flash";

const deepSeekResponseSchema = z.object({
	choices: z
		.array(
			z.object({
				message: z.object({
					content: z.string(),
				}),
			}),
		)
		.min(1),
});

const translationItemSchema = z.object({
	id: z.string(),
	translatedText: z.string().min(1),
});

const translationPayloadSchema = z.object({
	translations: z.array(translationItemSchema),
});

class TranslationServiceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TranslationServiceError";
	}
}

async function parseErrorResponse(response: Response): Promise<string> {
	try {
		const data: unknown = await response.json();
		const schema = z.object({
			error: z
				.object({
					message: z.string().optional(),
				})
				.optional(),
			message: z.string().optional(),
		});
		const parsed = schema.safeParse(data);
		if (!parsed.success) {
			return `DeepSeek request failed with status ${response.status}`;
		}
		return (
			parsed.data.error?.message ??
			parsed.data.message ??
			`DeepSeek request failed with status ${response.status}`
		);
	} catch {
		return `DeepSeek request failed with status ${response.status}`;
	}
}

function assertApiKey(apiKey: string): void {
	if (apiKey.trim().length === 0) {
		throw new TranslationServiceError("DeepSeek API key is required");
	}
}

function buildPrompt({
	segments,
	targetLanguage,
}: {
	segments: SpeakerSegment[];
	targetLanguage: string;
}): string {
	return [
		"You are translating multi-speaker dubbing segments for a video editor.",
		`Target language: ${targetLanguage}.`,
		"Preserve each speaker's tone, formality, emotion, and voice-style cues.",
		"Keep speaker intent natural for dubbing, avoid explanations, and keep line lengths practical for speech.",
		'Return strict JSON with shape {"translations":[{"id":"...","translatedText":"..."}]}.',
		"Translate every segment exactly once and do not omit IDs.",
		JSON.stringify(
			segments.map((segment) => ({
				id: segment.id,
				speakerId: segment.speakerId,
				text: segment.text,
				previousTranslation: segment.translatedText,
			})),
		),
	].join("\n");
}

async function translateBatch({
	segments,
	targetLanguage,
	apiKey,
}: {
	segments: SpeakerSegment[];
	targetLanguage: string;
	apiKey: string;
}): Promise<SpeakerSegment[]> {
	const response = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
		method: "POST",
		headers: {
			authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: TRANSLATION_MODEL,
			temperature: 0.2,
			response_format: {
				type: "json_object",
			},
			messages: [
				{
					role: "system",
					content:
						"Translate dialogue for localized dubbing. Output only valid JSON.",
				},
				{
					role: "user",
					content: buildPrompt({ segments, targetLanguage }),
				},
			],
		}),
	});

	if (!response.ok) {
		throw new TranslationServiceError(await parseErrorResponse(response));
	}

	const completionData: unknown = await response.json();
	const completion = deepSeekResponseSchema.parse(completionData);
	const content = completion.choices[0]?.message.content;

	if (!content) {
		throw new TranslationServiceError("DeepSeek returned an empty translation");
	}

	let parsedContent: unknown;
	try {
		parsedContent = JSON.parse(content);
	} catch {
		throw new TranslationServiceError("DeepSeek returned invalid JSON");
	}

	const translationPayload = translationPayloadSchema.parse(parsedContent);
	const translatedById = new Map<string, string>();

	for (const item of translationPayload.translations) {
		translatedById.set(item.id, item.translatedText);
	}

	const nextSegments: SpeakerSegment[] = [];
	for (const segment of segments) {
		const translatedText = translatedById.get(segment.id);
		if (!translatedText) {
			throw new TranslationServiceError(
				`Missing translation for segment ${segment.id}`,
			);
		}

		nextSegments.push({
			...segment,
			translatedText,
		});
	}

	return nextSegments;
}

export async function translateSegments(
	segments: SpeakerSegment[],
	targetLanguage: string,
	apiKey: string,
): Promise<SpeakerSegment[]> {
	assertApiKey(apiKey);

	try {
		const translatedSegments: SpeakerSegment[] = [];

		for (
			let startIndex = 0;
			startIndex < segments.length;
			startIndex += TRANSLATION_BATCH_SIZE
		) {
			const batch = segments.slice(
				startIndex,
				startIndex + TRANSLATION_BATCH_SIZE,
			);
			const translatedBatch = await translateBatch({
				segments: batch,
				targetLanguage,
				apiKey,
			});

			for (const segment of translatedBatch) {
				translatedSegments.push(segment);
			}
		}

		return translatedSegments;
	} catch (error) {
		if (
			error instanceof TranslationServiceError ||
			error instanceof z.ZodError
		) {
			throw error;
		}
		throw new TranslationServiceError(
			error instanceof Error ? error.message : "Translation failed",
		);
	}
}
