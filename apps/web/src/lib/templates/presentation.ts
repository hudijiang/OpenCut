import { DEFAULT_CANVAS_SIZE } from "@/lib/canvas/sizes";
import type { TScene } from "@/lib/timeline";
import { TICKS_PER_SECOND } from "@/lib/wasm/ticks";
import type { Template } from "./types";

export type BuiltInDemoAssetEntry = {
	id: string;
	type: "video" | "image";
	name: string;
	path: string;
	thumbnailPath?: string;
	width?: number;
	height?: number;
	duration?: number;
	photographer?: string | null;
	sourceUrl?: string;
	pexelsId?: number;
};

export type BuiltInDemoManifest = {
	version: number;
	generatedAt: string;
	provider: string;
	assets: Record<string, BuiltInDemoAssetEntry>;
	slots: Record<string, string>;
};

let builtInDemoManifestPromise: Promise<BuiltInDemoManifest | null> | null =
	null;

export async function getBuiltInDemoManifest() {
	if (!builtInDemoManifestPromise) {
		builtInDemoManifestPromise = fetch("/template-assets/pexels/manifest.json")
			.then(async (response) => {
				if (!response.ok) {
					return null;
				}

				return (await response.json()) as BuiltInDemoManifest;
			})
			.catch(() => null);
	}

	return builtInDemoManifestPromise;
}

export function getTemplateDemoAssets({
	template,
	manifest,
}: {
	template: Template;
	manifest: BuiltInDemoManifest | null;
}) {
	if (!manifest || template.source !== "built-in") {
		return [];
	}

	const seen = new Set<string>();
	const assets: BuiltInDemoAssetEntry[] = [];

	for (const slot of template.mediaSlots) {
		const assetId = manifest.slots[`${template.id}:${slot.id}`];
		if (!assetId || seen.has(assetId)) {
			continue;
		}

		const asset = manifest.assets[assetId];
		if (!asset) {
			continue;
		}

		seen.add(assetId);
		assets.push(asset);
	}

	return assets;
}

export function getTemplateCoverSource({
	template,
	manifest,
}: {
	template: Template;
	manifest: BuiltInDemoManifest | null;
}) {
	if (template.cover) {
		return template.cover;
	}

	if (template.assets[0]?.thumbnailUrl) {
		return template.assets[0].thumbnailUrl;
	}

	const demoAsset = getTemplateDemoAssets({ template, manifest })[0];
	return demoAsset?.thumbnailPath ?? demoAsset?.path ?? null;
}

function getSceneDurationTicks(scene: TScene) {
	const allTracks = [
		...scene.tracks.overlay,
		scene.tracks.main,
		...scene.tracks.audio,
	];

	let maxEnd = 0;
	for (const track of allTracks) {
		for (const element of track.elements) {
			const elementEnd = element.startTime + element.duration;
			if (elementEnd > maxEnd) {
				maxEnd = elementEnd;
			}
		}
	}

	return maxEnd;
}

export function getTemplateDurationSeconds(template: Template) {
	if (template.kind === "project") {
		const totalTicks = template.project.scenes.reduce(
			(total, scene) => total + getSceneDurationTicks(scene),
			0,
		);
		return totalTicks / TICKS_PER_SECOND;
	}

	return getSceneDurationTicks(template.scene.scene) / TICKS_PER_SECOND;
}

function simplifyRatio(width: number, height: number) {
	const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
	const divisor = gcd(width, height);
	return `${width / divisor}:${height / divisor}`;
}

export function getTemplateAspectRatioLabel({
	template,
	manifest,
}: {
	template: Template;
	manifest: BuiltInDemoManifest | null;
}) {
	if (template.kind === "project") {
		const { width, height } = template.project.settings.canvasSize;
		return simplifyRatio(width, height);
	}

	const demoAsset = getTemplateDemoAssets({ template, manifest })[0];
	const width = demoAsset?.width ?? DEFAULT_CANVAS_SIZE.width;
	const height = demoAsset?.height ?? DEFAULT_CANVAS_SIZE.height;
	return simplifyRatio(width, height);
}

export function getTemplatePrimaryDemoCredit({
	template,
	manifest,
}: {
	template: Template;
	manifest: BuiltInDemoManifest | null;
}) {
	return getTemplateDemoAssets({ template, manifest })[0] ?? null;
}

export function formatTemplateDurationLabel(durationSeconds: number) {
	const rounded = Math.max(1, Math.round(durationSeconds));
	const minutes = Math.floor(rounded / 60);
	const seconds = rounded % 60;

	if (minutes === 0) {
		return `0:${seconds.toString().padStart(2, "0")}`;
	}

	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
