import type { Template } from "@/lib/templates/types";

export const TEMPLATE_USAGE_STORAGE_KEY = "opencut-template-usage";
export const TEMPLATE_FAVORITES_STORAGE_KEY = "opencut-template-favorites";

export const CATEGORY_KEYS = [
	"all",
	"social",
	"business",
	"travel",
	"meme",
	"education",
	"holiday",
] as const;

export type TemplateCategory = (typeof CATEGORY_KEYS)[number];
export type TemplateSourceFilter = "all" | "built-in" | "user";
export type TemplateSort = "recommended" | "recent";
export type TemplateQualityTier = "starter" | "curated" | "flagship";

export type TemplateUsageRecord = Record<
	string,
	{
		count: number;
		lastUsedAt: string;
	}
>;

export interface TemplateDiscoveryMetadata {
	templateId: string;
	category: Exclude<TemplateCategory, "all">;
	isFavorite: boolean;
	isRecommended: boolean;
	isRecentlyUsed: boolean;
	usageCount: number;
	lastUsedAt: string | null;
	qualityScore: number;
	qualityTier: TemplateQualityTier;
	recommendationScore: number;
}

function readStoredJson<TValue>({
	key,
	fallback,
}: {
	key: string;
	fallback: TValue;
}): TValue {
	if (typeof window === "undefined") {
		return fallback;
	}

	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) {
			return fallback;
		}

		return JSON.parse(raw) as TValue;
	} catch {
		return fallback;
	}
}

function writeStoredJson({ key, value }: { key: string; value: unknown }) {
	if (typeof window === "undefined") {
		return;
	}

	window.localStorage.setItem(key, JSON.stringify(value));
}

export function readTemplateUsage() {
	return readStoredJson<TemplateUsageRecord>({
		key: TEMPLATE_USAGE_STORAGE_KEY,
		fallback: {},
	});
}

export function writeTemplateUsage(usage: TemplateUsageRecord) {
	writeStoredJson({
		key: TEMPLATE_USAGE_STORAGE_KEY,
		value: usage,
	});
}

export function readTemplateFavorites() {
	return readStoredJson<string[]>({
		key: TEMPLATE_FAVORITES_STORAGE_KEY,
		fallback: [],
	});
}

export function writeTemplateFavorites(favorites: string[]) {
	writeStoredJson({
		key: TEMPLATE_FAVORITES_STORAGE_KEY,
		value: favorites,
	});
}

export function applyTemplateUsage({
	templateId,
	usage,
	now = new Date(),
}: {
	templateId: string;
	usage: TemplateUsageRecord;
	now?: Date;
}): TemplateUsageRecord {
	return {
		...usage,
		[templateId]: {
			count: (usage[templateId]?.count ?? 0) + 1,
			lastUsedAt: now.toISOString(),
		},
	};
}

export function toggleTemplateFavorite({
	templateId,
	favorites,
}: {
	templateId: string;
	favorites: string[];
}): string[] {
	if (favorites.includes(templateId)) {
		return favorites.filter((favoriteId) => favoriteId !== templateId);
	}

	return [...favorites, templateId];
}

export function getTemplateCategory(
	template: Template,
): Exclude<TemplateCategory, "all"> {
	const tags = new Set(template.tags);

	if (tags.has("holiday") || tags.has("greeting") || tags.has("anniversary")) {
		return "holiday";
	}
	if (tags.has("meme") || tags.has("pov")) {
		return "meme";
	}
	if (tags.has("travel") || tags.has("recap") || tags.has("photos")) {
		return "travel";
	}
	if (
		tags.has("business") ||
		tags.has("promo") ||
		tags.has("product") ||
		tags.has("marketing")
	) {
		return "business";
	}
	if (tags.has("education") || tags.has("tutorial") || tags.has("news")) {
		return "education";
	}

	return "social";
}

export function matchesTemplateSearch({
	template,
	name,
	description,
	searchQuery,
}: {
	template: Template;
	name: string;
	description: string;
	searchQuery: string;
}) {
	if (!searchQuery) {
		return true;
	}

	const needle = searchQuery.toLowerCase();
	return [name, description, template.tags.join(" ")]
		.join(" ")
		.toLowerCase()
		.includes(needle);
}

export function getTemplateQualityScore(template: Template) {
	const coverSignals =
		(template.cover ? 1 : 0) + (template.assets[0]?.thumbnailUrl ? 1 : 0);
	const filledSlots = template.mediaSlots.filter(
		(slot) =>
			slot.label.trim().length > 0 &&
			slot.accept.length > 0 &&
			slot.boundElements.length > 0,
	).length;
	const defaultAssets = template.mediaSlots.filter(
		(slot) => slot.defaultAssetId || template.source === "built-in",
	).length;

	let score = 38;
	score += Math.min(coverSignals, 1) * 8;
	score += template.description.trim().length > 0 ? 12 : 0;
	score += Math.min(template.tags.length, 4) * 3;
	score += Math.min(template.mediaSlots.length, 4) * 4;
	score += Math.min(filledSlots, 4) * 5;
	score += Math.min(defaultAssets, 4) * 4;
	score += template.kind === "project" ? 6 : 2;
	score += template.source === "built-in" ? 10 : 4;

	return Math.min(100, score);
}

export function getTemplateQualityTier(score: number): TemplateQualityTier {
	if (score >= 88) {
		return "flagship";
	}
	if (score >= 72) {
		return "curated";
	}

	return "starter";
}

function getRecentUsageBoost({
	lastUsedAt,
	now,
}: {
	lastUsedAt?: string;
	now: Date;
}) {
	if (!lastUsedAt) {
		return 0;
	}

	const lastUsed = Date.parse(lastUsedAt);
	if (Number.isNaN(lastUsed)) {
		return 0;
	}

	const ageDays = Math.max(
		0,
		(now.getTime() - lastUsed) / (1000 * 60 * 60 * 24),
	);
	if (ageDays <= 1) {
		return 18;
	}
	if (ageDays <= 7) {
		return 12;
	}
	if (ageDays <= 30) {
		return 6;
	}

	return 0;
}

function getUpdatedBoost({ template, now }: { template: Template; now: Date }) {
	const ageDays = Math.max(
		0,
		(now.getTime() - template.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
	);
	if (ageDays <= 14) {
		return 5;
	}
	if (ageDays <= 60) {
		return 2;
	}

	return 0;
}

export function getTemplateRecommendationScore({
	template,
	usage,
	favorites,
	now = new Date(),
}: {
	template: Template;
	usage: TemplateUsageRecord;
	favorites: string[];
	now?: Date;
}) {
	const qualityScore = getTemplateQualityScore(template);
	const usageRecord = usage[template.id];

	return (
		qualityScore * 0.55 +
		(template.source === "built-in" ? 8 : 2) +
		(favorites.includes(template.id) ? 20 : 0) +
		Math.min(usageRecord?.count ?? 0, 5) * 4 +
		getRecentUsageBoost({
			lastUsedAt: usageRecord?.lastUsedAt,
			now,
		}) +
		getUpdatedBoost({
			template,
			now,
		})
	);
}

export function buildTemplateDiscoveryMetadata({
	template,
	usage,
	favorites,
	now = new Date(),
}: {
	template: Template;
	usage: TemplateUsageRecord;
	favorites: string[];
	now?: Date;
}): TemplateDiscoveryMetadata {
	const qualityScore = getTemplateQualityScore(template);
	const usageRecord = usage[template.id];
	const recommendationScore = getTemplateRecommendationScore({
		template,
		usage,
		favorites,
		now,
	});

	return {
		templateId: template.id,
		category: getTemplateCategory(template),
		isFavorite: favorites.includes(template.id),
		isRecommended: recommendationScore >= 64,
		isRecentlyUsed:
			typeof usageRecord?.lastUsedAt === "string" &&
			getRecentUsageBoost({
				lastUsedAt: usageRecord.lastUsedAt,
				now,
			}) > 0,
		usageCount: usageRecord?.count ?? 0,
		lastUsedAt: usageRecord?.lastUsedAt ?? null,
		qualityScore,
		qualityTier: getTemplateQualityTier(qualityScore),
		recommendationScore,
	};
}

export function rankTemplates({
	templates,
	usage,
	favorites,
	sortBy,
	now = new Date(),
}: {
	templates: Template[];
	usage: TemplateUsageRecord;
	favorites: string[];
	sortBy: TemplateSort;
	now?: Date;
}) {
	return [...templates].sort((firstTemplate, secondTemplate) => {
		if (sortBy === "recent") {
			const firstUsage = usage[firstTemplate.id];
			const secondUsage = usage[secondTemplate.id];
			const usageDelta = (secondUsage?.count ?? 0) - (firstUsage?.count ?? 0);
			if (usageDelta !== 0) {
				return usageDelta;
			}

			const secondLastUsed = secondUsage
				? Date.parse(secondUsage.lastUsedAt)
				: 0;
			const firstLastUsed = firstUsage ? Date.parse(firstUsage.lastUsedAt) : 0;
			if (secondLastUsed !== firstLastUsed) {
				return secondLastUsed - firstLastUsed;
			}
		}

		const recommendationDelta =
			getTemplateRecommendationScore({
				template: secondTemplate,
				usage,
				favorites,
				now,
			}) -
			getTemplateRecommendationScore({
				template: firstTemplate,
				usage,
				favorites,
				now,
			});
		if (recommendationDelta !== 0) {
			return recommendationDelta;
		}

		if (firstTemplate.source !== secondTemplate.source) {
			return firstTemplate.source === "built-in" ? -1 : 1;
		}

		return (
			secondTemplate.updatedAt.getTime() - firstTemplate.updatedAt.getTime()
		);
	});
}

export function getFeaturedTemplates({
	templates,
	usage,
	favorites,
	limit,
	now = new Date(),
}: {
	templates: Template[];
	usage: TemplateUsageRecord;
	favorites: string[];
	limit: number;
	now?: Date;
}) {
	return rankTemplates({
		templates,
		usage,
		favorites,
		sortBy: "recommended",
		now,
	}).slice(0, limit);
}
