import { getRequestConfig } from "next-intl/server";
import { isLocale, routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
	const requestedLocale = await requestLocale;
	const locale =
		requestedLocale && isLocale(requestedLocale)
			? requestedLocale
			: routing.defaultLocale;

	return {
		locale,
		messages: (await import(`../../messages/${locale}.json`)).default,
	};
});
