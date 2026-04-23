import type { ReactNode } from "react";
import type { Messages } from "next-intl";
import type {
	EffectElement,
	GraphicElement,
	ImageElement,
	MaskableElement,
	RetimableElement,
	StickerElement,
	TextElement,
	VisualElement,
	VideoElement,
	AudioElement,
	TimelineElement,
} from "@/lib/timeline";
import type { MediaAsset } from "@/lib/media/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	TextFontIcon,
	ArrowExpandIcon,
	RainDropIcon,
	MusicNote03Icon,
	MagicWand05Icon,
	DashboardSpeed02Icon,
} from "@hugeicons/core-free-icons";
import { TransformTab } from "./tabs/transform-tab";
import { BlendingTab } from "./tabs/blending-tab";
import { AudioTab } from "./tabs/audio-tab";
import { TextTab } from "./tabs/text-tab";
import { ClipEffectsTab, StandaloneEffectTab } from "./tabs/effects-tab";
import { MasksTab } from "./tabs/masks-tab";
import { SpeedTab } from "./tabs/speed-tab";
import { GraphicTab } from "./tabs/graphic-tab";
import { OcShapesIcon } from "@/components/icons";

export type TabContentProps = {
	trackId: string;
};

export type PropertiesTabDef = {
	id: string;
	label: string;
	icon: ReactNode;
	content: (props: TabContentProps) => ReactNode;
};

export type ElementPropertiesConfig = {
	defaultTab: string;
	tabs: PropertiesTabDef[];
};

type PropertyTabLabels = Messages["properties"]["tabs"];

function buildTransformTab({
	element,
	labels,
}: {
	element: VisualElement;
	labels: PropertyTabLabels;
}): PropertiesTabDef {
	return {
		id: "transform",
		label: labels.transform,
		icon: <HugeiconsIcon icon={ArrowExpandIcon} size={16} />,
		content: ({ trackId }) => (
			<TransformTab element={element} trackId={trackId} />
		),
	};
}

function buildBlendingTab({
	element,
	labels,
}: {
	element: VisualElement;
	labels: PropertyTabLabels;
}): PropertiesTabDef {
	return {
		id: "blending",
		label: labels.blending,
		icon: <HugeiconsIcon icon={RainDropIcon} size={16} />,
		content: ({ trackId }) => (
			<BlendingTab element={element} trackId={trackId} />
		),
	};
}

function buildAudioTab({
	element,
	labels,
}: {
	element: AudioElement | VideoElement;
	labels: PropertyTabLabels;
}): PropertiesTabDef {
	return {
		id: "audio",
		label: labels.audio,
		icon: <HugeiconsIcon icon={MusicNote03Icon} size={16} />,
		content: ({ trackId }) => <AudioTab element={element} trackId={trackId} />,
	};
}

function buildSpeedTab({
	element,
	labels,
}: {
	element: RetimableElement;
	labels: PropertyTabLabels;
}): PropertiesTabDef {
	return {
		id: "speed",
		label: labels.speed,
		icon: <HugeiconsIcon icon={DashboardSpeed02Icon} size={16} />,
		content: ({ trackId }) => <SpeedTab element={element} trackId={trackId} />,
	};
}

function buildMasksTab({
	element,
	labels,
}: {
	element: MaskableElement;
	labels: PropertyTabLabels;
}): PropertiesTabDef {
	return {
		id: "masks",
		label: labels.masks,
		icon: <OcShapesIcon size={16} />,
		content: ({ trackId }) => <MasksTab element={element} trackId={trackId} />,
	};
}

function buildClipEffectsTab({
	element,
	labels,
}: {
	element: VisualElement;
	labels: PropertyTabLabels;
}): PropertiesTabDef {
	return {
		id: "effects",
		label: labels.effects,
		icon: <HugeiconsIcon icon={MagicWand05Icon} size={16} />,
		content: ({ trackId }) => (
			<ClipEffectsTab element={element} trackId={trackId} />
		),
	};
}

function buildTextTab({
	element,
	labels,
}: {
	element: TextElement;
	labels: PropertyTabLabels;
}): PropertiesTabDef {
	return {
		id: "text",
		label: labels.text,
		icon: <HugeiconsIcon icon={TextFontIcon} size={16} />,
		content: ({ trackId }) => <TextTab element={element} trackId={trackId} />,
	};
}

function buildGraphicTab({
	element,
	labels,
}: {
	element: GraphicElement;
	labels: PropertyTabLabels;
}): PropertiesTabDef {
	return {
		id: "graphic",
		label: labels.graphic,
		icon: <OcShapesIcon size={16} />,
		content: ({ trackId }) => (
			<GraphicTab element={element} trackId={trackId} />
		),
	};
}

function buildStandaloneEffectTab({
	element,
	labels,
}: {
	element: EffectElement;
	labels: PropertyTabLabels;
}): PropertiesTabDef {
	return {
		id: "effects",
		label: labels.effects,
		icon: <HugeiconsIcon icon={MagicWand05Icon} size={16} />,
		content: ({ trackId }) => (
			<StandaloneEffectTab element={element} trackId={trackId} />
		),
	};
}

function getTextConfig({
	element,
	labels,
}: {
	element: TextElement;
	labels: PropertyTabLabels;
}): ElementPropertiesConfig {
	return {
		defaultTab: "text",
		tabs: [
			buildTextTab({ element, labels }),
			buildTransformTab({ element, labels }),
			buildBlendingTab({ element, labels }),
		],
	};
}

function getVideoConfig({
	element,
	mediaAsset,
	labels,
}: {
	element: VideoElement;
	mediaAsset: MediaAsset | undefined;
	labels: PropertyTabLabels;
}): ElementPropertiesConfig {
	const showAudioTab = mediaAsset?.hasAudio !== false;
	return {
		defaultTab: "transform",
		tabs: [
			buildTransformTab({ element, labels }),
			...(showAudioTab ? [buildAudioTab({ element, labels })] : []),
			buildSpeedTab({ element, labels }),
			buildBlendingTab({ element, labels }),
			buildMasksTab({ element, labels }),
			buildClipEffectsTab({ element, labels }),
		],
	};
}

function getImageConfig({
	element,
	labels,
}: {
	element: ImageElement;
	labels: PropertyTabLabels;
}): ElementPropertiesConfig {
	return {
		defaultTab: "transform",
		tabs: [
			buildTransformTab({ element, labels }),
			buildBlendingTab({ element, labels }),
			buildMasksTab({ element, labels }),
			buildClipEffectsTab({ element, labels }),
		],
	};
}

function getStickerConfig({
	element,
	labels,
}: {
	element: StickerElement;
	labels: PropertyTabLabels;
}): ElementPropertiesConfig {
	return {
		defaultTab: "transform",
		tabs: [
			buildTransformTab({ element, labels }),
			buildBlendingTab({ element, labels }),
			buildClipEffectsTab({ element, labels }),
		],
	};
}

function getGraphicConfig({
	element,
	labels,
}: {
	element: GraphicElement;
	labels: PropertyTabLabels;
}): ElementPropertiesConfig {
	return {
		defaultTab: "graphic",
		tabs: [
			buildGraphicTab({ element, labels }),
			buildTransformTab({ element, labels }),
			buildBlendingTab({ element, labels }),
			buildMasksTab({ element, labels }),
			buildClipEffectsTab({ element, labels }),
		],
	};
}

function getAudioConfig({
	element,
	labels,
}: {
	element: AudioElement;
	labels: PropertyTabLabels;
}): ElementPropertiesConfig {
	return {
		defaultTab: "audio",
		tabs: [
			buildAudioTab({ element, labels }),
			buildSpeedTab({ element, labels }),
		],
	};
}

function getEffectConfig({
	element,
	labels,
}: {
	element: EffectElement;
	labels: PropertyTabLabels;
}): ElementPropertiesConfig {
	return {
		defaultTab: "effects",
		tabs: [buildStandaloneEffectTab({ element, labels })],
	};
}

export function getPropertiesConfig({
	element,
	mediaAssets,
	labels,
}: {
	element: TimelineElement;
	mediaAssets: MediaAsset[];
	labels: PropertyTabLabels;
}): ElementPropertiesConfig {
	switch (element.type) {
		case "text":
			return getTextConfig({ element, labels });
		case "video": {
			const mediaAsset = mediaAssets.find((a) => a.id === element.mediaId);
			return getVideoConfig({ element, mediaAsset, labels });
		}
		case "image":
			return getImageConfig({ element, labels });
		case "sticker":
			return getStickerConfig({ element, labels });
		case "graphic":
			return getGraphicConfig({ element, labels });
		case "audio":
			return getAudioConfig({ element, labels });
		case "effect":
			return getEffectConfig({ element, labels });
	}
}
