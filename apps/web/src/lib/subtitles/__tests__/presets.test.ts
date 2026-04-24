import { describe, expect, test } from "bun:test";
import { applySubtitleStylePresetToCues } from "@/lib/subtitles/presets";

describe("applySubtitleStylePresetToCues", () => {
	test("applies a preset to unstyled caption cues", () => {
		const [caption] = applySubtitleStylePresetToCues({
			captions: [{ text: "Hello world", startTime: 0, duration: 1.2 }],
			presetId: "social-classic",
		});

		expect(caption?.style?.background?.enabled).toBe(true);
		expect(caption?.style?.textAlign).toBe("center");
		expect(caption?.style?.fontWeight).toBe("bold");
	});

	test("preserves cue-level overrides while keeping preset defaults", () => {
		const [caption] = applySubtitleStylePresetToCues({
			captions: [
				{
					text: "Override me",
					startTime: 0,
					duration: 1.5,
					style: {
						color: "#FF4D4F",
						background: {
							enabled: true,
							color: "#000000",
							paddingX: 64,
						},
						placement: {
							verticalAlign: "top",
						},
					},
				},
			],
			presetId: "lower-third",
		});

		expect(caption?.style?.color).toBe("#FF4D4F");
		expect(caption?.style?.textAlign).toBe("left");
		expect(caption?.style?.background?.enabled).toBe(true);
		expect(caption?.style?.background?.paddingX).toBe(64);
		expect(caption?.style?.placement?.verticalAlign).toBe("top");
		expect(caption?.style?.placement?.marginLeftRatio).toBe(0.08);
	});
});
