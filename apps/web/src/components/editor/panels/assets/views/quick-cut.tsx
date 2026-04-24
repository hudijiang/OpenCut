"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TracksSnapshotCommand } from "@/lib/commands/timeline";
import {
	DEFAULT_QUICK_CUT_CONFIG,
	analyzeQuickCuts,
	applyQuickCutSuggestions,
	getAutoCenterSuggestions,
	resolveQuickCutTargets,
	type QuickCutAnalysis,
	type QuickCutConfig,
	type QuickCutScope,
} from "@/lib/quick-cut";
import { TICKS_PER_SECOND } from "@/lib/wasm/ticks";
import { useEditor } from "@/hooks/use-editor";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

function formatSeconds(seconds: number) {
	return `${seconds.toFixed(2)}s`;
}

function formatTicks(time: number) {
	return formatSeconds(time / TICKS_PER_SECOND);
}

export function QuickCutView() {
	const t = useTranslations("quickCut");
	const editor = useEditor();
	const scene = useEditor((instance) => instance.scenes.getActiveSceneOrNull());
	const mediaAssets = useEditor((instance) => instance.media.getAssets());
	const selectedElements = useEditor((instance) =>
		instance.selection.getSelectedElements(),
	);
	const project = useEditor((instance) => instance.project.getActive());
	const [scope, setScope] = useState<QuickCutScope>("selection");
	const [config, setConfig] = useState<QuickCutConfig>(
		DEFAULT_QUICK_CUT_CONFIG,
	);
	const [analysis, setAnalysis] = useState<QuickCutAnalysis | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [isApplying, setIsApplying] = useState(false);
	const [isAutoCentering, setIsAutoCentering] = useState(false);

	const scopeLabel = useMemo(
		() => (scope === "selection" ? t("scope.selection") : t("scope.mainTrack")),
		[scope, t],
	);

	const handleAnalyze = async () => {
		if (!scene) {
			toast.error(t("messages.noScene"));
			return;
		}

		setIsAnalyzing(true);
		try {
			const resolved = await resolveQuickCutTargets({
				scene,
				scope,
				selectedElements,
				mediaAssets,
			});

			if (resolved.targets.length === 0) {
				toast.error(t("messages.noTargets"));
				setAnalysis(null);
				return;
			}

			const nextAnalysis = analyzeQuickCuts({
				scope,
				targets: resolved.targets,
				config,
			});
			nextAnalysis.warnings.push(...resolved.warnings);
			setAnalysis(nextAnalysis);

			if (nextAnalysis.suggestions.length === 0) {
				toast.message(t("messages.noSuggestions"));
			}
		} catch (error) {
			toast.error(t("messages.analysisFailed"), {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setIsAnalyzing(false);
		}
	};

	const handleApply = () => {
		if (!scene || !analysis || analysis.suggestions.length === 0) {
			return;
		}

		setIsApplying(true);
		try {
			const nextTracks = applyQuickCutSuggestions({
				tracks: scene.tracks,
				suggestions: analysis.suggestions,
			});
			const command = new TracksSnapshotCommand(scene.tracks, nextTracks);
			const previousRippleState = editor.command.isRippleEnabled;
			editor.command.isRippleEnabled = false;
			try {
				editor.command.execute({ command });
			} finally {
				editor.command.isRippleEnabled = previousRippleState;
			}
			toast.success(t("messages.applied"), {
				description: t("messages.appliedDescription", {
					count: analysis.suggestions.length,
					duration: formatTicks(analysis.removableDuration),
				}),
			});
		} finally {
			setIsApplying(false);
		}
	};

	const handleAutoCenter = () => {
		if (!scene || !project) {
			toast.error(t("messages.noScene"));
			return;
		}

		setIsAutoCentering(true);
		try {
			const suggestions = getAutoCenterSuggestions({
				scene,
				scope,
				selectedElements,
				mediaAssets,
				canvasSize: project.settings.canvasSize,
			});
			if (suggestions.length === 0) {
				toast.message(t("messages.noCenterSuggestions"));
				return;
			}

			editor.timeline.updateElements({
				updates: suggestions.map((suggestion) => ({
					trackId: suggestion.trackId,
					elementId: suggestion.elementId,
					patch: {
						transform: suggestion.nextTransform,
					},
				})),
			});
			toast.success(t("messages.centerApplied"), {
				description: t("messages.centerAppliedDescription", {
					count: suggestions.length,
				}),
			});
		} finally {
			setIsAutoCentering(false);
		}
	};

	return (
		<PanelView
			title={t("title")}
			contentClassName="space-y-3 pb-4"
			actions={
				<Badge variant="outline" className="mr-1">
					{scopeLabel}
				</Badge>
			}
		>
			<div className="space-y-1 px-1 pb-2">
				<div className="text-sm font-medium">{t("overview.title")}</div>
				<div className="text-xs leading-5 text-muted-foreground">
					{t("overview.description")}
				</div>
			</div>

			<Card className="rounded-xl">
				<CardContent className="space-y-4 p-4">
					<div className="space-y-2">
						<Label>{t("scope.label")}</Label>
						<Select
							value={scope}
							onValueChange={(value) => setScope(value as QuickCutScope)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="selection">
									{t("scope.selection")}
								</SelectItem>
								<SelectItem value="main-track">
									{t("scope.mainTrack")}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<SliderField
						label={t("controls.threshold")}
						value={config.silenceThreshold}
						min={0.005}
						max={0.12}
						step={0.005}
						displayValue={config.silenceThreshold.toFixed(3)}
						onChange={(value) =>
							setConfig((current) => ({
								...current,
								silenceThreshold: value,
							}))
						}
					/>
					<SliderField
						label={t("controls.minSilence")}
						value={config.minSilenceDuration}
						min={0.1}
						max={1}
						step={0.05}
						displayValue={formatSeconds(config.minSilenceDuration)}
						onChange={(value) =>
							setConfig((current) => ({
								...current,
								minSilenceDuration: value,
							}))
						}
					/>
					<SliderField
						label={t("controls.keepPadding")}
						value={config.keepPadding}
						min={0}
						max={0.2}
						step={0.01}
						displayValue={formatSeconds(config.keepPadding)}
						onChange={(value) =>
							setConfig((current) => ({
								...current,
								keepPadding: value,
							}))
						}
					/>

					<div className="flex flex-col gap-2">
						<Button onClick={() => void handleAnalyze()} disabled={isAnalyzing}>
							{isAnalyzing ? t("actions.analyzing") : t("actions.analyze")}
						</Button>
						<Button
							variant="outline"
							onClick={handleApply}
							disabled={
								isApplying || !analysis || analysis.suggestions.length === 0
							}
						>
							{isApplying ? t("actions.applying") : t("actions.apply")}
						</Button>
						<Button
							variant="outline"
							onClick={handleAutoCenter}
							disabled={isAutoCentering}
						>
							{isAutoCentering
								? t("actions.centering")
								: t("actions.autoCenter")}
						</Button>
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-2 gap-3">
				<StatCard
					label={t("stats.targets")}
					value={`${analysis?.targets.length ?? 0}`}
				/>
				<StatCard
					label={t("stats.suggestions")}
					value={`${analysis?.suggestions.length ?? 0}`}
				/>
				<StatCard
					label={t("stats.removable")}
					value={formatTicks(analysis?.removableDuration ?? 0)}
				/>
				<StatCard label={t("stats.scope")} value={scopeLabel} />
			</div>

			{analysis?.warnings.length ? (
				<Card className="rounded-xl border-amber-200 bg-amber-50/70">
					<CardContent className="space-y-2 p-4">
						<div className="text-sm font-medium text-amber-950">
							{t("warnings.title")}
						</div>
						{analysis.warnings.map((warning) => (
							<div key={warning} className="text-xs leading-5 text-amber-900">
								{warning}
							</div>
						))}
					</CardContent>
				</Card>
			) : null}

			<Card className="rounded-xl">
				<CardContent className="space-y-3 p-4">
					<div className="flex items-center justify-between gap-2">
						<div className="text-sm font-medium">{t("suggestions.title")}</div>
						<Badge variant="outline">
							{t("suggestions.count", {
								count: analysis?.suggestions.length ?? 0,
							})}
						</Badge>
					</div>

					{analysis?.suggestions.length ? (
						<div className="space-y-2">
							{analysis.suggestions.map((suggestion) => (
								<div
									key={suggestion.id}
									className="rounded-lg border border-border/70 bg-muted/[0.18] p-3"
								>
									<div className="flex items-center justify-between gap-2">
										<div className="text-sm font-medium">
											{suggestion.elementName}
										</div>
										<Badge variant="secondary">
											{formatTicks(suggestion.duration)}
										</Badge>
									</div>
									<div className="mt-1 text-xs text-muted-foreground">
										{t("suggestions.range", {
											start: formatTicks(suggestion.timelineStartTime),
											end: formatTicks(suggestion.timelineEndTime),
										})}
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-xs leading-5 text-muted-foreground">
							{t("suggestions.empty")}
						</div>
					)}
				</CardContent>
			</Card>
		</PanelView>
	);
}

function SliderField({
	label,
	value,
	min,
	max,
	step,
	displayValue,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	displayValue: string;
	onChange: (value: number) => void;
}) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<Label>{label}</Label>
				<span className="text-xs text-muted-foreground">{displayValue}</span>
			</div>
			<Slider
				value={[value]}
				min={min}
				max={max}
				step={step}
				onValueChange={(values) => onChange(values[0] ?? value)}
			/>
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<Card className="rounded-xl">
			<CardContent className="space-y-1 p-3">
				<div className="text-xs text-muted-foreground">{label}</div>
				<div className="text-sm font-medium">{value}</div>
			</CardContent>
		</Card>
	);
}
