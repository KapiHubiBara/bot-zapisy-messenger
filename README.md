# bot-zapisy-messenger
Jestem statystykiem w lidze siatkówki. Na każdą kolejkę obowiązują zapisy kto pierwszy na grupie na messengerze. Z racji tego, że nie zawsze mam telefon pod ręką, a zapisy są o różnych godzinach, to mogę nie zdążyć. Stąd ten bot


# Bot do Automatycznych Zapisów na Messengerze (One-Shot)

Automatyczny bot w Node.js & Puppeteer przeznaczony do błyskawicznego odpowiadania na wiadomości w wybranej grupie lub czacie na Messengerze. 

Bot działa w **trybie bezawaryjnym (One-Shot)**:
- Zlicza obecną historię wiadomości na starcie (ignoruje stare wiadomości).
- Czeka na pojawienie się słowa kluczowego (np. `zapisy`).
- Po wykryciu nowej wiadomości natychmiast wysyła ustawioną odpowiedź (np. `pakiet 1`).
- **Po wysłaniu wiadomości automatycznie wyłącza się i zamyka przeglądarkę**, wykluczając ryzyko spamu czy pętli.

---

## Wymagania wstępne

Zanim uruchomisz bota, upewnij się, że masz zainstalowane:
1. **Node.js** (wersja 18 lub nowsza) – [Pobierz Node.js](https://nodejs.org/)
2. Edytor kodu (np. **PyCharm**, **VS Code**) lub zwykły terminal systemowy.

---

## Pierwsze uruchomienie (Instalacja)

1. Otwórz projekt w edytorze kodu lub przejdź do folderu w terminalu.
2. Zainstaluj wymagane biblioteki, wpisując w terminalu polecenie:

```bash
npm install
```

*(Jeśli pobierasz sam plik `index.js`, zainstaluj potrzebne zależności ręcznie):*
```bash
npm install puppeteer otplib
```

---

## Konfiguracja Bota (`index.js`)

Wszystkie ustawienia znajdują się na samym początku pliku `index.js` w sekcji **KONFIGURACJA**:

```javascript
// ================= KONFIGURACJA =================
const ID_GRUPY = "3225092577679626"; // ID wybranego czatu
const SLOWO_KLUCZ = "zapisy";          // Słowo wyzwalające odpowiedź
const WYBRANY_PAKIET = "pakiet 1";      // Treść wysyłanej odpowiedzi
// ================================================
```

### 1. Jak zmienić Czat / Grupę (`ID_GRUPY`)?
1. Otwórz Messengera w przeglądarce i wejdź w konwersację, w której ma działać bot.
2. Spójrz na adres URL w pasku przeglądarki:
   `https://www.facebook.com/messages/t/3225092577679626`
3. Skopiuj sam ciąg cyfr z końca adresu (`3225092577679626`) i wklej go do zmiennej `ID_GRUPY`.

### 2. Jak zmienić Słowo Wyzwalające (`SLOWO_KLUCZ`)?
Wpisz słowo lub frazę, na którą bot ma zareagować (wielkość liter nie ma znaczenia):
```javascript
const SLOWO_KLUCZ = "zapisy"; // Bot zareaguje na "zapisy", "ZAPISY", "Zapisy" itp.
```

### 3. Jak zmienić Wiadomość Odpowiedzi (`WYBRANY_PAKIET`)?
Wpisz dokładny tekst, który bot ma wkleić i wysłać po wykryciu słowa kluczowego:
```javascript
const WYBRANY_PAKIET = "pakiet 1"; // Przykładowa odpowiedź
```

---

## Jak uruchomić Bota?

1. Otwórz terminal w folderze projektu.
2. Wpisz polecenie:

```bash
node index.js
```

3. **Pierwsze logowanie:**
   - Przy pierwszym uruchomieniu otworzy się okno przeglądarki Chrome.
   - Jeśli nie jesteś zalogowany, zaloguj się na konto Facebook i przejdź do czatu (w razie potrzeby wpisz PIN do wiadomości szyfrowanych).
   - Zalogowana sesja zostanie **na stałe zapisana w lokalnym folderze `./fb_session`**.

4. **Kolejne uruchomienia:**
   - Przeglądarka otworzy się i od razu wejdzie wprost na załadowany czat bez pytania o hasła czy numery 2FA.

---

## Tryb Ukryty (Działanie cicho w tle)

Domyślnie podczas pracy bota na ekranie pojawia się okno Chrome (`headless: false`). 

Jeśli chcesz, aby w poniedziałek rano bot działał **całkowicie niezauważalnie w tle**:
1. Otwórz `index.js`.
2. Zmień linijkę z `headless: false` na:

```javascript
const browser = await puppeteer.launch({
  headless: "new", // Przeglądarka działa w tle bez otwierania okna na pulpicie
  userDataDir: "./fb_session",
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
});
```

---

## 🔒 Bezpieczeństwo i Pewność Działania

- **Brak blokad od Facebooka:** Skrypt uruchamia się lokalnie z Twojego domowego adresu IP, więc Meta nie generuje alertów o podejrzanym logowaniu z zagranicznych serwerów.
- **Ochrona przed wysłaniem na złym czacie:** Jeśli w otwartym oknie ręcznie przełączysz czat, bot wykryje zmianę adresu URL i automatycznie wróci na dedykowaną grupę.
- **Brak spamu / powtórzeń:** Po wyemitowaniu wiadomości pętla jest natychmiast przerywana, proces Node.js zostaje zamknięty, a okno przeglądarki zniszczone.
