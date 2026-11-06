// Casino Savaşı masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: bahis → herkese ve kasaya birer açık kart → eşitlikte savaş ya da teslim kararı → savaş: kasa 3 kart
// yakar (kapalı), savaşanlara ve kendine birer kart → sonuç ve çipler → kartlar desteye.
import sv from '../games/savas.js';
import { createMatchScreen } from './table-kit.js';
import { cardRow, label, dealAll, collect, betPanel, money } from './kasa-kit.js';

const RES = { win: 'Kazandı', lose: 'Kaybetti', surrender: 'Teslim oldu', warwin: 'Savaşı kazandı', warlose: 'Savaşı kaybetti' };

export function createSavasScreen(deps) {
  const { h, settings } = deps;
  let disp = null; // { rows, dealer, bets, chips, msg, res, net, round }

  const rowsOf = (s) => s.cards.map((c) => (c ? [c] : []));

  return createMatchScreen(deps, {
    yazboz: false,
    wonByScore: (res) => res.scores[0] > 1000,
    title: 'Casino Savaşı',
    game: sv,
    players: () => settings.get('savasPlayers'),
    askPlayers: { key: 'savasPlayers', options: [1, 2, 3, 4] },
    maxThink: 450,
    reset() {
      disp = null;
    },
    async onMove(e, ctx, before) {
      const ev = e.event;
      const re = ev.roundEnd;
      if (ev.dealLog) {
        const src = re || e.state;
        disp = { rows: src.cards.map(() => []), dealer: [], bets: src.bets, chips: before.chips, round: src.round ?? re.round, msg: '' };
        const ids = ev.dealLog.map((x) => x.c);
        ev.dealLog.forEach((x) => {
          (x.who === 'd' ? disp.dealer : disp.rows[x.who]).push(x.c);
          ctx.pend.add(x.c);
        });
        ctx.render();
        await dealAll(ctx, ids);
        await ctx.wait('pause');
        if (!re) {
          const t = e.state.ties;
          disp.msg = t.length ? `Eşitlik: ${t.map((i) => (i === 0 ? 'sen' : ctx.name(i))).join(', ')} — savaş mı, teslim mi?` : '';
          ctx.render();
          await ctx.wait(500);
          disp = null;
          return;
        }
      }
      if (!re) return;
      if (!disp) disp = { rows: rowsOf(re), dealer: [re.dealer], bets: re.bets, chips: before.chips, round: re.round, msg: '' };
      if (re.war) {
        disp.msg = 'Savaş! Kasa üç kart yakıyor';
        const burn = re.war.burn.map((_, k) => `x:b:${k}`);
        disp.burn = burn;
        burn.forEach((id) => ctx.pend.add(id));
        ctx.render();
        await dealAll(ctx, burn, 0.35);
        await ctx.wait('pause');
        const ids = [];
        for (const [i, c] of Object.entries(re.war.cards)) {
          disp.rows[+i] = [...disp.rows[+i], c];
          ids.push(c);
        }
        disp.dealer = [...disp.dealer, re.war.dealer];
        ids.push(re.war.dealer);
        ids.forEach((c) => ctx.pend.add(c));
        disp.msg = 'Savaş kartları';
        ctx.render();
        await dealAll(ctx, ids);
      }
      await ctx.wait('pause');
      disp.res = re.res;
      disp.net = re.net;
      disp.chips = re.chips;
      disp.msg = '';
      ctx.render();
      await ctx.wait(1700);
      await collect(ctx);
      disp = null;
    },

    render(ctx) {
      const s = ctx.state;
      const d = disp;
      const rows = d ? d.rows : rowsOf(s);
      const dealer = d ? [...(d.burn || []), ...d.dealer] : s.dealer ? [s.dealer] : [];
      const bets = d ? d.bets : s.bets;
      const chips = d ? d.chips : s.chips;
      const status = (i) => (d?.res ? (d.res[i] ? `${RES[d.res[i]]}` : '') : s.choice?.[i] === 'war' ? 'Savaşa girdi' : s.choice?.[i] === 'surrender' ? 'Teslim' : s.ties?.includes(i) ? 'Eşitlik' : '');
      const rowsN = [h('div', { class: 'bjrow dealer' }, label(ctx, 'Kasa', ''), cardRow(ctx, dealer))];
      for (let i = 1; i < ctx.n; i++) rowsN.push(h('div', { class: 'bjrow' }, label(ctx, ctx.name(i), status(i)), cardRow(ctx, rows[i] || [], { small: true })));
      rowsN.push(h('div', { class: 'bjrow' }, label(ctx, 'Sen', status(0)), cardRow(ctx, rows[0] || [])));
      const onTable = [...rows.flat(), ...dealer].filter((c) => !ctx.pend.has(c)).length;
      const area = h('div', { class: 'center bjarea' }, ctx.deck(52 - onTable), d?.msg ? h('div', { class: 'bkmsg' }, d.msg) : null, rowsN);
      const mine = ctx.awaiting && !d && s.turn === 0;
      const round = d ? d.round : s.round;
      const head = d && !d.res ? (d.msg || 'El açılıyor') : d?.res ? (d.res[0] ? `${RES[d.res[0]]} ${money(d.net[0])}` : ' ') : s.phase === 'over' ? 'Oyun bitti' : mine ? (s.phase === 'bet' ? 'Bahsini seç' : 'Eşitlik! Savaş mı, teslim mi?') : `${ctx.name(s.turn)} düşünüyor`;
      const info = h('div', { class: 'kinfo' },
        h('div', {}, `El ${Math.min(round + 1, s.rounds)}/${s.rounds}`),
        h('div', { class: 'kg' }, head),
        h('div', { class: 'sub' }, bets[0] ? `Bahsin: ${bets[0]}` : 'Büyük kart kazanır · as en büyük'),
        h('div', { class: 'tot' }, `Çipin: ${chips[0]}`));
      const out = [ctx.table({
        area, info,
        chipSub: (i) => (d?.net ? `${chips[i]} (${money(d.net[i])})` : bets[i] ? `${bets[i]} · ${chips[i]}` : `${chips[i]} çip`),
        chipCls: (i) => (!d && s.phase !== 'over' && s.turn === i ? 'turn' : ''),
      })];
      if (mine && s.phase === 'bet') out.push(betPanel(ctx, 'Bu el ne kadar?', sv.legalMoves(s, 0)));
      if (mine && s.phase === 'tie') {
        const L = sv.legalMoves(s, 0);
        out.push(h('div', { class: 'announce panel' }, h('b', {}, `Kartlar eşit! Savaşırsan ${bets[0]} daha koyarsın; teslim olursan ${Math.floor(bets[0] / 2)} kaybedersin.`),
          h('div', { class: 'pgrid' },
            h('button', { class: 'btn', disabled: !L.some((m) => m.t === 'war'), onclick: () => ctx.respond({ t: 'war' }) }, 'Savaş'),
            h('button', { class: 'btn', onclick: () => ctx.respond({ t: 'surrender' }) }, 'Teslim ol'))));
      }
      return out;
    },

    endHead: (w, ctx, res) => (res.scores[0] > 1000 ? 'Kasadan kazançlı çıktın!' : res.scores[0] === 1000 ? 'Başladığın yerdesin' : 'Kasa kazandı'),
    fmtScore: (sc) => `${sc} çip`,
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, 'Bahsini koyarsın (50, 100, 200); sana ve kasaya birer açık kart gelir. Büyük kart kazanır (as en büyük), bahis kadar ödenir.'),
      h2('p', {}, 'Kartlar eşitse: teslim olursan bahsin yarısını kaybedersin; savaşırsan bahsin kadar daha koyarsın. Kasa üç kart yakar, sana ve kendine birer kart verir.'),
      h2('p', {}, 'Savaşta kartın kasanınkine eşit ya da büyükse ek bahsin kadar kazanırsın (ilk bahis iade); küçükse ikisi de gider. Taktik: her zaman savaş. 10 el oynanır.')),
  });
}
