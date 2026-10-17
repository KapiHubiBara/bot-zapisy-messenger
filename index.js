const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { authenticator } = require("otplib");
const http = require("http");
const fs = require("fs");

// ================= KONFIGURACJA =================
const ID_GRUPY = "3225092577679626";
const SLOWO_KLUCZ = "zapisy";
const WYBRANY_PAKIET = "pakiet 1";
const KOD_PIN = "0612";
const SECRET_2FA = "IDS7QFB4QZR5HHBLIZDO4FEIBUAHWQZO";
const HASLO_FB = process.env.FB_PASSWORD || ""; 
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
  globalPage = page;

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  console.log("Wgrywanie ciasteczek...");
  await page.setCookie(...cookies);

  const targetUrl = `https://www.facebook.com/messages/t/${ID_GRUPY}`;
  console.log(`Otwieranie czatu FB: ${targetUrl}`);

  try {
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });
  } catch (e) {
    console.log("Strona załadowana (timeout pominięty).");
  }

  // --- ODBLOKOWANIE: KLIKNIĘCIE W PROFIL OLIWIERA ---
  try {
    await new Promise(r => setTimeout(r, 3000));

    // Wyszukiwanie głównego przycisku/linku z kafelka "Oliwier Irański"
    const clicked = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('div, a, button, span'));
      const targetNode = allElements.find(el => el.innerText && el.innerText.trim() === "Oliwier Irański");
      if (targetNode) {
        // Znajdujemy klikalny kontener rodzica (link lub przycisk)
        const clickable = targetNode.closest('a, button, [role="button"]') || targetNode;
        clickable.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log("Pomyślnie kliknięto w kafelek profilu Oliwiera!");
      await new Promise(r => setTimeout(r, 4000));
    } else {
      console.log("Nie znaleziono kafelka profilu Oliwiera lub profil był już wybrany.");
    }
  } catch (e) {
    console.log("Błąd podczas klikania profilu:", e.message);
  }

  // --- PRÓBA WPISANIA HASŁA (JEŚLI POJAWI SIĘ FORMULARZ) ---
  try {
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput && HASLO_FB) {
      console.log("Wykryto pole na hasło! Wprowadzam hasło do FB...");
      await passwordInput.type(HASLO_FB, { delay: 100 });
      await page.keyboard.press("Enter");
      await new Promise(r => setTimeout(r, 6000));
    }
  } catch (e) {}

  // --- AUTOMATYCZNE 2FA / KOD Z GENERATORA ---
  try {
    const currentUrl = page.url();
    const input2FA = await page.$('input[type="text"], input[name="approvals_code"]');
    if (currentUrl.includes("auth_platform") || currentUrl.includes("checkpoint") || input2FA) {
      const code2FA = authenticator.generate(SECRET_2FA);
      console.log(`Generuję kod 2FA dla Oliwiera: ${code2FA}`);

      if (input2FA) {
        await input2FA.type(code2FA, { delay: 100 });
        await page.keyboard.press("Enter");
        console.log("Kod 2FA wysłany!");
        await new Promise(r => setTimeout(r, 6000));
      }
    }
  } catch (e) {}

  // --- WPROWADZANIE PIN-U 0612 ---
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

  console.log("Rozpoczynam obserwację wiadomości w czacie...");

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
