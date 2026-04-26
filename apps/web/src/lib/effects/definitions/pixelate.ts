import type { EffectDefinition } from "@/lib/effects/types";

export const PIXELATE_SHADER = "pixelate";

export const pixelateEffectDefinition: EffectDefinition = {
	type: "pixelate",
	name: "Pixelate",
	keywords: ["pixelate", "pixel", "mosaic", "block", "retro"],
	params: [
		{
			key: "size",
			label: "Size",
			type: "number",
			default: 12,
			min: 1,
			max: 96,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: PIXELATE_SHADER,
				uniforms: ({ effectParams }) => ({
					u_size:
						typeof effectParams.size === "number" ? effectParams.size : 12,
				}),
			},
		],
	},
};
