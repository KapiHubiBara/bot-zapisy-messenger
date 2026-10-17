const puppeteer = require("puppeteer");

// ================= KONFIGURACJA =================
const ID_GRUPY = "3225092577679626"; // ID wybranego czatu
const SLOWO_KLUCZ = "zapisy";          // Słowo wyzwalające odpowiedź
const WYBRANY_PAKIET = "pakiet 1";      // Treść wysyłanej odpowiedzi
// ================================================

(async () => {
  console.log("Uruchamianie bota w trybie błyskawicznym (One-Shot)...");

  const browser = await puppeteer.launch({
    headless: false, // Zmień na "new" jeśli chcesz, aby przeglądarka działała w tle
    userDataDir: "./fb_session",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const targetUrl = `https://www.facebook.com/messages/t/${ID_GRUPY}`;
  console.log(`Otwieranie czatu: ${targetUrl}`);

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  } catch (e) {}

  // Krótka pauza na wyrenderowanie wiadomości z zapamiętanej sesji
  await new Promise(r => setTimeout(r, 2000));

  // KROK 1: Zliczenie obecnych wystąpień słowa kluczowego w czacie
  const initialCount = await page.evaluate((keyword) => {
    const mainChat = document.querySelector('[role="main"]');
    if (!mainChat) return 0;

    const elements = Array.from(mainChat.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
    return elements.filter(el => (el.innerText || "").toLowerCase().includes(keyword.toLowerCase())).length;
  }, SLOWO_KLUCZ);

  console.log(`BOT READY! Wykryto ${initialCount} dotychczasowych wiadomości z "${SLOWO_KLUCZ}".`);
  console.log(" Czekam na nową wiadomość...");

  let isProcessing = false;

  // KROK 2: NASŁUCHIWANIE NA WZROST LICZBY WIADOMOŚCI
  const intervalId = setInterval(async () => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const currentUrl = page.url();

      // Powrót do grupy jeśli zmieniono czat
      if (!currentUrl.includes(ID_GRUPY)) {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
        await new Promise(r => setTimeout(r, 1500));
        isProcessing = false;
        return;
      }

      // Liczymy aktualną liczbę wystąpień słowa kluczowego w głównym oknie
      const currentCount = await page.evaluate((keyword) => {
        const mainChat = document.querySelector('[role="main"]');
        if (!mainChat) return 0;

        const elements = Array.from(mainChat.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
        return elements.filter(el => (el.innerText || "").toLowerCase().includes(keyword.toLowerCase())).length;
      }, SLOWO_KLUCZ);

      // Gdy spłynie nowa wiadomość zawierająca słowo kluczowe
      if (currentCount > initialCount) {
        console.log(`[NOWA WIADOMOŚĆ]: Wzrost z ${initialCount} do ${currentCount}. Wysyłam pakiet...`);

        const inputSelector = '[role="main"] div[role="textbox"], [role="main"] p[dir="auto"], [role="main"] div[contenteditable="true"]';
        const inputFound = await page.$(inputSelector);

        if (inputFound) {
          // Czyszczenie pola
          await page.evaluate((selector) => {
            const input = document.querySelector(selector);
            if (input) {
              input.focus();
              document.execCommand('selectAll', false, null);
              document.execCommand('delete', false, null);
            }
          }, inputSelector);

          await new Promise(r => setTimeout(r, 50));

          // Wklejenie tekstu pakietu
          await page.evaluate((textToInsert) => {
            document.execCommand('insertText', false, textToInsert);
          }, WYBRANY_PAKIET);

          await new Promise(r => setTimeout(r, 100));
          await page.keyboard.press("Enter");
          console.log(`SUKCES! Wysłano odpowiedź: "${WYBRANY_PAKIET}"`);

          // ZAKOŃCZENIE PRACY BOTA
          clearInterval(intervalId);
          console.log("Zadanie wykonane. Wyłączam bota.");
          await new Promise(r => setTimeout(r, 1500));
          await browser.close();
          process.exit(0);
        }
      }
    } catch (err) {
    } finally {
      isProcessing = false;
    }
  }, 200);
})();