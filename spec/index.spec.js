const aws = require('aws-sdk');

const config = require('../config');
const lambda = require('../index');
const util = require('../util');

describe('λ', function() {

  let postSpy;

  beforeAll(() => {
    lambda.deps = {
      config: config,
      db: new aws.DynamoDB.DocumentClient(),
      post: util.post,
      getNickname: util.getNickname
    };

    config.greetingsText = 'greetings text';
    config.helpText = 'help text';

    spyOn(console, 'debug');
    spyOn(lambda.deps.db, 'put').and.returnValue({ promise: _ => Promise.resolve() });
    spyOn(lambda.deps.db, 'delete').and.returnValue({ promise: _ => Promise.resolve() });
    spyOn(lambda.deps.db, 'scan').and.returnValue({ promise: _ => Promise.resolve({ Items: [{ id: 1}, { id: 2}, { id: 42 }] }) });
    spyOn(lambda.deps, 'getNickname').and.callFake((chats, chatId) => chatId === 42 ? 'user1' : 'user3');
    postSpy = spyOn(lambda.deps, 'post').and.returnValue(Promise.resolve());
  });

  afterEach(() => {
    postSpy.calls.reset();
  });

  describe('bot commands', function() {
    it('should process /start command', async function() {
      const event = {
        body: JSON.stringify({
          message: {
            text: '/start',
            chat: {id: 42}
          }
        })
      };
      const response = await lambda.handler(event);
      expect(lambda.deps.db.put).toHaveBeenCalledWith({ TableName: 'chats', Item: { id: 42 } });
      expect(lambda.deps.post).toHaveBeenCalledWith('sendMessage', { text: 'greetings text' }, 42);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendMessage', { text: 'help text' }, 42);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda subscribed a new user!'
      });
    });

    it('should process /stop command', async function() {
      const event = {
        body: JSON.stringify({
          message: {
            text: '/stop',
            chat: {id: 42}
          }
        })
      };
      const response = await lambda.handler(event);
      expect(lambda.deps.db.delete).toHaveBeenCalledWith({ TableName: 'chats', Key: { id: 42 } });
      expect(lambda.deps.post).toHaveBeenCalledWith('sendMessage', { text: 'We are sorry to see you go, we will miss you in Gurupa!' }, 42);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda unsubscribed one user!'
      });
    });

    it('should process /help command', async function() {
      const event = {
        body: JSON.stringify({
          message: {
            text: '/help',
            chat: { id: 42 }
          }
        })
      };
      const response = await lambda.handler(event);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendMessage', { text: 'help text' }, 42);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda sent the help to the user!'
      });
    });

    it('should process /debug command', async function() {
      const event = {
        body: JSON.stringify({
          message: {
            text: '/debug test',
            chat: { id: 42 }
          }
        })
      };
      const response = await lambda.handler(event);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendMessage', { text: 'user1: /debug test' }, 42);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda sent the debug to the user!'
      });
    });

    it('should process rotate the nicknames', async function() {
      const event = {
        body: JSON.stringify({
          message: {
            text: '/debug test',
            chat: { id: 2 }
          }
        })
      };
      const response = await lambda.handler(event);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendMessage', { text: 'user3: /debug test' }, 2);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda sent the debug to the user!'
      });
    });
  });

  describe('message processing', function() {

    it('should forward a message to other chats', async function() {
      const event = {
        body: JSON.stringify({
          message: {
            message_id: 145,
            text: 'my message',
            chat: { id: 42 }
          }
        })
      };
      const response = await lambda.handler(event);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendMessage', { text: 'user1: my message', message_id: 145 }, 1);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendMessage', { text: 'user1: my message', message_id: 145 }, 2);
      expect(lambda.deps.post).not.toHaveBeenCalledWith('sendMessage', { text: 'user1: my message', message_id: 145 }, 42);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda forwarded the message to the group!'
      });
    });

    it('should update an edited message', async function() {
      const event = {
        body: JSON.stringify({
          edited_message: {
            message_id: 145,
            edit_date: 101010,
            text: 'my message',
            chat: { id: 42 }
          }
        })
      };
      const response = await lambda.handler(event);
      expect(lambda.deps.post).toHaveBeenCalledWith('editMessageText', { text: 'user1: my message', message_id: 145 }, 1);
      expect(lambda.deps.post).toHaveBeenCalledWith('editMessageText', { text: 'user1: my message', message_id: 145 }, 2);
      expect(lambda.deps.post).not.toHaveBeenCalledWith('editMessageText', { text: 'user1: my message', message_id: 145 }, 42);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda forwarded the message to the group!'
      });
    });

    it('should forward a photo to other chats', async function() {
      const event = {
        body: JSON.stringify({
          message: {
            message_id: 145,
            photo: [{ file_id: 'photo_id' }],
            caption: 'my message',
            chat: { id: 42 }
          }
        })
      };
      const response = await lambda.handler(event);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendPhoto', { caption: 'user1: my message', photo: 'photo_id', message_id: 145 }, 1);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendPhoto', { caption: 'user1: my message', photo: 'photo_id', message_id: 145 }, 2);
      expect(lambda.deps.post).not.toHaveBeenCalledWith('sendPhoto', { caption: 'user1: my message', photo: 'photo_id', message_id: 145 }, 42);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda forwarded the message to the group!'
      });
    });

    it('should not add a caption to a photo if it is empty', async function() {
      const event = {
        body: JSON.stringify({
          message: {
            message_id: 145,
            photo: [{ file_id: 'photo_id' }],
            chat: { id: 42 }
          }
        })
      };
      const response = await lambda.handler(event);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendPhoto', { photo: 'photo_id', message_id: 145 }, 1);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendPhoto', { photo: 'photo_id', message_id: 145 }, 2);
      expect(lambda.deps.post).not.toHaveBeenCalledWith('sendPhoto', { photo: 'photo_id', message_id: 145 }, 42);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda forwarded the message to the group!'
      });
    });

    it('should update an edited photo caption', async function() {
      const event = {
        body: JSON.stringify({
          edited_message: {
            message_id: 145,
            edit_date: 101010,
            photo: [{ file_id: 'photo_id' }],
            caption: 'my message',
            chat: { id: 42 }
          }
        })
      };
      const response = await lambda.handler(event);
      expect(lambda.deps.post).toHaveBeenCalledWith('editMessageCaption', { caption: 'user1: my message', photo: 'photo_id', message_id: 145 }, 1);
      expect(lambda.deps.post).toHaveBeenCalledWith('editMessageCaption', { caption: 'user1: my message', photo: 'photo_id', message_id: 145 }, 2);
      expect(lambda.deps.post).not.toHaveBeenCalledWith('editMessageCaption', { caption: 'user1: my message', photo: 'photo_id', message_id: 145 }, 42);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda forwarded the message to the group!'
      });
    });

  });

});
