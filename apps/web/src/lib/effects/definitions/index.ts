import { effectsRegistry } from "../registry";
import { blurEffectDefinition } from "./blur";
import { brightnessContrastEffectDefinition } from "./brightness-contrast";
import { chromaKeyEffectDefinition } from "./chroma-key";
import { chromaticAberrationEffectDefinition } from "./chromatic-aberration";
import { colorCurvesEffectDefinition } from "./color-curves";
import { fadeTransitionEffectDefinition } from "./fade-transition";
import { filmGrainEffectDefinition } from "./film-grain";
import { pixelateEffectDefinition } from "./pixelate";
import { saturationEffectDefinition } from "./saturation";
import { sharpenEffectDefinition } from "./sharpen";
import { temperatureTintEffectDefinition } from "./temperature-tint";
import { vignetteEffectDefinition } from "./vignette";

const defaultEffects = [
	brightnessContrastEffectDefinition,
	saturationEffectDefinition,
	temperatureTintEffectDefinition,
	colorCurvesEffectDefinition,
	fadeTransitionEffectDefinition,
	pixelateEffectDefinition,
	chromaKeyEffectDefinition,
	blurEffectDefinition,
	vignetteEffectDefinition,
	filmGrainEffectDefinition,
	sharpenEffectDefinition,
	chromaticAberrationEffectDefinition,
];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (effectsRegistry.has(definition.type)) {
			continue;
		}
		effectsRegistry.register(definition.type, definition);
	}
}
