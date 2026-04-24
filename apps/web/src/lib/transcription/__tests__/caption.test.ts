import { describe, expect, test } from "bun:test";
import { buildCaptionChunks } from "@/lib/transcription/caption";

describe("buildCaptionChunks", () => {
	test("splits english captions with punctuation-aware chunking", () => {
		const chunks = buildCaptionChunks({
			segments: [
				{
					text: "This is the first sentence. This is another sentence for short videos!",
					start: 0,
					end: 4,
				},
			],
			maxTokensPerCaption: 4,
			minDuration: 0.5,
		});

		expect(chunks.map((chunk) => chunk.text)).toEqual([
			"This is the first",
			"sentence.",
			"This is another sentence",
			"for short videos!",
		]);
		expect(chunks[0]?.startTime).toBe(0);
		expect(
			chunks.every((chunk, index) => {
				if (index === 0) {
					return true;
				}

				const previousChunk = chunks[index - 1];
				return previousChunk
					? chunk.startTime >= previousChunk.startTime
					: true;
			}),
		).toBe(true);
	});

	test("splits CJK captions even when there is no whitespace", () => {
		const source = "这是一个适合短视频的自动字幕测试。";
		const chunks = buildCaptionChunks({
			segments: [
				{
					text: source,
					start: 0,
					end: 3,
				},
			],
			maxTokensPerCaption: 6,
			minDuration: 0.4,
		});

		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks.map((chunk) => chunk.text).join("")).toBe(source);
	});

	test("merges dense chunks when the segment duration is too short", () => {
		const chunks = buildCaptionChunks({
			segments: [
				{
					text: "One two three four five six seven eight",
					start: 0,
					end: 1,
				},
			],
			maxTokensPerCaption: 1,
			minDuration: 0.6,
		});

		expect(chunks).toHaveLength(1);
		expect(chunks[0]?.text).toBe("One two three four five six seven eight");
	});
});
