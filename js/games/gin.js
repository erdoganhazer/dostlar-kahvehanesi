// Gin Rummy: 52 kart, 2 kişi. Kurallar: docs/GIN-KURALLARI.md
// Herkese 10 kart, bir kart açık yere (açık kart). İlk turda önce dağıtmayan, sonra dağıtan açık kartı alabilir ya da pas der;
// ikisi de pas derse dağıtmayan desteden çeker. Sonra sırayla: desteden ya da yerden çek, bir kart at.
// Per: aynı sayıdan 3-4 kart. Seri: aynı renkten ardışık 3+ kart (as yalnız 1: A-2-3, K-A yok).
// Ceza (dağınık kart): as 1, 2-10 kendi değeri, resimler 10. Kart atarken dağınık 10 ya da azsa "kapı" (knock) diyebilirsin; 0 ise gin.
// Kapıda rakip dağınıklarını kapı diyenin perlerine işler (gin'de işleyemez).
// Puan: kapı: fark; rakip eşit ya da az ise alt kesme: rakibe fark + 25. Gin: rakibin cezası + 25.
// 100'e ulaşan kazanır: +100 oyun bonusu (rakip hiç el almadıysa 200), herkese aldığı her el için +25 (kutu bonusu).
// Destede 2 kart kalınca kimse kapı demediyse el berabere (puan yok, aynı kişi dağıtır).
// Kart kimliği: 'S14' (maça as) … 'C10'. Hamleler: {t:'take'|'pass'} (ilk tur), {t:'draw',from:'deck'|'pile'}, {t:'discard',c}, {t:'knock',c}
import { makeRng } from '../core/rng.js';

export const SUITS = ['S', 'H', 'C', 'D'];
export const TARGET = 100;
export const GIN_BONUS = 25;
export const UNDERCUT_BONUS = 25;
export const BOX_BONUS = 25;
export const KNOCK_MAX = 10;
const suitOf = (c) => c[0];
const rawRank = (c) => parseInt(c.slice(1), 10);
/** Gin sırası: as 1 */
export const gr = (c) => (rawRank(c) === 14 ? 1 : rawRank(c));
export const val = (c) => Math.min(10, gr(c));
const ORD = { S: 0, H: 1, C: 2, D: 3 };
export const sortCards = (cs) => [...cs].sort((a, b) => ORD[a[0]] - ORD[b[0]] || gr(a) - gr(b));
const ALL = [];
for (const s of SUITS) for (let r = 2; r <= 14; r++) ALL.push(`${s}${r}`);

// ---- Per bulucu ----------------------------------------------------------------------------

/** Eldeki bütün olası per/seriler */
export function candidateMelds(cards) {
  const out = [];
  const byRank = new Map();
  for (const c of cards) byRank.set(gr(c), [...(byRank.get(gr(c)) || []), c]);
  for (const g of byRank.values()) {
    if (g.length >= 3) {
      if (g.length === 4) out.push([...g]);
      for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) for (let k = j + 1; k < g.length; k++) out.push([g[i], g[j], g[k]]);
    }
  }
  for (const s of SUITS) {
    const cs = cards.filter((c) => suitOf(c) === s).sort((a, b) => gr(a) - gr(b));
    let start = 0;
    for (let i = 1; i <= cs.length; i++) {
      if (i === cs.length || gr(cs[i]) !== gr(cs[i - 1]) + 1) {
        const runLen = i - start;
        for (let a = start; a < i; a++) for (let b = a + 3; b <= i; b++) out.push(cs.slice(a, b));
        start = i;
        void runLen;
      }
    }
  }
  return out;
}

const memo = new Map();
/** En az cezalı diziliş: { dead, melds, left } */
export function solve(cards) {
  const key = sortCards(cards).join(',');
  if (memo.has(key)) return memo.get(key);
  const cands = candidateMelds(cards);
  let best = { dead: cards.reduce((t, c) => t + val(c), 0), melds: [], left: [...cards] };
  const rec = (i, used, melds) => {
    const left = cards.filter((c) => !used.has(c));
    const dead = left.reduce((t, c) => t + val(c), 0);
    if (dead < best.dead) best = { dead, melds: melds.map((m) => [...m]), left };
    for (let k = i; k < cands.length; k++) {
      const m = cands[k];
      if (m.some((c) => used.has(c))) continue;
      m.forEach((c) => used.add(c));
      melds.push(m);
      rec(k + 1, used, melds);
      melds.pop();
      m.forEach((c) => used.delete(c));
    }
  };
  rec(0, new Set(), []);
  if (memo.size > 30000) memo.clear();
  memo.set(key, best);
  return best;
}

/** Bütün ayrık per seçimleri (savunanın işleme hesabı için) */
function allArrangements(cards) {
  const cands = candidateMelds(cards);
  const res = [];
  const rec = (i, used, melds) => {
    res.push(melds.map((m) => [...m]));
    for (let k = i; k < cands.length; k++) {
      const m = cands[k];
      if (m.some((c) => used.has(c))) continue;
      m.forEach((c) => used.add(c));
      melds.push(m);
      rec(k + 1, used, melds);
      melds.pop();
      m.forEach((c) => used.delete(c));
    }
  };
  rec(0, new Set(), []);
  return res;
}

/** Bu kart bu pere işlenir mi? */
function fits(m, c) {
  const isSet = m.every((x) => gr(x) === gr(m[0]));
  if (isSet && m.length >= 3 && m.length < 4 && gr(c) === gr(m[0])) return true;
  if (m.every((x) => suitOf(x) === suitOf(m[0])) && !isSet && suitOf(c) === suitOf(m[0])) {
    const rs = m.map(gr);
    return gr(c) === Math.min(...rs) - 1 || gr(c) === Math.max(...rs) + 1;
  }
  return false;
}

/** Dağınık kartları kapı diyenin perlerine işle (zincirleme). Dönen: { left, lays: [{c, m}] } */
export function layOff(left, knockerMelds) {
  const melds = knockerMelds.map((m) => [...m]);
  let rest = [...left];
  const lays = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of rest) {
      const mi = melds.findIndex((m) => fits(m, c));
      if (mi >= 0) {
        melds[mi].push(c);
        lays.push({ c, m: mi });
        rest = rest.filter((x) => x !== c);
        changed = true;
        break;
      }
    }
  }
  return { left: rest, lays };
}

/** Savunanın en iyi dizilişi + işlemesi */
export function defend(cards, knockerMelds) {
  let best = null;
  for (const melds of allArrangements(cards)) {
    const used = new Set(melds.flat());
    const left0 = cards.filter((c) => !used.has(c));
    const { left, lays } = layOff(left0, knockerMelds);
    const dead = left.reduce((t, c) => t + val(c), 0);
    if (!best || dead < best.dead) best = { dead, melds, left, lays };
  }
  return best;
}

// ---- Durum ------------------------------------------------------------------------------------

function newRound(s, round, dealer) {
  const rng = makeRng((s.seed + round * 7919) >>> 0);
  const deck = rng.shuffle([...ALL]);
  const nd = 1 - dealer;
  const hands = [[], []];
  let pos = 0;
  for (let k = 0; k < 10; k++) for (const i of [nd, dealer]) hands[i].push(deck[pos++]);
  const up = deck[pos++];
  return {
    ...s, round, dealer, hands: hands.map(sortCards), deck: deck.slice(pos), pile: [up], phase: 'first', turn: nd,
    took: null, forceDeck: false, taken: [[], []], lastEvent: null,
  };
}

function endRound(s, knocker, discard) {
  if (knocker < 0) {
    const roundEnd = { round: s.round, kind: 'void', winner: -1, pts: 0, hands: s.hands.map((h) => [...h]), scores: s.scores };
    return { ...newRound({ ...s, roundEnd, sheet: [...s.sheet, roundEnd] }, s.round + 1, s.dealer), roundEnd };
  }
  const def = 1 - knocker;
  const k = solve(s.hands[knocker]);
  const gin = k.dead === 0;
  const d = gin ? { ...solve(s.hands[def]), lays: [] } : defend(s.hands[def], k.melds);
  let winner;
  let pts;
  let kind;
  if (gin) {
    winner = knocker;
    pts = GIN_BONUS + d.dead;
    kind = 'gin';
  } else if (d.dead <= k.dead) {
    winner = def;
    pts = UNDERCUT_BONUS + (k.dead - d.dead);
    kind = 'undercut';
  } else {
    winner = knocker;
    pts = d.dead - k.dead;
    kind = 'knock';
  }
  const scores = s.scores.map((t, i) => t + (i === winner ? pts : 0));
  const wins = s.wins.map((w, i) => w + (i === winner ? 1 : 0));
  const roundEnd = {
    round: s.round, kind, knocker, winner, pts, discard, hands: s.hands.map((h) => [...h]),
    knock: { melds: k.melds, left: k.left, dead: k.dead }, def: { melds: d.melds, left: d.left, dead: d.dead, lays: d.lays }, scores, wins,
  };
  const base = { ...s, scores, wins, roundEnd, sheet: [...s.sheet, roundEnd] };
  if (Math.max(...scores) >= TARGET || s.round >= 60) {
    const top = scores[0] >= scores[1] ? 0 : 1;
    const final = scores.map((t, i) => t + wins[i] * BOX_BONUS + (i === top ? (wins[1 - top] === 0 ? 2 : 1) * 100 : 0));
    return { ...base, final, over: true, phase: 'over', winner: final[0] >= final[1] ? 0 : 1 };
  }
  return { ...newRound(base, s.round + 1, winner), roundEnd };
}

const game = {
  id: 'gin',
  name: 'Gin Rummy',
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState(config, rng) {
    const s = { n: 2, seed: rng.int(2 ** 31), scores: [0, 0], wins: [0, 0], sheet: [], over: false, roundEnd: null, final: null };
    return newRound(s, 0, rng.int(2));
  },

  currentActor: (s) => s.turn,

  legalMoves(s, seat) {
    if (s.over || seat !== s.turn) return [];
    if (s.phase === 'first') return [{ t: 'take' }, { t: 'pass' }];
    if (s.phase === 'draw') return s.forceDeck || !s.pile.length ? [{ t: 'draw', from: 'deck' }] : [{ t: 'draw', from: 'deck' }, { t: 'draw', from: 'pile' }];
    const out = [];
    for (const c of s.hands[seat]) {
      if (c === s.took) continue;
      out.push({ t: 'discard', c });
      if (solve(s.hands[seat].filter((x) => x !== c)).dead <= KNOCK_MAX) out.push({ t: 'knock', c });
    }
    return out;
  },

  viewFor(s, seat) {
    return {
      seat, n: 2, hand: [...s.hands[seat]], handSizes: s.hands.map((h) => h.length), phase: s.phase, turn: s.turn, dealer: s.dealer,
      pileTop: s.pile[s.pile.length - 1] ?? null, pile: s.pile.slice(-5), pileSize: s.pile.length, deckLeft: s.deck.length,
      took: s.took, forceDeck: s.forceDeck, taken: s.taken, discards: s.pile.slice(), round: s.round, scores: s.scores, wins: s.wins, final: s.final,
    };
  },

  applyMove(s, seat, move) {
    const other = 1 - seat;
    if (move.t === 'pass') {
      if (seat !== s.dealer) return { ...s, turn: s.dealer, lastEvent: { t: 'pass', seat } };
      return { ...s, turn: other, phase: 'draw', forceDeck: true, lastEvent: { t: 'pass', seat } };
    }
    if (move.t === 'take' || (move.t === 'draw' && move.from === 'pile')) {
      const c = s.pile[s.pile.length - 1];
      const hands = s.hands.map((h, i) => (i === seat ? sortCards([...h, c]) : h));
      const taken = s.taken.map((t, i) => (i === seat ? [...t, c] : t));
      return { ...s, hands, pile: s.pile.slice(0, -1), phase: 'discard', took: c, forceDeck: false, taken, lastEvent: { t: 'draw', seat, from: 'pile', c } };
    }
    if (move.t === 'draw') {
      const c = s.deck[0];
      const hands = s.hands.map((h, i) => (i === seat ? sortCards([...h, c]) : h));
      return { ...s, hands, deck: s.deck.slice(1), phase: 'discard', took: null, forceDeck: false, drawn: c, lastEvent: { t: 'draw', seat, from: 'deck', c } };
    }
    const c = move.c;
    const hands = s.hands.map((h, i) => (i === seat ? h.filter((x) => x !== c) : h));
    const next = { ...s, hands, pile: [...s.pile, c], took: null, lastEvent: { t: move.t, seat, c } };
    if (move.t === 'knock') return endRound(next, seat, c);
    if (next.deck.length <= 2) return endRound(next, -1, c);
    return { ...next, phase: 'draw', turn: other };
  },

  isOver: (s) => s.over,
  scores: (s) => s.final || s.scores,
  winners: (s) => (s.over ? [s.winner] : []),

  publicEvent(before, seat, move, after) {
    const ev = after.lastEvent;
    return {
      seat, move,
      ev: ev && ev.t === 'draw' && ev.from === 'deck' ? { ...ev, c: null } : ev,
      roundEnd: after.roundEnd && after.roundEnd !== before.roundEnd ? after.roundEnd : null,
    };
  },

  moveKey: (m) => `${m.t}:${m.from || ''}:${m.c || ''}`,

  // ---- Bot ----
  rateMove(view, move, ctx = {}) {
    const hand = view.hand;
    const risk = ctx.risk ?? 0.5;
    if (move.t === 'pass' || (move.t === 'draw' && move.from === 'deck')) return 0;
    if (move.t === 'take' || move.t === 'draw') {
      const top = view.pileTop;
      const now = solve(hand).dead;
      const after = bestDiscard([...hand, top], top, view);
      const inMeld = solve(after.keep).melds.some((m) => m.includes(top));
      return (inMeld ? 6 : -4) + (now - after.dead) * 0.6;
    }
    const keep = hand.filter((x) => x !== move.c);
    const r = solve(keep);
    let v = -r.dead - danger(move.c, view) * 6 + val(move.c) * 0.15 - nearness(move.c, keep) * 1.5;
    if (move.t === 'knock') {
      if (r.dead === 0) return v + 200;
      // erken kapı iyidir; geç kalınca rakibin elinin oturmuş olma ihtimali yükselir (alt kesme riski)
      const early = view.deckLeft / 31;
      v += 12 + early * 10 - r.dead * (2.2 - risk) ;
    }
    return v;
  },
};

/** Kartın başka kartlarla yakınlığı (aynı sayı ya da aynı renkte ±2): yüksekse saklamaya değer */
function nearness(c, keep) {
  let n = 0;
  for (const x of keep) {
    if (gr(x) === gr(c)) n += 1;
    else if (suitOf(x) === suitOf(c) && Math.abs(gr(x) - gr(c)) <= 2) n += 0.6;
  }
  return n;
}

/** Rakibin yerden aldığı kartlara göre bu kartı atmanın tehlikesi (0-1) */
function danger(c, view) {
  const opp = view.taken?.[1 - view.seat] || [];
  let d = 0;
  for (const x of opp) {
    if (gr(x) === gr(c)) d = Math.max(d, 1);
    else if (suitOf(x) === suitOf(c) && Math.abs(gr(x) - gr(c)) <= 2) d = Math.max(d, 0.7);
  }
  return d;
}

/** Elden atılacak en iyi kart (bot ve yönerge). skip: yerden alınan kart atılamaz */
export function bestDiscard(hand, skip = null, view = null) {
  let best = null;
  for (const c of hand) {
    if (c === skip) continue;
    const keep = hand.filter((x) => x !== c);
    const dead = solve(keep).dead;
    const v = dead + (view ? danger(c, view) * 6 : 0) - val(c) * 0.15;
    if (!best || v < best.v) best = { c, dead, keep, v };
  }
  return best;
}

export default game;
