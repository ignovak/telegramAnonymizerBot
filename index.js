"use strict";
const https = require('https');
const aws = require('aws-sdk');
const config = require('./config');

const db = new aws.DynamoDB.DocumentClient({
  region: config.awsRegion
});

const userCommands = {
  JOIN: '/start',
  LEAVE: '/stop',
  HELP: '/help'
};

function post(handler, params, chatId) {
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
}

function successResponse(message) {
  return {
    statusCode: 200,
    body: JSON.stringify(message),
  };
}

async function handleSubscribe(message) {
  await db.put({TableName: config.tableName, Item: {id: message.chat.id}}).promise()
      .catch(err => {
        console.error('Unable to register the chat id. Error JSON:', JSON.stringify(err, null, 2));
        throw err
      });

  await post('sendMessage', {text: config.greetingsText}, message.chat.id);
  await post('sendMessage', {text: config.helpText}, message.chat.id);

  return successResponse('Lambda subscribed a new user!');
}

async function handleUnsubscribe(message) {
  await db.delete({TableName: config.tableName, Key: {id: message.chat.id}}).promise()
      .catch(err => {
        console.error('Unable to delete the chat id. Error JSON:', JSON.stringify(err, null, 2));
        throw err
      });

  await post('sendMessage', {text: 'We are sorry to see you go, we will miss you in Gurupa!'}, message.chat.id);

  return successResponse('Lambda unsubscribed one user!');
}

async function handleHelp(message) {
  await post('sendMessage', {text: config.helpText}, message.chat.id);

  return successResponse('Lambda send the help to the user!');
}

async function handleForwardMessage(message) {
  const params = {};
  let apiHandler;
  if (message.text) {
    apiHandler = 'sendMessage';
    params.text = message.text;
  } else if (message.photo) {
    apiHandler = 'sendPhoto';
    params.caption = message.caption;
    params.photo = message.photo[0].file_id;
  }

  const chats = await db.scan({TableName: config.tableName}).promise()
      .then(response => response.Items.map(_ => _.id))
      .catch(err => {
        console.error('Unable to read item. Error JSON:', JSON.stringify(err, null, 2));
        throw err
      });

  try {
    const promises = chats
        .filter(id => id !== message.chat.id)
        .map(id => post(apiHandler, params, id));
    await Promise.all(promises)
  } catch (e) {
    console.error('Failed to send a message to chatId', params.chatId, e)
  }

  return successResponse('Lambda forwarded the message to the group!');
}

exports.handler = async (event) => {
  console.debug(event.body);

  // Get the message
  let message = "";
  if (typeof(event.body) === "object") {
      message = event.body.message;
  } else {
      message = JSON.parse(event.body).message;
  }
  console.debug(message);

  if (message.text === userCommands.JOIN) {
    return await handleSubscribe(message);
  } else if (message.text === userCommands.LEAVE) {
    return await handleUnsubscribe(message);
  } else if (message.text === userCommands.HELP) {
    return await handleHelp(message);
  }
  return await handleForwardMessage(message);
};
