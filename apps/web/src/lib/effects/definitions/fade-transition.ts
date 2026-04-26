import type { EffectDefinition } from "@/lib/effects/types";
import { TICKS_PER_SECOND } from "@/lib/wasm";

export const FADE_TRANSITION_SHADER = "fade-transition";

function readNumber(value: unknown, fallback: number): number {
	return typeof value === "number" ? value : fallback;
}

export const fadeTransitionEffectDefinition: EffectDefinition = {
	type: "fade-transition",
	name: "Fade Transition",
	keywords: ["transition", "fade", "crossfade", "dissolve"],
	params: [
		{
			key: "fadeIn",
			label: "Fade In",
			type: "number",
			default: 0.5,
			min: 0,
			max: 5,
			step: 0.05,
		},
		{
			key: "fadeOut",
			label: "Fade Out",
			type: "number",
			default: 0.5,
			min: 0,
			max: 5,
			step: 0.05,
		},
	],
	renderer: {
		passes: [
			{
				shader: FADE_TRANSITION_SHADER,
				uniforms: ({ effectParams, localTime, duration }) => {
					const fadeIn =
						readNumber(effectParams.fadeIn, 0.5) * TICKS_PER_SECOND;
					const fadeOut =
						readNumber(effectParams.fadeOut, 0.5) * TICKS_PER_SECOND;
					const inOpacity = fadeIn > 0 ? Math.min(1, localTime / fadeIn) : 1;
					const outTime = Math.max(0, duration - localTime);
					const outOpacity = fadeOut > 0 ? Math.min(1, outTime / fadeOut) : 1;

					return {
						u_opacity: Math.max(0, Math.min(1, inOpacity, outOpacity)),
					};
				},
			},
		],
	},
};
