"use client";

import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import { OPFSAdapter } from "@/services/storage/opfs-adapter";
import { processMediaAssets } from "@/lib/media/processing";
import type { MediaAsset } from "@/lib/media/types";
import type { TProject } from "@/lib/project/types";
import type { TScene } from "@/lib/timeline";
import { BUILT_IN_TEMPLATES } from "@/lib/templates/built-in";
import { getBuiltInDemoManifest } from "@/lib/templates/presentation";
import {
	instantiateProjectTemplateCore,
	instantiateSceneTemplateCore,
	normalizeSerializedTemplateCore,
} from "@/lib/templates/core";
import {
	buildProjectTemplate,
	buildSceneTemplate,
	bundleTemplateExport,
	dataUrlToFile,
	deserializeTemplate,
	projectTemplateFromExportBundle,
	serializeTemplate,
} from "@/lib/templates/utils";
import type {
	CreateTemplateOptions,
	InstantiatedProjectTemplate,
	InstantiatedSceneTemplate,
	SerializedTemplate,
	Template,
	TemplateMediaSlot,
	TemplateExportBundle,
} from "@/lib/templates/types";
import { generateUUID } from "@/utils/id";

function canAutoFillBuiltInSlot({
	template,
	slot,
}: {
	template: Template;
	slot: TemplateMediaSlot;
}) {
	return (
		template.source === "built-in" &&
		slot.accept.some((type) => type === "video" || type === "image")
	);
}

function escapeXml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

function getBuiltInDemoTheme(templateId: string) {
	const portraitArt = `
<circle cx="540" cy="720" r="210" fill="rgba(255,255,255,0.1)"/>
<circle cx="540" cy="700" r="96" fill="#F6C7A8"/>
<rect x="392" y="812" width="296" height="388" rx="148" fill="#0F172A"/>
<rect x="302" y="1240" width="476" height="208" rx="44" fill="rgba(15,23,42,0.88)"/>
<rect x="350" y="1296" width="380" height="26" rx="13" fill="rgba(255,255,255,0.84)"/>
<rect x="350" y="1348" width="236" height="22" rx="11" fill="rgba(255,255,255,0.48)"/>
`;

	const productArt = `
<rect x="308" y="382" width="464" height="1010" rx="60" fill="#F8FAFC"/>
<rect x="344" y="470" width="392" height="664" rx="36" fill="url(#panel)"/>
<rect x="392" y="1196" width="296" height="74" rx="24" fill="#0F172A"/>
<circle cx="430" cy="802" r="86" fill="rgba(255,255,255,0.18)"/>
<rect x="466" y="734" width="204" height="136" rx="26" fill="rgba(255,255,255,0.92)"/>
<rect x="436" y="1332" width="208" height="20" rx="10" fill="rgba(15,23,42,0.18)"/>
`;

	const travelArt = `
<path d="M178 1264L366 954L560 1224L720 1018L908 1264V1452H178Z" fill="rgba(12,74,110,0.86)"/>
<path d="M212 1288L372 1048L540 1256L720 1120L872 1288V1452H212Z" fill="rgba(14,116,144,0.92)"/>
<circle cx="770" cy="580" r="98" fill="rgba(253,224,71,0.95)"/>
<rect x="180" y="384" width="308" height="438" rx="32" fill="rgba(255,255,255,0.9)" transform="rotate(-8 334 603)"/>
<rect x="586" y="432" width="314" height="468" rx="32" fill="rgba(255,255,255,0.8)" transform="rotate(7 743 666)"/>
`;

	const editorialArt = `
<rect x="176" y="352" width="728" height="1108" rx="42" fill="rgba(255,255,255,0.92)"/>
<rect x="234" y="440" width="612" height="344" rx="28" fill="url(#panel)"/>
<rect x="234" y="848" width="420" height="30" rx="15" fill="rgba(15,23,42,0.82)"/>
<rect x="234" y="912" width="542" height="24" rx="12" fill="rgba(15,23,42,0.4)"/>
<rect x="234" y="968" width="494" height="24" rx="12" fill="rgba(15,23,42,0.22)"/>
<rect x="234" y="1096" width="242" height="84" rx="24" fill="#0F172A"/>
<rect x="512" y="1096" width="176" height="84" rx="24" fill="rgba(15,23,42,0.12)"/>
`;

	const festiveArt = `
<circle cx="324" cy="520" r="112" fill="rgba(255,255,255,0.18)"/>
<circle cx="770" cy="600" r="82" fill="rgba(255,255,255,0.14)"/>
<rect x="248" y="760" width="584" height="472" rx="54" fill="rgba(255,255,255,0.9)"/>
<rect x="512" y="760" width="56" height="472" fill="rgba(239,68,68,0.84)"/>
<rect x="248" y="964" width="584" height="56" fill="rgba(239,68,68,0.84)"/>
<circle cx="540" cy="760" r="92" fill="#FDE68A"/>
<path d="M540 688L570 748L636 758L588 804L598 870L540 840L482 870L492 804L444 758L510 748Z" fill="#DC2626"/>
`;

	const fitnessArt = `
<circle cx="540" cy="760" r="228" fill="rgba(255,255,255,0.1)"/>
<path d="M540 560A200 200 0 1 1 398 619" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="44" stroke-linecap="round"/>
<path d="M540 560A200 200 0 0 1 726 686" fill="none" stroke="#22C55E" stroke-width="44" stroke-linecap="round"/>
<rect x="278" y="1180" width="524" height="44" rx="22" fill="#0F172A"/>
<rect x="344" y="1120" width="40" height="164" rx="18" fill="#0F172A"/>
<rect x="696" y="1120" width="40" height="164" rx="18" fill="#0F172A"/>
<rect x="444" y="1294" width="192" height="22" rx="11" fill="rgba(255,255,255,0.6)"/>
`;

	const splitArt = `
<rect x="164" y="354" width="346" height="1204" rx="34" fill="rgba(255,255,255,0.82)"/>
<rect x="570" y="354" width="346" height="1204" rx="34" fill="rgba(255,255,255,0.95)"/>
<rect x="510" y="354" width="60" height="1204" rx="24" fill="rgba(15,23,42,0.9)"/>
<rect x="222" y="432" width="230" height="300" rx="24" fill="rgba(15,23,42,0.24)"/>
<rect x="628" y="432" width="230" height="300" rx="24" fill="url(#panel)"/>
<rect x="230" y="1368" width="214" height="68" rx="20" fill="rgba(15,23,42,0.84)"/>
<rect x="636" y="1368" width="214" height="68" rx="20" fill="#0F172A"/>
`;

	const themes: Record<
		string,
		{
			background: [string, string];
			panel: [string, string];
			eyebrow: string;
			headline: string;
			subhead: string;
			art: string;
		}
	> = {
		"builtin-project-talking-head": {
			background: ["#111827", "#2563EB"],
			panel: ["#60A5FA", "#1D4ED8"],
			eyebrow: "SOCIAL CLIP",
			headline: "Talking Head",
			subhead: "Fast starter layout",
			art: portraitArt,
		},
		"builtin-project-podcast-clip": {
			background: ["#0F172A", "#7C3AED"],
			panel: ["#C4B5FD", "#7C3AED"],
			eyebrow: "PODCAST",
			headline: "Interview Cut",
			subhead: "Oversized headline scene",
			art: portraitArt,
		},
		"builtin-project-ugc-testimonial": {
			background: ["#111827", "#EC4899"],
			panel: ["#F9A8D4", "#DB2777"],
			eyebrow: "UGC AD",
			headline: "Creator Review",
			subhead: "Social proof visual",
			art: portraitArt,
		},
		"builtin-scene-creator-intro": {
			background: ["#0F172A", "#14B8A6"],
			panel: ["#5EEAD4", "#0F766E"],
			eyebrow: "CREATOR",
			headline: "Channel Intro",
			subhead: "Name and role opener",
			art: portraitArt,
		},
		"builtin-project-product-promo": {
			background: ["#111827", "#EA580C"],
			panel: ["#FDBA74", "#F97316"],
			eyebrow: "PRODUCT",
			headline: "Launch Visual",
			subhead: "Commerce-ready mockup",
			art: productArt,
		},
		"builtin-project-app-demo": {
			background: ["#0F172A", "#0EA5E9"],
			panel: ["#67E8F9", "#0284C7"],
			eyebrow: "APP DEMO",
			headline: "Feature Walkthrough",
			subhead: "Clean interface mock",
			art: productArt,
		},
		"builtin-scene-sale-announcement": {
			background: ["#7F1D1D", "#EF4444"],
			panel: ["#FCA5A5", "#EF4444"],
			eyebrow: "LIMITED TIME",
			headline: "Sale Drop",
			subhead: "Promo-ready visual",
			art: productArt,
		},
		"builtin-scene-unboxing-highlight": {
			background: ["#1F2937", "#D97706"],
			panel: ["#FCD34D", "#F59E0B"],
			eyebrow: "UNBOXING",
			headline: "First Look",
			subhead: "Reveal moment frame",
			art: productArt,
		},
		"builtin-project-photo-slideshow": {
			background: ["#082F49", "#0EA5E9"],
			panel: ["#BAE6FD", "#38BDF8"],
			eyebrow: "MEMORIES",
			headline: "Photo Story",
			subhead: "Travel and recap reel",
			art: travelArt,
		},
		"builtin-scene-travel-opener": {
			background: ["#0C4A6E", "#06B6D4"],
			panel: ["#67E8F9", "#0891B2"],
			eyebrow: "TRAVEL",
			headline: "Destination Opener",
			subhead: "Scenic montage frame",
			art: travelArt,
		},
		"builtin-project-event-invite": {
			background: ["#312E81", "#8B5CF6"],
			panel: ["#DDD6FE", "#8B5CF6"],
			eyebrow: "EVENT",
			headline: "Invite Card",
			subhead: "Launch and meetup promo",
			art: travelArt,
		},
		"builtin-scene-news-flash": {
			background: ["#111827", "#2563EB"],
			panel: ["#BFDBFE", "#3B82F6"],
			eyebrow: "BREAKING",
			headline: "News Flash",
			subhead: "Headline-driven frame",
			art: editorialArt,
		},
		"builtin-project-tutorial-carousel": {
			background: ["#0F172A", "#0891B2"],
			panel: ["#A5F3FC", "#06B6D4"],
			eyebrow: "HOW TO",
			headline: "Step-by-step",
			subhead: "Tutorial layout",
			art: editorialArt,
		},
		"builtin-scene-cta": {
			background: ["#172554", "#2563EB"],
			panel: ["#DBEAFE", "#60A5FA"],
			eyebrow: "NEXT STEP",
			headline: "Call To Action",
			subhead: "End card block",
			art: editorialArt,
		},
		"builtin-scene-quote-card": {
			background: ["#1E1B4B", "#6D28D9"],
			panel: ["#DDD6FE", "#8B5CF6"],
			eyebrow: "QUOTE",
			headline: "Key Takeaway",
			subhead: "Editorial card visual",
			art: editorialArt,
		},
		"builtin-scene-holiday-greeting": {
			background: ["#7F1D1D", "#FB7185"],
			panel: ["#FECDD3", "#FB7185"],
			eyebrow: "CELEBRATE",
			headline: "Holiday Greeting",
			subhead: "Festive message card",
			art: festiveArt,
		},
		"builtin-scene-recipe-card": {
			background: ["#78350F", "#F59E0B"],
			panel: ["#FDE68A", "#FBBF24"],
			eyebrow: "RECIPE",
			headline: "Dish Highlight",
			subhead: "Food intro visual",
			art: festiveArt,
		},
		"builtin-scene-workout-progress": {
			background: ["#052E16", "#22C55E"],
			panel: ["#BBF7D0", "#22C55E"],
			eyebrow: "PROGRESS",
			headline: "Workout Update",
			subhead: "Fitness milestone card",
			art: fitnessArt,
		},
		"builtin-scene-before-after": {
			background: ["#111827", "#0F766E"],
			panel: ["#99F6E4", "#14B8A6"],
			eyebrow: "COMPARE",
			headline: "Before / After",
			subhead: "Split-screen reveal",
			art: splitArt,
		},
		"builtin-scene-meme-caption": {
			background: ["#111827", "#4B5563"],
			panel: ["#E5E7EB", "#9CA3AF"],
			eyebrow: "MEME",
			headline: "Reaction Frame",
			subhead: "Caption-ready scene",
			art: portraitArt,
		},
	};

	return (
		themes[templateId] ?? {
			background: ["#111827", "#2563EB"],
			panel: ["#BFDBFE", "#3B82F6"],
			eyebrow: "OPENCUT",
			headline: "Starter Asset",
			subhead: "Replace with your own media",
			art: editorialArt,
		}
	);
}

function createBuiltInPlaceholderAsset({
	template,
	slot,
}: {
	template: Template;
	slot: TemplateMediaSlot;
}) {
	const theme = getBuiltInDemoTheme(template.id);
	const title = escapeXml(theme.headline);
	const subtitle = escapeXml(theme.subhead);
	const eyebrow = escapeXml(theme.eyebrow);
	const slotLabel = escapeXml(slot.label);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${theme.background[0]}"/>
<stop offset="100%" stop-color="${theme.background[1]}"/>
</linearGradient>
<linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${theme.panel[0]}"/>
<stop offset="100%" stop-color="${theme.panel[1]}"/>
</linearGradient>
</defs>
<rect width="1080" height="1920" rx="72" fill="url(#bg)"/>
<rect x="52" y="52" width="976" height="1816" rx="58" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)"/>
<circle cx="168" cy="180" r="124" fill="rgba(255,255,255,0.1)"/>
<circle cx="920" cy="312" r="86" fill="rgba(255,255,255,0.08)"/>
${theme.art}
<text x="138" y="172" fill="rgba(255,255,255,0.78)" font-size="30" font-family="Arial, sans-serif" font-weight="700" letter-spacing="6">${eyebrow}</text>
<text x="138" y="1544" fill="#FFFFFF" font-size="98" font-family="Arial, sans-serif" font-weight="700">${title}</text>
<text x="138" y="1642" fill="rgba(255,255,255,0.84)" font-size="42" font-family="Arial, sans-serif">${subtitle}</text>
<rect x="138" y="1692" width="356" height="70" rx="22" fill="rgba(15,23,42,0.3)" stroke="rgba(255,255,255,0.16)"/>
<text x="176" y="1738" fill="rgba(255,255,255,0.9)" font-size="28" font-family="Arial, sans-serif">${slotLabel}</text>
</svg>`;
	const file = new File([svg], `${slot.id}.svg`, {
		type: "image/svg+xml",
		lastModified: Date.now(),
	});

	return {
		name: `${template.name} - ${slot.label}`,
		type: "image" as const,
		file,
		thumbnailUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
		width: 1080,
		height: 1920,
		duration: 5,
		hasAudio: false,
	};
}

async function getBuiltInDemoAsset({
	template,
	slot,
}: {
	template: Template;
	slot: TemplateMediaSlot;
}) {
	if (template.source !== "built-in") {
		return null;
	}

	const manifest = await getBuiltInDemoManifest();
	if (!manifest) {
		return null;
	}

	const assetId = manifest.slots[`${template.id}:${slot.id}`];
	if (!assetId) {
		return null;
	}

	const asset = manifest.assets[assetId];
	if (!asset) {
		return null;
	}

	if (!slot.accept.includes(asset.type)) {
		return null;
	}

	const response = await fetch(asset.path);
	if (!response.ok) {
		return null;
	}

	const blob = await response.blob();
	const fileName = asset.path.split("/").at(-1) ?? `${asset.id}`;
	const file = new File([blob], fileName, {
		type: blob.type || (asset.type === "video" ? "video/mp4" : "image/jpeg"),
		lastModified: Date.now(),
	});

	return {
		name: asset.name,
		type: asset.type,
		file,
		thumbnailUrl: asset.thumbnailPath,
		width: asset.width,
		height: asset.height,
		duration: asset.duration,
		hasAudio: asset.type === "video",
	};
}

class TemplateService {
	private templatesAdapter = new IndexedDBAdapter<SerializedTemplate>(
		"video-editor-templates",
		"templates",
		1,
	);

	private getTemplateAssetsAdapter({ templateId }: { templateId: string }) {
		return new OPFSAdapter(`template-assets-${templateId}`);
	}

	async listTemplates(): Promise<Template[]> {
		const storedTemplates = await this.templatesAdapter.getAll();
		const normalizedTemplates = await Promise.all(
			storedTemplates.map((template) =>
				normalizeSerializedTemplateCore({ template }),
			),
		);
		const userTemplates = normalizedTemplates
			.map(deserializeTemplate)
			.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

		return [...BUILT_IN_TEMPLATES, ...userTemplates];
	}

	async getTemplate({ id }: { id: string }): Promise<Template | null> {
		const builtIn = BUILT_IN_TEMPLATES.find((template) => template.id === id);
		if (builtIn) {
			return builtIn;
		}

		const template = await this.templatesAdapter.get(id);
		if (!template) {
			return null;
		}

		return deserializeTemplate(
			await normalizeSerializedTemplateCore({ template }),
		);
	}

	async saveProjectTemplate({
		project,
		mediaAssets,
		options,
	}: {
		project: TProject;
		mediaAssets: MediaAsset[];
		options: CreateTemplateOptions;
	}): Promise<Template> {
		const { template, templateFileCopies } = buildProjectTemplate({
			project,
			mediaAssets,
			options,
		});

		await this.templatesAdapter.set(template.id, serializeTemplate(template));
		await Promise.all(
			templateFileCopies.map(({ assetId, file }) =>
				this.getTemplateAssetsAdapter({ templateId: template.id }).set(
					assetId,
					file,
				),
			),
		);

		return template;
	}

	async saveSceneTemplate({
		scene,
		cover,
		mediaAssets,
		options,
	}: {
		scene: TScene;
		cover?: string;
		mediaAssets: MediaAsset[];
		options: CreateTemplateOptions;
	}): Promise<Template> {
		const { template, templateFileCopies } = buildSceneTemplate({
			scene,
			cover,
			mediaAssets,
			options,
		});

		await this.templatesAdapter.set(template.id, serializeTemplate(template));
		await Promise.all(
			templateFileCopies.map(({ assetId, file }) =>
				this.getTemplateAssetsAdapter({ templateId: template.id }).set(
					assetId,
					file,
				),
			),
		);

		return template;
	}

	async deleteTemplate({ id }: { id: string }): Promise<void> {
		await this.templatesAdapter.remove(id);
		await this.getTemplateAssetsAdapter({ templateId: id }).clear();
	}

	async exportTemplate({ id }: { id: string }): Promise<Blob> {
		const template = await this.getTemplate({ id });
		if (!template) {
			throw new Error("Template not found");
		}
		if (template.source !== "user") {
			throw new Error("Built-in templates cannot be exported");
		}

		const assetsAdapter = this.getTemplateAssetsAdapter({ templateId: id });
		const files = await Promise.all(
			template.assets.map(async (asset) => {
				const file = await assetsAdapter.get(asset.id);
				if (!file) {
					throw new Error(`Missing asset ${asset.name}`);
				}
				return { id: asset.id, file };
			}),
		);

		const bundle = await bundleTemplateExport({ template, files });

		return new Blob([JSON.stringify(bundle)], {
			type: "application/json",
		});
	}

	async importTemplate({ file }: { file: File }): Promise<Template> {
		const content = await file.text();
		const bundle = JSON.parse(content) as TemplateExportBundle;

		if (bundle.schemaVersion !== 1) {
			throw new Error("Unsupported template export");
		}

		const importedTemplate = projectTemplateFromExportBundle({ bundle });
		const templateId = generateUUID();
		const template: Template = {
			...importedTemplate,
			id: templateId,
			source: "user",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		await this.templatesAdapter.set(template.id, serializeTemplate(template));

		const assetsAdapter = this.getTemplateAssetsAdapter({ templateId });
		await Promise.all(
			bundle.assets.map((asset) =>
				assetsAdapter.set(
					asset.id,
					dataUrlToFile({
						dataUrl: asset.dataUrl,
						name: asset.name,
						type: asset.type,
						lastModified: asset.lastModified,
					}),
				),
			),
		);

		return template;
	}

	private async resolveSlotAssets({
		template,
		slotFiles,
	}: {
		template: Template;
		slotFiles: Record<string, File | null | undefined>;
	}) {
		const resolved = new Map<
			string,
			{
				name: string;
				type: "video" | "image" | "audio";
				file: File;
				thumbnailUrl?: string;
				width?: number;
				height?: number;
				duration?: number;
				fps?: number;
				hasAudio?: boolean;
			}
		>();

		const assetsAdapter = this.getTemplateAssetsAdapter({
			templateId: template.id,
		});

		for (const slot of template.mediaSlots) {
			const userFile = slotFiles[slot.id];
			if (userFile) {
				const processedAssets = await processMediaAssets({
					files: [userFile],
				});
				const processedAsset = processedAssets[0];
				if (!processedAsset) {
					throw new Error(`Failed to process ${userFile.name}`);
				}
				if (!slot.accept.includes(processedAsset.type)) {
					throw new Error(`${processedAsset.name} does not match this slot`);
				}

				resolved.set(slot.id, {
					name: processedAsset.name,
					type: processedAsset.type,
					file: processedAsset.file,
					thumbnailUrl: processedAsset.thumbnailUrl,
					width: processedAsset.width,
					height: processedAsset.height,
					duration: processedAsset.duration,
					fps: processedAsset.fps,
					hasAudio: processedAsset.hasAudio,
				});
				continue;
			}

			if (slot.defaultAssetId) {
				const assetMetadata = template.assets.find(
					(asset) => asset.id === slot.defaultAssetId,
				);
				const file = await assetsAdapter.get(slot.defaultAssetId);

				if (assetMetadata && file) {
					resolved.set(slot.id, {
						name: assetMetadata.name,
						type: assetMetadata.type,
						file,
						thumbnailUrl: assetMetadata.thumbnailUrl,
						width: assetMetadata.width,
						height: assetMetadata.height,
						duration: assetMetadata.duration,
						fps: assetMetadata.fps,
						hasAudio: assetMetadata.hasAudio,
					});
					continue;
				}
			}

			if (slot.required) {
				const builtInDemoAsset = await getBuiltInDemoAsset({
					template,
					slot,
				});
				if (builtInDemoAsset) {
					resolved.set(slot.id, builtInDemoAsset);
					continue;
				}

				if (canAutoFillBuiltInSlot({ template, slot })) {
					resolved.set(
						slot.id,
						createBuiltInPlaceholderAsset({
							template,
							slot,
						}),
					);
					continue;
				}

				throw new Error(`Missing required media for "${slot.label}"`);
			}
		}

		return resolved;
	}

	async instantiateProject({
		templateId,
		slotFiles = {},
	}: {
		templateId: string;
		slotFiles?: Record<string, File | null | undefined>;
	}): Promise<InstantiatedProjectTemplate> {
		const template = await this.getTemplate({ id: templateId });
		if (!template || template.kind !== "project") {
			throw new Error("Project template not found");
		}

		const resolved = await this.resolveSlotAssets({ template, slotFiles });
		return instantiateProjectTemplateCore({
			template,
			resolvedSlotAssets: resolved,
		});
	}

	async instantiateScene({
		templateId,
		slotFiles = {},
	}: {
		templateId: string;
		slotFiles?: Record<string, File | null | undefined>;
	}): Promise<InstantiatedSceneTemplate> {
		const template = await this.getTemplate({ id: templateId });
		if (!template || template.kind !== "scene") {
			throw new Error("Scene template not found");
		}

		const resolved = await this.resolveSlotAssets({ template, slotFiles });
		return instantiateSceneTemplateCore({
			template,
			resolvedSlotAssets: resolved,
		});
	}
}

export const templateService = new TemplateService();
