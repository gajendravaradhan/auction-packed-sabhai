// Autosync UI-state + write-guard tests.
//
// We reimplement the production functions inside a stubbed DOM so we can drive
// every branch deterministically. The reimplementations track the source in
// index.html exactly — a separate source-sync test asserts the canonical copies
// stay in sync, and these behavioral tests cover the guard logic.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ─── Stub DOM ────────────────────────────────────────────────────────────────

function makeStubDom() {
  const elements = new Map();
  const make = (id, opts = {}) => {
    const classes = new Set(opts.classes || []);
    const el = {
      id,
      style: { display: opts.display ?? '' },
      classList: {
        contains: c => classes.has(c),
        add: c => classes.add(c),
        remove: c => classes.delete(c),
      },
      previousElementSibling: opts.previousElementSibling || null,
      querySelector: () => null,
    };
    elements.set(id, el);
    return el;
  };

  const document = {
    getElementById: id => elements.get(id) || null,
    querySelectorAll: selector => {
      const out = [];
      const prefixes = selector
        .split(',')
        .map(s => s.trim())
        .map(s => /\[id\^="([^"]+)"\]/.exec(s)?.[1])
        .filter(Boolean);
      for (const [id, el] of elements) {
        if (prefixes.some(p => id.startsWith(p))) out.push(el);
      }
      return out;
    },
  };

  return { document, make, elements };
}

// ─── Reimplementations (verbatim logic from index.html) ──────────────────────

function buildModule(env) {
  const { document } = env;
  let _currentPlayerModalName = null;
  let _liveLoadedFromFirebase = false;
  let liveData = { matches: [] };
  const calls = { update: [], openPlayerModal: [] };

  const _db = {
    ref: path => ({
      update: payload => {
        calls.update.push({ path, payload });
        return { then: cb => { cb && cb(); return { catch: () => {} }; } };
      },
      set: payload => {
        calls.update.push({ path, payload, op: 'set' });
        return { then: cb => { cb && cb(); return { catch: () => {} }; } };
      },
    }),
  };

  function snapshotUiState() {
    const openRosters = [];
    document.querySelectorAll('[id^="lb-roster-"], [id^="live-roster-"], [id^="admin-match-body-"]').forEach(el => {
      if (el && el.style && el.style.display !== 'none') openRosters.push(el.id);
    });
    const playerModalEl = document.getElementById('playerModal');
    const playerModalOpen = !!(playerModalEl && playerModalEl.classList && playerModalEl.classList.contains('open'));
    return {
      openRosters,
      playerModalOpen,
      playerModalName: playerModalOpen ? _currentPlayerModalName : null,
      scrollY: 0,
    };
  }

  function restoreUiState(snap) {
    if (!snap) return;
    (snap.openRosters || []).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.display = 'block';
    });
    if (snap.playerModalOpen && snap.playerModalName) {
      openPlayerModal(snap.playerModalName);
    }
  }

  function openPlayerModal(playerName) {
    const modal = document.getElementById('playerModal');
    if (!modal) return;
    _currentPlayerModalName = playerName;
    modal.classList.add('open');
    calls.openPlayerModal.push(playerName);
  }

  function closePlayerModal() {
    const modal = document.getElementById('playerModal');
    if (!modal) return;
    modal.classList.remove('open');
    _currentPlayerModalName = null;
  }

  function saveLiveData() {
    if (!_db) return { blocked: 'no-db' };
    if (!_liveLoadedFromFirebase) return { blocked: 'not-hydrated' };
    if (!Array.isArray(liveData.matches) || liveData.matches.length === 0) {
      return { blocked: 'empty-matches' };
    }
    const payload = Object.assign({}, liveData);
    delete payload.captains;
    _db.ref('live').update(payload);
    return { ok: true };
  }

  return {
    snapshotUiState,
    restoreUiState,
    openPlayerModal,
    closePlayerModal,
    saveLiveData,
    state: {
      get liveData() { return liveData; },
      set liveData(v) { liveData = v; },
      get _liveLoadedFromFirebase() { return _liveLoadedFromFirebase; },
      set _liveLoadedFromFirebase(v) { _liveLoadedFromFirebase = v; },
      get _currentPlayerModalName() { return _currentPlayerModalName; },
    },
    calls,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('saveLiveData blocks before Firebase snapshot loads (cold load)', () => {
  const env = makeStubDom();
  const m = buildModule(env);
  m.state.liveData = { matches: [{ label: 'test' }] };
  m.state._liveLoadedFromFirebase = false;
  const result = m.saveLiveData();
  assert.equal(result.blocked, 'not-hydrated');
  assert.equal(m.calls.update.length, 0, 'no Firebase write happened');
});

test('saveLiveData blocks when in-memory matches is empty', () => {
  const env = makeStubDom();
  const m = buildModule(env);
  m.state._liveLoadedFromFirebase = true;
  m.state.liveData = { matches: [] };
  const result = m.saveLiveData();
  assert.equal(result.blocked, 'empty-matches');
  assert.equal(m.calls.update.length, 0);
});

test('saveLiveData blocks when matches is not an array', () => {
  const env = makeStubDom();
  const m = buildModule(env);
  m.state._liveLoadedFromFirebase = true;
  m.state.liveData = { matches: null };
  const result = m.saveLiveData();
  assert.equal(result.blocked, 'empty-matches');
});

test('saveLiveData writes to live path with captains stripped', () => {
  const env = makeStubDom();
  const m = buildModule(env);
  m.state._liveLoadedFromFirebase = true;
  m.state.liveData = {
    matches: [{ label: 'CSK vs MI' }],
    captains: { CSK: { captain: 'x', viceCaptain: 'y' } },
  };
  const result = m.saveLiveData();
  assert.equal(result.ok, true);
  assert.equal(m.calls.update.length, 1);
  assert.equal(m.calls.update[0].path, 'live');
  assert.ok(!('captains' in m.calls.update[0].payload), 'captains stripped from payload');
  assert.deepEqual(m.calls.update[0].payload.matches, [{ label: 'CSK vs MI' }]);
});

test('snapshotUiState captures open accordions across all tab variants', () => {
  const env = makeStubDom();
  const m = buildModule(env);
  env.make('lb-roster-0', { display: 'block' });
  env.make('lb-roster-1', { display: 'none' });
  env.make('live-roster-3', { display: 'block' });
  env.make('admin-match-body-5', { display: 'block' });
  env.make('admin-match-body-6', { display: 'none' });
  env.make('playerModal', { classes: [] });
  const snap = m.snapshotUiState();
  assert.deepEqual(snap.openRosters.sort(), [
    'admin-match-body-5',
    'lb-roster-0',
    'live-roster-3',
  ]);
  assert.equal(snap.playerModalOpen, false);
  assert.equal(snap.playerModalName, null);
});

test('snapshotUiState captures open player modal with current player name', () => {
  const env = makeStubDom();
  const m = buildModule(env);
  env.make('playerModal', { classes: ['open'] });
  m.openPlayerModal('V Kohli');
  const snap = m.snapshotUiState();
  assert.equal(snap.playerModalOpen, true);
  assert.equal(snap.playerModalName, 'V Kohli');
});

test('restoreUiState reopens accordions after a simulated render wipes display state', () => {
  const env = makeStubDom();
  const m = buildModule(env);
  env.make('lb-roster-0', { display: 'block' });
  env.make('lb-roster-2', { display: 'block' });
  env.make('playerModal', { classes: [] });
  const snap = m.snapshotUiState();
  // Simulate renderTab — set every accordion back to display:none
  env.elements.get('lb-roster-0').style.display = 'none';
  env.elements.get('lb-roster-2').style.display = 'none';
  m.restoreUiState(snap);
  assert.equal(env.elements.get('lb-roster-0').style.display, 'block');
  assert.equal(env.elements.get('lb-roster-2').style.display, 'block');
});

test('restoreUiState reopens player modal with same player after sync', () => {
  const env = makeStubDom();
  const m = buildModule(env);
  env.make('playerModal', { classes: ['open'] });
  m.openPlayerModal('JJ Bumrah');
  const snap = m.snapshotUiState();
  // Simulate render churn — modal class removed
  env.elements.get('playerModal').classList.remove('open');
  m.calls.openPlayerModal.length = 0;
  m.restoreUiState(snap);
  assert.equal(m.calls.openPlayerModal[0], 'JJ Bumrah', 'modal reopened with same player');
  assert.equal(env.elements.get('playerModal').classList.contains('open'), true);
});

test('closePlayerModal clears tracked player name so snapshot does not falsely reopen', () => {
  const env = makeStubDom();
  const m = buildModule(env);
  env.make('playerModal', { classes: [] });
  m.openPlayerModal('Hardik Pandya');
  m.closePlayerModal();
  assert.equal(m.state._currentPlayerModalName, null);
  const snap = m.snapshotUiState();
  assert.equal(snap.playerModalOpen, false);
  assert.equal(snap.playerModalName, null);
});

test('snapshot + restore round-trip preserves open state through n sync cycles', () => {
  const env = makeStubDom();
  const m = buildModule(env);
  env.make('lb-roster-4', { display: 'block' });
  env.make('playerModal', { classes: ['open'] });
  m.openPlayerModal('R Sharma');
  for (let i = 0; i < 5; i++) {
    const snap = m.snapshotUiState();
    // simulate render
    env.elements.get('lb-roster-4').style.display = 'none';
    env.elements.get('playerModal').classList.remove('open');
    m.restoreUiState(snap);
    assert.equal(env.elements.get('lb-roster-4').style.display, 'block', `cycle ${i}: accordion stayed open`);
    assert.equal(env.elements.get('playerModal').classList.contains('open'), true, `cycle ${i}: modal stayed open`);
  }
});
