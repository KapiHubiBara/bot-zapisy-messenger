const https = require('https');
const WebSocket = require('ws');

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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/
