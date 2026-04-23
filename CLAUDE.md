# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Web app

```bash
bun dev:web          # Start Next.js dev server (Turbopack) at localhost:3000
bun build:web        # Production build
bun lint:web         # Biome lint check
bun lint:web:fix     # Biome lint + auto-fix
bun format:web       # Format with Biome
bun test             # Run tests
```

### WASM development

```bash
bun dev:wasm         # Watch + rebuild WASM (requires cargo-watch)
bun build:wasm       # One-shot WASM build
bun publish:wasm     # Build and publish opencut-wasm to npm
```

Link local WASM for development:
```bash
cd rust/wasm/pkg && bun link
cd apps/web && bun link opencut-wasm
# To revert to published package:
cd apps/web && bun add opencut-wasm
```

### Desktop app

```bash
cargo run -p opencut-desktop   # Run desktop app
./apps/desktop/script/setup    # Install native deps (macOS: Xcode tools)
```

### Rust crates

```bash
cargo test -p <crate-name>     # Test a specific crate
```

### Database (web)

```bash
cd apps/web
bun run db:generate   # Generate Drizzle migrations
bun run db:migrate    # Run migrations
```

### Initial setup

```bash
cp apps/web/.env.example apps/web/.env.local
docker compose up -d db redis serverless-redis-http  # optional local services
bun install
bun dev:web
```

## Architecture

### Core principle

An ongoing migration moves all business logic into `rust/`. The apps under `apps/` are UI shells — they own rendering, interaction, and platform-specific concerns but never own logic. Logic is never duplicated between apps; only UI is, because each platform uses a different framework.

### Apps

- **`apps/web/`** — Next.js 16 + React 19 editor. Calls Rust via the `opencut-wasm` npm package. Uses Canvas/WebGL for rendering.
- **`apps/desktop/`** — GPUI-based native Rust app. Links Rust crates directly as Cargo dependencies (no WASM layer).

### Rust crates (`rust/`)

- **`crates/bridge/`** — Proc macro crate. `#[export]` is a no-op on desktop; with `--features wasm` it expands to `#[wasm_bindgen(js_name = "camelCase")]`.
- **`crates/gpu/`** — wgpu-based GPU renderer. Switches to WebGL backend when compiled with `wasm` feature.
- **`crates/compositor/`** — Layer composition and alpha blending.
- **`crates/effects/`** — Effect shader definitions and pass building.
- **`crates/masks/`** — Mask rendering, feathering, path-to-texture.
- **`crates/time/`** — Frame/FPS math utilities. Exports TypeScript bindings via `tsify-next` when built for WASM.
- **`wasm/`** — WASM entry point. Compiles all crates with `wasm` feature into the `opencut-wasm` npm package.

### Adding Rust exports

```rust
use bridge::export;

#[export]
pub fn my_function(x: f64) -> f64 { x }
// → becomes #[wasm_bindgen(js_name = "myFunction")] for WASM
// → no-op for desktop (crate used directly)
```

### Web editor structure (`apps/web/src/`)

- **`core/`** — `EditorCore` singleton that owns all `Manager` instances. Managers cover: Playback, Timeline, Scenes, Project, Media, Renderer, Command (undo/redo), Save, Audio, Selection, Clipboard, Diagnostics.
- **`services/renderer/`** — GPU rendering pipeline. Resolves effects into `EffectPass[]` (shader ID + uniforms), calls WASM GPU pipeline, writes results to canvas.
- **`services/`** — Larger subsystems: storage, transcription, video-cache, waveform-cache.
- **`lib/`** — Domain utilities: effects registry, masks, timeline logic, canvas helpers, export logic, WASM integration layer, subtitles, text, fonts, sounds, stickers.
- **`stores/`** — Zustand state stores.
- **`hooks/`** — React hooks for actions, storage, timeline.
- **`components/editor/`** — Editor UI components.

### Rendering flow

1. TypeScript resolves effects into `EffectPass[]` via `resolveEffectPasses()`
2. Passes (shader ID + uniforms) are sent to the WASM GPU pipeline
3. WASM executes passes via wgpu's WebGL backend
4. Results are written back to the canvas element

## TypeScript rules (enforced by Biome/Ultracite)

- No `any` type, no `@ts-ignore`, no non-null assertions (`!`)
- No TypeScript `enum` or `namespace`
- Use `import type` / `export type` for types
- Use `as const` instead of literal type annotations
- No `console` usage
- Use `for...of` instead of `Array.forEach`
- No array index as React key
- `onClick` must be accompanied by `onKeyUp`, `onKeyDown`, or `onKeyPress`
- No `<img>` or `<head>` elements (use Next.js `<Image>` and `<Head>`)
- Use `===`/`!==`, no `var`, no nested ternaries
