import type { ExportOptions } from "./index";

export const DEFAULT_EXPORT_OPTIONS = {
	format: "mp4",
	quality: "high",
	resolution: "source",
	includeAudio: true,
} satisfies ExportOptions;
