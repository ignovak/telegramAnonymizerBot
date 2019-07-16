'use strict';
const aws = require('aws-sdk');
const config = require('./config');
const util = require('./util');

exports.deps = {
  config: config,
  db: new aws.DynamoDB.DocumentClient({
    region: config.awsRegion
  }),
  post: util.post,
  getNickname: util.getNickname
};

const userCommands = {
  DEBUG: '/debug',
  JOIN: '/start',
  LEAVE: '/stop',
  HELP: '/help'
};

function successResponse(message) {
  return {
    statusCode: 200,
    body: message,
  };
}

function fetchChats() {
  return exports.deps.db.scan({TableName: exports.deps.config.tableName}).promise()
      .then(response => response.Items.map(_ => _.id))
      .catch(err => {
        console.error('Unable to fetch chats. Error JSON:', JSON.stringify(err, null, 2));
        throw err;
      });
}

async function handleSubscribe(message) {
  await exports.deps.db.put({TableName: exports.deps.config.tableName, Item: {id: message.chat.id}}).promise()
      .catch(err => {
        console.error('Unable to register the chat id. Error JSON:', JSON.stringify(err, null, 2));
        throw err
      });

  await exports.deps.post('sendMessage', {text: exports.deps.config.greetingsText}, message.chat.id);
  await exports.deps.post('sendMessage', {text: exports.deps.config.helpText}, message.chat.id);

  return successResponse('Lambda subscribed a new user!');
}

async function handleUnsubscribe(message) {
  await exports.deps.db.delete({TableName: exports.deps.config.tableName, Key: {id: message.chat.id}}).promise()
      .catch(err => {
        console.error('Unable to delete the chat id. Error JSON:', JSON.stringify(err, null, 2));
        throw err
      });

  await exports.deps.post('sendMessage', {text: 'We are sorry to see you go, we will miss you in Gurupa!'}, message.chat.id);

  return successResponse('Lambda unsubscribed one user!');
}

async function handleHelp(message) {
  await exports.deps.post('sendMessage', {text: exports.deps.config.helpText}, message.chat.id);

  return successResponse('Lambda sent the help to the user!');
}

async function handleDebug(message) {
  const chats = await fetchChats();
  const nickname = exports.deps.getNickname(chats, message.chat.id);

  await exports.deps.post('sendMessage', {text: nickname + ': ' + message.text}, message.chat.id);

  return successResponse('Lambda sent the debug to the user!');
}

async function handleForwardMessage(message) {
  const params = {message_id: message.message_id};

  const chats = await fetchChats();
  const nickname = exports.deps.getNickname(chats, message.chat.id);

  let apiHandler;
  if (message.text) {
    apiHandler = message.edit_date ? 'editMessageText' : 'sendMessage';
    params.text = nickname + ': ' + message.text;
  } else if (message.photo) {
    apiHandler = message.edit_date ? 'editMessageCaption' : 'sendPhoto';
    if (message.caption) {
      params.caption = nickname + ': ' + message.caption;
    }
    params.photo = message.photo[0].file_id;
  }

  try {
    const promises = chats
        .filter(id => id !== message.chat.id)
        .map(id => exports.deps.post(apiHandler, params, id));
    await Promise.all(promises)
  } catch (e) {
    console.error('Failed to send a message to chatId', params.chatId, e)
  }

  return successResponse('Lambda forwarded the message to the group!');
}

exports.handler = async (event) => {
  console.debug(event.body);

  const body = typeof event.body === 'object' ? event.body : JSON.parse(event.body);
  const message = body.message || body.edited_message;
  console.debug(message);

  if (message.text === userCommands.JOIN) {
    return await handleSubscribe(message);
  } else if (message.text === userCommands.LEAVE) {
    return await handleUnsubscribe(message);
  } else if (message.text === userCommands.HELP) {
    return await handleHelp(message);
  } else if (message.text && message.text.startsWith(userCommands.DEBUG)) {
    return await handleDebug(message);
  }
  return await handleForwardMessage(message);
};
