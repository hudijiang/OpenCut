import { effectsRegistry } from "../registry";
import { blurEffectDefinition } from "./blur";
import { chromaticAberrationEffectDefinition } from "./chromatic-aberration";
import { filmGrainEffectDefinition } from "./film-grain";
import { sharpenEffectDefinition } from "./sharpen";
import { vignetteEffectDefinition } from "./vignette";

const defaultEffects = [
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
