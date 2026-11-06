// Tek kişilik oyunların yancı ipucu metinleri (tutor.js LABEL / EXPLAIN tablolarına eklenir).
// Kart adları yazıyla ve Türkçe ekleriyle: "Sinek 2'yi Kupa 3'ün üstüne koy".
import { SUIT_NAME_TR, RANK_NAME_TR } from '../core/cards.js';

const rk = (c) => parseInt(c.slice(1), 10);
const name = (c) => `${SUIT_NAME_TR[c[0]]} ${RANK_NAME_TR[rk(c)] ?? rk(c)}`;
// belirtme (-ı) ve ilgi (-ın) ekleri, rakamın okunuşuna göre
const ACC = { 2: "'yi", 3: "'ü", 4: "'ü", 5: "'i", 6: "'yı", 7: "'yi", 8: "'i", 9: "'u", 10: "'u", 11: "'yi", 12: "'ı", 13: "'ı", 14: "'ı" };
const GEN = { 2: "'nin", 3: "'ün", 4: "'ün", 5: "'in", 6: "'nın", 7: "'nin", 8: "'in", 9: "'un", 10: "'un", 11: "'nin", 12: "'ın", 13: "'ın", 14: "'ın" };
const acc = (c) => `${name(c)}${ACC[rk(c)]}`;
const gen = (c) => `${name(c)}${GEN[rk(c)]}`;
const top = (a) => a[a.length - 1];
const cardOf = (x) => (x && typeof x === 'object' ? x.c : x);

/** Hamlede taşınan ilk kart */
function moving(v, m) {
  const i = +m.from.slice(1);
  if (m.from === 'w') return cardOf(top(v.w));
  if (m.from[0] === 'c') return v.c[i];
  if (m.from[0] === 'f') return top(v.f[i]);
  const col = v.t[i];
  return cardOf(col[col.length - m.n]);
}

function label(v, m) {
  if (m.t === 'undo') return 'Geri al';
  if (m.t === 'resign') return 'Bitir';
  if (m.t === 'deal') return 'Desteden dağıt';
  if (m.t === 'draw') return v.s.length ? 'Desteden kart aç' : 'Desteyi çevir';
  const c = moving(v, m);
  if (m.to === 'w') return `${acc(c)} açık kartın üstüne at`;
  if (m.to[0] === 'f') return `${acc(c)} temele çıkar`;
  if (m.to[0] === 'c') return `${acc(c)} boş hücreye koy`;
  const dst = v.t[+m.to.slice(1)];
  const what = m.n > 1 ? `${name(c)} ile başlayan diziyi` : acc(c);
  return dst.length ? `${what} ${gen(cardOf(top(dst)))} üstüne koy` : `${what} boş sütuna koy`;
}

function explain(v, m) {
  if (m.t === 'undo') return 'Hamle kalmadı; geri alıp başka bir yol dene.';
  if (m.t === 'resign') return 'Buradan çıkış yok gibi.';
  if (m.t === 'deal') return 'Masada işe yarar hamle kalmadı, yeni kartlar gelsin.';
  if (m.t === 'draw') return v.s.length ? 'Masada oynanacak kart yok, desteye bak.' : 'Açıktakileri ters çevir, baştan bakalım.';
  if (m.to === 'w') return 'Masadan bir kart daha eksilir; arkasından başkaları da gelebilir.';
  if (m.to[0] === 'f') return 'Temele çıkan kart bir daha dert olmaz.';
  if (m.to[0] === 'c') return 'Hücre geçici yer; altındaki kartları kurtarmak için.';
  if (m.from[0] === 't') {
    const col = v.t[+m.from.slice(1)];
    const rest = col.slice(0, col.length - m.n);
    if (!rest.length) return 'Sütun boşalır; boş sütun çok işe yarar.';
    if (rest[rest.length - 1] && rest[rest.length - 1].up === false) return 'Altındaki kapalı kart açılır.';
  }
  const dst = v.t[+m.to.slice(1)];
  if (v.suits && dst.length && cardOf(top(dst))[0] === moving(v, m)[0]) return 'Aynı renkten dizi büyüyor; papazdan asa tamamlanınca masadan kalkar.';
  return 'Kartlar düzene giriyor, altta kalanlara yol açılır.';
}

export const SOL_LABEL = { solitaire: label, golf: label, freecell: label, spider: label };
export const SOL_EXPLAIN = { solitaire: explain, golf: explain, freecell: explain, spider: explain };
