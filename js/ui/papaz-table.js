// Papaz Kaçtı masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: dağıtım (49 kart sırayla) → herkes çiftlerini ortaya açık atar → sıra gelen, sağındakinin
// kapalı kartlarından birini çeker (kart o oyuncudan çekene gider) → çift olduysa iki kart ortaya açık atılır.
import papaz, { rankOf } from '../games/papazkacti.js';
import { createMatchScreen, choreo } from './table-kit.js';
import { RANK_NAME_TR } from '../core/cards.js';

const rn = (c) => RANK_NAME_TR[rankOf(c)] || String(rankOf(c));

export function createPapazScreen(deps) {
  const { h, settings } = deps;
  let disp = null; // { hand, sizes, disc }
  let note = '';

  function discSpot(ctx, c) {
    const j = ctx.A.jitter(c, 46);
    return { dx: j.dx * 1.3, dy: j.dy * 0.8 - 18, rot: j.rot / 2.5 };
  }

  return createMatchScreen(deps, {
    yazboz: false,
    title: 'Papaz Kaçtı',
    game: papaz,
    players: () => settings.get('papazPlayers'),
    maxThink: 500,
    reset() {
      disp = null;
      note = '';
    },

    async onStart(ctx) {
      const { A } = ctx;
      const st = ctx.state;
      const v = ctx.view(0);
      // 1) dağıtım: herkese sırayla, senin kartların yolda yüzünü çevirir
      disp = { hand: v.dealtHand, sizes: v.dealtSizes, disc: [] };
      v.dealtHand.forEach((c) => ctx.pend.add(c));
      ctx.adj = v.dealtSizes.map((n, i) => (i === 0 ? 0 : -n));
      ctx.render();
      const order = [];
      const idx = Array(ctx.n).fill(0);
      for (let k = 0; k < v.dealtSizes.reduce((a, b) => a + b, 0); k++) {
        const seat = k % ctx.n;
        order.push({ seat, card: seat === 0 ? v.dealtHand[idx[0]++] : null });
      }
      await choreo.deal(ctx, order, { from: ctx.centerBox() });
      ctx.adj = Array(ctx.n).fill(0);
      await ctx.wait('pause');
      // 2) herkes çiftlerini ortaya açık atar
      note = 'Herkes çiftlerini atıyor';
      const sources = [];
      st.initial.forEach((cards, seat) => {
        cards.filter((c) => !st.hands[seat].includes(c)).forEach((c) => sources.push({ c, from: seat === 0 ? ctx.cardBox(c) : ctx.seatBox(seat) }));
      });
      disp = { hand: v.hand, sizes: v.handSizes, disc: v.discarded };
      v.discarded.forEach((c) => ctx.pend.add(c));
      ctx.render();
      await Promise.all(sources.map(({ c, from }, k) =>
        A.fly(ctx.cardEl(ctx.parseCard(c)), from, ctx.cardBox(c), { duration: A.dur('pass'), easing: A.EASE.move, delay: k * 22 }).then(() => ctx.reveal(c))));
      note = '';
      disp = null;
    },

    async onMove(e, ctx, before) {
      const { A } = ctx;
      const ev = e.event;
      const seat = e.seat;
      const t = ev.from;
      const l = e.state.last;
      const card = l.card;
      const pw = l.pairWith;
      const bv = papaz.viewFor(before, 0);
      const v = papaz.viewFor(e.state, 0);
      const human = seat === 0 || t === 0;
      const who = ctx.name(seat);
      const from = ctx.name(t);
      if (seat === 0) note = `${from}'den ${rn(card)} çektin${pw ? ' — çift oldu' : ''}`;
      else if (t === 0) note = `${who} senden ${rn(card)} çekti${pw ? ' ve çift attı' : ''}`;
      else note = `${who}, ${from}'den kart çekti${pw ? ' ve çift attı' : ''}`;

      // 1) kart çekilen oyuncudan çekene gider (çekilen oyuncunun sayısı hemen azalır, çekeninki kart inince artar)
      const src = seat === 0 ? ctx.cardBox(`t${e.move.i}`) : t === 0 ? ctx.cardBox(card) : ctx.seatBox(t);
      const sizes = bv.handSizes.slice();
      sizes[t]--;
      const hand1 = t === 0 ? bv.hand.filter((x) => x !== card) : seat === 0 ? (pw ? bv.hand : e.state.hands[0]) : bv.hand;
      disp = { hand: hand1, sizes, disc: bv.discarded };
      if (seat === 0 && !pw) ctx.pend.add(card);
      ctx.render();
      const dst = seat === 0 ? (pw ? ctx.seatBox(0) : ctx.cardBox(card)) : ctx.seatBox(seat, 0.5);
      await ctx.fly(human ? card : null, src, dst, { duration: A.dur('pass'), easing: A.EASE.move, reveal: seat === 0, conceal: t === 0 });
      if (seat === 0 && !pw) ctx.reveal(card);
      if (!pw) {
        disp = null;
        return;
      }
      // 2) çift: iki kart ortaya açık atılır
      await ctx.wait('pause');
      const from1 = dst;
      const from2 = seat === 0 ? ctx.cardBox(pw) : ctx.seatBox(seat);
      disp = { hand: v.hand, sizes: v.handSizes, disc: [...bv.discarded, card, pw] };
      ctx.pend.add(card);
      ctx.pend.add(pw);
      ctx.render();
      await Promise.all([
        A.fly(ctx.cardEl(ctx.parseCard(card)), from1, ctx.cardBox(card), { duration: A.dur('play'), easing: A.EASE.land }).then(() => ctx.reveal(card)),
        A.fly(ctx.cardEl(ctx.parseCard(pw)), from2, ctx.cardBox(pw), { duration: A.dur('play'), easing: A.EASE.land, delay: 70 }).then(() => ctx.reveal(pw)),
      ]);
      disp = null;
    },

    render(ctx) {
      const v = ctx.view(0);
      const d = disp || {};
      const hand = d.hand ?? v.hand;
      const sizes = d.sizes ?? v.handSizes;
      const disc = d.disc ?? v.discarded;
      const my = ctx.awaiting && !disp && v.turn === 0 && v.target >= 0;
      const pileNodes = disc.slice(-12).map((c, k) => ctx.pileCard(c, { ...discSpot(ctx, c), z: k + 1 }));
      let pick = null;
      if (my) {
        const n = v.handSizes[v.target];
        pick = h('div', { class: 'khand pickrow', style: `--ml:${n > 5 ? -30 : -6}px` }, Array.from({ length: n }, (_, i) =>
          h('button', { class: 'kc', 'data-card': `t${i}`, 'aria-label': `Kart ${i + 1}`, onclick: () => ctx.respond({ i }) }, ctx.cardEl(null))));
      }
      const area = h('div', { class: 'center' }, pileNodes, h('div', { class: 'cnt' }, `${disc.length / 2} çift atıldı`), pick);
      const info = h('div', { class: 'kinfo' },
        h('div', { class: 'kg' }, my ? `▶ ${ctx.name(v.target)}'in kartlarından birini çek` : v.over ? 'Oyun bitti' : note || (disp ? '\u00a0' : `${ctx.name(v.turn)} çekiyor`)),
        h('div', { class: 'sub' }, `Elinde ${hand.length} kart`));
      return [
        ctx.table({ area, info, count: (i) => sizes[i], chipSub: (i) => (v.out.includes(i) ? 'kurtuldu' : ''), chipCls: (i) => (v.out.includes(i) ? 'done' : '') }),
        ctx.handRow(hand, {}),
      ];
    },

    endHead: (w) => (w.includes(0) ? 'Papaz sende kalmadı — kazandın!' : 'Papaz sende kaldı'),
    fmtScore: (s) => (s < 0 ? 'Papaz kaldı' : 'kurtuldu'),
    rules: (h) => h('div', { class: 'rules' },
      h('p', {}, '52 kartlık desteden 3 papaz çıkarılır, kalan 49 kart dağıtılır. Herkes elindeki aynı sayılı çiftleri ortaya açık atar.'),
      h('p', {}, 'Sıra sende iken sağındaki oyuncunun kapalı kartlarından birini çekersin. Çift olursa atarsın. Elinde kart kalmayan oyundan çıkar.'),
      h('p', {}, 'Son kalan, yani papazı elinde tutan kaybeder. Çekmek istediğin karta dokunman yeterli.')),
  });
}
