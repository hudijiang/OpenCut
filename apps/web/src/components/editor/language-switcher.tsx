"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const localeOrder: Locale[] = ["zh", "en"];

export function LanguageSwitcher() {
	const t = useTranslations("editor.languageSwitcher");
	const locale = useLocale() as Locale;
	const pathname = usePathname();
	const router = useRouter();
	const nextLocale = locale === "zh" ? "en" : "zh";

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={() => router.replace(pathname, { locale: nextLocale })}
			aria-label={t("label")}
			className="gap-2"
		>
			{localeOrder.map((value) => (
				<span
					key={value}
					className={value === locale ? "font-medium" : "text-muted-foreground"}
				>
					{t(value)}
				</span>
			))}
		</Button>
	);
}
