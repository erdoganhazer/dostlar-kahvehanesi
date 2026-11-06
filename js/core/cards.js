// Kart modeli. Kartlar düz nesnedir ve JSON'a çevrilebilir.
// suit: 'S' maça, 'H' kupa, 'D' karo, 'C' sinek, 'J' joker
// rank: 2..10, 11 vale, 12 kız, 13 papaz, 14 as (joker için 0)
export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣', J: '★' };
export const SUIT_NAME_TR = { S: 'Maça', H: 'Kupa', D: 'Karo', C: 'Sinek', J: 'Joker' };
export const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 0: '★' };
export const RANK_NAME_TR = { 11: 'Vale', 12: 'Kız', 13: 'Papaz', 14: 'As', 0: 'Joker' };

export const isRed = (card) => card.suit === 'H' || card.suit === 'D';
export const rankLabel = (card) => RANK_LABEL[card.rank] ?? String(card.rank);
export const cardLabel = (card) => `${SUIT_SYMBOL[card.suit]}${rankLabel(card)}`;

/** decks: kaç deste, jokers: deste başına değil toplam joker sayısı. */
export function createDeck({ decks = 1, jokers = 0, minRank = 2 } = {}) {
  const out = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (let rank = minRank; rank <= 14; rank++) {
        out.push({ suit, rank, deck: d, id: `${suit}${rank}-${d}` });
      }
    }
  }
  for (let j = 0; j < jokers; j++) out.push({ suit: 'J', rank: 0, deck: j % decks, id: `J-${j}` });
  return out;
}

/** Desteyi sırayla dağıtır. Kalan kartlar `rest` olarak döner. */
export function deal(deck, players, perPlayer) {
  const hands = Array.from({ length: players }, () => []);
  let i = 0;
  for (let r = 0; r < perPlayer; r++) {
    for (let p = 0; p < players; p++) hands[p].push(deck[i++]);
  }
  return { hands, rest: deck.slice(i) };
}

export function sortHand(hand, suitOrder = ['S', 'H', 'C', 'D', 'J']) {
  return [...hand].sort(
    (a, b) => suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit) || b.rank - a.rank
  );
}
