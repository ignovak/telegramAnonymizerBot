const https = require('https')

const apiToken = require('./token').token

exports.handler = async (event) => {
    console.log(event.body);
    
    // Send a message to members
    const message = JSON.parse(event.body).message
    const params = {
        chat_id: message.chat.id
    }
    let apiHandler
    if (message.text) {
        apiHandler = 'sendMessage'
        params.text = message.text.toUpperCase()
    } else if (message.photo) {
        apiHandler = 'sendPhoto'
        params.caption = message.caption
        params.photo = message.photo[0].file_id
    }
    try {
        const response = await post(apiHandler, params)
        console.log('Message sent to chatId', params.chatId, response)
    } catch (e) {
        console.error('Failed to send a message to chatId', params.chatId, e)
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda! 1123'),
    };
    return response;
};

function post(handler, params) {
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${ apiToken }/${ handler }`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }
  return new Promise(function(resolve, reject) {
    const req = https.request(options, res => {
      let response = ''
      res.on('data', data => {
        response += data
      })
      res.on('end', d => {
        if (res.statusCode == 200) {
          resolve(JSON.parse(response))
        } else {
          reject(JSON.parse(response))
        }
      })
    })

    req.on('error', e => {
      console.log(e);
    })

    req.write(JSON.stringify(params))
    req.end()
  });
}
