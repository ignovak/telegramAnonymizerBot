## Running the tests
'npm i && npm test' (or `yarn && yarn test`)

## Running locally
You can run the lambda locally, inside your Docker container. Follow these steps:

1. Install [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
2. Create a json with your request, see event.json for an example.
3. Invoke a lambda via  SAM:
```javascript
sam local invoke GurupaBot -e event.json
```

Currently, you will get an exception, because you don't have a token to connect to DynamoDB, where all the list of chat ids is stored.
To test locally, just add around line 65 to return the response.
```javascript
const response = {
        statusCode: 200,
        body: JSON.stringify(message),
    };
return response;

```
More info about [SAM invoke](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-using-invoke.html)
