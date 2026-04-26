import type {
	ElementTransitions,
	TimelineElement,
	VisualElement,
} from "./types";

const TRANSITIONABLE_ELEMENT_TYPES = [
	"video",
	"image",
	"text",
	"sticker",
	"graphic",
] as const;

export function getTransitionOpacityMultiplier({
	transitions,
	localTime,
	duration,
}: {
	transitions: ElementTransitions | undefined;
	localTime: number;
	duration: number;
}): number {
	if (!transitions || duration <= 0) {
		return 1;
	}

	let multiplier = 1;
	const inDuration = transitions.in?.duration ?? 0;
	if (transitions.in?.type === "fade" && inDuration > 0) {
		multiplier = Math.min(multiplier, clamp01(localTime / inDuration));
	}

	const outDuration = transitions.out?.duration ?? 0;
	if (transitions.out?.type === "fade" && outDuration > 0) {
		multiplier = Math.min(
			multiplier,
			clamp01((duration - localTime) / outDuration),
		);
	}

	return multiplier;
}

export function isTransitionableElement(
	element: TimelineElement,
): element is VisualElement {
	return (TRANSITIONABLE_ELEMENT_TYPES as readonly string[]).includes(
		element.type,
	);
}

export function withFadeTransition({
	element,
	direction,
	duration,
}: {
	element: VisualElement;
	direction: "in" | "out" | "both";
	duration: number;
}): VisualElement {
	const clampedDuration = clampTransitionDuration({
		duration,
		elementDuration: element.duration,
		direction,
	});
	const nextTransitions: ElementTransitions = {
		...(element.transitions ?? {}),
	};
	const transition = {
		type: "fade",
		duration: clampedDuration,
	} as const;

	if (direction === "in" || direction === "both") {
		nextTransitions.in = transition;
	}
	if (direction === "out" || direction === "both") {
		nextTransitions.out = transition;
	}

	return {
		...element,
		transitions: nextTransitions,
	} as VisualElement;
}

function clampTransitionDuration({
	duration,
	elementDuration,
	direction,
}: {
	duration: number;
	elementDuration: number;
	direction: "in" | "out" | "both";
}): number {
	const maxDuration =
		direction === "both" ? elementDuration / 2 : elementDuration;
	return Math.max(1, Math.min(Math.round(duration), Math.floor(maxDuration)));
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}
