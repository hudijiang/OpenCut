import { describe, expect, test } from "bun:test";
import type { TProjectSettings } from "@/lib/project/types";
import type { Transform } from "@/lib/rendering";
import type { ProjectTemplate } from "@/lib/templates/types";
import {
	applyTemplateUsage,
	buildTemplateDiscoveryMetadata,
	getFeaturedTemplates,
	getTemplateQualityScore,
	getTemplateQualityTier,
	rankTemplates,
	toggleTemplateFavorite,
	type TemplateUsageRecord,
} from "@/lib/templates/discovery";

const TEST_TICKS_PER_SECOND = 120_000;

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

function buildTemplate({
	id,
	name,
	source = "built-in",
	description = "Starter template for creator workflows",
	tags = ["social", "tutorial"],
	updatedAt = "2026-04-20T00:00:00.000Z",
}: {
	id: string;
	name: string;
	source?: ProjectTemplate["source"];
	description?: string;
	tags?: string[];
	updatedAt?: string;
}): ProjectTemplate {
	return {
		id,
		name,
		description,
		kind: "project",
		source,
		tags,
		locale: "en",
		version: 1,
		cover: "/cover.png",
		createdAt: new Date("2026-04-01T00:00:00.000Z"),
		updatedAt: new Date(updatedAt),
		assets: [
			{
				id: `${id}-asset`,
				slotId: `${id}-slot`,
				name: `${name} Asset`,
				type: "video",
				size: 1024,
				lastModified: Date.parse("2026-04-01T00:00:00.000Z"),
				duration: 6,
				thumbnailUrl: "/thumb.png",
			},
		],
		mediaSlots: [
			{
				id: `${id}-slot`,
				label: "Main media",
				accept: ["video"],
				required: true,
				defaultAssetId: `${id}-asset`,
				boundElements: [
					{
						sceneId: `${id}-scene`,
						trackId: `${id}-track`,
						elementId: `${id}-element`,
					},
				],
			},
		],
		project: {
			name,
			currentSceneId: `${id}-scene`,
			settings: buildProjectSettings(),
			timelineViewState: {
				zoomLevel: 1,
				scrollLeft: 0,
				playheadTime: 0,
			},
			scenes: [
				{
					id: `${id}-scene`,
					name: "Scene",
					isMain: true,
					bookmarks: [],
					createdAt: new Date("2026-04-01T00:00:00.000Z"),
					updatedAt: new Date("2026-04-01T00:00:00.000Z"),
					tracks: {
						overlay: [],
						main: {
							id: `${id}-track`,
							name: "Main track",
							type: "video",
							muted: false,
							hidden: false,
							elements: [
								{
									id: `${id}-element`,
									type: "video",
									name: "Main video",
									mediaId: `${id}-slot`,
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
							],
						},
						audio: [],
					},
				},
			],
		},
	};
}

describe("template discovery", () => {
	test("quality scoring rewards complete templates", () => {
		const completeTemplate = buildTemplate({
			id: "complete",
			name: "Complete",
		});
		const sparseTemplate = buildTemplate({
			id: "sparse",
			name: "Sparse",
			source: "user",
			description: "",
			tags: [],
		});
		sparseTemplate.cover = undefined;
		sparseTemplate.assets = [];
		sparseTemplate.mediaSlots[0] = {
			...sparseTemplate.mediaSlots[0],
			defaultAssetId: undefined,
			boundElements: [],
		};

		expect(getTemplateQualityScore(completeTemplate)).toBeGreaterThan(
			getTemplateQualityScore(sparseTemplate),
		);
		expect(getTemplateQualityTier(92)).toBe("flagship");
		expect(getTemplateQualityTier(75)).toBe("curated");
		expect(getTemplateQualityTier(60)).toBe("starter");
	});

	test("favorites and recent usage lift recommendation ranking", () => {
		const templates = [
			buildTemplate({
				id: "builtin-template",
				name: "Built-in Template",
				updatedAt: "2026-04-20T00:00:00.000Z",
			}),
			buildTemplate({
				id: "favorite-template",
				name: "Favorite Template",
				source: "user",
				updatedAt: "2026-04-18T00:00:00.000Z",
			}),
			buildTemplate({
				id: "old-template",
				name: "Old Template",
				source: "user",
				updatedAt: "2026-01-10T00:00:00.000Z",
			}),
		];
		const usage: TemplateUsageRecord = {
			"favorite-template": {
				count: 3,
				lastUsedAt: "2026-04-24T00:00:00.000Z",
			},
			"old-template": {
				count: 1,
				lastUsedAt: "2026-02-01T00:00:00.000Z",
			},
		};
		const favorites = ["favorite-template"];

		const ranked = rankTemplates({
			templates,
			usage,
			favorites,
			sortBy: "recommended",
			now: new Date("2026-04-24T12:00:00.000Z"),
		});

		expect(ranked[0]?.id).toBe("favorite-template");
		expect(
			getFeaturedTemplates({
				templates,
				usage,
				favorites,
				limit: 2,
				now: new Date("2026-04-24T12:00:00.000Z"),
			}).map((template) => template.id),
		).toEqual(["favorite-template", "builtin-template"]);
	});

	test("metadata reflects favorites and recent usage", () => {
		const template = buildTemplate({
			id: "talking-head",
			name: "Talking Head",
		});
		const usage = applyTemplateUsage({
			templateId: template.id,
			usage: {},
			now: new Date("2026-04-24T12:00:00.000Z"),
		});
		const favorites = toggleTemplateFavorite({
			templateId: template.id,
			favorites: [],
		});

		const metadata = buildTemplateDiscoveryMetadata({
			template,
			usage,
			favorites,
			now: new Date("2026-04-24T18:00:00.000Z"),
		});

		expect(metadata.isFavorite).toBe(true);
		expect(metadata.isRecentlyUsed).toBe(true);
		expect(metadata.usageCount).toBe(1);
		expect(metadata.isRecommended).toBe(true);
	});
});
