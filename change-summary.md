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

## v3.2 UI Compaction Update (April 11, 2026)

1. Players sticky columns are now overflow-aware
- Sticky behavior for rank and player columns is enabled only when horizontal scroll exists.
- Sticky behavior is automatically disabled when table width fits viewport.

2. Players filters were compacted for table-density consistency
- Reduced filter input/select height, font size, and padding.
- Tightened filter-row spacing to match header density.

3. Multi-sort controls were redesigned for mobile and desktop readability
- Replaced heavy grouped wrappers with a compact indexed grid.
- Preserved existing multi-sort logic and ordering behavior.

4. Scope safety
- No scoring, parser, sync-flow, or Firebase write-path logic changed.

## Verification Results Template

Use this template for every scoring-impacting release note so evidence and prevention are always explicit.

### 1. Change Scope

- Release/patch ID:
- Areas touched: scoring | parser | sync flow | mapping | UI-only
- Risk level: low | medium | high

### 2. Baseline Snapshot (Before Run)

- Team totals snapshot timestamp:
- Target matches sampled:
- Key fields captured per target match: status, POTM, dot balls (at least 2 bowlers)

### 3. Execution Path Used

- Production path executed (exact function/button flow):
- Was CricAPI -> ESPN sequencing atomic on this path? yes/no
- Sync result counters (matches synced, ESPN updated):

### 4. Results and Deltas

- Team delta table attached: yes/no
- Any non-zero delta explained from match-level updates: yes/no
- If all deltas are zero, expected-reason documented: yes/no

### 5. Player-Level Scoring Audit

- Players audited (minimum 3):
- Verified per player:
- base points breakdown
- POTM applied before multiplier
- captain/vice-captain multiplier and rounding behavior

### 6. Historical Mistake Prevention Checks

Past incident: C/VC state loss
- Check: `liveData.captains` remained present and unchanged during save.
- Prevention step: block release if captains become null/invalid at any point.

Past incident: listener-triggered destructive writeback
- Check: no listener path writes broad state back to Firebase.
- Prevention step: allow only explicit admin/action-driven save paths.

Past incident: unintended performance pruning
- Check: no automatic sanitizer removed historical `match.performances` keys.
- Prevention step: sanitization only as explicit migration/admin action with diff review.

Past incident: ESPN name mismatch (example: Digvesh variant)
- Check: alias mapping covers sampled external name variants.
- Prevention step: add canonical alias once and verify parser output using real payload.

Past incident: ESPN payload shape mismatch for POTM/status
- Check: helper fallback paths resolved correct fields from raw payload sample.
- Prevention step: verification UI and sync path must share same helper implementation.

Past incident: partial sync parity gap
- Check: all import/reimport/fetch flows confirmed to chain ESPN after CricAPI.
- Prevention step: release blocked until all entry points pass parity checklist.

### 7. Evidence Links

- Raw payload sample(s):
- Helper output sample(s):
- Before/after totals evidence:
- Relevant commit SHA(s):

### 8. Release Gate Decision

- Parser truth check passed: yes/no
- Sync parity check passed: yes/no
- C/VC integrity check passed: yes/no
- Unexplained delta present: yes/no
- Final decision: ship | hold
- If hold, required fixes:

## UI Verification Template (UI-Only Releases)

### 1. Change Scope

- Release/patch ID:
- Areas touched: layout | styling | controls | interaction
- Risk level: low | medium | high

### 2. Layout Behavior

- Horizontal overflow detected in Players table when expected: yes/no
- Sticky columns active only with overflow: yes/no
- Sticky columns disabled when no overflow: yes/no

### 3. Control Fit and Density

- Filter controls visually align with header density: yes/no
- Filter row does not introduce avoidable horizontal scroll: yes/no
- Multi-sort is readable on desktop: yes/no
- Multi-sort is readable on mobile: yes/no

### 4. Functional Regression Checks

- Column filters still apply correctly: yes/no
- Sort and multi-sort state changes still apply correctly: yes/no
- Tab switch and window resize keep Players layout stable: yes/no

### 5. Invariants

- Scoring functions unchanged: yes/no
- Parser/sync logic unchanged: yes/no
- Firebase write paths unchanged: yes/no

### 6. Release Decision

- Final decision: ship | hold
- If hold, required fixes:

## Files Updated

- index.html
- LEARNINGS.md
- changes_summary.md
- change-summary.md
