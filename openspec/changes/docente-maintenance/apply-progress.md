# Apply Progress: docente-maintenance

## Owner decisions (task 0.2, 2026-11-25)

- D1 to D5 of `proposal.md` confirmed.
- Four stacked slices into the tracker `feat/docente-maintenance` (from main c5ea22e); review budget 1000 changed lines per PR; ask-on-risk; feature-branch-chain; one production deploy.
- Standing approval to open and merge the slice PRs into the tracker without asking for each one, only with every gate green and at most 1000 changed lines.
- STOP after each slice: report and wait for the owner before starting the next one.
- An explicit yes is always required for every Neon command, the merge to `main` and the deploy, any deletion, any PR over 1000 lines and any change of an owner decision. No database command runs without it.

## Log

- 0.1: tracker created from main c5ea22e; planning committed (exploration, proposal, specs, design, tasks) and pushed.
- Early read-only check of production (2026-11-25): 0 active grupos under an inactive docente, 0 emails repeated ignoring case, 0 docentes without email, 4 docentes, all active. The gate repeats it on the day of the merge (6.3).
