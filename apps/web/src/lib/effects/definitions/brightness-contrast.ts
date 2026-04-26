import type { EffectDefinition } from "@/lib/effects/types";

export const BRIGHTNESS_CONTRAST_SHADER = "brightness-contrast";

export const brightnessContrastEffectDefinition: EffectDefinition = {
	type: "brightness-contrast",
	name: "Brightness & Contrast",
	keywords: ["brightness", "contrast", "exposure", "light", "color"],
	params: [
		{
			key: "brightness",
			label: "Brightness",
			type: "number",
			default: 0,
			min: -1,
			max: 1,
			step: 0.01,
		},
		{
			key: "contrast",
			label: "Contrast",
			type: "number",
			default: 1,
			min: 0,
			max: 3,
			step: 0.01,
		},
	],
	renderer: {
		passes: [
			{
				shader: BRIGHTNESS_CONTRAST_SHADER,
				uniforms: ({ effectParams }) => ({
					u_brightness:
						typeof effectParams.brightness === "number"
							? effectParams.brightness
							: 0,
					u_contrast:
						typeof effectParams.contrast === "number"
							? effectParams.contrast
							: 1,
				}),
			},
		],
	},
};
