import type { MediaAsset, MediaType } from "@/lib/media/types";
import type { TProject } from "@/lib/project/types";
import { generateUUID } from "@/utils/id";
import { hasMediaId } from "@/lib/timeline/element-utils";
import type { SceneTracks, TScene, TimelineElement } from "@/lib/timeline";
import type {
	CreateTemplateOptions,
	InstantiatedProjectTemplate,
	InstantiatedSceneTemplate,
	SerializedTemplate,
	SerializedTemplateProjectSnapshot,
	SerializedTemplateSceneSnapshot,
	Template,
	TemplateAssetMetadata,
	TemplateExportBundle,
	TemplateInstantiationAsset,
	TemplateMediaSlot,
	TemplateProjectSnapshot,
	TemplateSceneSnapshot,
	TemplateSlotBinding,
} from "./types";

type VisualMediaType = "video" | "image";

function serializeScene(scene: TScene) {
	return {
		...scene,
		createdAt: scene.createdAt.toISOString(),
		updatedAt: scene.updatedAt.toISOString(),
	};
}

function deserializeScene(
	scene: SerializedTemplateSceneSnapshot["scene"],
): TScene {
	return {
		...scene,
		createdAt: new Date(scene.createdAt),
		updatedAt: new Date(scene.updatedAt),
	};
}

export function serializeTemplate(template: Template): SerializedTemplate {
	const base = {
		...template,
		createdAt: template.createdAt.toISOString(),
		updatedAt: template.updatedAt.toISOString(),
	};

	if (template.kind === "project") {
		const project: SerializedTemplateProjectSnapshot = {
			...template.project,
			scenes: template.project.scenes.map(serializeScene),
		};

		return {
			...base,
			kind: "project",
			project,
		};
	}

	const scene: SerializedTemplateSceneSnapshot = {
		scene: serializeScene(template.scene.scene),
	};

	return {
		...base,
		kind: "scene",
		scene,
	};
}

export function deserializeTemplate(template: SerializedTemplate): Template {
	const base = {
		...template,
		createdAt: new Date(template.createdAt),
		updatedAt: new Date(template.updatedAt),
	};

	if (template.kind === "project") {
		return {
			...base,
			kind: "project",
			project: {
				...template.project,
				scenes: template.project.scenes.map(deserializeScene),
			},
		};
	}

	return {
		...base,
		kind: "scene",
		scene: {
			scene: deserializeScene(template.scene.scene),
		},
	};
}

function trackLists(tracks: SceneTracks) {
	return [...tracks.overlay, tracks.main, ...tracks.audio];
}

function cloneMediaAssetFile(file: File) {
	return new File([file], file.name, {
		type: file.type,
		lastModified: file.lastModified,
	});
}

function cloneCustomMaskPointIds<TValue>(value: TValue): TValue {
	if (!value || typeof value !== "object") {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => cloneCustomMaskPointIds(entry)) as TValue;
	}

	const candidate = value as Record<string, unknown>;
	if (
		typeof candidate.id === "string" &&
		typeof candidate.x === "number" &&
		typeof candidate.y === "number" &&
		typeof candidate.inX === "number" &&
		typeof candidate.inY === "number" &&
		typeof candidate.outX === "number" &&
		typeof candidate.outY === "number"
	) {
		return {
			...candidate,
			id: generateUUID(),
		} as TValue;
	}

	return Object.fromEntries(
		Object.entries(candidate).map(([key, entry]) => [
			key,
			cloneCustomMaskPointIds(entry),
		]),
	) as TValue;
}

function refreshElementIds<TElement extends TimelineElement>(
	element: TElement,
): TElement {
	const cloned = structuredClone(element) as TElement;

	if ("effects" in cloned && Array.isArray(cloned.effects)) {
		cloned.effects = cloned.effects.map((effect) => ({
			...effect,
			id: generateUUID(),
		}));
	}

	if ("masks" in cloned && Array.isArray(cloned.masks)) {
		cloned.masks = cloned.masks.map((mask) => ({
			...mask,
			id: generateUUID(),
			params: cloneCustomMaskPointIds(mask.params),
		})) as typeof cloned.masks;
	}

	if (cloned.animations) {
		const channels = structuredClone(cloned.animations.channels);
		for (const channel of Object.values(channels)) {
			if (!channel) continue;
			if (channel.kind === "scalar") {
				channel.keys = channel.keys.map((entry) => ({
					...entry,
					id: generateUUID(),
				}));
				continue;
			}

			channel.keys = channel.keys.map((entry) => ({
				...entry,
				id: generateUUID(),
			}));
		}

		cloned.animations = {
			bindings: structuredClone(cloned.animations.bindings),
			channels,
		};
	}

	return {
		...cloned,
		id: generateUUID(),
	};
}

function refreshTrack<
	TElement extends TimelineElement,
	TTrack extends { elements: TElement[] },
>(track: TTrack): TTrack {
	return {
		...track,
		elements: track.elements.map(
			(element) => refreshElementIds(element) as TElement,
		),
	} as TTrack;
}

function refreshSceneIds(scene: TScene): TScene {
	const cloned = structuredClone(scene);

	return {
		...cloned,
		id: generateUUID(),
		createdAt: new Date(),
		updatedAt: new Date(),
		tracks: {
			overlay: cloned.tracks.overlay.map((track) => ({
				...refreshTrack(track),
				id: generateUUID(),
			})),
			main: {
				...refreshTrack(cloned.tracks.main),
				id: generateUUID(),
			},
			audio: cloned.tracks.audio.map((track) => ({
				...refreshTrack(track),
				id: generateUUID(),
			})),
		},
	};
}

function replaceMediaIdsInScene({
	scene,
	replacements,
}: {
	scene: TScene;
	replacements: Map<string, string>;
}): TScene {
	const cloned = structuredClone(scene);

	const replaceElement = <TElement extends TimelineElement>(
		element: TElement,
	): TElement => {
		if (!hasMediaId(element)) {
			return element;
		}

		const replacement = replacements.get(element.mediaId);
		if (!replacement) {
			return element;
		}

		return {
			...element,
			mediaId: replacement,
		} as TElement;
	};

	function replaceTrackMediaIds<
		TElement extends TimelineElement,
		TTrack extends { elements: TElement[] },
	>(track: TTrack): TTrack {
		return {
			...track,
			elements: track.elements.map((element) => replaceElement(element)),
		} as TTrack;
	}

	return {
		...cloned,
		tracks: {
			overlay: cloned.tracks.overlay.map((track) =>
				replaceTrackMediaIds(track),
			),
			main: replaceTrackMediaIds(cloned.tracks.main),
			audio: cloned.tracks.audio.map((track) => replaceTrackMediaIds(track)),
		},
	};
}

function updateElementVisualType({
	element,
	mediaType,
}: {
	element: TimelineElement;
	mediaType: VisualMediaType;
}): TimelineElement {
	if (element.type !== "video" && element.type !== "image") {
		return element;
	}

	if (element.type === mediaType) {
		return element;
	}

	if (mediaType === "image" && element.type === "video") {
		const { volume, muted, isSourceAudioEnabled, retime, ...rest } = element;
		return {
			...rest,
			type: "image",
		};
	}

	return {
		...element,
		type: "video",
		volume: "volume" in element ? element.volume : 1,
		muted: "muted" in element ? element.muted : false,
		isSourceAudioEnabled:
			"isSourceAudioEnabled" in element ? element.isSourceAudioEnabled : true,
		retime: "retime" in element ? element.retime : undefined,
	};
}

function updateElementMediaForAsset({
	element,
	mediaId,
	mediaType,
	sourceDuration,
}: {
	element: TimelineElement;
	mediaId: string;
	mediaType: MediaType;
	sourceDuration?: number;
}): TimelineElement {
	if (!hasMediaId(element)) {
		return element;
	}

	if (mediaType === "video" || mediaType === "image") {
		const visualElement = updateElementVisualType({
			element,
			mediaType,
		});

		return {
			...visualElement,
			mediaId,
			...(mediaType === "video" && typeof sourceDuration === "number"
				? { sourceDuration }
				: {}),
		} as TimelineElement;
	}

	if (element.type !== "audio") {
		return element;
	}

	return {
		...element,
		mediaId,
		...(typeof sourceDuration === "number" ? { sourceDuration } : {}),
	};
}

function applyResolvedSlotMediaTypesToScene({
	scene,
	mediaSlots,
	resolvedSlotAssets,
}: {
	scene: TScene;
	mediaSlots: TemplateMediaSlot[];
	resolvedSlotAssets: Map<
		string,
		{
			type: MediaType;
		}
	>;
}) {
	const cloned = structuredClone(scene);
	const trackMap = new Map<string, { elements: TimelineElement[] }>();

	for (const track of cloned.tracks.overlay) {
		trackMap.set(track.id, track);
	}
	trackMap.set(cloned.tracks.main.id, cloned.tracks.main);
	for (const track of cloned.tracks.audio) {
		trackMap.set(track.id, track);
	}

	for (const slot of mediaSlots) {
		const assetType = resolvedSlotAssets.get(slot.id)?.type;
		if (assetType !== "video" && assetType !== "image") {
			continue;
		}

		for (const ref of slot.boundElements) {
			if (ref.sceneId !== scene.id) {
				continue;
			}

			const track = trackMap.get(ref.trackId);
			if (!track) {
				continue;
			}

			const elementIndex = track.elements.findIndex(
				(element) => element.id === ref.elementId,
			);
			if (elementIndex === -1) {
				continue;
			}

			track.elements[elementIndex] = updateElementVisualType({
				element: track.elements[elementIndex],
				mediaType: assetType,
			});
		}
	}

	return cloned;
}

function getAcceptedTypes(type: MediaType): MediaType[] {
	return [type];
}

function buildTemplateAssets({
	scenes,
	mediaAssets,
	includeExampleMedia,
}: {
	scenes: TScene[];
	mediaAssets: MediaAsset[];
	includeExampleMedia: boolean;
}) {
	const mediaById = new Map(
		mediaAssets.map((asset) => [asset.id, asset] as const),
	);
	const slotByMediaId = new Map<
		string,
		{
			slot: TemplateMediaSlot;
			assetMetadata?: TemplateAssetMetadata;
		}
	>();

	const transformedScenes = scenes.map((scene) => structuredClone(scene));

	for (const scene of transformedScenes) {
		for (const track of trackLists(scene.tracks)) {
			track.elements = track.elements.map((element) => {
				if (!hasMediaId(element)) {
					return element;
				}

				const mediaAsset = mediaById.get(element.mediaId);
				if (!mediaAsset) {
					return element;
				}

				let entry = slotByMediaId.get(mediaAsset.id);
				if (!entry) {
					const slotId = generateUUID();
					const assetMetadata = includeExampleMedia
						? {
								id: slotId,
								slotId,
								name: mediaAsset.name,
								type: mediaAsset.type,
								size: mediaAsset.file.size,
								lastModified: mediaAsset.file.lastModified,
								width: mediaAsset.width,
								height: mediaAsset.height,
								duration: mediaAsset.duration,
								fps: mediaAsset.fps,
								hasAudio: mediaAsset.hasAudio,
								thumbnailUrl: mediaAsset.thumbnailUrl,
							}
						: undefined;

					entry = {
						slot: {
							id: slotId,
							label: mediaAsset.name,
							accept: getAcceptedTypes(mediaAsset.type),
							required: true,
							defaultAssetId: assetMetadata?.id,
							boundElements: [],
						},
						assetMetadata,
					};
					slotByMediaId.set(mediaAsset.id, entry);
				}

				entry.slot.boundElements.push({
					sceneId: scene.id,
					trackId: track.id,
					elementId: element.id,
				});

				return {
					...element,
					mediaId: entry.slot.id,
				};
			}) as typeof track.elements;
		}
	}

	return {
		mediaSlots: Array.from(slotByMediaId.values(), ({ slot }) => slot),
		assets: Array.from(
			slotByMediaId.values(),
			({ assetMetadata }) => assetMetadata,
		).filter((asset): asset is TemplateAssetMetadata => Boolean(asset)),
		templateFileCopies: Array.from(slotByMediaId.entries()).flatMap(
			([mediaId, entry]) => {
				if (!entry.assetMetadata) {
					return [];
				}

				const mediaAsset = mediaById.get(mediaId);
				if (!mediaAsset) {
					return [];
				}

				return [
					{
						assetId: entry.assetMetadata.id,
						file: cloneMediaAssetFile(mediaAsset.file),
					},
				];
			},
		),
		scenes: transformedScenes,
	};
}

export function buildProjectTemplate({
	project,
	mediaAssets,
	options,
}: {
	project: TProject;
	mediaAssets: MediaAsset[];
	options: CreateTemplateOptions;
}) {
	const transformed = buildTemplateAssets({
		scenes: project.scenes,
		mediaAssets,
		includeExampleMedia: options.includeExampleMedia,
	});

	const snapshot: TemplateProjectSnapshot = {
		name: project.metadata.name,
		scenes: transformed.scenes,
		currentSceneId: project.currentSceneId,
		settings: structuredClone(project.settings),
		timelineViewState: structuredClone(project.timelineViewState),
	};

	return {
		template: {
			id: generateUUID(),
			name: options.name,
			description: options.description?.trim() ?? "",
			kind: "project" as const,
			source: "user" as const,
			tags: [],
			locale: options.locale ?? "en",
			version: 1,
			cover: project.metadata.thumbnail,
			createdAt: new Date(),
			updatedAt: new Date(),
			mediaSlots: transformed.mediaSlots,
			assets: transformed.assets,
			project: snapshot,
		},
		templateFileCopies: transformed.templateFileCopies,
	};
}

export function buildSceneTemplate({
	scene,
	cover,
	mediaAssets,
	options,
}: {
	scene: TScene;
	cover?: string;
	mediaAssets: MediaAsset[];
	options: CreateTemplateOptions;
}) {
	const transformed = buildTemplateAssets({
		scenes: [scene],
		mediaAssets,
		includeExampleMedia: options.includeExampleMedia,
	});

	const snapshot: TemplateSceneSnapshot = {
		scene: transformed.scenes[0],
	};

	return {
		template: {
			id: generateUUID(),
			name: options.name,
			description: options.description?.trim() ?? "",
			kind: "scene" as const,
			source: "user" as const,
			tags: [],
			locale: options.locale ?? "en",
			version: 1,
			cover,
			createdAt: new Date(),
			updatedAt: new Date(),
			mediaSlots: transformed.mediaSlots,
			assets: transformed.assets,
			scene: snapshot,
		},
		templateFileCopies: transformed.templateFileCopies,
	};
}

function fileToObjectUrl(file: File) {
	return URL.createObjectURL(file);
}

function buildInstantiatedAsset({
	slotId,
	asset,
}: {
	slotId: string;
	asset: {
		name: string;
		type: MediaType;
		file: File;
		thumbnailUrl?: string;
		width?: number;
		height?: number;
		duration?: number;
		fps?: number;
		hasAudio?: boolean;
	};
}): TemplateInstantiationAsset {
	const file = cloneMediaAssetFile(asset.file);
	return {
		slotId,
		assetId: generateUUID(),
		name: asset.name,
		type: asset.type,
		file,
		url: fileToObjectUrl(file),
		thumbnailUrl: asset.thumbnailUrl,
		width: asset.width,
		height: asset.height,
		duration: asset.duration,
		fps: asset.fps,
		hasAudio: asset.hasAudio,
	};
}

export function instantiateProjectTemplate({
	template,
	resolvedSlotAssets,
}: {
	template: Extract<Template, { kind: "project" }>;
	resolvedSlotAssets: Map<
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
}): InstantiatedProjectTemplate {
	const instantiatedMediaAssets = Array.from(resolvedSlotAssets.entries()).map(
		([slotId, asset]) => buildInstantiatedAsset({ slotId, asset }),
	);
	const replacements = new Map(
		instantiatedMediaAssets.map(
			(asset) => [asset.slotId, asset.assetId] as const,
		),
	);
	const slotBindings: TemplateSlotBinding[] = template.mediaSlots.flatMap(
		(slot) => {
			const instantiatedAsset = instantiatedMediaAssets.find(
				(asset) => asset.slotId === slot.id,
			);
			if (!instantiatedAsset) {
				return [];
			}

			return [
				{
					templateId: template.id,
					templateName: template.name,
					slotId: slot.id,
					slotLabel: slot.label,
					assetId: instantiatedAsset.assetId,
					accept: slot.accept,
				},
			];
		},
	);
	const sceneIdMap = new Map<string, string>();
	const refreshedScenes = template.project.scenes.map((scene) => {
		const typedScene = applyResolvedSlotMediaTypesToScene({
			scene,
			mediaSlots: template.mediaSlots,
			resolvedSlotAssets,
		});
		const refreshedScene = refreshSceneIds(
			replaceMediaIdsInScene({
				scene: typedScene,
				replacements,
			}),
		);
		sceneIdMap.set(scene.id, refreshedScene.id);
		return refreshedScene;
	});
	const currentSceneId =
		sceneIdMap.get(template.project.currentSceneId) ??
		refreshedScenes[0]?.id ??
		"";

	return {
		project: {
			name: template.project.name,
			scenes: refreshedScenes,
			currentSceneId,
			settings: structuredClone(template.project.settings),
			timelineViewState: structuredClone(template.project.timelineViewState),
		},
		mediaAssets: instantiatedMediaAssets,
		slotBindings,
	};
}

export function instantiateSceneTemplate({
	template,
	resolvedSlotAssets,
}: {
	template: Extract<Template, { kind: "scene" }>;
	resolvedSlotAssets: Map<
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
}): InstantiatedSceneTemplate {
	const instantiatedMediaAssets = Array.from(resolvedSlotAssets.entries()).map(
		([slotId, asset]) => buildInstantiatedAsset({ slotId, asset }),
	);
	const replacements = new Map(
		instantiatedMediaAssets.map(
			(asset) => [asset.slotId, asset.assetId] as const,
		),
	);
	const slotBindings: TemplateSlotBinding[] = template.mediaSlots.flatMap(
		(slot) => {
			const instantiatedAsset = instantiatedMediaAssets.find(
				(asset) => asset.slotId === slot.id,
			);
			if (!instantiatedAsset) {
				return [];
			}

			return [
				{
					templateId: template.id,
					templateName: template.name,
					slotId: slot.id,
					slotLabel: slot.label,
					assetId: instantiatedAsset.assetId,
					accept: slot.accept,
				},
			];
		},
	);
	const scene = refreshSceneIds(
		replaceMediaIdsInScene({
			scene: applyResolvedSlotMediaTypesToScene({
				scene: template.scene.scene,
				mediaSlots: template.mediaSlots,
				resolvedSlotAssets,
			}),
			replacements,
		}),
	);

	return {
		scene,
		mediaAssets: instantiatedMediaAssets,
		slotBindings,
	};
}

export function replaceTemplateSlotAssetInScenes({
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
	return scenes.map((scene) => {
		const cloned = structuredClone(scene);

		const replaceTrack = <TTrack extends { elements: TimelineElement[] }>(
			track: TTrack,
		): TTrack => ({
			...track,
			elements: track.elements.map((element) => {
				if (!hasMediaId(element) || element.mediaId !== currentAssetId) {
					return element;
				}

				return updateElementMediaForAsset({
					element,
					mediaId: nextAssetId,
					mediaType: nextMediaType,
					sourceDuration,
				});
			}),
		});

		return {
			...cloned,
			tracks: {
				overlay: cloned.tracks.overlay.map((track) => replaceTrack(track)),
				main: replaceTrack(cloned.tracks.main),
				audio: cloned.tracks.audio.map((track) => replaceTrack(track)),
			},
		};
	});
}

export async function bundleTemplateExport({
	template,
	files,
}: {
	template: Template;
	files: Array<{ id: string; file: File }>;
}): Promise<TemplateExportBundle> {
	const assets = await Promise.all(
		files.map(async ({ id, file }) => ({
			id,
			name: file.name,
			type: file.type,
			lastModified: file.lastModified,
			dataUrl: await fileToDataUrl(file),
		})),
	);

	return {
		schemaVersion: 1,
		template: serializeTemplate(template),
		assets,
	};
}

export function projectTemplateFromExportBundle({
	bundle,
}: {
	bundle: TemplateExportBundle;
}) {
	return deserializeTemplate(bundle.template);
}

export async function fileToDataUrl(file: File): Promise<string> {
	return await new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () =>
			reject(reader.error ?? new Error("Failed to read file"));
		reader.onload = () => {
			if (typeof reader.result !== "string") {
				reject(new Error("Failed to encode file"));
				return;
			}
			resolve(reader.result);
		};
		reader.readAsDataURL(file);
	});
}

export function dataUrlToFile({
	dataUrl,
	name,
	type,
	lastModified,
}: {
	dataUrl: string;
	name: string;
	type: string;
	lastModified: number;
}): File {
	const [header, data] = dataUrl.split(",", 2);
	if (!header || !data) {
		throw new Error("Invalid template asset data");
	}

	const mimeMatch = /data:(.*?);base64/.exec(header);
	const mimeType = mimeMatch?.[1] || type || "application/octet-stream";
	const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
	return new File([bytes], name, {
		type: mimeType,
		lastModified,
	});
}
