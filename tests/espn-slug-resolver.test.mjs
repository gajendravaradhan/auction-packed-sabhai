// ESPN slug-resolution + playoff scorecard-overwrite tests.
//
// Reimplements the production resolveESPNMatchInfo, synthesizePlayoffSlug,
// maybeResolvePlayoffFromScorecard, and setPlayoffTeams logic so each path
// can be exercised in isolation. source-sync.test.mjs guards drift.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const ESPN_TEAM_MAP = {
  SRH: 'Sunrisers Hyderabad', RCB: 'Royal Challengers Bengaluru',
  KKR: 'Kolkata Knight Riders', MI: 'Mumbai Indians',
  CSK: 'Chennai Super Kings', RR: 'Rajasthan Royals',
  GT: 'Gujarat Titans', PBKS: 'Punjab Kings',
  DC: 'Delhi Capitals', LSG: 'Lucknow Super Giants',
};
const IPL_FRANCHISE_CODES = Object.keys(ESPN_TEAM_MAP);
const PLAYOFF_MATCH_KEYS = ['Q1', 'EL', 'Q2', 'F'];

function buildResolver() {
  const liveData = { matches: [], espnMatchSlugMap: {} };
  const schedule = [
    { match: 'Q1', date: '2026-05-26', home: 'RCB', away: 'GT', espn_match_id: 1529314, slug: '' },
    { match: 'EL', date: '2026-05-27', home: 'RR', away: 'SRH', espn_match_id: 1529315, slug: '' },
    { match: 'Q2', date: '2026-05-29', home: 'RR', away: 'GT', espn_match_id: 1529316, slug: '' },
    { match: 'F',  date: '2026-05-31', home: 'TBD', away: 'TBD', espn_match_id: 1529317, slug: '' },
    { match: 5,   date: '2026-04-15', home: 'CSK', away: 'MI', espn_match_id: 1527678, slug: 'csk-vs-mi-5th-match-1527678' },
  ];

  function normalizeMatchString(v) { return (v || '').toString().toLowerCase().replace(/[^a-z]/g, ''); }
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
      if (resolved.manualSlug) entry.slug = resolved.manualSlug;
    });
  }
  function synthesizePlayoffSlug(scheduleMatch) {
    const DESC = { Q1: 'qualifier-1', EL: 'eliminator', Q2: 'qualifier-2', F: 'final' };
    const desc = DESC[scheduleMatch.match];
    if (!desc) return null;
    const liveMatch = Array.isArray(liveData.matches)
      ? liveData.matches.find(m => m && (m.date || '').slice(0, 10) === scheduleMatch.date)
      : null;
    let team1Slug = null, team2Slug = null;
    const toSlug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (liveMatch && Array.isArray(liveMatch.teams) && liveMatch.teams.length === 2) {
      team1Slug = toSlug(liveMatch.teams[0]);
      team2Slug = toSlug(liveMatch.teams[1]);
    } else {
      const homeFull = ESPN_TEAM_MAP[scheduleMatch.home] || '';
      const awayFull = ESPN_TEAM_MAP[scheduleMatch.away] || '';
      if (homeFull && awayFull) { team1Slug = toSlug(homeFull); team2Slug = toSlug(awayFull); }
    }
    if (!team1Slug || !team2Slug) return desc + '-' + scheduleMatch.espn_match_id;
    return team1Slug + '-vs-' + team2Slug + '-' + desc + '-' + scheduleMatch.espn_match_id;
  }
  function resolveESPNMatchInfo(scheduleMatch) {
    if (!scheduleMatch) return { match_id: null, slug: null };
    const key = String(scheduleMatch.match);
    const stored = liveData.espnMatchSlugMap[key];
    if (stored && stored.match_id && stored.slug) return { match_id: stored.match_id, slug: stored.slug };
    const manualSlug = liveData.playoffTeams?.[key]?.manualSlug;
    if (manualSlug && scheduleMatch.espn_match_id) return { match_id: scheduleMatch.espn_match_id, slug: manualSlug };
    let slug = scheduleMatch.slug || null;
    if (!slug && PLAYOFF_MATCH_KEYS.includes(scheduleMatch.match) && scheduleMatch.espn_match_id) {
      slug = synthesizePlayoffSlug(scheduleMatch);
    }
    return { match_id: scheduleMatch.espn_match_id || null, slug: slug || null };
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
    const isManual = slot.resolved === 'manual';
    if (!isManual) {
      if (slot.home !== homeCode) { slot.home = homeCode; slot.resolved = 'scorecard'; }
      if (slot.away !== awayCode) { slot.away = awayCode; slot.resolved = 'scorecard'; }
    } else {
      if (slot.home === 'TBD') slot.home = homeCode;
      if (slot.away === 'TBD') slot.away = awayCode;
    }
    applyPlayoffTeamsToSchedule();
  }
  let _liveLoadedFromFirebase = true;
  function setPlayoffTeams(matchKey, homeCode, awayCode, manualSlug) {
    if (!PLAYOFF_MATCH_KEYS.includes(matchKey)) return false;
    if (!_liveLoadedFromFirebase) return false;
    const slot = _ensurePlayoffSlot(matchKey);
    if (homeCode) slot.home = String(homeCode).toUpperCase();
    if (awayCode) slot.away = String(awayCode).toUpperCase();
    if (manualSlug) slot.manualSlug = String(manualSlug);
    slot.resolved = 'manual';
    applyPlayoffTeamsToSchedule();
    return true;
  }

  return { liveData, schedule, resolveESPNMatchInfo, maybeResolvePlayoffFromScorecard, setPlayoffTeams, synthesizePlayoffSlug, _ensurePlayoffSlot, applyPlayoffTeamsToSchedule };
}

// ─── fetchESPNMatchDetails URL construction ──────────────────────────────────

function buildEspnUrl(matchId, slug, attempt) {
  const baseUrl = 'https://espncricinfo-api.p.rapidapi.com/api/v1/cricketinfo/match-details';
  const useSlug = attempt <= 2 && !!slug;
  return useSlug
    ? `${baseUrl}?series_slug=ipl-2026-1510719&match_id=${matchId}&match_slug=${slug}`
    : `${baseUrl}?series_slug=ipl-2026-1510719&match_id=${matchId}`;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('fetchESPNMatchDetails URL drops match_slug param when slug empty', () => {
  const url = buildEspnUrl('1529317', '', 1);
  assert.ok(!url.includes('match_slug'), 'empty slug must not add match_slug param');
  assert.ok(url.includes('match_id=1529317'));
});

test('fetchESPNMatchDetails URL drops match_slug when slug null', () => {
  const url = buildEspnUrl('1529317', null, 1);
  assert.ok(!url.includes('match_slug'));
});

test('fetchESPNMatchDetails URL keeps match_slug when provided on attempts 1-2', () => {
  const url1 = buildEspnUrl('1529317', 'mi-vs-csk-final-1529317', 1);
  const url2 = buildEspnUrl('1529317', 'mi-vs-csk-final-1529317', 2);
  assert.ok(url1.includes('match_slug=mi-vs-csk-final-1529317'));
  assert.ok(url2.includes('match_slug=mi-vs-csk-final-1529317'));
});

test('fetchESPNMatchDetails URL drops slug on attempt 3 (existing fallback preserved)', () => {
  const url = buildEspnUrl('1529317', 'mi-vs-csk-final-1529317', 3);
  assert.ok(!url.includes('match_slug'));
});

test('resolveESPNMatchInfo: playoff with empty hardcoded slug synthesizes a slug', () => {
  const r = buildResolver();
  const sched = r.schedule.find(s => s.match === 'F');
  const info = r.resolveESPNMatchInfo(sched);
  assert.equal(info.match_id, 1529317);
  assert.ok(info.slug, 'synth slug must be non-null so gate passes');
  // No live match yet → fallback to schedule home/away which are TBD → no team prefix
  assert.match(info.slug, /final-1529317/);
});

test('resolveESPNMatchInfo: synth slug uses real teams from live match when available', () => {
  const r = buildResolver();
  r.liveData.matches.push({ date: '2026-05-31', teams: ['Mumbai Indians', 'Chennai Super Kings'] });
  const sched = r.schedule.find(s => s.match === 'F');
  const info = r.resolveESPNMatchInfo(sched);
  assert.equal(info.slug, 'mumbai-indians-vs-chennai-super-kings-final-1529317');
});

test('resolveESPNMatchInfo: synth slug falls back to schedule home/away codes when no live match', () => {
  const r = buildResolver();
  const sched = r.schedule.find(s => s.match === 'Q1'); // home: RCB, away: GT (non-TBD predictions)
  const info = r.resolveESPNMatchInfo(sched);
  assert.equal(info.slug, 'royal-challengers-bengaluru-vs-gujarat-titans-qualifier-1-1529314');
});

test('resolveESPNMatchInfo: manual playoffTeams[key].manualSlug wins over synthesis', () => {
  const r = buildResolver();
  r.setPlayoffTeams('F', 'MI', 'CSK', 'custom-manual-slug-1529317');
  const sched = r.schedule.find(s => s.match === 'F');
  const info = r.resolveESPNMatchInfo(sched);
  assert.equal(info.slug, 'custom-manual-slug-1529317');
});

test('resolveESPNMatchInfo: espnMatchSlugMap entry wins over everything', () => {
  const r = buildResolver();
  r.liveData.espnMatchSlugMap['F'] = { match_id: 1529317, slug: 'from-live-scores-1529317' };
  r.setPlayoffTeams('F', 'MI', 'CSK', 'manual-1529317');
  const sched = r.schedule.find(s => s.match === 'F');
  const info = r.resolveESPNMatchInfo(sched);
  assert.equal(info.slug, 'from-live-scores-1529317');
});

test('resolveESPNMatchInfo: league entry with hardcoded slug returns it unchanged', () => {
  const r = buildResolver();
  const sched = r.schedule.find(s => s.match === 5);
  const info = r.resolveESPNMatchInfo(sched);
  assert.equal(info.slug, 'csk-vs-mi-5th-match-1527678');
});

test('synthesizePlayoffSlug: descriptors match the 4 playoff keys', () => {
  const r = buildResolver();
  r.liveData.matches.push({ date: '2026-05-26', teams: ['Mumbai Indians', 'Chennai Super Kings'] });
  r.liveData.matches.push({ date: '2026-05-27', teams: ['Royal Challengers Bengaluru', 'Kolkata Knight Riders'] });
  r.liveData.matches.push({ date: '2026-05-29', teams: ['Chennai Super Kings', 'Royal Challengers Bengaluru'] });
  r.liveData.matches.push({ date: '2026-05-31', teams: ['Mumbai Indians', 'Chennai Super Kings'] });
  assert.match(r.synthesizePlayoffSlug(r.schedule.find(s => s.match === 'Q1')), /qualifier-1-1529314$/);
  assert.match(r.synthesizePlayoffSlug(r.schedule.find(s => s.match === 'EL')), /eliminator-1529315$/);
  assert.match(r.synthesizePlayoffSlug(r.schedule.find(s => s.match === 'Q2')), /qualifier-2-1529316$/);
  assert.match(r.synthesizePlayoffSlug(r.schedule.find(s => s.match === 'F')),  /final-1529317$/);
});

// ─── Scorecard-overwrite of stale predictions ────────────────────────────────

test('maybeResolvePlayoffFromScorecard overwrites stale prediction with API teams', () => {
  const r = buildResolver();
  // Initial prediction: Q1 = RCB vs GT. Real Q1 = MI vs CSK.
  r._ensurePlayoffSlot('Q1');
  r.liveData.playoffTeams.Q1.home = 'RCB';
  r.liveData.playoffTeams.Q1.away = 'GT';
  r.liveData.playoffTeams.Q1.resolved = 'standings';
  // Scorecard arrives with real teams
  r.maybeResolvePlayoffFromScorecard('1529314', '2026-05-26', { teams: ['Mumbai Indians', 'Chennai Super Kings'] });
  assert.equal(r.liveData.playoffTeams.Q1.home, 'MI', 'stale prediction must be overwritten');
  assert.equal(r.liveData.playoffTeams.Q1.away, 'CSK');
  assert.equal(r.liveData.playoffTeams.Q1.resolved, 'scorecard');
  // Schedule entry also updated
  assert.equal(r.schedule.find(s => s.match === 'Q1').home, 'MI');
});

test('maybeResolvePlayoffFromScorecard preserves manual admin entry', () => {
  const r = buildResolver();
  r.setPlayoffTeams('Q1', 'RR', 'PBKS');
  r.maybeResolvePlayoffFromScorecard('1529314', '2026-05-26', { teams: ['Mumbai Indians', 'Chennai Super Kings'] });
  assert.equal(r.liveData.playoffTeams.Q1.home, 'RR', 'manual entry must be preserved');
  assert.equal(r.liveData.playoffTeams.Q1.away, 'PBKS');
  assert.equal(r.liveData.playoffTeams.Q1.resolved, 'manual');
});

test('maybeResolvePlayoffFromScorecard fills only TBD when manual slot exists', () => {
  const r = buildResolver();
  // Manual sets only home; away stays TBD
  const slot = r._ensurePlayoffSlot('Q1');
  slot.home = 'MI'; slot.away = 'TBD'; slot.resolved = 'manual';
  r.maybeResolvePlayoffFromScorecard('1529314', '2026-05-26', { teams: ['Mumbai Indians', 'Chennai Super Kings'] });
  assert.equal(r.liveData.playoffTeams.Q1.home, 'MI', 'manual home preserved');
  assert.equal(r.liveData.playoffTeams.Q1.away, 'CSK', 'TBD away filled');
});

test('maybeResolvePlayoffFromScorecard is idempotent when teams already match', () => {
  const r = buildResolver();
  r.maybeResolvePlayoffFromScorecard('1529314', '2026-05-26', { teams: ['Mumbai Indians', 'Chennai Super Kings'] });
  const before = JSON.stringify(r.liveData.playoffTeams.Q1);
  r.maybeResolvePlayoffFromScorecard('1529314', '2026-05-26', { teams: ['Mumbai Indians', 'Chennai Super Kings'] });
  assert.equal(JSON.stringify(r.liveData.playoffTeams.Q1), before);
});

// ─── Manual override via setPlayoffTeams ─────────────────────────────────────

test('setPlayoffTeams accepts MI/CSK and writes resolved=manual', () => {
  const r = buildResolver();
  assert.equal(r.setPlayoffTeams('F', 'MI', 'CSK'), true);
  assert.equal(r.liveData.playoffTeams.F.home, 'MI');
  assert.equal(r.liveData.playoffTeams.F.away, 'CSK');
  assert.equal(r.liveData.playoffTeams.F.resolved, 'manual');
  assert.equal(r.schedule.find(s => s.match === 'F').home, 'MI');
});

test('setPlayoffTeams rejects invalid match key', () => {
  const r = buildResolver();
  assert.equal(r.setPlayoffTeams('XX', 'MI', 'CSK'), false);
});

test('setPlayoffTeams stores manualSlug and applies to schedule entry', () => {
  const r = buildResolver();
  r.setPlayoffTeams('F', 'MI', 'CSK', 'mi-vs-csk-final-1529317');
  assert.equal(r.liveData.playoffTeams.F.manualSlug, 'mi-vs-csk-final-1529317');
  assert.equal(r.schedule.find(s => s.match === 'F').slug, 'mi-vs-csk-final-1529317');
});

test('setPlayoffTeams uppercases lowercase franchise codes', () => {
  const r = buildResolver();
  r.setPlayoffTeams('F', 'mi', 'csk');
  assert.equal(r.liveData.playoffTeams.F.home, 'MI');
  assert.equal(r.liveData.playoffTeams.F.away, 'CSK');
});
