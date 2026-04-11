# LEARNINGS.md

Purpose: Prevent repeat regressions and enforce safe delivery habits for this codebase.

## Non-Negotiable Rules

1. Never write back to Firebase from inside a Firebase listener unless explicitly required and reviewed.
2. Never mutate or prune persisted match performances automatically on app load.
3. Never push a fix affecting scoring without validating expected leaderboard totals.
4. Never ship name-matching logic changes without ambiguity tests (same surname, initials, aliases).
5. Never allow `liveData.captains` to be overwritten with null/invalid values.

## Root Lessons from Recent Incidents

1. Listener-triggered writes are dangerous
- A listener-side save path can amplify transient state into permanent data loss.
- If a listener receives incomplete state and saves immediately, it can overwrite valid data.

2. Data correction logic must be opt-in, not automatic
- Sanitizers should run as explicit admin actions or one-time migrations.
- Automatic sanitization during normal page load can destroy valid historical records.

3. Name matching must be team-aware and alias-aware
- Ambiguous names (for example, `R Singh`) can map to wrong players without team context.
- External feed names (for example, ESPN) can differ from local roster names and require stable alias mapping.

4. Score integrity depends on captain state
- Missing C/VC selections collapse multiplier logic and distort all team totals.
- Captains must be treated as protected state and validated before save.

## Mandatory Validation Checklist (Before Commit)

1. Run targeted functional checks for the reported bug scenario.
2. Validate data integrity invariants:
- `liveData.captains` exists and has all teams.
- Match count and done/live status are unchanged unless intentionally modified.
- No unintended deletions in `match.performances`.
3. Validate scoring invariants:
- Known baseline leaderboard totals match expected values when provided.
- Spot-check 2-3 players with known match breakdowns.
4. Validate enrichment invariants:
- ESPN dots/POTM mapping still applies after refresh/reimport.
5. Validate regression surfaces touched by the change:
- Admin sync actions
- Player modal breakdown
- Leaderboard totals

## Mandatory Validation Checklist (Before Push)

1. Re-run the commit checklist after final code edits.
2. Confirm no unrelated files changed unexpectedly.
3. Confirm no destructive migration/sanitization code runs automatically.
4. Confirm summary of user-visible impact is accurate.

## Safe Patterns for This Repo

1. Prefer merge/upsert over replacement for match updates.
2. Keep parser fallbacks conservative when team context exists.
3. Add aliases for external-name variants in one canonical place.
4. Guard critical persisted objects (`captains`, `matches`) before every save.

## Anti-Patterns to Avoid

1. Saving inside realtime listeners.
2. Silent write-backs that modify broad state from derived heuristics.
3. Broad fuzzy matching without context constraints.
4. Shipping scoring changes without baseline comparison.

## Quick Runbook for Scoring Incidents

1. Check `liveData.captains` first.
2. Check match count and statuses.
3. Check specific player performance keys for mis-mapped names.
4. Check ESPN enrichment mapping for alias misses.
5. Re-sync data only after parser/mapping fix is verified.

## Ownership Reminder

If confidence is below high for a scoring-impacting change, stop and validate before commit/push.
Accuracy and data safety are higher priority than speed.

## v3.0 Learnings (April 11, 2026)

1. Derived insights caches must be invalidated on source-data boundary changes
- Batting-position drilldown data is derived from completed matches and ESPN enrichment.
- A one-time load flag is insufficient when new completed matches arrive.
- Cache invalidation should be tied to a deterministic completed-match signature.

2. Invalidation must be scoring-agnostic
- Auto-refresh behavior for Insights should not touch any scoring functions.
- Keep cache lifecycle logic separate from points calculation paths.

3. Handle in-flight refresh safely
- If data changes while enrichment is loading, queue a follow-up reload.
- This avoids stale UI while preventing overlapping load races.

4. Validate with reversible in-memory simulation before release
- Simulate done-match changes in browser memory only.
- Restore all pre-test state after checks.
- Never call save paths during simulation when production data must remain untouched.

## v3.1 Operational Guardrails (April 11, 2026)

1. Treat external APIs as multi-shape contracts
- POTM/status fields can appear in multiple payload paths depending on ESPN response shape.
- Parsers must resolve through ordered fallbacks, not a single hard-coded path.
- Verification UIs must call the same parser helpers used by live sync paths.

2. Enforce atomic enrichment flow
- For every sync/import path: CricAPI update must complete before ESPN enrichment starts.
- Never leave manual reimport or fetch-all paths outside this sequence.
- If this rule changes, all entry points must be audited in the same change.

3. Use source-of-truth spot checks after parser changes
- Re-check at least one raw ESPN payload with command-line extraction before release.
- Confirm helper output equals raw payload truth for status and POTM.

## v3.2 UI/UX Learnings (April 11, 2026)

1. Sticky/frozen columns should be conditional, not always-on
- Sticky columns improve usability only when horizontal overflow exists.
- For non-overflow layouts, sticky behavior should be disabled to avoid visual clutter and awkward hover layering.

2. Dense data tables need role-scaled typography
- Filter controls should match header density, not form-field defaults.
- In compact tables, shorter heights and tighter paddings reduce accidental horizontal scroll.

3. Multi-sort controls should prioritize scanability over grouping chrome
- Multiple boxed wrappers increase visual noise, especially on mobile.
- A compact indexed grid with aligned key/direction selectors improves readability on both desktop and phone.

4. UI-only changes still require explicit regression checks
- Even when scoring logic is untouched, verify sorting, filtering, and sticky behavior under resize and tab switches.

## Points Accuracy Verification Protocol

Run this protocol for any change touching scoring, parsing, enrichment, sync ordering, or imports.

1. Pre-sync baseline capture
- Capture team totals snapshot.
- Capture target-match fields: status, POTM, and at least 2 bowler dot counts.

2. Execute one full sync cycle
- Run the same production path (not a custom debug-only path).
- Confirm completion counters (matches synced, ESPN updated).

3. Post-sync diff analysis
- Compute per-team delta and explain every non-zero change.
- If all deltas are zero, confirm expected reason (for example, data already present).

4. Player-level scoring audit
- For at least 3 players in affected match(es), validate:
- base points breakdown
- POTM value applied before multiplier
- captain/vice-captain multiplier rounding behavior

5. Invariant checks
- `liveData.captains` unchanged and non-null.
- No unexpected key deletions from `match.performances`.
- Match status transitions only where source data indicates change.

## Release Gate for Discrepancy Risk

Do not commit or push if any item below is unresolved:

1. Parser helper output disagrees with sampled raw ESPN payload.
2. Any team delta cannot be explained from match-level updates.
3. C/VC state changed unexpectedly.
4. Sync path parity is incomplete (one entry point still bypasses atomic sequence).

## Verification Results Template

Use this template for any scoring-impacting release note.

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

## UI/UX Verification Template

Use this template for UI-only releases (no scoring/parser/sync behavior changes).

### 1. Change Scope

- Release/patch ID:
- Areas touched: layout | styling | controls | interaction
- Risk level: low | medium | high

### 2. Layout Behavior Checks

- Horizontal overflow present on Players table: yes/no
- Sticky columns enabled only when overflow exists: yes/no
- Sticky columns disabled when no overflow exists: yes/no

### 3. Control Density Checks

- Filter input height/font aligned with table-header density: yes/no
- Filter controls fit without forcing extra horizontal scroll: yes/no
- Multi-sort controls readable at desktop width: yes/no
- Multi-sort controls readable at mobile width: yes/no

### 4. Interaction Checks

- Column sort buttons still update sort state correctly: yes/no
- Filter inputs still apply expected column filters: yes/no
- Multi-sort level key/direction changes still apply in order: yes/no
- Players tab remains stable after resize and tab switch: yes/no

### 5. Non-Functional Invariants

- No scoring functions changed: yes/no
- No parser/sync functions changed: yes/no
- No Firebase write path changes introduced: yes/no

### 6. Evidence Links

- Screenshots (desktop/mobile):
- Before/after UI diff notes:
- Relevant commit SHA(s):

### 7. Release Gate Decision

- Layout behavior checks passed: yes/no
- Interaction checks passed: yes/no
- Invariants check passed: yes/no
- Final decision: ship | hold
- If hold, required fixes:
- Relevant commit SHA(s):

### 8. Release Gate Decision

- Parser truth check passed: yes/no
- Sync parity check passed: yes/no
- C/VC integrity check passed: yes/no
- Unexplained delta present: yes/no
- Final decision: ship | hold
- If hold, required fixes:
