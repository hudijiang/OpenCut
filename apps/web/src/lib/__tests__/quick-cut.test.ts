import { describe, expect, mock, test } from "bun:test";
import type { QuickCutTarget } from "@/lib/quick-cut";
import type { Transform } from "@/lib/rendering";
import type { MediaAsset } from "@/lib/media/types";
import type { TScene } from "@/lib/timeline";

mock.module("opencut-wasm", () => ({
	TICKS_PER_SECOND: () => 120_000,
}));

const {
	DEFAULT_QUICK_CUT_CONFIG,
	analyzeQuickCuts,
	applyQuickCutSuggestions,
	getAutoCenterSuggestions,
} = await import("@/lib/quick-cut");
const { TICKS_PER_SECOND } = await import("@/lib/wasm/ticks");

function buildTransform(): Transform {
	return {
		scaleX: 1,
		scaleY: 1,
		position: { x: 0, y: 0 },
		rotate: 0,
	};
}

function buildAudioBuffer(samples: number[], sampleRate = 100): AudioBuffer {
	const channelData = Float32Array.from(samples);
	return {
		sampleRate,
		numberOfChannels: 1,
		length: channelData.length,
		getChannelData: () => channelData,
	} as AudioBuffer;
}

function buildScene(): TScene {
	return {
		id: "scene-1",
		name: "Scene",
		isMain: true,
		bookmarks: [],
		createdAt: new Date("2026-04-24T00:00:00.000Z"),
		updatedAt: new Date("2026-04-24T00:00:00.000Z"),
		tracks: {
			overlay: [],
			main: {
				id: "track-main",
				name: "Main",
				type: "video",
				muted: false,
				hidden: false,
				elements: [
					{
						id: "clip-a",
						type: "video",
						name: "Clip A",
						mediaId: "asset-a",
						duration: 10 * TICKS_PER_SECOND,
						startTime: 0,
						trimStart: 0,
						trimEnd: 0,
						sourceDuration: 10 * TICKS_PER_SECOND,
						transform: buildTransform(),
						opacity: 1,
						volume: 1,
						muted: false,
						isSourceAudioEnabled: true,
						hidden: false,
					},
					{
						id: "clip-b",
						type: "video",
						name: "Clip B",
						mediaId: "asset-b",
						duration: 4 * TICKS_PER_SECOND,
						startTime: 10 * TICKS_PER_SECOND,
						trimStart: 0,
						trimEnd: 0,
						sourceDuration: 4 * TICKS_PER_SECOND,
						transform: buildTransform(),
						opacity: 1,
						volume: 1,
						muted: false,
						isSourceAudioEnabled: true,
						hidden: false,
					},
				],
			},
			audio: [],
		},
	};
}

describe("quick cut", () => {
	test("detects silent spans inside a talking-head clip", () => {
		const target: QuickCutTarget = {
			trackId: "track-main",
			element: buildScene().tracks.main.elements[0],
			audio: {
				timelineElement: buildScene().tracks.main.elements[0],
				buffer: buildAudioBuffer([
					0.6, 0.7, 0.6, 0.7, 0.6, 0, 0, 0, 0, 0, 0.7, 0.7, 0.6, 0.7, 0.7,
				]),
				startTime: 0,
				duration: 0.15,
				trimStart: 0,
				trimEnd: 0,
				volume: 1,
				muted: false,
			},
		};

		const analysis = analyzeQuickCuts({
			scope: "selection",
			targets: [target],
			config: {
				...DEFAULT_QUICK_CUT_CONFIG,
				silenceThreshold: 0.05,
				minSilenceDuration: 0.02,
				keepPadding: 0,
				analysisWindow: 0.01,
			},
		});

		expect(analysis.suggestions.length).toBeGreaterThan(0);
		expect(analysis.removableDuration).toBeGreaterThan(0);
	});

	test("applies jump cut suggestions and ripples later clips earlier", () => {
		const scene = buildScene();
		const nextTracks = applyQuickCutSuggestions({
			tracks: scene.tracks,
			suggestions: [
				{
					id: "clip-a:1",
					trackId: "track-main",
					elementId: "clip-a",
					elementName: "Clip A",
					localStartTime: 2 * TICKS_PER_SECOND,
					localEndTime: 4 * TICKS_PER_SECOND,
					timelineStartTime: 2 * TICKS_PER_SECOND,
					timelineEndTime: 4 * TICKS_PER_SECOND,
					duration: 2 * TICKS_PER_SECOND,
				},
			],
		});

		expect(nextTracks.main.elements[0]?.duration).toBe(2 * TICKS_PER_SECOND);
		expect(nextTracks.main.elements[1]?.startTime).toBe(2 * TICKS_PER_SECOND);
		expect(nextTracks.main.elements[2]?.startTime).toBe(8 * TICKS_PER_SECOND);
	});

	test("suggests cover-based auto-centering for landscape clips on portrait canvas", () => {
		const scene = buildScene();
		scene.tracks.main.elements[0].transform.position.x = 180;
		const mediaAssets: MediaAsset[] = [
			{
				id: "asset-a",
				name: "Clip A",
				type: "video",
				file: new File(["video"], "clip-a.mp4", { type: "video/mp4" }),
				width: 1920,
				height: 1080,
			},
		];

		const suggestions = getAutoCenterSuggestions({
			scene,
			scope: "main-track",
			selectedElements: [],
			mediaAssets,
			canvasSize: { width: 1080, height: 1920 },
		});

		expect(suggestions[0]?.nextTransform.position.x).toBe(0);
		expect(Math.abs(suggestions[0]?.nextTransform.scaleX ?? 0)).toBeGreaterThan(
			1,
		);
	});
});
