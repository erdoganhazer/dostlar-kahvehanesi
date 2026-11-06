# Kumarhane oyunları ve Kılıç — kurallar ve kaynaklar

Ortak (Blackjack gibi): her oyuncu 1000 çiple başlar, 10 el, bahis 50 / 100 / 200. Her ele yeni karılmış tek deste.
Çipi en az bahse yetmeyen oyuncu o eli oynamaz. Oyun motorları `js/games/<id>.js`, ortak parça `casino-common.js`.

## Kılıç (kahvehane) — `kilic.js`
Kaynaklar: iskambilci.com ve iskambill.com "Kılıç nasıl oynanır", ekşi sözlük "kılıç çekmek" (Şabaniye: "kumar oynayalım, kılıç açalım").
- İki kişi. Biri bir kart söyler ("Sinek 7"). Karılmış deste bir söyleyenin, bir rakibinin önüne tek tek açılır.
- Söylenen kart kimin önüne düşerse bahsi o kazanır. Şans tam yarı yarıya.
- Kullanıcının seçimi (06.11.2026): tam kart söylenir (yalnız sayı değil), yalnız 2 kişi.
- Bizim seçim: söyleme sırası her elde değişir; bahsi söyleyen belirler; ilk kart söyleyenin önüne açılır.

## At Yarışı — `atyarisi.js`
Kaynak: kullanıcının anlattığı kural (06.11.2026).
- En fazla 4 kişi. Herkes bir renge (ata) oynar. Kartlar sırayla açılır, renklerine göre dört kulvarda dizilir.
  Bütün kartları (13) ilk açılan renk kazanır.
- Bizim seçim: aynı ata birden çok kişi oynayabilir; kazanan ata oynayan bahsinin 3 katını kazanır (4 at, adil oran),
  diğerleri bahsini kaybeder.

## Bakara (Punto Banco) — `bakara.js`
Kaynaklar: officialgamerules.org Baccarat, Singapur GRA "Commission Baccarat" kuralları, mathproblems.info.
- Bahis: Oyuncu eli, Kasa eli, Beraberlik. Değer: as 1, 2–9 kendi, 10/resim 0; toplamın son basamağı.
- İkişer kart (oyuncu, kasa, oyuncu, kasa). 8–9 natürel: kimse çekmez. Oyuncu 0–5 çeker, 6–7 durur.
- Kasa: oyuncu çekmediyse 0–5 çeker. Çektiyse: 0–2 her zaman; 3 (oyuncunun 3. kartı 8 değilse); 4 (2–7); 5 (4–7); 6 (6–7); 7 durur.
- Ödeme: Oyuncu 1:1, Kasa 1:1 eksi %5 (aşağı yuvarlanır: 50 → 47), Beraberlik 8:1; beraberlikte Oyuncu/Kasa iade.
- Bizim seçim: tek deste (kumarhanede 6–8 deste; oranlar çok az değişir).

## Üç Kart Poker — `ucpoker.js`
Kaynaklar: Caesars "How to play 3 Card Poker", Pennsylvania 58 Pa. Code §649a.11, deucescracked (Q-6-4 kuralı).
- Ante → 3 kart → Oyna (ante kadar oyun bahsi) ya da Çekil (ante gider).
- El sırası: renk serisi > üçlü > seri > renk > çift > yüksek kart. A-2-3 en küçük seri, Q-K-A en büyük.
- Kasa kız yüksek ya da üstüyle açar. Açamazsa ante 1:1, oyun iade. Açarsa: yenen ante ve oyun 1:1; yenilen ikisini kaybeder; eşitlik iade.
- Ante bonusu (oynayana, kasa ne olursa olsun): seri 1:1, üçlü 4:1, renk serisi 5:1.
- Bizim seçim: Pair Plus yan bahsi yok.

## Casino Savaşı — `savas.js`
Kaynaklar: Wikipedia "Casino War", casinos.com, bandarpoker "Card Games Encyclopedia".
- Bahis → oyuncuya ve kasaya birer açık kart; büyük kazanır (as en büyük), 1:1.
- Eşitlik: Teslim (bahsin yarısı gider) ya da Savaş (bahis kadar daha koy). Kasa 3 kart yakar, savaşanlara ve kendine birer kart verir.
  Oyuncunun kartı ≥ kasanınki: ek bahis 1:1 kazanır, ilk bahis iade. Küçükse ikisi gider.
- Bizim seçim: tek deste, beraberlik yan bahsi yok, savaşta ikinci eşitlik oyuncunun lehine (bonus yok).

## İptal edilenler
Türk Pokeri ve Kart Barbutu: kullanıcı kuralları bilmiyor, iptal (06.11.2026).
