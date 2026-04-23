"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useEditor } from "@/hooks/use-editor";
import { templateService } from "@/services/templates/service";
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
import { Textarea } from "@/components/ui/textarea";

export function SaveTemplateDialog({
	open,
	onOpenChange,
	target,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	target: "project" | "scene";
}) {
	const t = useTranslations("templates");
	const editor = useEditor();
	const activeProject = useEditor((instance) =>
		instance.project.getActiveOrNull(),
	);
	const activeScene = useEditor((instance) =>
		instance.scenes.getActiveSceneOrNull(),
	);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [includeExampleMedia, setIncludeExampleMedia] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (!open) return;

		setDescription("");
		setIncludeExampleMedia(true);
		setName(
			target === "project"
				? activeProject?.metadata.name || t("defaults.projectName")
				: activeScene?.name || t("defaults.sceneName"),
		);
	}, [activeProject?.metadata.name, activeScene?.name, open, t, target]);

	const handleSave = async () => {
		if (!activeProject || (target === "scene" && !activeScene)) {
			toast.error(t("errors.missingContext"));
			return;
		}

		if (!name.trim()) {
			toast.error(t("errors.nameRequired"));
			return;
		}

		setIsSaving(true);
		try {
			if (target === "project") {
				await templateService.saveProjectTemplate({
					project: activeProject,
					mediaAssets: editor.media.getAssets(),
					options: {
						name: name.trim(),
						description,
						includeExampleMedia,
					},
				});
			} else {
				const scene = activeScene;
				if (!scene) {
					throw new Error(t("errors.missingContext"));
				}
				await templateService.saveSceneTemplate({
					scene,
					cover: activeProject.metadata.thumbnail,
					mediaAssets: editor.media.getAssets(),
					options: {
						name: name.trim(),
						description,
						includeExampleMedia,
					},
				});
			}

			toast.success(
				target === "project"
					? t("success.projectSaved")
					: t("success.sceneSaved"),
			);
			onOpenChange(false);
		} catch (error) {
			toast.error(t("errors.saveFailed"), {
				description:
					error instanceof Error ? error.message : t("errors.tryAgain"),
			});
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{target === "project"
							? t("saveProject.title")
							: t("saveScene.title")}
					</DialogTitle>
					<DialogDescription>
						{target === "project"
							? t("saveProject.description")
							: t("saveScene.description")}
					</DialogDescription>
				</DialogHeader>

				<DialogBody className="gap-4">
					<div className="space-y-2">
						<Label htmlFor={`template-name-${target}`}>
							{t("fields.name")}
						</Label>
						<Input
							id={`template-name-${target}`}
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder={t("fields.namePlaceholder")}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`template-description-${target}`}>
							{t("fields.description")}
						</Label>
						<Textarea
							id={`template-description-${target}`}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							rows={4}
							placeholder={t("fields.descriptionPlaceholder")}
						/>
					</div>

					<label className="flex items-start gap-3 rounded-md border p-3 text-sm">
						<input
							type="checkbox"
							className="mt-0.5"
							checked={includeExampleMedia}
							onChange={(event) => setIncludeExampleMedia(event.target.checked)}
						/>
						<div className="space-y-1">
							<div className="font-medium">
								{t("fields.includeExampleMedia")}
							</div>
							<p className="text-muted-foreground">
								{t("fields.includeExampleMediaHint")}
							</p>
						</div>
					</label>
				</DialogBody>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t("actions.cancel")}
					</Button>
					<Button onClick={handleSave} disabled={isSaving}>
						{isSaving
							? t("actions.saving")
							: target === "project"
								? t("actions.saveProject")
								: t("actions.saveScene")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
