// Playoff resolver tests.
//
// Reimplement the resolver functions inline with a minimal schedule so we can
// exercise every branch. The source-sync test asserts the production copies
// stay in shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ─── Test fixtures: minimal IPL schedule + team map ──────────────────────────

const ESPN_TEAM_MAP = {
  SRH: 'Sunrisers Hyderabad',
  RCB: 'Royal Challengers Bengaluru',
  KKR: 'Kolkata Knight Riders',
  MI: 'Mumbai Indians',
  CSK: 'Chennai Super Kings',
  RR: 'Rajasthan Royals',
  GT: 'Gujarat Titans',
  PBKS: 'Punjab Kings',
  DC: 'Delhi Capitals',
  LSG: 'Lucknow Super Giants'
};
const IPL_FRANCHISE_CODES = Object.keys(ESPN_TEAM_MAP);
const PLAYOFF_MATCH_KEYS = ['Q1', 'EL', 'Q2', 'F'];

// Build a synthetic 70-league schedule whose home team is always the intended
// winner for that match. The actual IPL home/away assignment is irrelevant to
// the resolver — what matters is that getMatchWinnerCode can pick the winner
// from {home, away}, and that 70 done matches exist with parseable results.
// Each match gets a unique date string so findLiveMatchForPlayoffSchedule
// works by date.
function buildScheduleForDist(dist) {
  const sched = [];
  const codes = Object.keys(dist);
  let n = 1;
  for (const winner of codes) {
    const count = dist[winner];
    for (let i = 0; i < count; i++) {
      const partner = codes.find(c => c !== winner) || winner;
      sched.push({ match: n, date: `2026-04-${String(n).padStart(2, '0')}`, home: winner, away: partner });
      n++;
    }
  }
  while (n <= 70) {
    sched.push({ match: n, date: `2026-04-${String(n).padStart(2, '0')}`, home: codes[0], away: codes[1] || codes[0] });
    n++;
  }
  sched.push({ match: 'Q1', date: '2026-05-26', home: 'TBD', away: 'TBD' });
  sched.push({ match: 'EL', date: '2026-05-27', home: 'TBD', away: 'TBD' });
  sched.push({ match: 'Q2', date: '2026-05-29', home: 'TBD', away: 'TBD' });
  sched.push({ match: 'F',  date: '2026-05-31', home: 'TBD', away: 'TBD' });
  return sched;
}

// Default schedule using IPL-balanced 7-wins-per-team (tied — not usable for
// standings-derived tests, but useful for scorecard-only tests).
function buildSchedule() {
  const dist = {};
  IPL_FRANCHISE_CODES.forEach(c => dist[c] = 7);
  return buildScheduleForDist(dist);
}

// ─── Build a fresh resolver module bound to fresh fixtures ───────────────────

function buildResolver(schedule) {
  const liveData = { matches: [] };

  function normalizeMatchString(value) {
    return (value || '').toString().toLowerCase().replace(/[^a-z]/g, '');
  }
  function mapTeamNameToFranchiseCode(name) {
    if (!name) return null;
    const target = normalizeMatchString(name);
    if (!target) return null;
    for (const code of IPL_FRANCHISE_CODES) if (normalizeMatchString(code) === target) return code;
    for (const code of IPL_FRANCHISE_CODES) if (normalizeMatchString(ESPN_TEAM_MAP[code]) === target) return code;
    for (const code of IPL_FRANCHISE_CODES) {
      const full = normalizeMatchString(ESPN_TEAM_MAP[code]);
      if (target.includes(full) || full.includes(target)) return code;
    }
    return null;
  }
  function getMatchWinnerCode(scheduleMatch, liveMatch) {
    if (!scheduleMatch || !liveMatch) return null;
    let result = String(liveMatch.matchResult || '').trim();
    if (!result) return null;
    if (/no result|abandoned|called off|tied|tie\b/i.test(result)) return null;
    result = result.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const patterns = [
      /^(.+?)\s+won\s+by\s+\d+\s+(?:runs?|wickets?|wkts?|wkt)\b/i,
      /^(.+?)\s+beat\s+.+?\s+by\s+\d+\s+(?:runs?|wickets?|wkts?|wkt)\b/i,
      /^(.+?)\s+won\s+the\s+match\b/i,
      /^(.+?)\s+won\b/i,
    ];
    let winnerRaw = null;
    for (const re of patterns) {
      const m = re.exec(result);
      if (m && m[1]) { winnerRaw = m[1].trim(); break; }
    }
    if (!winnerRaw) return null;
    const winnerNorm = normalizeMatchString(winnerRaw);
    if (!winnerNorm) return null;
    const candidates = [scheduleMatch.home, scheduleMatch.away].filter(c => c && c !== 'TBD');
    for (const code of candidates) {
      const full = ESPN_TEAM_MAP[code] || '';
      if (winnerNorm === normalizeMatchString(code) || winnerNorm === normalizeMatchString(full)) return code;
      if (winnerNorm.includes(normalizeMatchString(full)) && full) return code;
      if (winnerNorm.includes(normalizeMatchString(code))) return code;
    }
    return null;
  }
  function populatePlayoffSlotFromLiveTeams(slotKey, liveMatch) {
    if (!liveMatch || !Array.isArray(liveMatch.teams) || liveMatch.teams.length < 2) return false;
    const homeCode = mapTeamNameToFranchiseCode(liveMatch.teams[0]);
    const awayCode = mapTeamNameToFranchiseCode(liveMatch.teams[1]);
    if (!homeCode || !awayCode) return false;
    const slot = _ensurePlayoffSlot(slotKey);
    let changed = false;
    if (slot.home === 'TBD') { slot.home = homeCode; slot.resolved = slot.resolved || 'live-teams'; changed = true; }
    if (slot.away === 'TBD') { slot.away = awayCode; slot.resolved = slot.resolved || 'live-teams'; changed = true; }
    return changed;
  }
  function findLiveMatchForPlayoffSchedule(scheduleMatch) {
    if (!scheduleMatch || !Array.isArray(liveData.matches)) return null;
    const d = (scheduleMatch.date || '').slice(0, 10);
    if (!d) return null;
    return liveData.matches.find(m => m && (m.date || '').slice(0, 10) === d) || null;
  }
  function computeIPLStandings() {
    if (!Array.isArray(liveData.matches)) return null;
    const wins = {};
    IPL_FRANCHISE_CODES.forEach(c => { wins[c] = 0; });
    let doneCount = 0;
    for (let n = 1; n <= 70; n++) {
      const sched = schedule.find(s => s.match === n);
      if (!sched) return null;
      const live = findLiveMatchForPlayoffSchedule(sched);
      if (!live || live.status !== 'done') return null;
      const winner = getMatchWinnerCode(sched, live);
      if (!winner) return null;
      wins[winner] = (wins[winner] || 0) + 1;
      doneCount++;
    }
    if (doneCount < 70) return null;
    const sorted = IPL_FRANCHISE_CODES
      .map(c => ({ code: c, wins: wins[c] }))
      .sort((a, b) => b.wins - a.wins || a.code.localeCompare(b.code));
    if (sorted[3].wins === sorted[4].wins) return null;
    return { ranked: sorted.map(s => s.code), wins };
  }
  function _ensurePlayoffSlot(key) {
    liveData.playoffTeams = liveData.playoffTeams || {};
    liveData.playoffTeams[key] = liveData.playoffTeams[key] || { home: 'TBD', away: 'TBD', resolved: null };
    return liveData.playoffTeams[key];
  }
  function applyPlayoffTeamsToSchedule() {
    const pt = liveData.playoffTeams || {};
    PLAYOFF_MATCH_KEYS.forEach(key => {
      const entry = schedule.find(s => s.match === key);
      const resolved = pt[key];
      if (!entry || !resolved) return;
      if (resolved.home && resolved.home !== 'TBD') entry.home = resolved.home;
      if (resolved.away && resolved.away !== 'TBD') entry.away = resolved.away;
    });
  }
  function resolvePlayoffTeams() {
    if (!Array.isArray(liveData.matches)) return null;
    const standings = computeIPLStandings();
    if (standings) {
      const q1 = _ensurePlayoffSlot('Q1');
      if (q1.home === 'TBD') { q1.home = standings.ranked[0]; q1.resolved = q1.resolved || 'standings'; }
      if (q1.away === 'TBD') { q1.away = standings.ranked[1]; q1.resolved = q1.resolved || 'standings'; }
      const el = _ensurePlayoffSlot('EL');
      if (el.home === 'TBD') { el.home = standings.ranked[2]; el.resolved = el.resolved || 'standings'; }
      if (el.away === 'TBD') { el.away = standings.ranked[3]; el.resolved = el.resolved || 'standings'; }
    }
    const q1Sched = schedule.find(s => s.match === 'Q1');
    const elSched = schedule.find(s => s.match === 'EL');
    const q2Sched = schedule.find(s => s.match === 'Q2');
    const fSched = schedule.find(s => s.match === 'F');

    [['Q1', q1Sched], ['EL', elSched], ['Q2', q2Sched], ['F', fSched]].forEach(([key, sched]) => {
      if (!sched) return;
      const live = findLiveMatchForPlayoffSchedule(sched);
      if (live) populatePlayoffSlotFromLiveTeams(key, live);
    });

    if (q1Sched) {
      const q1Live = findLiveMatchForPlayoffSchedule(q1Sched);
      if (q1Live && q1Live.status === 'done') {
        const overlay = Object.assign({}, q1Sched, liveData.playoffTeams?.Q1 || {});
        const winner = getMatchWinnerCode(overlay, q1Live);
        if (winner) {
          const loser = overlay.home === winner ? overlay.away : (overlay.away === winner ? overlay.home : null);
          if (fSched) { const f = _ensurePlayoffSlot('F'); if (f.home === 'TBD') { f.home = winner; f.resolved = f.resolved || 'bracket'; } }
          if (q2Sched && loser && loser !== 'TBD') { const q2 = _ensurePlayoffSlot('Q2'); if (q2.home === 'TBD') { q2.home = loser; q2.resolved = q2.resolved || 'bracket'; } }
        }
      }
    }
    if (elSched) {
      const elLive = findLiveMatchForPlayoffSchedule(elSched);
      if (elLive && elLive.status === 'done') {
        const overlay = Object.assign({}, elSched, liveData.playoffTeams?.EL || {});
        const winner = getMatchWinnerCode(overlay, elLive);
        if (winner && q2Sched) { const q2 = _ensurePlayoffSlot('Q2'); if (q2.away === 'TBD') { q2.away = winner; q2.resolved = q2.resolved || 'bracket'; } }
      }
    }
    if (q2Sched) {
      const q2Live = findLiveMatchForPlayoffSchedule(q2Sched);
      if (q2Live && q2Live.status === 'done') {
        const overlay = Object.assign({}, q2Sched, liveData.playoffTeams?.Q2 || {});
        const winner = getMatchWinnerCode(overlay, q2Live);
        if (winner && fSched) { const f = _ensurePlayoffSlot('F'); if (f.away === 'TBD') { f.away = winner; f.resolved = f.resolved || 'bracket'; } }
      }
    }
    applyPlayoffTeamsToSchedule();
    return JSON.stringify(liveData.playoffTeams || {});
  }
  function maybeResolvePlayoffFromScorecard(apiId, dateStr, scorecardData) {
    const d = (dateStr || '').slice(0, 10);
    if (!d) return;
    const sched = schedule.find(s => PLAYOFF_MATCH_KEYS.includes(s.match) && s.date === d);
    if (!sched) return;
    const teams = scorecardData && Array.isArray(scorecardData.teams) ? scorecardData.teams : null;
    if (!teams || teams.length !== 2) return;
    const homeCode = mapTeamNameToFranchiseCode(teams[0]);
    const awayCode = mapTeamNameToFranchiseCode(teams[1]);
    if (!homeCode || !awayCode) return;
    const slot = _ensurePlayoffSlot(sched.match);
    if (slot.home === 'TBD') { slot.home = homeCode; slot.resolved = slot.resolved || 'scorecard'; }
    if (slot.away === 'TBD') { slot.away = awayCode; slot.resolved = slot.resolved || 'scorecard'; }
    applyPlayoffTeamsToSchedule();
  }

  return { liveData, resolvePlayoffTeams, maybeResolvePlayoffFromScorecard, computeIPLStandings, getMatchWinnerCode, applyPlayoffTeamsToSchedule, populatePlayoffSlotFromLiveTeams };
}

// Drop 70 league results into liveData. The schedule was built so that each
// match's home team IS the intended winner — we just emit a matching result.
function seedLeagueMatches(liveData, schedule) {
  for (let n = 1; n <= 70; n++) {
    const sched = schedule.find(s => s.match === n);
    if (!sched) continue;
    liveData.matches.push({
      date: sched.date,
      status: 'done',
      matchResult: `${ESPN_TEAM_MAP[sched.home]} won by 5 wickets`,
    });
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('mapTeamNameToFranchiseCode handles full names, codes, and noisy strings', () => {
  const { maybeResolvePlayoffFromScorecard, liveData } = buildResolver(buildSchedule());
  // Force a scorecard call to exercise the map path
  maybeResolvePlayoffFromScorecard(null, '2026-05-26', { teams: ['Mumbai Indians', 'CSK'] });
  assert.equal(liveData.playoffTeams.Q1.home, 'MI');
  assert.equal(liveData.playoffTeams.Q1.away, 'CSK');
  assert.equal(liveData.playoffTeams.Q1.resolved, 'scorecard');
});

test('getMatchWinnerCode parses "X won by N wickets" with full name', () => {
  const { getMatchWinnerCode } = buildResolver(buildSchedule());
  const sched = { home: 'MI', away: 'CSK' };
  const live = { matchResult: 'Mumbai Indians won by 5 wickets' };
  assert.equal(getMatchWinnerCode(sched, live), 'MI');
});

test('getMatchWinnerCode parses "X won by N runs" with code', () => {
  const { getMatchWinnerCode } = buildResolver(buildSchedule());
  const sched = { home: 'CSK', away: 'RCB' };
  const live = { matchResult: 'CSK won by 12 runs' };
  assert.equal(getMatchWinnerCode(sched, live), 'CSK');
});

test('getMatchWinnerCode returns null on tied / no-result strings', () => {
  const { getMatchWinnerCode } = buildResolver(buildSchedule());
  const sched = { home: 'MI', away: 'CSK' };
  assert.equal(getMatchWinnerCode(sched, { matchResult: 'Match tied' }), null);
  assert.equal(getMatchWinnerCode(sched, { matchResult: 'No result' }), null);
  assert.equal(getMatchWinnerCode(sched, { matchResult: '' }), null);
});

test('computeIPLStandings returns null when league incomplete', () => {
  const r = buildResolver(buildSchedule());
  // Only seed 50 done matches
  for (let i = 1; i <= 50; i++) {
    r.liveData.matches.push({ date: `2026-04-${String(i).padStart(2,'0')}`, status: 'done', matchResult: 'Mumbai Indians won by 5 wickets' });
  }
  assert.equal(r.computeIPLStandings(), null);
});

test('computeIPLStandings returns null on tie at 4th/5th boundary', () => {
  // All 10 teams get 7 wins → tied at every boundary
  const schedule = buildSchedule();
  const r = buildResolver(schedule);
  seedLeagueMatches(r.liveData, schedule);
  assert.equal(r.computeIPLStandings(), null);
});

test('computeIPLStandings returns top-4 when clear winners exist', () => {
  const dist = { MI: 12, CSK: 11, RCB: 10, KKR: 9, SRH: 6, RR: 6, GT: 6, PBKS: 4, DC: 3, LSG: 3 };
  const schedule = buildScheduleForDist(dist);
  const r = buildResolver(schedule);
  seedLeagueMatches(r.liveData, schedule);
  const standings = r.computeIPLStandings();
  assert.ok(standings, 'standings should resolve');
  assert.deepEqual(standings.ranked.slice(0, 4), ['MI', 'CSK', 'RCB', 'KKR']);
});

test('resolvePlayoffTeams fills Q1 + EL from standings after league done', () => {
  const dist = { MI: 12, CSK: 11, RCB: 10, KKR: 9, SRH: 6, RR: 6, GT: 6, PBKS: 4, DC: 3, LSG: 3 };
  const schedule = buildScheduleForDist(dist);
  const r = buildResolver(schedule);
  seedLeagueMatches(r.liveData, schedule);
  r.resolvePlayoffTeams();
  assert.deepEqual(r.liveData.playoffTeams.Q1, { home: 'MI', away: 'CSK', resolved: 'standings' });
  assert.deepEqual(r.liveData.playoffTeams.EL, { home: 'RCB', away: 'KKR', resolved: 'standings' });
  assert.equal(schedule.find(s => s.match === 'Q1').home, 'MI');
  assert.equal(schedule.find(s => s.match === 'EL').away, 'KKR');
});

test('bracket advances: Q1 winner → F.home, Q1 loser → Q2.home', () => {
  const dist = { MI: 12, CSK: 11, RCB: 10, KKR: 9, SRH: 6, RR: 6, GT: 6, PBKS: 4, DC: 3, LSG: 3 };
  const schedule = buildScheduleForDist(dist);
  const r = buildResolver(schedule);
  seedLeagueMatches(r.liveData, schedule);
  r.resolvePlayoffTeams();
  r.liveData.matches.push({ date: '2026-05-26', status: 'done', matchResult: 'Mumbai Indians won by 4 wickets' });
  r.resolvePlayoffTeams();
  assert.equal(r.liveData.playoffTeams.F.home, 'MI');
  assert.equal(r.liveData.playoffTeams.Q2.home, 'CSK');
});

test('bracket advances: EL winner → Q2.away', () => {
  const dist = { MI: 12, CSK: 11, RCB: 10, KKR: 9, SRH: 6, RR: 6, GT: 6, PBKS: 4, DC: 3, LSG: 3 };
  const schedule = buildScheduleForDist(dist);
  const r = buildResolver(schedule);
  seedLeagueMatches(r.liveData, schedule);
  r.resolvePlayoffTeams();
  r.liveData.matches.push({ date: '2026-05-27', status: 'done', matchResult: 'Royal Challengers Bengaluru won by 23 runs' });
  r.resolvePlayoffTeams();
  assert.equal(r.liveData.playoffTeams.Q2.away, 'RCB');
});

test('bracket advances: Q2 winner → F.away (full lifecycle)', () => {
  const dist = { MI: 12, CSK: 11, RCB: 10, KKR: 9, SRH: 6, RR: 6, GT: 6, PBKS: 4, DC: 3, LSG: 3 };
  const schedule = buildScheduleForDist(dist);
  const r = buildResolver(schedule);
  seedLeagueMatches(r.liveData, schedule);
  r.resolvePlayoffTeams();
  r.liveData.matches.push({ date: '2026-05-26', status: 'done', matchResult: 'Mumbai Indians won by 4 wickets' });
  r.resolvePlayoffTeams();
  r.liveData.matches.push({ date: '2026-05-27', status: 'done', matchResult: 'Royal Challengers Bengaluru won by 5 wickets' });
  r.resolvePlayoffTeams();
  r.liveData.matches.push({ date: '2026-05-29', status: 'done', matchResult: 'Chennai Super Kings won by 3 wickets' });
  r.resolvePlayoffTeams();
  assert.equal(r.liveData.playoffTeams.F.home, 'MI');
  assert.equal(r.liveData.playoffTeams.F.away, 'CSK');
  assert.equal(schedule.find(s => s.match === 'F').home, 'MI');
  assert.equal(schedule.find(s => s.match === 'F').away, 'CSK');
});

test('scorecard-derived path resolves Q1 before standings complete', () => {
  const schedule = buildSchedule();
  const r = buildResolver(schedule);
  // No league matches done — scorecard sync arrives on Q1 day with teams in payload
  r.maybeResolvePlayoffFromScorecard(null, '2026-05-26', { teams: ['Mumbai Indians', 'Chennai Super Kings'] });
  assert.equal(r.liveData.playoffTeams.Q1.home, 'MI');
  assert.equal(r.liveData.playoffTeams.Q1.away, 'CSK');
  assert.equal(r.liveData.playoffTeams.Q1.resolved, 'scorecard');
  assert.equal(schedule.find(s => s.match === 'Q1').home, 'MI');
});

test('scorecard-derived path resolves Final on Final day even with no bracket info', () => {
  const schedule = buildSchedule();
  const r = buildResolver(schedule);
  r.maybeResolvePlayoffFromScorecard(null, '2026-05-31', { teams: ['Royal Challengers Bengaluru', 'Mumbai Indians'] });
  assert.equal(r.liveData.playoffTeams.F.home, 'RCB');
  assert.equal(r.liveData.playoffTeams.F.away, 'MI');
});

test('already-resolved slot is not overwritten by later resolver call', () => {
  const dist = { RCB: 12, KKR: 11, SRH: 10, RR: 9, GT: 6, PBKS: 6, DC: 6, LSG: 4, MI: 3, CSK: 3 };
  const schedule = buildScheduleForDist(dist);
  const r = buildResolver(schedule);
  // Scorecard fills Q1 first
  r.maybeResolvePlayoffFromScorecard(null, '2026-05-26', { teams: ['MI', 'CSK'] });
  assert.equal(r.liveData.playoffTeams.Q1.resolved, 'scorecard');
  // Then standings complete with different ordering — should NOT overwrite
  seedLeagueMatches(r.liveData, schedule);
  r.resolvePlayoffTeams();
  assert.equal(r.liveData.playoffTeams.Q1.home, 'MI', 'scorecard-set value preserved');
  assert.equal(r.liveData.playoffTeams.Q1.resolved, 'scorecard', 'resolution source preserved');
});

test('idempotency: calling resolvePlayoffTeams multiple times is safe', () => {
  const dist = { MI: 12, CSK: 11, RCB: 10, KKR: 9, SRH: 6, RR: 6, GT: 6, PBKS: 4, DC: 3, LSG: 3 };
  const schedule = buildScheduleForDist(dist);
  const r = buildResolver(schedule);
  seedLeagueMatches(r.liveData, schedule);
  r.resolvePlayoffTeams();
  const snap1 = JSON.stringify(r.liveData.playoffTeams);
  r.resolvePlayoffTeams();
  r.resolvePlayoffTeams();
  const snap2 = JSON.stringify(r.liveData.playoffTeams);
  assert.equal(snap1, snap2);
});

test('scorecard with unrecognized team name is ignored', () => {
  const schedule = buildSchedule();
  const r = buildResolver(schedule);
  r.maybeResolvePlayoffFromScorecard(null, '2026-05-26', { teams: ['Some Random XI', 'Mystery Team'] });
  assert.ok(!r.liveData.playoffTeams || !r.liveData.playoffTeams.Q1 || r.liveData.playoffTeams.Q1.home === 'TBD');
});

test('scorecard with no teams[] array is ignored', () => {
  const schedule = buildSchedule();
  const r = buildResolver(schedule);
  r.maybeResolvePlayoffFromScorecard(null, '2026-05-26', { teams: null });
  r.maybeResolvePlayoffFromScorecard(null, '2026-05-26', {});
  r.maybeResolvePlayoffFromScorecard(null, '2026-05-26', null);
  assert.ok(!r.liveData.playoffTeams);
});

test('scorecard date that does not match any playoff is ignored', () => {
  const schedule = buildSchedule();
  const r = buildResolver(schedule);
  r.maybeResolvePlayoffFromScorecard(null, '2026-04-15', { teams: ['MI', 'CSK'] });
  assert.ok(!r.liveData.playoffTeams);
});

// ─── Robust matchResult parsing ─────────────────────────────────────────────

test('getMatchWinnerCode parses "won by N wkts" (CricBuzz-style)', () => {
  const { getMatchWinnerCode } = buildResolver(buildSchedule());
  const sched = { home: 'MI', away: 'CSK' };
  assert.equal(getMatchWinnerCode(sched, { matchResult: 'Mumbai Indians won by 5 wkts' }), 'MI');
  assert.equal(getMatchWinnerCode(sched, { matchResult: 'CSK won by 1 wkt' }), 'CSK');
});

test('getMatchWinnerCode parses "beat ... by N runs"', () => {
  const { getMatchWinnerCode } = buildResolver(buildSchedule());
  const sched = { home: 'RCB', away: 'KKR' };
  assert.equal(getMatchWinnerCode(sched, { matchResult: 'Royal Challengers Bengaluru beat Kolkata Knight Riders by 12 runs' }), 'RCB');
});

test('getMatchWinnerCode parses trailing parenthetical "(D/L method)"', () => {
  const { getMatchWinnerCode } = buildResolver(buildSchedule());
  const sched = { home: 'MI', away: 'CSK' };
  assert.equal(getMatchWinnerCode(sched, { matchResult: 'Mumbai Indians won by 3 wickets (D/L method)' }), 'MI');
});

test('getMatchWinnerCode parses bare "X won the match" and "X won"', () => {
  const { getMatchWinnerCode } = buildResolver(buildSchedule());
  const sched = { home: 'GT', away: 'PBKS' };
  assert.equal(getMatchWinnerCode(sched, { matchResult: 'Gujarat Titans won the match' }), 'GT');
  assert.equal(getMatchWinnerCode(sched, { matchResult: 'PBKS won' }), 'PBKS');
});

// ─── Live-teams fallback ────────────────────────────────────────────────────

test('populatePlayoffSlotFromLiveTeams fills slot when teams[] present but result unparseable', () => {
  const schedule = buildSchedule();
  const r = buildResolver(schedule);
  // Q2 played, scorecard arrived, but matchResult is garbled
  r.liveData.matches.push({
    date: '2026-05-29',
    status: 'done',
    matchResult: 'Match called off due to weather',
    teams: ['Rajasthan Royals', 'Gujarat Titans'],
  });
  r.resolvePlayoffTeams();
  // Bracket cannot advance (winner unknown), but Q2 slot itself filled
  assert.equal(r.liveData.playoffTeams.Q2.home, 'RR');
  assert.equal(r.liveData.playoffTeams.Q2.away, 'GT');
  assert.equal(r.liveData.playoffTeams.Q2.resolved, 'live-teams');
  // F.away stays TBD because Q2 winner unknown
  assert.ok(!r.liveData.playoffTeams.F || r.liveData.playoffTeams.F.away === 'TBD' || r.liveData.playoffTeams.F.away === undefined);
});

test('populatePlayoffSlotFromLiveTeams ignores match with single team or no teams[]', () => {
  const { populatePlayoffSlotFromLiveTeams, liveData } = buildResolver(buildSchedule());
  assert.equal(populatePlayoffSlotFromLiveTeams('Q1', { teams: ['Mumbai Indians'] }), false);
  assert.equal(populatePlayoffSlotFromLiveTeams('Q1', {}), false);
  assert.equal(populatePlayoffSlotFromLiveTeams('Q1', null), false);
});

// ─── Change detection (used by listener to trigger persistence) ─────────────

test('resolvePlayoffTeams return value reflects state — caller can compare before/after', () => {
  const schedule = buildSchedule();
  const r = buildResolver(schedule);
  const before = JSON.stringify(r.liveData.playoffTeams || {});
  r.liveData.matches.push({ date: '2026-05-26', status: 'done', matchResult: 'Mumbai Indians won by 4 wkts', teams: ['Mumbai Indians', 'Chennai Super Kings'] });
  const after = r.resolvePlayoffTeams();
  assert.notEqual(after, before, 'resolver should report a change after new data arrives');
  // Re-running with no new data → snapshot is identical
  const after2 = r.resolvePlayoffTeams();
  assert.equal(after2, after, 'idempotent re-run returns same snapshot');
});

test('end-to-end: Q1 + EL + Q2 done with mixed result formats → Final fully resolved', () => {
  const schedule = buildSchedule();
  const r = buildResolver(schedule);
  r.liveData.matches.push({ date: '2026-05-26', status: 'done', matchResult: 'Mumbai Indians won by 4 wkts', teams: ['Mumbai Indians', 'Chennai Super Kings'] });
  r.liveData.matches.push({ date: '2026-05-27', status: 'done', matchResult: 'Royal Challengers Bengaluru beat Kolkata Knight Riders by 18 runs', teams: ['Royal Challengers Bengaluru', 'Kolkata Knight Riders'] });
  r.liveData.matches.push({ date: '2026-05-29', status: 'done', matchResult: 'CSK won by 2 wickets (D/L method)', teams: ['Chennai Super Kings', 'Royal Challengers Bengaluru'] });
  r.resolvePlayoffTeams();
  assert.equal(r.liveData.playoffTeams.F.home, 'MI', 'Q1 winner → F.home');
  assert.equal(r.liveData.playoffTeams.F.away, 'CSK', 'Q2 winner → F.away');
  assert.equal(schedule.find(s => s.match === 'F').home, 'MI');
  assert.equal(schedule.find(s => s.match === 'F').away, 'CSK');
});
