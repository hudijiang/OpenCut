import type { EffectDefinition } from "@/lib/effects/types";

export const CHROMATIC_ABERRATION_SHADER = "chromatic-aberration";

export const chromaticAberrationEffectDefinition: EffectDefinition = {
	type: "chromatic-aberration",
	name: "Chromatic Aberration",
	keywords: ["chromatic", "aberration", "rgb", "fringe", "lens", "distortion"],
	params: [
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 3,
			min: 0,
			max: 20,
			step: 0.5,
		},
	],
	renderer: {
		passes: [
			{
				shader: CHROMATIC_ABERRATION_SHADER,
				uniforms: ({ effectParams }) => ({
					u_intensity:
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: 3,
				}),
			},
		],
	},
};
