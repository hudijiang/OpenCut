import { computeRippleAdjustments, applyRippleAdjustments } from "@/lib/ripple";
import { getSourceTimeAtClipTime } from "@/lib/retime";
import type { Transform } from "@/lib/rendering";
import type { MediaAsset } from "@/lib/media/types";
import {
	collectAudioElements,
	createAudioContext,
	type CollectedAudioElement,
} from "@/lib/media/audio";
import { computeRmsBuckets } from "@/lib/media/waveform-summary";
import { generateUUID } from "@/utils/id";
import type {
	ElementRef,
	ImageElement,
	SceneTracks,
	TScene,
	TimelineElement,
	TimelineTrack,
	VideoElement,
} from "@/lib/timeline";
import { canElementHaveAudio } from "@/lib/timeline/element-utils";
import { TICKS_PER_SECOND } from "@/lib/wasm/ticks";

export type QuickCutScope = "selection" | "main-track";

export interface QuickCutConfig {
	silenceThreshold: number;
	minSilenceDuration: number;
	keepPadding: number;
	analysisWindow: number;
}

export interface QuickCutSuggestion {
	id: string;
	trackId: string;
	elementId: string;
	elementName: string;
	localStartTime: number;
	localEndTime: number;
	timelineStartTime: number;
	timelineEndTime: number;
	duration: number;
}

export interface QuickCutTarget {
	trackId: string;
	element: TimelineElement;
	audio: CollectedAudioElement;
}

export interface QuickCutAnalysis {
	scope: QuickCutScope;
	targets: QuickCutTarget[];
	suggestions: QuickCutSuggestion[];
	removableDuration: number;
	warnings: string[];
}

export interface AutoCenterSuggestion {
	trackId: string;
	elementId: string;
	elementName: string;
	nextTransform: Transform;
	reason: "recenter" | "cover-crop";
}

export const DEFAULT_QUICK_CUT_CONFIG: QuickCutConfig = {
	silenceThreshold: 0.03,
	minSilenceDuration: 0.28,
	keepPadding: 0.06,
	analysisWindow: 0.05,
};

function ticksFromSeconds(seconds: number) {
	return Math.round(seconds * TICKS_PER_SECOND);
}

function secondsFromTicks(time: number) {
	return time / TICKS_PER_SECOND;
}

function getTargetRefs({
	scene,
	scope,
	selectedElements,
}: {
	scene: TScene;
	scope: QuickCutScope;
	selectedElements: ElementRef[];
}) {
	if (scope === "selection") {
		return selectedElements;
	}

	return scene.tracks.main.elements
		.filter((element) => element.type === "video")
		.map((element) => ({
			trackId: scene.tracks.main.id,
			elementId: element.id,
		}));
}

function findTrackById({ scene, trackId }: { scene: TScene; trackId: string }) {
	if (scene.tracks.main.id === trackId) {
		return scene.tracks.main;
	}

	return (
		scene.tracks.overlay.find((track) => track.id === trackId) ??
		scene.tracks.audio.find((track) => track.id === trackId) ??
		null
	);
}

function mergeIntervals(intervals: Array<{ start: number; end: number }>) {
	const sorted = [...intervals]
		.filter((interval) => interval.end > interval.start)
		.sort((left, right) => left.start - right.start);
	if (sorted.length === 0) {
		return [];
	}

	const merged = [sorted[0]];
	for (const interval of sorted.slice(1)) {
		const previous = merged[merged.length - 1];
		if (interval.start <= previous.end) {
			previous.end = Math.max(previous.end, interval.end);
			continue;
		}

		merged.push({ ...interval });
	}

	return merged;
}

function buildSuggestionId({
	elementId,
	startTime,
	endTime,
}: {
	elementId: string;
	startTime: number;
	endTime: number;
}) {
	return `${elementId}:${startTime}:${endTime}`;
}

export async function resolveQuickCutTargets({
	scene,
	scope,
	selectedElements,
	mediaAssets,
}: {
	scene: TScene;
	scope: QuickCutScope;
	selectedElements: ElementRef[];
	mediaAssets: MediaAsset[];
}) {
	const targetRefs = getTargetRefs({
		scene,
		scope,
		selectedElements,
	});
	if (targetRefs.length === 0) {
		return {
			targets: [] as QuickCutTarget[],
			warnings: [] as string[],
		};
	}

	const warnings: string[] = [];
	const targetRefMap = new Map(targetRefs.map((ref) => [ref.elementId, ref]));
	const targets: Array<{ trackId: string; element: TimelineElement }> = [];

	for (const ref of targetRefs) {
		const track = findTrackById({ scene, trackId: ref.trackId });
		const element = track?.elements.find((entry) => entry.id === ref.elementId);
		if (!track || !element) {
			continue;
		}
		if (!canElementHaveAudio(element)) {
			continue;
		}
		if (element.animations) {
			warnings.push(`${element.name}: animations are not supported yet.`);
			continue;
		}

		targets.push({
			trackId: track.id,
			element,
		});
	}

	if (targets.length === 0) {
		return {
			targets: [] as QuickCutTarget[],
			warnings,
		};
	}

	const audioContext = createAudioContext();

	try {
		const collectedAudio = await collectAudioElements({
			tracks: scene.tracks,
			mediaAssets,
			audioContext,
		});
		const targetsByElementId = new Map(
			collectedAudio.map((entry) => [entry.timelineElement.id, entry]),
		);

		return {
			targets: targets.flatMap((target) => {
				const audio = targetsByElementId.get(target.element.id);
				if (!audio || !targetRefMap.has(target.element.id)) {
					return [];
				}

				return [
					{
						trackId: target.trackId,
						element: target.element,
						audio,
					},
				];
			}),
			warnings,
		};
	} finally {
		await audioContext.close().catch(() => undefined);
	}
}

export function analyzeQuickCuts({
	scope,
	targets,
	config,
}: {
	scope: QuickCutScope;
	targets: QuickCutTarget[];
	config: QuickCutConfig;
}): QuickCutAnalysis {
	const suggestions = targets.flatMap((target) =>
		analyzeTargetSilence({
			target,
			config,
		}),
	);

	return {
		scope,
		targets,
		suggestions,
		removableDuration: suggestions.reduce(
			(total, suggestion) => total + suggestion.duration,
			0,
		),
		warnings: [],
	};
}

function analyzeTargetSilence({
	target,
	config,
}: {
	target: QuickCutTarget;
	config: QuickCutConfig;
}) {
	const durationSeconds = secondsFromTicks(target.element.duration);
	if (durationSeconds <= 0) {
		return [];
	}

	const bucketCount = Math.max(
		1,
		Math.ceil(durationSeconds / config.analysisWindow),
	);
	const buckets = Array.from({ length: bucketCount }, (_, index) => {
		const clipStart = index * config.analysisWindow;
		const clipEnd = Math.min(
			durationSeconds,
			clipStart + config.analysisWindow,
		);
		const sourceStart =
			target.audio.trimStart +
			getSourceTimeAtClipTime({
				clipTime: clipStart,
				retime: target.audio.retime,
			});
		const sourceEnd =
			target.audio.trimStart +
			getSourceTimeAtClipTime({
				clipTime: clipEnd,
				retime: target.audio.retime,
			});

		return {
			bucketStart: Math.max(
				0,
				Math.floor(sourceStart * target.audio.buffer.sampleRate),
			),
			bucketEnd: Math.max(
				0,
				Math.ceil(sourceEnd * target.audio.buffer.sampleRate),
			),
			clipStart,
			clipEnd,
		};
	});

	const rmsValues = computeRmsBuckets({
		buffer: target.audio.buffer,
		buckets,
	});

	const rawIntervals: Array<{ start: number; end: number }> = [];
	let intervalStart: number | null = null;

	for (let index = 0; index < rmsValues.length; index += 1) {
		const isSilent = (rmsValues[index] ?? 0) < config.silenceThreshold;
		if (isSilent && intervalStart === null) {
			intervalStart = buckets[index]?.clipStart ?? 0;
			continue;
		}

		if (!isSilent && intervalStart !== null) {
			rawIntervals.push({
				start: intervalStart,
				end: buckets[index - 1]?.clipEnd ?? intervalStart,
			});
			intervalStart = null;
		}
	}

	if (intervalStart !== null) {
		rawIntervals.push({
			start: intervalStart,
			end: durationSeconds,
		});
	}

	return mergeIntervals(rawIntervals).flatMap((interval) => {
		const intervalDuration = interval.end - interval.start;
		if (intervalDuration < config.minSilenceDuration) {
			return [];
		}

		const padding = Math.min(config.keepPadding, intervalDuration / 2);
		const cutStart = interval.start + padding;
		const cutEnd = interval.end - padding;
		if (cutEnd - cutStart < config.minSilenceDuration / 2) {
			return [];
		}

		const localStartTime = ticksFromSeconds(cutStart);
		const localEndTime = ticksFromSeconds(cutEnd);

		return [
			{
				id: buildSuggestionId({
					elementId: target.element.id,
					startTime: localStartTime,
					endTime: localEndTime,
				}),
				trackId: target.trackId,
				elementId: target.element.id,
				elementName: target.element.name,
				localStartTime,
				localEndTime,
				timelineStartTime: target.element.startTime + localStartTime,
				timelineEndTime: target.element.startTime + localEndTime,
				duration: localEndTime - localStartTime,
			},
		];
	});
}

function buildSegmentElement({
	element,
	segmentIndex,
	segmentStart,
	segmentEnd,
	placedStartTime,
}: {
	element: TimelineElement;
	segmentIndex: number;
	segmentStart: number;
	segmentEnd: number;
	placedStartTime: number;
}) {
	const segmentDuration = segmentEnd - segmentStart;
	const nextElement = structuredClone(element);
	const segmentStartSeconds = secondsFromTicks(segmentStart);
	const segmentEndSeconds = secondsFromTicks(segmentEnd);
	const sourceStartOffset = ticksFromSeconds(
		getSourceTimeAtClipTime({
			clipTime: segmentStartSeconds,
			retime: "retime" in element ? element.retime : undefined,
		}),
	);
	const sourceEndOffset = ticksFromSeconds(
		getSourceTimeAtClipTime({
			clipTime: segmentEndSeconds,
			retime: "retime" in element ? element.retime : undefined,
		}),
	);
	const totalSourceSpan = ticksFromSeconds(
		getSourceTimeAtClipTime({
			clipTime: secondsFromTicks(element.duration),
			retime: "retime" in element ? element.retime : undefined,
		}),
	);

	nextElement.id = segmentIndex === 0 ? element.id : generateUUID();
	nextElement.startTime = placedStartTime;
	nextElement.duration = segmentDuration;
	nextElement.trimStart = element.trimStart + sourceStartOffset;
	nextElement.trimEnd =
		element.trimEnd + Math.max(0, totalSourceSpan - sourceEndOffset);

	return nextElement;
}

function applySuggestionsToTrack<
	TTrack extends TimelineTrack,
	TElement extends TTrack["elements"][number],
>({
	track,
	suggestions,
}: {
	track: TTrack;
	suggestions: QuickCutSuggestion[];
}) {
	const suggestionsByElementId = new Map<string, QuickCutSuggestion[]>();
	for (const suggestion of suggestions) {
		const nextSuggestions =
			suggestionsByElementId.get(suggestion.elementId) ?? [];
		nextSuggestions.push(suggestion);
		suggestionsByElementId.set(suggestion.elementId, nextSuggestions);
	}

	const nextElements = track.elements.flatMap((element) => {
		const elementSuggestions = suggestionsByElementId.get(element.id);
		if (!elementSuggestions || elementSuggestions.length === 0) {
			return [element];
		}

		const mergedSuggestions = mergeIntervals(
			elementSuggestions.map((suggestion) => ({
				start: suggestion.localStartTime,
				end: suggestion.localEndTime,
			})),
		);
		if (mergedSuggestions.length === 0) {
			return [element];
		}

		const keepSegments: Array<{ start: number; end: number }> = [];
		let cursor = 0;
		for (const suggestion of mergedSuggestions) {
			if (suggestion.start > cursor) {
				keepSegments.push({
					start: cursor,
					end: suggestion.start,
				});
			}
			cursor = suggestion.end;
		}
		if (cursor < element.duration) {
			keepSegments.push({
				start: cursor,
				end: element.duration,
			});
		}

		if (keepSegments.length === 0) {
			return [];
		}

		let placedStartTime = element.startTime;
		return keepSegments
			.filter((segment) => segment.end > segment.start)
			.map((segment, index) => {
				const nextElement = buildSegmentElement({
					element,
					segmentIndex: index,
					segmentStart: segment.start,
					segmentEnd: segment.end,
					placedStartTime,
				});
				placedStartTime += nextElement.duration;
				return nextElement as TElement;
			});
	}) as TElement[];

	return {
		...track,
		elements: nextElements,
	} as TTrack;
}

export function applyQuickCutSuggestions({
	tracks,
	suggestions,
}: {
	tracks: SceneTracks;
	suggestions: QuickCutSuggestion[];
}) {
	if (suggestions.length === 0) {
		return tracks;
	}

	const suggestionsByTrackId = new Map<string, QuickCutSuggestion[]>();
	for (const suggestion of suggestions) {
		const nextSuggestions = suggestionsByTrackId.get(suggestion.trackId) ?? [];
		nextSuggestions.push(suggestion);
		suggestionsByTrackId.set(suggestion.trackId, nextSuggestions);
	}

	const afterTracks: SceneTracks = {
		overlay: tracks.overlay.map((track) =>
			applySuggestionsToTrack({
				track,
				suggestions: suggestionsByTrackId.get(track.id) ?? [],
			}),
		),
		main: applySuggestionsToTrack({
			track: tracks.main,
			suggestions: suggestionsByTrackId.get(tracks.main.id) ?? [],
		}),
		audio: tracks.audio.map((track) =>
			applySuggestionsToTrack({
				track,
				suggestions: suggestionsByTrackId.get(track.id) ?? [],
			}),
		),
	};

	return applyRippleAdjustments({
		tracks: afterTracks,
		adjustments: computeRippleAdjustments({
			beforeTracks: tracks,
			afterTracks,
		}),
	});
}

function buildCoverCenteredTransform({
	element,
	mediaAsset,
	canvasSize,
}: {
	element: VideoElement | ImageElement;
	mediaAsset: MediaAsset;
	canvasSize: { width: number; height: number };
}): Transform {
	const mediaWidth = mediaAsset.width ?? canvasSize.width;
	const mediaHeight = mediaAsset.height ?? canvasSize.height;
	const containScale = Math.min(
		canvasSize.width / mediaWidth,
		canvasSize.height / mediaHeight,
	);
	const coverScale = Math.max(
		canvasSize.width / mediaWidth,
		canvasSize.height / mediaHeight,
	);
	const multiplier = coverScale / Math.max(containScale, Number.EPSILON);
	const scaleXSign = element.transform.scaleX < 0 ? -1 : 1;
	const scaleYSign = element.transform.scaleY < 0 ? -1 : 1;

	return {
		...element.transform,
		scaleX:
			scaleXSign * Math.max(Math.abs(element.transform.scaleX), multiplier),
		scaleY:
			scaleYSign * Math.max(Math.abs(element.transform.scaleY), multiplier),
		position: { x: 0, y: 0 },
	};
}

export function getAutoCenterSuggestions({
	scene,
	scope,
	selectedElements,
	mediaAssets,
	canvasSize,
}: {
	scene: TScene;
	scope: QuickCutScope;
	selectedElements: ElementRef[];
	mediaAssets: MediaAsset[];
	canvasSize: { width: number; height: number };
}) {
	const mediaById = new Map(
		mediaAssets.map((asset) => [asset.id, asset] as const),
	);
	const targetRefs = getTargetRefs({
		scene,
		scope,
		selectedElements,
	});

	return targetRefs.flatMap((ref) => {
		const track = findTrackById({ scene, trackId: ref.trackId });
		const element = track?.elements.find((entry) => entry.id === ref.elementId);
		if (!track || !element) {
			return [];
		}
		if (element.type !== "video" && element.type !== "image") {
			return [];
		}

		const mediaAsset = mediaById.get(element.mediaId);
		if (!mediaAsset) {
			return [];
		}

		const nextTransform = buildCoverCenteredTransform({
			element,
			mediaAsset,
			canvasSize,
		});
		const didRecenter =
			element.transform.position.x !== 0 || element.transform.position.y !== 0;
		const didScale =
			Math.abs(nextTransform.scaleX - element.transform.scaleX) > 0.01 ||
			Math.abs(nextTransform.scaleY - element.transform.scaleY) > 0.01;
		if (!didRecenter && !didScale) {
			return [];
		}

		return [
			{
				trackId: track.id,
				elementId: element.id,
				elementName: element.name,
				nextTransform,
				reason: didScale ? "cover-crop" : "recenter",
			} satisfies AutoCenterSuggestion,
		];
	});
}
