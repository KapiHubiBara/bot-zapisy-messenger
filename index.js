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

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/screen-img") && globalPage) {
    try {
      const screenshot = await globalPage.screenshot({ type: "jpeg", quality: 70 });
      res.writeHead(200, { 
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      });
      return res.end(screenshot);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      return res.end("Blad podgladu: " + err.message);
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
            img { max-width: 95vw; height: auto; border: 2px solid #444; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
            h3 { margin-bottom: 15px; font-weight: 300; }
          </style>
        </head>
        <body>
          <h3>Podgląd na żywo z przeglądarki bota (Render)</h3>
          <img id="live" src="/screen-img?t=${Date.now()}" alt="Podglad na zywo..." />
          <script>
            const img = document.getElementById('live');
            setInterval(() => {
              img.src = '/screen-img?t=' + Date.now();
            }, 1500);
          </script>
        </body>
      </html>
    `);
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<h2>Bot Puppeteer dziala!</h2><p><a href="/screen" target="_blank">👉 Podgląd na żywo (/screen)</a></p>`);
});

server.listen(PORT, () => {
  console.log(`Serwer HTTP uruchomiony na porcie ${PORT}`);
});

(async () => {
  console.log("Uruchamianie silnika Chromium (czysta sesja)...");

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

  // 1. Otwieramy czystą stronę logowania
  console.log("Otwieranie formularza logowania Facebooka...");
  try {
    await page.goto("https://www.facebook.com/login", { waitUntil: "networkidle2", timeout: 60000 });
  } catch (e) {}

  await new Promise(r => setTimeout(r, 2000));

  // Akceptacja cookies
  try {
    const allowCookiesBtn = await page.$('button[data-cookiebanner="accept_button"], button[title="Allow all cookies"]');
    if (allowCookiesBtn) {
      await allowCookiesBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {}

  // 2. Wpisanie E-maila i Hasła
  if (FB_EMAIL && FB_PASSWORD) {
    console.log("Wprowadzanie danych logowania (Email + Hasło)...");
    const emailInput = await page.$('input[name="email"]');
    const passInput = await page.$('input[name="pass"]');

    if (emailInput && passInput) {
      await emailInput.type(FB_EMAIL, { delay: 50 });
      await passInput.type(FB_PASSWORD, { delay: 50 });
      await page.keyboard.press("Enter");
      console.log("Formularz wysłany. Oczekiwanie na przejście/2FA...");
      await new Promise(r => setTimeout(r, 6000));
    }
  }

  // 3. Automatyczne obsłużenie 2FA (TOTP)
  try {
    const input2FA = await page.$('input[type="text"], input[name="approvals_code"]');
    if (input2FA || page.url().includes("checkpoint") || page.url().includes("auth_platform")) {
      const code2FA = authenticator.generate(SECRET_2FA);
      console.log(`Generowanie kodu 2FA: ${code2FA}`);

      if (input2FA) {
        await input2FA.type(code2FA, { delay: 100 });
        await page.keyboard.press("Enter");
        console.log("Kod 2FA wysłany!");
        await new Promise(r => setTimeout(r, 6000));
      }
    }
  } catch (e) {}

  // 4. Wejście na czat grupy
  const targetUrl = `https://www.facebook.com/messages/t/${ID_GRUPY}`;
  console.log(`Przechodzę do grupy: ${targetUrl}`);
  try {
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });
  } catch (e) {}

  // 5. PIN E2EE 0612
  try {
    if (KOD_PIN) {
      console.log(`Wprowadzanie kodu PIN (${KOD_PIN})...`);
      for (let digit of KOD_PIN) {
        await page.keyboard.press(digit);
        await new Promise(r => setTimeout(r, 200));
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  } catch (e) {}

  console.log("Rozpoczynam obserwację wiadomości...");

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
            console.log(`SUKCES! Wysłano odpowiedź: "${WYBRANY_PAKIET}"`);
          }
        }
      }
    } catch (err) {}
  }, 1500);
})();
