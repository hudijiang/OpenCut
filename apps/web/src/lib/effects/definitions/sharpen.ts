import type { EffectDefinition } from "@/lib/effects/types";

export const SHARPEN_SHADER = "sharpen";

export const sharpenEffectDefinition: EffectDefinition = {
	type: "sharpen",
	name: "Sharpen",
	keywords: ["sharpen", "detail", "crisp", "clarity"],
	params: [
		{
			key: "amount",
			label: "Amount",
			type: "number",
			default: 0.5,
			min: 0,
			max: 2,
			step: 0.05,
		},
	],
	renderer: {
		passes: [
			{
				shader: SHARPEN_SHADER,
				uniforms: ({ effectParams }) => ({
					u_amount:
						typeof effectParams.amount === "number"
							? effectParams.amount
							: 0.5,
				}),
			},
		],
	},
};
