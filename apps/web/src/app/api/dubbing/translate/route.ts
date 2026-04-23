import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SpeakerSegment } from "@/lib/dubbing/types";
import { translateSegments } from "@/services/dubbing/translation";

const segmentSchema = z.object({
	id: z.string().min(1),
	speakerId: z.string().min(1),
	startTime: z.number().nonnegative(),
	endTime: z.number().nonnegative(),
	text: z.string(),
	translatedText: z.string(),
});

const postSchema = z.object({
	segments: z.array(segmentSchema),
	targetLanguage: z.string().min(1, "targetLanguage is required"),
	openaiApiKey: z.string().min(1, "OpenAI API key is required"),
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

		const segments: SpeakerSegment[] = [];
		for (const segment of parsed.data.segments) {
			segments.push({
				...segment,
				audioBlob: null,
			});
		}

		const translatedSegments = await translateSegments(
			segments,
			parsed.data.targetLanguage,
			parsed.data.openaiApiKey,
		);

		return NextResponse.json({ translatedSegments }, { status: 200 });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Translation request failed",
			},
			{ status: 502 },
		);
	}
}
