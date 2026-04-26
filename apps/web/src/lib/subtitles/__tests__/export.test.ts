import { describe, expect, mock, test } from "bun:test";
import type { SceneTracks, TextElement } from "@/lib/timeline/types";

mock.module("opencut-wasm", () => ({
	TICKS_PER_SECOND: () => 120_000,
}));

const {
	collectSubtitleCuesFromTracks,
	serializeSrt,
	serializeVtt,
} = await import("@/lib/subtitles/export");

const TICKS_PER_SECOND = 120_000;

describe("subtitle export", () => {
	test("serializes SRT cues with indexes and comma timestamps", () => {
		expect(
			serializeSrt({
				captions: [
					{ text: "Hello\nworld", startTime: 1.25, duration: 2.5 },
					{ text: "Next", startTime: 65, duration: 1.1 },
				],
			}),
		).toBe(
			"1\n00:00:01,250 --> 00:00:03,750\nHello\nworld\n\n2\n00:01:05,000 --> 00:01:06,100\nNext\n",
		);
	});

	test("serializes VTT cues with header and dot timestamps", () => {
		expect(
			serializeVtt({
				captions: [{ text: "Hello", startTime: 0, duration: 1.5 }],
			}),
		).toBe("WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nHello\n");
	});

	test("collects visible text elements from visible text tracks in timeline order", () => {
		const tracks = buildTracks({
			overlay: [
				{
					id: "text-1",
					name: "Text 1",
					type: "text",
					hidden: false,
					elements: [
						buildTextElement({
							id: "later",
							content: "Later",
							startTime: 5 * TICKS_PER_SECOND,
							duration: 2 * TICKS_PER_SECOND,
						}),
						buildTextElement({
							id: "hidden",
							content: "Hidden",
							startTime: 1 * TICKS_PER_SECOND,
							duration: 2 * TICKS_PER_SECOND,
							hidden: true,
						}),
						buildTextElement({
							id: "earlier",
							content: "Earlier",
							startTime: 1 * TICKS_PER_SECOND,
							duration: 2 * TICKS_PER_SECOND,
						}),
					],
				},
			],
		});

		expect(collectSubtitleCuesFromTracks({ tracks })).toEqual([
			{ text: "Earlier", startTime: 1, duration: 2 },
			{ text: "Later", startTime: 5, duration: 2 },
		]);
	});
});

function buildTracks({ overlay }: Pick<SceneTracks, "overlay">): SceneTracks {
	return {
		overlay,
		main: {
			id: "main",
			name: "Main",
			type: "video",
			muted: false,
			hidden: false,
			elements: [],
		},
		audio: [],
	};
}

function buildTextElement({
	id,
	content,
	startTime,
	duration,
	hidden = false,
}: {
	id: string;
	content: string;
	startTime: number;
	duration: number;
	hidden?: boolean;
}): TextElement {
	return {
		id,
		name: id,
		type: "text",
		content,
		startTime,
		duration,
		hidden,
		trimStart: 0,
		trimEnd: 0,
		fontSize: 48,
		fontFamily: "Inter",
		color: "#FFFFFF",
		background: {
			enabled: false,
			color: "transparent",
		},
		textAlign: "center",
		fontWeight: "normal",
		fontStyle: "normal",
		textDecoration: "none",
		transform: {
			scaleX: 1,
			scaleY: 1,
			position: { x: 0, y: 0 },
			rotate: 0,
		},
		opacity: 1,
	};
}
