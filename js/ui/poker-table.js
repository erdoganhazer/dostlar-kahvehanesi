// Teksas Poker masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: dağıtım (merkezden sırayla 2'şer kart; seninkiler yolda yüzünü çevirir) → pas geçen kartlarını masaya bırakır →
// flop/turn/river desteden ortak kart yuvasına uçar ve yüzünü çevirir → showdown: rakiplerin kartları kutularından açılış sırasına
// uçup yüzünü çevirir → sonuç okunur → bütün kartlar toplanır → yeni el dağıtılır.
import poker, { HANDS } from '../games/poker.js';
import { createMatchScreen, choreo } from './table-kit.js';

const STREET = { preflop: 'Flop öncesi', flop: 'Flop', turn: 'Turn', river: 'River' };

export function createPokerScreen(deps) {
  const { h, settings } = deps;
  let disp = null; // { board, hole, counts, chips, bets, pot, folded, show, names, res, handNo, dealer, street, sb, bb }

  const fromState = (ctx) => {
    const v = ctx.view(0);
    return { board: v.board, hole: v.folded[0] ? [] : v.hole, counts: v.holeCounts, chips: v.chips, bets: v.bets, pot: v.pot, folded: v.folded, allin: v.allin, show: null, names: null, res: '', handNo: v.handNo, dealer: v.dealer, street: v.street, sb: v.sb, bb: v.bb, cur: v.cur };
  };
  const endScene = (ctx, re, bv, extra = {}) => {
    const before = re.chips.map((c, i) => c - re.payouts[i]);
    return { board: bv.board, hole: re.folded[0] ? [] : bv.hole, counts: re.folded.map((f, i) => (f ? 0 : 2)), chips: before, bets: before.map(() => 0), pot: re.pots.reduce((a, p) => a + p.amount, 0), folded: re.folded, allin: before.map((c, i) => c === 0 && !re.folded[i]), show: null, names: null, res: '', handNo: re.hand, dealer: re.dealer, street: bv.street, sb: bv.sb, bb: bv.bb, cur: 0, ...extra };
  };
  const resultText = (ctx, re) => {
    const win = re.net.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0);
    if (!win.length) return 'El berabere bitti';
    return win.map((i) => `${ctx.name(i)} +${re.net[i]}${re.names && re.names[i] ? ` (${re.names[i]})` : ''}`).join(' · ');
  };

  async function dealHand(ctx, st) {
    const v = poker.viewFor(st, 0);
    disp = { ...fromState(ctx), board: [], hole: v.hole, counts: v.holeCounts };
    v.hole.forEach((c) => ctx.pend.add(c));
    ctx.adj = v.holeCounts.map((n, i) => (i === 0 ? 0 : -n));
    ctx.render();
    const order = [];
    const idx = [0, 0, 0, 0];
    for (let r = 0; r < 2; r++) for (const seat of st.order) order.push({ seat, card: seat === 0 ? v.hole[idx[0]++] : null });
    await choreo.deal(ctx, order, { from: ctx.deckBox() });
    ctx.adj = Array(ctx.n).fill(0);
    disp = null;
  }

  async function dealBoard(ctx, sc, cards) {
    const { A } = ctx;
    // flop 3 kart birlikte, turn/river tek tek
    const groups = sc.board.length === 0 ? [cards.slice(0, 3), ...cards.slice(3).map((c) => [c])] : cards.map((c) => [c]);
    let shown = [...sc.board];
    for (const g of groups) {
      const from = ctx.deckBox();
      shown = [...shown, ...g];
      disp = { ...sc, board: shown };
      g.forEach((c) => ctx.pend.add(c));
      ctx.render();
      await Promise.all(g.map((c, k) => ctx.A.fly(ctx.cardEl(null), from, ctx.cardBox(c), { duration: A.dur('deal') * 1.3, easing: A.EASE.land, delay: k * A.dur('dealStagger') * 1.5, flipTo: ctx.cardEl(ctx.parseCard(c)) }).then(() => ctx.reveal(c))));
      await ctx.wait('pause');
    }
  }

  return createMatchScreen(deps, {
    yazboz: false,
    title: 'Teksas Poker',
    game: poker,
    players: () => settings.get('pokerPlayers'),
    makeConfig: () => ({ humanOut: true }),
    maxThink: 600,
    reset() {
      disp = null;
    },
    onStart: (ctx) => dealHand(ctx, ctx.state),

    async onMove(e, ctx, before) {
      const { A } = ctx;
      const ev = e.event;
      const re = ev.handEnd;
      const seat = e.seat;
      const bv = poker.viewFor(before, 0);
      // 1) pas geçen kartlarını bırakır
      if (e.move.t === 'fold') {
        const srcs = seat === 0 ? bv.hole.map((c) => ctx.cardBox(c)) : [ctx.seatBox(seat), ctx.seatBox(seat)];
        const folded = bv.folded.map((f, i) => f || i === seat);
        const counts = bv.holeCounts.map((c, i) => (i === seat ? 0 : c));
        disp = re ? endScene(ctx, re, bv) : { ...fromState({ view: () => bv }), counts, folded, hole: seat === 0 ? [] : bv.hole };
        if (re) disp.counts = counts;
        ctx.render();
        if (seat !== 0) disp.counts = bv.holeCounts; // kutudaki kartlar uçuş başlayınca azalır
        ctx.render();
        const to = ctx.deckBox();
        await Promise.all(srcs.map((from, k) => A.sleep(k * 60).then(() => {
          if (seat !== 0) ctx.bumpCount(seat, -1);
          return ctx.fly(seat === 0 ? bv.hole[k] : null, from, to, { duration: A.dur('play'), easing: A.EASE.leave, fadeEnd: true, conceal: seat === 0 });
        })));
      }
      // 2) yeni ortak kartlar
      const finalBoard = re ? re.board : e.state.board;
      const newCards = finalBoard.slice(before.board.length);
      const base = re ? endScene(ctx, re, bv) : null;
      if (newCards.length) {
        const sc = base || { ...fromState({ view: () => poker.viewFor(e.state, 0) }), board: before.board };
        await dealBoard(ctx, { ...sc, board: before.board, street: sc.street }, newCards);
      }
      if (!re) {
        disp = null;
        return;
      }
      // 3) showdown / sonuç
      let sc = { ...base, board: re.board };
      disp = sc;
      ctx.render();
      if (re.show) {
        const seats = Object.keys(re.show).map(Number).filter((i) => i !== 0);
        const ids = seats.flatMap((i) => re.show[i]);
        sc = { ...sc, show: Object.fromEntries(seats.map((i) => [i, re.show[i]])), names: re.names, counts: sc.counts.map((c, i) => (seats.includes(i) ? 0 : c)) };
        const srcs = Object.fromEntries(seats.map((i) => [i, ctx.seatBox(i)]));
        ids.forEach((c) => ctx.pend.add(c));
        disp = sc;
        ctx.render();
        await Promise.all(seats.flatMap((i) => re.show[i].map((c, k) =>
          A.fly(ctx.cardEl(null), srcs[i], ctx.cardBox(c), { duration: A.dur('pass'), easing: A.EASE.move, delay: k * 80, flipTo: ctx.cardEl(ctx.parseCard(c)) }).then(() => ctx.reveal(c)))));
      }
      sc = { ...sc, chips: re.chips, res: resultText(ctx, re), pot: 0 };
      disp = sc;
      ctx.render();
      await ctx.wait(re.show ? 2400 : 1500);
      // 4) kartlar toplanır
      const ids = [...re.board, ...(re.folded[0] ? [] : bv.hole), ...Object.entries(re.show || {}).filter(([i]) => +i !== 0).flatMap(([, cs]) => cs)];
      const to = ctx.deckBox();
      await Promise.all(ids.map((c, k) => {
        const from = ctx.cardBox(c);
        ctx.hide(c);
        return A.fly(ctx.cardEl(ctx.parseCard(c)), from, to, { duration: A.dur('collect'), easing: A.EASE.leave, delay: k * A.dur('collectStagger') * 0.6, fadeEnd: true });
      }));
      const hidden = sc.counts.map((c, i) => (i === 0 ? 0 : c));
      const backs = hidden.flatMap((c, i) => Array.from({ length: c }, () => i));
      const seatSrc = Object.fromEntries(backs.map((i) => [i, ctx.seatBox(i)]));
      await Promise.all(backs.map((i, k) => A.sleep(k * 60).then(() => {
        ctx.bumpCount(i, -1);
        return A.fly(ctx.cardEl(null), seatSrc[i], to, { duration: A.dur('collect'), easing: A.EASE.leave, fadeEnd: true });
      })));
      disp = { ...sc, board: [], hole: [], counts: sc.counts.map(() => 0), show: null, res: '', pot: 0 };
      ctx.render();
      if (!poker.isOver(e.state)) await dealHand(ctx, e.state);
      disp = null;
    },

    render(ctx) {
      const s = ctx.state;
      const sc = disp || fromState(ctx);
      const v = ctx.view(0);
      const pend = (c) => (ctx.pend.has(c) ? ' pend' : '');
      const slots = Array.from({ length: 5 }, (_, i) => (sc.board[i]
        ? h('div', { class: `pk${pend(sc.board[i])}`, 'data-card': sc.board[i] }, ctx.cardEl(ctx.parseCard(sc.board[i])))
        : h('div', { class: 'pkslot' })));
      const showRows = sc.show ? Object.entries(sc.show).map(([i, cs]) => h('div', { class: 'bjrow' },
        h('span', { class: 'bjl' }, ctx.name(+i), h('b', {}, sc.names?.[i] || '')),
        h('div', { class: 'bjcards' }, cs.map((c) => h('div', { class: `bjc sm${pend(c)}`, 'data-card': c }, ctx.cardEl(ctx.parseCard(c))))))) : [];
      const area = h('div', { class: 'center pkarea' }, ctx.deck(40), h('div', { class: 'pkpot' }, sc.pot ? `Havuz: ${sc.pot}` : ' '), h('div', { class: 'pkboard' }, slots), showRows);
      const my = ctx.awaiting && !disp && s.phase === 'bet' && s.turn === 0;
      const toCall = Math.min(v.cur - v.bets[0], v.chips[0]);
      const info = h('div', { class: 'kinfo' },
        h('div', {}, `El ${Math.min(sc.handNo + 1, HANDS)}/${HANDS} · Kör ${sc.sb}/${sc.bb}`),
        h('div', { class: 'kg' }, sc.res || (my ? '▶ Sıra sende' : STREET[sc.street] || ' ')),
        h('div', { class: 'sub' }, my ? (toCall ? `Görmek için ${toCall} çip` : 'Bahis yok') : disp ? '\u00a0' : `${ctx.name(s.turn ?? 0)} düşünüyor`),
        h('div', { class: 'tot' }, `Çipin: ${sc.chips[0]}${sc.bets[0] ? ` (bahsin ${sc.bets[0]})` : ''}`));
      const tag = (i) => (sc.folded[i] ? ' · Pas' : sc.allin?.[i] ? ' · All-in' : '');
      const out = [ctx.table({
        area, info, count: (i) => sc.counts[i],
        chipSub: (i) => `${sc.chips[i]}${sc.dealer === i ? ' · D' : ''}\n${sc.bets[i] ? `bahis ${sc.bets[i]}` : ''}${tag(i).replace(' · ', sc.bets[i] ? ' · ' : '')}`,
        chipCls: (i) => (!disp && s.phase !== 'over' && s.turn === i ? 'turn' : sc.folded[i] ? 'done' : ''),
      })];
      if (my) {
        const legal = poker.legalMoves(s, 0);
        const raises = legal.filter((m) => m.t === 'raise');
        const maxTo = v.bets[0] + v.chips[0];
        const btn = (label, m) => h('button', { class: 'btn', onclick: () => ctx.respond(m) }, label);
        // tek ızgara: Pas/Kontrol, Gör, yükseltmeler (yer kaplamasın diye 3 sütun)
        out.push(h('div', { class: 'announce panel' }, h('div', { class: 'pgrid pk3' },
          legal.some((m) => m.t === 'fold') ? btn('Pas', { t: 'fold' }) : null,
          legal.some((m) => m.t === 'call') ? btn(`Gör ${toCall}`, { t: 'call' }) : btn('Kontrol', { t: 'check' }),
          raises.map((m) => btn(m.to === maxTo ? `All-in ${m.to}` : `${v.cur ? 'Yükselt' : 'Bahis'} ${m.to}`, m)))));
      }
      out.push(ctx.handRow(sc.hole, {}));
      return out;
    },

    endHead: (w, ctx, res) => (res.scores[0] === Math.max(...res.scores) ? 'Masayı sen kazandın!' : res.scores[0] === 0 ? 'Çipin bitti' : 'Oyun bitti'),
    fmtScore: (s) => `${s} çip`,
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, 'Herkese 2 kapalı kart, ortaya 5 açık kart (flop 3, turn 1, river 1) gelir. Elindeki 2 ve masadaki 5 karttan yapabildiğin en iyi 5 kartlık el sayılır.'),
      h2('p', {}, 'Her turda sırayla: Pas (eli bırakırsın), Kontrol (bahis yoksa geçersin), Gör (bahsi eşitlersin), Yükselt/Bahis ya da All-in. İki küçük/büyük kör zorunlu bahistir ve her 4 elde ikiye katlanır.'),
      h2('p', {}, 'El sırası: düz renk, dörtlü, full, renk, seri, üçlü, iki çift, çift, yüksek kart. Showdown\'da en iyi eli olan havuzu alır; all-in yüzünden yan havuzlar ayrı dağıtılır.'),
      h2('p', {}, '12 el sonunda en çok çipi olan kazanır. Çipin biterse oyun biter.')),
  });
}
