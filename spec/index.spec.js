const aws = require('aws-sdk');

const config = require('../config');
const lambda = require('../index');
const post = require('../util').post;

describe('λ', function() {

  let postSpy;

  beforeAll(() => {
    lambda.deps = {
      config: config,
      db: new aws.DynamoDB.DocumentClient(),
      post: post
    };

    config.greetingsText = 'greetings text';
    config.helpText = 'help text';

    spyOn(console, 'debug');
    spyOn(lambda.deps.db, 'put').and.returnValue({ promise: _ => Promise.resolve() });
    spyOn(lambda.deps.db, 'delete').and.returnValue({ promise: _ => Promise.resolve() });
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
      expect(lambda.deps.post).toHaveBeenCalledWith('sendMessage', { text: '/debug test' }, 42);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda sent the debug to the user!'
      });
    });
  });

  describe('message processing', function() {

    beforeAll(() => {
      spyOn(lambda.deps.db, 'scan').and.returnValue({ promise: _ => Promise.resolve({ Items: [{ id: 1}, { id: 2}, { id: 42 }] }) });
    })

    it('should forward a message to other chats', async function() {
      const event = {
        body: JSON.stringify({
          message: {
            text: 'my message',
            chat: { id: 42 }
          }
        })
      };
      const response = await lambda.handler(event);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendMessage', { text: 'my message' }, 1);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendMessage', { text: 'my message' }, 2);
      expect(lambda.deps.post).not.toHaveBeenCalledWith('sendMessage', { text: 'my message' }, 42);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda forwarded the message to the group!'
      });
    });

    it('should forward a photo to other chats', async function() {
      const event = {
        body: JSON.stringify({
          message: {
            photo: [{ file_id: 'photo_id' }],
            caption: 'my message',
            chat: { id: 42 }
          }
        })
      };
      const response = await lambda.handler(event);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendPhoto', { caption: 'my message', photo: 'photo_id' }, 1);
      expect(lambda.deps.post).toHaveBeenCalledWith('sendPhoto', { caption: 'my message', photo: 'photo_id' }, 2);
      expect(lambda.deps.post).not.toHaveBeenCalledWith('sendPhoto', { caption: 'my message', photo: 'photo_id' }, 42);
      expect(response).toEqual({
        statusCode: 200,
        body: 'Lambda forwarded the message to the group!'
      });
    });

  });

});
