// At Yarışı masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Masa: üstte deste, altında dört kulvar (maça, kupa, karo, sinek); her kulvarın başında o ata oynayanlar.
// Koreografi: herkes atını ve bahsini seçer → kartlar desteden tek tek açılarak kendi kulvarına uçar (at bir adım
// ilerler) → 13. kartı gelen at bitişi geçer, kulvarı çerçevelenir → çipler yazılır → kartlar desteye toplanır.
import ay, { PAYOUT } from '../games/atyarisi.js';
import { createMatchScreen } from './table-kit.js';

const LANES = [['S', '♠', 'Maça'], ['H', '♥', 'Kupa'], ['D', '♦', 'Karo'], ['C', '♣', 'Sinek']];
const NAME = Object.fromEntries(LANES.map(([s, , n]) => [s, n]));
const SYM = Object.fromEntries(LANES.map(([s, y]) => [s, y]));
const money = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

export function createAtyarisiScreen(deps) {
  const { h, settings } = deps;
  let disp = null; // { lanes:{S:[],...}, bets, chips, msg, winner, net, round }
  let pickSuit = null;

  return createMatchScreen(deps, {
    yazboz: false,
    chance: true,
    title: 'At Yarışı',
    game: ay,
    players: () => settings.get('atyarisiPlayers'),
    askPlayers: { key: 'atyarisiPlayers', options: [2, 3, 4] },
    maxThink: 500,
    reset() {
      disp = null;
      pickSuit = null;
    },
    async onMove(e, ctx, before) {
      const re = e.event.roundEnd;
      if (!re) return;
      const { A } = ctx;
      pickSuit = null;
      disp = { lanes: { S: [], H: [], D: [], C: [] }, bets: re.bets, chips: before.chips, round: re.round, msg: 'Atlar çıkışta… Koşu başladı!' };
      ctx.render();
      await ctx.wait(700);
      for (let k = 0; k < re.seq.length; k++) {
        const c = re.seq[k];
        disp.lanes[c[0]] = [...disp.lanes[c[0]], c];
        const lead = Object.entries(disp.lanes).sort((a, b) => b[1].length - a[1].length)[0];
        if (k > 8 && k % 6 === 0) disp.msg = `Önde ${NAME[lead[0]]} (${lead[1].length}/13)`;
        ctx.pend.add(c);
        ctx.render();
        const last = k === re.seq.length - 1;
        await ctx.fly(c, ctx.deckBox(), ctx.cardBox(c), { reveal: true, duration: A.dur(last ? 380 : 190), easing: A.EASE.land });
        ctx.reveal(c);
        if (!last) await ctx.wait(35);
      }
      disp.winner = re.winner;
      const mine = re.bets[0];
      disp.msg = `${NAME[re.winner]} kazandı!${mine ? (mine.suit === re.winner ? ` Senin atın! +${mine.v * PAYOUT}` : ` Senin atın ${NAME[mine.suit]}.`) : ''}`;
      ctx.render();
      await ctx.wait(900);
      disp.chips = re.chips;
      disp.net = re.net;
      ctx.render();
      await ctx.wait(1700);
      const ids = Object.values(disp.lanes).flat();
      const to = ctx.deckBox();
      await Promise.all(ids.map((id, k) => {
        const from = ctx.cardBox(id);
        ctx.hide(id);
        return A.fly(ctx.cardEl(ctx.parseCard(id)), from, to, { duration: A.dur('collect'), easing: A.EASE.leave, delay: k * 12, fadeEnd: true, silent: k > 0 });
      }));
      disp = null;
    },

    render(ctx) {
      const s = ctx.state;
      const d = disp;
      const chips = d ? d.chips : s.chips;
      const bets = d ? d.bets : s.bets;
      const lanes = d ? d.lanes : { S: [], H: [], D: [], C: [] };
      const out = Object.values(lanes).flat();
      const inFlight = out.filter((c) => ctx.pend.has(c)).length;
      const backers = (su) => bets.map((b, i) => (b && b.suit === su ? i : -1)).filter((i) => i >= 0);
      const area = h('div', { class: 'center race' },
        h('div', { class: 'rtop' }, ctx.deck(52 - out.length + inFlight), h('div', { class: 'rmsg' }, d ? d.msg : ' ')),
        h('div', { class: 'lanes' }, LANES.map(([su, sym]) => h('div', { class: `lane${d?.winner === su ? ' won' : ''}${su === 'H' || su === 'D' ? ' red' : ''}` },
          h('div', { class: 'lhead' }, h('span', { class: 'lsym' }, sym), h('span', { class: 'lwho' }, backers(su).map((i) => (i === 0 ? 'Sen' : ctx.name(i))).join(', '))),
          h('div', { class: 'track' },
            lanes[su].map((c, k) => h('div', { class: `rc2${ctx.pend.has(c) ? ' pend' : ''}`, 'data-card': c, style: `left:calc(${k} * (100% - var(--rw)) / 12);z-index:${k + 1}` }, ctx.cardEl(ctx.parseCard(c)))),
            h('div', { class: 'finish' }))))));
      const mine = ctx.awaiting && !d && s.turn === 0 && s.phase === 'bet';
      const round = d ? d.round : s.round;
      const head = d ? (d.net ? (d.net[0] ? `Bu el: ${money(d.net[0])} çip` : 'Bu el oynamadın') : 'Koşu') : s.phase === 'over' ? 'Oyun bitti' : mine ? 'Atını ve bahsini seç' : `${ctx.name(s.turn)} atını seçiyor`;
      const info = h('div', { class: 'kinfo' },
        h('div', {}, `El ${Math.min(round + 1, s.rounds)}/${s.rounds}`),
        h('div', { class: 'kg' }, head),
        h('div', { class: 'sub' }, bets[0] ? `Atın: ${SYM[bets[0].suit]} ${NAME[bets[0].suit]} · ${bets[0].v}` : `Kazanan ata oynayan bahsin ${PAYOUT} katını alır`),
        h('div', { class: 'tot' }, `Çipin: ${chips[0]}`));
      const res = [ctx.table({
        area, info,
        chipSub: (i) => (d?.net ? `${chips[i]} (${money(d.net[i])})` : bets[i] ? `${SYM[bets[i].suit]} ${bets[i].v} · ${chips[i]}` : `${chips[i]} çip`),
        chipCls: (i) => (!d && s.phase !== 'over' && s.turn === i ? 'turn' : ''),
      })];
      if (mine) {
        const moves = ay.legalMoves(s, 0);
        res.push(h('div', { class: 'announce panel kpick' },
          h('b', {}, pickSuit ? `${NAME[pickSuit]} atına ne kadar?` : 'Hangi ata oynuyorsun?'),
          h('div', { class: 'ksuits' }, LANES.map(([su, sym, nm]) => h('button', {
            class: `btn${pickSuit === su ? ' on' : ''}${su === 'H' || su === 'D' ? ' red' : ''}`,
            onclick: () => {
              pickSuit = su;
              ctx.render();
            },
          }, `${sym} ${nm}`))),
          pickSuit ? h('div', { class: 'pgrid' }, moves.filter((m) => m.suit === pickSuit).map((m) => h('button', { class: 'btn', onclick: () => ctx.respond(m) }, String(m.v)))) : null));
      }
      return res;
    },

    endHead: (w, ctx, res) => (w.includes(0) ? 'Kazandın!' : 'Oyun bitti'),
    fmtScore: (sc) => `${sc} çip`,
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, 'Her elde herkes bir renge (ata) oynar: maça, kupa, karo ya da sinek; bahis 50, 100 ya da 200. Aynı ata birden çok kişi oynayabilir.'),
      h2('p', {}, 'Karılmış deste tek tek açılır, her kart kendi renginin kulvarına dizilir. 13 kartı ilk tamamlanan at kazanır.'),
      h2('p', {}, `Kazanan ata oynayan bahsinin ${PAYOUT} katını kazanır, diğerleri bahsini kaybeder. Dört atın şansı eşittir. 10 el sonunda çipi çok olan kazanır.`)),
  });
}
