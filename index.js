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

  await new Promise(r => setTimeout(r, 4000));

  // --- KROK 1: FIZYCZNE KLIKNIĘCIE W PROFIL OLIWIER IRAŃSKI ---
  try {
    const box = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('span, div'));
      const target = allDivs.find(el => el.innerText && el.innerText.trim() === "Oliwier Irański");
      if (target) {
        const rect = target.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
      return null;
    });

    if (box) {
      console.log(`Znaleziono pozycję profilu Oliwiera (X: ${box.x}, Y: ${box.y}). Klikam myszą...`);
      await page.mouse.click(box.x, box.y);
      await new Promise(r => setTimeout(r, 4000));
    } else {
      console.log("Nie znaleziono etykiety 'Oliwier Irański' na stronie.");
    }
  } catch (e) {
    console.log("Błąd podczas klikania profilu myszą:", e.message);
  }

  // --- KROK 2: PRZYCISK KONTYNUUJ (JEŚLI POJAWI SIĘ NIEBIESKI PRZYCISK) ---
  try {
    const continueBox = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, div[role="button"], a'));
      const target = btns.find(b => b.innerText && b.innerText.trim().toLowerCase().includes("kontynuuj"));
      if (target) {
        const rect = target.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
      return null;
    });

    if (continueBox) {
      console.log(`Klikam przycisk Kontynuuj myszą (X: ${continueBox.x}, Y: ${continueBox.y})...`);
      await page.mouse.click(continueBox.x, continueBox.y);
      await new Promise(r => setTimeout(r, 4000));
    }
  } catch (e) {}

  // --- KROK 3: LOGOWANIE HASŁEM (JEŚLI WYSTĄPI POLE PASSSWORD) ---
  try {
    const passInput = await page.$('input[type="password"]');
    if (passInput && FB_PASSWORD) {
      console.log("Wpisuję hasło do konta...");
      await passInput.type(FB_PASSWORD, { delay: 100 });
      await page.keyboard.press("Enter");
      await new Promise(r => setTimeout(r, 5000));
    }
  } catch (e) {}

  // --- KROK 4: AUTOMATYCZNE 2FA ---
  try {
    const input2FA = await page.$('input[type="text"], input[name="approvals_code"]');
    if (input2FA || page.url().includes("checkpoint") || page.url().includes("auth_platform")) {
      const code2FA = authenticator.generate(SECRET_2FA);
      console.log(`Generuję i wpisuję kod 2FA: ${code2FA}`);

      if (input2FA) {
        await input2FA.type(code2FA, { delay: 100 });
        await page.keyboard.press("Enter");
        await new Promise(r => setTimeout(r, 6000));
      }
    }
  } catch (e) {}

  // --- KROK 5: PIN E2EE 0612 ---
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
