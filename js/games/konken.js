// Konken: 2 deste + 2 joker (106 kart), 2-4 kişi. Kurallar: docs/KONKEN-KURALLARI.md
// Herkese 10 kart, başlayana 11. Sıran gelince desteden ya da yerdeki son atılan karttan çekip bir kart atarsın
// (başlayan ilk turda çekmeden atar). Elindeki 10 kart tamamen per (aynı sayı, farklı renk 3-4) ya da seri
// (aynı renk ardışık 3+, as başta ya da papazdan sonra) olunca son kartı atıp bitersin. Joker her kartın yerine geçer.
// İsteğe bağlı: joker atarak bitme (cezalar 2 kat), çifte (5 çift aynı kart; cezalar 2 kat).
// Puan modları: 'ceza' (11 el, biten 0, diğerleri gruba girmeyen kartların değeri; en az ceza kazanır)
//               'galibiyet' (her eli bitiren 1, özel bitiş 2 puan; 5 puana ilk ulaşan kazanır)
// Kart kimliği: 'H5a' / 'H5b' (iki deste), joker 'J0a' / 'J0b'. Hamleler: {t:'draw', from:'deck'|'pile'}, {t:'discard', c}
import { makeRng } from '../core/rng.js';

export const SUITS = ['S', 'H', 'D', 'C'];
export const suitOf = (c) => c[0];
export const rankOf = (c) => parseInt(c.slice(1), 10);
export const isJoker = (c) => c[0] === 'J';
export const sameCard = (a, b) => a.slice(0, -1) === b.slice(0, -1);
export const DEALS_CEZA = 11;
export const WIN_GALIBIYET = 5;
export const JOKER_PEN = 25;
export const cardPen = (c) => (isJoker(c) ? JOKER_PEN : rankOf(c) >= 11 ? 10 : rankOf(c));
const ORDER = { S: 0, H: 1, C: 2, D: 3, J: 4 };
export const sortCards = (cs) => [...cs].sort((a, b) => ORDER[a[0]] - ORDER[b[0]] || rankOf(a) - rankOf(b) || (a < b ? -1 : 1));

const ALL = [];
for (const d of ['a', 'b']) {
  for (const s of SUITS) for (let r = 2; r <= 14; r++) ALL.push(`${s}${r}${d}`);
  ALL.push(`J0${d}`);
}

// ---- Per/seri çözücü: elin en az cezalı dizilişi ---------------------------------------------

const memo = new Map();
/** cards: kart listesi. Dönen: { dead: ceza toplamı, melds: [[kart]], left: [gruba girmeyenler] } */
export function solve(cards, jp = JOKER_PEN) {
  const jokers = cards.filter(isJoker);
  const normal = sortCards(cards.filter((c) => !isJoker(c)));
  const key = normal.join(',') + '|' + jokers.length + '|' + jp;
  if (memo.has(key)) return remap(memo.get(key), jokers);
  const r = rec(normal, jokers.length, jp);
  if (memo.size > 20000) memo.clear();
  memo.set(key, r);
  return remap(r, jokers);
}

function remap(r, jokers) {
  // çözüm jokerleri 'J' yer tutucusuyla döner; gerçek joker kimlikleri sırayla yerleştirilir
  let k = 0;
  const sub = (c) => (c === 'J' ? jokers[k++] : c);
  return { dead: r.dead, melds: r.melds.map((m) => m.map(sub)), left: r.left.map(sub) };
}

function rec(cards, J, jp) {
  if (!cards.length) return { dead: J * jp, melds: [], left: Array(J).fill('J') };
  const c = cards[0];
  const rest = cards.slice(1);
  let best = (() => {
    const r = rec(rest, J, jp);
    return { dead: r.dead + cardPen(c), melds: r.melds, left: [c, ...r.left] };
  })();
  if (best.dead === cardPen(c) && cardPen(c) === 0) return best;
  const tryMeld = (meld, used, jUsed) => {
    const remain = rest.filter((x) => !used.includes(x));
    const r = rec(remain, J - jUsed, jp);
    if (r.dead < best.dead) best = { dead: r.dead, melds: [meld, ...r.melds], left: r.left };
  };
  // per: aynı sayı, farklı renkler
  const r0 = rankOf(c);
  const bySuit = {};
  for (const x of rest) if (rankOf(x) === r0 && suitOf(x) !== suitOf(c) && !bySuit[suitOf(x)]) bySuit[suitOf(x)] = x;
  const others = Object.values(bySuit);
  for (let m = 0; m < 1 << others.length; m++) {
    const pick = others.filter((_, i) => m & (1 << i));
    for (let j = 0; j <= J; j++) {
      const size = 1 + pick.length + j;
      if (size < 3 || size > 4) continue;
      tryMeld([c, ...pick, ...Array(j).fill('J')], pick, j);
    }
  }
  // seri: aynı renk, c'yi içeren her pencere (as 1 ya da 14)
  const s0 = suitOf(c);
  const posList = r0 === 14 ? [1, 14] : [r0];
  for (const p of posList) {
    for (let a = Math.max(1, p - 12); a <= p; a++) {
      for (let b = Math.max(p, a + 2); b <= 14; b++) {
        if (b - a > 12) break;
        const used = [];
        const meld = [];
        let j = 0;
        let ok = true;
        for (let q = a; q <= b; q++) {
          if (q === p) {
            meld.push(c);
            continue;
          }
          const want = q === 1 ? 14 : q;
          if (q === 14 && a === 1) {
            ok = false;
            break;
          }
          const x = rest.find((y) => suitOf(y) === s0 && rankOf(y) === want && !used.includes(y));
          if (x) {
            used.push(x);
            meld.push(x);
          } else {
            j++;
            meld.push('J');
          }
        }
        if (!ok || j > J || j >= b - a + 1) continue;
        tryMeld(meld, used, j);
      }
    }
  }
  return best;
}

/** Çifte: 10 kart 5 çift (aynı renk ve sayı; joker eş olabilir) */
export function isCifte(cards) {
  if (cards.length !== 10) return false;
  const J = cards.filter(isJoker).length;
  const cnt = new Map();
  for (const c of cards) if (!isJoker(c)) cnt.set(c.slice(0, -1), (cnt.get(c.slice(0, -1)) || 0) + 1);
  const singles = [...cnt.values()].filter((v) => v % 2 === 1).length;
  return singles <= J && (J - singles) % 2 === 0;
}

/** Bu kartı atınca biter mi? Dönen: null | { kind, mult } */
export function finishWith(hand, c, opts) {
  const rest = hand.filter((x) => x !== c);
  if (rest.length !== 10) return null;
  const normal = solve(rest).dead === 0;
  const cifte = opts.cifte && isCifte(rest);
  if (!normal && !cifte) return null;
  const joker = opts.joker && isJoker(c);
  const mult = (cifte ? 2 : 1) * (joker ? 2 : 1);
  return { kind: cifte && joker ? 'cifte-joker' : cifte ? 'cifte' : joker ? 'joker' : 'normal', mult };
}

// ---- Durum ----------------------------------------------------------------------------------

function newRound(s, round) {
  const rng = makeRng((s.seed + round * 7919) >>> 0);
  const deck = rng.shuffle([...ALL]);
  const dealer = round % s.n;
  const starter = (dealer + 1) % s.n;
  const hands = Array.from({ length: s.n }, () => []);
  let pos = 0;
  for (let k = 0; k < 10; k++) for (let i = 0; i < s.n; i++) hands[(starter + i) % s.n].push(deck[pos++]);
  hands[starter].push(deck[pos++]);
  return {
    ...s, round, dealer, starter, hands: hands.map(sortCards), deck: deck.slice(pos), pile: [], phase: 'discard', turn: starter,
    drew: null, reshuffles: 0, seen: [], lastEvent: null,
  };
}

const game = {
  id: 'konken',
  name: 'Konken',
  minPlayers: 2,
  maxPlayers: 4,

  createInitialState(config, rng) {
    const n = Math.min(4, Math.max(2, config.players || 4));
    const k = config.konken || {};
    const s = {
      n, seed: rng.int(2 ** 31), scoring: k.scoring === 'galibiyet' ? 'galibiyet' : 'ceza', opts: { joker: k.joker !== false, cifte: k.cifte !== false },
      totals: Array(n).fill(0), wins: Array(n).fill(0), sheet: [], over: false, roundEnd: null,
    };
    return newRound(s, 0);
  },

  currentActor: (s) => s.turn,

  legalMoves(s, seat) {
    if (s.over || seat !== s.turn) return [];
    if (s.phase === 'draw') {
      const out = [{ t: 'draw', from: 'deck' }];
      if (s.pile.length) out.push({ t: 'draw', from: 'pile' });
      return out;
    }
    return s.hands[seat].map((c) => ({ t: 'discard', c }));
  },

  viewFor(s, seat) {
    return {
      seat, n: s.n, hand: [...s.hands[seat]], handSizes: s.hands.map((h) => h.length), phase: s.phase, turn: s.turn,
      pileTop: s.pile[s.pile.length - 1] ?? null, pile: s.pile.slice(-5), pileSize: s.pile.length, deckLeft: s.deck.length,
      round: s.round, dealer: s.dealer, starter: s.starter, scoring: s.scoring, opts: s.opts, totals: s.totals, wins: s.wins,
      drew: s.drew, seen: s.seen, sheet: s.sheet,
    };
  },

  applyMove(s, seat, move) {
    if (move.t === 'draw') {
      let deck = s.deck;
      let pile = s.pile;
      let c;
      let reshuffles = s.reshuffles;
      if (move.from === 'pile') {
        c = pile[pile.length - 1];
        pile = pile.slice(0, -1);
      } else {
        if (!deck.length) {
          // deste bitti: yerdeki kartlar (üstteki hariç) karıştırılıp yeni deste olur
          const top = pile[pile.length - 1];
          const rest = pile.slice(0, -1);
          if (!rest.length || reshuffles >= 2) return endRound(s, -1, null, null);
          deck = makeRng((s.seed + s.round * 31 + reshuffles * 977) >>> 0).shuffle([...rest]);
          pile = [top];
          reshuffles++;
        }
        c = deck[0];
        deck = deck.slice(1);
      }
      const hands = s.hands.map((h, i) => (i === seat ? sortCards([...h, c]) : h));
      return { ...s, deck, pile, hands, phase: 'discard', drew: { seat, from: move.from, card: c, reshuffled: reshuffles !== s.reshuffles }, reshuffles, lastEvent: null };
    }
    const c = move.c;
    const fin = finishWith(s.hands[seat], c, s.opts);
    const hands = s.hands.map((h, i) => (i === seat ? h.filter((x) => x !== c) : h));
    const next = { ...s, hands, pile: [...s.pile, c], seen: [...s.seen, c], lastEvent: { seat, card: c, finish: fin } };
    if (fin) return endRound(next, seat, fin, c);
    return { ...next, phase: 'draw', turn: (seat + 1) % s.n, drew: null };
  },

  isOver: (s) => s.over,
  scores: (s) => (s.scoring === 'ceza' ? s.totals.map((t) => -t) : s.wins),

  publicEvent(before, seat, move, after) {
    return {
      seat, move,
      drew: move.t === 'draw' ? { from: move.from, card: move.from === 'pile' ? before.pile[before.pile.length - 1] : null, reshuffled: after.drew?.reshuffled } : null,
      finish: move.t === 'discard' ? after.lastEvent?.finish ?? null : null,
      roundEnd: after.roundEnd && after.roundEnd !== before.roundEnd ? after.roundEnd : null,
    };
  },

  // ---- Bot ----
  rateMove(view, move, ctx = {}) {
    const hand = view.hand;
    if (move.t === 'draw') {
      if (move.from === 'deck') return 0;
      const top = view.pileTop;
      const now = bestDiscard(hand, view.opts).dead;
      const withTop = bestDiscard([...hand, top], view.opts, top);
      if (withTop.finish) return 50;
      const gain = now - withTop.dead;
      return isJoker(top) ? 20 : gain - 4 - (ctx.risk ?? 0.5) * -2;
    }
    const fin = finishWith(hand, move.c, view.opts);
    if (fin) return 100 + fin.mult * 10;
    const after = solve(hand.filter((x) => x !== move.c));
    let v = -after.dead;
    if (isJoker(move.c)) v -= 40; // jokeri atma
    // sıradaki oyuncunun açıkça işine yarayacak kartı verme (yaklaşık: aynı sayı ya da komşu kart atılmış mı)
    return v + cardPen(move.c) * 0.05;
  },
};

/** Elden atılacak en iyi kart ve sonrası (bot ve yönerge için). skip: atılmayacak kart (yerden alınan) */
export function bestDiscard(hand, opts, skip = null) {
  let best = null;
  for (const c of hand) {
    if (c === skip) continue;
    const fin = finishWith(hand, c, opts);
    const dead = fin ? 0 : solve(hand.filter((x) => x !== c)).dead + (isJoker(c) ? 40 : 0);
    const val = dead - (fin ? fin.mult * 100 : 0) - cardPen(c) * 0.01;
    if (!best || val < best.val) best = { c, dead, val, finish: fin };
  }
  return best;
}

function endRound(s, winner, fin, card) {
  const hands = s.hands;
  const pen = hands.map((h, i) => (i === winner ? 0 : solve(h).dead));
  const mult = fin ? fin.mult : 1;
  const delta = winner < 0 ? Array(s.n).fill(0) : pen.map((p) => p * mult);
  const totals = s.totals.map((t, i) => t + delta[i]);
  const wins = s.wins.map((w, i) => w + (i === winner ? (fin && fin.mult > 1 ? 2 : 1) : 0));
  const roundEnd = { round: s.round, winner, kind: fin?.kind ?? 'void', mult, card, hands: hands.map((h) => [...h]), shown: hands.map((h) => solve(h)), delta, totals, wins, pile: s.pile };
  const sheet = [...s.sheet, roundEnd];
  const base = { ...s, totals, wins, sheet, roundEnd };
  const done = s.scoring === 'ceza' ? s.round + 1 >= DEALS_CEZA : Math.max(...wins) >= WIN_GALIBIYET || s.round >= 40;
  if (done) return { ...base, over: true, phase: 'over' };
  return { ...newRound(base, s.round + 1), roundEnd };
}

export default game;
