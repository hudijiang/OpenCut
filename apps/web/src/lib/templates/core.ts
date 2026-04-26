import type { MediaType } from "@/lib/media/types";
import type { TScene } from "@/lib/timeline";
import type {
	InstantiatedProjectTemplate,
	InstantiatedSceneTemplate,
	SerializedTemplate,
	Template,
} from "@/lib/templates/types";
import {
	deserializeTemplate,
	instantiateProjectTemplate,
	instantiateSceneTemplate,
	replaceTemplateSlotAssetInScenes,
	serializeTemplate,
} from "@/lib/templates/utils";

type TemplatesWasmModule = {
	instantiateProjectTemplateCore: (options: {
		scenesJson: string;
		currentSceneId: string;
		mediaSlotsJson: string;
		resolvedSlotMediaTypesJson: string;
		replacementsJson: string;
	}) =>
		| Promise<{
				scenesJson: string;
				currentSceneId: string;
		  }>
		| {
				scenesJson: string;
				currentSceneId: string;
		  };
	instantiateSceneTemplateCore: (options: {
		sceneJson: string;
		mediaSlotsJson: string;
		resolvedSlotMediaTypesJson: string;
		replacementsJson: string;
	}) =>
		| Promise<{
				sceneJson: string;
		  }>
		| {
				sceneJson: string;
		  };
	replaceSlotAssetInScenesCore: (options: {
		scenesJson: string;
		currentAssetId: string;
		nextAssetId: string;
		nextMediaType: string;
		sourceDuration?: number;
	}) =>
		| Promise<{
				scenesJson: string;
		  }>
		| {
				scenesJson: string;
		  };
	validateTemplateSchema: (options: { templateJson: string }) =>
		| Promise<{
				templateJson: string;
		  }>
		| {
				templateJson: string;
		  };
};

type ResolvedSlotAssetMap = Map<
	string,
	{
		name: string;
		type: MediaType;
		file: File;
		thumbnailUrl?: string;
		width?: number;
		height?: number;
		duration?: number;
		fps?: number;
		hasAudio?: boolean;
	}
>;

let templatesWasmPromise: Promise<TemplatesWasmModule | null> | null = null;
const localTemplatesWasmSpecifier =
	"../../../../../rust/wasm/pkg/opencut_wasm.js";

function serializeScene(scene: TScene) {
	return {
		...scene,
		createdAt: scene.createdAt.toISOString(),
		updatedAt: scene.updatedAt.toISOString(),
	};
}

function deserializeScene(scene: ReturnType<typeof serializeScene>): TScene {
	return {
		...scene,
		createdAt: new Date(scene.createdAt),
		updatedAt: new Date(scene.updatedAt),
	};
}

async function loadTemplatesWasm() {
	if (typeof window === "undefined") {
		return null;
	}

	if (!templatesWasmPromise) {
		templatesWasmPromise = import(
			/* webpackIgnore: true */ localTemplatesWasmSpecifier
		)
			.then((module) =>
				"instantiateProjectTemplateCore" in module &&
				"replaceSlotAssetInScenesCore" in module &&
				"validateTemplateSchema" in module
					? (module as TemplatesWasmModule)
					: null,
			)
			.catch(() => null);
	}

	return templatesWasmPromise;
}

function buildResolvedSlotMediaTypes(resolvedSlotAssets: ResolvedSlotAssetMap) {
	return Array.from(resolvedSlotAssets.entries()).map(([slotId, asset]) => ({
		slotId,
		mediaType: asset.type,
	}));
}

function buildReplacementEntries(
	slotBindings: Array<{ slotId: string; assetId: string }>,
) {
	return slotBindings.map((binding) => ({
		from: binding.slotId,
		to: binding.assetId,
	}));
}

export async function normalizeSerializedTemplateCore({
	template,
}: {
	template: SerializedTemplate;
}) {
	const wasm = await loadTemplatesWasm();
	if (!wasm) {
		return template;
	}

	try {
		const result = await wasm.validateTemplateSchema({
			templateJson: JSON.stringify(template),
		});
		return JSON.parse(result.templateJson) as SerializedTemplate;
	} catch {
		return template;
	}
}

export async function instantiateProjectTemplateCore({
	template,
	resolvedSlotAssets,
}: {
	template: Extract<Template, { kind: "project" }>;
	resolvedSlotAssets: ResolvedSlotAssetMap;
}): Promise<InstantiatedProjectTemplate> {
	const fallback = instantiateProjectTemplate({
		template,
		resolvedSlotAssets,
	});
	const wasm = await loadTemplatesWasm();
	if (!wasm) {
		return fallback;
	}

	const serializedTemplate = serializeTemplate(template);
	if (serializedTemplate.kind !== "project") {
		return fallback;
	}

	try {
		const result = await wasm.instantiateProjectTemplateCore({
			scenesJson: JSON.stringify(serializedTemplate.project.scenes),
			currentSceneId: serializedTemplate.project.currentSceneId,
			mediaSlotsJson: JSON.stringify(template.mediaSlots),
			resolvedSlotMediaTypesJson: JSON.stringify(
				buildResolvedSlotMediaTypes(resolvedSlotAssets),
			),
			replacementsJson: JSON.stringify(
				buildReplacementEntries(fallback.slotBindings),
			),
		});

		const nextScenes = JSON.parse(
			result.scenesJson,
		) as typeof serializedTemplate.project.scenes;
		const nextTemplate = deserializeTemplate({
			...serializedTemplate,
			project: {
				...serializedTemplate.project,
				scenes: nextScenes,
				currentSceneId: result.currentSceneId,
			},
		});
		if (nextTemplate.kind !== "project") {
			return fallback;
		}

		return {
			...fallback,
			project: nextTemplate.project,
		};
	} catch {
		return fallback;
	}
}

export async function instantiateSceneTemplateCore({
	template,
	resolvedSlotAssets,
}: {
	template: Extract<Template, { kind: "scene" }>;
	resolvedSlotAssets: ResolvedSlotAssetMap;
}): Promise<InstantiatedSceneTemplate> {
	const fallback = instantiateSceneTemplate({
		template,
		resolvedSlotAssets,
	});
	const wasm = await loadTemplatesWasm();
	if (!wasm) {
		return fallback;
	}

	const serializedTemplate = serializeTemplate(template);
	if (serializedTemplate.kind !== "scene") {
		return fallback;
	}

	try {
		const result = await wasm.instantiateSceneTemplateCore({
			sceneJson: JSON.stringify(serializedTemplate.scene.scene),
			mediaSlotsJson: JSON.stringify(template.mediaSlots),
			resolvedSlotMediaTypesJson: JSON.stringify(
				buildResolvedSlotMediaTypes(resolvedSlotAssets),
			),
			replacementsJson: JSON.stringify(
				buildReplacementEntries(fallback.slotBindings),
			),
		});

		const nextScene = JSON.parse(
			result.sceneJson,
		) as typeof serializedTemplate.scene.scene;
		const nextTemplate = deserializeTemplate({
			...serializedTemplate,
			scene: {
				scene: nextScene,
			},
		});
		if (nextTemplate.kind !== "scene") {
			return fallback;
		}

		return {
			...fallback,
			scene: nextTemplate.scene.scene,
		};
	} catch {
		return fallback;
	}
}

export async function replaceTemplateSlotAssetInScenesCore({
	scenes,
	currentAssetId,
	nextAssetId,
	nextMediaType,
	sourceDuration,
}: {
	scenes: TScene[];
	currentAssetId: string;
	nextAssetId: string;
	nextMediaType: MediaType;
	sourceDuration?: number;
}) {
	const fallback = replaceTemplateSlotAssetInScenes({
		scenes,
		currentAssetId,
		nextAssetId,
		nextMediaType,
		sourceDuration,
	});
	const wasm = await loadTemplatesWasm();
	if (!wasm) {
		return fallback;
	}

	try {
		const result = await wasm.replaceSlotAssetInScenesCore({
			scenesJson: JSON.stringify(scenes.map(serializeScene)),
			currentAssetId,
			nextAssetId,
			nextMediaType,
			sourceDuration,
		});

		return (
			JSON.parse(result.scenesJson) as Array<ReturnType<typeof serializeScene>>
		).map(deserializeScene);
	} catch {
		return fallback;
	}
}
