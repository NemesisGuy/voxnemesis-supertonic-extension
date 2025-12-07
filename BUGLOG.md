# BUG Log

Track regressions and UX issues for the VoxNemesis Supertonic extension.

## Open
- Integration sweep still pending: run manual checks (first-run download overlay, cached reopen, play/pause/seek) to confirm no regressions.

## Recently Fixed
- Overlay hang resolved via modelsReady + watchdog polling in popup; no manual reopen needed (commit 952962e).
- Context menu creation error fixed (removed unsupported icons prop); Nemesis logo now present via scaled icons and manifest defaults (commit 67ef174).
- Context menu entry recreated on install/startup/worker wake (commit 86adbd6).
- Popup IIFE closure restored so overlay/buttons initialize (commit 86adbd6).

## Release 0.2.0 — Issues Encountered & Fixed
- Popup overlay stuck after model download; popup controls inert on first-run. Fix: exposed `modelsReady` from offscreen, added overlay watchdog polling to auto-hide, and ensured status sync (commits 952962e, 30a8432).
- Context menu missing or creation error due to unsupported `icons` property in MV3. Fix: removed per-item icons, regenerated proper 16/32/48/128 assets, and pointed manifest to scaled logos so menu now shows the Nemesis icon (commits 67ef174, 64b8c5f).
- Service worker wake/install sometimes lacked context menu. Fix: ensured recreate on install/startup and on wake (commit 86adbd6).
- Popup script scope leak caused overlay/buttons not to init. Fix: wrapped in IIFE and restored handlers (commit 86adbd6).

## Notes
- Tests (npm test) currently pass; issues are runtime/integration only.


make tehis doc sexy 