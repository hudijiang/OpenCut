"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMessages, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useEditor } from "@/hooks/use-editor";
import { templateService } from "@/services/templates/service";
import type { SceneTemplateApplyMode, Template } from "@/lib/templates/types";
import { downloadBlob } from "@/utils/browser";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

type TemplateLibraryDialogProps =
	| {
			open: boolean;
			onOpenChange: (open: boolean) => void;
			kind: "project";
			onProjectCreated: (projectId: string) => void;
	  }
	| {
			open: boolean;
			onOpenChange: (open: boolean) => void;
			kind: "scene";
			mode: SceneTemplateApplyMode;
	  };

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

function toInputAccept(types: string[]) {
	return types
		.map((type) => ACCEPT_BY_TYPE[type as keyof typeof ACCEPT_BY_TYPE] ?? type)
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

export function TemplateLibraryDialog(props: TemplateLibraryDialogProps) {
	const t = useTranslations("templates");
	const messages = useMessages() as {
		templates?: {
			builtIn?: BuiltInTemplateMessages;
		};
	};
	const builtInMessages = messages.templates?.builtIn ?? {};
	const editor = useEditor();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [templates, setTemplates] = useState<Template[]>([]);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
		null,
	);
	const [slotFiles, setSlotFiles] = useState<Record<string, File | null>>({});
	const [projectName, setProjectName] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isApplying, setIsApplying] = useState(false);

	const loadTemplates = useCallback(async () => {
		setIsLoading(true);
		try {
			const nextTemplates = (await templateService.listTemplates()).filter(
				(template) => template.kind === props.kind,
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
	}, [props.kind, t]);

	useEffect(() => {
		if (!props.open) return;
		void loadTemplates();
	}, [loadTemplates, props.open]);

	const selectedTemplate = useMemo(
		() =>
			templates.find((template) => template.id === selectedTemplateId) ?? null,
		[selectedTemplateId, templates],
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
		(types: string[]) =>
			types
				.map((type) => builtInMessages.mediaTypes?.[type] ?? type)
				.join(", "),
		[builtInMessages.mediaTypes],
	);

	useEffect(() => {
		setSlotFiles({});
		if (props.kind === "project") {
			setProjectName(selectedTemplate ? getTemplateName(selectedTemplate) : "");
		}
	}, [getTemplateName, props.kind, selectedTemplate]);

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
			if (props.kind === "project") {
				const instantiated = await templateService.instantiateProject({
					templateId: selectedTemplate.id,
					slotFiles,
				});
				const projectId = await editor.project.createProjectFromTemplate({
					project: instantiated.project,
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
				props.onProjectCreated(projectId);
			} else {
				const instantiated = await templateService.instantiateScene({
					templateId: selectedTemplate.id,
					slotFiles,
				});
				await editor.scenes.applyTemplateScene({
					scene: instantiated.scene,
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
					mode: props.mode,
				});
			}

			props.onOpenChange(false);
			toast.success(
				props.kind === "project"
					? t("success.projectCreated")
					: props.mode === "insert"
						? t("success.sceneInserted")
						: t("success.sceneReplaced"),
			);
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
		<Dialog open={props.open} onOpenChange={props.onOpenChange}>
			<DialogContent className="grid max-h-[90vh] max-w-[min(96vw,80rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
				<DialogHeader>
					<DialogTitle>
						{props.kind === "project"
							? t("library.projectTitle")
							: props.mode === "insert"
								? t("library.sceneInsertTitle")
								: t("library.sceneReplaceTitle")}
					</DialogTitle>
					<DialogDescription>
						{props.kind === "project"
							? t("library.projectDescription")
							: t("library.sceneDescription")}
					</DialogDescription>
				</DialogHeader>

				<DialogBody className="min-h-0 gap-5 overflow-hidden">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="text-muted-foreground text-sm">
							{t("library.templateCount", { count: templates.length })}
						</p>
						<div className="flex items-center gap-2">
							<input
								ref={fileInputRef}
								type="file"
								accept="application/json"
								className="hidden"
								onChange={(event) => {
									const file = event.target.files?.[0];
									if (!file) return;
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
						</div>
					</div>

					<div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
						<div className="min-h-0">
							<ScrollArea className="max-h-[38vh] pr-2 xl:h-full xl:max-h-none">
								<div className="space-y-3">
									{isLoading ? (
										<div className="text-muted-foreground rounded-lg border p-6 text-sm">
											{t("states.loading")}
										</div>
									) : templates.length === 0 ? (
										<div className="text-muted-foreground rounded-lg border p-6 text-sm">
											{t("states.empty")}
										</div>
									) : (
										templates.map((template) => {
											const isSelected = template.id === selectedTemplateId;
											const templateName = getTemplateName(template);
											const templateDescription =
												getTemplateDescription(template);
											return (
												<div
													key={template.id}
													className={cn(
														"w-full rounded-lg border p-4 text-left transition-colors",
														isSelected
															? "border-primary bg-primary/5"
															: "hover:bg-accent/40",
													)}
												>
													<button
														type="button"
														onClick={() => setSelectedTemplateId(template.id)}
														className="w-full text-left"
													>
														<div className="space-y-1">
															<div className="flex flex-wrap items-center gap-2">
																<h3 className="font-medium">{templateName}</h3>
																<span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
																	{template.source === "built-in"
																		? t("badges.builtIn")
																		: t("badges.user")}
																</span>
															</div>
															<p className="text-muted-foreground text-sm">
																{templateDescription ||
																	t("states.noDescription")}
															</p>
															<p className="text-muted-foreground text-xs">
																{t("library.slotCount", {
																	count: template.mediaSlots.length,
																})}
															</p>
														</div>
													</button>

													{template.source === "user" ? (
														<div className="mt-3 flex items-center gap-2">
															<Button
																size="sm"
																variant="outline"
																onClick={() =>
																	void handleExportTemplate(
																		template.id,
																		template.name,
																	)
																}
															>
																{t("actions.export")}
															</Button>
															<Button
																size="sm"
																variant="outline"
																onClick={() =>
																	void handleDeleteTemplate(template.id)
																}
															>
																{t("actions.delete")}
															</Button>
														</div>
													) : null}
												</div>
											);
										})
									)}
								</div>
							</ScrollArea>
						</div>

						<div className="min-h-0 rounded-lg border p-4">
							<ScrollArea className="max-h-[32vh] pr-2 xl:h-full xl:max-h-none">
								{selectedTemplate ? (
									<div className="space-y-4">
										<div className="space-y-1">
											<h3 className="font-medium">
												{getTemplateName(selectedTemplate)}
											</h3>
											<p className="text-muted-foreground text-sm">
												{getTemplateDescription(selectedTemplate) ||
													t("states.noDescription")}
											</p>
										</div>

										{props.kind === "project" ? (
											<div className="space-y-2">
												<Label htmlFor="template-project-name">
													{t("fields.projectName")}
												</Label>
												<Input
													id="template-project-name"
													value={projectName}
													onChange={(event) =>
														setProjectName(event.target.value)
													}
													placeholder={getTemplateName(selectedTemplate)}
												/>
											</div>
										) : null}

										<div className="space-y-3">
											<h4 className="text-sm font-medium">
												{t("fields.mediaSlots")}
											</h4>
											{missingRequiredSlots.length > 0 ? (
												<p className="text-sm text-amber-600 dark:text-amber-400">
													{t("states.missingRequiredSlots", {
														count: missingRequiredSlots.length,
													})}
												</p>
											) : null}
											{selectedTemplate.mediaSlots.length === 0 ? (
												<p className="text-muted-foreground text-sm">
													{t("states.noSlots")}
												</p>
											) : (
												selectedTemplate.mediaSlots.map((slot) => (
													<div key={slot.id} className="space-y-2">
														<div className="flex items-center justify-between gap-2">
															<Label htmlFor={`slot-${slot.id}`}>
																{getSlotLabel(slot.id, slot.label)}
															</Label>
															<span className="text-muted-foreground text-xs">
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
															<p className="text-muted-foreground text-xs">
																{t("states.autoFilledSlot")}
															</p>
														) : null}
														<Input
															id={`slot-${slot.id}`}
															type="file"
															accept={toInputAccept(slot.accept)}
															onChange={(event) =>
																setSlotFiles((current) => ({
																	...current,
																	[slot.id]: event.target.files?.[0] ?? null,
																}))
															}
														/>
														<p className="text-muted-foreground text-xs">
															{getAcceptedMediaLabel(slot.accept)}
														</p>
													</div>
												))
											)}
										</div>
									</div>
								) : (
									<div className="text-muted-foreground text-sm">
										{t("states.selectTemplate")}
									</div>
								)}
							</ScrollArea>
						</div>
					</div>
				</DialogBody>

				<DialogFooter>
					<Button variant="outline" onClick={() => props.onOpenChange(false)}>
						{t("actions.cancel")}
					</Button>
					<Button
						onClick={() => void handleApply()}
						disabled={
							!selectedTemplate || isApplying || missingRequiredSlots.length > 0
						}
					>
						{isApplying
							? t("actions.applying")
							: props.kind === "project"
								? t("actions.createProject")
								: props.mode === "insert"
									? t("actions.insertScene")
									: t("actions.replaceScene")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
