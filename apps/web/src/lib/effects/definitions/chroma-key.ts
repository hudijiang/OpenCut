import type { EffectDefinition } from "@/lib/effects/types";

export const CHROMA_KEY_SHADER = "chroma-key";

function hexToRgb01(color: unknown): [number, number, number] {
	if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) {
		return [0, 1, 0];
	}
	const value = color.slice(1);
	return [
		Number.parseInt(value.slice(0, 2), 16) / 255,
		Number.parseInt(value.slice(2, 4), 16) / 255,
		Number.parseInt(value.slice(4, 6), 16) / 255,
	];
}

export const chromaKeyEffectDefinition: EffectDefinition = {
	type: "chroma-key",
	name: "Chroma Key",
	keywords: ["chroma", "key", "green screen", "greenscreen", "remove"],
	params: [
		{
			key: "keyColor",
			label: "Key Color",
			type: "color",
			default: "#00ff00",
		},
		{
			key: "threshold",
			label: "Threshold",
			type: "number",
			default: 0.25,
			min: 0,
			max: 1,
			step: 0.01,
		},
		{
			key: "softness",
			label: "Softness",
			type: "number",
			default: 0.1,
			min: 0,
			max: 1,
			step: 0.01,
		},
		{
			key: "spill",
			label: "Spill",
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
				shader: CHROMA_KEY_SHADER,
				uniforms: ({ effectParams }) => ({
					u_key_color: hexToRgb01(effectParams.keyColor),
					u_threshold:
						typeof effectParams.threshold === "number"
							? effectParams.threshold
							: 0.25,
					u_softness:
						typeof effectParams.softness === "number"
							? effectParams.softness
							: 0.1,
					u_spill:
						typeof effectParams.spill === "number" ? effectParams.spill : 0.5,
				}),
			},
		],
	},
};
