const https = require('https')
const aws = require("aws-sdk")

// aws.config.update({region: 'eu-west-1'})

const db = new aws.DynamoDB.DocumentClient({
  region: 'eu-west-1'
})

const apiToken = require('./token').token

exports.handler = async (event) => {
  console.debug(event.body);

  // Send a message to members
  // const chatId = 178053996
  const message = JSON.parse(event.body).message
  const params = {}
  let apiHandler
  if (message.text) {
    apiHandler = 'sendMessage'
    params.text = message.text.toUpperCase()
  } else if (message.photo) {
    apiHandler = 'sendPhoto'
    params.caption = message.caption.toUpperCase()
    params.photo = message.photo[0].file_id
  }

  const chats = await db.scan({ TableName: 'chats' }).promise()
    .then(response => response.Items.map(_ => _.id))
    .catch(err => {
      console.error('Unable to read item. Error JSON:', JSON.stringify(err, null, 2))
      throw err
    })
  
  try {
    const promises = chats
      .filter(id => id != message.chat.id)
      .map(id => post(apiHandler, params, id))
    await Promise.all(promises)
  } catch (e) {
    console.error('Failed to send a message to chatId', params.chatId, e)
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda! 1123'),
  };
  return response;
};

function post(handler, params, chatId) {
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
          console.debug('Message sent to chatId', chatId, response)
          resolve(JSON.parse(response))
        } else {
          reject(JSON.parse(response))
        }
      })
    })

    req.on('error', e => {
      console.error(e);
    })

    req.write(JSON.stringify({ ...params, chat_id: chatId }))
    req.end()
  });
}
