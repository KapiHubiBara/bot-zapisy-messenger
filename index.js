const login = require("./fca.js");
const http = require("http");

// ================= KONFIGURACJA =================
const WYBRANY_PAKIET = "pakiet 1";
const ID_GRUPY = "7081917691867251";
const SLOWO_KLUCZ = "zapisy";
const PORT = process.env.PORT || 3000;
// ================================================

// Serwer HTTP pod przetrzymanie usługi na Render.com
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot dziala i nasluchuje!\n");
});

server.listen(PORT, () => {
  console.log(`Serwer HTTP uruchomiony na porcie ${PORT}`);
});

let appState;
try {
  if (process.env.APPSTATE_JSON) {
    appState = JSON.parse(process.env.APPSTATE_JSON);
  } else {
    const fs = require("fs");
    appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));
  }
} catch (err) {
  console.error("Błąd wczytywania ciasteczek appstate!", err);
  process.exit(1);
}

login({ appState: appState }, (err, api) => {
  if (err) {
    console.error("Błąd logowania do Messengera:", err);
    return;
  }

  api.setOptions({
    listenEvents: true,
    selfListen: false,
    logLevel: "silent",
    forceLogin: true,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  console.log("Bot zalogowany pomyślnie. Nasłuchuję na grupie...");

  let wyslano = false;

  api.listenMqtt((err, message) => {
    if (err) return console.error("Błąd nasłuchiwania MQTT:", err);

    if (message && message.threadID === ID_GRUPY && message.body && !wyslano) {
      const tresc = message.body.toLowerCase();

      if (tresc.includes(SLOWO_KLUCZ.toLowerCase())) {
        console.log("Wykryto słowo kluczowe! Wysyłam wiadomość...");
        wyslano = true;

        api.sendMessage(WYBRANY_PAKIET, ID_GRUPY, (err) => {
          if (err) {
            console.error("Błąd wysyłania wiadomości:", err);
          } else {
            console.log(`SUKCES! Wysłano: "${WYBRANY_PAKIET}"`);
          }
        });
      }
    }
  });
});
