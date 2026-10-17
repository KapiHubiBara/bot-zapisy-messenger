const puppeteer = require("puppeteer");

// ================= KONFIGURACJA =================
const ID_GRUPY = "3225092577679626"; // Ściśle określona grupa
const SLOWO_KLUCZ = "zapisy";        //wyzwalacz warunkowy, co musi sie pojawić żeby bot się aktywował
const WYBRANY_PAKIET = "pakiet 1";    // komunikat, który wyśle bot
const OPOZNIENIE_SEKUND = 8; // 
// ================================================

(async () => {
  console.log("Uruchamianie bota w trybie One-Shot z opóźnieniem...");

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

  await new Promise(r => setTimeout(r, 2000));

  // KROK 1: Zliczenie obecnych wystąpień słowa kluczowego w czacie
  const initialCount = await page.evaluate((keyword) => {
    const mainChat = document.querySelector('[role="main"]');
    if (!mainChat) return 0;

    const elements = Array.from(mainChat.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
    return elements.filter(el => (el.innerText || "").toLowerCase().includes(keyword.toLowerCase())).length;
  }, SLOWO_KLUCZ);

  console.log(`⚡ BOT READY! Wykryto ${initialCount} dotychczasowych wiadomości z "${SLOWO_KLUCZ}".`);
  console.log(` Czekam na nową wiadomość (ustawione opóźnienie wysłania: ${OPOZNIENIE_SEKUND}s)...`);

  let isProcessing = false;

  // KROK 2: NASŁUCHIWANIE NA WZROST LICZBY WIADOMOŚCI
  const intervalId = setInterval(async () => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const currentUrl = page.url();

      if (!currentUrl.includes(ID_GRUPY)) {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
        await new Promise(r => setTimeout(r, 1500));
        isProcessing = false;
        return;
      }

      const currentCount = await page.evaluate((keyword) => {
        const mainChat = document.querySelector('[role="main"]');
        if (!mainChat) return 0;

        const elements = Array.from(mainChat.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
        return elements.filter(el => (el.innerText || "").toLowerCase().includes(keyword.toLowerCase())).length;
      }, SLOWO_KLUCZ);

      // Gdy spłynie nowa wiadomość
      if (currentCount > initialCount) {
        console.log(`🚀 [NOWA WIADOMOŚĆ WYKRYTA!]: Odczekuję ${OPOZNIENIE_SEKUND} sekund przed wysłaniem...`);

        // SZTUCZNE OPÓŹNIENIE (np. 5000 ms = 5 sekund)
        await new Promise(r => setTimeout(r, OPOZNIENIE_SEKUND * 1000));

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
          console.log(`✅ SUKCES! Wysłano odpowiedź z opóźnieniem: "${WYBRANY_PAKIET}"`);

          // ZAKOŃCZENIE PRACY BOTA
          clearInterval(intervalId);
          console.log("🛑 Zadanie wykonane. Wyłączam bota.");
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
