import type { EditorCore } from "@/core";
import { toast } from "sonner";
import type { MediaAsset } from "@/lib/media/types";
import { storageService } from "@/services/storage/service";
import { generateUUID } from "@/utils/id";
import { videoCache } from "@/services/video-cache/service";
import { waveformCache } from "@/services/waveform-cache/service";
import { BatchCommand, RemoveMediaAssetCommand } from "@/lib/commands";
import type { ProcessedMediaAsset } from "@/lib/media/processing";
import type {
	SceneTracks,
	TimelineElement,
	TimelineTrack,
} from "@/lib/timeline";
import { hasMediaId } from "@/lib/timeline/element-utils";

export class MediaManager {
	private assets: MediaAsset[] = [];
	private isLoading = false;
	private listeners = new Set<() => void>();

	constructor(private editor: EditorCore) {}

	async addMediaAsset({
		projectId,
		asset,
	}: {
		projectId: string;
		asset: Omit<MediaAsset, "id">;
	}): Promise<MediaAsset | null> {
		const newAsset: MediaAsset = {
			...asset,
			id: generateUUID(),
		};

		this.assets = [...this.assets, newAsset];
		this.notify();

		try {
			await storageService.saveMediaAsset({ projectId, mediaAsset: newAsset });
			this.editor.project.ratchetFpsForImportedMedia({
				importedAssets: [newAsset],
			});
			return newAsset;
		} catch (error) {
			console.error("Failed to save media asset:", error);
			this.assets = this.assets.filter((asset) => asset.id !== newAsset.id);
			this.notify();

			if (storageService.isQuotaExceededError({ error })) {
				toast.error("Not enough browser storage", {
					description: error instanceof Error ? error.message : undefined,
				});
			}

			return null;
		}
	}

	async replaceMediaAsset({
		projectId,
		oldId,
		asset,
	}: {
		projectId: string;
		oldId: string;
		asset: ProcessedMediaAsset;
	}): Promise<MediaAsset | null> {
		const existingAsset = this.assets.find(
			(candidate) => candidate.id === oldId,
		);
		if (!existingAsset) {
			toast.error("Media asset not found");
			return null;
		}
		if (existingAsset.type !== asset.type) {
			toast.error("Replacement must use the same media type");
			return null;
		}

		const replacement = await this.addMediaAsset({ projectId, asset });
		if (!replacement) {
			return null;
		}

		const activeSceneId = this.editor.scenes.getActiveSceneOrNull()?.id;
		const nextScenes = this.editor.scenes.getScenes().map((scene) => ({
			...scene,
			tracks: replaceMediaIdInTracks({
				tracks: scene.tracks,
				oldId,
				newId: replacement.id,
			}),
			updatedAt: new Date(),
		}));
		this.editor.scenes.setScenes({ scenes: nextScenes, activeSceneId });

		this.assets = this.assets.filter((candidate) => candidate.id !== oldId);
		this.notify();

		try {
			await storageService.deleteMediaAsset({ projectId, id: oldId });
		} catch (error) {
			console.warn("Failed to delete replaced media asset:", error);
		}

		return replacement;
	}

	removeMediaAsset({ projectId, id }: { projectId: string; id: string }): void {
		this.removeMediaAssets({ projectId, ids: [id] });
	}

	removeMediaAssets({
		projectId,
		ids,
	}: {
		projectId: string;
		ids: string[];
	}): void {
		const uniqueIds = [...new Set(ids)];
		if (uniqueIds.length === 0) {
			return;
		}

		const command =
			uniqueIds.length === 1
				? new RemoveMediaAssetCommand(projectId, uniqueIds[0])
				: new BatchCommand(
						uniqueIds.map((id) => new RemoveMediaAssetCommand(projectId, id)),
					);

		this.editor.command.execute({ command });
	}

	async loadProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		this.isLoading = true;
		this.notify();

		try {
			const mediaAssets = await storageService.loadAllMediaAssets({
				projectId,
			});
			this.assets = mediaAssets;
			this.notify();
		} catch (error) {
			console.error("Failed to load media assets:", error);
		} finally {
			this.isLoading = false;
			this.notify();
		}
	}

	async clearProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		waveformCache.clearAll();

		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		});

		const mediaIds = this.assets.map((asset) => asset.id);
		this.assets = [];
		this.notify();

		try {
			await Promise.all(
				mediaIds.map((id) =>
					storageService.deleteMediaAsset({ projectId, id }),
				),
			);
		} catch (error) {
			console.error("Failed to clear media assets from storage:", error);
		}
	}

	clearAllAssets(): void {
		videoCache.clearAll();
		waveformCache.clearAll();

		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		});

		this.assets = [];
		this.notify();
	}

	getAssets(): MediaAsset[] {
		return this.assets;
	}

	setAssets({ assets }: { assets: MediaAsset[] }): void {
		this.assets = assets;
		this.notify();
	}

	isLoadingMedia(): boolean {
		return this.isLoading;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => {
			fn();
		});
	}
}

function replaceMediaIdInTracks({
	tracks,
	oldId,
	newId,
}: {
	tracks: SceneTracks;
	oldId: string;
	newId: string;
}): SceneTracks {
	const replaceTrack = <TTrack extends TimelineTrack>(track: TTrack): TTrack =>
		({
			...track,
			elements: track.elements.map((element) =>
				replaceMediaIdInElement({ element, oldId, newId }),
			),
		}) as TTrack;

	return {
		overlay: tracks.overlay.map((track) => replaceTrack(track)),
		main: replaceTrack(tracks.main),
		audio: tracks.audio.map((track) => replaceTrack(track)),
	};
}

function replaceMediaIdInElement({
	element,
	oldId,
	newId,
}: {
	element: TimelineElement;
	oldId: string;
	newId: string;
}): TimelineElement {
	if (!hasMediaId(element) || element.mediaId !== oldId) {
		return element;
	}

	return {
		...element,
		mediaId: newId,
	};
}
