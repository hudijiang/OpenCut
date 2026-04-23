import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cloneVoice } from "@/services/dubbing/tts";

const fileSchema = z.custom<File>((value) => value instanceof File, {
	message: "audioSamples must be files",
});

const payloadSchema = z.object({
	speakerId: z.string().min(1, "speakerId is required"),
	elevenlabsApiKey: z.string().min(1, "ElevenLabs API key is required"),
	audioSamples: z
		.array(fileSchema)
		.min(1, "At least one audio sample is required"),
});

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const audioSamplesEntries = [
			...formData.getAll("audioSamples[]"),
			...formData.getAll("audioSamples"),
		];
		const parsed = payloadSchema.safeParse({
			speakerId: formData.get("speakerId"),
			elevenlabsApiKey: formData.get("elevenlabsApiKey"),
			audioSamples: audioSamplesEntries,
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

		const result = await cloneVoice(
			parsed.data.speakerId,
			parsed.data.audioSamples,
			parsed.data.elevenlabsApiKey,
		);

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Voice cloning request failed",
			},
			{ status: 502 },
		);
	}
}
