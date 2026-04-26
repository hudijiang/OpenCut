import type {
	SceneTracks,
	TimelineElement,
	TimelineTrack,
} from "@/lib/timeline";
import { canTrackHaveAudio } from "@/lib/timeline";

export const DUBBING_OUTPUT_ROLE = "dubbing-output";

const LEGACY_DUBBING_OUTPUT_NAME_PATTERN =
	/(^opencut-dubbed(?:-|$)|\(\s*(?:dubbed|\u914d\u97f3)\s*\)\s*$)/i;

export function isDubbingOutputElement(element: TimelineElement): boolean {
	return (
		element.role === DUBBING_OUTPUT_ROLE ||
		LEGACY_DUBBING_OUTPUT_NAME_PATTERN.test(element.name)
	);
}

export function isDubbingOutputName(name: string | undefined): boolean {
	return !!name && LEGACY_DUBBING_OUTPUT_NAME_PATTERN.test(name);
}

function muteTrackForDubbing<TTrack extends TimelineTrack>(track: TTrack): TTrack {
	if (!canTrackHaveAudio(track)) {
		return track;
	}

	if (track.muted && track.mutedByDubbing !== true) {
		return track;
	}

	return {
		...track,
		muted: true,
		mutedByDubbing: true,
	};
}

export function prepareTracksForDubbingApply({
	tracks,
}: {
	tracks: SceneTracks;
}): SceneTracks {
	return {
		...tracks,
		overlay: tracks.overlay.map((track) => muteTrackForDubbing(track)),
		main: muteTrackForDubbing(tracks.main),
		audio: tracks.audio.map((track) => muteTrackForDubbing(track)),
	};
}
