import type { KeybindingConfig } from "@/lib/actions/keybinding";
import type { TActionWithOptionalArgs } from "@/lib/actions/types";
import type { ShortcutKey } from "@/lib/actions/keybinding";

interface V7State {
	keybindings: KeybindingConfig;
	isCustomized: boolean;
}

const DEFAULT_SHORTCUTS: Array<[ShortcutKey, TActionWithOptionalArgs]> = [
	["t", "toggle-ripple-editing"],
	["a", "toggle-source-audio"],
	["f", "freeze-frame"],
	["m", "toggle-elements-muted-selected"],
	["b", "toggle-bookmark"],
];

export function v7ToV8({ state }: { state: unknown }): unknown {
	const v7 = state as V7State;
	const keybindings = { ...v7.keybindings };

	for (const [shortcut, action] of DEFAULT_SHORTCUTS) {
		if (!keybindings[shortcut]) {
			keybindings[shortcut] = action;
		}
	}

	return { ...v7, keybindings };
}
