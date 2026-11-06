// Üç Kart Poker masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: ante → herkese ve kasaya üçer kart (seninkiler açılarak, diğerleri kapalı) → herkes oynar ya da çekilir
// → kasa kartlarını çevirir, oynayanların kartları açılır → sonuç ve çipler → kartlar desteye.
import up, { evalHand, CAT, shouldPlay } from '../games/ucpoker.js';
import { createMatchScreen } from './table-kit.js';
import { cardRow, label, dealAll, turnUp, collect, betPanel, money } from './kasa-kit.js';

const RES = { win: 'Kazandı', lose: 'Kaybetti', push: 'Berabere', noq: 'Kasa açamadı', fold: 'Çekildi' };
const hid = (who, k) => `x:${who}:${k}`;

export function createUcpokerScreen(deps) {
  const { h, settings } = deps;
  let disp = null; // { rows: [[ids]...], dealer:[ids], antes, chips, msg, res, net, round }

  const hiddenRows = (n, hands, seat0Real) => hands.map((hd, i) => hd.map((c, k) => (i === 0 && seat0Real ? c : hid(i, k))));

  return createMatchScreen(deps, {
    yazboz: false,
    title: 'Üç Kart Poker',
    game: up,
    players: () => settings.get('ucpokerPlayers'),
    askPlayers: { key: 'ucpokerPlayers', options: [1, 2, 3, 4] },
    maxThink: 500,
    reset() {
      disp = null;
    },
    async onMove(e, ctx, before) {
      const ev = e.event;
      if (ev.dealLog) {
        const st = e.state;
        disp = { rows: st.hands.map(() => []), dealer: [], antes: st.antes, chips: st.chips, round: st.round, msg: 'Kartlar dağıtılıyor' };
        const ids = [];
        const cnt = {};
        for (const x of ev.dealLog) {
          const k = (cnt[x.who] = (cnt[x.who] ?? -1) + 1);
          const id = x.who === 'd' ? hid('d', k) : x.who === 0 ? x.c : hid(x.who, k);
          (x.who === 'd' ? disp.dealer : disp.rows[x.who]).push(id);
          ids.push(id);
          ctx.pend.add(id);
        }
        ctx.render();
        await dealAll(ctx, ids, 0.4);
        disp = null;
        return;
      }
      const re = ev.roundEnd;
      if (!re) return;
      const st = before;
      disp = { rows: hiddenRows(st.n, re.hands, true), dealer: re.dealer.map((_, k) => hid('d', k)), antes: re.antes, plays: re.plays, chips: before.chips, round: re.round, msg: 'Kasa kartlarını açıyor' };
      ctx.render();
      await ctx.wait('pause');
      for (let k = 0; k < 3; k++) {
        await turnUp(ctx, hid('d', k), re.dealer[k]);
        disp.dealer[k] = re.dealer[k];
      }
      ctx.render();
      disp.msg = `Kasa: ${CAT[re.dealerCat]}${re.qualified ? '' : ' — açamadı (kız yüksek gerekir)'}`;
      ctx.render();
      // oynayanların kartları açılır
      for (let i = 1; i < st.n; i++) {
        if (!re.plays[i]) continue;
        await Promise.all(re.hands[i].map((c, k) => turnUp(ctx, hid(i, k), c)));
        disp.rows[i] = re.hands[i];
        ctx.render();
      }
      await ctx.wait(700);
      disp.res = re.res;
      disp.bonus = re.bonus;
      disp.net = re.net;
      disp.chips = re.chips;
      ctx.render();
      await ctx.wait(1900);
      await collect(ctx);
      disp = null;
    },

    render(ctx) {
      const s = ctx.state;
      const v = ctx.view(0);
      const d = disp;
      const rows = d ? d.rows : s.phase === 'play' ? hiddenRows(s.n, v.hands.map((hd, i) => (i === 0 ? hd : hd.map(() => 'x'))), true) : s.hands.map(() => []);
      const dealer = d ? d.dealer : s.phase === 'play' ? [0, 1, 2].map((k) => hid('d', k)) : [];
      const antes = d ? d.antes : s.antes;
      const plays = d ? d.plays || s.plays : s.plays;
      const chips = d ? d.chips : s.chips;
      const handName = (ids) => {
        const real = ids.filter((c) => !c.startsWith('x:') && !ctx.pend.has(c));
        return real.length === 3 ? CAT[evalHand(real)[0]] : '';
      };
      const status = (i) => (d?.res ? (d.res[i] ? RES[d.res[i]] : '') : plays[i] === true ? 'Oynadı' : plays[i] === false ? 'Çekildi' : '');
      const rowsN = [h('div', { class: 'bjrow dealer' }, label(ctx, 'Kasa', handName(dealer)), cardRow(ctx, dealer))];
      for (let i = 1; i < ctx.n; i++) rowsN.push(h('div', { class: 'bjrow' }, label(ctx, ctx.name(i), handName(rows[i]) || status(i)), cardRow(ctx, rows[i], { small: true })));
      const onTable = [...rows.flat(), ...dealer].filter((c) => !ctx.pend.has(c)).length;
      const area = h('div', { class: 'center bjarea' }, ctx.deck(52 - onTable), d?.msg ? h('div', { class: 'bkmsg' }, d.msg) : null, rowsN);
      const mine = ctx.awaiting && !d && s.turn === 0;
      const round = d ? d.round : s.round;
      const myName = handName(rows[0]);
      const head = d && !d.res ? (d.msg || 'El açılıyor') : d?.res ? (d.res[0] ? `${RES[d.res[0]]}${d.net[0] ? ` ${money(d.net[0])}` : ''}${d.bonus?.[0] ? ` (bonus +${d.bonus[0]})` : ''}` : ' ')
        : s.phase === 'over' ? 'Oyun bitti' : mine ? (s.phase === 'bet' ? 'Ante koy' : `Elin: ${myName}`) : s.phase === 'play' && rows[0].length ? `Elin: ${myName}` : `${ctx.name(s.turn)} düşünüyor`;
      const info = h('div', { class: 'kinfo' },
        h('div', {}, `El ${Math.min(round + 1, s.rounds)}/${s.rounds}`),
        h('div', { class: 'kg' }, head),
        h('div', { class: 'sub' }, antes[0] ? `Ante: ${antes[0]}${plays[0] ? ` · Oyun: ${antes[0]}` : ''}` : 'Kasa kız yüksekle açar · seri, üçlü, renk serisine bonus'),
        h('div', { class: 'tot' }, `Çipin: ${chips[0]}`));
      const out = [ctx.table({
        area, info,
        chipSub: (i) => (d?.net ? `${chips[i]} (${money(d.net[i])})` : antes[i] ? `${antes[i]} · ${chips[i]}` : `${chips[i]} çip`),
        chipCls: (i) => (!d && s.phase !== 'over' && s.turn === i ? 'turn' : ''),
      })];
      if (mine && s.phase === 'bet') out.push(betPanel(ctx, 'Ante ne kadar? (oynarsan bir o kadar daha koyarsın)', up.legalMoves(s, 0)));
      if (mine && s.phase === 'play') {
        out.push(h('div', { class: 'announce panel' }, h('b', {}, `${myName}: oynuyor musun? (${antes[0]} daha)`),
          h('div', { class: 'pgrid' },
            h('button', { class: 'btn', onclick: () => ctx.respond({ t: 'play' }) }, 'Oyna'),
            h('button', { class: 'btn', onclick: () => ctx.respond({ t: 'fold' }) }, 'Çekil'))));
      }
      if (rows[0].length) out.push(ctx.handRow(rows[0], {}));
      return out;
    },

    endHead: (w, ctx, res) => (res.scores[0] > 1000 ? 'Kasadan kazançlı çıktın!' : res.scores[0] === 1000 ? 'Başladığın yerdesin' : 'Kasa kazandı'),
    fmtScore: (sc) => `${sc} çip`,
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, 'Ante koyarsın (50, 100, 200), sana ve kasaya üçer kart gelir. Kartlarına bakıp ya "Oyna" dersin (ante kadar daha koyarsın) ya da "Çekil" (ante gider).'),
      h2('p', {}, 'El sırası (büyükten küçüğe): renk serisi, üçlü, seri, renk, çift, yüksek kart. Üç kartta seri renkten büyüktür.'),
      h2('p', {}, 'Kasa en az kız yüksekle "açar". Açamazsa ante 1:1 kazanır, oyun bahsi iade. Açarsa: kasayı yenersen ante ve oyun 1:1 kazanır, yenilirsen ikisi gider, eşitlikte iade.'),
      h2('p', {}, 'Ante bonusu (oynadıysan, kasa ne olursa olsun): seri 1 kat, üçlü 4 kat, renk serisi 5 kat. Taktik: kız-6-4 ve üstüyle oyna, altıyla çekil.')),
  });
}
