import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiKey = process.env.PEXELS_API_KEY;

if (!apiKey) {
	throw new Error("PEXELS_API_KEY is required");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, "../public/template-assets/pexels");

const VIDEO_REQUESTS = [
	{
		id: "talking-head-video",
		query: "person speaking to camera vertical",
	},
	{
		id: "podcast-video",
		query: "podcast microphone interview vertical",
	},
	{
		id: "ugc-video",
		query: "creator product review vertical",
	},
	{
		id: "product-demo-video",
		query: "smartphone app demo hands vertical",
	},
	{
		id: "travel-video",
		query: "travel city walking vertical",
	},
	{
		id: "event-video",
		query: "conference audience vertical",
	},
	{
		id: "workout-video",
		query: "fitness workout gym vertical",
	},
	{
		id: "unboxing-video",
		query: "unboxing package product vertical",
	},
	{
		id: "news-video",
		query: "city night traffic vertical",
	},
];

const PHOTO_REQUESTS = [
	{
		id: "slideshow-1",
		query: "travel street portrait",
	},
	{
		id: "slideshow-2",
		query: "mountain travel portrait",
	},
	{
		id: "slideshow-3",
		query: "beach travel portrait",
	},
	{
		id: "slideshow-4",
		query: "city architecture portrait",
	},
	{
		id: "slideshow-5",
		query: "road trip portrait",
	},
	{
		id: "greeting-photo",
		query: "holiday celebration lights portrait",
	},
	{
		id: "recipe-photo",
		query: "food plate portrait",
	},
	{
		id: "quote-photo",
		query: "desk notebook coffee portrait",
	},
	{
		id: "before-photo",
		query: "old room desk portrait",
	},
	{
		id: "after-photo",
		query: "modern desk setup portrait",
	},
];

const slotMap = {
	"builtin-project-talking-head:slot-main-video": "talking-head-video",
	"builtin-project-photo-slideshow:slot-photo-1": "slideshow-1",
	"builtin-project-photo-slideshow:slot-photo-2": "slideshow-2",
	"builtin-project-photo-slideshow:slot-photo-3": "slideshow-3",
	"builtin-project-photo-slideshow:slot-photo-4": "slideshow-4",
	"builtin-project-photo-slideshow:slot-photo-5": "slideshow-5",
	"builtin-project-product-promo:slot-product-media": "product-demo-video",
	"builtin-project-podcast-clip:slot-podcast-video": "podcast-video",
	"builtin-scene-cta:slot-scene-media": "quote-photo",
	"builtin-scene-meme-caption:slot-meme-media": "ugc-video",
	"builtin-scene-holiday-greeting:slot-greeting-media": "greeting-photo",
	"builtin-scene-travel-opener:slot-travel-video": "travel-video",
	"builtin-scene-sale-announcement:slot-sale-media": "product-demo-video",
	"builtin-scene-before-after:slot-before-media": "before-photo",
	"builtin-scene-before-after:slot-after-media": "after-photo",
	"builtin-project-ugc-testimonial:slot-ugc-video": "ugc-video",
	"builtin-project-app-demo:slot-app-demo-video": "product-demo-video",
	"builtin-project-event-invite:slot-event-media": "event-video",
	"builtin-project-tutorial-carousel:slot-step-1": "quote-photo",
	"builtin-project-tutorial-carousel:slot-step-2": "product-demo-video",
	"builtin-project-tutorial-carousel:slot-step-3": "travel-video",
	"builtin-scene-quote-card:slot-quote-bg": "quote-photo",
	"builtin-scene-unboxing-highlight:slot-unboxing-video": "unboxing-video",
	"builtin-scene-recipe-card:slot-recipe-media": "recipe-photo",
	"builtin-scene-workout-progress:slot-workout-video": "workout-video",
	"builtin-scene-news-flash:slot-news-media": "news-video",
	"builtin-scene-creator-intro:slot-creator-media": "talking-head-video",
};

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: {
			Authorization: apiKey,
		},
	});

	if (!response.ok) {
		throw new Error(
			`Request failed: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

function preferVideoFile(files) {
	return [...files]
		.filter((file) => file.link && file.file_type === "video/mp4")
		.sort((a, b) => {
			const scoreA = Math.abs((a.width ?? 0) - 720);
			const scoreB = Math.abs((b.width ?? 0) - 720);
			return scoreA - scoreB;
		})[0];
}

async function downloadBinary(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Download failed: ${response.status} ${response.statusText}`,
		);
	}
	return new Uint8Array(await response.arrayBuffer());
}

async function downloadVideoAsset(request) {
	const query = new URLSearchParams({
		query: request.query,
		per_page: "10",
		orientation: "portrait",
		size: "medium",
	});
	const payload = await fetchJson(
		`https://api.pexels.com/videos/search?${query.toString()}`,
	);
	const video = payload.videos?.[0];

	if (!video) {
		throw new Error(`No video result for "${request.query}"`);
	}

	const videoFile = preferVideoFile(video.video_files ?? []);
	if (!videoFile?.link) {
		throw new Error(`No downloadable mp4 for "${request.query}"`);
	}

	const videoBytes = await downloadBinary(videoFile.link);
	const posterBytes = await downloadBinary(video.image);
	const fileName = `${request.id}.mp4`;
	const posterName = `${request.id}.jpg`;

	await writeFile(path.join(outputDir, fileName), videoBytes);
	await writeFile(path.join(outputDir, posterName), posterBytes);

	return {
		id: request.id,
		type: "video",
		name: request.id.replaceAll("-", " "),
		path: `/template-assets/pexels/${fileName}`,
		thumbnailPath: `/template-assets/pexels/${posterName}`,
		width: video.width,
		height: video.height,
		duration: video.duration,
		photographer: video.user?.name ?? null,
		sourceUrl: video.url,
		pexelsId: video.id,
	};
}

async function downloadPhotoAsset(request) {
	const query = new URLSearchParams({
		query: request.query,
		per_page: "10",
		orientation: "portrait",
		size: "medium",
	});
	const payload = await fetchJson(
		`https://api.pexels.com/v1/search?${query.toString()}`,
	);
	const photo = payload.photos?.[0];

	if (!photo) {
		throw new Error(`No photo result for "${request.query}"`);
	}

	const sourceUrl =
		photo.src?.large2x ??
		photo.src?.large ??
		photo.src?.medium ??
		photo.src?.original;

	if (!sourceUrl) {
		throw new Error(`No downloadable image for "${request.query}"`);
	}

	const imageBytes = await downloadBinary(sourceUrl);
	const fileName = `${request.id}.jpg`;
	await writeFile(path.join(outputDir, fileName), imageBytes);

	return {
		id: request.id,
		type: "image",
		name: request.id.replaceAll("-", " "),
		path: `/template-assets/pexels/${fileName}`,
		thumbnailPath: `/template-assets/pexels/${fileName}`,
		width: photo.width,
		height: photo.height,
		photographer: photo.photographer ?? null,
		sourceUrl: photo.url,
		pexelsId: photo.id,
	};
}

async function main() {
	await mkdir(outputDir, { recursive: true });

	const assets = {};

	for (const request of VIDEO_REQUESTS) {
		console.log(`Downloading video: ${request.id}`);
		assets[request.id] = await downloadVideoAsset(request);
	}

	for (const request of PHOTO_REQUESTS) {
		console.log(`Downloading photo: ${request.id}`);
		assets[request.id] = await downloadPhotoAsset(request);
	}

	const manifest = {
		version: 1,
		generatedAt: new Date().toISOString(),
		provider: "pexels",
		assets,
		slots: slotMap,
	};

	await writeFile(
		path.join(outputDir, "manifest.json"),
		`${JSON.stringify(manifest, null, 2)}\n`,
		"utf8",
	);

	console.log(`Saved ${Object.keys(assets).length} assets to ${outputDir}`);
}

await main();
