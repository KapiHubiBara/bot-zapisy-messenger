const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const http = require("http");
const fs = require("fs");

// ================= KONFIGURACJA =================
const ID_GRUPY = "3225092577679626";
const SLOWO_KLUCZ = "zapisy";
const WYBRANY_PAKIET = "pakiet 1";
const KOD_PIN = "062003"; // Twój 6-cyfrowy PIN Messenger
const PORT = process.env.PORT || 3000;
// ================================================

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot Puppeteer dziala i obserwuje czat!\n");
});

server.listen(PORT, () => {
  console.log(`Serwer HTTP uruchomiony na porcie ${PORT}`);
});

let cookies;
try {
  let appStateRaw = process.env.APPSTATE_JSON;
  if (!appStateRaw) {
    appStateRaw = fs.readFileSync("appstate.json", "utf8");
  }
  const parsed = JSON.parse(appStateRaw);

  cookies = parsed.map(c => ({
    name: c.key || c.name,
    value: c.value,
    domain: (c.domain || ".messenger.com").startsWith(".") ? c.domain || ".messenger.com" : "." + c.domain,
    path: c.path || "/",
    httpOnly: c.httpOnly || false,
    secure: true,
    sameSite: "Lax"
  }));
} catch (err) {
  console.error("Błąd wczytywania ciasteczek!", err);
  process.exit(1);
}

(async () => {
  console.log("Uruchamianie silnika Chromium (@sparticuz)...");

  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: executablePath,
    headless: chromium.headless,
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  console.log("Wgrywanie ciasteczek sesyjnych...");
  await page.setCookie(...cookies);

  const targetUrl = `https://www.messenger.com/t/${ID_GRUPY}`;
  console.log(`Otwieranie czatu: ${targetUrl}`);

  try {
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });
  } catch (e) {
    console.log("Strona załadowana (timeout pominięty).");
  }

  // --- AUTOMATYCZNE POKONANIE EKRANU LOGOWANIA / "KONTYNUUJ JAKO" ---
  try {
    await new Promise(r => setTimeout(r, 3000));
    
    // Kliknięcie w przycisk "Kontynuuj jako..." jeśli się pojawi
    const continueBtn = await page.$('[role="button"], button, div[tabindex="0"]');
    if (continueBtn) {
      const btnText = await page.evaluate(el => el.innerText, continueBtn);
      if (btnText.toLowerCase().includes("kontynuuj") || btnText.toLowerCase().includes("continue")) {
        console.log(`Wykryto ekran przejścia: "${btnText}". Klikam...`);
        await continueBtn.click();
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  } catch (e) {}

  // --- OBSŁUGA PIN-U DLA SZYFROWANIA E2EE ---
  try {
    console.log("Czekam na ewentualny modal z kodem PIN...");
    await new Promise(r => setTimeout(r, 4000));

    if (KOD_PIN && KOD_PIN !== "TUTAJ_WPISZ_SWOJ_6_CYFROWY_PIN") {
      console.log("Wprowadzanie kodu PIN...");
      for (let digit of KOD_PIN) {
        await page.keyboard.press(digit);
        await new Promise(r => setTimeout(r, 200));
      }
      console.log("PIN wprowadzony, czekam na odblokowanie...");
      await new Promise(r => setTimeout(r, 5000));
    }
  } catch (e) {}

  console.log("Rozpoczynam obserwację wiadomości...");

  let przetworzoneWiadomosci = new Set();

  setInterval(async () => {
    try {
      const pageText = await page.evaluate(() => document.body.innerText);
      const shortText = pageText.replace(/\s+/g, ' ').slice(0, 150);
      console.log(`[WIDOK CZATU]: ${shortText}...`);
    } catch (e) {}
  }, 10000);

  setInterval(async () => {
    try {
      const wiadomosci = await page.evaluate((keyword) => {
        const elements = document.querySelectorAll('div[dir="auto"], span[dir="auto"], [role="row"]');
        const znalezione = [];

        elements.forEach((el, index) => {
          const text = el.innerText || "";
          if (text.toLowerCase().includes(keyword.toLowerCase())) {
            znalezione.push({
              id: `${index}_${text.trim()}`,
              text: text.trim()
            });
          }
        });

        return znalezione;
      }, SLOWO_KLUCZ);

      if (wiadomosci.length > 0) {
        const ostatnia = wiadomosci[wiadomosci.length - 1];

        if (!przetworzoneWiadomosci.has(ostatnia.id)) {
          console.log(`[NOWA WIADOMOŚĆ]: "${ostatnia.text}"`);
          przetworzoneWiadomosci.add(ostatnia.id);

          const inputSelector = 'p[dir="auto"], [role="textbox"], div[contenteditable="true"]';
          const inputFound = await page.$(inputSelector);

          if (inputFound) {
            await page.click(inputSelector);
            await page.keyboard.type(WYBRANY_PAKIET, { delay: 50 });
            await page.keyboard.press("Enter");
            console.log(`SUKCES! Wysłano odpowiedź: "${WYBRANY_PAKIET}"`);
          } else {
            console.log("Nie znaleziono pola tekstowego.");
          }
        }
      }
    } catch (err) {}
  }, 1500);
})();
