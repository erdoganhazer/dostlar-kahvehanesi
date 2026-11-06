// Yanık: 2 deste + 2 joker (106 kart), 2-4 kişi. Kurallar: docs/YANIK-KURALLARI.md
// Herkese 10, başlayana 11 kart (çekmeden atar). Sıran gelince desteden ya da yandan (önceki oyuncunun attığı) kart alırsın;
// yandan alınca açmak zorunda değilsin. Yere açmak için en az 2 per/seri ya da 4 çift gerekir ve
// (önceki cezan + açınca elinde kalanlar, atacağın kart hariç) 100'ü geçmemelidir. Açtıktan sonra yeni per açabilir,
// yerdeki perlere kart işleyebilirsin. Yerdeki jokerin yerini tutan kart sende varsa jokeri alabilirsin.
// İşlenebilecek kartı yere atan (açmış oyuncu) 10 ceza yer. Son kartını atan biter.
// El sonunda herkes elinde kalan kadar ceza yer (2-9 kendi değeri, 10/J/Q/K/A 10, joker 20); çift açan 2 katını yer.
// Paralı: herkes girişte çanağa giriş parası koyar. Toplamı 100'ü geçen yanar: ya çekilir ya da bir önceki koyduğunun 2 katını
// çanağa koyup yanmayanların en yüksek cezasıyla tekrar girer. Masada tek oyuncu kalınca çanağı o alır (el sınırı yok).
// Hamleler: {t:'rebuy'}, {t:'quit'} (yanınca), {t:'draw',from:'deck'|'pile'}, {t:'open',mode:'per'|'cift'}, {t:'lay'}, {t:'add',c,m}, {t:'swap',c,m}, {t:'discard',c}
import { makeRng } from '../core/rng.js';
import { solve, sortCards, isJoker, suitOf, rankOf } from './konken.js';

export const JP = 20;
export const LIMIT = 100;
export const STAKE = 50;
export const START_MONEY = 1000;
const MAX_ROUNDS = 400; // güvenlik sınırı (pratikte ulaşılmaz)
export const pen = (c) => (isJoker(c) ? JP : rankOf(c) >= 10 ? 10 : rankOf(c));
export const handPen = (cs) => cs.reduce((a, c) => a + pen(c), 0);
const ALL = [];
for (const d of ['a', 'b']) {
  for (const s of ['S', 'H', 'D', 'C']) for (let r = 2; r <= 14; r++) ALL.push(`${s}${r}${d}`);
  ALL.push(`J0${d}`);
}
const base = (c) => c.slice(0, -1);

// ---- Perler ----------------------------------------------------------------------------------

/** Çözücünün verdiği diziyi yerdeki per nesnesine çevirir: {kind, cards, rank|suit, lo, hi} */
export function meldFrom(cards) {
  const real = cards.filter((c) => !isJoker(c));
  if (real.length <= 1 || real.every((c) => rankOf(c) === rankOf(real[0]))) return { kind: 'set', rank: rankOf(real[0] ?? 'S2'), cards: [...cards] };
  const suit = suitOf(real[0]);
  for (const aceLow of [false, true]) {
    const pos = (c) => (rankOf(c) === 14 && aceLow ? 1 : rankOf(c));
    const i = cards.findIndex((c) => !isJoker(c));
    const lo = pos(cards[i]) - i;
    if (lo < 1) continue;
    if (cards.every((c, k) => isJoker(c) || pos(c) === lo + k)) return { kind: 'run', suit, lo, hi: lo + cards.length - 1, cards: [...cards] };
  }
  return { kind: 'set', rank: rankOf(real[0]), cards: [...cards] };
}

/** c bu pere işlenebilir mi? Dönen: 'lo' | 'hi' | 'set' | null */
export function addSpot(meld, c) {
  if (meld.kind === 'pair') return null;
  if (meld.kind === 'set') {
    if (meld.cards.length >= 4) return null;
    if (isJoker(c)) return 'set';
    const suits = meld.cards.filter((x) => !isJoker(x)).map(suitOf);
    return rankOf(c) === meld.rank && !suits.includes(suitOf(c)) ? 'set' : null;
  }
  if (isJoker(c)) return meld.hi < 14 ? 'hi' : meld.lo > 1 ? 'lo' : null;
  if (suitOf(c) !== meld.suit) return null;
  const r = rankOf(c);
  if (meld.hi < 14 && (r === meld.hi + 1 || (r === 14 && meld.hi === 13))) return 'hi';
  if (meld.lo > 1 && (r === meld.lo - 1 || (r === 14 && meld.lo === 2))) return 'lo';
  return null;
}

function applyAdd(meld, c, spot) {
  if (spot === 'set') return { ...meld, cards: [...meld.cards, c] };
  if (spot === 'hi') return { ...meld, cards: [...meld.cards, c], hi: meld.hi + 1 };
  return { ...meld, cards: [c, ...meld.cards], lo: meld.lo - 1 };
}

/** Yerdeki perdeki bir jokerin yerini c tutuyor mu? Dönen: jokerin dizideki yeri ya da -1 */
export function swapSpot(meld, c) {
  if (isJoker(c) || meld.kind === 'pair') return -1;
  if (meld.kind === 'set') {
    const suits = meld.cards.filter((x) => !isJoker(x)).map(suitOf);
    if (rankOf(c) !== meld.rank || suits.includes(suitOf(c))) return -1;
    return meld.cards.findIndex(isJoker);
  }
  if (suitOf(c) !== meld.suit) return -1;
  return meld.cards.findIndex((x, k) => {
    if (!isJoker(x)) return false;
    const p = meld.lo + k;
    return p === rankOf(c) || (p === 1 && rankOf(c) === 14);
  });
}

/** Çiftler: aynı kartın iki destesi ya da kart + joker */
export function pairsOf(cards) {
  const by = new Map();
  const jokers = cards.filter(isJoker);
  for (const c of cards) if (!isJoker(c)) {
    if (!by.has(base(c))) by.set(base(c), []);
    by.get(base(c)).push(c);
  }
  const pairs = [];
  const singles = [];
  for (const g of by.values()) {
    if (g.length >= 2) pairs.push([g[0], g[1]]);
    else singles.push(g[0]);
  }
  // jokerleri en değerli tek kartlarla eşle
  singles.sort((a, b) => pen(b) - pen(a));
  let j = 0;
  for (const s of singles) {
    if (j >= jokers.length) break;
    pairs.push([s, jokers[j++]]);
  }
  return pairs;
}

/** Elden açılabilecek en iyi düzen; bir kart atmak için elde kalır. Dönen: { melds, left, dead } | null */
export function bestOpening(hand, mode) {
  let best = null;
  const tried = new Set();
  for (const d of hand) {
    if (tried.has(base(d))) continue;
    tried.add(base(d));
    const rest = hand.filter((x) => x !== d);
    let melds;
    let left;
    if (mode === 'cift') {
      const p = pairsOf(rest);
      melds = p;
      const used = new Set(p.flat());
      left = rest.filter((x) => !used.has(x));
    } else {
      const r = solve(rest, JP);
      melds = r.melds;
      left = r.left;
    }
    const dead = handPen(left);
    if (!best || dead < best.dead || (dead === best.dead && pen(d) > pen(best.discard))) best = { melds, left: [...left, d], dead, discard: d };
  }
  return best;
}

// ---- Durum -----------------------------------------------------------------------------------

const active = (s) => s.out.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
const nextActive = (s, from) => {
  for (let k = 1; k <= s.n; k++) {
    const i = (from + k) % s.n;
    if (!s.out[i]) return i;
  }
  return from;
};

function newRound(s, round) {
  const rng = makeRng((s.seed + round * 7919) >>> 0);
  const deck = rng.shuffle([...ALL]);
  const act = active(s);
  const starter = s.out[round % s.n] ? nextActive(s, round % s.n) : round % s.n;
  const hands = Array.from({ length: s.n }, () => []);
  let pos = 0;
  const order = [];
  for (let k = 0, i = starter; k < act.length; k++, i = nextActive(s, i)) order.push(i);
  for (let k = 0; k < 10; k++) for (const i of order) hands[i].push(deck[pos++]);
  hands[starter].push(deck[pos++]);
  return {
    ...s, round, starter, hands: hands.map(sortCards), deck: deck.slice(pos), pile: [], table: [], opened: Array(s.n).fill(''), extra: Array(s.n).fill(0),
    phase: 'act', turn: starter, drew: false, lastEvent: null, order,
  };
}

function canOpen(s, seat, mode) {
  if (s.opened[seat]) return null;
  const o = bestOpening(s.hands[seat], mode);
  if (!o) return null;
  if (mode === 'per' && o.melds.length < 2) return null;
  if (mode === 'cift' && o.melds.length < 4) return null;
  if (s.totals[seat] + o.dead > LIMIT) return null;
  return o;
}

function canLay(s, seat) {
  if (!s.opened[seat] || s.hands[seat].length < 4) return null;
  const o = bestOpening(s.hands[seat], s.opened[seat] === 'cift' ? 'cift' : 'per');
  return o && o.melds.length ? o : null;
}

function endRound(s, finisher) {
  const pens = s.hands.map((h, i) => (s.out[i] || i === finisher ? 0 : handPen(h) * (s.opened[i] === 'cift' ? 2 : 1)) + (s.out[i] ? 0 : s.extra[i]));
  const totals = s.totals.map((t, i) => t + pens[i]);
  const burned = totals.map((t, i) => (!s.out[i] && t > LIMIT ? i : -1)).filter((i) => i >= 0);
  const burns = s.burns.map((b, i) => b + (burned.includes(i) ? 1 : 0));
  const roundEnd = { round: s.round, finisher, pens, totals, burns, burned, hands: s.hands.map((h) => [...h]), extra: [...s.extra], opened: [...s.opened] };
  const nb = { ...s, totals, burns, roundEnd, sheet: [...s.sheet, roundEnd], lastEvent: null };
  if (burned.length) return { ...nb, phase: 'rebuy', queue: burned, turn: burned[0] };
  return afterRound(nb);
}

/** Yanma kararları bitti: çekilenler çıkar, tek kişi kaldıysa çanak onun; değilse yeni el */
function afterRound(s) {
  const act = active(s);
  if (act.length <= 1 || (s.humanOut && s.out[0]) || s.round + 1 >= MAX_ROUNDS) {
    const money = [...s.money];
    let winner = -1;
    if (act.length === 1) winner = act[0];
    else if (act.length > 1) winner = act.reduce((b, i) => (s.totals[i] < s.totals[b] ? i : b), act[0]);
    if (winner >= 0) money[winner] += s.pot;
    return { ...s, money, pot: 0, winner, phase: 'over' };
  }
  return newRound(s, s.round + 1);
}

const game = {
  id: 'yanik',
  name: 'Yanık',
  minPlayers: 2,
  maxPlayers: 4,

  createInitialState(config, rng) {
    const n = Math.min(4, Math.max(2, config.players || 4));
    const stake = config.stake || STAKE;
    const money = Array.from({ length: n }, (_, i) => (i === 0 && config.money != null ? config.money : START_MONEY) - stake);
    const s = {
      n, seed: rng.int(2 ** 31), totals: Array(n).fill(0), burns: Array(n).fill(0), sheet: [], roundEnd: null, stake,
      money, pot: stake * n, entry: Array(n).fill(stake), out: Array(n).fill(false), humanOut: !!config.humanOut, winner: -1, queue: [],
    };
    return newRound(s, 0);
  },

  currentActor: (s) => s.turn,

  legalMoves(s, seat) {
    if (s.phase === 'over' || seat !== s.turn) return [];
    if (s.phase === 'rebuy') return s.money[seat] >= s.entry[seat] * 2 ? [{ t: 'rebuy' }, { t: 'quit' }] : [{ t: 'quit' }];
    if (s.phase === 'draw') {
      const out = [{ t: 'draw', from: 'deck' }];
      if (s.pile.length) out.push({ t: 'draw', from: 'pile' });
      return out;
    }
    const hand = s.hands[seat];
    const out = [];
    if (canOpen(s, seat, 'per')) out.push({ t: 'open', mode: 'per' });
    if (canOpen(s, seat, 'cift')) out.push({ t: 'open', mode: 'cift' });
    if (canLay(s, seat)) out.push({ t: 'lay' });
    const seen = new Set();
    for (const c of hand) {
      if (seen.has(base(c))) continue;
      seen.add(base(c));
      s.table.forEach((m, i) => {
        if (s.opened[seat] && hand.length > 1 && addSpot(m, c)) out.push({ t: 'add', c, m: i });
        if (swapSpot(m, c) >= 0) out.push({ t: 'swap', c, m: i });
      });
    }
    for (const c of hand) out.push({ t: 'discard', c });
    return out;
  },

  moveKey: (m) => (m.c ? `${m.t}:${m.c.slice(0, -1)}:${m.m ?? ''}` : `${m.t}:${m.mode ?? m.from ?? ''}`),

  viewFor(s, seat) {
    return {
      seat, n: s.n, hand: [...s.hands[seat]], handSizes: s.hands.map((h) => h.length), table: s.table, pileTop: s.pile[s.pile.length - 1] ?? null, pile: s.pile.slice(-4),
      pileSize: s.pile.length, deckLeft: s.deck.length, opened: s.opened, totals: s.totals, burns: s.burns, extra: s.extra, round: s.round, money: s.money, pot: s.pot, entry: s.entry, out: s.out, stake: s.stake, queue: s.queue,
      phase: s.phase, turn: s.turn, starter: s.starter, sheet: s.sheet,
    };
  },

  applyMove(s, seat, move) {
    if (move.t === 'rebuy' || move.t === 'quit') {
      const money = [...s.money];
      const entry = [...s.entry];
      const out = [...s.out];
      let pot = s.pot;
      const totals = [...s.totals];
      if (move.t === 'rebuy') {
        const cost = entry[seat] * 2;
        money[seat] -= cost;
        pot += cost;
        entry[seat] = cost;
        // yanmayanların en yüksek cezasıyla devam
        const ok = s.totals.map((t, i) => (!s.out[i] && t <= LIMIT ? t : -1)).filter((t) => t >= 0);
        totals[seat] = ok.length ? Math.max(...ok) : 0;
      } else out[seat] = true;
      const queue = s.queue.slice(1);
      const ns = { ...s, money, entry, out, pot, totals, queue, lastEvent: { t: move.t, seat, cost: move.t === 'rebuy' ? entry[seat] : 0 } };
      if (queue.length) return { ...ns, turn: queue[0] };
      // yanan herkes karar verdi: cezası hâlâ 100'ü geçen (rebuy etmeyen) yoksa yeni el
      return afterRound(ns);
    }
    const hands = s.hands.map((h) => [...h]);
    if (move.t === 'draw') {
      if (move.from === 'pile') {
        const c = s.pile[s.pile.length - 1];
        hands[seat] = sortCards([...hands[seat], c]);
        return { ...s, hands, pile: s.pile.slice(0, -1), phase: 'act', lastEvent: { t: 'draw', seat, from: 'pile', c } };
      }
      if (!s.deck.length) return endRound(s, -1);
      const c = s.deck[0];
      hands[seat] = sortCards([...hands[seat], c]);
      return { ...s, hands, deck: s.deck.slice(1), phase: 'act', lastEvent: { t: 'draw', seat, from: 'deck', c } };
    }
    if (move.t === 'open' || move.t === 'lay') {
      const mode = move.t === 'open' ? move.mode : s.opened[seat];
      const o = move.t === 'open' ? canOpen(s, seat, mode) : canLay(s, seat);
      if (!o) throw new Error('Açılamaz');
      const melds = o.melds.map((m) => (mode === 'cift' ? { kind: 'pair', cards: [...m], owner: seat } : { ...meldFrom(m), owner: seat }));
      const used = new Set(o.melds.flat());
      hands[seat] = hands[seat].filter((c) => !used.has(c));
      const opened = [...s.opened];
      if (move.t === 'open') opened[seat] = mode;
      return { ...s, hands, opened, table: [...s.table, ...melds], lastEvent: { t: move.t, seat, mode, from: s.table.length, melds } };
    }
    if (move.t === 'add') {
      const c = hands[seat].find((x) => base(x) === base(move.c)) ?? move.c;
      const spot = addSpot(s.table[move.m], c);
      if (!spot) throw new Error('İşlenemez');
      hands[seat] = hands[seat].filter((x) => x !== c);
      const table = s.table.map((m, i) => (i === move.m ? applyAdd(m, c, spot) : m));
      return { ...s, hands, table, lastEvent: { t: 'add', seat, c, m: move.m } };
    }
    if (move.t === 'swap') {
      const c = hands[seat].find((x) => base(x) === base(move.c)) ?? move.c;
      const k = swapSpot(s.table[move.m], c);
      if (k < 0) throw new Error('Joker alınamaz');
      const joker = s.table[move.m].cards[k];
      hands[seat] = sortCards([...hands[seat].filter((x) => x !== c), joker]);
      const table = s.table.map((m, i) => (i === move.m ? { ...m, cards: m.cards.map((x, j) => (j === k ? c : x)) } : m));
      return { ...s, hands, table, lastEvent: { t: 'swap', seat, c, m: move.m, joker } };
    }
    // atma
    const c = move.c;
    hands[seat] = hands[seat].filter((x) => x !== c);
    const extra = [...s.extra];
    const fault = !!s.opened[seat] && hands[seat].length > 0 && s.table.some((m) => addSpot(m, c));
    if (fault) extra[seat] += 10;
    const next = { ...s, hands, extra, pile: [...s.pile, c], lastEvent: { t: 'discard', seat, c, fault } };
    if (!hands[seat].length) return endRound(next, seat);
    return { ...next, phase: 'draw', turn: nextActive(s, seat) };
  },

  isOver: (s) => s.phase === 'over',
  scores: (s) => s.money,
  winners: (s) => (s.winner >= 0 ? [s.winner] : [s.money.indexOf(Math.max(...s.money))]),

  publicEvent(before, seat, move, after) {
    const ev = after.lastEvent && after.lastEvent !== before.lastEvent ? after.lastEvent : null;
    return {
      seat, move, ev: ev && ev.t === 'draw' && ev.from === 'deck' ? { ...ev, c: null } : ev,
      roundEnd: after.roundEnd && after.roundEnd !== before.roundEnd ? after.roundEnd : null,
      newRound: after.phase !== 'over' && after.phase !== 'rebuy' && after.round !== before.round,
    };
  },

  // ---- Bot ----
  rateMove(view, move, ctx = {}) {
    if (move.t === 'quit') return 0;
    if (move.t === 'rebuy') {
      const cost = view.entry[view.seat] * 2;
      const left = view.money[view.seat] - cost;
      // çanaktaki pay + oyunda kalmanın değeri, paranın ne kadarını götürdüğüne göre tartılır
      const share = view.pot / (view.out.filter((o) => !o).length || 1);
      const heavy = cost / Math.max(1, view.money[view.seat]) > 0.4 ? 2 : 1;
      return 40 + share - cost * (1 - (ctx.risk ?? 0.5) * 0.4) * heavy + (left < cost ? -40 : 0);
    }
    const hand = view.hand;
    const deadNow = solve(hand, JP).dead;
    if (move.t === 'draw') {
      if (move.from === 'deck') return 0;
      const top = view.pileTop;
      if (isJoker(top)) return 20;
      const withTop = solve([...hand, top], JP).dead - Math.max(...[...hand, top].map(pen));
      const gain = deadNow - Math.max(...hand.map(pen)) - withTop;
      return gain - 4;
    }
    if (move.t === 'open') {
      // açmak elde kalan cezayı korur; çift açmak 2 kat risk
      return move.mode === 'per' ? 100 : 60 - (ctx.risk ?? 0.5) * 10;
    }
    if (move.t === 'lay') return 95;
    if (move.t === 'add') return 80 + pen(move.c);
    if (move.t === 'swap') return 85;
    // atma
    const c = move.c;
    const rest = hand.filter((x) => x !== c);
    let v = -solve(rest, JP).dead;
    if (!rest.length) return 500; // bitiş
    if (isJoker(c)) v -= 60;
    if (view.opened[view.seat] && view.table.some((m) => addSpot(m, c))) v -= 40; // işlenebilir kart atma cezası
    return v + pen(c) * 0.05;
  },
};

export default game;
