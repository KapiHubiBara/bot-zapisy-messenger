const https = require('https');

function login(options, callback) {
  let appState = options.appState;
  if (!appState) return callback(new Error("Brak appState!"));

  let cookieHeader = appState.map(c => `${c.key || c.name}=${c.value}`).join('; ');
  let fbDtsg = "";

  // Pobieranie tokenu fb_dtsg wymaganego przez Facebooka
  let initOpts = {
    hostname: 'www.facebook.com',
    port: 443,
    path: '/',
    method: 'GET',
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };

  https.get(initOpts, (res) => {
    let html = '';
    res.on('data', chunk => html += chunk);
    res.on('end', () => {
      let match = html.match(/name="fb_dtsg" value="([^"]+)"/) || html.match(/"DTSGInitialData",\[\],{"token":"([^"]+)"}/);
      if (match) fbDtsg = match[1];

      let api = {
        sendMessage: function(text, threadID, cb) {
          let postData = new URLSearchParams({
            'body': text,
            'client': 'mercury',
            'action_type': 'ma-type:user-generated-message',
            'timestamp': Date.now(),
            'source': 'source:chat:web',
            'message_id': Date.now(),
            'thread_fbid': threadID,
            'fb_dtsg': fbDtsg
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
            res.on('end', () => { if (cb) cb(null); });
          });

          req.on('error', (e) => { if (cb) cb(e); });
          req.write(postData);
          req.end();
        },

        listenMqtt: function(cb) {
          let lastMsgId = null;

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
              'messages[user_ids][3225092577679626][limit]': '1',
              'fb_dtsg': fbDtsg
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
                    if (msg && msg.message_id !== lastMsgId) {
                      lastMsgId = msg.message_id;
                      cb(null, {
                        threadID: "3225092577679626",
                        body: msg.body
                      });
                    }
                  }
                } catch (e) {}
              });
            });

            req.on('error', (e) => {});
            req.write(postData);
            req.end();
          }, 2000);
        }
      };

      callback(null, api);
    });
  }).on('error', (e) => callback(e));
}

module.exports = login;
