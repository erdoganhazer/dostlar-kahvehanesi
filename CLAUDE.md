# Kart Salonu — çalışma kuralları (Claude için)

Bu projede çalışan her model (Sonnet, Opus) önce bunu okur.

## Dil ve iletişim
- Kullanıcıyla Türkçe konuş. Arayüz adımlarını tek tek sayma; "kaydet" de yeter.
- Büyük işten önce kısa plan ve seçenekler sun.
- Kullanıcı bir hatayı bir oyunda bildirirse, aynı hatayı **diğer bütün oyunlarda da ara ve düzelt**; söylemesini bekleme.

## Belgeler (her işten sonra güncelle)
- `docs/HEDEF.md` — ne yapıyoruz
- `docs/SUREC-GUNLUGU.md` — ne yapıldı, ne zaman, neden
- `docs/SERVIS-MANUELI.md` — nasıl çalışır, nasıl değiştirilir
- `docs/ANIMASYON-KURALLARI.md` — **ZORUNLU**: her yeni oyun ve ekran bu kurallara uyar
- `docs/KING-KURALLARI.md` vb. — oyun kuralları ve kaynakları

## Mimari
- Oyun kuralları: `js/games/<id>.js` (sözleşme `js/core/game-api.js`). Saf fonksiyonlar, arayüz yok.
- Botlar: `js/players/bot.js` ortak; oyun yalnızca `rateMove`/`determinize` verir.
- Ekran: `js/ui/<id>-table.js`, `createMatchScreen` (`js/ui/table-kit.js`) üstüne kurulur.
- Animasyon: `js/ui/anim.js` + `choreo` (table-kit.js). CSS'te animasyon yazma.
- Kart resimleri: `assets/cards/<S|H|D|C><2..14>.webp` (public domain Vector Playing Cards).

## Yeni oyun eklerken
1. Kuralları araştır, kaynaklarıyla `docs/` altına yaz; belirsiz noktaları kullanıcıya sor.
2. `js/games/<id>.js` + testler (`tests/run.js`), bot maçlarıyla doğrula.
3. `js/ui/<id>-table.js`: `docs/ANIMASYON-KURALLARI.md` §8 kontrol listesi.
4. `js/games/index.js` → `status: 'ready'`, `js/ui/app.js` routes.
5. Tarayıcıda 390px genişlikte oynat; konsolda `[animasyon kuralı` hatası çıkmamalı (bkz. ANIMASYON-KURALLARI §9); uçuş sırasında ekran görüntüleri al ve kontrol et (kaynak/hedef doğru mu,
   görüntü kart inmeden değişiyor mu, gizli kart görünüyor mu).
6. `node tests/run.js` geçmeli. Belgeleri güncelle.

## Sonradan eklenenler
- Yeni oyunlar: batak, blackjack, blof, teksas (poker). Kambur ve diğer "kuralları araştırılacak" oyunlar kural doğrulanmadan yazılmaz; uydurma kural yok.
- Motor eli bitirince hemen yenisini kuruyorsa olayda bitmiş elin görüntüsünü ver (docs/ANIMASYON-KURALLARI.md §11).
- Yeni oyun eklerken ayrıca: `js/ui/tutor.js` LABEL/EXPLAIN satırı (yönerge), gerekirse `js/ui/chat.js` onMove özel anı (sohbet).
- Görünüm: tema css/avrora.css sonundaki "TEMA D" bloğu (kullanıcının seçtiği tasarım). Yeni bileşen bu renkleri kullanır; `.pend` kuralı dosyanın en sonunda kalır.
