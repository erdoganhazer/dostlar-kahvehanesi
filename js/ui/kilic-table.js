// Kılıç masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: söyleyen bahsi ve kartı söyler (kart sağda gösterilir) → desteden kartlar tek tek, açılarak,
// bir söyleyenin bir rakibin önüne uçar → söylenen kart düşünce durur, kimin önüne düştüğü yazılır, çip el değiştirir
// → kartlar desteye toplanır.
import kilic from '../games/kilic.js';
import { createMatchScreen } from './table-kit.js';
import { cardText } from './tutor.js';

const SUITS = [['S', '♠', 'Maça'], ['H', '♥', 'Kupa'], ['D', '♦', 'Karo'], ['C', '♣', 'Sinek']];
const RANKS = [[14, 'A'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7'], [8, '8'], [9, '9'], [10, '10'], [11, 'J'], [12, 'Q'], [13, 'K']];
const SHOW = 7; // her yığında görünen son kart sayısı

export function createKilicScreen(deps) {
  const { h } = deps;
  let disp = null; // { piles:[[],[]], named, chooser, bet, chips, msg, round }
  let pickSuit = null;

  const pileNodes = (ctx, pile, seat) => {
    const { jitter } = ctx.A;
    const dy = seat === 0 ? 62 : -62;
    return pile.slice(-SHOW).map((c, k) => {
      const j = jitter(c, 10);
      return ctx.pileCard(c, { dx: j.dx - 8, dy: dy + j.dy * 0.5, rot: j.rot, z: 10 + k });
    });
  };

  async function reveal(ctx, re) {
    const { A } = ctx;
    const other = 1 - re.chooser;
    for (let k = 0; k < re.seq.length; k++) {
      const c = re.seq[k];
      const to = k % 2 === 0 ? re.chooser : other;
      disp.piles[to] = [...disp.piles[to], c];
      ctx.pend.add(c);
      ctx.render();
      const last = k === re.seq.length - 1;
      await ctx.fly(c, ctx.deckBox(), ctx.cardBox(c), { reveal: true, duration: A.dur(last ? 420 : 230), easing: A.EASE.land });
      ctx.reveal(c);
      if (!last) await ctx.wait(70);
    }
  }

  return createMatchScreen(deps, {
    yazboz: false,
    chance: true,
    title: 'Kılıç',
    game: kilic,
    players: () => 2,
    maxThink: 600,
    reset() {
      disp = null;
      pickSuit = null;
    },
    async onMove(e, ctx, before) {
      const re = e.event.roundEnd;
      if (e.move.t === 'bet') return;
      if (!re) return;
      pickSuit = null;
      disp = { piles: [[], []], named: re.named, chooser: re.chooser, bet: re.bet, chips: before.chips, round: re.round, msg: `${ctx.name(re.chooser)}: "${cardText(re.named)}" dedi.` };
      ctx.render();
      await ctx.wait(e.seat === 0 ? 'pause' : 900);
      disp.msg = 'Kartlar açılıyor…';
      ctx.render();
      await reveal(ctx, re);
      disp.msg = `${cardText(re.named)} ${re.winner === 0 ? 'senin önüne düştü!' : `${ctx.name(re.winner)} önüne düştü.`}`;
      disp.hit = re.named;
      ctx.render();
      await ctx.wait(700);
      disp.chips = re.chips;
      disp.msg += re.winner === 0 ? ` +${re.bet} çip` : ` −${re.bet} çip`;
      ctx.render();
      await ctx.wait(1500);
      // kartlar desteye
      const ids = [...disp.piles[0].slice(-SHOW), ...disp.piles[1].slice(-SHOW)];
      const to = ctx.deckBox();
      await Promise.all(ids.map((id, k) => {
        const from = ctx.cardBox(id);
        ctx.hide(id);
        return ctx.A.fly(ctx.cardEl(ctx.parseCard(id)), from, to, { duration: ctx.A.dur('collect'), easing: ctx.A.EASE.leave, delay: k * 25, fadeEnd: true, silent: k > 0 });
      }));
      disp = null;
    },

    render(ctx) {
      const s = ctx.state;
      const d = disp;
      const chips = d ? d.chips : s.chips;
      const piles = d ? d.piles : [[], []];
      const named = d ? d.named : null;
      const shown = piles[0].length + piles[1].length;
      const nodes = [...pileNodes(ctx, piles[1], 1), ...pileNodes(ctx, piles[0], 0)];
      const namedNode = named
        ? h('div', { class: `kilicnamed${d.hit ? ' hit' : ''}` }, h('span', { class: 'kl' }, 'Söylenen'), ctx.cardEl(ctx.parseCard(named)))
        : null;
      const area = h('div', { class: 'center kilic' }, ctx.deck(52 - shown + piles.flat().filter((c) => ctx.pend.has(c)).length), nodes, namedNode,
        piles[0].length || piles[1].length ? h('div', { class: 'cnt' }, `${piles[1].length} · ${piles[0].length}`) : null);
      const mine = ctx.awaiting && !d && s.turn === 0;
      const round = d ? d.round : s.round;
      const pot = d ? d.bet : s.bet;
      const head = d ? d.msg
        : s.phase === 'over' ? 'Oyun bitti'
          : mine ? (s.phase === 'bet' ? 'Bahsini seç' : 'Bir kart söyle')
            : `${ctx.name(s.turn)} ${s.phase === 'bet' ? 'bahsini düşünüyor' : 'kartını seçiyor'}`;
      const info = h('div', { class: 'kinfo' },
        h('div', {}, `El ${Math.min(round + 1, s.rounds)}/${s.rounds}`),
        h('div', { class: 'kg' }, head),
        h('div', { class: 'sub' }, pot ? `Bahis: ${pot}` : ' '),
        h('div', { class: 'tot' }, `Çipin: ${chips[0]}`));
      const out = [ctx.table({
        area, info,
        chipSub: (i) => `${chips[i]} çip`,
        chipCls: (i) => (!d && s.phase !== 'over' && s.turn === i ? 'turn' : ''),
      })];
      if (mine && s.phase === 'bet') {
        const moves = kilic.legalMoves(s, 0);
        out.push(h('div', { class: 'announce panel' }, h('b', {}, 'Bu el ne kadarına oynuyoruz?'),
          h('div', { class: 'pgrid' }, moves.map((m) => h('button', { class: 'btn', onclick: () => ctx.respond(m) }, String(m.v))))));
      }
      if (mine && s.phase === 'name') {
        out.push(h('div', { class: 'announce panel kpick' },
          h('b', {}, pickSuit ? 'Hangi kart?' : 'Önce rengini seç'),
          h('div', { class: 'ksuits' }, SUITS.map(([su, sym, nm]) => h('button', {
            class: `btn${pickSuit === su ? ' on' : ''}${su === 'H' || su === 'D' ? ' red' : ''}`,
            'aria-label': nm,
            onclick: () => {
              pickSuit = su;
              ctx.render();
            },
          }, `${sym} ${nm}`))),
          pickSuit ? h('div', { class: 'kranks' }, RANKS.map(([r, t]) => h('button', {
            class: `btn${pickSuit === 'H' || pickSuit === 'D' ? ' red' : ''}`,
            onclick: () => ctx.respond({ t: 'name', c: `${pickSuit}${r}` }),
          }, t))) : null));
      }
      return out;
    },

    endHead: (w, ctx, res) => (res.scores[0] > res.scores[1] ? 'Kazandın!' : res.scores[0] === res.scores[1] ? 'Berabere' : `${ctx.name(1)} kazandı`),
    fmtScore: (sc) => `${sc} çip`,
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, 'İki kişiyle oynanan kahvehane kumarı. Her elde sırayla biri bahsi (50, 100, 200) ve bir kart söyler: "Sinek 7" gibi.'),
      h2('p', {}, 'Karılmış deste bir söyleyenin, bir rakibinin önüne tek tek açılır. Söylenen kart kimin önüne düşerse bahsi o kazanır.'),
      h2('p', {}, 'Hangi kartı söylesen şansın aynıdır: yarı yarıya. 10 el sonunda çipi çok olan kazanır; biri batarsa oyun erken biter.')),
  });
}
