"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import Image from "next/image";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/utils/ui";

type AssetTheme = "dark" | "light" | "icon";

export interface AssetVariant {
	src: string;
	theme: AssetTheme;
	label: string;
	width: number;
	height: number;
}

export interface AssetSection {
	title: string;
	description: string;
	cols: "1" | "2";
	assets: AssetVariant[];
}

function downloadAsset(src: string) {
	const filename = src.split("/").pop() ?? "asset.svg";
	const a = document.createElement("a");
	a.href = src;
	a.download = filename;
	a.click();
}

async function copyAsset(src: string) {
	const res = await fetch(src);
	const text = await res.text();
	await navigator.clipboard.writeText(text);
}

export function DownloadAllBrandAssetsButton({
	assets,
	label,
}: {
	assets: AssetVariant[];
	label: string;
}) {
	return (
		<Button
			variant="outline"
			size="lg"
			className="mx-auto gap-2"
			onClick={() => {
				assets.forEach((asset, i) => {
					setTimeout(() => downloadAsset(asset.src), i * 200);
				});
			}}
		>
			<Download />
			{label}
		</Button>
	);
}

export function BrandAssetSections({
	sections,
	copyLabel,
	copiedLabel,
}: {
	sections: AssetSection[];
	copyLabel: string;
	copiedLabel: string;
}) {
	return (
		<div className="flex flex-col gap-10">
			{sections.map((section) => (
				<div key={section.title} className="flex flex-col gap-4">
					<div className="flex flex-col gap-1">
						<h2 className="font-semibold text-lg">{section.title}</h2>
						<p className="text-muted-foreground text-sm">
							{section.description}
						</p>
					</div>
					<div
						className={cn(
							"grid gap-3",
							section.cols === "2"
								? "grid-cols-1 sm:grid-cols-2"
								: "grid-cols-1",
						)}
					>
						{section.assets.map((variant) => (
							<AssetCard
								key={variant.src}
								variant={variant}
								copyLabel={copyLabel}
								copiedLabel={copiedLabel}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

const CHECKER_STYLES: Record<"dark" | "light", CSSProperties> = {
	light: {
		backgroundImage:
			"linear-gradient(45deg, #292929 25%, transparent 25%), linear-gradient(-45deg, #292929 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #292929 75%), linear-gradient(-45deg, transparent 75%, #292929 75%)",
		backgroundSize: "18px 18px",
		backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0px",
		backgroundColor: "#000",
	},
	dark: {
		backgroundImage:
			"linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)",
		backgroundSize: "18px 18px",
		backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0px",
		backgroundColor: "#f5f5f5",
	},
};

function AssetCard({
	variant,
	copyLabel,
	copiedLabel,
}: {
	variant: AssetVariant;
	copyLabel: string;
	copiedLabel: string;
}) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		await copyAsset(variant.src);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<Card
			className="group relative overflow-hidden"
			style={
				variant.theme === "icon" ? undefined : CHECKER_STYLES[variant.theme]
			}
		>
			<div className="flex h-56 items-center justify-center px-12 py-8">
				<Image
					src={variant.src}
					alt={variant.label}
					width={variant.width}
					height={variant.height}
					className="max-h-16 w-auto select-none object-contain"
					draggable={false}
					unoptimized
				/>
			</div>

			<Button
				variant="outline"
				size="icon"
				className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 size-9"
				onClick={handleCopy}
				aria-label={copied ? copiedLabel : copyLabel}
			>
				{copied ? <Check /> : <Copy />}
			</Button>
		</Card>
	);
}
