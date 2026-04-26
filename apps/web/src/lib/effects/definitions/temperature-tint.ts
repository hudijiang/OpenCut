import type { EffectDefinition } from "@/lib/effects/types";

export const TEMPERATURE_TINT_SHADER = "temperature-tint";

export const temperatureTintEffectDefinition: EffectDefinition = {
	type: "temperature-tint",
	name: "Temperature & Tint",
	keywords: ["temperature", "tint", "warm", "cool", "white balance", "color"],
	params: [
		{
			key: "temperature",
			label: "Temperature",
			type: "number",
			default: 0,
			min: -1,
			max: 1,
			step: 0.01,
		},
		{
			key: "tint",
			label: "Tint",
			type: "number",
			default: 0,
			min: -1,
			max: 1,
			step: 0.01,
		},
	],
	renderer: {
		passes: [
			{
				shader: TEMPERATURE_TINT_SHADER,
				uniforms: ({ effectParams }) => ({
					u_temperature:
						typeof effectParams.temperature === "number"
							? effectParams.temperature
							: 0,
					u_tint: typeof effectParams.tint === "number" ? effectParams.tint : 0,
				}),
			},
		],
	},
};
