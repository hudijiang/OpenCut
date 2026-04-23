import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
	pollTranscriptionResult,
	submitAudioForTranscription,
} from "@/services/dubbing/diarization";

const postSchema = z.object({
	audioBase64: z.string().min(1, "audioBase64 is required"),
	mimeType: z.string().min(1, "mimeType is required"),
	assemblyApiKey: z.string().min(1, "AssemblyAI API key is required"),
});

const getSchema = z.object({
	transcriptId: z.string().min(1, "transcriptId is required"),
	assemblyApiKey: z.string().min(1, "AssemblyAI API key is required"),
});

function decodeBase64Audio({
	audioBase64,
	mimeType,
}: {
	audioBase64: string;
	mimeType: string;
}): Blob {
	const bytes = Buffer.from(audioBase64, "base64");
	return new Blob([bytes], { type: mimeType });
}

export async function POST(request: NextRequest) {
	try {
		const body: unknown = await request.json();
		const parsed = postSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{
					error: "Invalid input",
					details: parsed.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		const audioBlob = decodeBase64Audio({
			audioBase64: parsed.data.audioBase64,
			mimeType: parsed.data.mimeType,
		});
		const transcriptId = await submitAudioForTranscription(
			audioBlob,
			parsed.data.assemblyApiKey,
		);

		return NextResponse.json({ transcriptId }, { status: 200 });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to submit transcription request",
			},
			{ status: 502 },
		);
	}
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const parsed = getSchema.safeParse({
			transcriptId: searchParams.get("transcriptId"),
			assemblyApiKey: searchParams.get("assemblyApiKey"),
		});

		if (!parsed.success) {
			return NextResponse.json(
				{
					error: "Invalid input",
					details: parsed.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		const transcript = await pollTranscriptionResult(
			parsed.data.transcriptId,
			parsed.data.assemblyApiKey,
		);

		return NextResponse.json({ transcript }, { status: 200 });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to fetch transcription result",
			},
			{ status: 502 },
		);
	}
}
