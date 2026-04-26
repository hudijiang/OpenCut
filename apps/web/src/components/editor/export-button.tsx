"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TransitionTopIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/ui";
import {
	getExportMimeType,
	getExportFileExtension,
	downloadBuffer,
} from "@/lib/export";
import { Check, Copy, Download, RotateCcw } from "lucide-react";
import {
	EXPORT_FORMAT_VALUES,
	EXPORT_QUALITY_VALUES,
	EXPORT_RESOLUTION_VALUES,
	type ExportFormat,
	type ExportQuality,
	type ExportResolution,
} from "@/lib/export";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/section";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_EXPORT_OPTIONS } from "@/lib/export/defaults";
import type { MediaAsset } from "@/lib/media/types";
import type { TBackground } from "@/lib/project/types";
import {
	canElementHaveAudio,
	hasMediaId,
} from "@/lib/timeline/element-utils";
import type { SceneTracks, TimelineTrack } from "@/lib/timeline/types";

type ExportPreflightIssue = {
	severity: "error" | "warning";
	message: string;
};

function isExportFormat(value: string): value is ExportFormat {
	return EXPORT_FORMAT_VALUES.some((formatValue) => formatValue === value);
}

function isExportQuality(value: string): value is ExportQuality {
	return EXPORT_QUALITY_VALUES.some((qualityValue) => qualityValue === value);
}

function isExportResolution(value: string): value is ExportResolution {
	return EXPORT_RESOLUTION_VALUES.some(
		(resolutionValue) => resolutionValue === value,
	);
}

export function ExportButton() {
	const t = useTranslations("editor.export");
	const [isExportPopoverOpen, setIsExportPopoverOpen] = useState(false);
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActiveOrNull());
	const hasProject = !!activeProject;

	const handlePopoverOpenChange = ({ open }: { open: boolean }) => {
		if (!open) {
			editor.project.cancelExport();
			editor.project.clearExportState();
		}
		setIsExportPopoverOpen(open);
	};

	return (
		<Popover
			open={isExportPopoverOpen}
			onOpenChange={(open) => handlePopoverOpenChange({ open })}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex items-center gap-1.5 rounded-md bg-[#38BDF8] px-[0.12rem] py-[0.12rem] text-white",
						hasProject ? "cursor-pointer" : "cursor-not-allowed opacity-50",
					)}
					onClick={hasProject ? () => setIsExportPopoverOpen(true) : undefined}
					disabled={!hasProject}
					onKeyDown={(event) => {
						if (hasProject && (event.key === "Enter" || event.key === " ")) {
							event.preventDefault();
							setIsExportPopoverOpen(true);
						}
					}}
				>
					<div className="relative flex items-center gap-1.5 rounded-[0.6rem] bg-linear-270 from-[#2567EC] to-[#37B6F7] px-4 py-1 shadow-[0_1px_3px_0px_rgba(0,0,0,0.65)]">
						<HugeiconsIcon icon={TransitionTopIcon} className="z-50 size-3.5" />
						<span className="z-50 text-[0.875rem]">{t("button")}</span>
						<div className="absolute top-0 left-0 z-10 flex size-full items-center justify-center rounded-[0.6rem] bg-linear-to-t from-white/0 to-white/50">
							<div className="absolute top-[0.08rem] z-50 h-[calc(100%-2px)] w-[calc(100%-2px)] rounded-[0.6rem] bg-linear-270 from-[#2567EC] to-[#37B6F7]"></div>
						</div>
					</div>
				</button>
			</PopoverTrigger>
			{hasProject && (
				<ExportPopover
					onOpenChange={setIsExportPopoverOpen}
					title={t("popoverTitle")}
					progressTitle={t("popoverTitleProgress")}
					formatLabel={t("format")}
					formatMp4={t("formatMp4")}
					formatWebm={t("formatWebm")}
					qualityLabel={t("quality")}
					qualityLow={t("qualityLow")}
					qualityMedium={t("qualityMedium")}
					qualityHigh={t("qualityHigh")}
					qualityVeryHigh={t("qualityVeryHigh")}
					audioLabel={t("audio")}
					includeAudioLabel={t("includeAudio")}
					exportLabel={t("button")}
					unknownError={t("unknownError")}
				/>
			)}
		</Popover>
	);
}

function ExportPopover({
	onOpenChange,
	title,
	progressTitle,
	formatLabel,
	formatMp4,
	formatWebm,
	qualityLabel,
	qualityLow,
	qualityMedium,
	qualityHigh,
	qualityVeryHigh,
	audioLabel,
	includeAudioLabel,
	exportLabel,
	unknownError,
}: {
	onOpenChange: (open: boolean) => void;
	title: string;
	progressTitle: string;
	formatLabel: string;
	formatMp4: string;
	formatWebm: string;
	qualityLabel: string;
	qualityLow: string;
	qualityMedium: string;
	qualityHigh: string;
	qualityVeryHigh: string;
	audioLabel: string;
	includeAudioLabel: string;
	exportLabel: string;
	unknownError: string;
}) {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const exportState = useEditor((e) => e.project.getExportState());
	const activeScene = useEditor((e) => e.scenes.getActiveScene());
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const totalDuration = useEditor((e) => e.timeline.getTotalDuration());
	const t = useTranslations("editor.export");
	const { isExporting, progress, result: exportResult } = exportState;
	const [format, setFormat] = useState<ExportFormat>(
		DEFAULT_EXPORT_OPTIONS.format,
	);
	const [quality, setQuality] = useState<ExportQuality>(
		DEFAULT_EXPORT_OPTIONS.quality,
	);
	const [resolution, setResolution] = useState<ExportResolution>(
		DEFAULT_EXPORT_OPTIONS.resolution,
	);
	const [bitrateMbps, setBitrateMbps] = useState("");
	const [shouldIncludeAudio, setShouldIncludeAudio] = useState<boolean>(
		DEFAULT_EXPORT_OPTIONS.includeAudio ?? true,
	);
	const parsedBitrateMbps = Number.parseFloat(bitrateMbps);
	const bitrate =
		Number.isFinite(parsedBitrateMbps) && parsedBitrateMbps > 0
			? Math.round(parsedBitrateMbps * 1_000_000)
			: undefined;
	const estimatedFileSize =
		bitrate && activeProject.metadata.duration > 0
			? formatEstimatedBytes({
					bytes: Math.round(
						(bitrate * (activeProject.metadata.duration / 120_000)) / 8,
					),
				})
			: null;
	const preflightIssues = buildExportPreflightIssues({
		tracks: activeScene.tracks,
		mediaAssets,
		duration: totalDuration,
		includeAudio: shouldIncludeAudio,
		background: activeProject.settings.background,
		messages: {
			emptyTimeline: t("preflightEmptyTimeline"),
			missingMedia: (names) => t("preflightMissingMedia", { names }),
			noAudio: t("preflightNoAudio"),
			transparentBackground: t("preflightTransparentBackground"),
		},
	});
	const hasPreflightErrors = preflightIssues.some(
		(issue) => issue.severity === "error",
	);

	const handleExport = async () => {
		if (!activeProject) return;
		if (hasPreflightErrors) return;

		const result = await editor.project.export({
			options: {
				format,
				quality,
				resolution,
				bitrate,
				fps: activeProject.settings.fps,
				includeAudio: shouldIncludeAudio,
			},
		});

		if (result.cancelled) {
			editor.project.clearExportState();
			return;
		}

		if (result.success && result.buffer) {
			downloadBuffer({
				buffer: result.buffer,
				filename: `${activeProject.metadata.name}${getExportFileExtension({ format })}`,
				mimeType: getExportMimeType({ format }),
			});

			editor.project.clearExportState();
			onOpenChange(false);
		}
	};

	const handleCancel = () => {
		editor.project.cancelExport();
	};

	return (
		<PopoverContent className="bg-background mr-4 flex w-80 flex-col p-0">
			{exportResult && !exportResult.success ? (
				<ExportError
					error={exportResult.error || unknownError}
					onRetry={handleExport}
				/>
			) : (
				<>
					<div className="flex items-center justify-between p-3 border-b">
						<h3 className="font-medium text-sm">
							{isExporting ? progressTitle : title}
						</h3>
					</div>

					<div className="flex flex-col gap-4">
						{!isExporting && (
							<>
								<div className="flex flex-col">
									<Section
										collapsible
										defaultOpen={false}
										showTopBorder={false}
									>
										<SectionHeader>
											<SectionTitle>{formatLabel}</SectionTitle>
										</SectionHeader>
										<SectionContent>
											<RadioGroup
												value={format}
												onValueChange={(value) => {
													if (isExportFormat(value)) {
														setFormat(value);
													}
												}}
											>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="mp4" id="mp4" />
													<Label htmlFor="mp4">{formatMp4}</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="webm" id="webm" />
													<Label htmlFor="webm">{formatWebm}</Label>
												</div>
											</RadioGroup>
										</SectionContent>
									</Section>

									<Section collapsible defaultOpen={false}>
										<SectionHeader>
											<SectionTitle>{qualityLabel}</SectionTitle>
										</SectionHeader>
										<SectionContent>
											<RadioGroup
												value={quality}
												onValueChange={(value) => {
													if (isExportQuality(value)) {
														setQuality(value);
													}
												}}
											>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="low" id="low" />
													<Label htmlFor="low">{qualityLow}</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="medium" id="medium" />
													<Label htmlFor="medium">{qualityMedium}</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="high" id="high" />
													<Label htmlFor="high">{qualityHigh}</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="very_high" id="very_high" />
													<Label htmlFor="very_high">{qualityVeryHigh}</Label>
												</div>
											</RadioGroup>
										</SectionContent>
									</Section>

									<Section collapsible defaultOpen={false}>
										<SectionHeader>
											<SectionTitle>{t("resolution")}</SectionTitle>
										</SectionHeader>
										<SectionContent>
											<RadioGroup
												value={resolution}
												onValueChange={(value) => {
													if (isExportResolution(value)) {
														setResolution(value);
													}
												}}
											>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="source" id="source" />
													<Label htmlFor="source">{t("resolutionSource")}</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="720p" id="720p" />
													<Label htmlFor="720p">720p</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="1080p" id="1080p" />
													<Label htmlFor="1080p">1080p</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="2160p" id="2160p" />
													<Label htmlFor="2160p">4K</Label>
												</div>
											</RadioGroup>
										</SectionContent>
									</Section>

									<Section collapsible defaultOpen={false}>
										<SectionHeader>
											<SectionTitle>{t("bitrate")}</SectionTitle>
										</SectionHeader>
										<SectionContent>
											<div className="flex flex-col gap-2">
												<div className="flex items-center gap-2">
													<Input
														inputMode="decimal"
														value={bitrateMbps}
														placeholder={t("bitrateAuto")}
														onChange={(event) =>
															setBitrateMbps(event.target.value)
														}
													/>
													<span className="text-muted-foreground text-xs">
														Mbps
													</span>
												</div>
												{estimatedFileSize ? (
													<p className="text-muted-foreground text-xs">
														{t("estimatedSize", {
															size: estimatedFileSize,
														})}
													</p>
												) : null}
											</div>
										</SectionContent>
									</Section>

									<Section collapsible defaultOpen={false}>
										<SectionHeader>
											<SectionTitle>{audioLabel}</SectionTitle>
										</SectionHeader>
										<SectionContent>
											<div className="flex items-center space-x-2">
												<Checkbox
													id="include-audio"
													checked={shouldIncludeAudio}
													onCheckedChange={(checked) =>
														setShouldIncludeAudio(!!checked)
													}
												/>
												<Label htmlFor="include-audio">
													{includeAudioLabel}
												</Label>
											</div>
										</SectionContent>
									</Section>
								</div>

								<div className="p-3 pt-0">
									<ExportPreflight issues={preflightIssues} />
									<Button
										onClick={handleExport}
										className="mt-3 w-full gap-2"
										disabled={hasPreflightErrors}
									>
										<Download className="size-4" />
										{exportLabel}
									</Button>
								</div>
							</>
						)}

						{isExporting && (
							<div className="space-y-4 p-3">
								<div className="flex flex-col gap-2">
									<div className="flex items-center justify-between text-center">
										<p className="text-muted-foreground text-sm">
											{Math.round(progress * 100)}%
										</p>
										<p className="text-muted-foreground text-sm">100%</p>
									</div>
									<Progress value={progress * 100} className="w-full" />
								</div>

								<Button
									variant="outline"
									className="w-full rounded-md"
									onClick={handleCancel}
								>
									{t("cancel")}
								</Button>
							</div>
						)}
					</div>
				</>
			)}
		</PopoverContent>
	);
}

function ExportPreflight({ issues }: { issues: ExportPreflightIssue[] }) {
	const t = useTranslations("editor.export");
	const hasErrors = issues.some((issue) => issue.severity === "error");
	const hasWarnings = issues.some((issue) => issue.severity === "warning");

	return (
		<div
			className={cn(
				"rounded-md border p-3 text-xs",
				hasErrors
					? "border-destructive/30 bg-destructive/10"
					: hasWarnings
						? "border-amber-500/25 bg-amber-500/10"
						: "border-constructive/25 bg-constructive/10",
			)}
		>
			<p
				className={cn(
					"font-medium",
					hasErrors
						? "text-destructive"
						: hasWarnings
							? "text-amber-700"
							: "text-constructive",
				)}
			>
				{t("preflightTitle")}
			</p>
			{issues.length > 0 ? (
				<ul className="mt-2 space-y-1 text-muted-foreground">
					{issues.map((issue) => (
						<li key={`${issue.severity}-${issue.message}`}>{issue.message}</li>
					))}
				</ul>
			) : (
				<p className="mt-1 text-muted-foreground">{t("preflightPassed")}</p>
			)}
		</div>
	);
}

function formatEstimatedBytes({ bytes }: { bytes: number }): string {
	if (bytes < 1024 * 1024) {
		return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}
	if (bytes < 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function buildExportPreflightIssues({
	tracks,
	mediaAssets,
	duration,
	includeAudio,
	background,
	messages,
}: {
	tracks: SceneTracks;
	mediaAssets: MediaAsset[];
	duration: number;
	includeAudio: boolean;
	background: TBackground;
	messages: {
		emptyTimeline: string;
		missingMedia: (names: string) => string;
		noAudio: string;
		transparentBackground: string;
	};
}): ExportPreflightIssue[] {
	const issues: ExportPreflightIssue[] = [];

	if (duration <= 0) {
		issues.push({ severity: "error", message: messages.emptyTimeline });
	}

	const mediaIds = new Set(mediaAssets.map((asset) => asset.id));
	const missingMediaNames = collectTimelineTracks({ tracks })
		.flatMap((track) =>
			track.elements
				.filter(hasMediaId)
				.filter((element) => !mediaIds.has(element.mediaId))
				.map((element) => element.name),
		)
		.filter((name, index, names) => names.indexOf(name) === index);

	if (missingMediaNames.length > 0) {
		issues.push({
			severity: "error",
			message: messages.missingMedia(missingMediaNames.join(", ")),
		});
	}

	if (includeAudio && !hasTimelineAudio({ tracks, mediaAssets })) {
		issues.push({ severity: "warning", message: messages.noAudio });
	}

	if (isTransparentBackground({ background })) {
		issues.push({
			severity: "warning",
			message: messages.transparentBackground,
		});
	}

	return issues;
}

function collectTimelineTracks({ tracks }: { tracks: SceneTracks }): TimelineTrack[] {
	return [...tracks.overlay, tracks.main, ...tracks.audio];
}

function hasTimelineAudio({
	tracks,
	mediaAssets,
}: {
	tracks: SceneTracks;
	mediaAssets: MediaAsset[];
}): boolean {
	const assetsById = new Map(mediaAssets.map((asset) => [asset.id, asset]));

	for (const track of collectTimelineTracks({ tracks })) {
		if ("muted" in track && track.muted) continue;

		for (const element of track.elements) {
			if (!canElementHaveAudio(element) || element.muted) continue;
			if (element.type === "video") {
				const asset = assetsById.get(element.mediaId);
				if (asset?.hasAudio !== false && element.isSourceAudioEnabled !== false) {
					return true;
				}
				continue;
			}
			if (element.sourceType === "library" || assetsById.has(element.mediaId)) {
				return true;
			}
		}
	}

	return false;
}

function isTransparentBackground({
	background,
}: {
	background: TBackground;
}): boolean {
	if (background.type !== "color") return false;
	const color = background.color.trim().toLowerCase();
	return (
		color === "transparent" ||
		color === "#0000" ||
		color === "#00000000" ||
		color === "rgba(0, 0, 0, 0)" ||
		color === "rgb(0 0 0 / 0%)"
	);
}

function ExportError({
	error,
	onRetry,
}: {
	error: string;
	onRetry: () => void;
}) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(error);
		setCopied(true);
		setTimeout(() => setCopied(false), 1000);
	};

	return (
		<div className="space-y-4 p-3">
			<div className="flex flex-col gap-1.5">
				<p className="text-destructive text-sm font-medium">Export failed</p>
				<p className="text-muted-foreground text-xs">{error}</p>
			</div>

			<div className="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					className="h-8 flex-1 text-xs"
					onClick={handleCopy}
				>
					{copied ? <Check className="text-constructive" /> : <Copy />}
					Copy
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="h-8 flex-1 text-xs"
					onClick={onRetry}
				>
					<RotateCcw />
					Retry
				</Button>
			</div>
		</div>
	);
}
