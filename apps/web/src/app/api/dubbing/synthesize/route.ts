import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { synthesizeSegment } from "@/services/dubbing/tts";

const postSchema = z.object({
	text: z.string().min(1, "text is required"),
	voiceId: z.string().min(1, "voiceId is required"),
	language: z.string().min(1, "language is required"),
	elevenlabsApiKey: z.string().min(1, "ElevenLabs API key is required"),
});

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

		const audioBuffer = await synthesizeSegment(
			parsed.data.text,
			parsed.data.voiceId,
			parsed.data.language,
			parsed.data.elevenlabsApiKey,
		);

		return new Response(audioBuffer, {
			status: 200,
			headers: {
				"content-type": "audio/mpeg",
				"cache-control": "no-store",
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Speech synthesis request failed",
			},
			{ status: 502 },
		);
	}
}
