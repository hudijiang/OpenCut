import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BasePage } from "@/app/base-page";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import type { Locale } from "@/i18n/routing";
import { Separator } from "@/components/ui/separator";
import { SOCIAL_LINKS } from "@/lib/site/social";

type Props = {
	params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({
		locale,
		namespace: "pages.privacy.metadata",
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

export default async function PrivacyPage() {
	const t = await getTranslations("pages.privacy");
	const quickSummaryItems = t.raw("quickSummary.items") as string[];
	const localStorageItems = t.raw("localStorage.items") as string[];
	const thirdPartyItems = t.raw("thirdParty.items") as string[];
	const rightsItems = t.raw("rights.items") as string[];

	return (
		<BasePage title={t("title")} description={t("description")}>
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem
					value="quick-summary"
					className="rounded-2xl border px-5"
				>
					<AccordionTrigger className="no-underline!">
						{t("quickSummary.title")}
					</AccordionTrigger>
					<AccordionContent>
						<h3 className="mb-3 text-lg font-medium">
							{t("quickSummary.heading")}
						</h3>
						<ol className="list-decimal space-y-2 pl-6">
							{quickSummaryItems.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ol>
						<p className="mt-4">
							{t("quickSummary.contactPrefix")}{" "}
							<a
								href="mailto:oss@opencut.app"
								className="text-primary hover:underline"
							>
								oss@opencut.app
							</a>
						</p>
					</AccordionContent>
				</AccordionItem>
			</Accordion>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("content.title")}</h2>
				<p>
					<strong>{t("content.lead")}</strong> {t("content.body")}
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("accounts.title")}</h2>
				<p>{t("accounts.p1")}</p>
				<p>{t("accounts.p2")}</p>
				<p>{t("accounts.p3")}</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("analytics.title")}</h2>
				<p>
					{t("analytics.p1Before")}{" "}
					<a
						href="https://www.databuddy.cc"
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						Databuddy
					</a>{" "}
					{t("analytics.p1After")}
				</p>
				<p>{t("analytics.p2")}</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("localStorage.title")}</h2>
				<p>{t("localStorage.intro")}</p>
				<ul className="list-disc space-y-2 pl-6">
					{localStorageItems.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
				<p>{t("localStorage.outro")}</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("thirdParty.title")}</h2>
				<p>{t("thirdParty.intro")}</p>
				<ul className="list-disc space-y-2 pl-6">
					{thirdPartyItems.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("rights.title")}</h2>
				<p>{t("rights.intro")}</p>
				<ul className="list-disc space-y-2 pl-6">
					{rightsItems.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("transparency.title")}</h2>
				<p>{t("transparency.p1")}</p>
				<p>
					{t("transparency.p2Before")}{" "}
					<a
						href={SOCIAL_LINKS.github}
						target="_blank"
						rel="noopener"
						className="text-primary hover:underline"
					>
						{t("transparency.github")}
					</a>
					{t("transparency.p2After")}
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("contact.title")}</h2>
				<p>{t("contact.intro")}</p>
				<p>
					{t("contact.beforeGithub")}{" "}
					<a
						href={`${SOCIAL_LINKS.github}/issues`}
						target="_blank"
						rel="noopener"
						className="text-primary hover:underline"
					>
						{t("contact.github")}
					</a>
					{t("contact.beforeEmail")}{" "}
					<a
						href="mailto:oss@opencut.app"
						className="text-primary hover:underline"
					>
						oss@opencut.app
					</a>
					{t("contact.beforeX")}{" "}
					<a
						href={SOCIAL_LINKS.x}
						target="_blank"
						rel="noopener"
						className="text-primary hover:underline"
					>
						{t("contact.x")}
					</a>
					{t("contact.afterX")}
				</p>
			</section>

			<Separator />

			<p className="text-muted-foreground text-sm">{t("lastUpdated")}</p>
		</BasePage>
	);
}
