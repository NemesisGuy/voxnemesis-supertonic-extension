# BUG Log

Track regressions and UX issues for the VoxNemesis Supertonic extension.

## Open
- Integration sweep still pending: run manual checks (first-run download overlay, cached reopen, play/pause/seek) to confirm no regressions.

## Recently Fixed
- Overlay hang resolved via modelsReady + watchdog polling in popup; no manual reopen needed (commit 952962e).
- Context menu creation error fixed (removed unsupported icons prop); Nemesis logo now present via scaled icons and manifest defaults (commit 67ef174).
- Context menu entry recreated on install/startup/worker wake (commit 86adbd6).
- Popup IIFE closure restored so overlay/buttons initialize (commit 86adbd6).

## Notes
- Tests (npm test) currently pass; issues are runtime/integration only.