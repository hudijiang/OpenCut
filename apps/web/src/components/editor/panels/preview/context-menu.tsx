"use client";

import {
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { usePreviewViewport } from "@/components/editor/panels/preview/preview-viewport";
import { useEditor } from "@/hooks/use-editor";
import { usePreviewStore } from "@/stores/preview-store";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function PreviewContextMenu({
	onToggleFullscreen,
	containerRef,
}: {
	onToggleFullscreen: () => void;
	containerRef: React.RefObject<HTMLElement | null>;
}) {
	const t = useTranslations("preview.contextMenu");
	const editor = useEditor();
	const viewport = usePreviewViewport();
	const { overlays, setOverlayVisibility } = usePreviewStore();

	const handleCopySnapshot = async () => {
		const result = await editor.renderer.copySnapshot();

		if (!result.success) {
			toast.error(t("failedToCopySnapshot"), {
				description: result.error ?? t("tryAgain"),
			});
			return;
		}
	};

	const handleSaveSnapshot = async () => {
		const result = await editor.renderer.saveSnapshot();

		if (!result.success) {
			toast.error(t("failedToSaveSnapshot"), {
				description: result.error ?? t("tryAgain"),
			});
			return;
		}
	};

	return (
		<ContextMenuContent className="w-56" container={containerRef.current}>
			<ContextMenuItem onClick={viewport.fitToScreen} inset>
				{t("fitToScreen")}
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem onClick={onToggleFullscreen} inset>
				{t("fullScreen")}
			</ContextMenuItem>
			<ContextMenuItem onClick={handleSaveSnapshot} inset>
				{t("saveSnapshot")}
			</ContextMenuItem>
			<ContextMenuItem onClick={handleCopySnapshot} inset>
				{t("copySnapshot")}
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuCheckboxItem
				checked={overlays.bookmarks}
				onCheckedChange={(checked) =>
					setOverlayVisibility({ overlay: "bookmarks", isVisible: !!checked })
				}
			>
				{t("showBookmarkNotes")}
			</ContextMenuCheckboxItem>
		</ContextMenuContent>
	);
}
