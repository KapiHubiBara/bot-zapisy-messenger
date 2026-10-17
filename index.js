const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { authenticator } = require("otplib");
const http = require("http");
const fs = require("fs");

// ================= KONFIGURACJA =================
const ID_GRUPY = "3225092577679626";
const SLOWO_KLUCZ = "zapisy";
const WYBRANY_PAKIET = "pakiet 1";
const KOD_PIN = "062003"; // Twój PIN Messenger

// Tajny klucz 2FA z Facebooka (bez spacji)
const SECRET_2FA = "IDS7QFB4QZR5HHBLIZDO4FEIBUAHWQZO"; 

const PORT = process.env.PORT || 3000;
// ================================================

let globalPage = null; // Zmienna do przechowywania referencji do karty przeglądarki

// --- SERWER HTTP Z PODGLĄDEM LIVE (/screen) ---
const server = http.createServer(async (req, res) => {
  if (req.url === "/screen" && globalPage) {
    try {
      // Robimy zrzut ekranu i wysyłamy jako obraz PNG
      const screenshot = await globalPage.screenshot({ type: "png" });
      res.writeHead(200, { 
        "Content-Type": "image/png",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      });
      return res.end(screenshot);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      return res.end("Blad generowania podgladu: " + err.message);
    }
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`
    <h2>Bot Puppeteer dziala!</h2>
    <p><a href="/screen" target="_blank">👉 Kliknij tutaj, aby zobaczyc aktualny podglad ekranu na zywo (/screen)</a></p>
  `);
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
    domain: ".facebook.com",
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
  console.log("Uruchamianie silnika Chromium...");

  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 800 },
    executablePath: executablePath,
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  globalPage = page; // Udostępniamy kartę dla podglądu /screen

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  console.log("Wgrywanie ciasteczek dla facebook.com...");
  await page.setCookie(...cookies);

  const targetUrl = `https://www.facebook.com/messages/t/${ID_GRUPY}`;
  console.log(`Otwieranie czatu FB: ${targetUrl}`);

  try {
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });
  } catch (e) {
    console.log("Strona załadowana (timeout pominięty).");
  }

  // --- AUTOMATYCZNA OBSŁUGA EKRANU WERYFIKACJI DWUETAPOWEJ (2FA) ---
  try {
    await new Promise(r => setTimeout(r, 4000));
    const currentUrl = page.url();

    if (currentUrl.includes("auth_platform") || currentUrl.includes("checkpoint")) {
      console.log("Wykryto ekran weryfikacji dwuetapowej 2FA! Generuję kod...");

      const code2FA = authenticator.generate(SECRET_2FA);
      console.log(`Wygenerowany kod 2FA: ${code2FA}`);

      const input2FA = await page.$('input[type="text"], input[name="approvals_code"]');
      if (input2FA) {
        await input2FA.type(code2FA, { delay: 100 });
        await page.keyboard.press("Enter");
        console.log("Kod 2FA wysłany, oczekiwanie na zatwierdzenie...");
        await new Promise(r => setTimeout(r, 6000));
      }
    }
  } catch (e) {
    console.log("Błąd podczas automatycznego 2FA lub ekran nie wystąpił.");
  }

  // --- OBSŁUGA PIN-U E2EE ---
  try {
    if (KOD_PIN && KOD_PIN !== "TUTAJ_WPISZ_SWOJ_6_CYFROWY_PIN") {
      console.log("Wprowadzanie kodu PIN...");
      for (let digit of KOD_PIN) {
        await page.keyboard.press(digit);
        await new Promise(r => setTimeout(r, 200));
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  } catch (e) {}

  console.log("Zalogowano na Facebook.com! Rozpoczynam nasłuch wiadomości...");

  let przetworzoneWiadomosci = new Set();

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
          console.log(`[NOWA WIADOMOŚĆ FB]: "${ostatnia.text}"`);
          przetworzoneWiadomosci.add(ostatnia.id);

          const inputSelector = 'div[role="textbox"], p[dir="auto"], div[contenteditable="true"]';
          const inputFound = await page.$(inputSelector);

          if (inputFound) {
            await page.click(inputSelector);
            await page.keyboard.type(WYBRANY_PAKIET, { delay: 50 });
            await page.keyboard.press("Enter");
            console.log(`SUKCES! Wysłano odpowiedź na FB: "${WYBRANY_PAKIET}"`);
          } else {
            console.log("Nie znaleziono pola tekstowego na FB.");
          }
        }
      }
    } catch (err) {}
  }, 1500);
})();
