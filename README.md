# VoxNemesis TTS (Supertonic Edition)

A Chrome extension that runs Supertonic's on-device ONNX TTS engine directly in the browser via an offscreen document. This variant is dedicated to the Supertonic engine; future engine variants can live alongside it under `projects/`.

## Features
- Local-first text-to-speech with Supertonic ONNX models (no network calls).
- Voice, rate, pitch, volume, quality (steps), and seed controls.
- Context menu entry for quick read-out of selected text.
- Playback controls with play/pause/stop, seeking, and progress display.

## Load the Extension (Chrome/Edge)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `projects/voxnemesis-supertonic-extension`.
4. Pin the extension if desired and open the popup to adjust settings.

## Usage
- Select text on any page, then use **Generate Audio** to synthesize and play with current settings.
- **Play/Pause/Stop** manage the current audio buffer; **Generate** refreshes audio for the latest selection.
- Context menu: right-click selected text → **Read with VoxNemesis TTS (Supertonic)**.

## Development
- Install dev deps for tests: `npm install` inside `projects/voxnemesis-supertonic-extension`.
- Fetch Supertonic models (not tracked in git): `npm run fetch:assets` (clones https://huggingface.co/Supertone/supertonic into `assets/` and strips its .git).
- Run unit tests: `npm test`.
- Offscreen rendering uses `offscreen.html` + `offscreen.js`; the ONNX models and voice styles are expected under `assets/` after the fetch step.

## Folder Layout
- `background.js` — service worker wiring popup/content to the offscreen engine.
- `popup.html/js` — user controls and playback UI.
- `content.js` — legacy SpeechSynthesis path for basic page selection.
- `offscreen.html/js` — Supertonic ONNX pipeline, audio playback, and progress events.
- `assets/` — ONNX models and voice style presets.
- `lib/` — ONNX Runtime web bundles and helper glue code.

## Notes
- This edition is Supertonic-specific; future engine variants can be cloned under `projects/` without mixing assets.
- Keep `wasm-unsafe-eval` CSP entry to allow ONNX Runtime WebAssembly loading.
