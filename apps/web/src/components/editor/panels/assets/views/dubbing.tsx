"use client";

import { useEffect, useMemo, useState } from "react";
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
	buildDubbingAudioBuffer,
} from "@/services/dubbing/mixer";
import { deleteClonedVoice } from "@/services/dubbing/tts";
import { cn } from "@/utils/ui";

const SESSION_STORAGE_KEY = "opencut-dubbing-config";

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

const INITIAL_CONFIG: DubbingConfig = {
	sourceLanguage: "auto",
	targetLanguage: "es",
	assemblyApiKey: "",
	elevenLabsApiKey: "",
	openAiApiKey: "",
};

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

const transcriptWordSchema = z.object({
	text: z.string(),
	start: z.number(),
	end: z.number(),
	confidence: z.number(),
	speaker: z.string().optional(),
});

const speakerDiarizationSchema = z.object({
	id: z.string(),
	status: z.enum(["queued", "processing", "completed", "error"]),
	text: z.string().optional(),
	language_code: z.string().optional(),
	language_confidence: z.number().optional(),
	error: z.string().optional(),
	words: z.array(transcriptWordSchema).optional(),
	utterances: z
		.array(
			z.object({
				speaker: z.string(),
				start: z.number(),
				end: z.number(),
				text: z.string(),
				confidence: z.number().optional(),
				words: z.array(transcriptWordSchema).optional(),
			}),
		)
		.optional(),
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
	sourceLanguage: z.string(),
	targetLanguage: z.string(),
	assemblyApiKey: z.string(),
	elevenLabsApiKey: z.string(),
	openAiApiKey: z.string(),
});

function formatTime(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

function getKeysError({
	config,
	buildMessage,
}: {
	config: DubbingConfig;
	buildMessage: (providers: string) => string;
}): string | null {
	const missing: string[] = [];

	if (config.assemblyApiKey.trim().length === 0) {
		missing.push("AssemblyAI");
	}
	if (config.openAiApiKey.trim().length === 0) {
		missing.push("OpenAI");
	}
	if (config.elevenLabsApiKey.trim().length === 0) {
		missing.push("ElevenLabs");
	}

	if (missing.length === 0) {
		return null;
	}

	return buildMessage(missing.join(", "));
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

	const [config, setConfig] = useState<DubbingConfig>(INITIAL_CONFIG);
	const [keysError, setKeysError] = useState<string | null>(null);
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
	const [renderedDurations, setRenderedDurations] = useState<
		Record<string, number>
	>({});
	const buildRequestFailedMessage = (status: number) =>
		t("errors.requestFailed", { status });
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

	useEffect(() => {
		const serialized = sessionStorage.getItem(SESSION_STORAGE_KEY);
		if (!serialized) {
			return;
		}

		try {
			const parsed: unknown = JSON.parse(serialized);
			const result = PERSISTED_CONFIG_SCHEMA.safeParse(parsed);
			if (result.success) {
				setConfig(result.data);
			}
		} catch {
			sessionStorage.removeItem(SESSION_STORAGE_KEY);
		}
	}, []);

	useEffect(() => {
		if (
			keysError !== null &&
			getKeysError({
				config,
				buildMessage: (providers) => t("errors.missingApiKeys", { providers }),
			}) === null
		) {
			setKeysError(null);
		}
	}, [config, keysError, t]);

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
		setConfig((current) => {
			const nextConfig = {
				...current,
				[key]: value,
			};
			sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextConfig));
			return nextConfig;
		});
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
		setKeysError(null);
		const nextKeysError = getKeysError({
			config,
			buildMessage: (providers) => t("errors.missingApiKeys", { providers }),
		});
		if (nextKeysError) {
			setKeysError(nextKeysError);
			return;
		}

		if (activeScene === null) {
			updateStepStatus("analysis", {
				error: t("analysis.messages.noActiveScene"),
			});
			return;
		}

		if (!timelineHasAudio({ tracks: activeScene.tracks, mediaAssets })) {
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

		if (config.openAiApiKey.trim().length === 0) {
			setKeysError(t("translation.messages.missingApiKey"));
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
					openaiApiKey: config.openAiApiKey,
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
				error:
					error instanceof Error
						? error.message
						: t("translation.messages.failed"),
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

		if (config.elevenLabsApiKey.trim().length === 0) {
			setKeysError(t("synthesis.messages.missingApiKey"));
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
			const totalDurationSeconds =
				editor.timeline.getTotalDuration() / TICKS_PER_SECOND;
			const sampleRate = sourceAudioBuffer?.sampleRate ?? 44100;
			const dubbedBuffer = await buildDubbingAudioBuffer(
				segments,
				totalDurationSeconds,
				sampleRate,
			);
			const dubbedFile = audioBufferToMediaFile(dubbedBuffer);

			updateStepStatus("apply", {
				progress: 40,
				message: t("apply.messages.importingAsset"),
			});

			const processedAssets = await processMediaAssets({
				files: [dubbedFile],
			});
			const processedAsset = processedAssets[0];

			if (!processedAsset) {
				throw new Error(t("apply.messages.processAssetFailed"));
			}

			const savedAsset = await editor.media.addMediaAsset({
				projectId: activeProject.metadata.id,
				asset: processedAsset,
			});

			if (!savedAsset) {
				throw new Error(t("apply.messages.saveAssetFailed"));
			}

			updateStepStatus("apply", {
				progress: 72,
				message: t("apply.messages.mutingOriginal"),
			});

			const currentTracks = [
				...activeScene.tracks.overlay,
				activeScene.tracks.main,
				...activeScene.tracks.audio,
			];

			for (const track of currentTracks) {
				if (canTrackHaveAudio(track) && track.muted !== true) {
					editor.timeline.toggleTrackMute({ trackId: track.id });
				}
			}

			updateStepStatus("apply", {
				progress: 88,
				message: t("apply.messages.addingTrack"),
			});

			// TODO: replace this fallback with services/dubbing/mixer.applyDubbingToTimeline
			// when that helper is exported from the shared service module.
			const trackId = editor.timeline.addTrack({ type: "audio" });
			const durationTicks =
				savedAsset.duration === undefined
					? editor.timeline.getTotalDuration()
					: Math.round(savedAsset.duration * TICKS_PER_SECOND);

			const element = buildElementFromMedia({
				mediaId: savedAsset.id,
				mediaType: "audio",
				name: `${savedAsset.name} (${t("apply.dubbedSuffix")})`,
				duration: durationTicks,
				startTime: 0,
			});

			editor.timeline.insertElement({
				element,
				placement: {
					mode: "explicit",
					trackId,
				},
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
					title={t("apiKeys.title")}
					description={t("apiKeys.description")}
					ready={
						getKeysError({
							config,
							buildMessage: (providers) =>
								t("errors.missingApiKeys", { providers }),
						}) === null
					}
				>
					<div className="grid gap-3">
						<KeyField
							id="assembly-key"
							label={t("apiKeys.assembly")}
							value={config.assemblyApiKey}
							onChange={(value) => updateConfig("assemblyApiKey", value)}
						/>
						<KeyField
							id="elevenlabs-key"
							label={t("apiKeys.elevenLabs")}
							value={config.elevenLabsApiKey}
							onChange={(value) => updateConfig("elevenLabsApiKey", value)}
						/>
						<KeyField
							id="openai-key"
							label={t("apiKeys.openAi")}
							value={config.openAiApiKey}
							onChange={(value) => updateConfig("openAiApiKey", value)}
						/>
					</div>
					{keysError ? (
						<StepAlert
							title={t("apiKeys.configurationNeeded")}
							message={keysError}
						/>
					) : null}
				</WizardCard>

				<WizardCard
					stepNumber={2}
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
					stepNumber={3}
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
					stepNumber={4}
					title={t("synthesis.title")}
					description={t("synthesis.description")}
					loading={stepStatuses.synthesis.loading}
					ready={allSegmentsSynthesized}
				>
					<div className="space-y-4">
						{allSegmentsTranslated ? (
							<>
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
					stepNumber={5}
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

function KeyField({
	id,
	label,
	value,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	const t = useTranslations("dubbing.apiKeys");

	return (
		<div className="grid gap-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				type="password"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={t("placeholder")}
				autoComplete="off"
			/>
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
