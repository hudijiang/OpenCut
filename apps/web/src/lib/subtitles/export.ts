import { TICKS_PER_SECOND } from "@/lib/wasm";
import type { SceneTracks, TextElement } from "@/lib/timeline";
import type { SubtitleCue } from "@/lib/subtitles/types";

export type SubtitleExportFormat = "srt" | "vtt";

export function collectSubtitleCuesFromTracks({
	tracks,
}: {
	tracks: SceneTracks;
}): SubtitleCue[] {
	return tracks.overlay
		.flatMap((track) => {
			if (track.type !== "text" || track.hidden) return [];
			return track.elements.filter(isExportableTextElement);
		})
		.map((element) => ({
			text: normalizeSubtitleText({ text: element.content }),
			startTime: element.startTime / TICKS_PER_SECOND,
			duration: element.duration / TICKS_PER_SECOND,
		}))
		.filter((cue) => cue.text.length > 0 && cue.duration > 0)
		.sort((a, b) => a.startTime - b.startTime || a.duration - b.duration);
}

export function serializeSrt({
	captions,
}: {
	captions: SubtitleCue[];
}): string {
	if (captions.length === 0) return "";

	return `${captions
		.map((caption, index) => {
			const start = formatSubtitleTimestamp({
				seconds: caption.startTime,
				millisecondSeparator: ",",
			});
			const end = formatSubtitleTimestamp({
				seconds: caption.startTime + caption.duration,
				millisecondSeparator: ",",
			});
			return `${index + 1}\n${start} --> ${end}\n${normalizeSubtitleText({
				text: caption.text,
			})}`;
		})
		.join("\n\n")}\n`;
}

export function serializeVtt({
	captions,
}: {
	captions: SubtitleCue[];
}): string {
	if (captions.length === 0) return "WEBVTT\n";

	return `WEBVTT\n\n${captions
		.map((caption) => {
			const start = formatSubtitleTimestamp({
				seconds: caption.startTime,
				millisecondSeparator: ".",
			});
			const end = formatSubtitleTimestamp({
				seconds: caption.startTime + caption.duration,
				millisecondSeparator: ".",
			});
			return `${start} --> ${end}\n${normalizeSubtitleText({
				text: caption.text,
			})}`;
		})
		.join("\n\n")}\n`;
}

function isExportableTextElement(
	element: TextElement,
): element is TextElement {
	return !element.hidden && normalizeSubtitleText({ text: element.content }).length > 0;
}

function normalizeSubtitleText({ text }: { text: string }): string {
	return text.replace(/\r\n?/g, "\n").trim();
}

function formatSubtitleTimestamp({
	seconds,
	millisecondSeparator,
}: {
	seconds: number;
	millisecondSeparator: "," | ".";
}): string {
	const totalMilliseconds = Math.round(Math.max(0, seconds) * 1000);
	const hours = Math.floor(totalMilliseconds / 3_600_000);
	const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
	const wholeSeconds = Math.floor((totalMilliseconds % 60_000) / 1000);
	const milliseconds = totalMilliseconds % 1000;

	return `${padTimePart({ value: hours })}:${padTimePart({
		value: minutes,
	})}:${padTimePart({ value: wholeSeconds })}${millisecondSeparator}${milliseconds
		.toString()
		.padStart(3, "0")}`;
}

function padTimePart({ value }: { value: number }): string {
	return value.toString().padStart(2, "0");
}
