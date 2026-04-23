import { DEFAULT_BACKGROUND_COLOR } from "@/lib/background/color";
import { DEFAULT_CANVAS_SIZE } from "@/lib/canvas/sizes";
import { DEFAULT_FPS } from "@/lib/fps/defaults";
import { DEFAULTS } from "@/lib/timeline/defaults";
import type { TProjectSettings } from "@/lib/project/types";
import type { TScene } from "@/lib/timeline";
import { TICKS_PER_SECOND } from "@/lib/wasm/ticks";
import type { Template } from "./types";

const now = new Date("2026-04-23T00:00:00.000Z");

const defaultProjectSettings: TProjectSettings = {
	fps: DEFAULT_FPS,
	canvasSize: DEFAULT_CANVAS_SIZE,
	canvasSizeMode: "preset",
	lastCustomCanvasSize: null,
	originalCanvasSize: null,
	background: {
		type: "color",
		color: DEFAULT_BACKGROUND_COLOR,
	},
};

function textElement({
	id,
	name,
	content,
	fontSize,
	startTime,
	duration,
	x = 0,
	y,
	bold = false,
	background,
}: {
	id: string;
	name: string;
	content: string;
	fontSize: number;
	startTime: number;
	duration: number;
	x?: number;
	y: number;
	bold?: boolean;
	background?: {
		enabled: boolean;
		color: string;
		cornerRadius?: number;
		paddingX?: number;
		paddingY?: number;
		offsetX?: number;
		offsetY?: number;
	};
}) {
	return {
		id,
		type: "text" as const,
		name,
		content,
		fontSize,
		fontFamily: "Arial",
		color: "#FFFFFF",
		background: background ?? {
			enabled: false,
			color: "#000000",
		},
		textAlign: "center" as const,
		fontWeight: bold ? ("bold" as const) : ("normal" as const),
		fontStyle: "normal" as const,
		textDecoration: "none" as const,
		letterSpacing: 0,
		lineHeight: 1.1,
		duration: duration * TICKS_PER_SECOND,
		startTime: startTime * TICKS_PER_SECOND,
		trimStart: 0,
		trimEnd: 0,
		transform: {
			...DEFAULTS.element.transform,
			position: { x, y },
		},
		opacity: 1,
	};
}

function mediaElement({
	id,
	name,
	slotId,
	type,
	duration,
	startTime,
	x = 0,
	y = 0,
	scaleX = 1,
	scaleY = 1,
}: {
	id: string;
	name: string;
	slotId: string;
	type: "video" | "image";
	duration: number;
	startTime: number;
	x?: number;
	y?: number;
	scaleX?: number;
	scaleY?: number;
}) {
	return {
		id,
		type,
		name,
		mediaId: slotId,
		duration: duration * TICKS_PER_SECOND,
		startTime: startTime * TICKS_PER_SECOND,
		trimStart: 0,
		trimEnd: 0,
		sourceDuration: duration * TICKS_PER_SECOND,
		transform: {
			...DEFAULTS.element.transform,
			scaleX,
			scaleY,
			position: { x, y },
		},
		opacity: 1,
		...(type === "video"
			? {
					volume: 1,
					muted: false,
					isSourceAudioEnabled: true,
					hidden: false,
				}
			: {
					hidden: false,
				}),
	};
}

type BuiltInScene = Omit<
	TScene,
	"isMain" | "bookmarks" | "createdAt" | "updatedAt"
>;

type BuiltInProjectScene = BuiltInScene;

function projectTemplate({
	id,
	name,
	description,
	tags,
	mediaSlots,
	scene,
}: {
	id: string;
	name: string;
	description: string;
	tags: string[];
	mediaSlots: Template["mediaSlots"];
	scene: BuiltInProjectScene;
}) {
	return {
		id,
		name,
		description,
		kind: "project" as const,
		source: "built-in" as const,
		tags,
		locale: "en",
		version: 1,
		createdAt: now,
		updatedAt: now,
		mediaSlots,
		assets: [],
		project: {
			name,
			currentSceneId: scene.id,
			settings: defaultProjectSettings,
			timelineViewState: DEFAULTS.timeline.viewState,
			scenes: [
				{
					...scene,
					isMain: true,
					bookmarks: [],
					createdAt: now,
					updatedAt: now,
				},
			],
		},
	} satisfies Template;
}

function sceneTemplate({
	id,
	name,
	description,
	tags,
	mediaSlots,
	scene,
}: {
	id: string;
	name: string;
	description: string;
	tags: string[];
	mediaSlots: Template["mediaSlots"];
	scene: BuiltInScene;
}) {
	return {
		id,
		name,
		description,
		kind: "scene" as const,
		source: "built-in" as const,
		tags,
		locale: "en",
		version: 1,
		createdAt: now,
		updatedAt: now,
		mediaSlots,
		assets: [],
		scene: {
			scene: {
				...scene,
				isMain: false,
				bookmarks: [],
				createdAt: now,
				updatedAt: now,
			},
		},
	} satisfies Template;
}

export const BUILT_IN_TEMPLATES: Template[] = [
	projectTemplate({
		id: "builtin-project-talking-head",
		name: "Talking Head Starter",
		description:
			"Drop in a main video, then customize the title and subtitle for a quick social edit.",
		tags: ["social", "talking-head", "starter"],
		mediaSlots: [
			{
				id: "slot-main-video",
				label: "Main video",
				accept: ["video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-talking-head",
						trackId: "track-main-video",
						elementId: "element-main-video",
					},
				],
			},
		],
		scene: {
			id: "scene-talking-head",
			name: "Main scene",
			tracks: {
				overlay: [
					{
						id: "track-title",
						name: "Title",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-title",
								name: "Title",
								content: "Your hook goes here",
								fontSize: 92,
								startTime: 0,
								duration: 3,
								y: -320,
								bold: true,
							}),
							textElement({
								id: "element-subtitle",
								name: "Subtitle",
								content: "Add a punchy supporting line",
								fontSize: 46,
								startTime: 3,
								duration: 3,
								y: 350,
								background: {
									enabled: true,
									color: "#111111",
									cornerRadius: 24,
									paddingX: 30,
									paddingY: 18,
									offsetX: 0,
									offsetY: 0,
								},
							}),
						],
					},
				],
				main: {
					id: "track-main-video",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-main-video",
							name: "Main video",
							slotId: "slot-main-video",
							type: "video",
							duration: 6,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	projectTemplate({
		id: "builtin-project-photo-slideshow",
		name: "Photo Slideshow Reel",
		description:
			"Five-photo slideshow starter for travel, memories, or recap edits.",
		tags: ["social", "slideshow", "reel", "photos"],
		mediaSlots: [
			{
				id: "slot-photo-1",
				label: "Photo 1",
				accept: ["image"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-photo-slideshow",
						trackId: "track-main-slideshow",
						elementId: "element-photo-1",
					},
				],
			},
			{
				id: "slot-photo-2",
				label: "Photo 2",
				accept: ["image"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-photo-slideshow",
						trackId: "track-main-slideshow",
						elementId: "element-photo-2",
					},
				],
			},
			{
				id: "slot-photo-3",
				label: "Photo 3",
				accept: ["image"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-photo-slideshow",
						trackId: "track-main-slideshow",
						elementId: "element-photo-3",
					},
				],
			},
			{
				id: "slot-photo-4",
				label: "Photo 4",
				accept: ["image"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-photo-slideshow",
						trackId: "track-main-slideshow",
						elementId: "element-photo-4",
					},
				],
			},
			{
				id: "slot-photo-5",
				label: "Photo 5",
				accept: ["image"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-photo-slideshow",
						trackId: "track-main-slideshow",
						elementId: "element-photo-5",
					},
				],
			},
		],
		scene: {
			id: "scene-photo-slideshow",
			name: "Slideshow",
			tracks: {
				overlay: [
					{
						id: "track-slideshow-title",
						name: "Title",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-slideshow-title",
								name: "Title",
								content: "Weekend recap",
								fontSize: 72,
								startTime: 0,
								duration: 10,
								y: -380,
								bold: true,
							}),
						],
					},
				],
				main: {
					id: "track-main-slideshow",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-photo-1",
							name: "Photo 1",
							slotId: "slot-photo-1",
							type: "image",
							duration: 2,
							startTime: 0,
						}),
						mediaElement({
							id: "element-photo-2",
							name: "Photo 2",
							slotId: "slot-photo-2",
							type: "image",
							duration: 2,
							startTime: 2,
						}),
						mediaElement({
							id: "element-photo-3",
							name: "Photo 3",
							slotId: "slot-photo-3",
							type: "image",
							duration: 2,
							startTime: 4,
						}),
						mediaElement({
							id: "element-photo-4",
							name: "Photo 4",
							slotId: "slot-photo-4",
							type: "image",
							duration: 2,
							startTime: 6,
						}),
						mediaElement({
							id: "element-photo-5",
							name: "Photo 5",
							slotId: "slot-photo-5",
							type: "image",
							duration: 2,
							startTime: 8,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	projectTemplate({
		id: "builtin-project-product-promo",
		name: "Product Promo",
		description:
			"Simple commerce promo with hero media, product name, and offer banner.",
		tags: ["business", "promo", "product", "marketing"],
		mediaSlots: [
			{
				id: "slot-product-media",
				label: "Product media",
				accept: ["video", "image"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-product-promo",
						trackId: "track-product-main",
						elementId: "element-product-media",
					},
				],
			},
		],
		scene: {
			id: "scene-product-promo",
			name: "Promo",
			tracks: {
				overlay: [
					{
						id: "track-product-text",
						name: "Promo Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-product-title",
								name: "Product Name",
								content: "Launch your best seller",
								fontSize: 82,
								startTime: 0,
								duration: 6,
								y: -340,
								bold: true,
							}),
							textElement({
								id: "element-product-offer",
								name: "Offer",
								content: "TODAY ONLY · 20% OFF",
								fontSize: 38,
								startTime: 1,
								duration: 5,
								y: 360,
								background: {
									enabled: true,
									color: "#D72638",
									cornerRadius: 999,
									paddingX: 28,
									paddingY: 16,
									offsetX: 0,
									offsetY: 0,
								},
								bold: true,
							}),
						],
					},
				],
				main: {
					id: "track-product-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-product-media",
							name: "Product media",
							slotId: "slot-product-media",
							type: "image",
							duration: 6,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	projectTemplate({
		id: "builtin-project-podcast-clip",
		name: "Podcast Clip",
		description:
			"Talking-head or interview clip with oversized headline and lower-third takeaway.",
		tags: ["podcast", "interview", "education", "social"],
		mediaSlots: [
			{
				id: "slot-podcast-video",
				label: "Podcast video",
				accept: ["video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-podcast",
						trackId: "track-podcast-main",
						elementId: "element-podcast-video",
					},
				],
			},
		],
		scene: {
			id: "scene-podcast",
			name: "Podcast",
			tracks: {
				overlay: [
					{
						id: "track-podcast-text",
						name: "Podcast Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-podcast-title",
								name: "Headline",
								content: "The moment that changes the story",
								fontSize: 74,
								startTime: 0,
								duration: 8,
								y: -360,
								bold: true,
							}),
							textElement({
								id: "element-podcast-quote",
								name: "Takeaway",
								content: "Pull out one sharp sentence here",
								fontSize: 34,
								startTime: 2,
								duration: 6,
								y: 380,
								background: {
									enabled: true,
									color: "#111111",
									cornerRadius: 20,
									paddingX: 24,
									paddingY: 14,
									offsetX: 0,
									offsetY: 0,
								},
							}),
						],
					},
				],
				main: {
					id: "track-podcast-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-podcast-video",
							name: "Podcast video",
							slotId: "slot-podcast-video",
							type: "video",
							duration: 8,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	sceneTemplate({
		id: "builtin-scene-cta",
		name: "CTA Scene",
		description:
			"Drop in a clip or still, then swap the call-to-action copy for a clean ending scene.",
		tags: ["cta", "ending", "scene"],
		mediaSlots: [
			{
				id: "slot-scene-media",
				label: "Background media",
				accept: ["video", "image"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-cta",
						trackId: "track-scene-main",
						elementId: "element-scene-media",
					},
				],
			},
		],
		scene: {
			id: "scene-cta",
			name: "CTA scene",
			tracks: {
				overlay: [
					{
						id: "track-scene-text",
						name: "CTA",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-scene-title",
								name: "CTA Title",
								content: "Follow for more",
								fontSize: 76,
								startTime: 0,
								duration: 4,
								y: 250,
								bold: true,
							}),
						],
					},
				],
				main: {
					id: "track-scene-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-scene-media",
							name: "Background media",
							slotId: "slot-scene-media",
							type: "image",
							duration: 4,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	sceneTemplate({
		id: "builtin-scene-meme-caption",
		name: "Meme Caption Scene",
		description:
			"Classic meme-style layout with background media and top/bottom caption text.",
		tags: ["meme", "pov", "social", "scene"],
		mediaSlots: [
			{
				id: "slot-meme-media",
				label: "Meme background",
				accept: ["video", "image"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-meme",
						trackId: "track-meme-main",
						elementId: "element-meme-media",
					},
				],
			},
		],
		scene: {
			id: "scene-meme",
			name: "Meme scene",
			tracks: {
				overlay: [
					{
						id: "track-meme-text",
						name: "Meme Text",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-meme-top",
								name: "Top Caption",
								content: "POV: you shipped it five minutes before the deadline",
								fontSize: 48,
								startTime: 0,
								duration: 5,
								y: -430,
								bold: true,
							}),
							textElement({
								id: "element-meme-bottom",
								name: "Bottom Caption",
								content: "and it somehow works",
								fontSize: 52,
								startTime: 0,
								duration: 5,
								y: 430,
								bold: true,
							}),
						],
					},
				],
				main: {
					id: "track-meme-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-meme-media",
							name: "Meme media",
							slotId: "slot-meme-media",
							type: "image",
							duration: 5,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	sceneTemplate({
		id: "builtin-scene-holiday-greeting",
		name: "Holiday Greeting",
		description:
			"Celebration card scene for greetings, anniversaries, or holiday posts.",
		tags: ["holiday", "greeting", "anniversary", "scene"],
		mediaSlots: [
			{
				id: "slot-greeting-media",
				label: "Greeting photo",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-greeting",
						trackId: "track-greeting-main",
						elementId: "element-greeting-media",
					},
				],
			},
		],
		scene: {
			id: "scene-greeting",
			name: "Greeting scene",
			tracks: {
				overlay: [
					{
						id: "track-greeting-text",
						name: "Greeting Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-greeting-title",
								name: "Greeting Title",
								content: "Happy Birthday",
								fontSize: 88,
								startTime: 0,
								duration: 4,
								y: -320,
								bold: true,
							}),
							textElement({
								id: "element-greeting-subtitle",
								name: "Greeting Subtitle",
								content: "Wishing you a year full of wins",
								fontSize: 38,
								startTime: 0,
								duration: 4,
								y: 360,
								background: {
									enabled: true,
									color: "#7C3AED",
									cornerRadius: 999,
									paddingX: 26,
									paddingY: 16,
									offsetX: 0,
									offsetY: 0,
								},
							}),
						],
					},
				],
				main: {
					id: "track-greeting-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-greeting-media",
							name: "Greeting media",
							slotId: "slot-greeting-media",
							type: "image",
							duration: 4,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	sceneTemplate({
		id: "builtin-scene-travel-opener",
		name: "Travel Opener",
		description:
			"Fast opener scene for travel reels, recap videos, or day-in-the-life edits.",
		tags: ["travel", "recap", "intro", "scene"],
		mediaSlots: [
			{
				id: "slot-travel-video",
				label: "Travel clip",
				accept: ["video", "image"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-travel",
						trackId: "track-travel-main",
						elementId: "element-travel-video",
					},
				],
			},
		],
		scene: {
			id: "scene-travel",
			name: "Travel opener",
			tracks: {
				overlay: [
					{
						id: "track-travel-text",
						name: "Travel Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-travel-title",
								name: "Trip Title",
								content: "BALI 2026",
								fontSize: 98,
								startTime: 0,
								duration: 3,
								y: 320,
								bold: true,
							}),
						],
					},
				],
				main: {
					id: "track-travel-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-travel-video",
							name: "Travel clip",
							slotId: "slot-travel-video",
							type: "video",
							duration: 3,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	sceneTemplate({
		id: "builtin-scene-sale-announcement",
		name: "Sale Announcement",
		description:
			"High-contrast business scene for flash sales, launches, and event promos.",
		tags: ["business", "sale", "announcement", "scene"],
		mediaSlots: [
			{
				id: "slot-sale-media",
				label: "Background media",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-sale",
						trackId: "track-sale-main",
						elementId: "element-sale-media",
					},
				],
			},
		],
		scene: {
			id: "scene-sale",
			name: "Sale scene",
			tracks: {
				overlay: [
					{
						id: "track-sale-text",
						name: "Sale Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-sale-title",
								name: "Sale Title",
								content: "FLASH SALE",
								fontSize: 104,
								startTime: 0,
								duration: 4,
								y: -230,
								bold: true,
							}),
							textElement({
								id: "element-sale-offer",
								name: "Sale Offer",
								content: "UP TO 40% OFF",
								fontSize: 54,
								startTime: 0,
								duration: 4,
								y: 120,
								background: {
									enabled: true,
									color: "#111111",
									cornerRadius: 14,
									paddingX: 24,
									paddingY: 14,
									offsetX: 0,
									offsetY: 0,
								},
								bold: true,
							}),
						],
					},
				],
				main: {
					id: "track-sale-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-sale-media",
							name: "Sale media",
							slotId: "slot-sale-media",
							type: "image",
							duration: 4,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	sceneTemplate({
		id: "builtin-scene-before-after",
		name: "Before / After",
		description:
			"Two-slot comparison layout for transformations, edits, or product results.",
		tags: ["comparison", "before-after", "results", "scene"],
		mediaSlots: [
			{
				id: "slot-before-media",
				label: "Before media",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-before-after",
						trackId: "track-before-main",
						elementId: "element-before-media",
					},
				],
			},
			{
				id: "slot-after-media",
				label: "After media",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-before-after",
						trackId: "track-after-overlay",
						elementId: "element-after-media",
					},
				],
			},
		],
		scene: {
			id: "scene-before-after",
			name: "Before after",
			tracks: {
				overlay: [
					{
						id: "track-after-overlay",
						name: "After",
						type: "video",
						hidden: false,
						muted: false,
						elements: [
							mediaElement({
								id: "element-after-media",
								name: "After media",
								slotId: "slot-after-media",
								type: "image",
								duration: 4,
								startTime: 0,
								x: 470,
								y: 0,
								scaleX: 0.48,
								scaleY: 1,
							}),
						],
					},
					{
						id: "track-before-after-text",
						name: "Labels",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-before-label",
								name: "Before Label",
								content: "BEFORE",
								fontSize: 34,
								startTime: 0,
								duration: 4,
								x: -460,
								y: -420,
								background: {
									enabled: true,
									color: "#111111",
									cornerRadius: 999,
									paddingX: 18,
									paddingY: 10,
									offsetX: 0,
									offsetY: 0,
								},
								bold: true,
							}),
							textElement({
								id: "element-after-label",
								name: "After Label",
								content: "AFTER",
								fontSize: 34,
								startTime: 0,
								duration: 4,
								x: 460,
								y: -420,
								background: {
									enabled: true,
									color: "#111111",
									cornerRadius: 999,
									paddingX: 18,
									paddingY: 10,
									offsetX: 0,
									offsetY: 0,
								},
								bold: true,
							}),
						],
					},
				],
				main: {
					id: "track-before-main",
					name: "Before",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-before-media",
							name: "Before media",
							slotId: "slot-before-media",
							type: "image",
							duration: 4,
							startTime: 0,
							x: -470,
							scaleX: 0.48,
							scaleY: 1,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	projectTemplate({
		id: "builtin-project-ugc-testimonial",
		name: "UGC Testimonial Ad",
		description:
			"Vertical testimonial layout for creator-style product reviews and social proof ads.",
		tags: ["ugc", "testimonial", "ad", "social"],
		mediaSlots: [
			{
				id: "slot-ugc-video",
				label: "UGC video",
				accept: ["video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-ugc",
						trackId: "track-ugc-main",
						elementId: "element-ugc-video",
					},
				],
			},
		],
		scene: {
			id: "scene-ugc",
			name: "UGC scene",
			tracks: {
				overlay: [
					{
						id: "track-ugc-text",
						name: "UGC Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-ugc-hook",
								name: "Hook",
								content: "I didn't expect this to work...",
								fontSize: 68,
								startTime: 0,
								duration: 7,
								y: -360,
								bold: true,
							}),
							textElement({
								id: "element-ugc-badge",
								name: "Badge",
								content: "Real customer review",
								fontSize: 30,
								startTime: 0,
								duration: 7,
								y: 390,
								background: {
									enabled: true,
									color: "#111111",
									cornerRadius: 999,
									paddingX: 18,
									paddingY: 10,
									offsetX: 0,
									offsetY: 0,
								},
							}),
						],
					},
				],
				main: {
					id: "track-ugc-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-ugc-video",
							name: "UGC video",
							slotId: "slot-ugc-video",
							type: "video",
							duration: 7,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	projectTemplate({
		id: "builtin-project-app-demo",
		name: "App Demo Walkthrough",
		description:
			"Clean app promo starter for feature launches, onboarding clips, and quick product walkthroughs.",
		tags: ["app", "saas", "demo", "product"],
		mediaSlots: [
			{
				id: "slot-app-demo-video",
				label: "Screen recording",
				accept: ["video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-app-demo",
						trackId: "track-app-main",
						elementId: "element-app-video",
					},
				],
			},
		],
		scene: {
			id: "scene-app-demo",
			name: "App demo",
			tracks: {
				overlay: [
					{
						id: "track-app-copy",
						name: "App Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-app-title",
								name: "Title",
								content: "Show the feature in 8 seconds",
								fontSize: 78,
								startTime: 0,
								duration: 8,
								y: -390,
								bold: true,
							}),
							textElement({
								id: "element-app-subtitle",
								name: "Subtitle",
								content: "Simple workflow. Clear outcome.",
								fontSize: 34,
								startTime: 1,
								duration: 7,
								y: 410,
								background: {
									enabled: true,
									color: "#0F172A",
									cornerRadius: 18,
									paddingX: 20,
									paddingY: 12,
									offsetX: 0,
									offsetY: 0,
								},
							}),
						],
					},
				],
				main: {
					id: "track-app-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-app-video",
							name: "App demo",
							slotId: "slot-app-demo-video",
							type: "video",
							duration: 8,
							startTime: 0,
							scaleX: 0.82,
							scaleY: 0.82,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	projectTemplate({
		id: "builtin-project-event-invite",
		name: "Event Invite Promo",
		description:
			"Fast event teaser for webinars, meetups, launches, and countdown announcements.",
		tags: ["event", "invite", "launch", "promo"],
		mediaSlots: [
			{
				id: "slot-event-media",
				label: "Event background",
				accept: ["video", "image"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-event",
						trackId: "track-event-main",
						elementId: "element-event-media",
					},
				],
			},
		],
		scene: {
			id: "scene-event",
			name: "Event scene",
			tracks: {
				overlay: [
					{
						id: "track-event-text",
						name: "Event Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-event-date",
								name: "Date",
								content: "JUNE 28 · 7 PM",
								fontSize: 30,
								startTime: 0,
								duration: 6,
								y: -420,
								background: {
									enabled: true,
									color: "#DC2626",
									cornerRadius: 999,
									paddingX: 18,
									paddingY: 10,
									offsetX: 0,
									offsetY: 0,
								},
								bold: true,
							}),
							textElement({
								id: "element-event-title",
								name: "Title",
								content: "You’re invited",
								fontSize: 96,
								startTime: 0,
								duration: 6,
								y: -80,
								bold: true,
							}),
							textElement({
								id: "element-event-subtitle",
								name: "Subtitle",
								content: "Live session · Limited seats",
								fontSize: 38,
								startTime: 0,
								duration: 6,
								y: 240,
							}),
						],
					},
				],
				main: {
					id: "track-event-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-event-media",
							name: "Event media",
							slotId: "slot-event-media",
							type: "image",
							duration: 6,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	projectTemplate({
		id: "builtin-project-tutorial-carousel",
		name: "Tutorial Steps",
		description:
			"Three-step explainer for recipes, workflows, tutorials, and educational shorts.",
		tags: ["tutorial", "education", "how-to", "carousel"],
		mediaSlots: [
			{
				id: "slot-step-1",
				label: "Step 1 media",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-tutorial",
						trackId: "track-tutorial-main",
						elementId: "element-step-1",
					},
				],
			},
			{
				id: "slot-step-2",
				label: "Step 2 media",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-tutorial",
						trackId: "track-tutorial-main",
						elementId: "element-step-2",
					},
				],
			},
			{
				id: "slot-step-3",
				label: "Step 3 media",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-tutorial",
						trackId: "track-tutorial-main",
						elementId: "element-step-3",
					},
				],
			},
		],
		scene: {
			id: "scene-tutorial",
			name: "Tutorial scene",
			tracks: {
				overlay: [
					{
						id: "track-tutorial-text",
						name: "Tutorial Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-step-title",
								name: "Header",
								content: "3 steps to the result",
								fontSize: 72,
								startTime: 0,
								duration: 9,
								y: -400,
								bold: true,
							}),
							textElement({
								id: "element-step-one-label",
								name: "Step One",
								content: "STEP 1",
								fontSize: 32,
								startTime: 0,
								duration: 3,
								y: 380,
								background: {
									enabled: true,
									color: "#111111",
									cornerRadius: 999,
									paddingX: 18,
									paddingY: 10,
									offsetX: 0,
									offsetY: 0,
								},
								bold: true,
							}),
							textElement({
								id: "element-step-two-label",
								name: "Step Two",
								content: "STEP 2",
								fontSize: 32,
								startTime: 3,
								duration: 3,
								y: 380,
								background: {
									enabled: true,
									color: "#111111",
									cornerRadius: 999,
									paddingX: 18,
									paddingY: 10,
									offsetX: 0,
									offsetY: 0,
								},
								bold: true,
							}),
							textElement({
								id: "element-step-three-label",
								name: "Step Three",
								content: "STEP 3",
								fontSize: 32,
								startTime: 6,
								duration: 3,
								y: 380,
								background: {
									enabled: true,
									color: "#111111",
									cornerRadius: 999,
									paddingX: 18,
									paddingY: 10,
									offsetX: 0,
									offsetY: 0,
								},
								bold: true,
							}),
						],
					},
				],
				main: {
					id: "track-tutorial-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-step-1",
							name: "Step 1",
							slotId: "slot-step-1",
							type: "image",
							duration: 3,
							startTime: 0,
						}),
						mediaElement({
							id: "element-step-2",
							name: "Step 2",
							slotId: "slot-step-2",
							type: "image",
							duration: 3,
							startTime: 3,
						}),
						mediaElement({
							id: "element-step-3",
							name: "Step 3",
							slotId: "slot-step-3",
							type: "image",
							duration: 3,
							startTime: 6,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	sceneTemplate({
		id: "builtin-scene-quote-card",
		name: "Quote Card",
		description:
			"Minimal quote scene for creator wisdom, testimonials, and text-first storytelling.",
		tags: ["quote", "minimal", "text", "scene"],
		mediaSlots: [
			{
				id: "slot-quote-bg",
				label: "Background media",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-quote-card",
						trackId: "track-quote-main",
						elementId: "element-quote-bg",
					},
				],
			},
		],
		scene: {
			id: "scene-quote-card",
			name: "Quote card",
			tracks: {
				overlay: [
					{
						id: "track-quote-text",
						name: "Quote Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-quote-line",
								name: "Quote",
								content: '"The work compounds faster than you think."',
								fontSize: 70,
								startTime: 0,
								duration: 5,
								y: -40,
								bold: true,
								background: {
									enabled: true,
									color: "#111111",
									cornerRadius: 20,
									paddingX: 28,
									paddingY: 24,
									offsetX: 0,
									offsetY: 0,
								},
							}),
							textElement({
								id: "element-quote-author",
								name: "Author",
								content: "— Add name or source",
								fontSize: 28,
								startTime: 0,
								duration: 5,
								y: 300,
							}),
						],
					},
				],
				main: {
					id: "track-quote-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-quote-bg",
							name: "Quote background",
							slotId: "slot-quote-bg",
							type: "image",
							duration: 5,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	sceneTemplate({
		id: "builtin-scene-unboxing-highlight",
		name: "Unboxing Highlight",
		description:
			"Creator-style opener for product reveals, packaging shots, and first impressions.",
		tags: ["unboxing", "ugc", "product", "scene"],
		mediaSlots: [
			{
				id: "slot-unboxing-video",
				label: "Unboxing clip",
				accept: ["video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-unboxing",
						trackId: "track-unboxing-main",
						elementId: "element-unboxing-video",
					},
				],
			},
		],
		scene: {
			id: "scene-unboxing",
			name: "Unboxing scene",
			tracks: {
				overlay: [
					{
						id: "track-unboxing-text",
						name: "Reveal Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-unboxing-title",
								name: "Reveal",
								content: "Opening the package everyone asked about",
								fontSize: 62,
								startTime: 0,
								duration: 6,
								y: -380,
								bold: true,
							}),
						],
					},
				],
				main: {
					id: "track-unboxing-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-unboxing-video",
							name: "Unboxing clip",
							slotId: "slot-unboxing-video",
							type: "video",
							duration: 6,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	sceneTemplate({
		id: "builtin-scene-recipe-card",
		name: "Recipe Card",
		description:
			"Food content scene for ingredients, quick recipes, and cooking reels.",
		tags: ["recipe", "food", "tutorial", "scene"],
		mediaSlots: [
			{
				id: "slot-recipe-media",
				label: "Recipe media",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-recipe",
						trackId: "track-recipe-main",
						elementId: "element-recipe-media",
					},
				],
			},
		],
		scene: {
			id: "scene-recipe",
			name: "Recipe scene",
			tracks: {
				overlay: [
					{
						id: "track-recipe-text",
						name: "Recipe Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-recipe-title",
								name: "Dish",
								content: "15-minute spicy noodles",
								fontSize: 76,
								startTime: 0,
								duration: 5,
								y: -360,
								bold: true,
							}),
							textElement({
								id: "element-recipe-meta",
								name: "Meta",
								content: "Fast · Easy · Pantry ingredients",
								fontSize: 30,
								startTime: 0,
								duration: 5,
								y: 400,
								background: {
									enabled: true,
									color: "#9A3412",
									cornerRadius: 999,
									paddingX: 18,
									paddingY: 10,
									offsetX: 0,
									offsetY: 0,
								},
							}),
						],
					},
				],
				main: {
					id: "track-recipe-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-recipe-media",
							name: "Recipe media",
							slotId: "slot-recipe-media",
							type: "image",
							duration: 5,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	sceneTemplate({
		id: "builtin-scene-workout-progress",
		name: "Workout Progress",
		description:
			"High-energy fitness scene for transformations, routines, and rep-based edits.",
		tags: ["fitness", "workout", "progress", "scene"],
		mediaSlots: [
			{
				id: "slot-workout-video",
				label: "Workout clip",
				accept: ["video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-workout",
						trackId: "track-workout-main",
						elementId: "element-workout-video",
					},
				],
			},
		],
		scene: {
			id: "scene-workout",
			name: "Workout scene",
			tracks: {
				overlay: [
					{
						id: "track-workout-text",
						name: "Workout Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-workout-title",
								name: "Progress Title",
								content: "Week 6 progress check",
								fontSize: 72,
								startTime: 0,
								duration: 5,
								y: -380,
								bold: true,
							}),
							textElement({
								id: "element-workout-badge",
								name: "Badge",
								content: "+2 reps · stronger form",
								fontSize: 32,
								startTime: 0,
								duration: 5,
								y: 400,
								background: {
									enabled: true,
									color: "#166534",
									cornerRadius: 999,
									paddingX: 18,
									paddingY: 10,
									offsetX: 0,
									offsetY: 0,
								},
								bold: true,
							}),
						],
					},
				],
				main: {
					id: "track-workout-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-workout-video",
							name: "Workout clip",
							slotId: "slot-workout-video",
							type: "video",
							duration: 5,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	sceneTemplate({
		id: "builtin-scene-news-flash",
		name: "News Flash",
		description:
			"Breaking-news style scene for updates, launches, and announcement-driven content.",
		tags: ["news", "announcement", "update", "scene"],
		mediaSlots: [
			{
				id: "slot-news-media",
				label: "News visual",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-news",
						trackId: "track-news-main",
						elementId: "element-news-media",
					},
				],
			},
		],
		scene: {
			id: "scene-news",
			name: "News scene",
			tracks: {
				overlay: [
					{
						id: "track-news-text",
						name: "News Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-news-badge",
								name: "Breaking",
								content: "BREAKING",
								fontSize: 30,
								startTime: 0,
								duration: 4,
								y: -420,
								background: {
									enabled: true,
									color: "#B91C1C",
									cornerRadius: 8,
									paddingX: 18,
									paddingY: 10,
									offsetX: 0,
									offsetY: 0,
								},
								bold: true,
							}),
							textElement({
								id: "element-news-title",
								name: "Headline",
								content: "Put your update in one sharp line",
								fontSize: 72,
								startTime: 0,
								duration: 4,
								y: -40,
								bold: true,
								background: {
									enabled: true,
									color: "#111111",
									cornerRadius: 16,
									paddingX: 24,
									paddingY: 18,
									offsetX: 0,
									offsetY: 0,
								},
							}),
						],
					},
				],
				main: {
					id: "track-news-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-news-media",
							name: "News visual",
							slotId: "slot-news-media",
							type: "image",
							duration: 4,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
	sceneTemplate({
		id: "builtin-scene-creator-intro",
		name: "Creator Intro",
		description:
			"Personal brand opener for portfolio reels, intros, and about-me videos.",
		tags: ["creator", "intro", "portfolio", "scene"],
		mediaSlots: [
			{
				id: "slot-creator-media",
				label: "Intro media",
				accept: ["image", "video"],
				required: true,
				boundElements: [
					{
						sceneId: "scene-creator-intro",
						trackId: "track-creator-main",
						elementId: "element-creator-media",
					},
				],
			},
		],
		scene: {
			id: "scene-creator-intro",
			name: "Creator intro",
			tracks: {
				overlay: [
					{
						id: "track-creator-text",
						name: "Intro Copy",
						type: "text",
						hidden: false,
						elements: [
							textElement({
								id: "element-creator-name",
								name: "Name",
								content: "ALEX CARTER",
								fontSize: 90,
								startTime: 0,
								duration: 4,
								y: -60,
								bold: true,
							}),
							textElement({
								id: "element-creator-role",
								name: "Role",
								content: "Designer · Editor · Storyteller",
								fontSize: 34,
								startTime: 0,
								duration: 4,
								y: 240,
							}),
						],
					},
				],
				main: {
					id: "track-creator-main",
					name: "Main Track",
					type: "video",
					muted: false,
					hidden: false,
					elements: [
						mediaElement({
							id: "element-creator-media",
							name: "Creator media",
							slotId: "slot-creator-media",
							type: "image",
							duration: 4,
							startTime: 0,
						}),
					],
				},
				audio: [],
			},
		},
	}),
];
