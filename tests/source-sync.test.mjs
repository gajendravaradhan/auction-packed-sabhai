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
