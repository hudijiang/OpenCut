export interface CaptionSegmentationPreset {
	id: CaptionSegmentationPresetId;
	maxTokensPerCaption: number;
	minDuration: number;
	splitOnPunctuation: boolean;
}

export type CaptionSegmentationPresetId = "snappy" | "balanced" | "relaxed";

export const CAPTION_SEGMENTATION_PRESETS: CaptionSegmentationPreset[] = [
	{
		id: "snappy",
		maxTokensPerCaption: 3,
		minDuration: 0.55,
		splitOnPunctuation: true,
	},
	{
		id: "balanced",
		maxTokensPerCaption: 5,
		minDuration: 0.8,
		splitOnPunctuation: true,
	},
	{
		id: "relaxed",
		maxTokensPerCaption: 7,
		minDuration: 1,
		splitOnPunctuation: true,
	},
];

export const DEFAULT_CAPTION_SEGMENTATION_PRESET: CaptionSegmentationPresetId =
	"balanced";

export function getCaptionSegmentationPreset({
	id,
}: {
	id: CaptionSegmentationPresetId;
}): CaptionSegmentationPreset {
	return (
		CAPTION_SEGMENTATION_PRESETS.find((preset) => preset.id === id) ??
		CAPTION_SEGMENTATION_PRESETS[0]
	);
}
