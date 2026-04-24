"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMessages, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditor } from "@/hooks/use-editor";
import {
	formatTemplateDurationLabel,
	getBuiltInDemoManifest,
	getTemplateAspectRatioLabel,
	getTemplateCoverSource,
	getTemplateDurationSeconds,
	getTemplatePrimaryDemoCredit,
	type BuiltInDemoManifest,
} from "@/lib/templates/presentation";
import type { MediaType } from "@/lib/media/types";
import type { Template } from "@/lib/templates/types";
import {
	applyTemplateUsage,
	buildTemplateDiscoveryMetadata,
	CATEGORY_KEYS,
	getFeaturedTemplates,
	matchesTemplateSearch,
	rankTemplates,
	readTemplateFavorites,
	readTemplateUsage,
	toggleTemplateFavorite,
	writeTemplateFavorites,
	writeTemplateUsage,
	type TemplateCategory,
	type TemplateSort,
	type TemplateSourceFilter,
	type TemplateUsageRecord,
} from "@/lib/templates/discovery";
import { templateService } from "@/services/templates/service";
import { useAssetsPanelStore } from "@/stores/assets-panel-store";
import { downloadBlob } from "@/utils/browser";
import { cn } from "@/utils/ui";

const ACCEPT_BY_TYPE = {
	video: "video/*",
	image: "image/*",
	audio: "audio/*",
} as const;

type BuiltInTemplateMessages = {
	templates?: Record<
		string,
		{
			name?: string;
			description?: string;
		}
	>;
	slots?: Record<string, string>;
	mediaTypes?: Record<string, string>;
};

function toInputAccept(types: MediaType[]) {
	return types
		.map((type) => ACCEPT_BY_TYPE[type] ?? type)
		.filter(Boolean)
		.join(",");
}

function canAutoFillBuiltInSlot(
	template: Template,
	slot: Template["mediaSlots"][number],
) {
	return (
		template.source === "built-in" &&
		slot.accept.some((type) => type === "video" || type === "image")
	);
}

function getMediaTypeLabel({
	t,
	type,
}: {
	t: (key: "image" | "video" | "audio") => string;
	type: MediaType;
}) {
	switch (type) {
		case "image":
			return t("image");
		case "video":
			return t("video");
		case "audio":
			return t("audio");
	}
}

export function TemplateBrowser({
	onProjectCreated,
}: {
	onProjectCreated: (projectId: string) => void;
}) {
	const t = useTranslations("templates");
	const pageT = useTranslations("pages.projects.templates");
	const messages = useMessages() as {
		templates?: {
			builtIn?: BuiltInTemplateMessages;
		};
	};
	const builtInMessages = messages.templates?.builtIn ?? {};
	const editor = useEditor();
	const { setActiveTab } = useAssetsPanelStore();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [templates, setTemplates] = useState<Template[]>([]);
	const [demoManifest, setDemoManifest] = useState<BuiltInDemoManifest | null>(
		null,
	);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
		null,
	);
	const [slotFiles, setSlotFiles] = useState<Record<string, File | null>>({});
	const [projectName, setProjectName] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [sourceFilter, setSourceFilter] = useState<TemplateSourceFilter>("all");
	const [categoryFilter, setCategoryFilter] = useState<TemplateCategory>("all");
	const [sortBy, setSortBy] = useState<TemplateSort>("recommended");
	const [usage, setUsage] = useState<TemplateUsageRecord>({});
	const [favorites, setFavorites] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isApplying, setIsApplying] = useState(false);

	const loadTemplates = useCallback(async () => {
		setIsLoading(true);
		try {
			const nextTemplates = (await templateService.listTemplates()).filter(
				(template) => template.kind === "project",
			);
			setTemplates(nextTemplates);
			setSelectedTemplateId((current) => {
				if (
					current &&
					nextTemplates.some((template) => template.id === current)
				) {
					return current;
				}
				return nextTemplates[0]?.id ?? null;
			});
		} catch (error) {
			toast.error(t("errors.loadFailed"), {
				description:
					error instanceof Error ? error.message : t("errors.tryAgain"),
			});
		} finally {
			setIsLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void loadTemplates();
		void getBuiltInDemoManifest().then(setDemoManifest);
		setUsage(readTemplateUsage());
		setFavorites(readTemplateFavorites());
	}, [loadTemplates]);

	const getTemplateName = useCallback(
		(template: Template) =>
			template.source === "built-in"
				? (builtInMessages.templates?.[template.id]?.name ?? template.name)
				: template.name,
		[builtInMessages.templates],
	);

	const getTemplateDescription = useCallback(
		(template: Template) =>
			template.source === "built-in"
				? (builtInMessages.templates?.[template.id]?.description ??
					template.description)
				: template.description,
		[builtInMessages.templates],
	);

	const getSlotLabel = useCallback(
		(slotId: string, fallback: string) =>
			builtInMessages.slots?.[slotId] ?? fallback,
		[builtInMessages.slots],
	);

	const getAcceptedMediaLabel = useCallback(
		(types: MediaType[]) =>
			types
				.map(
					(type) =>
						builtInMessages.mediaTypes?.[type] ??
						getMediaTypeLabel({
							t: (key) => pageT(`mediaTypes.${key}`),
							type,
						}),
				)
				.join(", "),
		[builtInMessages.mediaTypes, pageT],
	);

	const visibleTemplates = useMemo(
		() =>
			templates.filter((template) => {
				const templateMeta = buildTemplateDiscoveryMetadata({
					template,
					usage,
					favorites,
				});
				if (sourceFilter !== "all" && template.source !== sourceFilter) {
					return false;
				}

				if (
					categoryFilter !== "all" &&
					templateMeta.category !== categoryFilter
				) {
					return false;
				}

				return matchesTemplateSearch({
					template,
					name: getTemplateName(template),
					description: getTemplateDescription(template),
					searchQuery,
				});
			}),
		[
			categoryFilter,
			favorites,
			getTemplateDescription,
			getTemplateName,
			searchQuery,
			sourceFilter,
			templates,
			usage,
		],
	);

	const templateMetadata = useMemo(
		() =>
			new Map(
				templates.map((template) => [
					template.id,
					buildTemplateDiscoveryMetadata({
						template,
						usage,
						favorites,
					}),
				]),
			),
		[favorites, templates, usage],
	);

	const filteredTemplates = useMemo(
		() =>
			rankTemplates({
				templates: visibleTemplates,
				usage,
				favorites,
				sortBy,
			}),
		[favorites, sortBy, usage, visibleTemplates],
	);

	const featuredTemplates = useMemo(
		() =>
			getFeaturedTemplates({
				templates: visibleTemplates,
				usage,
				favorites,
				limit: 3,
			}),
		[favorites, usage, visibleTemplates],
	);

	const recentTemplates = useMemo(
		() =>
			rankTemplates({
				templates: visibleTemplates,
				usage,
				favorites,
				sortBy: "recent",
			})
				.filter((template) => templateMetadata.get(template.id)?.isRecentlyUsed)
				.slice(0, 4),
		[favorites, templateMetadata, usage, visibleTemplates],
	);

	useEffect(() => {
		if (
			selectedTemplateId &&
			filteredTemplates.some((template) => template.id === selectedTemplateId)
		) {
			return;
		}

		setSelectedTemplateId(filteredTemplates[0]?.id ?? null);
	}, [filteredTemplates, selectedTemplateId]);

	const selectedTemplate = useMemo(
		() =>
			filteredTemplates.find(
				(template) => template.id === selectedTemplateId,
			) ??
			filteredTemplates[0] ??
			null,
		[filteredTemplates, selectedTemplateId],
	);

	const missingRequiredSlots = useMemo(() => {
		if (!selectedTemplate) {
			return [];
		}

		return selectedTemplate.mediaSlots.filter(
			(slot) =>
				slot.required &&
				!slot.defaultAssetId &&
				!slotFiles[slot.id] &&
				!canAutoFillBuiltInSlot(selectedTemplate, slot),
		);
	}, [selectedTemplate, slotFiles]);

	const selectedTemplateCover = useMemo(() => {
		if (!selectedTemplate) {
			return null;
		}

		return getTemplateCoverSource({
			template: selectedTemplate,
			manifest: demoManifest,
		});
	}, [demoManifest, selectedTemplate]);

	useEffect(() => {
		setSlotFiles({});
		setProjectName(selectedTemplate ? getTemplateName(selectedTemplate) : "");
	}, [getTemplateName, selectedTemplate]);

	const handleImportTemplate = async (file: File) => {
		try {
			const importedTemplate = await templateService.importTemplate({ file });
			await loadTemplates();
			setSelectedTemplateId(importedTemplate.id);
			toast.success(t("success.imported"));
		} catch (error) {
			toast.error(t("errors.importFailed"), {
				description:
					error instanceof Error ? error.message : t("errors.tryAgain"),
			});
		}
	};

	const handleExportTemplate = async (templateId: string, name: string) => {
		try {
			const blob = await templateService.exportTemplate({ id: templateId });
			downloadBlob({
				blob,
				filename: `${name.replaceAll(/\s+/g, "-").toLowerCase()}.opencut-template.json`,
			});
		} catch (error) {
			toast.error(t("errors.exportFailed"), {
				description:
					error instanceof Error ? error.message : t("errors.tryAgain"),
			});
		}
	};

	const handleDeleteTemplate = async (templateId: string) => {
		try {
			await templateService.deleteTemplate({ id: templateId });
			await loadTemplates();
			toast.success(t("success.deleted"));
		} catch (error) {
			toast.error(t("errors.deleteFailed"), {
				description:
					error instanceof Error ? error.message : t("errors.tryAgain"),
			});
		}
	};

	const handleFavoriteToggle = (templateId: string) => {
		const nextFavorites = toggleTemplateFavorite({
			templateId,
			favorites,
		});
		setFavorites(nextFavorites);
		writeTemplateFavorites(nextFavorites);
	};

	const handleApply = async () => {
		if (!selectedTemplate) {
			return;
		}

		if (missingRequiredSlots.length > 0) {
			toast.error(t("errors.missingRequiredSlots"), {
				description: missingRequiredSlots
					.map((slot) => getSlotLabel(slot.id, slot.label))
					.join(", "),
			});
			return;
		}

		setIsApplying(true);
		try {
			const instantiated = await templateService.instantiateProject({
				templateId: selectedTemplate.id,
				slotFiles,
			});
			const projectId = await editor.project.createProjectFromTemplate({
				project: instantiated.project,
				templateInstance: {
					templateId: selectedTemplate.id,
					templateName: getTemplateName(selectedTemplate),
					slotBindings: instantiated.slotBindings,
				},
				mediaAssets: instantiated.mediaAssets.map((asset) => ({
					id: asset.assetId,
					name: asset.name,
					type: asset.type,
					file: asset.file,
					url: asset.url,
					thumbnailUrl: asset.thumbnailUrl,
					width: asset.width,
					height: asset.height,
					duration: asset.duration,
					fps: asset.fps,
					hasAudio: asset.hasAudio,
				})),
				name: projectName.trim() || selectedTemplate.name,
			});

			const nextUsage = applyTemplateUsage({
				templateId: selectedTemplate.id,
				usage,
			});
			setUsage(nextUsage);
			writeTemplateUsage(nextUsage);

			setActiveTab("template");
			toast.success(t("success.projectCreated"));
			onProjectCreated(projectId);
		} catch (error) {
			toast.error(t("errors.applyFailed"), {
				description:
					error instanceof Error ? error.message : t("errors.tryAgain"),
			});
		} finally {
			setIsApplying(false);
		}
	};

	return (
		<section
			id="template-browser"
			className="rounded-[28px] border border-border/70 bg-background/95 p-4 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur sm:p-5 lg:p-6"
		>
			<div className="space-y-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="space-y-2">
						<div className="inline-flex items-center rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs font-medium tracking-[0.18em] uppercase">
							{pageT("eyebrow")}
						</div>
						<div className="space-y-2">
							<h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
								{pageT("title")}
							</h2>
							<p className="text-muted-foreground max-w-2xl text-sm leading-6 sm:text-base">
								{pageT("description")}
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<input
							ref={fileInputRef}
							type="file"
							accept="application/json"
							className="hidden"
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (!file) {
									return;
								}
								void handleImportTemplate(file);
								event.currentTarget.value = "";
							}}
						/>
						<Button
							variant="outline"
							onClick={() => fileInputRef.current?.click()}
						>
							{t("actions.import")}
						</Button>
						<div className="rounded-full border border-border/70 bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
							{pageT("count", { count: filteredTemplates.length })}
						</div>
					</div>
				</div>

				<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
					<div className="relative">
						<Input
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder={pageT("searchPlaceholder")}
							className="h-11 rounded-xl border-border/70 bg-muted/30"
						/>
					</div>
					<FilterGroup
						label={pageT("sourceLabel")}
						options={[
							{ value: "all", label: pageT("sources.all") },
							{ value: "built-in", label: pageT("sources.builtIn") },
							{ value: "user", label: pageT("sources.user") },
						]}
						value={sourceFilter}
						onChange={(value) => setSourceFilter(value as TemplateSourceFilter)}
					/>
					<FilterGroup
						label={pageT("sortLabel")}
						options={[
							{
								value: "recommended",
								label: pageT("sort.recommended"),
							},
							{ value: "recent", label: pageT("sort.recent") },
						]}
						value={sortBy}
						onChange={(value) => setSortBy(value as TemplateSort)}
					/>
				</div>

				<ScrollArea className="w-full whitespace-nowrap pb-2">
					<div className="flex gap-2">
						{CATEGORY_KEYS.map((category) => (
							<Button
								key={category}
								variant={categoryFilter === category ? "default" : "outline"}
								className="rounded-full"
								onClick={() => setCategoryFilter(category)}
							>
								{pageT(`categories.${category}`)}
							</Button>
						))}
					</div>
				</ScrollArea>

				{(featuredTemplates.length > 0 || recentTemplates.length > 0) &&
				!searchQuery ? (
					<div className="grid gap-3 lg:grid-cols-2">
						{featuredTemplates.length > 0 ? (
							<DiscoveryShelf
								title={pageT("shelves.recommendedTitle")}
								description={pageT("shelves.recommendedDescription")}
								templates={featuredTemplates}
								favoriteLabel={pageT("badges.favorite")}
								recentLabel={pageT("badges.recent")}
								getTemplateName={getTemplateName}
								getTemplateDescription={getTemplateDescription}
								getQualityLabel={(qualityTier) =>
									pageT(`quality.${qualityTier}`)
								}
								getTemplateMeta={(template) =>
									templateMetadata.get(template.id) ?? null
								}
								onSelect={setSelectedTemplateId}
								selectedTemplateId={selectedTemplate?.id ?? null}
							/>
						) : null}
						{recentTemplates.length > 0 ? (
							<DiscoveryShelf
								title={pageT("shelves.recentTitle")}
								description={pageT("shelves.recentDescription")}
								templates={recentTemplates}
								favoriteLabel={pageT("badges.favorite")}
								recentLabel={pageT("badges.recent")}
								getTemplateName={getTemplateName}
								getTemplateDescription={getTemplateDescription}
								getQualityLabel={(qualityTier) =>
									pageT(`quality.${qualityTier}`)
								}
								getTemplateMeta={(template) =>
									templateMetadata.get(template.id) ?? null
								}
								onSelect={setSelectedTemplateId}
								selectedTemplateId={selectedTemplate?.id ?? null}
							/>
						) : null}
					</div>
				) : null}

				<div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(23rem,0.85fr)]">
					<div className="min-h-0">
						{isLoading ? (
							<div className="rounded-2xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
								{t("states.loading")}
							</div>
						) : filteredTemplates.length === 0 ? (
							<div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
								<div className="space-y-2">
									<h3 className="text-base font-medium">
										{pageT("empty.title")}
									</h3>
									<p className="text-sm text-muted-foreground">
										{pageT("empty.description")}
									</p>
								</div>
							</div>
						) : (
							<div className="grid gap-4 md:grid-cols-2">
								{filteredTemplates.map((template) => {
									const templateName = getTemplateName(template);
									const templateDescription = getTemplateDescription(template);
									const templateMeta =
										templateMetadata.get(template.id) ?? null;
									const templateCover = getTemplateCoverSource({
										template,
										manifest: demoManifest,
									});
									const isSelected = selectedTemplate?.id === template.id;

									return (
										<button
											key={template.id}
											type="button"
											onClick={() => setSelectedTemplateId(template.id)}
											className={cn(
												"group rounded-3xl border text-left transition-all",
												isSelected
													? "border-primary bg-primary/[0.06] shadow-[0_18px_48px_-36px_rgba(37,99,235,0.6)]"
													: "border-border/70 bg-muted/[0.18] hover:border-border hover:bg-muted/[0.3]",
											)}
										>
											<div className="space-y-4 p-3">
												<div className="bg-muted relative aspect-[4/5] overflow-hidden rounded-2xl border border-border/60">
													{templateCover ? (
														<Image
															src={templateCover}
															alt={t("library.previewAlt", {
																name: templateName,
															})}
															fill
															unoptimized
															sizes="(max-width: 768px) 100vw, 320px"
															className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
														/>
													) : (
														<div className="flex size-full items-center justify-center p-5 text-center text-sm font-medium">
															{templateName}
														</div>
													)}
													<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-3">
														<div className="flex items-end justify-between gap-2">
															<div className="space-y-1">
																<div className="inline-flex rounded-full bg-white/14 px-2.5 py-1 text-[11px] font-medium tracking-[0.18em] text-white uppercase">
																	{pageT(
																		`categories.${
																			templateMeta?.category ?? "social"
																		}`,
																	)}
																</div>
																<div className="text-xs font-medium text-white/90">
																	{formatTemplateDurationLabel(
																		getTemplateDurationSeconds(template),
																	)}
																</div>
															</div>
															<div className="rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
																{getTemplateAspectRatioLabel({
																	template,
																	manifest: demoManifest,
																})}
															</div>
														</div>
													</div>
												</div>

												<div className="space-y-2 px-1 pb-1">
													<div className="flex flex-wrap items-center gap-2">
														<h3 className="line-clamp-1 text-base font-medium">
															{templateName}
														</h3>
														<TemplateBadge
															label={
																template.source === "built-in"
																	? t("badges.builtIn")
																	: t("badges.user")
															}
														/>
														{templateMeta?.isFavorite ? (
															<TemplateBadge label={pageT("badges.favorite")} />
														) : null}
														{templateMeta?.isRecommended ? (
															<TemplateBadge
																label={pageT("badges.recommended")}
															/>
														) : null}
														{templateMeta ? (
															<TemplateBadge
																label={pageT(
																	`quality.${templateMeta.qualityTier}`,
																)}
															/>
														) : null}
													</div>
													<p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
														{templateDescription || t("states.noDescription")}
													</p>
													<div className="flex flex-wrap gap-2">
														{template.tags.slice(0, 3).map((tag) => (
															<span
																key={tag}
																className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground"
															>
																{tag}
															</span>
														))}
													</div>
												</div>
											</div>
										</button>
									);
								})}
							</div>
						)}
					</div>

					<Card className="border-border/70 bg-background shadow-none">
						<CardContent className="space-y-5 p-4 sm:p-5">
							{selectedTemplate ? (
								<>
									<div className="bg-muted relative aspect-[4/5] overflow-hidden rounded-2xl border border-border/70">
										{selectedTemplateCover ? (
											<Image
												src={selectedTemplateCover}
												alt={t("library.previewAlt", {
													name: getTemplateName(selectedTemplate),
												})}
												fill
												unoptimized
												sizes="(max-width: 1280px) 100vw, 420px"
												className="object-cover"
											/>
										) : (
											<div className="flex size-full items-center justify-center p-6 text-center text-sm font-medium">
												{getTemplateName(selectedTemplate)}
											</div>
										)}
										<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4">
											<div className="space-y-1">
												<div className="text-sm font-medium text-white">
													{getTemplateName(selectedTemplate)}
												</div>
												<div className="text-xs text-white/80">
													{pageT(
														`categories.${
															templateMetadata.get(selectedTemplate.id)
																?.category ?? "social"
														}`,
													)}
												</div>
											</div>
										</div>
									</div>

									<div className="space-y-2">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div className="flex flex-wrap items-center gap-2">
												<TemplateBadge
													label={
														selectedTemplate.source === "built-in"
															? t("badges.builtIn")
															: t("badges.user")
													}
												/>
												<TemplateBadge label={t("library.projectKind")} />
												{templateMetadata.get(selectedTemplate.id)
													?.isRecommended ? (
													<TemplateBadge label={pageT("badges.recommended")} />
												) : null}
												{templateMetadata.get(selectedTemplate.id)
													?.isRecentlyUsed ? (
													<TemplateBadge label={pageT("badges.recent")} />
												) : null}
											</div>
											<Button
												size="sm"
												variant={
													templateMetadata.get(selectedTemplate.id)?.isFavorite
														? "secondary"
														: "outline"
												}
												onClick={() =>
													handleFavoriteToggle(selectedTemplate.id)
												}
											>
												{templateMetadata.get(selectedTemplate.id)?.isFavorite
													? pageT("actions.removeFavorite")
													: pageT("actions.addFavorite")}
											</Button>
										</div>
										<p className="text-sm leading-6 text-muted-foreground">
											{getTemplateDescription(selectedTemplate) ||
												t("states.noDescription")}
										</p>
									</div>

									<div className="grid gap-3 sm:grid-cols-2">
										<MetaCard
											label={t("library.duration")}
											value={formatTemplateDurationLabel(
												getTemplateDurationSeconds(selectedTemplate),
											)}
										/>
										<MetaCard
											label={t("library.aspectRatio")}
											value={getTemplateAspectRatioLabel({
												template: selectedTemplate,
												manifest: demoManifest,
											})}
										/>
										<MetaCard
											label={t("fields.mediaSlots")}
											value={pageT("slotCountValue", {
												count: selectedTemplate.mediaSlots.length,
											})}
										/>
										<MetaCard
											label={pageT("usageLabel")}
											value={pageT("usageValue", {
												count: usage[selectedTemplate.id]?.count ?? 0,
											})}
										/>
										<MetaCard
											label={pageT("qualityLabel")}
											value={pageT(
												`quality.${
													templateMetadata.get(selectedTemplate.id)
														?.qualityTier ?? "starter"
												}`,
											)}
										/>
										<MetaCard
											label={pageT("routeLabel")}
											value={pageT("routeValue")}
										/>
									</div>

									{selectedTemplate.tags.length > 0 ? (
										<div className="space-y-2">
											<h3 className="text-sm font-medium">
												{t("library.tags")}
											</h3>
											<div className="flex flex-wrap gap-2">
												{selectedTemplate.tags.map((tag) => (
													<span
														key={tag}
														className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
													>
														{tag}
													</span>
												))}
											</div>
										</div>
									) : null}

									{getTemplatePrimaryDemoCredit({
										template: selectedTemplate,
										manifest: demoManifest,
									})?.sourceUrl ? (
										<div className="rounded-2xl border border-border/70 p-4">
											<div className="space-y-2">
												<p className="text-xs text-muted-foreground">
													{t("library.demoAsset")}
												</p>
												<p className="text-sm font-medium">
													{getTemplatePrimaryDemoCredit({
														template: selectedTemplate,
														manifest: demoManifest,
													})?.photographer
														? t("library.byPhotographer", {
																name:
																	getTemplatePrimaryDemoCredit({
																		template: selectedTemplate,
																		manifest: demoManifest,
																	})?.photographer ?? "",
															})
														: t("library.localDemoAsset")}
												</p>
												<a
													href={
														getTemplatePrimaryDemoCredit({
															template: selectedTemplate,
															manifest: demoManifest,
														})?.sourceUrl
													}
													target="_blank"
													rel="noreferrer"
													className="text-sm underline underline-offset-4"
												>
													{t("library.viewSource")}
												</a>
											</div>
										</div>
									) : null}

									<div className="space-y-2">
										<Label htmlFor="template-browser-project-name">
											{t("fields.projectName")}
										</Label>
										<Input
											id="template-browser-project-name"
											value={projectName}
											onChange={(event) => setProjectName(event.target.value)}
											placeholder={getTemplateName(selectedTemplate)}
										/>
									</div>

									<div className="space-y-3">
										<div className="flex items-center justify-between gap-2">
											<h3 className="text-sm font-medium">
												{t("fields.mediaSlots")}
											</h3>
											{missingRequiredSlots.length > 0 ? (
												<span className="text-xs text-amber-600 dark:text-amber-400">
													{t("states.missingRequiredSlots", {
														count: missingRequiredSlots.length,
													})}
												</span>
											) : null}
										</div>
										<div className="space-y-3">
											{selectedTemplate.mediaSlots.map((slot) => (
												<div
													key={slot.id}
													className="rounded-2xl border border-border/70 bg-muted/[0.18] p-3"
												>
													<div className="mb-2 flex items-center justify-between gap-2">
														<Label htmlFor={`browser-slot-${slot.id}`}>
															{getSlotLabel(slot.id, slot.label)}
														</Label>
														<span className="text-xs text-muted-foreground">
															{canAutoFillBuiltInSlot(selectedTemplate, slot)
																? t("fields.autoFilled")
																: slot.required
																	? slot.defaultAssetId
																		? t("fields.optionalWithDefault")
																		: t("fields.required")
																	: t("fields.optional")}
														</span>
													</div>
													{canAutoFillBuiltInSlot(selectedTemplate, slot) ? (
														<p className="mb-2 text-xs text-muted-foreground">
															{t("states.autoFilledSlot")}
														</p>
													) : null}
													<Input
														id={`browser-slot-${slot.id}`}
														type="file"
														accept={toInputAccept(slot.accept)}
														onChange={(event) =>
															setSlotFiles((current) => ({
																...current,
																[slot.id]: event.target.files?.[0] ?? null,
															}))
														}
													/>
													<p className="mt-2 text-xs text-muted-foreground">
														{getAcceptedMediaLabel(slot.accept)}
													</p>
												</div>
											))}
										</div>
									</div>

									{selectedTemplate.source === "user" ? (
										<div className="flex flex-wrap gap-2">
											<Button
												variant="outline"
												onClick={() =>
													void handleExportTemplate(
														selectedTemplate.id,
														selectedTemplate.name,
													)
												}
											>
												{t("actions.export")}
											</Button>
											<Button
												variant="outline"
												onClick={() =>
													void handleDeleteTemplate(selectedTemplate.id)
												}
											>
												{t("actions.delete")}
											</Button>
										</div>
									) : null}

									<Button
										size="lg"
										className="w-full"
										onClick={() => void handleApply()}
										disabled={
											isApplying ||
											!selectedTemplate ||
											missingRequiredSlots.length > 0
										}
									>
										{isApplying
											? t("actions.applying")
											: t("actions.createProject")}
									</Button>
									<p className="text-center text-xs text-muted-foreground">
										{pageT("templateFlowHint")}
									</p>
								</>
							) : (
								<div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
									<div className="space-y-2">
										<h3 className="text-base font-medium">
											{pageT("selectTemplateTitle")}
										</h3>
										<p className="text-sm text-muted-foreground">
											{pageT("selectTemplateDescription")}
										</p>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</section>
	);
}

function FilterGroup({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: Array<{ value: string; label: string }>;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="rounded-2xl border border-border/70 bg-muted/30 p-1">
			<div className="sr-only">{label}</div>
			<div className="flex gap-1">
				{options.map((option) => (
					<Button
						key={option.value}
						variant={value === option.value ? "secondary" : "ghost"}
						className="rounded-xl"
						onClick={() => onChange(option.value)}
					>
						{option.label}
					</Button>
				))}
			</div>
		</div>
	);
}

function MetaCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-border/70 bg-muted/[0.18] p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="text-sm font-medium">{value}</p>
		</div>
	);
}

function TemplateBadge({ label }: { label: string }) {
	return (
		<Badge variant="outline" className="rounded-full text-[11px]">
			{label}
		</Badge>
	);
}

function DiscoveryShelf({
	title,
	description,
	templates,
	favoriteLabel,
	recentLabel,
	getTemplateName,
	getTemplateDescription,
	getQualityLabel,
	getTemplateMeta,
	onSelect,
	selectedTemplateId,
}: {
	title: string;
	description: string;
	templates: Template[];
	favoriteLabel: string;
	recentLabel: string;
	getTemplateName: (template: Template) => string;
	getTemplateDescription: (template: Template) => string;
	getQualityLabel: (
		qualityTier: ReturnType<
			typeof buildTemplateDiscoveryMetadata
		>["qualityTier"],
	) => string;
	getTemplateMeta: (
		template: Template,
	) => ReturnType<typeof buildTemplateDiscoveryMetadata> | null;
	onSelect: (templateId: string) => void;
	selectedTemplateId: string | null;
}) {
	return (
		<div className="rounded-3xl border border-border/70 bg-muted/[0.16] p-4">
			<div className="mb-3 space-y-1">
				<h3 className="text-sm font-medium">{title}</h3>
				<p className="text-xs leading-5 text-muted-foreground">{description}</p>
			</div>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
				{templates.map((template) => {
					const templateMeta = getTemplateMeta(template);

					return (
						<button
							key={template.id}
							type="button"
							onClick={() => onSelect(template.id)}
							className={cn(
								"rounded-2xl border bg-background p-3 text-left transition-colors",
								selectedTemplateId === template.id
									? "border-primary"
									: "border-border/70 hover:border-border",
							)}
						>
							<div className="space-y-2">
								<div className="flex flex-wrap items-center gap-2">
									<p className="line-clamp-1 text-sm font-medium">
										{getTemplateName(template)}
									</p>
									{templateMeta?.isFavorite ? (
										<TemplateBadge label={favoriteLabel} />
									) : null}
								</div>
								<p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
									{getTemplateDescription(template)}
								</p>
								<div className="flex flex-wrap gap-2">
									<TemplateBadge
										label={getQualityLabel(
											templateMeta?.qualityTier ?? "starter",
										)}
									/>
									{templateMeta?.isRecentlyUsed ? (
										<TemplateBadge label={recentLabel} />
									) : null}
									{templateMeta?.usageCount ? (
										<TemplateBadge label={`${templateMeta.usageCount}x`} />
									) : null}
								</div>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
