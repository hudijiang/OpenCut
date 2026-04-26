import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BasePage } from "@/app/base-page";
import { Separator } from "@/components/ui/separator";
import {
	BrandAssetSections,
	DownloadAllBrandAssetsButton,
	type AssetSection,
} from "./brand-assets";

export default async function BrandPage() {
	const t = await getTranslations("pages.brand");
	const assetSections: AssetSection[] = [
		{
			title: t("sections.symbol.title"),
			description: t("sections.symbol.description"),
			cols: "2",
			assets: [
				{
					src: "/logos/opencut/symbol.svg",
					theme: "dark",
					label: t("assetLabels.symbol"),
					width: 400,
					height: 400,
				},
				{
					src: "/logos/opencut/symbol-light.svg",
					theme: "light",
					label: t("assetLabels.symbol"),
					width: 400,
					height: 400,
				},
			],
		},
		{
			title: t("sections.lockup.title"),
			description: t("sections.lockup.description"),
			cols: "2",
			assets: [
				{
					src: "/logos/opencut/logo.svg",
					theme: "dark",
					label: t("assetLabels.logo"),
					width: 1809,
					height: 400,
				},
				{
					src: "/logos/opencut/logo-light.svg",
					theme: "light",
					label: t("assetLabels.logo"),
					width: 1809,
					height: 400,
				},
				{
					src: "/logos/opencut/text.svg",
					theme: "dark",
					label: t("assetLabels.text"),
					width: 1760,
					height: 400,
				},
				{
					src: "/logos/opencut/text-light.svg",
					theme: "light",
					label: t("assetLabels.text"),
					width: 1760,
					height: 400,
				},
			],
		},
	];
	const allAssets = assetSections.flatMap((section) => section.assets);
	const disallowedItems = t.raw("notAllowed.items") as string[];

	return (
		<BasePage
			maxWidth="6xl"
			title={t("title")}
			description={
				<>
					{t("description")}{" "}
					<Link href="#guidelines" className="underline underline-offset-4">
						{t("readGuidelines")}
					</Link>
				</>
			}
			action={
				<DownloadAllBrandAssetsButton
					assets={allAssets}
					label={t("downloadAll")}
				/>
			}
		>
			<BrandAssetSections
				sections={assetSections}
				copyLabel={t("copy")}
				copiedLabel={t("copied")}
			/>

			<Separator />

			<div id="guidelines" className="flex flex-col gap-8 text-sm">
				<div className="flex flex-col gap-3">
					<h2 className="font-semibold text-lg">{t("usage.title")}</h2>
					<p className="text-muted-foreground text-base leading-relaxed">
						{t("usage.description")}{" "}
						<Link
							href="mailto:brand@opencut.app"
							className="underline underline-offset-4"
						>
							brand@opencut.app
						</Link>
						{t("usage.afterEmail")}
					</p>
				</div>

				<div className="flex flex-col gap-3">
					<h2 className="font-semibold text-lg">{t("notAllowed.title")}</h2>
					<ul className="text-muted-foreground text-base flex flex-col gap-2 leading-relaxed">
						{disallowedItems.map((item) => (
							<li key={item} className="flex gap-2">
								<span className="mt-0.5 shrink-0">-</span>
								<span>{item}</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</BasePage>
	);
}
