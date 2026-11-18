# Apply Progress: auth-route-tests

## Task 0.1: delivery decision (owner, 2026-11-18)

Option A: one PR with one commit per work unit, review budget 1000 changed lines (`openspec/` excluded). Checkpoint after unit 3: measure the real diff (`git diff --numstat main...HEAD`, excluding `openspec/`); if unit 4 would take the total past 1000, stop and report to the owner, who decides between a small `size:exception` and splitting unit 4 into a stacked PR (chain strategy `stacked-to-main`). Do not trim tests to fit the budget.
