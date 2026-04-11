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
