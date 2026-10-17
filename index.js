const login = require("@pitu/facebook-chat-api");

// ================= KONFIGURACJA =================
const WYBRANY_PAKIET = "pakiet 1";             // Tekst do wysłania
const ID_GRUPY = "645527998315352";            // ID Twojego czatu
const SLOWO_KLUCZ = "zapisy";                  // Słowo, po którym bot odpisze
// ================================================

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

  api.setOptions({ listenEvents: true, selfListen: false });
  console.log("Bot uruchomiony pomyślnie. Nasłuchuję wiadomości...");

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
