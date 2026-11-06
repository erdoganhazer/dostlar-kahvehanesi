# Teksas Poker kuralları (Kart Salonu sürümü)

- 2-4 oyuncu, herkes 1000 çip ile başlar, 12 el. Küçük/büyük kör 10/20'den başlar, her 4 elde ikiye katlanır.
- Herkese 2 kapalı kart; ortaya flop (3), turn (1), river (1). En iyi 5 kartlık el sayılır.
- Hamleler: Pas, Kontrol, Gör, Bahis/Yükselt (en az, yarım havuz, havuz boyu ya da All-in seçenekleri), All-in.
- Yan havuzlar doğru dağıtılır (kısa all-in yalnızca kendi payı kadar havuzu kazanabilir). Tek kalan oyuncu kartları göstermeden havuzu alır.
- El sırası: düz renk, dörtlü, full, renk, seri (A-2-3-4-5 en küçük seri), üçlü, iki çift, çift, yüksek kart.
- Çipi biten oyuncu elenir. İnsan oyuncu elenirse oyun biter.
- Bot: Monte Carlo eşitlik (rastgele rakip elleri) + havuz oranı; seviye gürültü ekler, tarz (temkinli/atak) blöf ve yükseltme isteğini değiştirir. Yükseltme savaşı sınırlıdır.
- Sınır: 2-4 kişi (6 kişilik masa düzeni henüz yok). Çip animasyonu yok, bahis miktarları yazıyla gösterilir.

Dosyalar: `js/games/poker.js`, `js/ui/poker-table.js`.
