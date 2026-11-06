// Eşek masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: dağıtım (4'er kart) → herkes vereceği kartı önüne KAPALI koyar → hepsi aynı anda soldakine kayar
// (sana gelen kart elinde açılır) → biri "EŞEK!" der, herkes dokunur → el biter: kartlar ortada toplanıp yeniden dağıtılır.
import esek, { LETTERS } from '../games/esek.js';
import { createMatchScreen, choreo } from './table-kit.js';

const BASE = { 1: 950, 2: 700, 3: 480 };
const SPEED = { hizli: -80, normal: 0, yavas: 100 };
// Oyuncunun önüne koyduğu kapalı kartın yeri (masanın ortasına göre)
const STAGE = { bottom: [0, 48, -3], right: [52, 0, 84], top: [0, -48, 2], left: [-52, 0, -86] };

export function createEsekScreen(deps) {
  const { h, settings } = deps;
  let disp = null; // { hand, staged: bool[] }
  let given = null; // senin önüne koyduğun kart
  let reactStart = 0;
  let result = null;

  const stageId = (i) => `stage${i}`;

  async function dealRound(ctx) {
    const v = ctx.view(0);
    v.hand.forEach((c) => ctx.pend.add(c));
    ctx.adj = Array(ctx.n).fill(0).map((_, i) => (i === 0 ? 0 : -4));
    disp = { hand: v.hand, staged: Array(ctx.n).fill(false) };
    ctx.render();
    const order = [];
    for (let r = 0; r < 4; r++) for (let k = 1; k <= ctx.n; k++) {
      const seat = k % ctx.n;
      order.push({ seat, card: seat === 0 ? v.hand[r] : null });
    }
    await choreo.deal(ctx, order, { from: ctx.centerBox() });
    ctx.adj = Array(ctx.n).fill(0);
    disp = null;
  }

  return createMatchScreen(deps, {
    yazboz: false,
    title: 'Eşek',
    game: esek,
    players: () => settings.get('esekPlayers'),
    maxThink: 350,
    makeConfig: (seats) => ({
      reaction: seats.map((s) => (s.kind === 'bot' ? (BASE[s.bot.profile.level] ?? 700) + (SPEED[s.bot.profile.speed] ?? 0) : 0)),
    }),
    reset() {
      disp = null;
      given = null;
      result = null;
    },
    onStart: (ctx) => dealRound(ctx),
    onTurn(ctx) {
      if (ctx.state.phase === 'react') reactStart = performance.now();
    },

    async onMove(e, ctx, before) {
      const { A } = ctx;
      const n = ctx.n;
      const seat = e.seat;
      if (e.move.t === 'pass') {
        // 1) kart oyuncunun önüne kapalı konur
        const c = e.move.c;
        const src = seat === 0 ? ctx.cardBox(c) : ctx.seatBox(seat);
        if (seat === 0) given = c;
        const staged = before.picks.map((p) => p != null);
        staged[seat] = true;
        const bh = before.hands[0];
        disp = { hand: given ? bh.filter((x) => x !== given) : bh, staged };
        ctx.pend.add(stageId(seat));
        ctx.render();
        await ctx.fly(seat === 0 ? c : null, src, ctx.cardBox(stageId(seat)), { duration: A.dur(seat === 0 ? 'play' : 'botPlay'), easing: A.EASE.land, conceal: seat === 0 });
        ctx.reveal(stageId(seat));
        const resolved = e.state.picks.every((p) => p == null);
        if (!resolved) return; // disp kalsın: diğerleri de koyacak
        // 2) hepsi aynı anda soldakine kayar
        await ctx.wait('pause');
        const nh = e.state.hands[0];
        const got = nh.find((x) => !bh.includes(x));
        const froms = Array.from({ length: n }, (_, i) => ctx.cardBox(stageId(i)));
        disp = { hand: nh, staged: Array(n).fill(false) };
        if (got) ctx.pend.add(got);
        ctx.render();
        await Promise.all(froms.map((from, i) => {
          const to = (i - 1 + n) % n;
          const dst = to === 0 && got ? ctx.cardBox(got) : ctx.seatBox(to);
          return A.fly(ctx.cardEl(null), from, dst, {
            duration: A.dur('pass'), easing: A.EASE.move, delay: i * 40,
            flipTo: to === 0 && got ? ctx.cardEl(ctx.parseCard(got)) : null,
          }).then(() => to === 0 && got && ctx.reveal(got));
        }));
        given = null;
        disp = null;
        return;
      }
      // tepki
      if (!e.event.roundEnded) return;
      const l = e.state.last;
      result = { loser: l.loser, caller: l.caller, taps: l.taps };
      disp = { hand: before.hands[0], staged: Array(n).fill(false) };
      ctx.render();
      await ctx.wait(2200);
      result = null;
      if (esek.isOver(e.state)) return;
      // 3) kartlar ortada toplanır, yeniden dağıtılır
      const center = ctx.centerBox();
      const jobs = [];
      before.hands[0].forEach((c, k) => {
        const from = ctx.cardBox(c);
        ctx.hide(c);
        jobs.push(A.fly(ctx.cardEl(ctx.parseCard(c)), from, center, { duration: A.dur('collect'), easing: A.EASE.leave, delay: k * 30, flipTo: ctx.cardEl(null) }));
      });
      for (let i = 1; i < n; i++) for (let k = 0; k < 4; k++) jobs.push(A.fly(ctx.cardEl(null), ctx.seatBox(i), center, { duration: A.dur('collect'), easing: A.EASE.leave, delay: (i * 4 + k) * 25 }));
      ctx.adj = Array(n).fill(0).map((_, i) => (i === 0 ? 0 : -4));
      await Promise.all(jobs);
      await ctx.wait('pause');
      await dealRound(ctx);
    },

    render(ctx) {
      const v = ctx.view(0);
      const d = disp || {};
      const staged = d.staged ?? v.picked;
      const hand = d.hand ?? (v.phase === 'pass' && v.picked[0] && given ? v.hand.filter((c) => c !== given) : v.hand);
      const react = v.phase === 'react' && ctx.awaiting && !disp;
      const letters = (i) => (v.losses[i] ? LETTERS.slice(0, v.losses[i]).join(' ') : '—');
      const stage = staged.map((on, i) => {
        if (!on) return null;
        const [dx, dy, rot] = STAGE[ctx.pos(i)];
        return ctx.pileCard(stageId(i), { dx, dy, rot, z: i + 1, back: true });
      });
      let mid = null;
      if (result) {
        const t = result.taps;
        mid = h('div', { class: 'textzone' },
          h('div', { class: 'big' }, `${ctx.name(result.caller)}: EŞEK!`),
          h('div', { class: 'sub' }, `${ctx.name(result.loser)} en geç kaldı → ${LETTERS[v.losses[result.loser] - 1] ?? ''} harfi`),
          h('div', { class: 'sub' }, t.map((x, i) => (x == null ? null : `${ctx.name(i)} ${Math.round(x)} ms`)).filter(Boolean).join(' · ')));
      } else if (react) {
        mid = h('div', { class: 'textzone' },
          h('div', { class: 'big alarm' }, `${ctx.name(v.caller)}: EŞEK!`),
          h('button', { class: 'btn tapbtn', onclick: () => ctx.respond({ t: 'tap', ms: performance.now() - reactStart }) }, 'DOKUN!'));
      }
      const area = h('div', { class: 'center' }, stage, mid);
      const my = ctx.awaiting && v.phase === 'pass' && !disp;
      const info = h('div', { class: 'kinfo' },
        h('div', { class: 'kg' }, my ? '▶ Soldakine vereceğin kartı seç' : v.phase === 'react' ? 'EŞEK!' : `El ${v.round + 1}`),
        h('div', { class: 'sub' }, `Aynı sayıdan dört kart topla · harfin: ${letters(0)}`));
      return [
        ctx.table({ area, info, count: (i) => (staged[i] ? 3 : 4), chipSub: (i) => `harf: ${letters(i)}` }),
        ctx.handRow(hand, { can: () => my, onTap: (c, can) => can && ctx.respond({ t: 'pass', c }) }),
      ];
    },

    endHead: (w) => (w.includes(0) ? 'Eşek sen değilsin — kazandın!' : 'Eşek sensin!'),
    fmtScore: (s) => (s === 0 ? 'temiz' : LETTERS.slice(0, -s).join('')),
    rules: (h) => h('div', { class: 'rules' },
      h('p', {}, 'Herkese 4 kart verilir. Herkes vereceği kartı önüne kapalı koyar; sonra hepsi aynı anda soldaki oyuncuya geçer. Amaç aynı sayıdan dört kart toplamak.'),
      h('p', {}, 'Dört aynı kartı toplayan "EŞEK!" der. O an herkes hemen "DOKUN" düğmesine basmalıdır: en geç basan o eli kaybeder ve bir harf alır (E-Ş-E-K).'),
      h('p', {}, 'Dört harfi ilk tamamlayan eşek olur. Botların tepki hızı seviyelerine göre değişir.')),
  });
}
