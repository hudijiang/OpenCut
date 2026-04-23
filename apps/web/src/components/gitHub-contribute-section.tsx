import { getTranslations } from "next-intl/server";
import { Button } from "./ui/button";
import { Link } from "@/i18n/navigation";
import { SOCIAL_LINKS } from "@/lib/site/social";
import { GithubIcon, Link04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export async function GitHubContributeSection({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	const t = await getTranslations("site.contribute");

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-4 text-center">
				<h3 className="text-2xl font-semibold">{title}</h3>
				<p className="text-muted-foreground">{description}</p>
			</div>
			<div className="flex flex-col justify-center gap-4 sm:flex-row">
				<Link
					href={`${SOCIAL_LINKS.github}/blob/main/.github/CONTRIBUTING.md`}
					target="_blank"
					rel="noopener noreferrer"
				>
					<Button className="w-full" size="lg">
						<HugeiconsIcon icon={GithubIcon} />
						{t("start")}
					</Button>
				</Link>
				<Link
					href={`${SOCIAL_LINKS.github}/issues`}
					target="_blank"
					rel="noopener noreferrer"
				>
					<Button variant="outline" className="w-full" size="lg">
						<HugeiconsIcon icon={Link04Icon} />
						{t("report")}
					</Button>
				</Link>
			</div>
		</div>
	);
}
