# Kart Salonu — Hedef

## Ne yapıyoruz
Telefonda ve bilgisayarda oynanan, tek uygulamada birçok kart oyunu. Görünüş: Avrora Pişti gibi
(saf yeşil masa, klasik beyaz kartlar, mavi-kırmızı desenli kart arkası, "000" sayaç kutuları, beyaz menü çubuğu).

## Kararlar
- **Platform:** PWA (HTML/JS). Tek kod tabanı; telefonda ana ekrana eklenir, bilgisayarda tarayıcıda açılır.
- **Mobil öncelikli:** dikey ekran, büyük dokunma alanları, el altta yelpaze.
- **Botlar ortak:** Tek bir bot sistemi tüm oyunlarda çalışır. Aynı oyuncular (ad, seviye, tarz, hız)
  tüm oyunlarda oturur. Ayarlar > Oyuncular'dan düzenlenir.
- **Kurallar ayarlanabilir:** Kural farklarının olduğu yerlerde (örn. King'de koz üstüne çıkma zorunluluğu)
  Ayarlar'da seçenek olacak.
- **Oyun ekleme kolay olmalı:** Her oyun tek modül (`js/games/<oyun>.js`), sözleşme `js/core/game-api.js`.

## Oyun listesi ve aileleri
| Aile | Oyunlar |
| --- | --- |
| El alma | King (Rıfkı), Batak |
| Bahis | Teksas Poker |
| Per açma | Yanık, Fanti, Konken |
| Elden atma | Papaz Kaçtı, Eşek, Pis 7'li |
| İhale / açma (araştırılacak) | Hoşkin, Dost Kazığı, 66 (Altmışaltı) |
| Araştırılacak (aile belli değil) | Kambur, Blöf, Kaptıkaçtı |
| Kasaya karşı (çip) | Blackjack (Teksas ile ortak çip sistemi) |
| Tek kişilik | Solitaire, Golf, Spider, FreeCell (tamam, v1.8; bot yok, yancı ipucu verir) |
| Per açma (ek) | Gin Rummy (v1.2), 51 |

Not: Yanık'ın kuralını kullanıcı da bilmiyor; birlikte öğrenilecek. Sıra: King → Batak → Teksas → diğerleri.
Pişti (referans oyun) isteğe bağlı olarak başa eklenebilir.

## Aşamalar
1. **Çekirdek + oyuncu sistemi + ayarlar** (tamam, v0.1)
2. King (kurallar `KING-KURALLARI.md`'de)
3. Batak (tamam, v0.5)
4. Teksas Poker (tamam, v0.5)
   Ek: Blackjack, Blöf (tamam, v0.5), Fanti, Konken (tamam, v0.6). Kambur: kuralları bekliyor.
   Yönerge, online hissi (süre halkası), bot sohbeti, D · Salon görünümü (v0.6-v0.7).
5. Per açma ailesi (Yanık, Fanti, Konken), elden atma ailesi (Papaz Kaçtı, Eşek)
6. PWA kabuğu (tamam, v1.6; GitHub Pages).
7. Tek kişilik oyunlar (tamam, v1.8).
8. Kumarhane ve Kılıç (tamam, v1.9): Kılıç, At Yarışı, Bakara, Üç Kart Poker, Casino Savaşı. Türk Pokeri ve Kart Barbutu iptal.

## Sonra yapılacaklar (06.11.2026, menüden kaldırıldı)
Kullanıcı: "pasif oyunları kaldır, not al, sonra yapacağız". Menüde artık yalnız oynanabilir oyunlar var.
Bu oyunlar `js/games/index.js`'te `status: 'soon'` olarak duruyor (menüde görünmez); kuralları doğrulanınca yazılacak:
- 51 (per açma, 4 kişi)
- Hoşkin (ihaleli açma, 3-4 kişi)
- Dost Kazığı
- Pis 7'li
- Kambur
- Kaptıkaçtı
Ayrıca bekleyen küçük işler: telefonda 4 kişilik At Yarışı'nda kulvarlar dar; yatay ekranda alt bilgi yazısının son satırı kesiliyor (Blackjack ve kumarhane oyunları); 3 hazır oyuncunun adları (fotoğraflar depoya konmaz).

## Kapsam dışı (şimdilik)
Çevrimiçi çok oyunculu, hesap/giriş, gerçek para.
