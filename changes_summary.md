# Changes Summary: Auction Packed

---

## v4.0 — April 14, 2026

### Summary

UI and Insights overhaul plus dynamic ESPN match ID resolution. No scoring changes.

### Board Tab

1. **Team slugs as primary display names**
   - Each fantasy team shows a custom slug (e.g., "KKKKeKran meKran" for VATS) as the main heading
   - Real team name shown below in red at the same font size as C:/VC: labels
   - `TEAM_SLUGS` constant maps all 9 team names to slugs

2. **Squad expand/collapse arrow fixed**
   - Arrow now correctly shows ▶ when collapsed and ▼ when expanded
   - Root cause: old selector `querySelector('[style*="SQUAD"]')` was matching against style attribute, not text content — fixed by adding `class="squad-arrow"` and `class="lb-row-header"`

3. **Live player glow**
   - Players whose IPL team is playing in the current live match pulse green via `player-live-glow` CSS class
   - Uses existing `getMatchTeamList()` and `isPlayerFromMatchTeams()` helpers
   - Applied in both Board and Live tabs

4. **BPL emoji — rank-based, not team-based**
   - Bottom 3 ranked teams always show 🤢 on their slug (collapsed) and 🤮 (expanded)
   - Emoji follows rank position, not team identity — moves with ranking changes on re-render
   - Driven by `data-bpl` attribute on the clickable header div; `toggleRosterLB` swaps emoji via text replacement

5. **Removed white flash on expand/collapse**
   - `transition:all 0.2s` on `.lb-row` caused background repaint flash — scoped to `transition:border-color 0.2s`
   - Mobile tap flash suppressed via `-webkit-tap-highlight-color:transparent` on `.lb-row-header` only (not globally)

6. **Player modal cleanup**
   - Removed " pts" suffix from per-match point totals in breakdown cards
   - Removed "adjustment" word from "Captain 2× adjustment" and "Vice Captain 1.5× adjustment" labels

### Live Tab

Full rewrite of the team ranking section:

- Today's accumulated points (aggregated across all scoring matches on the current date, plus any live match)
- Team slugs, red team names, C:/VC: labels — same layout as Board
- Expandable squad rows with live player glow for active match players
- BPL emoji on bottom 3 teams, same 🤢/🤮 expand behavior
- `toggleRosterLive()` added as dedicated toggle function for Live tab roster panels
- Title changed from "Fantasy Points This Match" to "Fantasy Points Today"

### Insights — Consistency Chart

1. **Players / Teams sub-tabs**
   - Toggle between player-level and team-level scatter charts within the Consistency card
   - `insightsScatterMode` state variable (`'players'` | `'teams'`)
   - `switchScatterMode(mode)` function re-renders on switch

2. **Teams scatter chart**
   - X: average team points per match; Y: sigma (std dev); bubble size: total season points
   - Colors via `insightPalette(idx)` — one per fantasy team
   - Per-team legend with checkboxes, Select All / Clear All — identical UX to Players role legend
   - `insightsScatterVisibleTeams` state, `toggleScatterTeam()`, `setAllScatterTeams()` functions
   - Hover tooltip shows slug · Avg · Sigma · Total; no SVG text labels on bubbles

3. **Dynamic axis auto-scaling (both axes, both sub-tabs)**
   - Both X and Y now use `axisMin = max(0, dataMin − padding)`, `axisMax = dataMax + padding`
   - `padding = max(dataRange × 15%, dataMax × 5%, 1)`
   - Tick labels span the actual data range — prevents all bubbles clustering in one corner
   - Previously Y was anchored to 0, wasting chart space when sigma values were all 88+

4. **Explanation text**
   - Added "Lower, larger, and further is better." before "Bubble size represents total accumulated points." in both scatter explain entries

### ESPN Match ID Resolution

1. **Dynamic ESPN `match_id` + `slug` from liveScores API**
   - Previously all ESPN `match_id` and `slug` values were hard-coded in `IPL_2026_SCHEDULE`
   - Hard-coded values could be stale; the real IDs are only confirmed once a match goes live
   - New system fetches live match IDs from ESPN `live-scores` endpoint and stores them permanently in Firebase

2. **`fetchAndStoreESPNLiveMatchIds()`**
   - Calls `GET /api/v1/cricketinfo/live-scores`; filters to IPL via `series.id === '1510719'`
   - Extracts `match_id` and `slug`, forms full slug as `slug-match_id`
   - Matches back to `IPL_2026_SCHEDULE` by date + team abbreviations
   - Stores resolved `{match_id, slug}` in `liveData.espnMatchSlugMap` keyed by schedule match number
   - Persists via `saveLiveData(true)` to avoid race with Firebase listener

3. **`resolveESPNMatchInfo(scheduleMatch)`**
   - Single authority for ESPN IDs — returns Firebase-stored value if available, falls back to hard-coded schedule
   - Used by all ESPN data fetch call sites

4. **`liveData.espnMatchSlugMap` — new Firebase field**
   - Keyed by schedule match number; hydrated on load; written atomically with full `liveData` save

5. **Auto-sync integration**
   - `syncEspnForScheduleMatchesAtomic()` and `fetchESPNDataManual()` both call `fetchAndStoreESPNLiveMatchIds()` before their fetch loops
   - One API call per sync cycle; one-time-per-match storage once resolved

---

## v1.0 — April 10, 2026

**Status:** Production Ready

### Overview

Auction Packed is a fully functional fantasy cricket platform for IPL 2026. This section covers everything shipped in the v1.0 release.

### Major Changes Timeline

#### Phase 1: ESPN Data Integration & Parser Fixes

1. **Bowler Dot Data Parsing**: Fixed incorrect structure assumption in ESPN API responses
   - Problem: Parser assumed `inning.bowling` was a nested object with team arrays
   - Solution: Corrected to iterate `inning.bowling` as direct array of bowler objects
   - Impact: Enabled accurate dot ball data collection from ESPN

2. **POTM Data Handling**: Enhanced Player of the Match data extraction
   - Problem: Code assumed POTM was always an object with `name` property
   - Solution: Added logic to handle both object and array formats
   - Impact: Robust POTM data import from ESPN

**New Helpers Added**
- `getESPNPayload(matchData)`: Safely extracts payload from various ESPN response structures
- `getESPNInnings(matchData)`: Retrieves innings array handling different formats
- `getESPNBowlerDots(bowler)`: Extracts dot ball count with multiple key fallbacks
- `findESPNBowlerPerformanceKey(match, bowlerName)`: Matches ESPN bowler names to scorecard using fuzzy matching
- `parseESPNData(matchData, matchIndex)`: Core parser for ESPN response with corrected structure navigation

**Updated Functions**
- `fetchESPNDataManual()`: Integrated new parsing logic with verification entry collection
- Added dot updates array and POTM verification to admin modal

---

#### Phase 2: CricAPI UUID Seeding & Firebase Persistence

**Commit:** `0bf1f88` — "Hardcode completed CricAPI UUIDs and persist ID map"

1. **Hard-Coded CricAPI UUIDs**: All completed IPL 2026 matches (1–15) now have verified CricAPI match IDs
   - Eliminates UUID resolution bottleneck for past matches
   - UUID mapping stored directly in schedule definition

2. **Firebase UUID Map Persistence**: CricAPI ID mapping now survives browser reloads
   - New data structure: `liveData.cricapiIdMap` (key=espn_match_id, value=cricapi_uuid)
   - Hydrated on Firebase data load; synced on save

**New Functions**
- `ensureCricapiIdMap()`: Initializes and validates UUID map structure
- `setCricapiIdForScheduleMatch(schedMatch, cricapiUUID)`: Records UUID for schedule match
- `persistCricapiIdMapSilently()`: Saves UUID map to Firebase without side effects

---

#### Phase 3: Historical Match Import & ESPN Backfill Fix

**Commit:** `7ed6a24` — "Fix historical CricAPI import and ESPN backfill for all past matches"

**Root Cause:** Only the last ~4 matches were importing — import used `currentMatches` pagination (rolling window of 10–15 matches); ESPN data was then skipped for un-imported matches.

**Architecture Changes**
1. **Schedule-Based Iteration**: Iterate `IPL_2026_SCHEDULE` up to today instead of API pagination
2. **Series Data Resolution**: Use full series matchList to resolve all schedule entries to CricAPI UUIDs
3. **Scorecard Auto-Backfill**: Ensure scorecards are imported before ESPN updates apply

**New Functions**
- `fetchSeriesMatchList()`: Fetches complete IPL 2026 series matchList from CricAPI
- `findSeriesMatchForScheduleMatch(schedMatch, seriesList)`: Resolves schedule match to series match
- `ensureScorecardImportedForScheduleMatch(schedMatch)`: Auto-imports scorecard before ESPN update

**Redesigned Functions**
- `importAllScheduledMatches()`: Complete rewrite with schedule-based iteration
- `fetchESPNDataManual()`: Enhanced with backfill support

---

#### Phase 4: Admin Status Visibility & Live Progress Tracking

**Commit:** `cfc9b7d` — "Add import-all status panel with progress and run summary"

**Problem:** No visibility into whether "Import All Scheduled" succeeded or failed.

**New Features**
1. **Import Status Object** persisted to `liveData.importAllScheduledStatus`:
   - `state`: RUNNING | LAST_RUN | FAILED
   - `startedAt` / `finishedAt`: ISO timestamps
   - `processed` / `total` / `imported` / `refreshed` / `failed` / `skippedNoId`: counters
   - `summary`: human-readable result message

2. **Admin Panel Display**: New status section with live counters, color-coded indicator, timestamps, and summary message

---

### Features Implemented (v1.0)

**Core**
- Leaderboard: real-time fantasy points ranking with team rosters
- Player Database: complete squad management for all 10 IPL teams
- Fantasy Scoring: full batting, bowling, fielding rules
- Captain Selection: per-team C/VC with permanent lock-in and 2x/1.5x multipliers
- Match Tracking: full IPL 2026 schedule (74 matches) with status indicators
- Live Match: ball-by-ball updates and live fantasy points tracking
- Player Modal: detailed stats view for individual players

**Integration & Data**
- CricAPI Integration: match schedules, scores, player performances
- ESPN RapidAPI Integration: bowler dots, Player of the Match
- Firebase Real-time Sync: persistent storage and cross-device sync
- UUID Hard-coding: first 15 matches have verified CricAPI IDs
- Historical Backfill: auto-import missing scorecards for ESPN updates

**Admin Features**
- Secure login; Import All; Manual Import by UUID; ESPN Data Fetch; Data Verification; Captain Override; Import Status Panel

### Commit History (v1.0 Development)

```
cfc9b7d - Add import-all status panel with progress and run summary
7ed6a24 - Fix historical CricAPI import and ESPN backfill for all past matches
0bf1f88 - Hardcode completed CricAPI UUIDs and persist ID map
2b8475a - Fix: Attach importAllScheduledMatches to window for admin button
c9c7a2a - Admin: Add Import All Scheduled button and function for full IPL match import
921acd0 - Admin C/VC override: allow admin to set or change Captain/Vice Captain for any team
da8e775 - Rename remixed-aecc902e.html to index.html for GitHub Pages
9b173d3 - Initial commit
```

---

## Post-v1.0 Critical Fixes — April 11, 2026

### Fixes Shipped

1. **ESPN data preservation during refresh/import flows** (`a8b595c`)
   - Fixed ESPN-sourced fields (`dots`, `potm`) being lost during scorecard refresh/import
   - Ensured merge behavior uses safe upsert paths instead of destructive overwrite

2. **Unified admin import action** (`12779a0`)
   - Consolidated redundant admin actions into single `Fetch CricAPI Results` flow

3. **ET auto-sync window + admin UX improvements** (`fa84bc2`)
   - Auto-sync restricted to 6:00 AM–2:30 PM ET with daily final sync after window close
   - Added collapsible C/VC override section with batch save/cancel
   - Added saved match stack backfill for completed matches

4. **Saved match section collapse behavior** (`5638371`)
   - `Collapse Section` now keeps only latest card visible and collapsed by default

5. **Player mis-assignment fix — Singh collision** (`f5a3473`, `ebaf411`)
   - Fixed ambiguous name mapping where Ramandeep stats leaked to Arshdeep
   - Added ESPN alias: `Digvesh Rathi` → `Digvesh Singh`

6. **Regression fix: prevent destructive auto-pruning of performances** (`f830d62`)
   - Removed listener-side auto-sanitization/write-back path that could mutate stored performance data

7. **Regression guard: preserve C/VC selections** (`b8ffafb`)
   - Added captain/vice-captain preservation guard in save flow to prevent accidental null overwrite of `liveData.captains`

### Incident Notes

1. **Root incident: C/VC multipliers disappeared**
   - Symptom: leaderboard points dropped across all teams
   - Root cause: `captains` became null in Firebase write path during a listener-triggered save cycle
   - Resolution: restored captain data, removed destructive listener save path, added save guard

2. **Root incident: Digvesh dots missing**
   - Symptom: wickets present but dot balls stayed zero
   - Root cause: ESPN name variant `Digvesh Rathi` not mapping to local key `Digvesh Singh`
   - Resolution: alias normalization added and validated via parser check

### Verified Leaderboard Baseline (After Restoration)

| Team | Points |
|------|--------|
| VATS | 2840 |
| ASVIN | 2368 |
| KARTHIK | 2217 |
| MUKIL | 2204 |
| VINAY | 1776 |
| ALVA | 1723 |
| GAJA | 1673 |
| SRIPAD | 1615 |
| ANIRUDH | 1566 (includes Digvesh correction) |

---

## v3.0 — April 11, 2026

**Title:** Insights Cache Invalidation & Reliability Addendum

### Highlights

1. Added automatic invalidation and reload for Insights batting-position cache when completed matches change
   - Batting-position enrichment now reloads without manual page refresh
   - Cache invalidation tied to a deterministic completed-match signature (not a one-time load flag)

2. Safe in-flight refresh handling
   - Added reload-request guard when source data changes during enrichment load
   - Prevents stale insights state while avoiding duplicate overlapping loads

3. Data safety preserved
   - No changes to scoring functions or points formulas
   - No listener-triggered writes introduced
   - Validation used in-memory simulation with full state restore (no Firebase writes during testing)

4. Operational discrepancy-prevention framework added to [LEARNINGS.md](LEARNINGS.md)
   - Standardized points accuracy verification protocol for scoring-impacting changes
   - Release gates block push when parser truth, sync parity, or C/VC integrity checks fail

---

## v3.2 — April 11, 2026

**Title:** Players UX Compaction and Adaptive Sticky Columns

### Highlights

1. **Conditional sticky columns for Players table**
   - Rank and Player columns are sticky only when horizontal overflow exists
   - Sticky behavior is removed automatically when no horizontal scroll is needed

2. **Compact filter controls aligned with header density**
   - Reduced filter field height, font size, and padding
   - Tightened filter row spacing for cleaner data-table ergonomics

3. **Multi-sort layout modernization**
   - Replaced heavy group wrappers with a compact indexed grid layout
   - Improved readability on desktop while stacking cleanly on mobile

4. **Change boundary safety**
   - No scoring, parser, sync-flow, or Firebase write-path logic changed

---

## Verification Templates

### Scoring-Impacting Changes

#### 1. Change Scope
- Release/patch ID:
- Areas touched: scoring | parser | sync flow | mapping | UI-only
- Risk level: low | medium | high

#### 2. Baseline Snapshot (Before Run)
- Team totals snapshot timestamp:
- Target matches sampled:
- Key fields captured per target match: status, POTM, dot balls (at least 2 bowlers)

#### 3. Execution Path Used
- Production path executed (exact function/button flow):
- Was CricAPI → ESPN sequencing atomic on this path? yes/no
- Sync result counters (matches synced, ESPN updated):

#### 4. Results and Deltas
- Team delta table attached: yes/no
- Any non-zero delta explained from match-level updates: yes/no
- If all deltas are zero, expected reason documented: yes/no

#### 5. Player-Level Scoring Audit
- Players audited (minimum 3):
- Verified per player: base points breakdown, POTM applied before multiplier, C/VC multiplier and rounding behavior

#### 6. Historical Mistake Prevention Checks

| Past Incident | Check | Prevention Step |
|---|---|---|
| C/VC state loss | `liveData.captains` remained present and unchanged during save | Block release if captains become null/invalid |
| Listener destructive writeback | No listener path writes broad state back to Firebase | Allow only explicit admin/action-driven save paths |
| Unintended performance pruning | No automatic sanitizer removed historical `match.performances` keys | Sanitization only as explicit admin action with diff review |
| ESPN name mismatch (Digvesh) | Alias mapping covers sampled external name variants | Add canonical alias once and verify parser output using real payload |
| ESPN payload shape mismatch (POTM/status) | Helper fallback paths resolved correct fields from raw payload sample | Verification UI and sync path must share same helper implementation |
| Partial sync parity gap | All import/reimport/fetch flows confirmed to chain ESPN after CricAPI | Release blocked until all entry points pass parity checklist |

#### 7. Evidence Links
- Raw payload sample(s):
- Helper output sample(s):
- Before/after totals evidence:
- Relevant commit SHA(s):

#### 8. Release Gate Decision
- Parser truth check passed: yes/no
- Sync parity check passed: yes/no
- C/VC integrity check passed: yes/no
- Unexplained delta present: yes/no
- Final decision: ship | hold
- If hold, required fixes:

---

### UI-Only Changes

#### 1. Change Scope
- Release/patch ID:
- Areas touched: layout | styling | controls | interaction
- Risk level: low | medium | high

#### 2. Layout Behavior Checks
- Horizontal overflow present on Players table: yes/no
- Sticky columns enabled only when overflow exists: yes/no
- Sticky columns disabled when no overflow exists: yes/no

#### 3. Control Density Checks
- Filter input height/font aligned with table-header density: yes/no
- Filter controls fit without forcing extra horizontal scroll: yes/no
- Multi-sort controls readable at desktop width: yes/no
- Multi-sort controls readable at mobile width: yes/no

#### 4. Interaction Checks
- Column sort buttons still update sort state correctly: yes/no
- Filter inputs still apply expected column filters: yes/no
- Multi-sort level key/direction changes still apply in order: yes/no
- Players tab remains stable after resize and tab switch: yes/no

#### 5. Non-Functional Invariants
- No scoring functions changed: yes/no
- No parser/sync functions changed: yes/no
- No Firebase write path changes introduced: yes/no

#### 6. Release Gate Decision
- Layout behavior checks passed: yes/no
- Interaction checks passed: yes/no
- Invariants check passed: yes/no
- Final decision: ship | hold
- If hold, required fixes:
