import type { EffectDefinition } from "@/lib/effects/types";

export const FILM_GRAIN_SHADER = "film-grain";

export const filmGrainEffectDefinition: EffectDefinition = {
	type: "film-grain",
	name: "Film Grain",
	keywords: ["grain", "noise", "film", "analog", "texture"],
	params: [
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 0.15,
			min: 0,
			max: 1,
			step: 0.01,
		},
	],
	renderer: {
		passes: [
			{
				shader: FILM_GRAIN_SHADER,
				uniforms: ({ effectParams, localTime }) => ({
					u_intensity:
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: 0.15,
					// Change every frame (~24fps) so grain animates
					u_seed: Math.floor((localTime ?? 0) * 24),
				}),
			},
		],
	},
};
