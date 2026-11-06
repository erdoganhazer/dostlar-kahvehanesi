// Oyun kaydı. Yeni oyun eklemek = js/games/<oyun>.js yazıp buraya bir satır eklemek.
// status: 'ready' (oynanabilir) | 'soon' (menüde görünür, henüz kapalı)
export const GAMES = [
  { id: 'king', name: 'King', desc: '4 kişilik el alma oyunu', players: '4', status: 'ready' },
  { id: 'pisti', name: 'Pişti', desc: 'Yığını al, pişti yap', players: '2-4', status: 'ready' },
  { id: 'batak', name: 'Batak', desc: 'İhaleli koz oyunu', players: '4', status: 'ready' },
  { id: 'teksas', name: 'Teksas Poker', desc: 'Texas Hold’em, çiple', players: '2-4', status: 'ready' },
  { id: 'yanik', name: 'Yanık', desc: 'Per aç, işle, 100\'ü geçme', players: '2-4', status: 'ready' },
  { id: 'papazkacti', name: 'Papaz Kaçtı', desc: 'Eşleştirip elden çıkarma, papaz sende kalmasın', players: '2-6', status: 'ready' },
  { id: 'esek', name: 'Eşek', desc: 'Kart atma oyunu, son kalan eşek olur', players: '2-6', status: 'ready' },
  { id: 'fanti', name: 'Fanti', desc: '11 yap, kartları topla', players: '2 veya 4', status: 'ready' },
  { id: 'konken', name: 'Konken', desc: 'Elini per ve seriyle bitir', players: '2-4', status: 'ready' },
  { id: 'gin', name: 'Gin Rummy', desc: 'Kapı de ya da gin yap, 100\'e ilk ulaş', players: '2', status: 'ready' },
  { id: '51', name: '51', desc: 'Per açma oyunu (kuralları birlikte doğrulayacağız)', players: '4', status: 'soon' },
  { id: 'hoskin', name: 'Hoşkin', desc: 'İhaleli açma ve el alma oyunu (kuralları araştırılacak)', players: '3-4', status: 'soon' },
  { id: 'dostkazigi', name: 'Dost Kazığı', desc: 'Kuralları araştırılacak', players: '?', status: 'soon' },
  { id: 'pis7', name: 'Pis 7’li', desc: 'Kuralları araştırılacak', players: '?', status: 'soon' },
  { id: 'kambur', name: 'Kambur', desc: 'Kuralları araştırılacak', players: '?', status: 'soon' },
  { id: 'altmisalti', name: '66 (Altmışaltı)', desc: 'Evlilik ve koz puanlı el alma', players: '2', status: 'ready' },
  { id: 'blof', name: 'Blöf', desc: 'Kartları kapalı at, yalan söyle, yakalanma', players: '3-4', status: 'ready' },
  { id: 'kaptikacti', name: 'Kaptıkaçtı', desc: 'Kuralları araştırılacak', players: '?', status: 'soon' },
  { id: 'blackjack', name: 'Blackjack', desc: '21 oyunu, kasaya karşı', players: '1-4', status: 'ready' },
  { id: 'solitaire', name: 'Solitaire', desc: 'Tek kişilik klasik', players: '1', status: 'soon' },
  { id: 'golf', name: 'Golf', desc: 'Tek kişilik solitaire', players: '1', status: 'soon' },
  { id: 'spider', name: 'Spider', desc: 'Tek kişilik solitaire', players: '1', status: 'soon' },
  { id: 'freecell', name: 'Freecell', desc: 'Tek kişilik solitaire', players: '1', status: 'soon' },
];

// Oyun aileleri (ortak yardımcılar buna göre yazılacak):
//  el alma:     king, batak
//  bahis:       teksas
//  per açma:    yanik, fanti, konken, gin, 51
//  elden atma:  papazkacti, esek, pis7
//  ihale/açma:  hoskin, dostkazigi (kurallar araştırılınca ailesi netleşir)
//  kasaya karşı: blackjack (bahis ailesiyle ortak çip sistemi)
//  tek kişilik: solitaire, golf, spider, freecell (bot yok; motor tek insan koltuğuyla çalışır)

/** Oynanabilir oyunun modülünü yükler. Henüz hiçbiri hazır değil. */
export async function loadGame(id) {
  const meta = GAMES.find((g) => g.id === id);
  if (!meta || meta.status !== 'ready') throw new Error(`'${id}' henüz hazır değil`);
  const mod = await import(`./${id}.js`);
  return mod.default;
}
