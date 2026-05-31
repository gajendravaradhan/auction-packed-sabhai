// Asserts that index.html and live.html stay in sync apart from the PWA
// manifest fields (start_url / scope). Also asserts that the production code
// contains the load-guard and snapshot helpers — so a refactor that drops them
// would surface here, not in production.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const indexHtml = readFileSync(resolve(repoRoot, 'index.html'), 'utf8');
const liveHtml = readFileSync(resolve(repoRoot, 'live.html'), 'utf8');

test('index.html and live.html differ ONLY in PWA manifest start_url and scope', () => {
  const indexLines = indexHtml.split('\n');
  const liveLines = liveHtml.split('\n');
  assert.equal(indexLines.length, liveLines.length, 'line counts must match exactly');
  const differing = [];
  for (let i = 0; i < indexLines.length; i++) {
    if (indexLines[i] !== liveLines[i]) {
      differing.push({ line: i + 1, index: indexLines[i].trim(), live: liveLines[i].trim() });
    }
  }
  // Exactly two lines should differ: start_url and scope inside the manifest.
  assert.equal(differing.length, 2, `expected 2 manifest differences, got ${differing.length}: ${JSON.stringify(differing)}`);
  const allManifest = differing.every(d =>
    /start_url:/.test(d.index) || /scope:/.test(d.index)
  );
  assert.equal(allManifest, true, 'all differences must be manifest fields');
});

test('index.html contains _liveLoadedFromFirebase guard', () => {
  assert.match(indexHtml, /_liveLoadedFromFirebase\s*=\s*false/);
  assert.match(indexHtml, /if\s*\(!_liveLoadedFromFirebase\)/);
});

test('index.html contains empty-matches write guard inside saveLiveData', () => {
  assert.match(indexHtml, /liveData\.matches\.length\s*===\s*0/);
});

test('index.html defines snapshotUiState and restoreUiState and renderTabPreserveState', () => {
  assert.match(indexHtml, /function snapshotUiState\(/);
  assert.match(indexHtml, /function restoreUiState\(/);
  assert.match(indexHtml, /function renderTabPreserveState\(/);
});

test('index.html tracks _currentPlayerModalName in openPlayerModal and closePlayerModal', () => {
  assert.match(indexHtml, /var _currentPlayerModalName\s*=\s*null/);
  assert.match(indexHtml, /_currentPlayerModalName\s*=\s*playerName/);
  assert.match(indexHtml, /_currentPlayerModalName\s*=\s*null;[\s\S]{0,20}\}/);
});

test('initFirebaseListener wires renderTabPreserveState (sync-driven render)', () => {
  assert.match(indexHtml, /_renderDebounceTimer\s*=\s*setTimeout\(\s*\(\s*\)\s*=>\s*renderTabPreserveState/);
});

test('saveLiveData still strips captains from payload (regression guard)', () => {
  assert.match(indexHtml, /delete payload\.captains/);
});

test('playoff resolver functions are defined in index.html', () => {
  assert.match(indexHtml, /function computeIPLStandings\(/);
  assert.match(indexHtml, /function resolvePlayoffTeams\(/);
  assert.match(indexHtml, /function maybeResolvePlayoffFromScorecard\(/);
  assert.match(indexHtml, /function applyPlayoffTeamsToSchedule\(/);
  assert.match(indexHtml, /function getMatchWinnerCode\(/);
  assert.match(indexHtml, /function mapTeamNameToFranchiseCode\(/);
});

test('PLAYOFF_MATCH_KEYS constant exists with Q1/EL/Q2/F', () => {
  assert.match(indexHtml, /PLAYOFF_MATCH_KEYS\s*=\s*\[\s*'Q1'\s*,\s*'EL'\s*,\s*'Q2'\s*,\s*'F'\s*\]/);
});

test('upsertMatch invokes scorecard playoff resolver before saveLiveData', () => {
  // Confirm maybeResolvePlayoffFromScorecard appears before saveLiveData() inside upsertMatch
  const upsertMatch = /function upsertMatch\([\s\S]*?\n\}/.exec(indexHtml);
  assert.ok(upsertMatch, 'upsertMatch function must be found');
  const body = upsertMatch[0];
  const scorecardIdx = body.indexOf('maybeResolvePlayoffFromScorecard');
  const saveIdx = body.indexOf('saveLiveData()');
  assert.ok(scorecardIdx > 0, 'scorecard resolver must be called');
  assert.ok(saveIdx > scorecardIdx, 'resolver must run before saveLiveData so playoffTeams persists');
});

test('Firebase listener applies playoff overlay after hydration', () => {
  assert.match(indexHtml, /applyPlayoffTeamsToSchedule\(\);[\s\S]{0,200}resolvePlayoffTeams\(\)/);
});

test('populatePlayoffSlotFromLiveTeams fallback function is defined', () => {
  assert.match(indexHtml, /function populatePlayoffSlotFromLiveTeams\(/);
});

test('Listener persists newly resolved playoffTeams via saveLiveData(true) when state changes', () => {
  // The listener captures a 'before' snapshot, runs resolver, compares
  // 'after' string, and calls saveLiveData when they differ. The regex
  // verifies the gate is in place.
  assert.match(indexHtml, /if\s*\(\s*after\s*&&\s*after\s*!==\s*before\s*\)/);
  assert.match(indexHtml, /saveLiveData\(true\)/);
});

test('Robust winner parser handles wkts/beat/parenthetical formats', () => {
  // Spot-check that key tokens are present in the parsing block.
  assert.match(indexHtml, /wkts\?\|wkt/);
  assert.match(indexHtml, /beat\\s\+/);
  assert.match(indexHtml, /no result\|abandoned/);
});

test('admin cleanup: removed function definitions are gone', () => {
  const removed = [
    'clearAllDataExceptCaptains',
    'forceResyncAllCricAPI',
    'recomputeAllPointsFromCache',
    'importMatchById',
    'fixRunoutMismatches',
    'resetESPNCheckpoint',
    'resetAllCVPicks',
    'showCacheManagementModal',
    'getScorecardCacheStats',
    'clearAndRefetchFromModal',
  ];
  for (const name of removed) {
    const re = new RegExp('\\bfunction\\s+' + name + '\\b|\\basync\\s+function\\s+' + name + '\\b');
    assert.ok(!re.test(indexHtml), name + ' definition must be removed from index.html');
  }
});

test('admin cleanup: removed button onclick handlers are gone', () => {
  const removedHandlers = [
    'onclick="clearAllDataExceptCaptains()"',
    'onclick="forceResyncAllCricAPI()"',
    'onclick="recomputeAllPointsFromCache()"',
    'onclick="fixRunoutMismatches()"',
    'onclick="resetESPNCheckpoint()"',
    'onclick="resetAllCVPicks()"',
    'showCacheManagementModal(',
    'importMatchById(',
  ];
  for (const h of removedHandlers) {
    assert.ok(!indexHtml.includes(h), 'handler "' + h + '" must be removed');
  }
});

test('admin cleanup: new API and Compute sections present', () => {
  assert.match(indexHtml, /<div class="admin-section-title">API<\/div>/);
  assert.match(indexHtml, /<div class="admin-section-title">Compute<\/div>/);
  assert.match(indexHtml, /onclick="fetchAllConcludedScorecards\(\)"/);
  assert.match(indexHtml, /onclick="recomputePointsFromStored\(\)"/);
  assert.match(indexHtml, /id="fetchScoreDataBtn"/);
  assert.match(indexHtml, /id="recomputeBtn"/);
});

test('admin cleanup: fetchAllConcludedScorecards function defined with multi-provider loop', () => {
  assert.match(indexHtml, /async function fetchAllConcludedScorecards\(\)/);
  assert.match(indexHtml, /_withTemporaryActiveProvider/);
  // Done-match immunity check
  assert.match(indexHtml, /existing\.status === 'done'/);
  assert.match(indexHtml, /\(existing\.scorecard_raw \|\| \[\]\)\.length > 0/);
  assert.match(indexHtml, /Object\.keys\(existing\.performances \|\| \{\}\)\.length > 0/);
});

test('admin cleanup: recomputePointsFromStored function defined and does not call APIs', () => {
  const fn = /function recomputePointsFromStored\(\)[\s\S]*?\n\}/.exec(indexHtml);
  assert.ok(fn, 'recomputePointsFromStored must be defined');
  const body = fn[0];
  // Should NOT contain any fetch* API calls
  assert.ok(!/fetch[A-Z]\w*\(/i.test(body.replace(/renderTab|fetchScoreData/g, '')),
    'Recompute must not call any fetch* API functions');
});

test('admin cleanup: clearScorecardCacheForProvider helper retained for restoreFromBackup', () => {
  assert.match(indexHtml, /function clearScorecardCacheForProvider\(/);
});

test('findSeriesMatchForScheduleMatch has playoff-descriptor and date-only fallback paths', () => {
  assert.match(indexHtml, /PLAYOFF_DESC_RE\s*=\s*\{/);
  assert.match(indexHtml, /qualifier\\s\*1\\b/);
  assert.match(indexHtml, /eliminator\\b/);
  assert.match(indexHtml, /sameDate\.length\s*===\s*1/);
});

test('fetchCricapiResults logs skip reason when no provider ID resolved', () => {
  assert.match(indexHtml, /no provider ID for match/);
  assert.match(indexHtml, /team\/desc\/date matching all failed/);
});

test('Playoff schedule entries have real espn_match_id and slugs baked in', () => {
  // Real playoff IDs from the 2026 bracket. Home/away ordering matches the
  // CSV /Users/gajendra/ipl_2026_matches.csv: Q1 RCB vs GT, EL RR vs SRH,
  // Q2 RR vs GT, F GT vs RCB.
  assert.match(indexHtml, /match:'Q1'.*espn_match_id:1535462.*slug:'royal-challengers-bengaluru-vs-gujarat-titans-qualifier-1-1535462'/);
  assert.match(indexHtml, /match:'EL'.*espn_match_id:1535463.*slug:'rajasthan-royals-vs-sunrisers-hyderabad-eliminator-1535463'/);
  assert.match(indexHtml, /match:'Q2'.*espn_match_id:1535464.*slug:'rajasthan-royals-vs-gujarat-titans-qualifier-2-1535464'/);
  assert.match(indexHtml, /match:'F'.*espn_match_id:1535465.*slug:'gujarat-titans-vs-royal-challengers-bengaluru-final-1535465'/);
});

test('ESPN sync gates no longer require slug — only match_id', () => {
  // Both gate sites in syncEspnForScheduleMatchesAtomic and ESPN verification
  // must check only match_id now. Slug is optional.
  const gateMatches = indexHtml.match(/if\s*\(!espnInfo\.match_id\)\s*continue;/g) || [];
  assert.ok(gateMatches.length >= 2, 'both ESPN gates must drop slug requirement (found ' + gateMatches.length + ')');
  // And the legacy gate (match_id || slug) must be gone
  assert.equal(indexHtml.includes('!espnInfo.match_id || !espnInfo.slug'), false, 'old slug gate must be removed');
});

test('fetchESPNMatchDetails skips match_slug URL param when slug empty', () => {
  assert.match(indexHtml, /useSlug\s*=\s*_attempt\s*<=\s*2\s*&&\s*!!slug/);
});

test('synthesizePlayoffSlug helper is defined and used in resolveESPNMatchInfo', () => {
  assert.match(indexHtml, /function synthesizePlayoffSlug\(/);
  assert.match(indexHtml, /slug\s*=\s*synthesizePlayoffSlug\(/);
});

test('Scorecard resolver overwrites non-manual playoff slots', () => {
  assert.match(indexHtml, /const isManual\s*=\s*slot\.resolved\s*===\s*'manual'/);
  assert.match(indexHtml, /if\s*\(slot\.home\s*!==\s*homeCode\)/);
});

test('window.setPlayoffTeams and window.setPlayoffSlug are exposed for manual override', () => {
  assert.match(indexHtml, /function setPlayoffTeams\(matchKey/);
  assert.match(indexHtml, /function setPlayoffSlug\(matchKey/);
  assert.match(indexHtml, /window\.setPlayoffTeams\s*=\s*setPlayoffTeams/);
  assert.match(indexHtml, /window\.setPlayoffSlug\s*=\s*setPlayoffSlug/);
});
