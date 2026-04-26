import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BasePage } from "@/app/base-page";
import { Separator } from "@/components/ui/separator";
import type { Locale } from "@/i18n/routing";
import { getPosts } from "@/lib/blog/query";
import type { Post } from "@/lib/blog/types";

type Props = {
	params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pages.blog.metadata" });

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

export default async function BlogPage() {
	const t = await getTranslations("pages.blog");
	const data = await getPosts().catch(() => null);
	if (!data || !data.posts) return <div>{t("empty")}</div>;

	return (
		<BasePage title={t("title")} description={t("description")}>
			<div className="flex flex-col">
				{data.posts.map((post) => (
					<div key={post.id} className="flex flex-col">
						<BlogPostItem post={post} />
						<Separator />
					</div>
				))}
			</div>
		</BasePage>
	);
}

function BlogPostItem({ post }: { post: Post }) {
	return (
		<Link href={`/blog/${post.slug}`}>
			<div className="flex h-auto w-full items-center justify-between py-6 opacity-100 hover:opacity-75">
				<div className="flex flex-col gap-2">
					<h2 className="text-xl font-semibold">{post.title}</h2>
					<p className="text-muted-foreground">{post.description}</p>
				</div>
			</div>
		</Link>
	);
}
