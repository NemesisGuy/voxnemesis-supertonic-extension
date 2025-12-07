# BUG Log

Concise history of regressions, fixes, and remaining checks.

## Open
- Manual integration sweep pending: first-run download overlay, cached reopen, play/pause/seek.

## Recently Fixed
- Overlay hang: `modelsReady` exposed + popup watchdog polling hides overlay without manual reopen (commit 952962e).
- Context menu creation: removed unsupported MV3 `icons` prop; manifest now points to scaled Nemesis icons (commit 67ef174).
- Context menu resilience: recreated on install/startup/wake (commit 86adbd6).
- Popup init: IIFE restored so overlay/buttons wire up correctly (commit 86adbd6).

## Release 0.2.0 — Issues Encountered & Fixed
- Popup overlay stuck after model download; controls inert. Fixed via `modelsReady` status + overlay watchdog (commits 952962e, 30a8432).
- Context menu missing or error on create. Fixed by removing per-item icons, adding scaled assets (16/32/48/128), and updating manifest (commits 67ef174, 64b8c5f).
- Service worker not recreating menu on wake. Fixed by ensuring recreate on install/startup/wake (commit 86adbd6).
- Popup script scope leak. Fixed by wrapping in IIFE and restoring handlers (commit 86adbd6).

## Notes
- `npm test` passes (Jest suites for offscreen init/status/messages/playback, popup logic, helpers). Remaining risk is manual integration only.
