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

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Podgląd Bota Messenger LIVE</title>
        <style>
          body { background: #111; color: #fff; font-family: sans-serif; text-align: center; margin: 0; padding: 20px; }
          img { max-width: 95vw; height: auto; border: 2px solid #444; border-radius: 8px; }
          h3 { font-weight: 300; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <h3>Podgląd na żywo z przeglądarki bota (Render)</h3>
        <p>Strona odświeża się automatycznie co sekundę</p>
        <img id="live" src="/screen-img?t=${Date.now()}" alt="Ładowanie podglądu..." />
        <script>
          const img = document.getElementById('live');
          setInterval(() => { img.src = '/screen-img?t=' + Date.now(); }, 1000);
        </script>
      </body>
    </html>
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
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
  } catch (e) {}

  await new Promise(r => setTimeout(r, 3000));

  // --- DYNAMICZNY SYSTEM LOGOWANIA I ODNALEZIENIA CZATU ---
  let isLogged = false;

  for (let attempt = 1; attempt <= 20; attempt++) {
    const url = page.url();

    // Sprawdzenie czy dotarliśmy do okna wiadomości
    const hasChatBox = await page.$('div[role="textbox"], p[dir="auto"], div[contenteditable="true"]');
    if (url.includes("/messages/t/") && hasChatBox) {
      console.log(" Green Light: Bot pomyślnie załadował okno czatu!");
      isLogged = true;
      break;
    }

    console.log(`[Weryfikacja - Próba ${attempt}/20] Stan strony: ${url}`);

    // 1. Wpisanie loginu i hasła (jeśli widzimy formularz)
    const emailSelector = 'input[name="email"], input[id="email"]';
    const passSelector = 'input[name="pass"], input[id="pass"]';
    const emailInput = await page.$(emailSelector);

    if (emailInput && FB_EMAIL && FB_PASSWORD) {
      console.log("Formularz logowania widoczny. Wpisuję e-mail i hasło...");
      await page.click(emailSelector, { clickCount: 3 });
      await page.type(emailSelector, FB_EMAIL, { delay: 30 });

      await page.click(passSelector, { clickCount: 3 });
      await page.type(passSelector, FB_PASSWORD, { delay: 30 });

      await page.keyboard.press("Enter");
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    // 2. Wpisanie kodu 2FA (jeśli jest pole)
    const input2FA = await page.$('input[name="approvals_code"], input[type="text"]');
    if (input2FA && (url.includes("checkpoint") || url.includes("auth_platform"))) {
      const code2FA = authenticator.generate(SECRET_2FA);
      console.log(`Wpisuję kod 2FA (${code2FA})...`);
      await input2FA.type(code2FA, { delay: 50 });
      await page.keyboard.press("Enter");
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    // 3. Szukanie i klikanie przycisków odblokowujących (Kontynuuj / Zapisz przeglądarkę / To ja)
    const clickedBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, div[role="button"], a, input[type="submit"]'));
      const target = btns.find(b => {
        const txt = (b.innerText || b.value || "").toLowerCase();
        return txt.includes("kontynuuj") || txt.includes("continue") || 
               txt.includes("to ja") || txt.includes("zapisz") || 
               txt.includes("pamiętaj") || txt.includes("tak");
      });
      if (target) {
        target.click();
        return true;
      }
      return false;
    });

    if (clickedBtn) {
      console.log(" Kliknięto przycisk przejściowy (Kontynuuj / Zapisz)!");
      await new Promise(r => setTimeout(r, 4000));
      continue;
    }

    // 4. Obsługa PIN E2EE 0612 (jeśli pojawi się ekran PIN)
    if (KOD_PIN) {
      for (let digit of KOD_PIN) {
        await page.keyboard.press(digit);
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Co 3 próby odświeżamy bezpośrednio adres grupy
    if (attempt % 3 === 0) {
      console.log("Przeładowuję stronę czatu...");
      try {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      } catch (e) {}
    } else {
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  console.log(" Rozpoczynam nasłuchiwanie wiadomości w grupie...");

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
          console.log(`🚀 [NOWA WIADOMOŚĆ]: "${ostatnia.text}"`);
          przetworzoneWiadomosci.add(ostatnia.id);

          const inputSelector = 'div[role="textbox"], p[dir="auto"], div[contenteditable="true"]';
          const inputFound = await page.$(inputSelector);

          if (inputFound) {
            await page.click(inputSelector);
            await new Promise(r => setTimeout(r, 100));

            await page.evaluate((textToInsert) => {
              document.execCommand('insertText', false, textToInsert);
            }, WYBRANY_PAKIET);

            await new Promise(r => setTimeout(r, 100));
            await page.keyboard.press("Enter");
            console.log(`SUKCES! Wysłano: "${WYBRANY_PAKIET}"`);
          }
        }
      }
    } catch (err) {}
  }, 400);
})();
