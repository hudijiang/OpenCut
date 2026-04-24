import type { EditorCore } from "@/core";
import {
	AddTrackCommand,
	BatchCommand,
	InsertElementCommand,
} from "@/lib/commands";
import { createElementSelectionResult } from "@/lib/commands/base-command";
import { buildSubtitleTextElement } from "./build-subtitle-text-element";
import type { SubtitleCue } from "./types";

class InsertSubtitleBatchCommand extends BatchCommand {
	constructor(
		commands: Array<AddTrackCommand | InsertElementCommand>,
		private readonly selectedElements: Array<{
			trackId: string;
			elementId: string;
		}>,
	) {
		super(commands);
	}

	execute() {
		super.execute();
		return createElementSelectionResult(this.selectedElements);
	}

	redo() {
		super.redo();
		return createElementSelectionResult(this.selectedElements);
	}
}

export function insertCaptionChunksAsTextTrack({
	editor,
	captions,
}: {
	editor: EditorCore;
	captions: SubtitleCue[];
}): string | null {
	if (captions.length === 0) {
		return null;
	}

	const addTrackCommand = new AddTrackCommand("text", 0);
	const trackId = addTrackCommand.getTrackId();
	const canvasSize = editor.project.getActive().settings.canvasSize;
	const insertCommands = captions.map(
		(caption, index) =>
			new InsertElementCommand({
				placement: { mode: "explicit", trackId },
				element: buildSubtitleTextElement({
					index,
					caption,
					canvasSize,
				}),
			}),
	);
	const selection = insertCommands.map((command) => ({
		trackId,
		elementId: command.getElementId(),
	}));
	editor.command.execute({
		command: new InsertSubtitleBatchCommand(
			[addTrackCommand, ...insertCommands],
			selection,
		),
	});

	return trackId;
}
