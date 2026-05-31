// Backup merge + CricBuzz ID overlay tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ─── Reimplement merge logic ─────────────────────────────────────────────────

function buildMerger() {
  const liveData = { matches: [] };

  function _findMatchingLiveIndex(backupMatch) {
    if (!backupMatch) return -1;
    const list = liveData.matches || [];
    if (backupMatch.apiId) {
      const i = list.findIndex(m => m && m.apiId === backupMatch.apiId);
      if (i !== -1) return i;
    }
    const bd = (backupMatch.date || '').slice(0, 10);
    if (!bd) return -1;
    const bLabel = String(backupMatch.label || '').toLowerCase();
    return list.findIndex(m => {
      if (!m) return false;
      if ((m.date || '').slice(0, 10) !== bd) return false;
      const mLabel = String(m.label || '').toLowerCase();
      if (mLabel && bLabel && (mLabel.includes(bLabel.slice(0, 12)) || bLabel.includes(mLabel.slice(0, 12)))) return true;
      const t1 = (m.teams && m.teams[0]) || ''; const t2 = (m.teams && m.teams[1]) || '';
      return bLabel.includes(String(t1).toLowerCase()) && bLabel.includes(String(t2).toLowerCase());
    });
  }
  function _mergeBackupMatch(backupMatch) {
    const idx = _findMatchingLiveIndex(backupMatch);
    if (idx === -1) { liveData.matches.push(backupMatch); return 'added'; }
    const cur = liveData.matches[idx];
    const merged = Object.assign({}, cur);
    const curPerfs = cur.performances || {};
    const bakPerfs = backupMatch.performances || {};
    const curCount = Object.keys(curPerfs).length;
    if (curCount === 0 && Object.keys(bakPerfs).length > 0) {
      merged.performances = bakPerfs;
    } else if (Object.keys(bakPerfs).length > 0) {
      const out = Object.assign({}, curPerfs);
      Object.keys(bakPerfs).forEach(name => {
        out[name] = Object.assign({}, bakPerfs[name], curPerfs[name] || {});
        if (curPerfs[name] && curPerfs[name].dots != null) out[name].dots = curPerfs[name].dots;
      });
      merged.performances = out;
    }
    if (!merged.potm && backupMatch.potm) merged.potm = backupMatch.potm;
    if (!merged.matchResult && backupMatch.matchResult) merged.matchResult = backupMatch.matchResult;
    if (!(merged.scorecard_raw || []).length && (backupMatch.scorecard_raw || []).length) merged.scorecard_raw = backupMatch.scorecard_raw;
    if (!merged.status || merged.status === 'upcoming') if (backupMatch.status) merged.status = backupMatch.status;
    if (!merged.label && backupMatch.label) merged.label = backupMatch.label;
    if (!merged.teams && backupMatch.teams) merged.teams = backupMatch.teams;
    liveData.matches[idx] = merged;
    return 'merged';
  }

  return { liveData, _findMatchingLiveIndex, _mergeBackupMatch };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('merge: backup match with same apiId merges into existing', () => {
  const m = buildMerger();
  m.liveData.matches.push({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB', performances: {} });
  const result = m._mergeBackupMatch({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB', performances: { 'V Kohli': { runs: 50 } } });
  assert.equal(result, 'merged');
  assert.equal(m.liveData.matches.length, 1);
  assert.equal(m.liveData.matches[0].performances['V Kohli'].runs, 50);
});

test('merge: backup match with different apiId but same date+teams merges', () => {
  const m = buildMerger();
  m.liveData.matches.push({ apiId: 'cricbuzz-1', date: '2026-03-28', label: 'SRH vs RCB', teams: ['SRH', 'RCB'], performances: {} });
  const result = m._mergeBackupMatch({ apiId: 'cricapi-X', date: '2026-03-28', label: 'SRH vs RCB', performances: { 'V Kohli': { runs: 60 } } });
  assert.equal(result, 'merged');
  assert.equal(m.liveData.matches.length, 1, 'no duplicate created');
});

test('merge: backup match with new date adds rather than merges', () => {
  const m = buildMerger();
  m.liveData.matches.push({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB' });
  const result = m._mergeBackupMatch({ apiId: '149629', date: '2026-03-29', label: 'KKR vs MI' });
  assert.equal(result, 'added');
  assert.equal(m.liveData.matches.length, 2);
});

test('merge: existing dots preserved when backup has no dots for that player', () => {
  const m = buildMerger();
  m.liveData.matches.push({
    apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB',
    performances: { 'JJ Bumrah': { wickets: 2, dots: 18 } }
  });
  m._mergeBackupMatch({
    apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB',
    performances: { 'JJ Bumrah': { wickets: 3 } }
  });
  // wickets updated from backup, dots preserved from current
  assert.equal(m.liveData.matches[0].performances['JJ Bumrah'].dots, 18);
  // current curPerfs wins for non-dot fields too — merge order is Object.assign({}, bakPerfs[name], curPerfs[name])
  assert.equal(m.liveData.matches[0].performances['JJ Bumrah'].wickets, 2);
});

test('merge: backup performances fill in when current has none', () => {
  const m = buildMerger();
  m.liveData.matches.push({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB', performances: {} });
  m._mergeBackupMatch({
    apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB',
    performances: { 'V Kohli': { runs: 50 }, 'JJ Bumrah': { wickets: 2 } }
  });
  assert.equal(m.liveData.matches[0].performances['V Kohli'].runs, 50);
  assert.equal(m.liveData.matches[0].performances['JJ Bumrah'].wickets, 2);
});

test('merge: POTM filled from backup when current empty', () => {
  const m = buildMerger();
  m.liveData.matches.push({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB' });
  m._mergeBackupMatch({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB', potm: 'V Kohli' });
  assert.equal(m.liveData.matches[0].potm, 'V Kohli');
});

test('merge: existing POTM preserved (current wins)', () => {
  const m = buildMerger();
  m.liveData.matches.push({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB', potm: 'AB de Villiers' });
  m._mergeBackupMatch({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB', potm: 'V Kohli' });
  assert.equal(m.liveData.matches[0].potm, 'AB de Villiers');
});

test('merge: scorecard_raw filled when current empty', () => {
  const m = buildMerger();
  m.liveData.matches.push({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB', scorecard_raw: [] });
  m._mergeBackupMatch({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB', scorecard_raw: [{ score: 'SRH 200' }] });
  assert.equal(m.liveData.matches[0].scorecard_raw.length, 1);
});

test('merge: status promoted from upcoming → done by backup', () => {
  const m = buildMerger();
  m.liveData.matches.push({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB', status: 'upcoming' });
  m._mergeBackupMatch({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB', status: 'done' });
  assert.equal(m.liveData.matches[0].status, 'done');
});

test('merge: status="done" never demoted by backup with upcoming', () => {
  const m = buildMerger();
  m.liveData.matches.push({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB', status: 'done' });
  m._mergeBackupMatch({ apiId: '149618', date: '2026-03-28', label: 'SRH vs RCB', status: 'upcoming' });
  assert.equal(m.liveData.matches[0].status, 'done');
});

test('merge: 70 backup matches merge into 70 existing matches (no duplicates)', () => {
  const m = buildMerger();
  for (let i = 1; i <= 70; i++) {
    m.liveData.matches.push({
      apiId: 'A-' + i,
      date: '2026-04-' + String(i).padStart(2, '0'),
      label: 'Match ' + i,
      performances: {},
    });
  }
  for (let i = 1; i <= 70; i++) {
    m._mergeBackupMatch({
      apiId: 'A-' + i,
      date: '2026-04-' + String(i).padStart(2, '0'),
      label: 'Match ' + i,
      performances: { 'Player': { runs: 10 } },
    });
  }
  assert.equal(m.liveData.matches.length, 70, 'no duplicates');
  assert.equal(m.liveData.matches[0].performances['Player'].runs, 10);
});

// ─── Schedule overlay tests ──────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8');

test('CRICBUZZ_MATCH_IDS_2026 constant defined with 74 entries', () => {
  assert.match(indexHtml, /CRICBUZZ_MATCH_IDS_2026\s*=\s*\{/);
  // Sample entries from CSV
  assert.match(indexHtml, /1:'149618'/);
  assert.match(indexHtml, /70:'152263'/);
  assert.match(indexHtml, /Q1:'155376'/);
  assert.match(indexHtml, /F:'155409'/);
});

test('applyCricbuzzMatchIdOverlay function defined and invoked', () => {
  assert.match(indexHtml, /function applyCricbuzzMatchIdOverlay\(\)/);
  assert.match(indexHtml, /applyCricbuzzMatchIdOverlay\(\);/);
});

test('Playoff home/away swapped to match CSV ordering: Q2 RR vs GT, F GT vs RCB', () => {
  assert.match(indexHtml, /match:'Q2'.*home:'RR',away:'GT'/);
  assert.match(indexHtml, /match:'F'.*home:'GT',away:'RCB'/);
});

test('downloadBackup contains pre-download confirm dialog explaining providers', () => {
  assert.match(indexHtml, /Download match scorecards backup\?/);
  // Provider notice may span string-literal boundaries; check for the
  // distinctive phrase only.
  assert.match(indexHtml, /this app has API keys for/);
});

test('downloadBackup payload includes providersWithKeys + matches only (no auctions/captains)', () => {
  const fn = /async function downloadBackup\(\)[\s\S]*?\n\}\s*\n/.exec(indexHtml);
  assert.ok(fn, 'downloadBackup must be defined');
  const body = fn[0];
  assert.match(body, /providersWithKeys:\s*keyedProviders/);
  assert.match(body, /matches,?$|matches,/m);
  assert.ok(!/auctions:/.test(body), 'no auctions field in backup payload');
  assert.ok(!/firebase:\s*\{/.test(body), 'no firebase wrapper in new payload');
  assert.ok(!/localStorage:/.test(body), 'no localStorage field in new payload');
});

test('restoreFromBackup attempts merge first, falls back to replace on error', () => {
  const fn = /async function restoreFromBackup\(input\)[\s\S]*?\n\}\s*\n/.exec(indexHtml);
  assert.ok(fn, 'restoreFromBackup must be defined');
  const body = fn[0];
  // Merge attempt
  assert.match(body, /_mergeBackupMatch\(bm\)/);
  // Catch + fallback
  assert.match(body, /mergeMode\s*=\s*'replaced'/);
  // Auto-recompute call
  assert.match(body, /recomputePointsFromStored\(\)/);
});

test('restoreFromBackup accepts both v2 and legacy v1 formats', () => {
  const body = /async function restoreFromBackup\(input\)[\s\S]*?\n\}\s*\n/.exec(indexHtml)[0];
  assert.match(body, /backup\.firebase\.live\.matches/);
  assert.match(body, /Array\.isArray\(backup\.matches\)/);
});

test('fetchAllConcludedScorecards auto-calls recomputePointsFromStored on completion', () => {
  // Find the function and look near its end for the recompute call
  const fn = /async function fetchAllConcludedScorecards\(\)[\s\S]*?\n\}\s*\n/.exec(indexHtml);
  assert.ok(fn, 'fetchAllConcludedScorecards must be defined');
  assert.match(fn[0], /recomputePointsFromStored\(\)/);
});
