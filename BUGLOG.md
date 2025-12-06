# BUG Log

Track regressions and UX issues for the VoxNemesis Supertonic extension.

## Open
- Overlay hangs (never hides after init/download) and Generate/Play inert in popup; context menu entry missing after highlight/right-click. Repro: load extension (MV3 SW), open popup, see overlay stuck; highlight page text → right-click shows no "Read with VoxNemesis TTS (Supertonic)" menu. Status: needs investigation.
please add logo to that cxontext menue entry thatnks 

overlay hangs on : Supertonic M1: cached... user has to mamuly close then repoern popup  

## Recently Fixed
- Context menu entry recreated on install/startup/worker wake and shows Nemesis logo (commit 86adbd6).
- Popup IIFE closure restored so overlay/buttons initialize (commit 86adbd6).

## Notes
- Tests (npm test) currently pass; issues are runtime/integration only.