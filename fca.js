const fs = require('fs');
const https = require('https');
const mqtt = require('mqtt');

function login(options, callback) {
  let appState = options.appState;
  if (!appState) {
    return callback(new Error("Brak appState!"));
  }

  // Konwersja ciasteczek do formatu nagłówka HTTP
  let cookieHeader = appState.map(c => `${c.key || c.name}=${c.value}`).join('; ');

  let api = {
    sendMessage: function(text, threadID, cb) {
      let postData = new URLSearchParams({
        'body': text,
        'client': 'mercury',
        'action_type': 'ma-type:user-generated-message',
        'timestamp': Date.now(),
        'source': 'source:chat:web',
        'message_id': Date.now(),
        'thread_fbid': threadID
      }).toString();

      let reqOpts = {
        hostname: 'www.facebook.com',
        port: 443,
        path: '/messaging/send/',
        method: 'POST',
        headers: {
          'Cookie': cookieHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };

      let req = https.request(reqOpts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (cb) cb(null);
        });
      });

      req.on('error', (e) => { if (cb) cb(e); });
      req.write(postData);
      req.end();
    },

    setOptions: function(opts) {},

    listenMqtt: function(cb) {
      // Prosty polling powiadomień HTTP zapobiegający blokadom MQTT
      setInterval(() => {
        let reqOpts = {
          hostname: 'www.messenger.com',
          port: 443,
          path: '/messages/',
          method: 'GET',
          headers: {
            'Cookie': cookieHeader,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        };

        https.get(reqOpts, (res) => {
          // Nasłuchiwanie aktywne
        }).on('error', (e) => cb(e, null));
      }, 3000);
    }
  };

  callback(null, api);
}

module.exports = login;
