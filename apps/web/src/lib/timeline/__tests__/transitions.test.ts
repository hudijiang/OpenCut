import { describe, expect, test } from "bun:test";
import {
	getTransitionOpacityMultiplier,
	withFadeTransition,
} from "@/lib/timeline/transitions";
import type { VideoElement } from "@/lib/timeline/types";

function videoElement(overrides: Partial<VideoElement> = {}): VideoElement {
	return {
		id: "clip-1",
		type: "video",
		mediaId: "media-1",
		name: "Clip",
		duration: 1000,
		startTime: 0,
		trimStart: 0,
		trimEnd: 0,
		sourceDuration: 1000,
		transform: {
			position: { x: 0, y: 0 },
			scaleX: 1,
			scaleY: 1,
			rotate: 0,
		},
		opacity: 1,
		...overrides,
	};
}

describe("timeline transitions", () => {
	test("resolves fade in and fade out opacity multipliers", () => {
		const transitions = {
			in: { type: "fade" as const, duration: 200 },
			out: { type: "fade" as const, duration: 250 },
		};

		expect(
			getTransitionOpacityMultiplier({
				transitions,
				localTime: 100,
				duration: 1000,
			}),
		).toBe(0.5);
		expect(
			getTransitionOpacityMultiplier({
				transitions,
				localTime: 500,
				duration: 1000,
			}),
		).toBe(1);
		expect(
			getTransitionOpacityMultiplier({
				transitions,
				localTime: 875,
				duration: 1000,
			}),
		).toBe(0.5);
	});

	test("clamps two-sided fade duration to half the element duration", () => {
		const element = withFadeTransition({
			element: videoElement({ duration: 1000 }),
			direction: "both",
			duration: 800,
		});

		expect(element.transitions?.in?.duration).toBe(500);
		expect(element.transitions?.out?.duration).toBe(500);
	});
});
