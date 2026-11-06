// Kasaya karşı oyunların (Bakara, Üç Kart Poker, Casino Savaşı) ortak masa parçaları. Blackjack masasıyla aynı dil:
// solda deste, satır satır eller (en üstte kasa), kartlar desteden uçar, el sonunda desteye toplanır.
export const money = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** Kart sırası: id 'x:<anahtar>' kapalı kart (yüzü bilinmiyor) */
export function cardRow(ctx, ids, { small = false, hit = null } = {}) {
  const { h } = ctx;
  return h('div', { class: 'bjcards' }, ids.map((c) => h('div', {
    class: `bjc${small ? ' sm' : ''}${ctx.pend.has(c) ? ' pend' : ''}${hit && hit.has(c) ? ' hit' : ''}`,
    'data-card': c,
  }, c.startsWith('x:') ? ctx.cardEl(null) : ctx.cardEl(ctx.parseCard(c)))));
}

export const label = (ctx, name, value) => ctx.h('span', { class: 'bjl' }, name, ctx.h('b', {}, value || ' '));

/** Desteden yerine uçur (açık ya da kapalı); inince görünür */
export async function dealIn(ctx, id, { delay = 0, face = true, dur = 'deal' } = {}) {
  const { A } = ctx;
  await A.fly(ctx.cardEl(null), ctx.deckBox(), ctx.cardBox(id), {
    duration: A.dur(dur), easing: A.EASE.land, delay, flipTo: face && !id.startsWith('x:') ? ctx.cardEl(ctx.parseCard(id)) : null,
  });
  ctx.reveal(id);
}

/** Sırayla dağıt: ids hepsi pend olarak çizilmiş olmalı */
export async function dealAll(ctx, ids, gapMul = 0.55) {
  const gap = ctx.A.dur('deal') * gapMul;
  await Promise.all(ids.map((id, k) => dealIn(ctx, id, { delay: k * gap })));
}

/** Yerinde çevir (kapalı → açık) */
export async function turnUp(ctx, fromId, toCard) {
  const el = ctx.body.querySelector(`[data-card="${CSS.escape(fromId)}"]`);
  await ctx.A.flipInPlace(el, ctx.cardEl(ctx.parseCard(toCard)));
}

/** Masadaki bütün kartları desteye topla */
export async function collect(ctx) {
  const { A } = ctx;
  const els = [...ctx.body.querySelectorAll('.bjc[data-card]')];
  const to = ctx.deckBox();
  await Promise.all(els.map((el, k) => {
    const from = A.box(el);
    el.classList.add('pend');
    const id = el.dataset.card;
    return A.fly(id.startsWith('x:') ? ctx.cardEl(null) : ctx.cardEl(ctx.parseCard(id)), from, to, { duration: A.dur('collect'), easing: A.EASE.leave, delay: k * A.dur('collectStagger') * 0.6, fadeEnd: true, silent: k > 0 });
  }));
}

/** Bahis paneli */
export function betPanel(ctx, title, moves, text = (m) => String(m.v)) {
  const { h } = ctx;
  return h('div', { class: 'announce panel' }, h('b', {}, title),
    h('div', { class: 'pgrid' }, moves.map((m) => h('button', { class: 'btn', onclick: () => ctx.respond(m) }, text(m)))));
}
