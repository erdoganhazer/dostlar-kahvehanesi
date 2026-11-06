// Teksas Poker (Texas Hold'em), 2-4 kişi, çiple. Kurallar: docs/POKER-KURALLARI.md
// Hamleler: { t:'fold' }, { t:'check' }, { t:'call' }, { t:'raise', to: bu turdaki toplam bahis }
import { makeRng } from '../core/rng.js';

export const SUITS = ['S', 'H', 'D', 'C'];
export const START_CHIPS = 1000;
export const HANDS = 12;
export const HAND_NAMES = ['Yüksek kart', 'Bir çift', 'İki çift', 'Üçlü', 'Seri', 'Renk', 'Full', 'Dörtlü', 'Düz renk'];
export const rankOf = (c) => +c.slice(1);
export const suitOf = (c) => c[0];
const ALL = [];
for (const s of SUITS) for (let r = 2; r <= 14; r++) ALL.push(s + r);

// ---- El değerlendirme ------------------------------------------------------------------------

function eval5(cs) {
  const r = cs.map(rankOf).sort((a, b) => b - a);
  const flush = cs.every((c) => suitOf(c) === suitOf(cs[0]));
  const cnt = new Map();
  for (const x of r) cnt.set(x, (cnt.get(x) || 0) + 1);
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const uniq = [...new Set(r)];
  let high = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) high = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) high = 5; // A-2-3-4-5
  }
  let cat;
  let ks;
  if (high && flush) [cat, ks] = [8, [high]];
  else if (groups[0][1] === 4) [cat, ks] = [7, [groups[0][0], groups[1][0]]];
  else if (groups[0][1] === 3 && groups[1][1] === 2) [cat, ks] = [6, [groups[0][0], groups[1][0]]];
  else if (flush) [cat, ks] = [5, r];
  else if (high) [cat, ks] = [4, [high]];
  else if (groups[0][1] === 3) [cat, ks] = [3, groups.map((g) => g[0])];
  else if (groups[0][1] === 2 && groups[1][1] === 2) [cat, ks] = [2, groups.map((g) => g[0])];
  else if (groups[0][1] === 2) [cat, ks] = [1, groups.map((g) => g[0])];
  else [cat, ks] = [0, r];
  let v = cat;
  for (let i = 0; i < 5; i++) v = v * 15 + (ks[i] || 0);
  return v;
}

/** 5-7 karttan en iyi 5'li. Dönen sayı büyüdükçe el güçlüdür. */
export function bestScore(cards) {
  if (cards.length === 5) return eval5(cards);
  let best = -1;
  const n = cards.length;
  for (let a = 0; a < n - 4; a++) for (let b = a + 1; b < n - 3; b++) for (let c = b + 1; c < n - 2; c++) for (let d = c + 1; d < n - 1; d++) for (let e = d + 1; e < n; e++) {
    const v = eval5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
    if (v > best) best = v;
  }
  return best;
}
export const handName = (score) => HAND_NAMES[Math.floor(score / 15 ** 5)];

// ---- Durum -----------------------------------------------------------------------------------

const blindsFor = (handNo) => {
  const sb = 10 * 2 ** Math.floor(handNo / 4);
  return [sb, sb * 2];
};

function nextLive(chips, from, n) {
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (chips[i] > 0) return i;
  }
  return -1;
}

function startHand(s, handNo, prevDealer) {
  const n = s.n;
  const live = s.chips.map((c) => c > 0);
  if (live.filter(Boolean).length < 2) return { ...s, phase: 'over' };
  const dealer = handNo === 0 ? 0 : nextLive(s.chips, prevDealer, n);
  const deck = makeRng((s.seed + handNo * 7919) >>> 0).shuffle([...ALL]);
  const [sb, bb] = blindsFor(handNo);
  const liveCount = live.filter(Boolean).length;
  const sbSeat = liveCount === 2 ? dealer : nextLive(s.chips, dealer, n);
  const bbSeat = nextLive(s.chips, sbSeat, n);
  const chips = [...s.chips];
  const bets = Array(n).fill(0);
  const allin = Array(n).fill(false);
  const post = (i, amt) => {
    const a = Math.min(chips[i], amt);
    chips[i] -= a;
    bets[i] += a;
    if (chips[i] === 0) allin[i] = true;
  };
  post(sbSeat, sb);
  post(bbSeat, bb);
  const total = [...bets];
  // iki kart: sb'den başlayarak sırayla
  const hole = Array.from({ length: n }, () => []);
  let pos = 0;
  const order = [];
  for (let k = 0, i = sbSeat; k < liveCount; k++, i = nextLive(s.chips, i, n)) order.push(i);
  for (let r = 0; r < 2; r++) for (const i of order) hole[i].push(deck[pos++]);
  const st = {
    ...s, handNo, dealer, sbSeat, bbSeat, deck, pos, hole, board: [], chips, bets, total, allin, sb, bb,
    folded: live.map((l) => !l), acted: Array(n).fill(false), cur: Math.max(...bets), minRaise: bb, raises: 0, street: 'preflop', phase: 'bet', handEnd: null, order,
  };
  const first = liveCount === 2 ? dealer : nextLive(s.chips, bbSeat, n);
  return { ...st, turn: nextActor(st, (first + n - 1) % n) };
}

function nextActor(s, from) {
  for (let k = 1; k <= s.n; k++) {
    const i = (from + k) % s.n;
    if (!s.folded[i] && !s.allin[i] && (!s.acted[i] || s.bets[i] < s.cur)) return i;
  }
  return -1;
}

const nonFolded = (s) => s.folded.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);

function finishHand(s, chips, folded, board, show) {
  const n = s.n;
  const contenders = folded.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);
  const levels = [...new Set(s.total.filter((t) => t > 0))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  const scoreOf = {};
  if (show) for (const i of contenders) scoreOf[i] = bestScore([...s.hole[i], ...board]);
  for (const L of levels) {
    let amount = 0;
    for (let i = 0; i < n; i++) amount += Math.max(0, Math.min(s.total[i], L) - prev);
    const elig = contenders.filter((i) => s.total[i] >= L);
    prev = L;
    if (!elig.length) {
      if (pots.length) pots[pots.length - 1].amount += amount;
      continue;
    }
    let winners = elig;
    if (show && elig.length > 1) {
      const best = Math.max(...elig.map((i) => scoreOf[i]));
      winners = elig.filter((i) => scoreOf[i] === best);
    }
    pots.push({ amount, winners, elig });
  }
  const newChips = [...chips];
  const payouts = Array(n).fill(0);
  for (const p of pots) {
    const share = Math.floor(p.amount / p.winners.length);
    let rest = p.amount - share * p.winners.length;
    const ordered = [...p.winners].sort((a, b) => ((a - s.dealer - 1 + n) % n) - ((b - s.dealer - 1 + n) % n));
    for (const w of ordered) {
      const g = share + (rest-- > 0 ? 1 : 0);
      newChips[w] += g;
      payouts[w] += g;
    }
  }
  const handEnd = {
    hand: s.handNo, board: [...board], show: show ? Object.fromEntries(contenders.map((i) => [i, s.hole[i]])) : null,
    names: show ? Object.fromEntries(contenders.map((i) => [i, handName(scoreOf[i])])) : null,
    pots: pots.map((p) => ({ amount: p.amount, winners: p.winners })), payouts, chips: newChips, folded: [...folded], dealer: s.dealer,
    net: newChips.map((c, i) => c - (s.chips[i] + s.total[i])),
  };
  const played = s.handNo + 1;
  const ended = played >= s.hands || newChips.filter((c) => c > 0).length < 2 || (s.humanOut && newChips[0] === 0);
  const base = { ...s, chips: newChips, handEnd, board, folded };
  if (ended) return { ...base, phase: 'over' };
  return { ...startHand({ ...s, chips: newChips }, played, s.dealer), handEnd };
}

/** Sokak ilerlet: kartları aç; herkes all-in ise showdown'a kadar aç. */
function advance(s0) {
  let s = { ...s0, bets: Array(s0.n).fill(0), cur: 0, minRaise: s0.bb, raises: 0, acted: Array(s0.n).fill(false) };
  for (;;) {
    if (s.street === 'river') return finishHand(s, s.chips, s.folded, s.board, true);
    const k = s.street === 'preflop' ? 3 : 1;
    const board = [...s.board, ...s.deck.slice(s.pos, s.pos + k)];
    s = { ...s, board, pos: s.pos + k, street: s.street === 'preflop' ? 'flop' : s.street === 'flop' ? 'turn' : 'river' };
    const able = nonFolded(s).filter((i) => !s.allin[i]);
    if (able.length > 1) {
      const first = (() => {
        for (let q = 1; q <= s.n; q++) {
          const i = (s.dealer + q) % s.n;
          if (!s.folded[i] && !s.allin[i]) return i;
        }
        return -1;
      })();
      return { ...s, turn: first };
    }
    // bahis yapacak kimse yok: kalan kartlar açılır
  }
}

const game = {
  id: 'poker',
  name: 'Teksas Poker',
  minPlayers: 2,
  maxPlayers: 4,

  createInitialState(config, rng) {
    const n = Math.min(4, Math.max(2, config.players || 4));
    const s = { n, hands: config.hands || HANDS, seed: rng.int(2 ** 31), chips: Array(n).fill(START_CHIPS), humanOut: !!config.humanOut, phase: 'bet', handEnd: null };
    return startHand(s, 0, 0);
  },

  currentActor: (s) => s.turn,

  legalMoves(s, seat) {
    if (s.phase !== 'bet' || seat !== s.turn) return [];
    const toCall = s.cur - s.bets[seat];
    const c = s.chips[seat];
    const out = [];
    if (toCall > 0) out.push({ t: 'fold' }, { t: 'call' });
    else out.push({ t: 'check' });
    if (c > toCall) {
      const maxTo = s.bets[seat] + c;
      const minTo = Math.min(maxTo, s.cur + s.minRaise);
      const pot = s.total.reduce((a, b) => a + b, 0);
      const cands = new Set([minTo, Math.round((s.cur + (pot + toCall) / 2) / 10) * 10, s.cur + pot + toCall, maxTo]);
      [...cands].filter((to) => to >= minTo && to <= maxTo && to > s.cur).sort((a, b) => a - b).forEach((to) => out.push({ t: 'raise', to }));
    }
    return out;
  },

  viewFor(s, seat) {
    return {
      seat,
      n: s.n,
      phase: s.phase,
      turn: s.turn,
      street: s.street,
      handNo: s.handNo,
      hands: s.hands,
      dealer: s.dealer,
      sbSeat: s.sbSeat,
      bbSeat: s.bbSeat,
      sb: s.sb,
      bb: s.bb,
      hole: s.hole[seat] || [],
      holeCounts: s.hole.map((h, i) => (s.folded[i] ? 0 : h.length)),
      board: s.board,
      chips: s.chips,
      bets: s.bets,
      total: s.total,
      folded: s.folded,
      allin: s.allin,
      cur: s.cur,
      minRaise: s.minRaise,
      raises: s.raises,
      pot: s.total.reduce((a, b) => a + b, 0),
    };
  },

  applyMove(s, seat, move) {
    const chips = [...s.chips];
    const bets = [...s.bets];
    const total = [...s.total];
    const allin = [...s.allin];
    const folded = [...s.folded];
    const acted = [...s.acted];
    let { cur, minRaise } = s;
    let raisesN = s.raises;
    acted[seat] = true;
    if (move.t === 'fold') folded[seat] = true;
    else if (move.t === 'call') {
      const a = Math.min(chips[seat], cur - bets[seat]);
      chips[seat] -= a;
      bets[seat] += a;
      total[seat] += a;
    } else if (move.t === 'raise') {
      const a = move.to - bets[seat];
      chips[seat] -= a;
      bets[seat] = move.to;
      total[seat] += a;
      if (move.to - cur >= minRaise) minRaise = move.to - cur;
      cur = move.to;
      raisesN = s.raises + 1;
      for (let i = 0; i < s.n; i++) if (i !== seat) acted[i] = false;
    }
    if (chips[seat] === 0) allin[seat] = true;
    let st = { ...s, chips, bets, total, allin, folded, acted, cur, minRaise, raises: raisesN, handEnd: null };
    const alive = nonFolded(st);
    if (alive.length === 1) return finishHand(st, chips, folded, s.board, false);
    const nx = nextActor(st, seat);
    if (nx >= 0) return { ...st, turn: nx };
    return advance(st);
  },

  isOver: (s) => s.phase === 'over',
  scores: (s) => s.chips,

  publicEvent(before, seat, move, after) {
    return {
      seat,
      move,
      newHand: after.handNo !== before.handNo,
      board: after.board,
      street: after.street,
      handEnd: after.handEnd && after.handEnd !== before.handEnd ? after.handEnd : null,
    };
  },

  rateMove(view, move, ctx = {}) {
    const risk = ctx.risk ?? 0.5;
    const E = equityOf(view, risk);
    const toCall = Math.min(view.cur - view.bets[view.seat], view.chips[view.seat]);
    const pot = view.pot;
    const myBet = view.bets[view.seat];
    const unit = pot + toCall + view.bb; // puanlar bu birime oranlanıp sıkıştırılır: gürültü büyük raise'lerle şişmesin
    const sq = (ev) => Math.tanh(ev / unit);
    if (move.t === 'fold') return 0;
    if (move.t === 'check') return sq(E * pot * 0.25);
    if (move.t === 'call') {
      const Ea = E - Math.min(0.2, 0.15 * toCall / Math.max(pot, 1)); // büyük bahsi gören rakip genelde güçlüdür
      return sq(Ea * (pot + toCall) - (1 - Ea) * toCall);
    }
    const add = move.to - myBet;
    const frac = add / (pot + add);
    const opps = view.folded.filter((f, i) => !f && i !== view.seat).length;
    const fair = 1 / (opps + 1);
    const strength = (E - fair) / (1 - fair); // 0 = herkesle eşit şans, 1 = kesin kazanır
    // değer için yükselt (güçlü el) ya da seyrek blöf; tekrar tekrar yükseltme savaşına girme
    if (view.raises >= 2 && strength < 0.7) return -1;
    if (view.raises >= 1 && strength < 0.35) return -1;
    if (strength < 0.15 + (risk - 0.5) * 0.1 && !(view.raises === 0 && view.street !== 'preflop' && risk > 0.7)) return -0.9;
    const Ea = E - 0.22 * frac;
    const f = Math.max(0, 0.08 + risk * 0.15);
    const called = Ea * (pot + add) - (1 - Ea) * add;
    return sq(f * pot + (1 - f) * called);
  },
};

// ---- Bot: Monte Carlo eşitlik ----------------------------------------------------------------

const cache = new WeakMap();
function equityOf(view, risk) {
  if (cache.has(view)) return cache.get(view);
  const opp = view.folded.filter((f, i) => !f && i !== view.seat).length;
  const known = new Set([...view.hole, ...view.board]);
  const pool = ALL.filter((c) => !known.has(c));
  const rng = makeRng((view.handNo * 131 + view.board.length * 17 + view.hole.join('').length + pool.length * 7 + Math.floor(Math.random() * 1e6)) >>> 0);
  const sims = 110;
  let win = 0;
  for (let k = 0; k < sims; k++) {
    const d = rng.shuffle([...pool]);
    let p = 0;
    const board = [...view.board];
    while (board.length < 5) board.push(d[p++]);
    const mine = bestScore([...view.hole, ...board]);
    let better = false;
    let tie = 0;
    for (let o = 0; o < opp; o++) {
      const sc = bestScore([d[p++], d[p++], ...board]);
      if (sc > mine) {
        better = true;
        break;
      }
      if (sc === mine) tie++;
    }
    if (!better) win += tie ? 1 / (tie + 1) : 1;
  }
  const e = win / sims;
  cache.set(view, e);
  return e;
}

export default game;

/** Yönerge için: kazanma olasılığı (0-1) */
export const equity = (view) => equityOf(view, 0.5);
