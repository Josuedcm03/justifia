# Apply progress: normative-parameters

## Unit 0: decisions and delivery (2026-11-27)

- Owner decisions, traced to the thesis: D1 causes are activated, deactivated and reordered (no creation, no label editing); D2 the secretaria edits (thesis 4.3, CU-13); D3 RN-07 and RN-08 are separate keys, default 2; D4 the alert is a key, default 1, below the remission deadline; D5 read-time rules use the value in force, filing-time rules apply at the action, no per-request snapshot; D6 file size 1 to 25 MiB with the `CK_Documento_Tamano` ceiling migration; D7 retention is out of RNF-14; D8 scope is the minimum to declare RNF-14 met (five families plus the RN-13 map, one screen). Store exactly as thesis Anexo D Table D19.
- Spec assumption accepted by the orchestrator: a deactivated cause refuses drafts only; corrections of returned requests accept the five codes (as RN-23 is off for corrections).
- Session: execution auto; artifact store openspec; delivery auto-chain with feature-branch-chain; 13-slice plan; review budget 1000 changed lines per PR.
- Standing owner approval: slice PRs of at most 1000 changed lines merge into the tracker `feat/normative-parameters` with all gates green. Merging the tracker to `main`, every Neon command that writes schema or data (including the disposable branch), every deletion and any PR over 1000 lines always need an explicit yes.
