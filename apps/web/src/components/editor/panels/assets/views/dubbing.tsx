"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useEditor } from "@/hooks/use-editor";
import type {
	DubbingConfig,
	SpeakerDiarization,
	SpeakerSegment,
} from "@/lib/dubbing/types";
import { timelineHasAudio } from "@/lib/media/audio";
import { extractTimelineAudio } from "@/lib/media/mediabunny";
import { processMediaAssets } from "@/lib/media/processing";
import { canTrackHaveAudio } from "@/lib/timeline";
import { buildElementFromMedia } from "@/lib/timeline/element-utils";
import { TICKS_PER_SECOND } from "@/lib/wasm";
import { extractSpeakerAudioSegments } from "@/services/dubbing/diarization";
import {
	audioBufferToMediaFile,
	buildAlignedDubbingSegmentFiles,
} from "@/services/dubbing/mixer";
import { deleteClonedVoice } from "@/services/dubbing/tts";
import {
	AddTrackCommand,
	BatchCommand,
	InsertElementCommand,
	TracksSnapshotCommand,
} from "@/lib/commands";
import {
	DUBBING_OUTPUT_ROLE,
	prepareTracksForDubbingApply,
} from "@/lib/dubbing/timeline";
import {
	DUBBING_CONFIG_STORAGE_KEY,
	useDubbingConfigStore,
} from "@/stores/dubbing-config-store";
import { cn } from "@/utils/ui";

const LANGUAGE_OPTIONS = [
	{ code: "ar" },
	{ code: "de" },
	{ code: "en" },
	{ code: "es" },
	{ code: "fr" },
	{ code: "hi" },
	{ code: "id" },
	{ code: "it" },
	{ code: "ja" },
	{ code: "ko" },
	{ code: "ms" },
	{ code: "nl" },
	{ code: "pl" },
	{ code: "pt" },
	{ code: "ru" },
	{ code: "th" },
	{ code: "tr" },
	{ code: "uk" },
	{ code: "vi" },
	{ code: "zh" },
] as const;

const LANGUAGE_MESSAGE_KEYS = {
	auto: "languages.auto",
	ar: "languages.ar",
	de: "languages.de",
	en: "languages.en",
	es: "languages.es",
	fr: "languages.fr",
	hi: "languages.hi",
	id: "languages.id",
	it: "languages.it",
	ja: "languages.ja",
	ko: "languages.ko",
	ms: "languages.ms",
	nl: "languages.nl",
	pl: "languages.pl",
	pt: "languages.pt",
	ru: "languages.ru",
	th: "languages.th",
	tr: "languages.tr",
	uk: "languages.uk",
	vi: "languages.vi",
	zh: "languages.zh",
} as const;

type ManagedStep = "analysis" | "translation" | "synthesis" | "apply";

type StepStatus = {
	loading: boolean;
	progress: number;
	message: string;
	error: string | null;
};

const IDLE_STEP_STATUS: StepStatus = {
	loading: false,
	progress: 0,
	message: "",
	error: null,
};

const INITIAL_STEP_STATUSES: Record<ManagedStep, StepStatus> = {
	analysis: IDLE_STEP_STATUS,
	translation: IDLE_STEP_STATUS,
	synthesis: IDLE_STEP_STATUS,
	apply: IDLE_STEP_STATUS,
};

const optionalStringSchema = z.preprocess(
	(value) => (value === null ? undefined : value),
	z.string().optional(),
);
const optionalNumberSchema = z.preprocess(
	(value) => (value === null ? undefined : value),
	z.number().optional(),
);
const optionalTranscriptWordsSchema = z.preprocess(
	(value) => (value === null ? undefined : value),
	z.array(z.lazy(() => transcriptWordSchema)).optional(),
);

const transcriptWordSchema = z.object({
	text: z.string(),
	start: z.number(),
	end: z.number(),
	confidence: z.number(),
	speaker: optionalStringSchema,
});

const speakerDiarizationSchema = z.object({
	id: z.string(),
	status: z.enum(["queued", "processing", "completed", "error"]),
	text: optionalStringSchema,
	language_code: optionalStringSchema,
	language_confidence: optionalNumberSchema,
	error: optionalStringSchema,
	words: optionalTranscriptWordsSchema,
	utterances: z
		.preprocess(
			(value) => (value === null ? undefined : value),
			z.array(
				z.object({
					speaker: z.string(),
					start: z.number(),
					end: z.number(),
					text: z.string(),
					confidence: optionalNumberSchema,
					words: optionalTranscriptWordsSchema,
				}),
			).optional(),
		),
});

const transcribeSubmitResponseSchema = z.object({
	transcriptId: z.string().min(1),
});

const transcribeResultResponseSchema = z.object({
	transcript: speakerDiarizationSchema,
});

const translatedSegmentSchema = z.object({
	id: z.string().min(1),
	speakerId: z.string().min(1),
	startTime: z.number(),
	endTime: z.number(),
	text: z.string(),
	translatedText: z.string(),
});

const translateResponseSchema = z.object({
	translatedSegments: z.array(translatedSegmentSchema),
});

const cloneVoiceResponseSchema = z.object({
	speakerId: z.string().min(1),
	voiceId: z.string().min(1),
});

const PERSISTED_CONFIG_SCHEMA = z.object({
	sourceLanguage: z.string().optional(),
	targetLanguage: z.string().optional(),
	assemblyApiKey: z.string().optional(),
	elevenLabsApiKey: z.string().optional(),
	deepSeekApiKey: z.string().optional(),
	openAiApiKey: z.string().optional(),
	synthesisProvider: z.enum(["elevenlabs", "local-xtts"]).optional(),
	localXttsEndpoint: z.string().optional(),
	localXttsVoiceSource: z
		.enum(["single-reference", "auto-speakers", "server-speaker-wav"])
		.optional(),
	localXttsSingleVoiceReferenceSource: z.enum(["upload", "library"]).optional(),
	localXttsRequestFormat: z.enum(["multipart", "json"]).optional(),
	localXttsSpeakerWav: z.string().optional(),
});

function formatTime(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function millisecondsToTicks(milliseconds: number): number {
	return Math.max(0, Math.round((milliseconds / 1000) * TICKS_PER_SECOND));
}

function mapLocalXttsLanguageCode(languageCode: string): string {
	if (languageCode === "zh") {
		return "zh-cn";
	}

	return languageCode;
}

function resolveLocalXttsSpeakerWav({
	template,
	speakerId,
}: {
	template: string;
	speakerId: string;
}): string {
	return (template.trim() || "{speakerId}.wav").replaceAll(
		"{speakerId}",
		speakerId,
	);
}

function resolveLocalXttsRequestFormat({
	voiceSource,
	singleVoiceReferenceSource,
}: {
	voiceSource: DubbingConfig["localXttsVoiceSource"];
	singleVoiceReferenceSource: DubbingConfig["localXttsSingleVoiceReferenceSource"];
}): DubbingConfig["localXttsRequestFormat"] {
	return voiceSource === "single-reference" &&
		singleVoiceReferenceSource === "library"
		? "json"
		: "multipart";
}

function countWords(text: string): number {
	const normalized = text.trim();
	if (normalized.length === 0) {
		return 0;
	}

	return normalized.split(/\s+/).length;
}

function buildSpeakerSegments(
	transcript: SpeakerDiarization,
): SpeakerSegment[] {
	if (transcript.utterances && transcript.utterances.length > 0) {
		const segments: SpeakerSegment[] = [];
		for (const utterance of transcript.utterances) {
			segments.push({
				id: `${utterance.speaker}-${utterance.start}-${utterance.end}`,
				speakerId: utterance.speaker,
				startTime: utterance.start,
				endTime: utterance.end,
				text: utterance.text,
				translatedText: "",
				audioBlob: null,
			});
		}
		return segments;
	}

	const segments: SpeakerSegment[] = [];
	const words = transcript.words ?? [];
	let currentSpeaker = "";
	let currentText = "";
	let currentStart = 0;
	let currentEnd = 0;

	for (const word of words) {
		const nextSpeaker = word.speaker ?? "speaker-1";
		if (currentSpeaker.length === 0) {
			currentSpeaker = nextSpeaker;
			currentText = word.text;
			currentStart = word.start;
			currentEnd = word.end;
			continue;
		}

		if (currentSpeaker === nextSpeaker) {
			currentText = `${currentText} ${word.text}`;
			currentEnd = word.end;
			continue;
		}

		segments.push({
			id: `${currentSpeaker}-${currentStart}-${currentEnd}`,
			speakerId: currentSpeaker,
			startTime: currentStart,
			endTime: currentEnd,
			text: currentText,
			translatedText: "",
			audioBlob: null,
		});

		currentSpeaker = nextSpeaker;
		currentText = word.text;
		currentStart = word.start;
		currentEnd = word.end;
	}

	if (currentSpeaker.length > 0) {
		segments.push({
			id: `${currentSpeaker}-${currentStart}-${currentEnd}`,
			speakerId: currentSpeaker,
			startTime: currentStart,
			endTime: currentEnd,
			text: currentText,
			translatedText: "",
			audioBlob: null,
		});
	}

	return segments;
}

function selectSpeakerSamples(buffers: AudioBuffer[]): Blob[] {
	const selected: Blob[] = [];
	let totalDuration = 0;

	for (const buffer of buffers) {
		if (buffer.duration < 0.35) {
			continue;
		}

		if (selected.length >= 4 || totalDuration >= 45) {
			break;
		}

		const file = audioBufferToMediaFile(buffer);
		selected.push(file);
		totalDuration += buffer.duration;
	}

	return selected;
}

function buildSpeakerLabels(
	segments: SpeakerSegment[],
	currentLabels: Record<string, string>,
	buildDefaultLabel: (index: number) => string,
): Record<string, string> {
	const labels: Record<string, string> = {};
	const speakerIds: string[] = [];

	for (const segment of segments) {
		if (!speakerIds.includes(segment.speakerId)) {
			speakerIds.push(segment.speakerId);
		}
	}

	for (const [index, speakerId] of speakerIds.entries()) {
		const existingLabel = currentLabels[speakerId];
		labels[speakerId] = existingLabel ?? buildDefaultLabel(index + 1);
	}

	return labels;
}

function buildSpeakerProgress(
	segments: SpeakerSegment[],
): Record<string, number> {
	const progress: Record<string, number> = {};

	for (const segment of segments) {
		if (progress[segment.speakerId] === undefined) {
			progress[segment.speakerId] = 0;
		}
	}

	return progress;
}

function getSegmentDeviation({
	segment,
	renderedDurationMs,
}: {
	segment: SpeakerSegment;
	renderedDurationMs: number | undefined;
}): { deltaRatio: number; source: "estimated" | "rendered" } | null {
	const slotDurationMs = Math.max(1, segment.endTime - segment.startTime);

	if (renderedDurationMs !== undefined) {
		return {
			deltaRatio: renderedDurationMs / slotDurationMs - 1,
			source: "rendered",
		};
	}

	const originalWords = countWords(segment.text);
	const translatedWords = countWords(segment.translatedText);

	if (originalWords === 0 || translatedWords === 0) {
		return null;
	}

	return {
		deltaRatio: translatedWords / originalWords - 1,
		source: "estimated",
	};
}

function formatDeviation(deltaRatio: number): string {
	const percentage = Math.round(deltaRatio * 100);
	if (percentage > 0) {
		return `+${percentage}%`;
	}
	return `${percentage}%`;
}

function stripSegmentAudio(segment: SpeakerSegment): SpeakerSegment {
	return {
		...segment,
		audioBlob: null,
		voiceId: undefined,
	};
}

async function blobToBase64({
	blob,
	encodeErrorMessage,
	readErrorMessage,
}: {
	blob: Blob;
	encodeErrorMessage: string;
	readErrorMessage: string;
}): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.addEventListener("load", () => {
			const result = reader.result;
			if (typeof result !== "string") {
				reject(new Error(encodeErrorMessage));
				return;
			}

			const encoded = result.split(",")[1];
			if (!encoded) {
				reject(new Error(encodeErrorMessage));
				return;
			}

			resolve(encoded);
		});

		reader.addEventListener("error", () => {
			reject(new Error(readErrorMessage));
		});

		reader.readAsDataURL(blob);
	});
}

async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
	const audioContext = new AudioContext();

	try {
		const buffer = await blob.arrayBuffer();
		return await audioContext.decodeAudioData(buffer.slice(0));
	} finally {
		await audioContext.close();
	}
}

async function readErrorMessage({
	response,
	buildFallbackMessage,
}: {
	response: Response;
	buildFallbackMessage: (status: number) => string;
}): Promise<string> {
	try {
		const data: unknown = await response.json();
		const schema = z.object({
			error: z.string().optional(),
			message: z.string().optional(),
		});
		const parsed = schema.safeParse(data);
		if (!parsed.success) {
			return buildFallbackMessage(response.status);
		}

		return (
			parsed.data.error ??
			parsed.data.message ??
			buildFallbackMessage(response.status)
		);
	} catch {
		return buildFallbackMessage(response.status);
	}
}

export function DubbingView() {
	const t = useTranslations("dubbing");
	const editor = useEditor();
	const mediaAssets = useEditor((instance) => instance.media.getAssets());
	const activeScene = useEditor((instance) =>
		instance.scenes.getActiveSceneOrNull(),
	);
	const activeProject = useEditor((instance) => instance.project.getActive());

	const sourceLanguage = useDubbingConfigStore((state) => state.sourceLanguage);
	const targetLanguage = useDubbingConfigStore((state) => state.targetLanguage);
	const assemblyApiKey = useDubbingConfigStore((state) => state.assemblyApiKey);
	const elevenLabsApiKey = useDubbingConfigStore(
		(state) => state.elevenLabsApiKey,
	);
	const deepSeekApiKey = useDubbingConfigStore(
		(state) => state.deepSeekApiKey,
	);
	const synthesisProvider = useDubbingConfigStore(
		(state) => state.synthesisProvider,
	);
	const localXttsEndpoint = useDubbingConfigStore(
		(state) => state.localXttsEndpoint,
	);
	const localXttsVoiceSource = useDubbingConfigStore(
		(state) => state.localXttsVoiceSource,
	);
	const localXttsSingleVoiceReferenceSource = useDubbingConfigStore(
		(state) => state.localXttsSingleVoiceReferenceSource,
	);
	const localXttsRequestFormat = useDubbingConfigStore(
		(state) => state.localXttsRequestFormat,
	);
	const localXttsSpeakerWav = useDubbingConfigStore(
		(state) => state.localXttsSpeakerWav,
	);
	const config: DubbingConfig = {
		sourceLanguage,
		targetLanguage,
		assemblyApiKey,
		elevenLabsApiKey,
		deepSeekApiKey,
		synthesisProvider,
		localXttsEndpoint,
		localXttsVoiceSource,
		localXttsSingleVoiceReferenceSource,
		localXttsRequestFormat,
		localXttsSpeakerWav,
	};
	const setConfigValue = useDubbingConfigStore((state) => state.setConfigValue);
	const migrateLegacyConfig = useDubbingConfigStore(
		(state) => state.migrateLegacyConfig,
	);
	const [stepStatuses, setStepStatuses] = useState<
		Record<ManagedStep, StepStatus>
	>(INITIAL_STEP_STATUSES);
	const [segments, setSegments] = useState<SpeakerSegment[]>([]);
	const [speakerLabels, setSpeakerLabels] = useState<Record<string, string>>(
		{},
	);
	const [speakerProgress, setSpeakerProgress] = useState<
		Record<string, number>
	>({});
	const [sourceAudioBuffer, setSourceAudioBuffer] =
		useState<AudioBuffer | null>(null);
	const [singleReferenceVoiceFile, setSingleReferenceVoiceFile] =
		useState<File | null>(null);
	const [localVoiceFiles, setLocalVoiceFiles] = useState<string[]>([]);
	const [isLoadingLocalVoiceFiles, setIsLoadingLocalVoiceFiles] =
		useState(false);
	const [localVoiceFilesError, setLocalVoiceFilesError] = useState<
		string | null
	>(null);
	const [renderedDurations, setRenderedDurations] = useState<
		Record<string, number>
	>({});
	const buildRequestFailedMessage = (status: number) =>
		t("errors.requestFailed", { status });
	const getTranslationErrorMessage = (error: unknown) => {
		if (!(error instanceof Error)) {
			return t("translation.messages.failed");
		}

		if (
			/account is not active/i.test(error.message) ||
			/check your billing details/i.test(error.message)
		) {
			return t("translation.messages.deepSeekAccountInactive");
		}

		return error.message;
	};
	const buildDefaultSpeakerLabel = (index: number) =>
		t("transcript.defaultSpeakerLabel", { index });
	const getLanguageLabel = (code: string) => {
		if (code in LANGUAGE_MESSAGE_KEYS) {
			return t(
				LANGUAGE_MESSAGE_KEYS[code as keyof typeof LANGUAGE_MESSAGE_KEYS],
			);
		}

		return code.toUpperCase();
	};

	const loadLocalVoiceFiles = useCallback(async () => {
		setIsLoadingLocalVoiceFiles(true);
		setLocalVoiceFilesError(null);
		try {
			const response = await fetch("/api/dubbing/local-xtts-voices");
			const payload = (await response.json()) as {
				files?: string[];
				error?: string;
			};
			if (!response.ok) {
				throw new Error(payload.error ?? t("apiKeys.voiceLibraryLoadFailed"));
			}

			const files = payload.files ?? [];
			setLocalVoiceFiles(files);
			if (files.length === 0) {
				if (localXttsSpeakerWav) {
					setConfigValue("localXttsSpeakerWav", "");
				}
				return;
			}
			if (localXttsSpeakerWav && !files.includes(localXttsSpeakerWav)) {
				setConfigValue("localXttsSpeakerWav", files[0] ?? "");
			}
			if (!localXttsSpeakerWav && files[0]) {
				setConfigValue("localXttsSpeakerWav", files[0]);
			}
		} catch (error) {
			setLocalVoiceFiles([]);
			setLocalVoiceFilesError(
				error instanceof Error
					? error.message
					: t("apiKeys.voiceLibraryLoadFailed"),
			);
		} finally {
			setIsLoadingLocalVoiceFiles(false);
		}
	}, [localXttsSpeakerWav, setConfigValue, t]);

	useEffect(() => {
		if (
			synthesisProvider !== "local-xtts" ||
			localXttsVoiceSource !== "single-reference" ||
			localXttsSingleVoiceReferenceSource !== "library"
		) {
			return;
		}

		void loadLocalVoiceFiles();
	}, [
		synthesisProvider,
		localXttsVoiceSource,
		localXttsSingleVoiceReferenceSource,
		loadLocalVoiceFiles,
	]);

	useEffect(() => {
		const serialized = sessionStorage.getItem(DUBBING_CONFIG_STORAGE_KEY);
		if (!serialized) {
			return;
		}

		try {
			const parsed: unknown = JSON.parse(serialized);
			const result = PERSISTED_CONFIG_SCHEMA.safeParse(parsed);
			if (result.success) {
				migrateLegacyConfig(result.data);
				sessionStorage.removeItem(DUBBING_CONFIG_STORAGE_KEY);
			}
		} catch {
			sessionStorage.removeItem(DUBBING_CONFIG_STORAGE_KEY);
		}
	}, [migrateLegacyConfig]);

	useEffect(() => {
		const pendingSegments = segments.filter((segment) => {
			if (segment.audioBlob === null) {
				return false;
			}

			return renderedDurations[segment.id] === undefined;
		});

		if (pendingSegments.length === 0) {
			return;
		}

		let cancelled = false;

		void (async () => {
			try {
				const nextDurations: Record<string, number> = {};

				for (const segment of pendingSegments) {
					if (segment.audioBlob === null) {
						continue;
					}

					const decoded = await decodeAudioBlob(segment.audioBlob);
					nextDurations[segment.id] = Math.round(decoded.duration * 1000);
				}

				if (cancelled || Object.keys(nextDurations).length === 0) {
					return;
				}

				setRenderedDurations((current) => ({
					...current,
					...nextDurations,
				}));
			} catch {
				// Ignore duration-read failures; the panel falls back to estimated timing.
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [segments, renderedDurations]);

	const uniqueSpeakerIds = useMemo(() => {
		const ids: string[] = [];
		for (const segment of segments) {
			if (!ids.includes(segment.speakerId)) {
				ids.push(segment.speakerId);
			}
		}
		return ids;
	}, [segments]);

	const analysisComplete = segments.length > 0 && sourceAudioBuffer !== null;
	const allSegmentsTranslated =
		segments.length > 0 &&
		segments.every((segment) => segment.translatedText.trim().length > 0);
	const allSegmentsSynthesized =
		segments.length > 0 &&
		segments.every((segment) => segment.audioBlob !== null);
	const audioTrackCount = useMemo(() => {
		if (activeScene === null) {
			return 0;
		}

		let count = 0;
		for (const track of activeScene.tracks.overlay) {
			if (canTrackHaveAudio(track)) {
				count += 1;
			}
		}
		if (canTrackHaveAudio(activeScene.tracks.main)) {
			count += 1;
		}
		for (const track of activeScene.tracks.audio) {
			if (canTrackHaveAudio(track)) {
				count += 1;
			}
		}

		return count;
	}, [activeScene]);

	const activeStatus = useMemo(() => {
		for (const step of [
			"analysis",
			"translation",
			"synthesis",
			"apply",
		] as const) {
			if (stepStatuses[step].loading) {
				return stepStatuses[step];
			}
		}

		return null;
	}, [stepStatuses]);

	function updateConfig<Key extends keyof DubbingConfig>(
		key: Key,
		value: DubbingConfig[Key],
	): void {
		setConfigValue(key, value);
	}

	function updateStepStatus(
		step: ManagedStep,
		patch: Partial<StepStatus>,
	): void {
		setStepStatuses((current) => ({
			...current,
			[step]: {
				...current[step],
				...patch,
			},
		}));
	}

	function resetStepStatus(step: ManagedStep): void {
		updateStepStatus(step, IDLE_STEP_STATUS);
	}

	function clearRenderedDuration(segmentId: string): void {
		setRenderedDurations((current) => {
			if (current[segmentId] === undefined) {
				return current;
			}

			const next = { ...current };
			delete next[segmentId];
			return next;
		});
	}

	function updateSegmentText({
		segmentId,
		field,
		value,
	}: {
		segmentId: string;
		field: "text" | "translatedText";
		value: string;
	}): void {
		setSegments((current) =>
			current.map((segment) => {
				if (segment.id !== segmentId) {
					return segment;
				}

				const nextSegment = stripSegmentAudio(segment);
				if (field === "text") {
					return {
						...nextSegment,
						text: value,
						translatedText: "",
					};
				}

				return {
					...nextSegment,
					[field]: value,
				};
			}),
		);
		clearRenderedDuration(segmentId);
		if (field === "text") {
			resetStepStatus("translation");
		}
		resetStepStatus("synthesis");
		resetStepStatus("apply");
	}

	async function handleAnalysis(): Promise<void> {
		if (config.assemblyApiKey.trim().length === 0) {
			updateStepStatus("analysis", {
				error: t("analysis.messages.missingApiKey"),
			});
			return;
		}

		if (activeScene === null) {
			updateStepStatus("analysis", {
				error: t("analysis.messages.noActiveScene"),
			});
			return;
		}

		if (
			!timelineHasAudio({
				tracks: activeScene.tracks,
				mediaAssets,
				excludeDubbingOutput: true,
				includeTracksMutedByDubbing: true,
			})
		) {
			updateStepStatus("analysis", {
				error: t("analysis.messages.noAudio"),
			});
			return;
		}

		updateStepStatus("analysis", {
			loading: true,
			progress: 5,
			message: t("analysis.messages.extracting"),
			error: null,
		});
		resetStepStatus("translation");
		resetStepStatus("synthesis");
		resetStepStatus("apply");

		try {
			const extractedAudio = await extractTimelineAudio({
				tracks: activeScene.tracks,
				mediaAssets,
				totalDuration: editor.timeline.getTotalDuration(),
				excludeDubbingOutput: true,
				includeTracksMutedByDubbing: true,
				onProgress: (progress) => {
					updateStepStatus("analysis", {
						progress: Math.max(8, Math.min(22, Math.round(progress / 5))),
						message: t("analysis.messages.extracting"),
					});
				},
			});

			updateStepStatus("analysis", {
				progress: 30,
				message: t("analysis.messages.decoding"),
			});

			const decodedAudio = await decodeAudioBlob(extractedAudio);
			const encodedAudio = await blobToBase64({
				blob: extractedAudio,
				encodeErrorMessage: t("errors.encodeExtractedAudio"),
				readErrorMessage: t("errors.readExtractedAudio"),
			});

			updateStepStatus("analysis", {
				progress: 50,
				message: t("analysis.messages.submitting"),
			});

			const submitResponse = await fetch("/api/dubbing/transcribe", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({
					audioBase64: encodedAudio,
					mimeType: extractedAudio.type || "audio/wav",
					assemblyApiKey: config.assemblyApiKey,
				}),
			});

			if (!submitResponse.ok) {
				throw new Error(
					await readErrorMessage({
						response: submitResponse,
						buildFallbackMessage: buildRequestFailedMessage,
					}),
				);
			}

			const submitPayload = transcribeSubmitResponseSchema.parse(
				await submitResponse.json(),
			);

			updateStepStatus("analysis", {
				progress: 72,
				message: t("analysis.messages.waiting"),
			});

			const transcriptResponse = await fetch(
				`/api/dubbing/transcribe?transcriptId=${encodeURIComponent(submitPayload.transcriptId)}&assemblyApiKey=${encodeURIComponent(config.assemblyApiKey)}`,
				{
					method: "GET",
				},
			);

			if (!transcriptResponse.ok) {
				throw new Error(
					await readErrorMessage({
						response: transcriptResponse,
						buildFallbackMessage: buildRequestFailedMessage,
					}),
				);
			}

			const transcriptPayload = transcribeResultResponseSchema.parse(
				await transcriptResponse.json(),
			);
			const nextSegments = buildSpeakerSegments(transcriptPayload.transcript);

			if (nextSegments.length === 0) {
				throw new Error(t("analysis.messages.noSegments"));
			}

			setSourceAudioBuffer(decodedAudio);
			setSegments(nextSegments);
			setSpeakerLabels((current) =>
				buildSpeakerLabels(nextSegments, current, buildDefaultSpeakerLabel),
			);
			setSpeakerProgress(buildSpeakerProgress(nextSegments));
			setRenderedDurations({});
			updateConfig(
				"sourceLanguage",
				transcriptPayload.transcript.language_code ?? "auto",
			);

			updateStepStatus("analysis", {
				loading: false,
				progress: 100,
				message: t("analysis.complete"),
				error: null,
			});
		} catch (error) {
			updateStepStatus("analysis", {
				loading: false,
				progress: 0,
				message: "",
				error:
					error instanceof Error
						? error.message
						: t("analysis.messages.failed"),
			});
		}
	}

	async function handleTranslate(): Promise<void> {
		if (!analysisComplete) {
			updateStepStatus("translation", {
				error: t("translation.messages.missingAnalysis"),
			});
			return;
		}

		if (config.deepSeekApiKey.trim().length === 0) {
			updateStepStatus("translation", {
				error: t("translation.messages.missingApiKey"),
			});
			return;
		}

		updateStepStatus("translation", {
			loading: true,
			progress: 12,
			message: t("translation.messages.translating"),
			error: null,
		});
		resetStepStatus("synthesis");
		resetStepStatus("apply");

		try {
			const response = await fetch("/api/dubbing/translate", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({
					segments: segments.map((segment) => ({
						id: segment.id,
						speakerId: segment.speakerId,
						startTime: segment.startTime,
						endTime: segment.endTime,
						text: segment.text,
						translatedText: segment.translatedText,
					})),
					targetLanguage: config.targetLanguage,
					deepSeekApiKey: config.deepSeekApiKey,
				}),
			});

			if (!response.ok) {
				throw new Error(
					await readErrorMessage({
						response,
						buildFallbackMessage: buildRequestFailedMessage,
					}),
				);
			}

			updateStepStatus("translation", {
				progress: 70,
				message: t("translation.messages.applying"),
			});

			const payload = translateResponseSchema.parse(await response.json());
			const translatedById = new Map<string, string>();

			for (const translatedSegment of payload.translatedSegments) {
				translatedById.set(
					translatedSegment.id,
					translatedSegment.translatedText,
				);
			}

			const nextSegments: SpeakerSegment[] = [];
			for (const segment of segments) {
				const translatedText = translatedById.get(segment.id);
				if (translatedText === undefined) {
					throw new Error(
						t("errors.missingTranslationForSegment", {
							segmentId: segment.id,
						}),
					);
				}

				nextSegments.push({
					...stripSegmentAudio(segment),
					translatedText,
				});
			}

			setSegments(nextSegments);
			setRenderedDurations({});
			setSpeakerProgress(buildSpeakerProgress(nextSegments));

			updateStepStatus("translation", {
				loading: false,
				progress: 100,
				message: t("translation.messages.complete"),
				error: null,
			});
		} catch (error) {
			updateStepStatus("translation", {
				loading: false,
				progress: 0,
				message: "",
				error: getTranslationErrorMessage(error),
			});
		}
	}

	async function handleCloneAndSynthesize(): Promise<void> {
		if (sourceAudioBuffer === null) {
			updateStepStatus("synthesis", {
				error: t("synthesis.messages.missingSourceAudio"),
			});
			return;
		}

		if (!allSegmentsTranslated) {
			updateStepStatus("synthesis", {
				error: t("synthesis.messages.missingTranslations"),
			});
			return;
		}

		if (
			config.synthesisProvider === "elevenlabs" &&
			config.elevenLabsApiKey.trim().length === 0
		) {
			updateStepStatus("synthesis", {
				error: t("synthesis.messages.missingApiKey"),
			});
			return;
		}

		if (
			config.synthesisProvider === "local-xtts" &&
			config.localXttsEndpoint.trim().length === 0
		) {
			updateStepStatus("synthesis", {
				error: t("synthesis.messages.missingLocalXttsEndpoint"),
			});
			return;
		}

		if (
			config.synthesisProvider === "local-xtts" &&
			config.localXttsVoiceSource === "single-reference" &&
			config.localXttsSingleVoiceReferenceSource === "upload" &&
			singleReferenceVoiceFile === null
		) {
			updateStepStatus("synthesis", {
				error: t("synthesis.messages.missingSingleReferenceVoice"),
			});
			return;
		}

		if (
			config.synthesisProvider === "local-xtts" &&
			config.localXttsVoiceSource === "single-reference" &&
			config.localXttsSingleVoiceReferenceSource === "library" &&
			config.localXttsSpeakerWav.trim().length === 0
		) {
			updateStepStatus("synthesis", {
				error: t("synthesis.messages.missingLibraryReferenceVoice"),
			});
			return;
		}

		updateStepStatus("synthesis", {
			loading: true,
			progress: 5,
			message: t("synthesis.messages.working"),
			error: null,
		});
		setSpeakerProgress(buildSpeakerProgress(segments));
		resetStepStatus("apply");

		const clonedVoiceIds = new Map<string, string>();
		const nextSpeakerProgress = buildSpeakerProgress(segments);
		const completedPerSpeaker = new Map<string, number>();
		const totalPerSpeaker = new Map<string, number>();

		for (const segment of segments) {
			totalPerSpeaker.set(
				segment.speakerId,
				(totalPerSpeaker.get(segment.speakerId) ?? 0) + 1,
			);
		}

		try {
			const speakerAudio = extractSpeakerAudioSegments(
				sourceAudioBuffer,
				segments,
			);

			if (config.synthesisProvider === "local-xtts") {
				const nextSegments: SpeakerSegment[] = [];
				let completedSegments = 0;

				for (const segment of segments) {
					const audioBuffers = speakerAudio.get(segment.speakerId) ?? [];
					const samples =
						config.localXttsVoiceSource === "single-reference" &&
						config.localXttsSingleVoiceReferenceSource === "upload" &&
						singleReferenceVoiceFile
							? [singleReferenceVoiceFile]
							: config.localXttsVoiceSource === "auto-speakers"
								? selectSpeakerSamples(audioBuffers)
								: [];
					const requestFormat = resolveLocalXttsRequestFormat({
						voiceSource: config.localXttsVoiceSource,
						singleVoiceReferenceSource:
							config.localXttsSingleVoiceReferenceSource,
					});

					if (
						requestFormat === "multipart" &&
						samples.length === 0
					) {
						throw new Error(
							t("errors.noUsableVoiceSamples", {
								speakerId: segment.speakerId,
							}),
						);
					}

					const formData = new FormData();
					formData.append("text", segment.translatedText);
					formData.append(
						"language",
						mapLocalXttsLanguageCode(config.targetLanguage),
					);
					formData.append("endpoint", config.localXttsEndpoint);
					formData.append("requestFormat", requestFormat);
					formData.append(
						"speakerWav",
						config.localXttsVoiceSource === "single-reference" &&
							config.localXttsSingleVoiceReferenceSource === "library"
							? config.localXttsSpeakerWav
							: resolveLocalXttsSpeakerWav({
									template: config.localXttsSpeakerWav,
									speakerId: segment.speakerId,
								}),
					);

					const [sample] = samples;
					if (sample) {
						const sampleFilename =
							config.localXttsVoiceSource === "single-reference" &&
							config.localXttsSingleVoiceReferenceSource === "upload" &&
							singleReferenceVoiceFile
								? singleReferenceVoiceFile.name
								: `${segment.speakerId}.wav`;
						formData.append(
							"speakerSample",
							sample,
							sampleFilename,
						);
					}

					const synthesizeResponse = await fetch(
						"/api/dubbing/local-xtts-synthesize",
						{
							method: "POST",
							body: formData,
						},
					);

					if (!synthesizeResponse.ok) {
						throw new Error(
							await readErrorMessage({
								response: synthesizeResponse,
								buildFallbackMessage: buildRequestFailedMessage,
							}),
						);
					}

					const audioBlob = await synthesizeResponse.blob();
					nextSegments.push({
						...segment,
						audioBlob,
						voiceId: `local-xtts:${segment.speakerId}`,
					});

					completedSegments += 1;
					const speakerCompleted =
						(completedPerSpeaker.get(segment.speakerId) ?? 0) + 1;
					completedPerSpeaker.set(segment.speakerId, speakerCompleted);
					const speakerTotal = totalPerSpeaker.get(segment.speakerId) ?? 1;
					nextSpeakerProgress[segment.speakerId] = Math.round(
						(speakerCompleted / speakerTotal) * 100,
					);

					setSpeakerProgress({ ...nextSpeakerProgress });
					updateStepStatus("synthesis", {
						progress: Math.round((completedSegments / segments.length) * 100),
						message: t("synthesis.messages.segmentProgress", {
							current: completedSegments,
							total: segments.length,
						}),
					});
				}

				setSegments(nextSegments);
				updateStepStatus("synthesis", {
					loading: false,
					progress: 100,
					message: t("synthesis.messages.complete"),
					error: null,
				});
				return;
			}

			for (const speakerId of uniqueSpeakerIds) {
				const audioBuffers = speakerAudio.get(speakerId) ?? [];
				const samples = selectSpeakerSamples(audioBuffers);

				if (samples.length === 0) {
					throw new Error(t("errors.noUsableVoiceSamples", { speakerId }));
				}

				const formData = new FormData();
				formData.append("speakerId", speakerId);
				formData.append("elevenlabsApiKey", config.elevenLabsApiKey);

				for (const sample of samples) {
					formData.append("audioSamples[]", sample, `${speakerId}.wav`);
				}

				const cloneResponse = await fetch("/api/dubbing/clone-voice", {
					method: "POST",
					body: formData,
				});

				if (!cloneResponse.ok) {
					throw new Error(
						await readErrorMessage({
							response: cloneResponse,
							buildFallbackMessage: buildRequestFailedMessage,
						}),
					);
				}

				const clonePayload = cloneVoiceResponseSchema.parse(
					await cloneResponse.json(),
				);
				clonedVoiceIds.set(clonePayload.speakerId, clonePayload.voiceId);
				nextSpeakerProgress[speakerId] = 20;
				setSpeakerProgress({ ...nextSpeakerProgress });
			}

			const nextSegments: SpeakerSegment[] = [];
			let completedSegments = 0;

			for (const segment of segments) {
				const voiceId = clonedVoiceIds.get(segment.speakerId);
				if (voiceId === undefined) {
					throw new Error(
						t("errors.missingClonedVoice", {
							speakerId: segment.speakerId,
						}),
					);
				}

				const synthesizeResponse = await fetch("/api/dubbing/synthesize", {
					method: "POST",
					headers: {
						"content-type": "application/json",
					},
					body: JSON.stringify({
						text: segment.translatedText,
						voiceId,
						language: config.targetLanguage,
						elevenlabsApiKey: config.elevenLabsApiKey,
					}),
				});

				if (!synthesizeResponse.ok) {
					throw new Error(
						await readErrorMessage({
							response: synthesizeResponse,
							buildFallbackMessage: buildRequestFailedMessage,
						}),
					);
				}

				const audioBlob = await synthesizeResponse.blob();
				nextSegments.push({
					...segment,
					audioBlob,
					voiceId,
				});

				completedSegments += 1;
				const speakerCompleted =
					(completedPerSpeaker.get(segment.speakerId) ?? 0) + 1;
				completedPerSpeaker.set(segment.speakerId, speakerCompleted);

				const speakerTotal = totalPerSpeaker.get(segment.speakerId) ?? 1;
				nextSpeakerProgress[segment.speakerId] =
					20 + Math.round((speakerCompleted / speakerTotal) * 80);

				setSpeakerProgress({ ...nextSpeakerProgress });
				updateStepStatus("synthesis", {
					progress: Math.round((completedSegments / segments.length) * 100),
					message: t("synthesis.messages.segmentProgress", {
						current: completedSegments,
						total: segments.length,
					}),
				});
			}

			setSegments(nextSegments);

			updateStepStatus("synthesis", {
				loading: false,
				progress: 100,
				message: t("synthesis.messages.complete"),
				error: null,
			});
		} catch (error) {
			updateStepStatus("synthesis", {
				loading: false,
				progress: 0,
				message: "",
				error:
					error instanceof Error
						? error.message
						: t("synthesis.messages.failed"),
			});
		} finally {
			for (const voiceId of clonedVoiceIds.values()) {
				try {
					await deleteClonedVoice(voiceId, config.elevenLabsApiKey);
				} catch {
					updateStepStatus("synthesis", {
						message: t("synthesis.messages.cleanupWarning"),
					});
				}
			}
		}
	}

	async function handleApplyDubbing(): Promise<void> {
		if (activeScene === null || activeProject === null) {
			updateStepStatus("apply", {
				error: t("apply.messages.missingContext"),
			});
			return;
		}

		if (!allSegmentsSynthesized) {
			updateStepStatus("apply", {
				error: t("apply.messages.missingAudio"),
			});
			return;
		}

		updateStepStatus("apply", {
			loading: true,
			progress: 8,
			message: t("apply.messages.buildingMix"),
			error: null,
		});

		try {
			const segmentFiles = await buildAlignedDubbingSegmentFiles(segments);

			if (segmentFiles.length === 0) {
				throw new Error(t("apply.messages.missingAudio"));
			}

			updateStepStatus("apply", {
				progress: 40,
				message: t("apply.messages.importingAsset"),
			});

			const processedAssets = await processMediaAssets({
				files: segmentFiles.map(({ file }) => file),
			});

			if (processedAssets.length !== segmentFiles.length) {
				throw new Error(t("apply.messages.processAssetFailed"));
			}

			const savedSegments = await Promise.all(
				processedAssets.map(async (processedAsset, index) => {
					const savedAsset = await editor.media.addMediaAsset({
						projectId: activeProject.metadata.id,
						asset: processedAsset,
					});

					if (!savedAsset) {
						throw new Error(t("apply.messages.saveAssetFailed"));
					}

					const segmentFile = segmentFiles[index];
					return {
						segment: segmentFile.segment,
						actualDurationSec: segmentFile.actualDurationSec,
						asset: savedAsset,
					};
				}),
			);

			updateStepStatus("apply", {
				progress: 72,
				message: t("apply.messages.mutingOriginal"),
			});

			const tracksBeforeDubbing = editor.scenes.getActiveScene().tracks;
			const tracksAfterDubbingMute = prepareTracksForDubbingApply({
				tracks: tracksBeforeDubbing,
			});

			updateStepStatus("apply", {
				progress: 88,
				message: t("apply.messages.addingTrack"),
			});

			const addTrackCommand = new AddTrackCommand("audio");
			const dubbedTrackId = addTrackCommand.getTrackId();
			const insertElementCommands = savedSegments.map(
				({ segment, asset, actualDurationSec }) => {
					const startTime = millisecondsToTicks(segment.startTime);
					const segmentDurationSec = Math.max(
						0.001,
						(segment.endTime - segment.startTime) / 1000,
					);
					const duration = Math.max(
						1,
						millisecondsToTicks(
							Math.max(segmentDurationSec, actualDurationSec) * 1000,
						),
					);
					return new InsertElementCommand({
						element: {
							...buildElementFromMedia({
								mediaId: asset.id,
								mediaType: "audio",
								name: `${speakerLabels[segment.speakerId] ?? segment.speakerId} (${t("apply.dubbedSuffix")})`,
								duration,
								startTime,
							}),
							role: DUBBING_OUTPUT_ROLE,
						},
						placement: {
							mode: "explicit",
							trackId: dubbedTrackId,
						},
					});
				},
			);
			editor.command.execute({
				command: new BatchCommand([
					new TracksSnapshotCommand(
						tracksBeforeDubbing,
						tracksAfterDubbingMute,
					),
					addTrackCommand,
					...insertElementCommands,
				]),
			});

			updateStepStatus("apply", {
				loading: false,
				progress: 100,
				message: t("apply.messages.complete"),
				error: null,
			});
		} catch (error) {
			updateStepStatus("apply", {
				loading: false,
				progress: 0,
				message: "",
				error:
					error instanceof Error ? error.message : t("apply.messages.failed"),
			});
		}
	}

	return (
		<PanelView title={t("title")} contentClassName="px-0 pb-6">
			<div className="flex flex-col gap-4 px-2">
				<Card className="border-dashed">
					<CardHeader className="pb-3">
						<CardTitle>{t("overview.title")}</CardTitle>
						<CardDescription>{t("overview.description")}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3 pt-0">
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline">
								{t("overview.sourceLanguage", {
									language: getLanguageLabel(config.sourceLanguage),
								})}
							</Badge>
							<Badge variant="outline">
								{t("overview.targetLanguage", {
									language: getLanguageLabel(config.targetLanguage),
								})}
							</Badge>
							<Badge variant="outline">
								{t("overview.segments", { count: segments.length })}
							</Badge>
							<Badge variant="outline">
								{t("overview.speakers", { count: uniqueSpeakerIds.length })}
							</Badge>
						</div>
						{activeStatus ? (
							<div className="space-y-2">
								<div className="text-muted-foreground flex items-center gap-2 text-sm">
									<Spinner className="size-4" />
									<span>{activeStatus.message}</span>
								</div>
								<Progress value={activeStatus.progress} />
							</div>
						) : null}
					</CardContent>
				</Card>

				<WizardCard
					stepNumber={1}
					title={t("analysis.title")}
					description={t("analysis.description")}
					loading={stepStatuses.analysis.loading}
					ready={analysisComplete}
				>
					<div className="grid gap-4">
						<div className="grid gap-4 md:grid-cols-2">
							<div className="grid gap-2">
								<Label htmlFor="source-language">
									{t("analysis.sourceLanguage")}
								</Label>
								<div
									id="source-language"
									className="bg-accent rounded-md border px-3 py-2 text-sm"
								>
									{getLanguageLabel(config.sourceLanguage)}
								</div>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="target-language">
									{t("analysis.targetLanguage")}
								</Label>
								<Select
									value={config.targetLanguage}
									onValueChange={(value) =>
										updateConfig("targetLanguage", value)
									}
								>
									<SelectTrigger id="target-language">
										<SelectValue
											placeholder={t("analysis.chooseTargetLanguage")}
										/>
									</SelectTrigger>
									<SelectContent>
										{LANGUAGE_OPTIONS.map((language) => (
											<SelectItem key={language.code} value={language.code}>
												{getLanguageLabel(language.code)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<Button
							onClick={() => {
								void handleAnalysis();
							}}
							disabled={stepStatuses.analysis.loading}
						>
							{stepStatuses.analysis.loading
								? t("analysis.running")
								: t("analysis.start")}
						</Button>
						{stepStatuses.analysis.progress > 0 ? (
							<div className="space-y-2">
								<Progress value={stepStatuses.analysis.progress} />
								{stepStatuses.analysis.message ? (
									<p className="text-muted-foreground text-xs">
										{stepStatuses.analysis.message}
									</p>
								) : null}
							</div>
						) : null}
						{stepStatuses.analysis.error ? (
							<StepAlert
								title={t("analysis.failed")}
								message={stepStatuses.analysis.error}
							/>
						) : null}
					</div>
				</WizardCard>

				<WizardCard
					stepNumber={2}
					title={t("transcript.title")}
					description={t("transcript.description")}
					loading={stepStatuses.translation.loading}
					ready={allSegmentsTranslated}
				>
					<div className="space-y-4">
						{analysisComplete ? (
							<>
								<div className="grid gap-3 md:grid-cols-2">
									{uniqueSpeakerIds.map((speakerId) => (
										<div key={speakerId} className="grid gap-2">
											<Label htmlFor={`speaker-${speakerId}`}>
												{speakerId}
											</Label>
											<Input
												id={`speaker-${speakerId}`}
												value={speakerLabels[speakerId] ?? speakerId}
												onChange={(event) => {
													const nextLabel = event.target.value;
													setSpeakerLabels((current) => ({
														...current,
														[speakerId]: nextLabel,
													}));
												}}
												placeholder={t("transcript.speakerLabelPlaceholder")}
											/>
										</div>
									))}
								</div>
								<Separator />
								<div className="space-y-3">
									{segments.map((segment) => (
										<Card key={segment.id} className="rounded-xl">
											<CardContent className="space-y-3 p-4">
												<div className="flex flex-wrap items-center justify-between gap-2">
													<Badge variant="outline">
														{speakerLabels[segment.speakerId] ??
															segment.speakerId}
													</Badge>
													<span className="text-muted-foreground text-xs">
														{formatTime(segment.startTime)} -{" "}
														{formatTime(segment.endTime)}
													</span>
												</div>
												<Textarea
													value={segment.text}
													onChange={(event) => {
														updateSegmentText({
															segmentId: segment.id,
															field: "text",
															value: event.target.value,
														});
													}}
													className="min-h-24"
												/>
											</CardContent>
										</Card>
									))}
								</div>
								<Button
									onClick={() => {
										void handleTranslate();
									}}
									disabled={
										stepStatuses.translation.loading ||
										stepStatuses.analysis.loading ||
										!analysisComplete
									}
								>
									{stepStatuses.translation.loading
										? t("transcript.translating")
										: t("transcript.translate")}
								</Button>
								{stepStatuses.translation.progress > 0 ? (
									<div className="space-y-2">
										<Progress value={stepStatuses.translation.progress} />
										{stepStatuses.translation.message ? (
											<p className="text-muted-foreground text-xs">
												{stepStatuses.translation.message}
											</p>
										) : null}
									</div>
								) : null}
								{stepStatuses.translation.error ? (
									<StepAlert
										title={t("transcript.translationFailed")}
										message={stepStatuses.translation.error}
									/>
								) : null}
							</>
						) : (
							<p className="text-muted-foreground text-sm">
								{t("transcript.emptyState")}
							</p>
						)}
					</div>
				</WizardCard>

				<WizardCard
					stepNumber={3}
					title={t("synthesis.title")}
					description={t("synthesis.description")}
					loading={stepStatuses.synthesis.loading}
					ready={allSegmentsSynthesized}
				>
					<div className="space-y-4">
						{allSegmentsTranslated ? (
							<>
								<DubbingSynthesisSettings
									synthesisProvider={config.synthesisProvider}
									onSynthesisProviderChange={(value) =>
										setConfigValue("synthesisProvider", value)
									}
								/>
								{config.synthesisProvider === "local-xtts" ? (
									<LocalXttsVoiceSourcePanel
										voiceSource={config.localXttsVoiceSource}
										onVoiceSourceChange={(value) =>
											setConfigValue("localXttsVoiceSource", value)
										}
										singleVoiceReferenceSource={
											config.localXttsSingleVoiceReferenceSource
										}
										onSingleVoiceReferenceSourceChange={(value) =>
											setConfigValue(
												"localXttsSingleVoiceReferenceSource",
												value,
											)
										}
										libraryReferenceVoice={config.localXttsSpeakerWav}
										onLibraryReferenceVoiceChange={(value) =>
											setConfigValue("localXttsSpeakerWav", value)
										}
										singleReferenceVoiceFile={singleReferenceVoiceFile}
										onSingleReferenceVoiceFileChange={
											setSingleReferenceVoiceFile
										}
										localVoiceFiles={localVoiceFiles}
										isLoadingLocalVoiceFiles={isLoadingLocalVoiceFiles}
										localVoiceFilesError={localVoiceFilesError}
										onRefreshLocalVoiceFiles={loadLocalVoiceFiles}
									/>
								) : null}
								<div className="grid gap-3 md:grid-cols-2">
									{uniqueSpeakerIds.map((speakerId) => (
										<Card key={speakerId} className="rounded-xl">
											<CardContent className="space-y-3 p-4">
												<div className="flex items-center justify-between gap-2">
													<div>
														<p className="text-sm font-medium">
															{speakerLabels[speakerId] ?? speakerId}
														</p>
														<p className="text-muted-foreground text-xs">
															{speakerId}
														</p>
													</div>
													<Badge variant="outline">
														{t("synthesis.speakerProgress", {
															count: Math.round(
																speakerProgress[speakerId] ?? 0,
															),
														})}
													</Badge>
												</div>
												<Progress value={speakerProgress[speakerId] ?? 0} />
											</CardContent>
										</Card>
									))}
								</div>
								<div className="space-y-3">
									{segments.map((segment) => {
										const deviation = getSegmentDeviation({
											segment,
											renderedDurationMs: renderedDurations[segment.id],
										});
										const hasWarning =
											deviation !== null &&
											Math.abs(deviation.deltaRatio) > 0.3;

										return (
											<Card
												key={segment.id}
												className={cn(
													"rounded-xl",
													hasWarning &&
														"border-yellow-300 bg-yellow-50/70 dark:bg-yellow-500/10",
												)}
											>
												<CardContent className="space-y-3 p-4">
													<div className="flex flex-wrap items-center justify-between gap-2">
														<div className="flex flex-wrap items-center gap-2">
															<Badge variant="outline">
																{speakerLabels[segment.speakerId] ??
																	segment.speakerId}
															</Badge>
															<span className="text-muted-foreground text-xs">
																{formatTime(segment.startTime)} -{" "}
																{formatTime(segment.endTime)}
															</span>
														</div>
														{deviation ? (
															<Badge
																variant="outline"
																className={cn(
																	hasWarning &&
																		"border-yellow-500 text-yellow-700",
																)}
															>
																{deviation.source === "rendered"
																	? t("synthesis.rendered")
																	: t("synthesis.estimated")}{" "}
																{formatDeviation(deviation.deltaRatio)}
															</Badge>
														) : null}
													</div>
													<div className="grid gap-3 md:grid-cols-2">
														<div className="space-y-2">
															<Label htmlFor={`original-${segment.id}`}>
																{t("synthesis.sourceText")}
															</Label>
															<Textarea
																id={`original-${segment.id}`}
																value={segment.text}
																onChange={(event) => {
																	updateSegmentText({
																		segmentId: segment.id,
																		field: "text",
																		value: event.target.value,
																	});
																}}
																className="min-h-24"
															/>
														</div>
														<div className="space-y-2">
															<Label htmlFor={`translated-${segment.id}`}>
																{t("synthesis.translatedText")}
															</Label>
															<Textarea
																id={`translated-${segment.id}`}
																value={segment.translatedText}
																onChange={(event) => {
																	updateSegmentText({
																		segmentId: segment.id,
																		field: "translatedText",
																		value: event.target.value,
																	});
																}}
																className="min-h-24"
															/>
														</div>
													</div>
												</CardContent>
											</Card>
										);
									})}
								</div>
								<Button
									onClick={() => {
										void handleCloneAndSynthesize();
									}}
									disabled={
										stepStatuses.synthesis.loading ||
										stepStatuses.translation.loading ||
										!allSegmentsTranslated
									}
								>
									{stepStatuses.synthesis.loading
										? t("synthesis.synthesizing")
										: t("synthesis.synthesize")}
								</Button>
								{stepStatuses.synthesis.progress > 0 ? (
									<div className="space-y-2">
										<Progress value={stepStatuses.synthesis.progress} />
										{stepStatuses.synthesis.message ? (
											<p className="text-muted-foreground text-xs">
												{stepStatuses.synthesis.message}
											</p>
										) : null}
									</div>
								) : null}
								{stepStatuses.synthesis.error ? (
									<StepAlert
										title={t("synthesis.messages.failed")}
										message={stepStatuses.synthesis.error}
									/>
								) : null}
							</>
						) : (
							<p className="text-muted-foreground text-sm">
								{t("synthesis.messages.waitingForTranslations")}
							</p>
						)}
					</div>
				</WizardCard>

				<WizardCard
					stepNumber={4}
					title={t("apply.title")}
					description={t("apply.description")}
					loading={stepStatuses.apply.loading}
					ready={allSegmentsSynthesized && stepStatuses.apply.error === null}
				>
					<div className="space-y-4">
						<div className="grid gap-3 md:grid-cols-3">
							<SummaryTile
								label={t("apply.dubbedSegments")}
								value={`${segments.filter((segment) => segment.audioBlob !== null).length}/${segments.length}`}
							/>
							<SummaryTile
								label={t("apply.mutedTracks")}
								value={`${audioTrackCount}`}
							/>
							<SummaryTile
								label={t("apply.newTrack")}
								value={t("apply.newTrackValue")}
							/>
						</div>
						<Button
							onClick={() => {
								void handleApplyDubbing();
							}}
							disabled={stepStatuses.apply.loading || !allSegmentsSynthesized}
						>
							{stepStatuses.apply.loading
								? t("synthesis.applying")
								: t("synthesis.apply")}
						</Button>
						{stepStatuses.apply.progress > 0 ? (
							<div className="space-y-2">
								<Progress value={stepStatuses.apply.progress} />
								{stepStatuses.apply.message ? (
									<p className="text-muted-foreground text-xs">
										{stepStatuses.apply.message}
									</p>
								) : null}
							</div>
						) : null}
						{stepStatuses.apply.error ? (
							<StepAlert
								title={t("apply.messages.failed")}
								message={stepStatuses.apply.error}
							/>
						) : null}
					</div>
				</WizardCard>
			</div>
		</PanelView>
	);
}

function WizardCard({
	stepNumber,
	title,
	description,
	loading = false,
	ready = false,
	children,
}: {
	stepNumber: number;
	title: string;
	description: string;
	loading?: boolean;
	ready?: boolean;
	children: ReactNode;
}) {
	const t = useTranslations("dubbing.overview");

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-center gap-3">
						<div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
							{stepNumber}
						</div>
						<div className="space-y-1">
							<CardTitle>{title}</CardTitle>
							<CardDescription>{description}</CardDescription>
						</div>
					</div>
					{loading ? (
						<Badge variant="outline" className="gap-1">
							<Spinner className="size-3.5" />
							{t("running")}
						</Badge>
					) : ready ? (
						<Badge variant="outline">{t("ready")}</Badge>
					) : (
						<Badge variant="outline">{t("pending")}</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

function DubbingSynthesisSettings({
	synthesisProvider,
	onSynthesisProviderChange,
}: {
	synthesisProvider: DubbingConfig["synthesisProvider"];
	onSynthesisProviderChange: (
		value: DubbingConfig["synthesisProvider"],
	) => void;
}) {
	const t = useTranslations("dubbing");

	return (
		<div className="rounded-md border bg-muted/30 p-3">
			<div className="grid gap-2">
				<Label htmlFor="dubbing-synthesis-provider">
					{t("synthesis.synthesisProvider")}
				</Label>
				<Select
					value={synthesisProvider}
					onValueChange={(value) =>
						onSynthesisProviderChange(
							value as DubbingConfig["synthesisProvider"],
						)
					}
				>
					<SelectTrigger id="dubbing-synthesis-provider">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="elevenlabs">
							{t("apiKeys.providers.elevenLabs")}
						</SelectItem>
						<SelectItem value="local-xtts">
							{t("apiKeys.providers.localXtts")}
						</SelectItem>
					</SelectContent>
				</Select>
				{synthesisProvider === "local-xtts" ? (
					<p className="text-muted-foreground text-xs">
						{t("synthesis.localXttsEndpointHint")}
					</p>
				) : null}
			</div>
		</div>
	);
}

function LocalXttsVoiceSourcePanel({
	voiceSource,
	onVoiceSourceChange,
	singleVoiceReferenceSource,
	onSingleVoiceReferenceSourceChange,
	libraryReferenceVoice,
	onLibraryReferenceVoiceChange,
	singleReferenceVoiceFile,
	onSingleReferenceVoiceFileChange,
	localVoiceFiles,
	isLoadingLocalVoiceFiles,
	localVoiceFilesError,
	onRefreshLocalVoiceFiles,
}: {
	voiceSource: DubbingConfig["localXttsVoiceSource"];
	onVoiceSourceChange: (value: DubbingConfig["localXttsVoiceSource"]) => void;
	singleVoiceReferenceSource: DubbingConfig["localXttsSingleVoiceReferenceSource"];
	onSingleVoiceReferenceSourceChange: (
		value: DubbingConfig["localXttsSingleVoiceReferenceSource"],
	) => void;
	libraryReferenceVoice: string;
	onLibraryReferenceVoiceChange: (value: string) => void;
	singleReferenceVoiceFile: File | null;
	onSingleReferenceVoiceFileChange: (file: File | null) => void;
	localVoiceFiles: string[];
	isLoadingLocalVoiceFiles: boolean;
	localVoiceFilesError: string | null;
	onRefreshLocalVoiceFiles: () => void;
}) {
	const t = useTranslations("dubbing");

	return (
		<div className="rounded-md border bg-muted/30 p-3">
			<div className="grid gap-3">
				<div className="grid gap-2">
					<Label htmlFor="local-xtts-voice-source">
						{t("synthesis.localXttsVoiceSource")}
					</Label>
					<Select
						value={voiceSource}
						onValueChange={(value) =>
							onVoiceSourceChange(
								value as DubbingConfig["localXttsVoiceSource"],
							)
						}
					>
						<SelectTrigger id="local-xtts-voice-source">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="single-reference">
								{t("synthesis.voiceSources.single-reference")}
							</SelectItem>
							<SelectItem value="auto-speakers">
								{t("synthesis.voiceSources.auto-speakers")}
							</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-xs">
						{t(`synthesis.voiceSourceDescriptions.${voiceSource}`)}
					</p>
				</div>
			</div>
			{voiceSource === "single-reference" ? (
				<div className="mt-3 grid gap-3">
					<div className="grid gap-2">
						<Label htmlFor="local-xtts-single-reference-source">
							{t("synthesis.localXttsSingleVoiceReferenceSource")}
						</Label>
						<Select
							value={singleVoiceReferenceSource}
							onValueChange={(value) =>
								onSingleVoiceReferenceSourceChange(
									value as DubbingConfig["localXttsSingleVoiceReferenceSource"],
								)
							}
						>
							<SelectTrigger id="local-xtts-single-reference-source">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="upload">
									{t("synthesis.singleVoiceReferenceSources.upload")}
								</SelectItem>
								<SelectItem value="library">
									{t("synthesis.singleVoiceReferenceSources.library")}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{singleVoiceReferenceSource === "upload" ? (
						<div className="grid gap-2">
							<Label htmlFor="local-xtts-reference-voice">
								{t("synthesis.singleReferenceVoice")}
							</Label>
							<Input
								id="local-xtts-reference-voice"
								type="file"
								accept="audio/*"
								onChange={(event) =>
									onSingleReferenceVoiceFileChange(
										event.target.files?.[0] ?? null,
									)
								}
							/>
							{singleReferenceVoiceFile ? (
								<p className="text-muted-foreground text-xs">
									{t("synthesis.selectedReferenceVoice", {
										name: singleReferenceVoiceFile.name,
									})}
								</p>
							) : null}
						</div>
					) : (
						<div className="grid gap-2">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="local-xtts-speaker-wav">
									{t("synthesis.localXttsSpeakerWav")}
								</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => onRefreshLocalVoiceFiles()}
									disabled={isLoadingLocalVoiceFiles}
								>
									{isLoadingLocalVoiceFiles
										? t("apiKeys.loadingVoiceLibrary")
										: t("apiKeys.refreshVoiceLibrary")}
								</Button>
							</div>
							<Select
								value={libraryReferenceVoice}
								onValueChange={onLibraryReferenceVoiceChange}
								disabled={localVoiceFiles.length === 0}
							>
								<SelectTrigger id="local-xtts-speaker-wav">
									<SelectValue
										placeholder={t("apiKeys.selectReferenceVoice")}
									/>
								</SelectTrigger>
								<SelectContent>
									{localVoiceFiles.map((fileName) => (
										<SelectItem key={fileName} value={fileName}>
											{fileName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{localVoiceFilesError ? (
								<p className="text-destructive text-xs">
									{localVoiceFilesError}
								</p>
							) : (
								<p className="text-muted-foreground text-xs">
									{t("apiKeys.voiceLibraryHint")}
								</p>
							)}
						</div>
					)}
				</div>
			) : null}
		</div>
	);
}

function StepAlert({ title, message }: { title: string; message: string }) {
	return (
		<Alert variant="destructive">
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>{message}</AlertDescription>
		</Alert>
	);
}

function SummaryTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-accent/40 rounded-xl border p-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="mt-1 text-sm font-medium">{value}</p>
		</div>
	);
}
