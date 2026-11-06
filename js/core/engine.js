// Masa motoru: bir oyunu, koltuklardaki insan ve botlarla baştan sona oynatır.
import { defaultMoveKey, validateGame, winnersOf } from './game-api.js';

/**
 * seats: [{ kind: 'human', name }, { kind: 'bot', bot: Bot, id, name }, ...]
 * pace:  async (seatInfo) => void   botlar düşünürken beklemek için (testte verilmez)
 * onEvent: ({type, seat, move, state, event}) => void   arayüz bu olayları dinler
 */
export class Table {
  constructor({ game, seats, rng, config = {}, pace = null, onEvent = () => {} }) {
    this.game = validateGame(game);
    this.seats = seats;
    this.rng = rng;
    this.config = { players: seats.length, ...config };
    this.pace = pace;
    this.onEvent = onEvent;
    if (seats.length < game.minPlayers || seats.length > game.maxPlayers) {
      throw new Error(`${game.name} ${game.minPlayers}-${game.maxPlayers} oyuncu ister, ${seats.length} verildi`);
    }
  }

  async play({ askHuman } = {}) {
    const { game, seats, rng } = this;
    const key = game.moveKey || defaultMoveKey;
    let state = game.createInitialState(this.config, rng);
    for (const s of seats) if (s.kind === 'bot') s.bot.newMatch(game);
    await this.onEvent({ type: 'start', state }); // açılış dağıtımı bitmeden ilk hamle istenmez

    let guard = 0;
    while (!game.isOver(state)) {
      if (++guard > 100000) throw new Error('Oyun bitmedi (sonsuz döngü koruması)');
      const seat = game.currentActor(state);
      const info = seats[seat];
      const view = game.viewFor(state, seat);
      const moves = game.legalMoves(state, seat);
      if (!moves.length) throw new Error(`Koltuk ${seat} için yasal hamle yok`);

      let move;
      if (info.kind === 'bot') {
        if (this.pace) await this.pace(info, { seat, moves, view });
        move = await info.bot.choose({ game, view, moves, seat, rng });
      } else {
        if (!askHuman) throw new Error('İnsan oyuncu için askHuman verilmedi');
        move = await askHuman({ seat, view, moves, state });
      }

      const legal = moves.some((m) => key(m) === key(move));
      if (!legal) throw new Error(`Koltuk ${seat} yasal olmayan hamle seçti: ${key(move)}`);

      const before = state;
      state = game.applyMove(state, seat, move);
      const event = game.publicEvent ? game.publicEvent(before, seat, move, state) : { seat, move };
      for (let i = 0; i < seats.length; i++) {
        if (seats[i].kind === 'bot') {
          seats[i].bot.observe(game, event, game.viewFor(state, i));
        }
      }
      await this.onEvent({ type: 'move', seat, move, event, state });
    }

    const scores = game.scores(state);
    const winners = winnersOf(game, state);
    this.onEvent({ type: 'end', state, scores, winners });
    return { state, scores, winners };
  }
}
