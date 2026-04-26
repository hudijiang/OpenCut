import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { synthesizeLocalXttsSegment } from "@/services/dubbing/tts";
import {
	resolveLocalXttsVoicePath,
	saveLocalXttsSpeakerSample,
} from "@/services/dubbing/local-xtts-voices";

const requestFormatSchema = z.enum(["multipart", "json"]);

const fileSchema = z.custom<File>((value) => value instanceof File, {
	message: "speakerSample must be a file",
});

const payloadSchema = z.object({
	text: z.string().min(1, "text is required"),
	language: z.string().min(1, "language is required"),
	endpoint: z.string().min(1, "endpoint is required"),
	requestFormat: requestFormatSchema,
	speakerWav: z.string().min(1, "speakerWav is required"),
	speakerSample: fileSchema.optional(),
});

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const parsed = payloadSchema.safeParse({
			text: formData.get("text"),
			language: formData.get("language"),
			endpoint: formData.get("endpoint"),
			requestFormat: formData.get("requestFormat"),
			speakerWav: formData.get("speakerWav"),
			speakerSample: formData.get("speakerSample") ?? undefined,
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

		const speakerWav = parsed.data.speakerSample
			? await saveLocalXttsSpeakerSample({
					file: parsed.data.speakerSample,
					speakerId: parsed.data.speakerWav,
				})
			: parsed.data.requestFormat === "json"
				? resolveLocalXttsVoicePath({ fileName: parsed.data.speakerWav })
				: parsed.data.speakerWav;

		const result = await synthesizeLocalXttsSegment({
			...parsed.data,
			speakerSample: undefined,
			speakerWav,
		});

		return new Response(result.audioBuffer, {
			status: 200,
			headers: {
				"content-type": result.contentType,
				"cache-control": "no-store",
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Local XTTS synthesis request failed",
			},
			{ status: 502 },
		);
	}
}
