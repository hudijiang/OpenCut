import type {
	TranscriptionSegment,
	CaptionChunk,
} from "@/lib/transcription/types";
import {
	DEFAULT_MAX_TOKENS_PER_CAPTION,
	DEFAULT_SPLIT_CAPTIONS_ON_PUNCTUATION,
	DEFAULT_WORDS_PER_CAPTION,
	MIN_CAPTION_DURATION_SECONDS,
} from "@/lib/transcription/caption-defaults";

const CJK_CHARACTER_PATTERN =
	/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const PUNCTUATION_BOUNDARY_CHARACTERS = new Set([
	".",
	"!",
	"?",
	",",
	";",
	":",
	"。",
	"！",
	"？",
	"，",
	"、",
	"；",
	"：",
]);

interface TokenizedCaptionText {
	tokens: string[];
	joiner: string;
}

export function buildCaptionChunks({
	segments,
	maxTokensPerCaption,
	wordsPerChunk = DEFAULT_WORDS_PER_CAPTION,
	minDuration = MIN_CAPTION_DURATION_SECONDS,
	splitOnPunctuation = DEFAULT_SPLIT_CAPTIONS_ON_PUNCTUATION,
}: {
	segments: TranscriptionSegment[];
	maxTokensPerCaption?: number;
	wordsPerChunk?: number;
	minDuration?: number;
	splitOnPunctuation?: boolean;
}): CaptionChunk[] {
	const captions: CaptionChunk[] = [];
	let globalEndTime = 0;
	const chunkSize = Math.max(
		1,
		maxTokensPerCaption ?? wordsPerChunk ?? DEFAULT_MAX_TOKENS_PER_CAPTION,
	);

	for (const segment of segments) {
		const normalizedText = normalizeCaptionText({ text: segment.text });
		if (!normalizedText) continue;

		const segmentDuration = Math.max(segment.end - segment.start, minDuration);
		const chunks = buildSegmentChunks({
			text: normalizedText,
			maxTokensPerCaption: chunkSize,
			minDuration,
			segmentDuration,
			splitOnPunctuation,
		});
		if (chunks.length === 0) continue;

		const totalTokenCount = chunks.reduce(
			(total, chunk) => total + chunk.tokenCount,
			0,
		);
		let chunkStartTime = segment.start;

		for (const chunk of chunks) {
			const chunkDuration = Math.max(
				minDuration,
				segmentDuration * (chunk.tokenCount / totalTokenCount),
			);
			const adjustedStartTime = Math.max(chunkStartTime, globalEndTime);

			captions.push({
				text: chunk.text,
				startTime: adjustedStartTime,
				duration: chunkDuration,
			});

			globalEndTime = adjustedStartTime + chunkDuration;
			chunkStartTime += chunkDuration;
		}
	}

	return captions;
}

function normalizeCaptionText({ text }: { text: string }): string {
	return text
		.trim()
		.replace(/\r\n/g, "\n")
		.replace(/[ \t]+/g, " ");
}

function buildSegmentChunks({
	text,
	maxTokensPerCaption,
	minDuration,
	segmentDuration,
	splitOnPunctuation,
}: {
	text: string;
	maxTokensPerCaption: number;
	minDuration: number;
	segmentDuration: number;
	splitOnPunctuation: boolean;
}): Array<{ text: string; tokenCount: number }> {
	const phrases = splitCaptionTextIntoPhrases({
		text,
		splitOnPunctuation,
	});
	const chunks = phrases.flatMap((phrase) =>
		tokenizeChunkTexts({
			text: phrase,
			maxTokensPerCaption,
		}),
	);
	if (chunks.length === 0) {
		return [];
	}

	const maxChunkCount = Math.max(1, Math.floor(segmentDuration / minDuration));
	const constrainedChunks =
		chunks.length > maxChunkCount
			? mergeChunksToTargetCount({
					chunks,
					targetCount: maxChunkCount,
				})
			: chunks;

	return constrainedChunks.map((chunk) => ({
		text: chunk,
		tokenCount: tokenizeCaptionText({ text: chunk }).tokens.length,
	}));
}

function splitCaptionTextIntoPhrases({
	text,
	splitOnPunctuation,
}: {
	text: string;
	splitOnPunctuation: boolean;
}): string[] {
	if (!splitOnPunctuation) {
		return text
			.split("\n")
			.map((part) => part.trim())
			.filter((part) => part.length > 0);
	}

	const phrases: string[] = [];
	let current = "";

	for (const char of Array.from(text)) {
		if (char === "\n") {
			if (current.trim()) {
				phrases.push(current.trim());
			}
			current = "";
			continue;
		}

		current += char;
		if (PUNCTUATION_BOUNDARY_CHARACTERS.has(char)) {
			if (current.trim()) {
				phrases.push(current.trim());
			}
			current = "";
		}
	}

	if (current.trim()) {
		phrases.push(current.trim());
	}

	return phrases;
}

function tokenizeChunkTexts({
	text,
	maxTokensPerCaption,
}: {
	text: string;
	maxTokensPerCaption: number;
}): string[] {
	const tokenized = tokenizeCaptionText({ text });
	if (tokenized.tokens.length === 0) {
		return [];
	}

	const chunks: string[] = [];
	for (
		let index = 0;
		index < tokenized.tokens.length;
		index += maxTokensPerCaption
	) {
		chunks.push(
			tokenized.tokens
				.slice(index, index + maxTokensPerCaption)
				.join(tokenized.joiner),
		);
	}

	return chunks;
}

function tokenizeCaptionText({ text }: { text: string }): TokenizedCaptionText {
	const normalized = text.trim();
	if (!normalized) {
		return { tokens: [], joiner: " " };
	}

	if (/\s/u.test(normalized)) {
		return {
			tokens: normalized.split(/\s+/).filter((token) => token.length > 0),
			joiner: " ",
		};
	}

	if (CJK_CHARACTER_PATTERN.test(normalized)) {
		return {
			tokens: Array.from(normalized).filter((token) => token.trim().length > 0),
			joiner: "",
		};
	}

	return {
		tokens: [normalized],
		joiner: "",
	};
}

function mergeChunksToTargetCount({
	chunks,
	targetCount,
}: {
	chunks: string[];
	targetCount: number;
}): string[] {
	if (chunks.length <= targetCount) {
		return chunks;
	}

	const mergedChunks: string[] = [];

	for (let index = 0; index < targetCount; index++) {
		const start = Math.floor((index * chunks.length) / targetCount);
		const end = Math.floor(((index + 1) * chunks.length) / targetCount);
		const slice = chunks.slice(start, end);
		if (slice.length === 0) continue;

		mergedChunks.push(
			slice.reduce((combined, chunk) => {
				if (!combined) {
					return chunk;
				}

				return joinCaptionChunks({
					left: combined,
					right: chunk,
				});
			}, ""),
		);
	}

	return mergedChunks;
}

function joinCaptionChunks({
	left,
	right,
}: {
	left: string;
	right: string;
}): string {
	const leftChar = getTrailingVisibleCharacter({ value: left });
	const rightChar = getLeadingVisibleCharacter({ value: right });
	const shouldInsertSpace =
		leftChar != null &&
		rightChar != null &&
		!(
			CJK_CHARACTER_PATTERN.test(leftChar) &&
			CJK_CHARACTER_PATTERN.test(rightChar)
		);

	return `${left}${shouldInsertSpace ? " " : ""}${right}`;
}

function getLeadingVisibleCharacter({
	value,
}: {
	value: string;
}): string | null {
	return Array.from(value.trim())[0] ?? null;
}

function getTrailingVisibleCharacter({
	value,
}: {
	value: string;
}): string | null {
	const characters = Array.from(value.trim());
	return characters[characters.length - 1] ?? null;
}
