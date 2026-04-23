export interface DubbingConfig {
	sourceLanguage: string;
	targetLanguage: string;
	assemblyApiKey: string;
	elevenLabsApiKey: string;
	openAiApiKey: string;
}

export interface SpeakerSegment {
	id: string;
	speakerId: string;
	startTime: number;
	endTime: number;
	text: string;
	translatedText: string;
	audioBlob: Blob | null;
	voiceId?: string;
}

export enum DubbingJobStatus {
	Idle = "idle",
	Running = "running",
	Completed = "completed",
	Failed = "failed",
}

export enum DubbingStep {
	ConfigureKeys = "configure-keys",
	SelectLanguages = "select-languages",
	Transcribe = "transcribe",
	Review = "review",
	Translate = "translate",
	Synthesize = "synthesize",
	Apply = "apply",
}

export interface DubbingJob {
	status: DubbingJobStatus;
	step: DubbingStep;
	progress: number;
	message: string;
	error: string | null;
	speakerProgress: Record<string, number>;
}

export interface TranscriptWord {
	text: string;
	start: number;
	end: number;
	confidence: number;
	speaker?: string;
}

export interface SpeakerDiarizationUtterance {
	speaker: string;
	start: number;
	end: number;
	text: string;
	confidence?: number;
	words?: TranscriptWord[];
}

export interface SpeakerDiarization {
	id: string;
	status: "queued" | "processing" | "completed" | "error";
	text?: string;
	language_code?: string;
	language_confidence?: number;
	error?: string;
	words?: TranscriptWord[];
	utterances?: SpeakerDiarizationUtterance[];
}

export interface VoiceCloneResult {
	speakerId: string;
	voiceId: string;
}

export interface SynthesisResult {
	speakerId: string;
	segmentId: string;
	audioBuffer: ArrayBuffer;
	mimeType: string;
}
