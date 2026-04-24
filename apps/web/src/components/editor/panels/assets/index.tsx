"use client";

import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import { type Tab, useAssetsPanelStore } from "@/stores/assets-panel-store";
import { TabBar } from "./tabbar";
import { Captions } from "./views/captions";
import { MediaView } from "./views/assets";
import { SettingsView } from "./views/settings";
import { SoundsView } from "./views/sounds";
import { StickersView } from "./views/stickers";
import { TemplateAssetsView } from "./views/template-assets";
import { TextView } from "./views/text";
import { EffectsView } from "./views/effects";
import { DubbingView } from "./views/dubbing";
import { QuickCutView } from "./views/quick-cut";

export function AssetsPanel() {
	const t = useTranslations("assetPanel");
	const { activeTab } = useAssetsPanelStore();

	const viewMap: Record<Tab, React.ReactNode> = {
		media: <MediaView />,
		template: <TemplateAssetsView />,
		sounds: <SoundsView />,
		text: <TextView />,
		stickers: <StickersView />,
		effects: <EffectsView />,
		transitions: (
			<div className="text-muted-foreground p-4">
				{t("transitionsComingSoon")}
			</div>
		),
		captions: <Captions />,
		quickCut: <QuickCutView />,
		adjustment: <DubbingView />,
		settings: <SettingsView />,
	};

	return (
		<div className="panel bg-background flex h-full rounded-sm border overflow-hidden">
			<TabBar />
			<Separator orientation="vertical" />
			<div className="flex-1 overflow-hidden">{viewMap[activeTab]}</div>
		</div>
	);
}
