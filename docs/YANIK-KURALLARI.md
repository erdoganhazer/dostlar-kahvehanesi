# Yanık kuralları (Kart Salonu sürümü)

Kaynaklar: ciftokey.com "Yanık oyunu kuralları", betlantis forum "Yanık oyunu", iskambilci.com "Yanık veya yükleme nasıl oynanır", Yanık (IGEO GAMES) uygulama açıklamaları (App Store, apkpure).
Kaynaklar temel kurallarda uyuşuyor. v1.1'den beri oyun kaynaklardaki gibi paralı: el sayısı yok, masada tek kişi kalana kadar sürer (kullanıcı isteği).

- 2 deste + 2 joker (106 kart), 2-4 kişi ("Yeni oyun"da sorulur). Herkese 10, başlayana 11 kart; başlayan ilk turda çekmeden atar.
- Sıran gelince desteden çekersin ya da yandan (önceki oyuncunun attığı) kartı alırsın; yandan alınca açmak zorunda değilsin.
- Per: aynı sayıdan farklı renkte 3-4 kart. Seri: aynı renkten ardışık 3+ kart (as 2'nin önüne ya da papazın arkasına). Joker her kartın yerine geçer.
  Çift: aynı kartın iki destesi ya da kart + joker.
- Açma: en az 2 per/seri ya da 4 çift. Şart: önceki ellerden cezan + açınca elinde kalanlar (atacağın kart hariç) ≤ 100.
- Açtıktan sonra: yeni per açabilir, yerdeki her pere kart işleyebilirsin (joker de işlenebilir). Elinde en az bir kart kalmalı (bitiş son kartı atarak olur).
- Joker alma: yerdeki bir perde jokerin yerini tutan kart sende varsa koyup jokeri alırsın (açmadan da).
- İşlenebilecek kartı yere atan (açmış oyuncu) 10 ceza yer.
- El sonu (biri biter ya da deste biter): herkes elinde kalan kadar ceza yer: 2-9 kendi değeri, 10/J/Q/K/A 10, joker 20. Çift açan 2 katını yer. Biten 0.
- Para: herkes girişte çanağa 50 koyar. Senin paran oyundan oyuna taşınır (ayar `wallet`, ilk 1000); 150'nin altına düşerse ocakçı 1000'e tamamlar.
- Yanma: toplam cezası 100'ü geçen yanar. Ya çekilir ya da son koyduğunun 2 katını çanağa koyup tekrar girer (50 → 100 → 200 …);
  tekrar girenin cezası yanmayanların en yüksek cezasından başlar. Parası yetmeyen çekilmek zorunda.
- Masada tek oyuncu kalınca çanağı o alır. Sen çekilirsen oyun orada biter: kalanlar arasından cezası en az olan çanağı alır (seni botların bitirmesini bekletmemek için).
- Bot kararı: çanaktaki pay ile tekrar girme bedeli tartılır; bedel paranın %40'ını geçiyorsa çekilmeye meyleder, atak botlar daha cesur.
- Arayüz: "Yere aç", "Çift aç", "Yeni per aç" düğmeleri en iyi dizilişi otomatik seçer. Karta dokununca işleme / joker alma / at seçenekleri çıkar.

Dosyalar: `js/games/yanik.js`, `js/ui/yanik-table.js`. Per bulucu Konken'le ortak (`solve(cards, jokerCezası)`).
