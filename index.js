const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const http = require("http");
const fs = require("fs");

// ================= KONFIGURACJA =================
const ID_GRUPY = "3225092577679626";
const SLOWO_KLUCZ = "zapisy";
const WYBRANY_PAKIET = "pakiet 1";
const KOD_PIN = "062003"; // Wpisz swój 6-cyfrowy PIN Messenger
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
    secure: c.secure || true,
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
    console.log("Strona załadowana (timeout sieci pominięty).");
  }

  // --- OBSŁUGA PIN-U DLA SZYFROWANIA E2EE ---
  try {
    console.log("Czekam 5s na ewentualny modal z kodem PIN...");
    await new Promise(r => setTimeout(r, 5000));

    if (KOD_PIN && KOD_PIN !== "TUTAJ_WPISZ_SWOJ_6_CYFROWY_PIN") {
      console.log("Wprowadzanie kodu PIN w celu odblokowania czatu...");
      for (let digit of KOD_PIN) {
        await page.keyboard.press(digit);
        await new Promise(r => setTimeout(r, 300));
      }
      console.log("PIN wprowadzony. Oczekiwanie na odblokowanie rozmów...");
      await new Promise(r => setTimeout(r, 5000));
    }
  } catch (e) {
    console.log("Brak modala PIN lub już odblokowano.");
  }
  // ----------------------------------------

  console.log("Bot zalogowany na stronie. Rozpoczynam obserwację DOM czatu...");

  let wyslano = false;

  setInterval(async () => {
    try {
      const messages = await page.evaluate(() => {
        const elements = document.querySelectorAll('[role="row"], [role="article"], div[dir="auto"]');
        const texts = [];
        elements.forEach(el => {
          if (el.innerText) texts.push(el.innerText);
        });
        return texts;
      });

      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];

        if (lastMessage.toLowerCase().includes(SLOWO_KLUCZ.toLowerCase()) && !wyslano) {
          console.log(`Wykryto słowo kluczowe w wiadomości: "${lastMessage}"`);
          wyslano = true;

          const inputSelector = '[role="textbox"], div[contenteditable="true"]';
          await page.waitForSelector(inputSelector, { timeout: 5000 });
          await page.click(inputSelector);
          await page.type(inputSelector, WYBRANY_PAKIET);
          await page.keyboard.press("Enter");

          console.log(`SUKCES! Wysłano odpowiedź: "${WYBRANY_PAKIET}" na czacie.`);
        }
      }
    } catch (err) {}
  }, 1500);
})();
