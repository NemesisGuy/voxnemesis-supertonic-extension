## VibeType Extension Delivery Plan (Living Doc)

Keep this living doc current. Track status with checkboxes and short notes/dates. Bold means done.

### Phase 1 · Clean Up & Structure
- [x] **Namespace encapsulation** — popup as module + IIFE; offscreen ES module (Dec 6, 2025).
- [x] **Asset UX guardrails** — overlay + messages + retry CTA; errors surfaced (Dec 6, 2025).
- [x] **Async flow hardening** — init errors propagate; speak guarded with mutex; asset errors surfaced (Dec 6, 2025).
- [ ] Modular DOM helpers — extract tiny DOM utility layer to reduce inline manipulation.

### Phase 2 · Optimize & Expand
- [ ] Testing & coverage — broaden to long text, playback-state edges, WebGPU/WASM fallback; add chrome.runtime/offscreen message mocks.
- [x] **CI/CD** — GitHub Actions runs npm install + npm test on push/PR (Dec 6, 2025).
- [x] **Resource management** — runtime HF download + Cache Storage; toolbar icon set (Dec 6, 2025).
- [ ] Community feedback — prep canary build and collect feedback (GitHub Discussions/test group).

### UX Fit & Visuals
- [x] Toolbar badge uses Nemesis logo (Dec 6, 2025).
- [x] Popup overlay for “fetching resources from Hugging Face…” (Dec 6, 2025).
- [x] Retry CTA on fetch error (Dec 6, 2025).

### Testing Checklist
- [x] Unit: helper mask/processor basics (Jest) — passing.
- [x] Unit: asset-status derivation (popup.logic) — passing.
- [x] Unit: offscreen message flow (stubbed chrome runtime; mock fetch + chrome.runtime) — passing.
- [ ] Integration (manual): first-run model download overlay, cached reopen, play/pause/seek.

### Next Up (short horizon)
1) Extract small DOM helper utilities to reduce inline DOM handling in popup.
2) Run manual integration sweep: first-run download overlay, cached reopen, play/pause/seek.
3) Prep canary build + feedback loop (GitHub Discussions/test group).

Notes
- Models download from HF at runtime, cached via Cache Storage; retry + overlay in place.
- Offscreen message tests now stub chrome runtime/fetch to avoid network during CI.

