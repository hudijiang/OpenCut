import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
	if (request.nextUrl.pathname === "/") {
		return NextResponse.redirect(new URL("/zh/projects", request.url));
	}

	return intlMiddleware(request);
}

export const config = {
	matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
