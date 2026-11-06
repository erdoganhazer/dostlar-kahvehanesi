// Sadece test için: "Sayı Düellosu". 3 oyuncu, 1..21 kartları, herkes 7 kart alır, 7 el oynanır.
// Her elde en yüksek kart bir puan alır ve sonraki eli o açar. Gizli bilgi (rakip eli) vardır,
// yani bot sisteminin determinize/Monte Carlo yolunu da sınar.
const N = 3;
const HAND = 7;

const game = {
  id: 'dummy',
  name: 'Sayı Düellosu',
  minPlayers: N,
  maxPlayers: N,

  createInitialState(config, rng) {
    const deck = rng.shuffle(Array.from({ length: N * HAND }, (_, i) => i + 1));
    const hands = Array.from({ length: N }, (_, p) => deck.slice(p * HAND, (p + 1) * HAND).sort((a, b) => a - b));
    return { hands, trick: [], played: [], leader: 0, turn: 0, points: Array(N).fill(0), round: 0 };
  },
  currentActor: (s) => s.turn,
  legalMoves: (s, seat) => s.hands[seat].map((c) => ({ card: c })),
  viewFor(s, seat) {
    return {
      seat,
      hand: [...s.hands[seat]],
      handSizes: s.hands.map((h) => h.length),
      trick: s.trick.map((t) => ({ ...t })),
      played: [...s.played],
      points: [...s.points],
      leader: s.leader,
      turn: s.turn,
      round: s.round,
    };
  },
  applyMove(s, seat, move) {
    const hands = s.hands.map((h) => [...h]);
    hands[seat] = hands[seat].filter((c) => c !== move.card);
    const trick = [...s.trick, { seat, card: move.card }];
    const played = [...s.played, move.card];
    if (trick.length < N) {
      return { ...s, hands, trick, played, turn: (seat + 1) % N };
    }
    const win = trick.reduce((a, b) => (b.card > a.card ? b : a));
    const points = [...s.points];
    points[win.seat] += 1;
    return { hands, trick: [], played, leader: win.seat, turn: win.seat, points, round: s.round + 1 };
  },
  isOver: (s) => s.round >= HAND,
  scores: (s) => [...s.points],

  rateMove(view, move) {
    const c = move.card;
    if (!view.trick.length) return c; // açarken yüksek
    const best = Math.max(...view.trick.map((t) => t.card));
    return c > best ? 100 - c : 50 - c; // alacaksa en küçüğüyle al, alamıyorsa en küçüğünü at
  },
  determinize(view, seat, rng) {
    const known = new Set([...view.hand, ...view.played, ...view.trick.map((t) => t.card)]);
    const unseen = [];
    for (let c = 1; c <= N * HAND; c++) if (!known.has(c)) unseen.push(c);
    rng.shuffle(unseen);
    const hands = [];
    let k = 0;
    for (let p = 0; p < N; p++) {
      if (p === seat) hands.push([...view.hand]);
      else {
        hands.push(unseen.slice(k, k + view.handSizes[p]));
        k += view.handSizes[p];
      }
    }
    return {
      hands,
      trick: view.trick.map((t) => ({ ...t })),
      played: [...view.played],
      leader: view.leader,
      turn: view.turn,
      points: [...view.points],
      round: view.round,
    };
  },
};

export default game;
