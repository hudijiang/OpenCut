import type { EffectDefinition } from "@/lib/effects/types";

export const SATURATION_SHADER = "saturation";

export const saturationEffectDefinition: EffectDefinition = {
	type: "saturation",
	name: "Saturation & Hue",
	keywords: ["saturation", "vibrance", "hue", "color"],
	params: [
		{
			key: "saturation",
			label: "Saturation",
			type: "number",
			default: 1,
			min: 0,
			max: 3,
			step: 0.01,
		},
		{
			key: "hue",
			label: "Hue",
			type: "number",
			default: 0,
			min: -180,
			max: 180,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: SATURATION_SHADER,
				uniforms: ({ effectParams }) => ({
					u_saturation:
						typeof effectParams.saturation === "number"
							? effectParams.saturation
							: 1,
					u_hue:
						((typeof effectParams.hue === "number" ? effectParams.hue : 0) *
							Math.PI) /
						180,
				}),
			},
		],
	},
};
