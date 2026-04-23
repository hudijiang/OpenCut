import type { EffectDefinition } from "@/lib/effects/types";

export const VIGNETTE_SHADER = "vignette";

export const vignetteEffectDefinition: EffectDefinition = {
	type: "vignette",
	name: "Vignette",
	keywords: ["vignette", "dark", "edges", "cinematic"],
	params: [
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 0.5,
			min: 0,
			max: 1,
			step: 0.01,
		},
		{
			key: "softness",
			label: "Softness",
			type: "number",
			default: 0.5,
			min: 0,
			max: 1,
			step: 0.01,
		},
	],
	renderer: {
		passes: [
			{
				shader: VIGNETTE_SHADER,
				uniforms: ({ effectParams }) => ({
					u_intensity:
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: 0.5,
					u_softness:
						typeof effectParams.softness === "number"
							? effectParams.softness
							: 0.5,
				}),
			},
		],
	},
};
