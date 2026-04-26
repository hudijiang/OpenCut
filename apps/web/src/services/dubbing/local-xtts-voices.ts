import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const LOCAL_XTTS_VOICE_FOLDER = path.join(
	findProjectRoot({ startDirectory: process.cwd() }),
	"xtts-voices",
);

export const LOCAL_XTTS_VOICE_EXTENSIONS = new Set([
	".aac",
	".flac",
	".m4a",
	".mp3",
	".ogg",
	".opus",
	".wav",
	".webm",
]);

export function resolveLocalXttsVoicePath({
	fileName,
}: {
	fileName: string;
}): string {
	const resolvedPath = path.resolve(LOCAL_XTTS_VOICE_FOLDER, fileName);
	const voiceFolder = path.resolve(LOCAL_XTTS_VOICE_FOLDER);

	if (resolvedPath !== voiceFolder && resolvedPath.startsWith(`${voiceFolder}${path.sep}`)) {
		return resolvedPath;
	}

	throw new Error("Invalid local XTTS voice file");
}

export async function saveLocalXttsSpeakerSample({
	file,
	speakerId,
}: {
	file: File;
	speakerId: string;
}): Promise<string> {
	const generatedFolder = path.join(LOCAL_XTTS_VOICE_FOLDER, "_generated");
	await mkdir(generatedFolder, { recursive: true });

	const buffer = Buffer.from(await file.arrayBuffer());
	const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
	const extension = normalizeVoiceExtension(path.extname(file.name));
	const fileName = `${sanitizeFilePart(speakerId)}-${hash}${extension}`;
	const filePath = path.join(generatedFolder, fileName);
	if (!existsSync(filePath)) {
		await writeFile(filePath, buffer);
	}
	return filePath;
}

function normalizeVoiceExtension(extension: string): string {
	const normalized = extension.toLowerCase();
	return LOCAL_XTTS_VOICE_EXTENSIONS.has(normalized) ? normalized : ".wav";
}

function sanitizeFilePart(value: string): string {
	const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
	return sanitized.length > 0 ? sanitized : "speaker";
}

function findProjectRoot({
	startDirectory,
}: {
	startDirectory: string;
}): string {
	let currentDirectory = path.resolve(startDirectory);

	while (true) {
		if (
			existsSync(path.join(currentDirectory, "package.json")) &&
			existsSync(path.join(currentDirectory, "apps")) &&
			existsSync(path.join(currentDirectory, "rust"))
		) {
			return currentDirectory;
		}

		const parentDirectory = path.dirname(currentDirectory);
		if (parentDirectory === currentDirectory) {
			return path.resolve(startDirectory);
		}
		currentDirectory = parentDirectory;
	}
}
