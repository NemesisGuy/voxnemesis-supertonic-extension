# VoxNemesis TTS (Supertonic Edition)

A Chrome/Edge extension that runs Supertone’s Supertonic ONNX TTS engine fully in-browser via an offscreen document. Models are pulled on-demand from Hugging Face, cached locally, and reused offline.

## Features
- Local-first TTS with Supertonic ONNX models; popup overlay shows download/progress status and retries on errors.
- Voice, rate, pitch, volume, quality (steps), and seed controls.
- Context menu entry for quick read-out of selected text.
- Playback controls with play/pause/stop, seeking, and progress display.

## How It Works
- Background service worker routes popup/context-menu commands to an offscreen document (MV3) that hosts ONNX Runtime Web.
- Models/styles are fetched from Hugging Face on first use, written into Cache Storage, and reused offline.
- WebGPU is preferred when available; otherwise ONNX falls back to WASM. Thread count is capped between 1–4 using `navigator.hardwareConcurrency`.

## Load the Extension (Chrome/Edge)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the repository root folder (`voxnemesis-supertonic-extension`).
4. Pin the extension if desired and open the popup to adjust settings.

## Usage
- Select text on any page, then click **Generate Audio** to synthesize and play with current settings.
- **Play/Pause/Stop** manage the current audio buffer; **Generate** refreshes audio for the latest selection.
- Context menu: right-click selected text → **Read with VoxNemesis TTS (Supertonic)**.

## Troubleshooting
- Overlay stuck on first run: ensure network for the first model download; the popup watchdog hides overlay once `modelsReady` is true.
- Context menu missing: reload the extension; MV3 service worker recreates the menu on install/startup/wake.
- WebGPU unavailable (any vendor: Intel/AMD/NVIDIA/Apple): the engine falls back to WASM/CPU automatically; performance is lower but functional.
- Slow machines: thread count is capped to 1–4 based on `hardwareConcurrency`. On single-core systems it stays at 1; multi-core caps at 4 even if higher.

## Development
- Requirements: Node 18+ and git (for optional asset fetch). Install deps with `npm install`.
- Models download automatically at runtime inside the extension and are cached via Cache Storage. For offline development you can clone them locally with `npm run fetch:assets` (clones https://huggingface.co/Supertone/supertonic into `assets/` and strips its `.git`).
- Run unit tests: `npm test` (Jest + jsdom). Offscreen message tests stub `chrome.runtime`/fetch to avoid network.
- Offscreen execution lives in `offscreen.html`/`offscreen.js`; the ONNX runtime bundles are under `lib/`.

### Test Coverage (quick map)
- `tests/offscreen.messages.test.js` — message flow, busy guard, error surfacing.
- `tests/offscreen.status.test.js` — `modelsReady`/status reporting to unblock overlay.
- `tests/offscreen.init.test.js` — WebGPU fallback to WASM and thread capping for low-core machines.
- `tests/popup.logic.test.js` — overlay state derivation.
- `tests/helper.test.js` — helper utilities.

## Folder Layout
- `background.js` — service worker wiring popup/content to the offscreen engine.
- `popup.html`, `popup.js` — user controls, overlay/retry UX, playback UI.
- `content.js` — legacy SpeechSynthesis path for basic page selection.
- `offscreen.html`, `offscreen.js` — Supertonic ONNX pipeline, audio playback, progress events, model caching.
- `assets/` — ONNX models and voice styles (optional manual download; normally pulled/cached at runtime).
- `lib/` — ONNX Runtime Web bundles and helper glue code.
- `tests/` — Jest unit tests for helpers, popup logic, and offscreen messaging.
- `.github/workflows/ci.yml` — CI running `npm test` on push/PR.

## Notes
- Keep the `wasm-unsafe-eval` CSP entry to allow ONNX Runtime WebAssembly loading.
- First run requires network to download models; afterwards they are served from Cache Storage.

## Release Packaging
- Bump `manifest.json` version, run `npm test`, then package with `git archive -o release/voxnemesis-supertonic-extension-<ver>.zip HEAD`.
- Upload the zip to the Chrome/Edge store and smoke-test the store build (first-run download, cached reopen, context menu, playback).

## Manual Test Sweep (recommended before publish)
1) First run: load unpacked, open popup → verify overlay shows download then hides automatically.
2) Cached reopen: close/reopen popup → overlay stays hidden; playback controls responsive.
3) Context menu: highlight page text → right-click → “Read with VoxNemesis TTS (Supertonic)” plays audio.
4) Playback controls: generate, play, pause, resume, seek, stop; status text and progress update.
5) Fallback check: on machines without WebGPU, confirm playback still works (WASM path) though slower.
