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
		namespace: "pages.terms.metadata",
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

export default async function TermsPage() {
	const t = await getTranslations("pages.terms");
	const quickSummaryItems = t.raw("quickSummary.items") as string[];
	const rightsItems = t.raw("rights.items") as string[];
	const usageItems = t.raw("usage.items") as string[];
	const openSourceItems = t.raw("openSource.items") as string[];
	const limitationsItems = t.raw("limitations.items") as string[];
	const serviceChangesItems = t.raw("serviceChanges.items") as string[];
	const stoppingUseItems = t.raw("stoppingUse.items") as string[];

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
				<h2 className="text-2xl font-semibold">{t("rights.title")}</h2>
				<p>
					<strong>{t("rights.lead")}</strong> {t("rights.body")}
				</p>
				<ul className="list-disc space-y-2 pl-6">
					{rightsItems.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("usage.title")}</h2>
				<p>{t("usage.intro")}</p>
				<ul className="list-disc space-y-2 pl-6">
					{usageItems.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
				<p>{t("usage.outro")}</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("ai.title")}</h2>
				<p>{t("ai.body")}</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("service.title")}</h2>
				<p>{t("service.body")}</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("openSource.title")}</h2>
				<p>{t("openSource.intro")}</p>
				<ul className="list-disc space-y-2 pl-6">
					{openSourceItems.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
				<p>
					{t("openSource.beforeGithub")}{" "}
					<a
						href={SOCIAL_LINKS.github}
						target="_blank"
						rel="noopener"
						className="text-primary hover:underline"
					>
						{t("openSource.github")}
					</a>
					{t("openSource.afterGithub")}
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("limitations.title")}</h2>
				<p>{t("limitations.intro")}</p>
				<ul className="list-disc space-y-2 pl-6">
					{limitationsItems.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
				<p>{t("limitations.outro")}</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("serviceChanges.title")}</h2>
				<p>{t("serviceChanges.intro")}</p>
				<ul className="list-disc space-y-2 pl-6">
					{serviceChangesItems.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">{t("stoppingUse.title")}</h2>
				<p>{t("stoppingUse.intro")}</p>
				<ul className="list-disc space-y-2 pl-6">
					{stoppingUseItems.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
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
				<p>{t("contact.outro")}</p>
			</section>
			<Separator />
			<p className="text-muted-foreground text-sm">{t("lastUpdated")}</p>
		</BasePage>
	);
}
