"use client";

import Image from "next/image";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { useEditor } from "@/hooks/use-editor";
import type { MediaAsset, MediaType } from "@/lib/media/types";
import { useAssetsPanelStore } from "@/stores/assets-panel-store";
import { cn } from "@/utils/ui";

function buildAcceptAttribute(types: MediaType[]) {
	return types
		.map((type) => {
			switch (type) {
				case "image":
					return "image/*";
				case "video":
					return "video/*";
				case "audio":
					return "audio/*";
				default:
					return "";
			}
		})
		.filter(Boolean)
		.join(",");
}

function getMediaTypeLabel({
	t,
	type,
}: {
	t: (
		key: "mediaTypes.image" | "mediaTypes.video" | "mediaTypes.audio",
	) => string;
	type: MediaType;
}) {
	switch (type) {
		case "image":
			return t("mediaTypes.image");
		case "video":
			return t("mediaTypes.video");
		case "audio":
			return t("mediaTypes.audio");
	}
}

export function TemplateAssetsView() {
	const t = useTranslations("assetPanel.templateAssets");
	const editor = useEditor();
	const mediaAssets = useEditor((instance) => instance.media.getAssets());
	const templateInstance = useEditor((instance) =>
		instance.project.getTemplateInstance(),
	);
	const { requestRevealMedia } = useAssetsPanelStore();
	const inputRef = useRef<HTMLInputElement>(null);
	const [pendingSlotId, setPendingSlotId] = useState<string | null>(null);
	const [pendingAccept, setPendingAccept] = useState("image/*,video/*,audio/*");
	const [isReplacingSlotId, setIsReplacingSlotId] = useState<string | null>(
		null,
	);

	const mediaById = useMemo(
		() => new Map(mediaAssets.map((asset) => [asset.id, asset] as const)),
		[mediaAssets],
	);

	const handleReplaceClick = ({
		slotId,
		accept,
	}: {
		slotId: string;
		accept: MediaType[];
	}) => {
		setPendingSlotId(slotId);
		setPendingAccept(buildAcceptAttribute(accept));
		inputRef.current?.click();
	};

	const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		const slotId = pendingSlotId;
		event.target.value = "";

		if (!file || !slotId) {
			return;
		}

		setIsReplacingSlotId(slotId);
		try {
			await editor.project.replaceTemplateSlotAsset({
				slotId,
				file,
			});
			toast.success(t("replaceSuccess"));
		} catch (error) {
			console.error("Failed to replace template slot asset:", error);
			toast.error(t("replaceFailed"), {
				description:
					error instanceof Error
						? error.message
						: t("replaceFailedDescription"),
			});
		} finally {
			setIsReplacingSlotId(null);
			setPendingSlotId(null);
		}
	};

	if (!templateInstance) {
		return (
			<PanelView title={t("title")}>
				<TemplateEmptyState
					title={t("noTemplateProjectTitle")}
					description={t("noTemplateProjectDescription")}
				/>
			</PanelView>
		);
	}

	if (templateInstance.slotBindings.length === 0) {
		return (
			<PanelView title={t("title")}>
				<TemplateEmptyState
					title={t("emptyTitle")}
					description={t("emptyDescription")}
				/>
			</PanelView>
		);
	}

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept={pendingAccept}
				className="hidden"
				onChange={handleFileChange}
			/>

			<PanelView
				title={t("title")}
				contentClassName="space-y-3 pb-4"
				actions={
					<Badge variant="outline" className="mr-1">
						{t("slotCount", { count: templateInstance.slotBindings.length })}
					</Badge>
				}
			>
				<div className="px-1 pb-2">
					<div className="text-foreground text-sm font-medium">
						{templateInstance.templateName}
					</div>
					<div className="text-muted-foreground text-xs leading-relaxed">
						{t("description")}
					</div>
				</div>

				{templateInstance.slotBindings.map((binding) => {
					const asset = mediaById.get(binding.assetId);
					const acceptedTypes = binding.accept
						.map((type) => getMediaTypeLabel({ t, type }))
						.join(" / ");
					const isReplacing = isReplacingSlotId === binding.slotId;

					return (
						<Card key={binding.slotId} className="rounded-xl">
							<CardContent className="space-y-4 p-4">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0 space-y-1">
										<div className="text-sm font-medium">
											{binding.slotLabel}
										</div>
										<div className="text-muted-foreground text-xs">
											{t("accepts", { types: acceptedTypes })}
										</div>
									</div>
									<Badge variant="outline">{t("slot")}</Badge>
								</div>

								<div className="flex items-center gap-3">
									<AssetPreview asset={asset} />
									<div className="min-w-0 flex-1 space-y-1">
										<div
											className="text-sm font-medium truncate"
											title={asset?.name ?? t("missingAsset")}
										>
											{asset?.name ?? t("missingAsset")}
										</div>
										<div className="text-muted-foreground text-xs">
											{asset
												? getMediaTypeLabel({ t, type: asset.type })
												: t("missingAssetHint")}
										</div>
									</div>
								</div>

								<div className="flex items-center gap-2">
									<Button
										size="sm"
										onClick={() =>
											handleReplaceClick({
												slotId: binding.slotId,
												accept: binding.accept,
											})
										}
										disabled={isReplacing}
									>
										{isReplacing ? t("replacing") : t("replace")}
									</Button>
									<Button
										size="sm"
										variant="outline"
										onClick={() => requestRevealMedia(binding.assetId)}
									>
										{t("reveal")}
									</Button>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</PanelView>
		</>
	);
}

function AssetPreview({ asset }: { asset?: MediaAsset }) {
	const source = asset?.thumbnailUrl ?? asset?.url;

	if (source) {
		return (
			<div className="bg-muted relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border">
				<Image
					src={source}
					alt={asset?.name ?? "Template asset"}
					fill
					unoptimized
					sizes="96px"
					className="object-cover"
				/>
			</div>
		);
	}

	return (
		<div className="bg-muted text-muted-foreground flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border text-xs">
			{asset?.type ?? "media"}
		</div>
	);
}

function TemplateEmptyState({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div
			className={cn(
				"border-border bg-muted/30 flex h-full min-h-48 items-center justify-center rounded-xl border border-dashed px-6 text-center",
			)}
		>
			<div className="max-w-xs space-y-2">
				<div className="text-sm font-medium">{title}</div>
				<div className="text-muted-foreground text-sm leading-relaxed">
					{description}
				</div>
			</div>
		</div>
	);
}
