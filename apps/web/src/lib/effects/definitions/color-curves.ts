import type { EffectDefinition } from "@/lib/effects/types";

export const COLOR_CURVES_SHADER = "color-curves";

export const colorCurvesEffectDefinition: EffectDefinition = {
	type: "color-curves",
	name: "Color Curves",
	keywords: ["curves", "lut", "grade", "lift", "gamma", "gain", "color"],
	params: [
		{
			key: "lift",
			label: "Lift",
			type: "number",
			default: 0,
			min: -0.5,
			max: 0.5,
			step: 0.01,
		},
		{
			key: "gamma",
			label: "Gamma",
			type: "number",
			default: 1,
			min: 0.1,
			max: 3,
			step: 0.01,
		},
		{
			key: "gain",
			label: "Gain",
			type: "number",
			default: 1,
			min: 0,
			max: 3,
			step: 0.01,
		},
		{
			key: "amount",
			label: "Amount",
			type: "number",
			default: 1,
			min: 0,
			max: 1,
			step: 0.01,
		},
	],
	renderer: {
		passes: [
			{
				shader: COLOR_CURVES_SHADER,
				uniforms: ({ effectParams }) => ({
					u_lift: typeof effectParams.lift === "number" ? effectParams.lift : 0,
					u_gamma:
						typeof effectParams.gamma === "number" ? effectParams.gamma : 1,
					u_gain: typeof effectParams.gain === "number" ? effectParams.gain : 1,
					u_amount:
						typeof effectParams.amount === "number" ? effectParams.amount : 1,
				}),
			},
		],
	},
};
