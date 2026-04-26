import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
	LOCAL_XTTS_VOICE_EXTENSIONS,
	LOCAL_XTTS_VOICE_FOLDER,
} from "@/services/dubbing/local-xtts-voices";

export async function GET() {
	try {
		await mkdir(LOCAL_XTTS_VOICE_FOLDER, { recursive: true });
		const entries = await readdir(LOCAL_XTTS_VOICE_FOLDER, {
			withFileTypes: true,
		});
		const files = entries
			.filter((entry) => entry.isFile())
			.map((entry) => entry.name)
			.filter((fileName) =>
				LOCAL_XTTS_VOICE_EXTENSIONS.has(path.extname(fileName).toLowerCase()),
			)
			.sort((a, b) => a.localeCompare(b));

		return NextResponse.json({ files, folder: LOCAL_XTTS_VOICE_FOLDER });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to load local XTTS voice files",
			},
			{ status: 400 },
		);
	}
}
