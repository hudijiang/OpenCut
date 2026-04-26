import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DubbingConfig } from "@/lib/dubbing/types";

export const DUBBING_CONFIG_STORAGE_KEY = "opencut-dubbing-config";

export const DEFAULT_DUBBING_CONFIG: DubbingConfig = {
	sourceLanguage: "auto",
	targetLanguage: "es",
	assemblyApiKey: "",
	elevenLabsApiKey: "",
	deepSeekApiKey: "",
	synthesisProvider: "elevenlabs",
	localXttsEndpoint: "http://localhost:8020/tts_to_audio/",
	localXttsVoiceSource: "auto-speakers",
	localXttsSingleVoiceReferenceSource: "upload",
	localXttsRequestFormat: "multipart",
	localXttsSpeakerWav: "{speakerId}.wav",
};

type LegacyDubbingConfig = Partial<
	Omit<DubbingConfig, "localXttsVoiceSource"> & {
		openAiApiKey: string;
		localXttsVoiceSource:
			| DubbingConfig["localXttsVoiceSource"]
			| "server-speaker-wav";
	}
>;

interface DubbingConfigStore extends DubbingConfig {
	setConfigValue: <Key extends keyof DubbingConfig>(
		key: Key,
		value: DubbingConfig[Key],
	) => void;
	migrateLegacyConfig: (config: LegacyDubbingConfig) => void;
}

export const useDubbingConfigStore = create<DubbingConfigStore>()(
	persist(
		(set) => ({
			...DEFAULT_DUBBING_CONFIG,
			setConfigValue: (key, value) => set({ [key]: value }),
			migrateLegacyConfig: (config) =>
				set((current) => ({
					sourceLanguage: config.sourceLanguage ?? current.sourceLanguage,
					targetLanguage: config.targetLanguage ?? current.targetLanguage,
					assemblyApiKey: config.assemblyApiKey ?? current.assemblyApiKey,
					elevenLabsApiKey:
						config.elevenLabsApiKey ?? current.elevenLabsApiKey,
					deepSeekApiKey:
						config.deepSeekApiKey ??
						config.openAiApiKey ??
						current.deepSeekApiKey,
					synthesisProvider:
						config.synthesisProvider ?? current.synthesisProvider,
					localXttsEndpoint:
						config.localXttsEndpoint ?? current.localXttsEndpoint,
					localXttsVoiceSource:
						normalizeLocalXttsVoiceSource(config.localXttsVoiceSource) ??
						inferLocalXttsVoiceSource({
							requestFormat: config.localXttsRequestFormat,
						}) ??
						current.localXttsVoiceSource,
					localXttsSingleVoiceReferenceSource:
						config.localXttsSingleVoiceReferenceSource ??
						inferLocalXttsSingleVoiceReferenceSource({
							voiceSource: config.localXttsVoiceSource,
							requestFormat: config.localXttsRequestFormat,
						}) ??
						current.localXttsSingleVoiceReferenceSource,
					localXttsRequestFormat:
						config.localXttsRequestFormat ?? current.localXttsRequestFormat,
					localXttsSpeakerWav:
						config.localXttsSpeakerWav ?? current.localXttsSpeakerWav,
				})),
		}),
		{
			name: DUBBING_CONFIG_STORAGE_KEY,
			version: 2,
			partialize: ({
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
			}) => ({
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
			}),
			migrate: (persistedState) => {
				const state = persistedState as LegacyDubbingConfig | undefined;
				return {
					...DEFAULT_DUBBING_CONFIG,
					...state,
					deepSeekApiKey:
						state?.deepSeekApiKey ?? state?.openAiApiKey ?? "",
					synthesisProvider: state?.synthesisProvider ?? "elevenlabs",
					localXttsEndpoint:
						state?.localXttsEndpoint ??
						"http://localhost:8020/tts_to_audio/",
					localXttsVoiceSource:
						normalizeLocalXttsVoiceSource(state?.localXttsVoiceSource) ??
						inferLocalXttsVoiceSource({
							requestFormat: state?.localXttsRequestFormat,
						}),
					localXttsSingleVoiceReferenceSource:
						state?.localXttsSingleVoiceReferenceSource ??
						inferLocalXttsSingleVoiceReferenceSource({
							voiceSource: state?.localXttsVoiceSource,
							requestFormat: state?.localXttsRequestFormat,
						}),
					localXttsRequestFormat:
						state?.localXttsRequestFormat ?? "multipart",
					localXttsSpeakerWav: state?.localXttsSpeakerWav ?? "{speakerId}.wav",
				};
			},
		},
	),
);

function inferLocalXttsVoiceSource({
	requestFormat,
}: {
	requestFormat: DubbingConfig["localXttsRequestFormat"] | undefined;
}): DubbingConfig["localXttsVoiceSource"] {
	return requestFormat === "json" ? "single-reference" : "auto-speakers";
}

function inferLocalXttsSingleVoiceReferenceSource({
	voiceSource,
	requestFormat,
}: {
	voiceSource:
		| DubbingConfig["localXttsVoiceSource"]
		| "server-speaker-wav"
		| undefined;
	requestFormat: DubbingConfig["localXttsRequestFormat"] | undefined;
}): DubbingConfig["localXttsSingleVoiceReferenceSource"] {
	if (voiceSource === "server-speaker-wav" || requestFormat === "json") {
		return "library";
	}
	return "upload";
}

function normalizeLocalXttsVoiceSource(
	voiceSource:
		| DubbingConfig["localXttsVoiceSource"]
		| "server-speaker-wav"
		| undefined,
): DubbingConfig["localXttsVoiceSource"] | undefined {
	if (voiceSource === "server-speaker-wav") return "single-reference";
	return voiceSource;
}
