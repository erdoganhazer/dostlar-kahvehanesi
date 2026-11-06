# Tek kişilik oyunlar — kurallar ve kaynaklar

Kaynaklar: Wikipedia (Klondike, Golf, FreeCell, Spider) ve pagat.com "Patience" bölümleri. Burada yazılanlar oyunların
en yaygın (Windows / mobil uygulamalarda bilinen) biçimleridir. Seçilen ayrıntılar aşağıda "Bizim seçim" olarak işaretli.

## Solitaire (Klondike) — `js/games/solitaire.js`
- 52 kart. Masada 7 sütun: 1..7 kart, her sütunun en üstündeki açık. Kalan 24 kart deste.
- Temel (4): her renk için astan papaza.
- Masada: kırmızı-siyah sırayla, birer azalarak. Açık dizinin tamamı ya da bir parçası birlikte taşınır.
- Boş sütuna yalnız papaz (ya da papazla başlayan dizi).
- Deste: dokununca 1 kart (ya da 3 kart, ayar `solDraw`) açılır. Bizim seçim: deste bitince açıklar ters çevrilip sınırsız tekrar.
- Temeldeki kart masaya geri alınabilir (Windows'taki gibi).

## Golf — `js/games/golf.js`
- 52 kart. Masada 7 sütun × 5 açık kart. Kalan 17 karttan biri açık kart olarak başlar, 16'sı deste.
- Sütunların en alttaki (öndeki) kartı, açık kartın bir büyüğü ya da bir küçüğüyse açığa atılır; renk önemsiz.
- Bizim seçim: as ile papaz arasında geçiş yok (asın üstüne yalnız 2, papazın üstüne yalnız kız).
- Hamle yoksa desteden yeni kart açılır. Deste bitip hamle kalmazsa oyun biter; puan masada kalan kart (az olan iyi). Masa temizlenirse kazanırsın.

## FreeCell — `js/games/freecell.js`
- 52 kart, hepsi açık, 8 sütuna (7,7,7,7,6,6,6,6). 4 boş hücre, 4 temel.
- Masada kırmızı-siyah sırayla azalan; boş sütuna her kart. Hücreye tek kart.
- Toplu taşıma: (boş hücre + 1) × 2^(boş sütun) karta kadar (hedef boş sütunsa o sütun sayılmaz). Bu, kartları tek tek hücreler üzerinden taşımanın kısaltmasıdır.
- Temelden geri alma yok (Microsoft FreeCell gibi).

## Spider — `js/games/spider.js`
- 104 kart (iki deste). 10 sütun: ilk 4'ü 6, diğer 6'sı 5 kart; en üstteki açık. Kalan 50 kart 5 dağıtım.
- Renk sayısı (ayar `spiderSuits`): 1 (8 maça destesi), 2 (maça+kupa), 4 (normal iki deste).
- Bir kart, rengi fark etmeksizin bir büyüğünün üstüne konur. Birlikte taşınacak dizi aynı renkten sıralı olmalı.
- Boş sütuna her kart. Kapalı kart, üstü boşalınca açılır.
- Dağıtım: her sütuna birer açık kart. Boş sütun varken dağıtılmaz.
- Papazdan asa aynı renkten tamamlanan dizi kendiliğinden masadan kalkar. 8 dizi kazanır.

## Ortak
- Her oyunda Geri al (sınırsız, son 300 hamle) ve Bitir (pes et). Hamle kalmayınca oyun bitmez: "Hamle kalmadı: geri al ya da bitir".
- Yancı (Şerif) burada da var: resmine dokununca sıradaki iyi hamleyi söyler (oyunun `rateMove` puanı; FreeCell'de bir adım ileri bakar; az önce yapılan hamleyi geri çeviren öneri verilmez).
