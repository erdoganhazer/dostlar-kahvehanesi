# Blackjack kuralları (Kart Salonu sürümü)

- 1-4 oyuncu (sen + botlar) krupiyeye karşı. Tek deste (52), her el yeniden karıştırılır. 10 el, herkes 1000 çip ile başlar.
- Bahis: 50, 100 ya da 200. Her oyuncuya 2 kart; krupiyenin biri açık, biri kapalı.
- Hamleler: Kart çek (hit), Dur (stand), Katla (double: yalnızca ilk iki kartta, bahis iki katına çıkar, tek kart çekilir ve el biter).
- As 11 ya da 1, vale/kız/papaz 10. İlk iki kart 21 ise Blackjack: 3:2 ödenir (krupiyede de varsa berabere).
- Krupiye açık kart As ya da 10 değerindeyse kapalı kartına bakar; Blackjack'i varsa el hemen biter.
- Krupiye 17'ye kadar çeker, yumuşak 17'de (A+6) durur.
- Yok: bölme (split), sigorta, teslim (surrender).
- Bot: temel strateji (`basicStrategy`), bahis tarzına göre.

Dosyalar: `js/games/blackjack.js`, `js/ui/blackjack-table.js`.
