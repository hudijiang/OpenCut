import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { BasePage } from "@/app/base-page";
import { Card, CardContent } from "@/components/ui/card";
import { SPONSORS, type Sponsor } from "@/lib/site/sponsors";
import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/utils/ui";

type Props = {
	params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({
		locale,
		namespace: "pages.sponsors.metadata",
	});

	return {
		title: t("title"),
		description: t("description"),
		openGraph: {
			title: t("title"),
			description: t("description"),
			type: "website",
		},
	};
}

export default async function SponsorsPage() {
	const t = await getTranslations("pages.sponsors");

	return (
		<BasePage>
			<div className="flex flex-col gap-8 text-center">
				<h1 className="text-5xl font-bold tracking-tight md:text-6xl">
					{t("title")}
				</h1>
				<p className="text-muted-foreground mx-auto max-w-2xl text-xl leading-relaxed text-pretty">
					{t("description")}
				</p>
			</div>
			<SponsorsGrid logoAlt={t("logoAlt")} />
		</BasePage>
	);
}

function SponsorsGrid({ logoAlt }: { logoAlt: string }) {
	return (
		<div className="grid gap-6 sm:grid-cols-2">
			{SPONSORS.map((sponsor) => (
				<SponsorCard key={sponsor.name} sponsor={sponsor} logoAlt={logoAlt} />
			))}
		</div>
	);
}

function SponsorCard({
	sponsor,
	logoAlt,
}: {
	sponsor: Sponsor;
	logoAlt: string;
}) {
	return (
		<Link
			href={sponsor.url}
			target="_blank"
			rel="noopener noreferrer"
			className="size-full"
		>
			<Card className="h-full">
				<CardContent className="flex h-full flex-col justify-center gap-8 p-8">
					<Image
						src={sponsor.logo}
						alt={logoAlt.replace("{name}", sponsor.name)}
						width={50}
						height={50}
						className={cn(
							"object-contain",
							sponsor.invertOnDark && "invert-0 dark:invert",
						)}
					/>
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<h3 className="text-xl font-semibold group-hover:underline">
								{sponsor.name}
							</h3>
							<HugeiconsIcon
								icon={LinkSquare02Icon}
								className="text-muted-foreground size-4"
							/>
						</div>
						<p className="text-muted-foreground">{sponsor.description}</p>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}
