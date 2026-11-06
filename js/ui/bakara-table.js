// Bakara masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: herkes bahsini koyar → oyuncu eli, kasa eli, oyuncu eli, kasa eli (açık) → gerekiyorsa üçüncü kartlar
// (bir nefes arayla) → kazanan el yazılır, çipler → kartlar desteye.
import bk, { total } from '../games/bakara.js';
import { createMatchScreen } from './table-kit.js';
import { cardRow, label, dealIn, dealAll, collect, money } from './kasa-kit.js';

const ON = { p: 'Oyuncu eli', b: 'Kasa eli', t: 'Beraberlik' };
const SHORT = { p: 'Oyuncu', b: 'Kasa', t: 'Beraber' };

export function createBakaraScreen(deps) {
  const { h, settings } = deps;
  let disp = null; // { p:[], b:[], bets, chips, msg, net, winner, round }
  let pickOn = null;

  return createMatchScreen(deps, {
    yazboz: false,
    wonByScore: (res) => res.scores[0] > 1000,
    title: 'Bakara',
    game: bk,
    players: () => settings.get('bakaraPlayers'),
    askPlayers: { key: 'bakaraPlayers', options: [1, 2, 3, 4] },
    maxThink: 450,
    reset() {
      disp = null;
      pickOn = null;
    },
    async onMove(e, ctx, before) {
      const re = e.event.roundEnd;
      if (!re) return;
      pickOn = null;
      disp = { p: [], b: [], bets: re.bets, chips: before.chips, round: re.round, msg: 'Kartlar geliyor' };
      const first = re.seq.slice(0, 4);
      for (const x of first) {
        disp[x.who].push(x.c);
        ctx.pend.add(x.c);
      }
      ctx.render();
      await dealAll(ctx, first.map((x) => x.c));
      disp.msg = Math.max(total(re.p.slice(0, 2)), total(re.b.slice(0, 2))) >= 8 ? 'Natürel! Kimse çekmez.' : '';
      ctx.render();
      for (const x of re.seq.slice(4)) {
        await ctx.wait(650);
        disp.msg = `${ON[x.who]} üçüncü kartı çekiyor`;
        disp[x.who].push(x.c);
        ctx.pend.add(x.c);
        ctx.render();
        await dealIn(ctx, x.c);
      }
      await ctx.wait('pause');
      disp.winner = re.winner;
      disp.msg = re.winner === 't' ? `Beraberlik! ${re.pt} – ${re.bt}` : `${ON[re.winner]} kazandı: ${re.winner === 'p' ? re.pt : re.bt} – ${re.winner === 'p' ? re.bt : re.pt}`;
      ctx.render();
      await ctx.wait(900);
      disp.chips = re.chips;
      disp.net = re.net;
      ctx.render();
      await ctx.wait(1500);
      await collect(ctx);
      disp = null;
    },

    render(ctx) {
      const s = ctx.state;
      const d = disp;
      const chips = d ? d.chips : s.chips;
      const bets = d ? d.bets : s.bets;
      const tot = (ids) => {
        const v = ids.filter((c) => !ctx.pend.has(c));
        return v.length ? String(total(v)) : '';
      };
      const side = (key) => h('div', { class: `bkside${d?.winner === key || (d?.winner === 't' && key !== 't') ? ' won' : ''}` },
        h('div', { class: 'bkl' }, ON[key], h('b', {}, d ? tot(d[key]) : '')),
        cardRow(ctx, d ? d[key] : []));
      const backers = (on) => bets.map((b, i) => (b && b.on === on ? (i === 0 ? 'Sen' : ctx.name(i)) : null)).filter(Boolean).join(', ');
      const area = h('div', { class: 'center bjarea bkarea' }, ctx.deck(52 - (d ? d.p.length + d.b.length - [...d.p, ...d.b].filter((c) => ctx.pend.has(c)).length : 0)),
        h('div', { class: 'bkmsg' }, d ? d.msg : ' '),
        h('div', { class: 'bkhands' }, side('p'), side('b')),
        h('div', { class: 'bkbets' }, ['p', 'b', 't'].map((on) => h('div', { class: `bkb${d?.winner === on ? ' won' : ''}` }, h('b', {}, SHORT[on]), h('span', {}, backers(on) || '—')))));
      const mine = ctx.awaiting && !d && s.turn === 0 && s.phase === 'bet';
      const round = d ? d.round : s.round;
      const head = d ? (d.net ? (d.net[0] ? `Bu el: ${money(d.net[0])} çip` : bets[0] ? 'Bahsin iade' : ' ') : 'El oynanıyor') : s.phase === 'over' ? 'Oyun bitti' : mine ? 'Bahsini koy' : `${ctx.name(s.turn)} bahsini düşünüyor`;
      const info = h('div', { class: 'kinfo' },
        h('div', {}, `El ${Math.min(round + 1, s.rounds)}/${s.rounds}`),
        h('div', { class: 'kg' }, head),
        h('div', { class: 'sub' }, bets[0] ? `Bahsin: ${ON[bets[0].on]} · ${bets[0].v}` : 'Oyuncu 1:1 · Kasa 1:1 (−%5) · Beraberlik 8:1'),
        h('div', { class: 'tot' }, `Çipin: ${chips[0]}`));
      const out = [ctx.table({
        area, info,
        chipSub: (i) => (d?.net ? `${chips[i]} (${money(d.net[i])})` : bets[i] ? `${SHORT[bets[i].on]} ${bets[i].v} · ${chips[i]}` : `${chips[i]} çip`),
        chipCls: (i) => (!d && s.phase !== 'over' && s.turn === i ? 'turn' : ''),
      })];
      if (mine) {
        const moves = bk.legalMoves(s, 0);
        out.push(h('div', { class: 'announce panel kpick' },
          h('b', {}, pickOn ? `${ON[pickOn]}: ne kadar?` : 'Hangi ele oynuyorsun?'),
          h('div', { class: 'ksuits three' }, ['p', 'b', 't'].map((on) => h('button', {
            class: `btn${pickOn === on ? ' on' : ''}`,
            onclick: () => {
              pickOn = on;
              ctx.render();
            },
          }, SHORT[on]))),
          pickOn ? h('div', { class: 'pgrid' }, moves.filter((m) => m.on === pickOn).map((m) => h('button', { class: 'btn', onclick: () => ctx.respond(m) }, String(m.v)))) : null));
      }
      return out;
    },

    endHead: (w, ctx, res) => (res.scores[0] > 1000 ? 'Kasadan kazançlı çıktın!' : res.scores[0] === 1000 ? 'Başladığın yerdesin' : 'Kasa kazandı'),
    fmtScore: (sc) => `${sc} çip`,
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, 'Her elde Oyuncu eline, Kasa eline ya da Beraberliğe oynarsın (50, 100, 200). Kartları kasa açar; senin karar vermen gereken bir şey yok.'),
      h2('p', {}, 'Değerler: as 1, 2–9 kendi değeri, 10 ve resimler 0. Toplamın son basamağı sayılır (7+8 = 5). 9\'a en yakın el kazanır.'),
      h2('p', {}, 'İki el ikişer kart alır. 8 ya da 9 "natürel"dir, kimse çekmez. Yoksa oyuncu eli 0–5\'te üçüncü kartı çeker; kasa eli kendi toplamına ve oyuncunun üçüncü kartına göre çeker.'),
      h2('p', {}, 'Ödeme: Oyuncu 1:1, Kasa 1:1 eksi %5 komisyon, Beraberlik 8:1. Beraberlik çıkarsa Oyuncu ve Kasa bahisleri iade edilir. 10 el oynanır.')),
  });
}
