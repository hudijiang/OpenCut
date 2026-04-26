import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BasePage } from "@/app/base-page";
import { GitHubContributeSection } from "@/components/gitHub-contribute-section";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/routing";
import { ReactMarkdownWrapper } from "@/components/ui/react-markdown-wrapper";
import { cn } from "@/utils/ui";

type Props = {
	params: Promise<{ locale: Locale }>;
};

type StatusType = "complete" | "pending" | "default" | "info";

interface Status {
	text: string;
	type: StatusType;
}

interface RoadmapItem {
	title: string;
	description: string;
	status: Status;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({
		locale,
		namespace: "pages.roadmap.metadata",
	});

	return {
		title: t("title"),
		description: t("description"),
		openGraph: {
			title: t("openGraphTitle"),
			description: t("description"),
			type: "website",
			images: [
				{
					url: "/open-graph/roadmap.jpg",
					width: 1200,
					height: 630,
					alt: t("imageAlt"),
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title: t("openGraphTitle"),
			description: t("description"),
			images: ["/open-graph/roadmap.jpg"],
		},
	};
}

export default async function RoadmapPage() {
	const t = await getTranslations("pages.roadmap");
	const roadmapItems: RoadmapItem[] = [
		{
			title: t("items.start.title"),
			description: t("items.start.description"),
			status: {
				text: t("statuses.completed"),
				type: "complete",
			},
		},
		{
			title: t("items.coreUi.title"),
			description: t("items.coreUi.description"),
			status: {
				text: t("statuses.completed"),
				type: "complete",
			},
		},
		{
			title: t("items.essentialFunctionality.title"),
			description: t("items.essentialFunctionality.description"),
			status: {
				text: t("statuses.inProgress"),
				type: "pending",
			},
		},
		{
			title: t("items.nativeApp.title"),
			description: t("items.nativeApp.description"),
			status: {
				text: t("statuses.notStarted"),
				type: "default",
			},
		},
	];

	return (
		<BasePage
			title={t("title")}
			description={t("description", { lastUpdated: t("lastUpdated") })}
		>
			<div className="mx-auto flex max-w-4xl flex-col gap-16">
				<div className="flex flex-col gap-6">
					{roadmapItems.map((item, index) => (
						<RoadmapItem key={item.title} item={item} index={index} />
					))}
				</div>
				<GitHubContributeSection
					title={t("contribute.title")}
					description={t("contribute.description")}
				/>
			</div>
		</BasePage>
	);
}

function RoadmapItem({ item, index }: { item: RoadmapItem; index: number }) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-medium">
				<span className="leading-normal select-none">{index + 1}</span>
				<h3>{item.title}</h3>
				<StatusBadge status={item.status} className="ml-1" />
			</div>
			<div className="text-foreground/70 leading-relaxed">
				<ReactMarkdownWrapper>{item.description}</ReactMarkdownWrapper>
			</div>
		</div>
	);
}

function StatusBadge({
	status,
	className,
}: {
	status: Status;
	className?: string;
}) {
	return (
		<Badge
			className={cn("shadow-none", className, {
				"bg-green-500! text-white": status.type === "complete",
				"bg-yellow-500! text-white": status.type === "pending",
				"bg-blue-500! text-white": status.type === "info",
				"bg-foreground/10! text-accent-foreground": status.type === "default",
			})}
		>
			{status.text}
		</Badge>
	);
}
