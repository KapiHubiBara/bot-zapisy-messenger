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
      let lastMessageId = null;

      setInterval(() => {
        let reqOpts = {
          hostname: 'www.facebook.com',
          port: 443,
          path: '/ajax/mercury/thread_messages.php',
          method: 'POST',
          headers: {
            'Cookie': cookieHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        };

        let postData = new URLSearchParams({
          'client': 'mercury',
          'messages[user_ids][7081917691867251][limit]': '1'
        }).toString();

        let req = https.request(reqOpts, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              let cleanData = data.replace("for (;;);", "");
              let parsed = JSON.parse(cleanData);
              if (parsed && parsed.payload && parsed.payload.actions) {
                let msg = parsed.payload.actions[0];
                if (msg && msg.message_id !== lastMessageId) {
                  lastMessageId = msg.message_id;
                  cb(null, {
                    threadID: msg.thread_fbid || "7081917691867251",
                    body: msg.body,
                    senderID: msg.author ? msg.author.replace("fbid:", "") : ""
                  });
                }
              }
            } catch (e) {}
          });
        });

        req.on('error', (e) => cb(e, null));
        req.write(postData);
        req.end();
      }, 2000);
    }
  };

  callback(null, api);
}

module.exports = login;
