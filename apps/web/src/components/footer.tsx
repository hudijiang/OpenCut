import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RiDiscordFill, RiTwitterXLine } from "react-icons/ri";
import { FaGithub } from "react-icons/fa6";
import Image from "next/image";
import { DEFAULT_LOGO_URL } from "@/lib/site/brand";
import { SOCIAL_LINKS } from "@/lib/site/social";

type Category = "resources" | "company";

const links = {
	resources: [
		{ labelKey: "links.resources.roadmap", href: "/roadmap" },
		{ labelKey: "links.resources.changelog", href: "/changelog" },
		{ labelKey: "links.resources.blog", href: "/blog" },
		{ labelKey: "links.resources.privacy", href: "/privacy" },
		{ labelKey: "links.resources.terms", href: "/terms" },
	],
	company: [
		{ labelKey: "links.company.contributors", href: "/contributors" },
		{ labelKey: "links.company.sponsors", href: "/sponsors" },
		{ labelKey: "links.company.brand", href: "/brand" },
		{
			labelKey: "links.company.about",
			href: `${SOCIAL_LINKS.github}/blob/main/README.md`,
		},
	],
} as const satisfies Record<
	Category,
	readonly { labelKey: string; href: string }[]
>;

export function Footer() {
	return <TranslatedFooter />;
}

async function TranslatedFooter() {
	const t = await getTranslations("site.footer");

	return (
		<footer className="bg-background border-t">
			<div className="mx-auto max-w-5xl px-8 py-10">
				<div className="mb-8 grid grid-cols-1 gap-12 md:grid-cols-2">
					{/* Brand Section */}
					<div className="max-w-sm md:col-span-1">
						<div className="mb-4 flex items-center justify-start gap-2">
							<Image
								src={DEFAULT_LOGO_URL}
								alt="OpenCut"
								width={24}
								height={24}
								className="invert dark:invert-0"
							/>
							<span className="text-lg font-bold">OpenCut</span>
						</div>
						<p className="text-muted-foreground mb-5 text-sm md:text-left">
							{t("tagline")}
						</p>
						<div className="flex justify-start gap-3">
							<Link
								href={SOCIAL_LINKS.github}
								className="text-muted-foreground hover:text-foreground transition-colors"
								target="_blank"
								rel="noopener noreferrer"
							>
								<FaGithub className="size-5" />
							</Link>
							<Link
								href={SOCIAL_LINKS.x}
								className="text-muted-foreground hover:text-foreground transition-colors"
								target="_blank"
								rel="noopener noreferrer"
							>
								<RiTwitterXLine className="size-5" />
							</Link>
							<Link
								href={SOCIAL_LINKS.discord}
								className="text-muted-foreground hover:text-foreground transition-colors"
								target="_blank"
								rel="noopener noreferrer"
							>
								<RiDiscordFill className="size-5" />
							</Link>
						</div>
					</div>

					<div className="flex items-start justify-start gap-12 py-2">
						{(Object.keys(links) as Category[]).map((category) => (
							<div key={category} className="flex flex-col gap-2">
								<h3 className="text-foreground font-semibold">
									{category === "resources"
										? t("sections.resources")
										: t("sections.company")}
								</h3>
								<ul className="space-y-2 text-sm">
									{links[category].map((link) => (
										<li key={link.href}>
											<Link
												href={link.href}
												className="text-muted-foreground hover:text-foreground transition-colors"
												target={
													link.href.startsWith("http") ? "_blank" : undefined
												}
												rel={
													link.href.startsWith("http")
														? "noopener noreferrer"
														: undefined
												}
											>
												{t(link.labelKey)}
											</Link>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>

				{/* Bottom Section */}
				<div className="flex flex-col items-start justify-between gap-4 pt-2 md:flex-row">
					<div className="text-muted-foreground flex items-center gap-4 text-sm">
						<span>{t("copyright", { year: new Date().getFullYear() })}</span>
					</div>
				</div>
			</div>
		</footer>
	);
}
