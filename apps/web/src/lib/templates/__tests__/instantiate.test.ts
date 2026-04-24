import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import type { TProjectSettings } from "@/lib/project/types";
import type { Transform } from "@/lib/rendering";
import type {
	ProjectTemplate,
	SceneTemplate,
	TemplateInstantiationAsset,
} from "@/lib/templates/types";

const TEST_TICKS_PER_SECOND = 120_000;

mock.module("opencut-wasm", () => ({
	TICKS_PER_SECOND: () => TEST_TICKS_PER_SECOND,
}));

const {
	instantiateProjectTemplate,
	instantiateSceneTemplate,
	replaceTemplateSlotAssetInScenes,
} = await import("@/lib/templates/utils");

const originalCreateObjectURL = URL.createObjectURL;
let objectUrlCount = 0;

beforeAll(() => {
	URL.createObjectURL = (() => {
		objectUrlCount += 1;
		return `blob:template-test-${objectUrlCount}`;
	}) as typeof URL.createObjectURL;
});

afterAll(() => {
	URL.createObjectURL = originalCreateObjectURL;
});

function buildTransform(): Transform {
	return {
		scaleX: 1,
		scaleY: 1,
		position: { x: 0, y: 0 },
		rotate: 0,
	};
}

function buildProjectSettings(): TProjectSettings {
	return {
		fps: { numerator: 30, denominator: 1 },
		canvasSize: { width: 1080, height: 1920 },
		canvasSizeMode: "preset",
		lastCustomCanvasSize: null,
		originalCanvasSize: null,
		background: {
			type: "color",
			color: "#000000",
		},
	};
}

function buildFile({ name, type }: { name: string; type: string }) {
	return new File([`${name}-${type}`], name, {
		type,
		lastModified: Date.parse("2026-04-24T00:00:00.000Z"),
	});
}

function buildProjectTemplate(): ProjectTemplate {
	return {
		id: "test-project-template",
		name: "Talking Head Starter",
		description: "Project template for tests",
		kind: "project",
		source: "built-in",
		tags: ["social"],
		locale: "en",
		version: 1,
		cover: undefined,
		createdAt: new Date("2026-04-24T00:00:00.000Z"),
		updatedAt: new Date("2026-04-24T00:00:00.000Z"),
		assets: [],
		mediaSlots: [
			{
				id: "slot-main-video",
				label: "Main video",
				accept: ["video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-main",
						trackId: "track-main",
						elementId: "element-main-video",
					},
				],
			},
			{
				id: "slot-hero-media",
				label: "Hero media",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-main",
						trackId: "track-main",
						elementId: "element-hero-media",
					},
				],
			},
		],
		project: {
			name: "Talking Head Starter",
			currentSceneId: "scene-main",
			settings: buildProjectSettings(),
			timelineViewState: {
				zoomLevel: 1,
				scrollLeft: 0,
				playheadTime: 0,
			},
			scenes: [
				{
					id: "scene-main",
					name: "Main scene",
					isMain: true,
					bookmarks: [],
					createdAt: new Date("2026-04-24T00:00:00.000Z"),
					updatedAt: new Date("2026-04-24T00:00:00.000Z"),
					tracks: {
						overlay: [],
						main: {
							id: "track-main",
							name: "Main track",
							type: "video",
							muted: false,
							hidden: false,
							elements: [
								{
									id: "element-main-video",
									type: "video",
									name: "Main video",
									mediaId: "slot-main-video",
									duration: 6 * TEST_TICKS_PER_SECOND,
									startTime: 0,
									trimStart: 0,
									trimEnd: 0,
									sourceDuration: 6 * TEST_TICKS_PER_SECOND,
									transform: buildTransform(),
									opacity: 1,
									volume: 1,
									muted: false,
									isSourceAudioEnabled: true,
									hidden: false,
								},
								{
									id: "element-hero-media",
									type: "image",
									name: "Hero media",
									mediaId: "slot-hero-media",
									duration: 6 * TEST_TICKS_PER_SECOND,
									startTime: 0,
									trimStart: 0,
									trimEnd: 0,
									sourceDuration: 6 * TEST_TICKS_PER_SECOND,
									transform: buildTransform(),
									opacity: 1,
									hidden: false,
								},
							],
						},
						audio: [],
					},
				},
			],
		},
	};
}

function buildBeforeAfterSceneTemplate(): SceneTemplate {
	return {
		id: "test-before-after-scene-template",
		name: "Before / After",
		description: "Scene template for tests",
		kind: "scene",
		source: "built-in",
		tags: ["social"],
		locale: "en",
		version: 1,
		cover: undefined,
		createdAt: new Date("2026-04-24T00:00:00.000Z"),
		updatedAt: new Date("2026-04-24T00:00:00.000Z"),
		assets: [],
		mediaSlots: [
			{
				id: "slot-before-media",
				label: "Before media",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-before-after",
						trackId: "track-before-main",
						elementId: "element-before-media",
					},
				],
			},
			{
				id: "slot-after-media",
				label: "After media",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-before-after",
						trackId: "track-after-overlay",
						elementId: "element-after-media",
					},
				],
			},
		],
		scene: {
			scene: {
				id: "scene-before-after",
				name: "Before after scene",
				isMain: false,
				bookmarks: [],
				createdAt: new Date("2026-04-24T00:00:00.000Z"),
				updatedAt: new Date("2026-04-24T00:00:00.000Z"),
				tracks: {
					overlay: [
						{
							id: "track-after-overlay",
							name: "After",
							type: "video",
							muted: false,
							hidden: false,
							elements: [
								{
									id: "element-after-media",
									type: "image",
									name: "After media",
									mediaId: "slot-after-media",
									duration: 4 * TEST_TICKS_PER_SECOND,
									startTime: 0,
									trimStart: 0,
									trimEnd: 0,
									sourceDuration: 4 * TEST_TICKS_PER_SECOND,
									transform: {
										...buildTransform(),
										scaleX: 0.48,
									},
									opacity: 1,
									hidden: false,
								},
							],
						},
					],
					main: {
						id: "track-before-main",
						name: "Before",
						type: "video",
						muted: false,
						hidden: false,
						elements: [
							{
								id: "element-before-media",
								type: "image",
								name: "Before media",
								mediaId: "slot-before-media",
								duration: 4 * TEST_TICKS_PER_SECOND,
								startTime: 0,
								trimStart: 0,
								trimEnd: 0,
								sourceDuration: 4 * TEST_TICKS_PER_SECOND,
								transform: {
									...buildTransform(),
									scaleX: 0.48,
								},
								opacity: 1,
								hidden: false,
							},
						],
					},
					audio: [],
				},
			},
		},
	};
}

function assetIdFor(
	slotBindings: Array<{ slotId: string; assetId: string }>,
	slotId: string,
) {
	const assetId = slotBindings.find(
		(binding) => binding.slotId === slotId,
	)?.assetId;
	if (!assetId) {
		throw new Error(`Missing asset id for ${slotId}`);
	}
	return assetId;
}

function mediaAssetId(asset: TemplateInstantiationAsset | undefined) {
	if (!asset) {
		throw new Error("Expected instantiated media asset");
	}
	return asset.assetId;
}

function mediaIdOfElement(element: unknown) {
	return element && typeof element === "object" && "mediaId" in element
		? (element as { mediaId: string }).mediaId
		: undefined;
}

describe("template instantiation", () => {
	test("instantiates project templates with fresh ids and slot bindings", () => {
		const template = buildProjectTemplate();
		const originalScene = template.project.scenes[0];
		const originalVideoElement = originalScene.tracks.main.elements[0];

		const instantiated = instantiateProjectTemplate({
			template,
			resolvedSlotAssets: new Map([
				[
					"slot-main-video",
					{
						name: "creator.mp4",
						type: "video",
						file: buildFile({ name: "creator.mp4", type: "video/mp4" }),
						duration: 6,
						fps: 30,
						hasAudio: true,
					},
				],
				[
					"slot-hero-media",
					{
						name: "product-demo.mp4",
						type: "video",
						file: buildFile({
							name: "product-demo.mp4",
							type: "video/mp4",
						}),
						duration: 9,
						fps: 60,
					},
				],
			]),
		});

		const scene = instantiated.project.scenes[0];
		const videoElement = scene?.tracks.main.elements[0];
		const heroElement = scene?.tracks.main.elements[1];

		expect(scene?.id).not.toBe(originalScene.id);
		expect(videoElement?.id).not.toBe(originalVideoElement.id);
		expect(instantiated.project.currentSceneId).toBe(scene?.id);
		expect(instantiated.mediaAssets).toHaveLength(2);
		expect(instantiated.slotBindings).toHaveLength(2);
		expect(videoElement?.type).toBe("video");
		expect(videoElement?.mediaId).toBe(
			assetIdFor(instantiated.slotBindings, "slot-main-video"),
		);
		expect(heroElement?.type).toBe("video");
		expect(heroElement?.mediaId).toBe(
			assetIdFor(instantiated.slotBindings, "slot-hero-media"),
		);
	});

	test("instantiates multi-slot scene templates without crossing bindings", () => {
		const template = buildBeforeAfterSceneTemplate();

		const instantiated = instantiateSceneTemplate({
			template,
			resolvedSlotAssets: new Map([
				[
					"slot-before-media",
					{
						name: "before.jpg",
						type: "image",
						file: buildFile({ name: "before.jpg", type: "image/jpeg" }),
					},
				],
				[
					"slot-after-media",
					{
						name: "after.jpg",
						type: "image",
						file: buildFile({ name: "after.jpg", type: "image/jpeg" }),
					},
				],
			]),
		});

		const beforeElement = instantiated.scene.tracks.main.elements[0];
		const afterElement = instantiated.scene.tracks.overlay[0]?.elements[0];

		expect(instantiated.slotBindings).toHaveLength(2);
		expect(beforeElement?.mediaId).toBe(
			assetIdFor(instantiated.slotBindings, "slot-before-media"),
		);
		expect(mediaIdOfElement(afterElement)).toBe(
			assetIdFor(instantiated.slotBindings, "slot-after-media"),
		);
		expect(beforeElement?.mediaId).not.toBe(mediaIdOfElement(afterElement));
	});

	test("replaces only the targeted slot asset and updates the visual element type", () => {
		const template = buildBeforeAfterSceneTemplate();
		const instantiated = instantiateSceneTemplate({
			template,
			resolvedSlotAssets: new Map([
				[
					"slot-before-media",
					{
						name: "before.jpg",
						type: "image",
						file: buildFile({ name: "before.jpg", type: "image/jpeg" }),
					},
				],
				[
					"slot-after-media",
					{
						name: "after.jpg",
						type: "image",
						file: buildFile({ name: "after.jpg", type: "image/jpeg" }),
					},
				],
			]),
		});

		const nextScenes = replaceTemplateSlotAssetInScenes({
			scenes: [instantiated.scene],
			currentAssetId: mediaAssetId(instantiated.mediaAssets[0]),
			nextAssetId: "replaced-video-asset",
			nextMediaType: "video",
			sourceDuration: 9 * TEST_TICKS_PER_SECOND,
		});

		const nextScene = nextScenes[0];
		const beforeElement = nextScene?.tracks.main.elements[0];
		const afterElement = nextScene?.tracks.overlay[0]?.elements[0];

		expect(beforeElement?.type).toBe("video");
		expect(beforeElement?.mediaId).toBe("replaced-video-asset");
		expect(beforeElement?.sourceDuration).toBe(9 * TEST_TICKS_PER_SECOND);
		expect(afterElement?.type).toBe("image");
		expect(mediaIdOfElement(afterElement)).toBe(
			mediaAssetId(instantiated.mediaAssets[1]),
		);
	});

	test("can switch a flexible visual slot back from video to image", () => {
		const template = buildProjectTemplate();
		const instantiated = instantiateProjectTemplate({
			template,
			resolvedSlotAssets: new Map([
				[
					"slot-main-video",
					{
						name: "creator.mp4",
						type: "video",
						file: buildFile({ name: "creator.mp4", type: "video/mp4" }),
					},
				],
				[
					"slot-hero-media",
					{
						name: "hero.mp4",
						type: "video",
						file: buildFile({ name: "hero.mp4", type: "video/mp4" }),
					},
				],
			]),
		});

		const nextScenes = replaceTemplateSlotAssetInScenes({
			scenes: instantiated.project.scenes,
			currentAssetId: assetIdFor(instantiated.slotBindings, "slot-hero-media"),
			nextAssetId: "replaced-image-asset",
			nextMediaType: "image",
			sourceDuration: 3 * TEST_TICKS_PER_SECOND,
		});

		const heroElement = nextScenes[0]?.tracks.main.elements[1];
		expect(heroElement?.type).toBe("image");
		expect(heroElement?.mediaId).toBe("replaced-image-asset");
		expect(heroElement?.sourceDuration).toBe(6 * TEST_TICKS_PER_SECOND);
	});
});
