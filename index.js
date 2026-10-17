const login = require("ws3-fca");
const http = require("http");

// ================= KONFIGURACJA =================
const WYBRANY_PAKIET = "pakiet 1";
const ID_GRUPY = "7081917691867251";
const SLOWO_KLUCZ = "zapisy";
const PORT = process.env.PORT || 3000;
// ================================================

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

const options = {
  logLevel: "silent",
  forceLogin: true,
  listenEvents: true,
  selfListen: false,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

login({ appState: appState }, options, (err, api) => {
  if (err) {
    console.error("Błąd logowania do Messengera:", err);
    return;
  }

  console.log("Bot zalogowany pomyślnie! Nasłuchuję połączenia MQTT...");

  api.listenMqtt((err, message) => {
    if (err) return;

    if (message && message.body) {
      console.log(`[ODCZYT] Odebrano wiadomość: "${message.body}"`);

      if (message.threadID === ID_GRUPY && message.body.toLowerCase().includes(SLOWO_KLUCZ.toLowerCase())) {
        console.log("Wykryto słowo kluczowe! Wysyłam wiadomość...");

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
