const login = require("./fca.js");
const http = require("http");

// ================= KONFIGURACJA =================
const WYBRANY_PAKIET = "pakiet 1";
const ID_GRUPY = "3225092577679626";
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

  console.log("Bot zalogowany pomyślnie. Nasłuchuję na grupie ID: " + ID_GRUPY);

  api.listenMqtt((err, message) => {
    if (err || !message) return;

    if (message.body) {
      console.log(`[ODCZYT] Odebrano wiadomość: "${message.body}"`);
      const tresc = message.body.toLowerCase();

      if (tresc.includes(SLOWO_KLUCZ.toLowerCase())) {
        console.log("Wykryto słowo kluczowe! Wysyłam wiadomość...");

        api.sendMessage(WYBRANY_PAKIET, ID_GRUPY, (err) => {
          if (err) {
            console.error("Błąd wysyłania wiadomości:", err);
          } else {
            console.log(`SUKCES! Wysłano: "${WYBRANY_PAKIET}" na grupę ${ID_GRUPY}`);
          }
        });
      }
    }
  });
});
