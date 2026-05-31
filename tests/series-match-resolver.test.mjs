// Series-match → schedule-match resolver tests.
//
// Reimplements findSeriesMatchForScheduleMatch with the same logic as
// index.html so the 3 resolution paths (team-name, playoff-descriptor,
// date-only-single) can be exercised in isolation.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const ESPN_TEAM_MAP = {
  SRH: 'Sunrisers Hyderabad', RCB: 'Royal Challengers Bengaluru',
  KKR: 'Kolkata Knight Riders', MI: 'Mumbai Indians',
  CSK: 'Chennai Super Kings', RR: 'Rajasthan Royals',
  GT: 'Gujarat Titans', PBKS: 'Punjab Kings',
  DC: 'Delhi Capitals', LSG: 'Lucknow Super Giants',
};

function normalizeMatchString(v) { return (v || '').toString().toLowerCase().replace(/[^a-z]/g, ''); }

function matchScheduleTeams(scheduleMatch, label) {
  const n = normalizeMatchString(label);
  const home = scheduleMatch.home, away = scheduleMatch.away;
  const homeName = ESPN_TEAM_MAP[home] || '';
  const awayName = ESPN_TEAM_MAP[away] || '';
  return (n.includes(normalizeMatchString(home)) || n.includes(normalizeMatchString(homeName)))
    && (n.includes(normalizeMatchString(away)) || n.includes(normalizeMatchString(awayName)));
}

function findSeriesMatchForScheduleMatch(scheduleMatch, seriesMatches) {
  if (!scheduleMatch || !Array.isArray(seriesMatches) || seriesMatches.length === 0) return null;
  const targetDate = (scheduleMatch.date || '').toString().slice(0, 10);

  const byTeams = seriesMatches.find(m => {
    if (!m || !m.id) return false;
    const matchDate = (m.date || '').toString().slice(0, 10);
    if (targetDate && matchDate !== targetDate) return false;
    return matchScheduleTeams(scheduleMatch, m.name || '');
  });
  if (byTeams) return byTeams;

  const PLAYOFF_DESC_RE = {
    Q1: /\bqualifier\s*1\b|\b1st\s+qualifier\b/i,
    EL: /\beliminator\b/i,
    Q2: /\bqualifier\s*2\b|\b2nd\s+qualifier\b/i,
    F:  /\bfinal\b/i,
  };
  if (PLAYOFF_DESC_RE[scheduleMatch.match]) {
    const re = PLAYOFF_DESC_RE[scheduleMatch.match];
    const byDesc = seriesMatches.find(m => {
      if (!m || !m.id) return false;
      const matchDate = (m.date || '').toString().slice(0, 10);
      if (targetDate && matchDate !== targetDate) return false;
      return re.test(String(m.name || ''));
    });
    if (byDesc) return byDesc;
  }

  if (targetDate) {
    const sameDate = seriesMatches.filter(m => m && m.id && (m.date || '').toString().slice(0, 10) === targetDate);
    if (sameDate.length === 1) return sameDate[0];
  }

  return null;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('Path 1: team-name match resolves league entry from CricBuzz-style name', () => {
  const sched = { match: 5, date: '2026-04-15', home: 'CSK', away: 'MI' };
  const series = [
    { id: '9001', date: '2026-04-15', name: 'CSK vs MI, 5th match' },
    { id: '9002', date: '2026-04-16', name: 'RCB vs KKR, 6th match' },
  ];
  assert.equal(findSeriesMatchForScheduleMatch(sched, series).id, '9001');
});

test('Path 1: team-name match resolves with full names too', () => {
  const sched = { match: 5, date: '2026-04-15', home: 'CSK', away: 'MI' };
  const series = [{ id: '9001', date: '2026-04-15', name: 'Chennai Super Kings vs Mumbai Indians' }];
  assert.equal(findSeriesMatchForScheduleMatch(sched, series).id, '9001');
});

test('Path 2: playoff descriptor matches Q1 even when schedule home/away are TBD', () => {
  const sched = { match: 'Q1', date: '2026-05-26', home: 'TBD', away: 'TBD' };
  const series = [
    { id: '8001', date: '2026-05-26', name: 'MI vs CSK, Qualifier 1' },
    { id: '8002', date: '2026-05-27', name: 'RCB vs KKR, Eliminator' },
  ];
  assert.equal(findSeriesMatchForScheduleMatch(sched, series).id, '8001');
});

test('Path 2: EL/Q2/F descriptors match correctly', () => {
  const sched_EL = { match: 'EL', date: '2026-05-27', home: 'TBD', away: 'TBD' };
  const sched_Q2 = { match: 'Q2', date: '2026-05-29', home: 'TBD', away: 'TBD' };
  const sched_F  = { match: 'F',  date: '2026-05-31', home: 'TBD', away: 'TBD' };
  const series = [
    { id: 'A', date: '2026-05-27', name: 'RCB vs KKR, Eliminator' },
    { id: 'B', date: '2026-05-29', name: 'CSK vs RCB, Qualifier 2' },
    { id: 'C', date: '2026-05-31', name: 'MI vs CSK, Final' },
  ];
  assert.equal(findSeriesMatchForScheduleMatch(sched_EL, series).id, 'A');
  assert.equal(findSeriesMatchForScheduleMatch(sched_Q2, series).id, 'B');
  assert.equal(findSeriesMatchForScheduleMatch(sched_F,  series).id, 'C');
});

test('Path 2: alternative descriptor format "1st Qualifier" / "2nd Qualifier" matches', () => {
  const sched_Q1 = { match: 'Q1', date: '2026-05-26', home: 'TBD', away: 'TBD' };
  const sched_Q2 = { match: 'Q2', date: '2026-05-29', home: 'TBD', away: 'TBD' };
  const series = [
    { id: 'A', date: '2026-05-26', name: '1st Qualifier - MI vs CSK' },
    { id: 'B', date: '2026-05-29', name: '2nd Qualifier - CSK vs RCB' },
  ];
  assert.equal(findSeriesMatchForScheduleMatch(sched_Q1, series).id, 'A');
  assert.equal(findSeriesMatchForScheduleMatch(sched_Q2, series).id, 'B');
});

test('Path 2: descriptor match correctly disambiguates between Q1 and Q2 on different dates', () => {
  const sched_Q1 = { match: 'Q1', date: '2026-05-26', home: 'TBD', away: 'TBD' };
  const sched_Q2 = { match: 'Q2', date: '2026-05-29', home: 'TBD', away: 'TBD' };
  const series = [
    { id: 'A', date: '2026-05-26', name: 'MI vs CSK, Qualifier 1' },
    { id: 'B', date: '2026-05-29', name: 'CSK vs RCB, Qualifier 2' },
  ];
  // Q1 must match A (not B) because /qualifier\s*1\b/ does NOT match "Qualifier 2"
  assert.equal(findSeriesMatchForScheduleMatch(sched_Q1, series).id, 'A');
  assert.equal(findSeriesMatchForScheduleMatch(sched_Q2, series).id, 'B');
});

test('Path 3: date-only single-match fallback works when team name unrecognized', () => {
  const sched = { match: 10, date: '2026-04-20', home: 'GT', away: 'PBKS' };
  // API stripped/renamed teams — only descriptive name; only one series entry on that date
  const series = [
    { id: 'X', date: '2026-04-20', name: 'Match abandoned due to rain' },
    { id: 'Y', date: '2026-04-21', name: 'CSK vs MI' },
  ];
  assert.equal(findSeriesMatchForScheduleMatch(sched, series).id, 'X');
});

test('Path 3 does NOT fire when multiple matches share the date (double-header)', () => {
  // Use real codes but labels that don't contain either team name OR a
  // playoff descriptor — so Path 1 and Path 2 both miss, and Path 3 is
  // forced to abstain because two candidates share the date.
  const sched = { match: 10, date: '2026-04-20', home: 'GT', away: 'PBKS' };
  const series = [
    { id: 'A', date: '2026-04-20', name: 'opaque-label-1' },
    { id: 'B', date: '2026-04-20', name: 'opaque-label-2' },
  ];
  assert.equal(findSeriesMatchForScheduleMatch(sched, series), null);
});

test('Returns null when no path matches (empty list)', () => {
  const sched = { match: 'Q1', date: '2026-05-26', home: 'TBD', away: 'TBD' };
  assert.equal(findSeriesMatchForScheduleMatch(sched, []), null);
});

test('Returns null when series matches exist but none for the target date', () => {
  const sched = { match: 5, date: '2026-04-15', home: 'CSK', away: 'MI' };
  const series = [{ id: '1', date: '2026-04-16', name: 'CSK vs MI' }];
  assert.equal(findSeriesMatchForScheduleMatch(sched, series), null);
});

test('End-to-end: 74 schedule entries all resolve when series has full season', () => {
  // Build a realistic 70-league + 4-playoff series list
  const series = [];
  for (let n = 1; n <= 70; n++) {
    series.push({ id: String(1000 + n), date: `2026-04-${String(n).padStart(2, '0')}`, name: `CSK vs MI, ${n}th match` });
  }
  series.push({ id: '9990', date: '2026-05-26', name: 'CSK vs MI, Qualifier 1' });
  series.push({ id: '9991', date: '2026-05-27', name: 'RCB vs KKR, Eliminator' });
  series.push({ id: '9992', date: '2026-05-29', name: 'CSK vs RCB, Qualifier 2' });
  series.push({ id: '9993', date: '2026-05-31', name: 'MI vs CSK, Final' });

  const schedule = [];
  for (let n = 1; n <= 70; n++) {
    schedule.push({ match: n, date: `2026-04-${String(n).padStart(2, '0')}`, home: 'CSK', away: 'MI' });
  }
  schedule.push({ match: 'Q1', date: '2026-05-26', home: 'TBD', away: 'TBD' });
  schedule.push({ match: 'EL', date: '2026-05-27', home: 'TBD', away: 'TBD' });
  schedule.push({ match: 'Q2', date: '2026-05-29', home: 'TBD', away: 'TBD' });
  schedule.push({ match: 'F',  date: '2026-05-31', home: 'TBD', away: 'TBD' });

  const unresolved = schedule.filter(s => !findSeriesMatchForScheduleMatch(s, series));
  assert.deepEqual(unresolved, [], 'every schedule entry should resolve');
});
