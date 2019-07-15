const https = require('https');
const config = require('./config');

exports.post = function post(handler, params, chatId) {
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${ config.token }/${ handler }`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  return new Promise(function(resolve, reject) {
    const req = https.request(options, res => {
      let response = '';
      res.on('data', data => {
        response += data
      });
      res.on('end', d => {
        if (res.statusCode === 200) {
          console.debug('Message sent to chatId', chatId, response);
          resolve(JSON.parse(response))
        } else {
          reject(JSON.parse(response))
        }
      })
    });

    req.on('error', e => {
      console.error(e);
    });

    req.write(JSON.stringify({ ...params, chat_id: chatId }));
    req.end()
  });
};
