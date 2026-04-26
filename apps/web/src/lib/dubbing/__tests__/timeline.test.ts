import { describe, expect, mock, test } from "bun:test";
import type {
	AudioElement,
	AudioTrack,
	SceneTracks,
	VideoTrack,
} from "@/lib/timeline";
import type { MediaAsset } from "@/lib/media/types";

mock.module("opencut-wasm", () => ({
	TICKS_PER_SECOND: () => 120_000,
}));

const { collectAudibleCandidates, timelineHasAudio } = await import(
	"@/lib/media/audio"
);
const { DUBBING_OUTPUT_ROLE, prepareTracksForDubbingApply } = await import(
	"@/lib/dubbing/timeline"
);

const TICKS_PER_SECOND = 120_000;

function buildAudioElement({
	id,
	mediaId,
	role,
}: {
	id: string;
	mediaId: string;
	role?: AudioElement["role"];
}): AudioElement {
	return {
		id,
		type: "audio",
		sourceType: "upload",
		mediaId,
		name: id,
		duration: TICKS_PER_SECOND,
		startTime: 0,
		trimStart: 0,
		trimEnd: 0,
		sourceDuration: TICKS_PER_SECOND,
		volume: 1,
		muted: false,
		...(role ? { role } : {}),
	};
}

function buildAudioTrack({
	id,
	muted = false,
	mutedByDubbing,
	elements,
}: {
	id: string;
	muted?: boolean;
	mutedByDubbing?: boolean;
	elements: AudioElement[];
}): AudioTrack {
	return {
		id,
		name: id,
		type: "audio",
		muted,
		...(mutedByDubbing === undefined ? {} : { mutedByDubbing }),
		elements,
	};
}

function buildMainTrack(): VideoTrack {
	return {
		id: "main",
		name: "main",
		type: "video",
		muted: false,
		hidden: false,
		elements: [],
	};
}

function buildMediaAsset(id: string): MediaAsset {
	return {
		id,
		name: `${id}.wav`,
		type: "audio",
		file: new File(["audio"], `${id}.wav`, { type: "audio/wav" }),
	};
}

describe("dubbing timeline helpers", () => {
	test("marks only dubbing-managed source tracks when applying dubbing", () => {
		const sourceElement = buildAudioElement({
			id: "source",
			mediaId: "source-media",
		});
		const userMutedElement = buildAudioElement({
			id: "user-muted",
			mediaId: "user-muted-media",
		});
		const dubbedElement = buildAudioElement({
			id: "dubbed",
			mediaId: "dubbed-media",
			role: DUBBING_OUTPUT_ROLE,
		});
		const tracks: SceneTracks = {
			overlay: [],
			main: buildMainTrack(),
			audio: [
				buildAudioTrack({ id: "source-track", elements: [sourceElement] }),
				buildAudioTrack({
					id: "user-muted-track",
					muted: true,
					elements: [userMutedElement],
				}),
				buildAudioTrack({
					id: "previous-dubbed-track",
					elements: [dubbedElement],
				}),
			],
		};

		const nextTracks = prepareTracksForDubbingApply({ tracks });

		expect(nextTracks.audio[0].muted).toBe(true);
		expect(nextTracks.audio[0].mutedByDubbing).toBe(true);
		expect(nextTracks.audio[1].muted).toBe(true);
		expect(nextTracks.audio[1].mutedByDubbing).toBeUndefined();
		expect(nextTracks.audio[2].muted).toBe(true);
		expect(nextTracks.audio[2].mutedByDubbing).toBe(true);
	});

	test("re-analysis can use original audio while ignoring previous dubbing output", () => {
		const sourceElement = buildAudioElement({
			id: "source",
			mediaId: "source-media",
		});
		const dubbedElement = buildAudioElement({
			id: "dubbed",
			mediaId: "dubbed-media",
			role: DUBBING_OUTPUT_ROLE,
		});
		const tracks: SceneTracks = {
			overlay: [],
			main: buildMainTrack(),
			audio: [
				buildAudioTrack({
					id: "source-track",
					muted: true,
					mutedByDubbing: true,
					elements: [sourceElement],
				}),
				buildAudioTrack({
					id: "dubbed-track",
					elements: [dubbedElement],
				}),
			],
		};
		const mediaAssets = [
			buildMediaAsset("source-media"),
			buildMediaAsset("dubbed-media"),
		];

		const candidates = collectAudibleCandidates({
			tracks,
			mediaAssets,
			excludeDubbingOutput: true,
			includeTracksMutedByDubbing: true,
		});

		expect(candidates.map(({ element }) => element.id)).toEqual(["source"]);
		expect(
			timelineHasAudio({
				tracks,
				mediaAssets,
				excludeDubbingOutput: true,
				includeTracksMutedByDubbing: true,
			}),
		).toBe(true);
	});

	test("re-analysis does not treat previous dubbing output as source audio", () => {
		const dubbedElement = buildAudioElement({
			id: "dubbed",
			mediaId: "dubbed-media",
			role: DUBBING_OUTPUT_ROLE,
		});
		const tracks: SceneTracks = {
			overlay: [],
			main: buildMainTrack(),
			audio: [
				buildAudioTrack({
					id: "dubbed-track",
					elements: [dubbedElement],
				}),
			],
		};

		expect(
			timelineHasAudio({
				tracks,
				mediaAssets: [buildMediaAsset("dubbed-media")],
				excludeDubbingOutput: true,
				includeTracksMutedByDubbing: true,
			}),
		).toBe(false);
	});

	test("re-analysis recovers legacy projects with untagged dubbed tracks", () => {
		const sourceElement = buildAudioElement({
			id: "source",
			mediaId: "source-media",
		});
		const legacyDubbedElement = {
			...buildAudioElement({
				id: "legacy-dubbed",
				mediaId: "legacy-dubbed-media",
			}),
			name: "Speaker 1 (Dubbed)",
		};
		const tracks: SceneTracks = {
			overlay: [],
			main: buildMainTrack(),
			audio: [
				buildAudioTrack({
					id: "legacy-muted-source-track",
					muted: true,
					elements: [sourceElement],
				}),
				buildAudioTrack({
					id: "legacy-dubbed-track",
					elements: [legacyDubbedElement],
				}),
			],
		};
		const mediaAssets = [
			buildMediaAsset("source-media"),
			{
				...buildMediaAsset("legacy-dubbed-media"),
				name: "opencut-dubbed-track.wav",
			},
		];

		const candidates = collectAudibleCandidates({
			tracks,
			mediaAssets,
			excludeDubbingOutput: true,
			includeTracksMutedByDubbing: true,
		});

		expect(candidates.map(({ element }) => element.id)).toEqual(["source"]);
	});
});
