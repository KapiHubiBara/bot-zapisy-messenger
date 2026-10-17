const fs = require('fs');
const https = require('https');

function login(options, callback) {
  let appState = options.appState;
  if (!appState) {
    return callback(new Error("Brak appState!"));
  }

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
          // Nasłuchywanie aktywne
        }).on('error', (e) => cb(e, null));
      }, 3000);
    }
  };

  callback(null, api);
}

module.exports = login;
