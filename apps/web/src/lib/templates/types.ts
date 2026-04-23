import type { MediaType } from "@/lib/media/types";
import type { TProjectSettings, TTimelineViewState } from "@/lib/project/types";
import type { TScene } from "@/lib/timeline";
import type { SerializedScene } from "@/services/storage/types";

export type TemplateKind = "project" | "scene";
export type TemplateSource = "built-in" | "user";
export type SceneTemplateApplyMode = "insert" | "replace-current";

export interface TemplateBoundElementRef {
	sceneId: string;
	trackId: string;
	elementId: string;
}

export interface TemplateMediaSlot {
	id: string;
	label: string;
	accept: MediaType[];
	required: boolean;
	defaultAssetId?: string;
	boundElements: TemplateBoundElementRef[];
}

export interface TemplateAssetMetadata {
	id: string;
	slotId: string;
	name: string;
	type: MediaType;
	size: number;
	lastModified: number;
	width?: number;
	height?: number;
	duration?: number;
	fps?: number;
	hasAudio?: boolean;
	thumbnailUrl?: string;
}

export interface TemplateProjectSnapshot {
	name: string;
	scenes: TScene[];
	currentSceneId: string;
	settings: TProjectSettings;
	timelineViewState?: TTimelineViewState;
}

export interface TemplateSceneSnapshot {
	scene: TScene;
}

interface TemplateBase {
	id: string;
	name: string;
	description: string;
	kind: TemplateKind;
	source: TemplateSource;
	tags: string[];
	locale: string;
	version: number;
	cover?: string;
	createdAt: Date;
	updatedAt: Date;
	mediaSlots: TemplateMediaSlot[];
	assets: TemplateAssetMetadata[];
}

export interface ProjectTemplate extends TemplateBase {
	kind: "project";
	project: TemplateProjectSnapshot;
}

export interface SceneTemplate extends TemplateBase {
	kind: "scene";
	scene: TemplateSceneSnapshot;
}

export type Template = ProjectTemplate | SceneTemplate;

export interface CreateTemplateOptions {
	name: string;
	description?: string;
	includeExampleMedia: boolean;
	locale?: string;
}

export interface TemplateInstantiationAsset {
	slotId: string;
	assetId: string;
	name: string;
	type: MediaType;
	file: File;
	url: string;
	thumbnailUrl?: string;
	width?: number;
	height?: number;
	duration?: number;
	fps?: number;
	hasAudio?: boolean;
}

export interface InstantiatedProjectTemplate {
	project: TemplateProjectSnapshot;
	mediaAssets: TemplateInstantiationAsset[];
}

export interface InstantiatedSceneTemplate {
	scene: TScene;
	mediaAssets: TemplateInstantiationAsset[];
}

export interface TemplateExportAsset {
	id: string;
	name: string;
	type: string;
	lastModified: number;
	dataUrl: string;
}

export interface TemplateExportBundle {
	schemaVersion: 1;
	template: SerializedTemplate;
	assets: TemplateExportAsset[];
}

export interface SerializedTemplateProjectSnapshot {
	name: string;
	scenes: SerializedScene[];
	currentSceneId: string;
	settings: TProjectSettings;
	timelineViewState?: TTimelineViewState;
}

export interface SerializedTemplateSceneSnapshot {
	scene: SerializedScene;
}

interface SerializedTemplateBase
	extends Omit<TemplateBase, "createdAt" | "updatedAt"> {
	createdAt: string;
	updatedAt: string;
}

export interface SerializedProjectTemplate extends SerializedTemplateBase {
	kind: "project";
	project: SerializedTemplateProjectSnapshot;
}

export interface SerializedSceneTemplate extends SerializedTemplateBase {
	kind: "scene";
	scene: SerializedTemplateSceneSnapshot;
}

export type SerializedTemplate =
	| SerializedProjectTemplate
	| SerializedSceneTemplate;
