// Yancı: oyuncunun sağ alt yanında oturan karakter; yönerge ve oyun sohbeti onun konuşma balonundan gelir.
// Modlar (ayar 'yanciMode'): 'yonerge' (öneri + hamle yorumu), 'sohbet' (oyunu muhabbetle takip eder, ders vermez), 'kapali'.
// Balon yerinde güncellenir (yeniden çizim beklemez; uçuş sırasında da güvenli). Kahvehane içeceği cafe.node('y') ile gelir.
import { avatarNode } from './avatar.js';
import { sfx } from './sfx.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

const L = {
  good: ['Aferin, tam benim aklımdaki.', 'İşte böyle oynanır!', 'Güzel, sağlam hamle.', 'Ustaca. Devam.', 'Bunu ben de yapardım.'],
  bad: ['Hmm… ben olsam {m} derdim.', 'Olsun, ama {m} daha iyiydi.', 'Aceleye geldi gibi; {m} vardı.', 'Bir dahakine {m}, unutma.'],
  myTurn: ['Sıra sende, acele etme.', 'Hadi bakalım, göster kendini.', 'Düşün taşın, sonra at.', 'Bu el önemli, dikkat.'],
  botMove: ['{n} hızlı oynadı.', '{n} bir şey biliyor galiba.', '{n} pek keyifli değil.', '{n}\'e dikkat et, sinsi oynuyor.', 'Şu {n}\'in eli iyi gibi.'],
  gain: ['İşte bu! Puanlar geliyor.', 'Oh be, bu el bizim.', 'Gördün mü, sabır kazandırır.'],
  loss: ['Eyvah, bu pahalıya patladı.', 'Olur böyle, toparlarız.', 'Canı sağolsun, sıradaki ele bak.'],
  lead: ['Öndeyiz, bozmayalım.', 'Rahat ol, masa senin.'],
  behind: ['Gerideyiz ama oyun bitmedi.', 'Biraz açılmamız lazım.'],
  idle: ['Ocakçı çayı iyi demlemiş bugün.', 'Eskiden bu masada sabaha kadar oynardık.', 'Şu tavla şakırtısı da olmasa…', 'Dışarıda yağmur başladı galiba.', 'Kâğıdın da kısmeti var, bekle.', 'Sen oyna, ben seyrederim.'],
  thanks: ['Sağ ol, eline sağlık!', 'Çay mı? Hiç hayır demem.', 'Eksik olma, demli olmuş.'],
  refill: ['Ocakçı, benim çay bitti!', 'Bir çay daha alayım.', 'Usta, bir tavşan kanı!'],
  win: ['Helal olsun! Kazandık!', 'Çaylar kaybedenden!'],
  lose: ['Bu sefer olmadı, rövanş!', 'Kaybettik ama iyi oynadın.'],
  start: ['Hadi bakalım, hayırlısı.', 'Kartlar dağılıyor, gözüm üstünde.', 'Bugün şanslı günündesin, hissediyorum.'],
};

export const YANCI_MODES = [['yonerge', 'Yönerge (öneri ve yorum)'], ['sohbet', 'Sohbet (oyunu muhabbetle takip eder)'], ['kapali', 'Kapalı']];
export const YANCI_DEFAULT = { name: 'Hüsnü Abi', avatar: '👴' };

/** deps: { h, settings, cafe } */
export function createYanci(deps) {
  const { h, settings } = deps;
  let talk = ''; // sohbet modunda son söz
  let lastSaid = 0;
  let bubble = null;
  const mode = () => settings.get('yanciMode') || 'yonerge';
  const name = () => settings.get('yanciName') || YANCI_DEFAULT.name;
  const fill = (t, o = {}) => t.replace('{m}', o.m ?? '').replace('{n}', o.n ?? '');

  /** Sohbet modunda söyle (sık konuşmasın): force önemli anlar için */
  function say(text, force = false) {
    if (mode() !== 'sohbet' || !text) return;
    const now = performance.now();
    if (!force && now - lastSaid < 3500) return;
    lastSaid = now;
    talk = text;
    sfx.msg();
    if (bubble?.isConnected) {
      bubble.replaceChildren(h('div', { class: 'ytalk' }, talk));
      bubble.parentElement.classList.remove('empty');
      bubble.parentElement.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 250 });
    }
  }

  /** Kahvehane ve oyun olayları (sohbet modunda) */
  const api = {
    mode,
    on: () => mode() !== 'kapali',
    reset() {
      talk = '';
      lastSaid = 0;
    },
    start() {
      say(pick(L.start), true);
    },
    thanks() {
      if (mode() === 'kapali') return;
      const t = pick(L.thanks);
      if (mode() === 'sohbet') say(t, true);
      else if (bubble?.isConnected) {
        // yönerge modunda teşekkür kısa süre balonun başında görünür
        const el = h('div', { class: 'ytalk' }, t);
        bubble.prepend(el);
        bubble.parentElement.classList.remove('empty');
        setTimeout(() => el.remove(), 3500);
      }
    },
    refill() {
      say(pick(L.refill), true);
    },
    /** İnsanın hamlesi değerlendirildikten sonra */
    afterMine(rev) {
      if (!rev) return;
      if (rev.good) say(pick(L.good), Math.random() < 0.5);
      else say(fill(pick(L.bad), { m: rev.betterLabel || 'başka bir şey' }), true);
    },
    /** Herhangi bir hamle sonrası: puan değişimi ve rakip hamleleri */
    afterMove({ seat, isBot, nameOf, sBefore, sAfter, myTurnNext }) {
      if (mode() !== 'sohbet') return;
      if (sBefore && sAfter && sAfter[0] !== sBefore[0]) {
        const d = sAfter[0] - sBefore[0];
        say(pick(d > 0 ? L.gain : L.loss), true);
        return;
      }
      if (isBot && Math.random() < 0.18) {
        say(fill(pick(L.botMove), { n: nameOf(seat) }));
        return;
      }
      if (sAfter && Math.random() < 0.06) {
        const me = sAfter[0];
        const best = Math.max(...sAfter.filter((_, i) => i !== 0));
        say(pick(me >= best ? L.lead : L.behind));
        return;
      }
      if (myTurnNext && Math.random() < 0.2) say(pick(L.myTurn));
      else if (Math.random() < 0.05) say(pick(L.idle));
    },
    end(won) {
      say(pick(won ? L.win : L.lose), true);
    },

    /**
     * Yancının düğümü. lines: yönerge modunda gösterilecek satırlar (table-kit hazırlar), drink: kahvehane içeceği
     */
    node({ lines = [], drink = null } = {}) {
      if (mode() === 'kapali') {
        // süre bitti uyarısı gibi zorunlu satırlar yine görünsün (balonsuz, küçük)
        return lines.length ? h('div', { class: 'yanci off' }, h('div', { class: 'ybubble' }, h('div', { class: 'ybin' }, lines))) : null;
      }
      const content = mode() === 'yonerge' ? lines : talk ? [h('div', { class: 'ytalk' }, talk)] : [];
      bubble = h('div', { class: 'ybin' }, content);
      const outer = h('div', { class: `ybubble${content.length ? '' : ' empty'}`, role: 'status' }, bubble);
      const av = h('div', { class: 'yav', title: name() }, avatarNode(settings.get('yanciPhoto') || '', settings.get('yanciAvatar') || YANCI_DEFAULT.avatar),
        h('span', { class: 'yname' }, name()), drink ? h('span', { class: 'ydrink' }, drink) : null);
      return h('div', { class: 'yanci' }, outer, av);
    },
  };
  return api;
}
