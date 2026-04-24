import type { SubtitleCue, SubtitleStyleOverrides } from "./types";

export interface SubtitleStylePreset {
	id: SubtitleStylePresetId;
	style: SubtitleStyleOverrides;
}

export type SubtitleStylePresetId =
	| "social-classic"
	| "punchy-highlight"
	| "lower-third";

export const SUBTITLE_STYLE_PRESETS: SubtitleStylePreset[] = [
	{
		id: "social-classic",
		style: {
			fontSizeRatioOfPlayHeight: 0.048,
			color: "#FFFFFF",
			fontWeight: "bold",
			textAlign: "center",
			lineHeight: 1.08,
			background: {
				enabled: true,
				color: "rgba(0, 0, 0, 0.82)",
				cornerRadius: 26,
				paddingX: 28,
				paddingY: 18,
			},
			placement: {
				verticalAlign: "bottom",
				marginLeftRatio: 0.08,
				marginRightRatio: 0.08,
				marginVerticalRatio: 0.06,
			},
		},
	},
	{
		id: "punchy-highlight",
		style: {
			fontSizeRatioOfPlayHeight: 0.052,
			color: "#FFE066",
			fontWeight: "bold",
			textAlign: "center",
			lineHeight: 1.05,
			letterSpacing: 0.2,
			background: {
				enabled: true,
				color: "rgba(12, 18, 32, 0.92)",
				cornerRadius: 34,
				paddingX: 34,
				paddingY: 20,
			},
			placement: {
				verticalAlign: "bottom",
				marginLeftRatio: 0.06,
				marginRightRatio: 0.06,
				marginVerticalRatio: 0.055,
			},
		},
	},
	{
		id: "lower-third",
		style: {
			fontSizeRatioOfPlayHeight: 0.044,
			color: "#F8FAFC",
			fontWeight: "bold",
			textAlign: "left",
			lineHeight: 1.12,
			background: {
				enabled: true,
				color: "rgba(15, 23, 42, 0.88)",
				cornerRadius: 22,
				paddingX: 24,
				paddingY: 16,
			},
			placement: {
				verticalAlign: "bottom",
				marginLeftRatio: 0.08,
				marginRightRatio: 0.3,
				marginVerticalRatio: 0.075,
			},
		},
	},
];

export const DEFAULT_SUBTITLE_STYLE_PRESET: SubtitleStylePresetId =
	"social-classic";

export function getSubtitleStylePreset({
	id,
}: {
	id: SubtitleStylePresetId;
}): SubtitleStylePreset {
	return (
		SUBTITLE_STYLE_PRESETS.find((preset) => preset.id === id) ??
		SUBTITLE_STYLE_PRESETS[0]
	);
}

export function mergeSubtitleStyles({
	base,
	override,
}: {
	base: SubtitleStyleOverrides;
	override?: SubtitleStyleOverrides;
}): SubtitleStyleOverrides {
	if (!override) {
		return {
			...base,
			background: base.background ? { ...base.background } : undefined,
			placement: base.placement ? { ...base.placement } : undefined,
		};
	}

	return {
		...base,
		...override,
		background: mergeSubtitleBackground({
			base: base.background,
			override: override.background,
		}),
		placement:
			base.placement || override.placement
				? {
						...(base.placement ?? {}),
						...(override.placement ?? {}),
					}
				: undefined,
	};
}

function mergeSubtitleBackground({
	base,
	override,
}: {
	base: SubtitleStyleOverrides["background"];
	override: SubtitleStyleOverrides["background"];
}): SubtitleStyleOverrides["background"] {
	if (!base && !override) {
		return undefined;
	}

	return {
		enabled: override?.enabled ?? base?.enabled ?? false,
		color: override?.color ?? base?.color ?? "#000000",
		cornerRadius: override?.cornerRadius ?? base?.cornerRadius,
		paddingX: override?.paddingX ?? base?.paddingX,
		paddingY: override?.paddingY ?? base?.paddingY,
		offsetX: override?.offsetX ?? base?.offsetX,
		offsetY: override?.offsetY ?? base?.offsetY,
	};
}

export function applySubtitleStylePresetToCues({
	captions,
	presetId,
}: {
	captions: SubtitleCue[];
	presetId: SubtitleStylePresetId;
}): SubtitleCue[] {
	const preset = getSubtitleStylePreset({ id: presetId });

	return captions.map((caption) => ({
		...caption,
		style: mergeSubtitleStyles({
			base: preset.style,
			override: caption.style,
		}),
	}));
}
