// King (Rıfkı): 4 kişilik, 52 kartlık, 20 elli oyun. Kurallar docs/KING-KURALLARI.md içinde.
// Kartlar düz metindir: 'H13' = kupa papazı (suit + rank). Hamleler:
//   { t:'ann', g:'kupa' }  /  { t:'ann', g:'koz', trump:'S' }  /  { t:'play', c:'H13' }
import { makeRng } from '../core/rng.js';

export const N = 4;
export const SUITS = ['S', 'H', 'D', 'C'];
export const PENALTIES = ['el', 'kupa', 'kiz', 'erkek', 'rifki', 'son2'];
export const GAME_NAMES = {
  koz: 'Koz',
  el: 'El Almaz',
  kupa: 'Kupa Almaz',
  kiz: 'Kız Almaz',
  erkek: 'Erkek Almaz',
  rifki: 'Rıfkı',
  son2: 'Son İki',
};
export const GAME_HINT = {
  koz: 'Aldığın her el +50',
  el: 'Aldığın her el −50',
  kupa: 'Aldığın her kupa −30',
  kiz: 'Aldığın her kız −100',
  erkek: 'Aldığın her vale/papaz −60',
  rifki: 'Kupa papazını alan −320',
  son2: 'Son iki eli alan −180 (her biri)',
};
export const SUIT_TR = { S: 'Maça', H: 'Kupa', D: 'Karo', C: 'Sinek' };
export const PEN_PER_PLAYER = 3;
export const KOZ_PER_PLAYER = 2;
export const PEN_LIMIT = 2; // her ceza türü toplamda en fazla 2 kez
export const DEALS = 20;

export const suitOf = (c) => c[0];
export const rankOf = (c) => +c.slice(1);
export const parseCard = (c) => ({ suit: c[0], rank: +c.slice(1), id: c });
export const sortCards = (cards) =>
  [...cards].sort((a, b) => SUITS.indexOf(a[0]) - SUITS.indexOf(b[0]) || rankOf(b) - rankOf(a));

const ALL = [];
for (const s of SUITS) for (let r = 2; r <= 14; r++) ALL.push(s + r);

function dealHands(seed, dealNo, redeal) {
  const rng = makeRng((seed + dealNo * 7919 + redeal * 104729) >>> 0);
  const deck = rng.shuffle([...ALL]);
  return Array.from({ length: N }, (_, p) => sortCards(deck.slice(p * 13, p * 13 + 13)));
}

function freshDeal(s, dealNo, redeal, keepGame) {
  const hands = dealHands(s.seed, dealNo, redeal);
  const first = s.first ?? hands.findIndex((h) => h.includes('D2'));
  const announcer = (first + dealNo) % N;
  return {
    ...s,
    first,
    dealNo,
    redeal,
    hands,
    announcer,
    phase: keepGame ? 'play' : 'announce',
    game: keepGame ? s.game : null,
    trick: [],
    leader: announcer,
    turn: announcer,
    trickNo: 0,
    taken: [[], [], [], []],
    tricksWon: [0, 0, 0, 0],
    last2: [0, 0, 0, 0],
    heartsOut: false,
    voids: [[], [], [], []],
    played: [],
    lastTrick: s.lastTrick,
  };
}

function beats(c, b, trump) {
  const cs = suitOf(c);
  const bs = suitOf(b);
  if (cs === bs) return rankOf(c) > rankOf(b);
  return !!trump && cs === trump;
}

function trickWinner(trick, trump) {
  let best = trick[0];
  for (let i = 1; i < trick.length; i++) if (beats(trick[i].card, best.card, trump)) best = trick[i];
  return best.seat;
}

const PEN_TOTAL = { kupa: 13, kiz: 4, erkek: 8, rifki: 1 };
function isPenCard(g, c) {
  switch (g) {
    case 'kupa':
      return c[0] === 'H';
    case 'kiz':
      return rankOf(c) === 12;
    case 'erkek':
      return rankOf(c) === 11 || rankOf(c) === 13;
    case 'rifki':
      return c === 'H13';
    default:
      return false;
  }
}

function dealDelta(s) {
  const g = s.game.g;
  return s.taken.map((t, p) => {
    switch (g) {
      case 'koz':
        return 50 * s.tricksWon[p];
      case 'el':
        return -50 * s.tricksWon[p];
      case 'kupa':
        return -30 * t.filter((c) => isPenCard('kupa', c)).length;
      case 'kiz':
        return -100 * t.filter((c) => isPenCard('kiz', c)).length;
      case 'erkek':
        return -60 * t.filter((c) => isPenCard('erkek', c)).length;
      case 'rifki':
        return t.includes('H13') ? -320 : 0;
      case 'son2':
        return -180 * s.last2[p];
      default:
        return 0;
    }
  });
}

function finishDeal(s) {
  const g = s.game.g;
  if (!s.horizon && g === 'kiz' && s.redeal < 5 && s.taken.every((t) => t.filter((c) => isPenCard('kiz', c)).length === 1)) {
    return freshDeal(s, s.dealNo, s.redeal + 1, true); // dört oyuncu da bir kız aldı: el yeniden dağıtılır
  }
  const delta = dealDelta(s);
  const totals = s.totals.map((v, i) => v + delta[i]);
  const sheet = s.horizon ? s.sheet : [...s.sheet, { n: s.dealNo, by: s.announcer, g, trump: s.game.trump, delta }];
  const kingBy = g === 'koz' && s.opts.kingEnds ? s.tricksWon.indexOf(13) : -1;
  const done = s.horizon || s.dealNo >= DEALS - 1 || kingBy >= 0;
  if (done) return { ...s, totals, sheet, kingBy, phase: 'over', trick: [], dealEnd: { delta, n: s.dealNo } };
  return { ...freshDeal({ ...s, totals, sheet }, s.dealNo + 1, 0, false), dealEnd: { delta, n: s.dealNo } };
}

function legalPlays(s, seat) {
  const hand = s.hands[seat];
  const g = s.game.g;
  const trump = s.game.trump;
  if (!s.trick.length) {
    if ((g === 'kupa' || g === 'rifki') && !s.heartsOut) {
      const non = hand.filter((c) => c[0] !== 'H');
      if (non.length) return non;
    }
    return hand;
  }
  const led = suitOf(s.trick[0].card);
  const follow = hand.filter((c) => c[0] === led);
  if (follow.length) return follow;
  if (g === 'koz') {
    const t = hand.filter((c) => c[0] === trump);
    return t.length ? t : hand;
  }
  if (g === 'kupa') {
    const h = hand.filter((c) => c[0] === 'H');
    return h.length ? h : hand;
  }
  if (g === 'rifki' && hand.includes('H13')) return ['H13'];
  return hand;
}

function legalAnnounces(s, seat) {
  const u = s.used[seat];
  const out = [];
  if (u.pen < PEN_PER_PLAYER) for (const g of PENALTIES) if (s.gameCount[g] < PEN_LIMIT) out.push({ t: 'ann', g });
  if (u.koz < KOZ_PER_PLAYER) for (const trump of SUITS) out.push({ t: 'ann', g: 'koz', trump });
  return out;
}

const game = {
  id: 'king',
  name: 'King',
  minPlayers: N,
  maxPlayers: N,

  createInitialState(config, rng) {
    const base = {
      seed: rng.int(2 ** 31),
      opts: { kingEnds: true, ...(config.king || {}) },
      first: null,
      used: Array.from({ length: N }, () => ({ pen: 0, koz: 0 })),
      gameCount: Object.fromEntries(PENALTIES.map((g) => [g, 0])),
      sheet: [],
      totals: [0, 0, 0, 0],
      kingBy: -1,
      horizon: false,
      dealEnd: null,
    };
    return freshDeal(base, 0, 0, false);
  },

  currentActor: (s) => (s.phase === 'announce' ? s.announcer : s.phase === 'play' ? s.turn : 0),

  legalMoves(s, seat) {
    if (s.phase === 'announce') return seat === s.announcer ? legalAnnounces(s, seat) : [];
    if (s.phase !== 'play' || seat !== s.turn) return [];
    return legalPlays(s, seat).map((c) => ({ t: 'play', c }));
  },

  viewFor(s, seat) {
    const { hands, seed, ...pub } = s;
    return { ...pub, seat, hand: [...hands[seat]], handSizes: hands.map((h) => h.length) };
  },

  applyMove(s, seat, move) {
    if (move.t === 'ann') {
      const used = s.used.map((u) => ({ ...u }));
      const gameCount = { ...s.gameCount };
      if (move.g === 'koz') used[seat].koz++;
      else {
        used[seat].pen++;
        gameCount[move.g]++;
      }
      return {
        ...s,
        used,
        gameCount,
        game: { g: move.g, trump: move.g === 'koz' ? move.trump : null },
        phase: 'play',
        turn: s.announcer,
        leader: s.announcer,
        dealEnd: null,
      };
    }
    const c = move.c;
    const hands = s.hands.slice();
    hands[seat] = s.hands[seat].filter((x) => x !== c);
    const trick = [...s.trick, { seat, card: c }];
    let voids = s.voids;
    if (s.trick.length && c[0] !== suitOf(s.trick[0].card) && !voids[seat].includes(suitOf(s.trick[0].card))) {
      voids = voids.slice();
      voids[seat] = [...voids[seat], suitOf(s.trick[0].card)];
    }
    const next = {
      ...s,
      hands,
      trick,
      voids,
      played: [...s.played, c],
      heartsOut: s.heartsOut || c[0] === 'H',
      dealEnd: null,
    };
    if (trick.length < N) return { ...next, turn: (seat + 1) % N };

    const w = trickWinner(trick, s.game.trump);
    const taken = s.taken.slice();
    taken[w] = [...taken[w], ...trick.map((t) => t.card)];
    const tricksWon = s.tricksWon.slice();
    tricksWon[w]++;
    const last2 = s.last2.slice();
    if (s.trickNo >= 11) last2[w]++;
    const after = {
      ...next,
      taken,
      tricksWon,
      last2,
      trick: [],
      trickNo: s.trickNo + 1,
      leader: w,
      turn: w,
      lastTrick: { cards: trick, winner: w, no: s.trickNo },
    };
    const g = s.game.g;
    let over = after.trickNo >= 13;
    if (!over && PEN_TOTAL[g]) {
      let k = 0;
      for (const t of taken) for (const x of t) if (isPenCard(g, x)) k++;
      over = k >= PEN_TOTAL[g];
    }
    return over ? finishDeal(after) : after;
  },

  isOver: (s) => s.phase === 'over',
  scores: (s) => [...s.totals],
  winners(s) {
    if (s.kingBy >= 0) return [s.kingBy];
    const w = s.totals.map((v, i) => (v >= 0 ? i : -1)).filter((i) => i >= 0);
    return w.length ? w : [s.totals.indexOf(Math.max(...s.totals))];
  },

  publicEvent(before, seat, move, after) {
    return {
      seat,
      move,
      trickDone: after.lastTrick && after.lastTrick !== before.lastTrick ? after.lastTrick : null,
      dealEnd: after.dealEnd,
    };
  },

  // ---- Bot yardımcıları ----------------------------------------------------------------------

  rateMove(view, move, ctx = {}) {
    return move.t === 'ann' ? rateAnnounce(view, move, ctx.risk ?? 0.5) : ratePlay(view, move);
  },

  rolloutMove(s, seat, moves, rng) {
    if (moves.length === 1 || s.phase !== 'play') return moves[0];
    const v = {
      seat,
      hand: s.hands[seat],
      trick: s.trick,
      played: s.played,
      voids: s.voids,
      game: s.game,
      trickNo: s.trickNo,
    };
    let best = moves[0];
    let bv = -Infinity;
    for (const m of moves) {
      const r = ratePlay(v, m) + rng.gauss() * 1.5;
      if (r > bv) {
        bv = r;
        best = m;
      }
    }
    return best;
  },

  /** Görünür bilgiyle uyumlu rastgele tam durum (Monte Carlo için). Yalnızca bu eli oynatır (horizon). */
  determinize(view, seat, rng) {
    const have = new Set([...view.hand, ...view.played]);
    const unseen = rng.shuffle(ALL.filter((c) => !have.has(c)));
    const others = [0, 1, 2, 3].filter((p) => p !== seat).sort((a, b) => view.voids[b].length - view.voids[a].length);
    const hands = Array(N);
    hands[seat] = [...view.hand];
    let pool = unseen;
    others.forEach((p, idx) => {
      const need = view.handSizes[p];
      let mine;
      if (idx === others.length - 1) mine = pool.slice(0, need);
      else {
        const ok = pool.filter((c) => !view.voids[p].includes(suitOf(c)));
        mine = ok.slice(0, need);
        if (mine.length < need) mine = [...mine, ...pool.filter((c) => !mine.includes(c)).slice(0, need - mine.length)];
      }
      const set = new Set(mine);
      pool = pool.filter((c) => !set.has(c));
      hands[p] = sortCards(mine);
    });
    const { seat: _s, hand: _h, handSizes: _hs, ...rest } = view;
    return { ...rest, hands, seed: rng.int(2 ** 31), horizon: true };
  },
};

// ---- Sezgiler -------------------------------------------------------------------------------

function unseenBy(v) {
  if (v._unseen) return v._unseen;
  const have = new Set([...v.hand, ...v.played]);
  const out = { S: [], H: [], D: [], C: [] };
  for (const c of ALL) if (!have.has(c)) out[c[0]].push(rankOf(c));
  v._unseen = out;
  return out;
}

const P23 = (n) => Math.pow(2 / 3, n);

/** Bu kartı oynarsam bu eli alma olasılığı (yaklaşık). */
function winProb(v, c) {
  const trump = v.game.g === 'koz' ? v.game.trump : null;
  const led = v.trick.length ? suitOf(v.trick[0].card) : suitOf(c);
  for (const t of v.trick) if (beats(t.card, c, trump)) return 0;
  if (suitOf(c) !== led && suitOf(c) !== trump) return 0; // renk atamıyorum, eli alamam
  const k = 3 - v.trick.length;
  if (k <= 0) return 1;
  const un = unseenBy(v);
  const cs = suitOf(c);
  const r = rankOf(c);
  let pnot = 1;
  for (let i = 1; i <= k; i++) {
    const p = (v.seat + i) % N;
    const knownVoid = v.voids[p].includes(led);
    const nLed = un[led].length;
    let pBeat = 0;
    if (cs === led) {
      const hHigh = un[led].filter((x) => x > r).length;
      const pFollow = knownVoid ? 0 : 1 - P23(nLed);
      pBeat = pFollow * (hHigh ? 1 - P23(hHigh) : 0);
      if (trump && led !== trump) pBeat += (1 - pFollow) * (1 - P23(un[trump].length));
    } else {
      const hHigh = un[trump].filter((x) => x > r).length;
      pBeat = (knownVoid ? 1 : P23(nLed)) * (1 - P23(hHigh));
    }
    pnot *= 1 - Math.min(1, pBeat);
  }
  return pnot;
}

function cardPen(g, c) {
  if (g === 'rifki') return c === 'H13' ? 8 : 0;
  return isPenCard(g, c) ? 1 : 0;
}

function ratePlay(v, move) {
  const c = move.c;
  const s = suitOf(c);
  const r = rankOf(c);
  const g = v.game.g;
  const pw = winProb(v, c);
  if (g === 'koz') {
    const trump = v.game.trump;
    let val = 10 * pw - 0.35 * r - (s === trump ? 2 : 0);
    if (!v.trick.length && s === trump) {
      const mine = v.hand.filter((x) => x[0] === trump).length;
      val += mine >= 5 ? 3 : -1;
    }
    return val;
  }
  const base = g === 'el' ? 1 : g === 'son2' ? (v.trickNo >= 11 ? 1 : 0) : 0;
  let pen = base + cardPen(g, c);
  for (const t of v.trick) pen += cardPen(g, t.card);
  let val = -10 * pw * pen + 0.4 * r + 8 * (1 - pw) * cardPen(g, c);
  if (g === 'son2' && v.trickNo < 11) val += 0.7 * r; // yüksek kartları erken harca
  return val;
}

// Ortalama ele göre avantaj: baseline[g] rastgele elde ortalama değerdir (tests/ ile hesaplandı).
const BASELINE = { koz: 160, el: -150, kupa: -100, kiz: -115, erkek: -130, rifki: -80, son2: -150 };

function rateAnnounce(v, move, risk) {
  const hand = v.hand;
  const bySuit = { S: [], H: [], D: [], C: [] };
  for (const c of hand) bySuit[c[0]].push(rankOf(c));
  const W = { 14: 0.85, 13: 0.55, 12: 0.3, 11: 0.12 };
  const honors = hand.reduce((a, c) => a + (W[rankOf(c)] || 0), 0);
  let ev;
  const g = move.g;
  if (g === 'el') ev = -50 * (3.25 + (honors - 1.82) * 1.8);
  else if (g === 'son2') ev = -180 * Math.max(0.2, 2 * (0.25 + 0.1 * (honors - 1.82)));
  else if (g === 'kupa') {
    const h = bySuit.H;
    let sum = h.reduce((a, r) => a + 0.12 + (0.8 * (r - 2)) / 12, 0);
    if (h.length >= 5) sum *= 1.25;
    ev = -30 * 2.5 * sum;
  } else if (g === 'kiz') {
    let sum = 0;
    for (const sU of SUITS) {
      const rs = bySuit[sU];
      if (!rs.includes(12)) continue;
      let p = rs.length <= 3 ? 0.65 : 0.35;
      if (rs.includes(14) || rs.includes(13)) p -= 0.1;
      sum += p;
    }
    ev = -100 * (2 * sum + 0.4);
  } else if (g === 'erkek') {
    let sum = 0;
    for (const sU of SUITS) {
      const rs = bySuit[sU];
      for (const r of [11, 13]) {
        if (!rs.includes(r)) continue;
        let p = r === 13 ? 0.55 : 0.4;
        if (rs.length <= 2) p += 0.15;
        else if (rs.length >= 4) p -= 0.15;
        sum += p;
      }
    }
    ev = -60 * (1.7 * sum + 0.8);
  } else if (g === 'rifki') {
    const h = bySuit.H;
    if (h.includes(13)) ev = -320 * (h.length <= 3 ? 0.8 : h.length >= 6 ? 0.15 : 0.45);
    else ev = -320 * 0.12;
  } else {
    const t = bySuit[move.trump];
    let T = 0.45 * t.length + (t.includes(14) ? 0.5 : 0) + (t.includes(13) ? 0.35 : 0) + (t.includes(12) ? 0.2 : 0);
    for (const sU of SUITS) {
      if (sU === move.trump) continue;
      const rs = bySuit[sU];
      if (rs.includes(14)) T += 0.75;
      if (rs.includes(13) && rs.length >= 2) T += 0.3;
      if (rs.length <= 1) T += t.length >= 3 ? 0.6 : 0.25;
    }
    ev = 50 * T;
  }
  const adv = ev - BASELINE[g];
  return g === 'koz' ? adv * (0.8 + 0.4 * risk) : adv;
}

export default game;

// Yönerge (js/ui/tutor.js) için
export { winProb as kingWinProb, cardPen as kingCardPen, isPenCard as kingIsPen };
