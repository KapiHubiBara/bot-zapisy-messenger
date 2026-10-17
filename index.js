const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { authenticator } = require("otplib");
const http = require("http");

// ================= KONFIGURACJA =================
const ID_GRUPY = "3225092577679626";
const SLOWO_KLUCZ = "zapisy";
const WYBRANY_PAKIET = "pakiet 1";
const KOD_PIN = "0612";
const SECRET_2FA = "IDS7QFB4QZR5HHBLIZDO4FEIBUAHWQZO";

const FB_EMAIL = process.env.FB_EMAIL || "";
const FB_PASSWORD = process.env.FB_PASSWORD || "";
const PORT = process.env.PORT || 3000;
// ================================================

let globalPage = null;

// --- SERWER HTTP + PEŁNA OBSŁUGA /screen ---
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/screen-img") && globalPage) {
    try {
      const screenshot = await globalPage.screenshot({ type: "jpeg", quality: 65 });
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      });
      return res.end(screenshot);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      return res.end("Błąd podglądu: " + err.message);
    }
  }

  if (req.url === "/screen") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Podgląd Bota Messenger LIVE</title>
          <style>
            body { background: #111; color: #fff; font-family: sans-serif; text-align: center; margin: 0; padding: 20px; }
            img { max-width: 95vw; height: auto; border: 2px solid #444; border-radius: 8px; }
            h3 { font-weight: 300; }
          </style>
        </head>
        <body>
          <h3>Podgląd na żywo z przeglądarki bota (Render)</h3>
          <img id="live" src="/screen-img?t=${Date.now()}" alt="Ładowanie podglądu..." />
          <script>
            const img = document.getElementById('live');
            setInterval(() => { img.src = '/screen-img?t=' + Date.now(); }, 1200);
          </script>
        </body>
      </html>
    `);
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`
    <h2>Bot Messenger jest aktywny!</h2>
    <p><a href="/screen" target="_blank">👉 Kliknij tutaj, aby przejść do podglądu na żywo (/screen)</a></p>
  `);
});

server.listen(PORT, () => {
  console.log(`Serwer HTTP uruchomiony na porcie ${PORT}`);
});

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
  globalPage = page;

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  const targetUrl = `https://www.facebook.com/messages/t/${ID_GRUPY}`;
  console.log(`Otwieranie czatu FB: ${targetUrl}`);

  try {
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });
  } catch (e) {}

  await new Promise(r => setTimeout(r, 3000));

  // --- LOGOWANIE FORMULARZEM (JEŚLI POTRZEBNE) ---
  try {
    const emailInput = await page.$('input[name="email"], input[id="email"]');
    const passInput = await page.$('input[name="pass"], input[id="pass"]');

    if (emailInput && passInput && FB_EMAIL && FB_PASSWORD) {
      console.log("Logowanie do Facebooka...");
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(FB_EMAIL, { delay: 30 });

      await passInput.click({ clickCount: 3 });
      await passInput.type(FB_PASSWORD, { delay: 30 });

      await page.keyboard.press("Enter");
      await new Promise(r => setTimeout(r, 5000));
    }
  } catch (e) {}

  // --- 2FA ---
  try {
    const currentUrl = page.url();
    if (currentUrl.includes("auth_platform") || currentUrl.includes("checkpoint")) {
      const code2FA = authenticator.generate(SECRET_2FA);
      console.log(`Wprowadzanie kodu 2FA: ${code2FA}`);

      const input2FA = await page.$('input[type="text"], input[name="approvals_code"]');
      if (input2FA) {
        await input2FA.type(code2FA, { delay: 50 });
        await page.keyboard.press("Enter");
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  } catch (e) {}

  // --- PIN E2EE ---
  try {
    if (KOD_PIN) {
      console.log(`Wprowadzanie PIN E2EE (${KOD_PIN})...`);
      for (let digit of KOD_PIN) {
        await page.keyboard.press(digit);
        await new Promise(r => setTimeout(r, 100));
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  } catch (e) {}

  console.log("⚡ BOT NASŁUCHUJE W CZASIE RZECZYWISTYM! ⚡");

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
          console.log(`🚀 [WYKRYTO]: "${ostatnia.text}" - WYSYŁAM ODPOWIEDŹ...`);
          przetworzoneWiadomosci.add(ostatnia.id);

          const inputSelector = 'div[role="textbox"], p[dir="auto"], div[contenteditable="true"]';
          const inputFound = await page.$(inputSelector);

          if (inputFound) {
            await page.click(inputSelector);
            await new Promise(r => setTimeout(r, 100));

            // BAZOWE BEZBŁĘDNE WKLEJENIE TEKSTU BEZ PYSŁOMÓWEK
            await page.evaluate((textToInsert) => {
              document.execCommand('insertText', false, textToInsert);
            }, WYBRANY_PAKIET);

            await new Promise(r => setTimeout(r, 100));
            await page.keyboard.press("Enter");
            console.log(`SUKCES! Wysłano dokładnie: "${WYBRANY_PAKIET}"`);
          }
        }
      }
    } catch (err) {}
  }, 400);
})();
