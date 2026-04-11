# Auction PAcked v3.0

Release Date: April 11, 2026
Tag: v3.0

## Summary

1. Added automatic invalidation and reload for Insights batting-position cache when completed matches change.
2. Added safe in-flight reload request handling to avoid stale role-efficiency views.
3. Preserved scoring integrity by keeping all points logic unchanged.
4. Validated behavior with a browser-only, in-memory simulation that restored state and did not write to Firebase.

## Reliability Addendum (April 11, 2026)

1. Added an operational discrepancy-prevention framework in [LEARNINGS.md](LEARNINGS.md).
2. Standardized a points accuracy verification protocol for scoring-impacting changes.
3. Added release gates that block push when parser truth, sync parity, or C/VC integrity checks fail.

### What This Prevents

1. POTM/status misses caused by ESPN payload shape variation.
2. Partial sync behavior where some import paths bypass ESPN enrichment.
3. Silent scoring drift from unchecked parser or multiplier regressions.

### Required Verification for Future Changes

1. Capture pre-sync team totals and target match fields.
2. Run one full production sync cycle.
3. Compute and explain per-team deltas.
4. Run player-level breakdown audits for base, POTM, and C/VC multiplier behavior.
5. Confirm invariants: captains intact, no unintended performance pruning, and expected status transitions only.

## Files Updated

- index.html
- LEARNINGS.md
- changes_summary.md
- change-summary.md
