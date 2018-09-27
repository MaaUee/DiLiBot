/*-----------------------------------------------------------------------------
A simple Language Understanding (LUIS) bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var cognitiveservices = require('botbuilder-cognitiveservices');
var nodemailer = require('nodemailer');
require('dotenv-extended').load();

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Listen for messages from users 
/* server.post('/api/messages', connector.listen()); */

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

/* var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);
 */
// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't
// match any intents handled by other dialogs.
var bot = new builder.UniversalBot(connector);
bot.set('storage', new builder.MemoryBotStorage());         // Register in-memory state storage
server.post('/api/messages', connector.listen());

var qnarecognizer = new cognitiveservices.QnAMakerRecognizer({
    knowledgeBaseId: '8f297337-8959-44f6-a8cd-8127e94f350d',
    authKey: '7e9cdf99-4bc5-4c55-81d9-4e9371fecc75',
    endpointHostName: 'https://diliqnakb.azurewebsites.net/qnamaker',
    top: 4
});

/* bot.set('storage', tableStorage); */

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westeurope.api.cognitive.microsoft.com';


const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

// Add a dialog for each intent that the LUIS app recognizes.
// See https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-recognize-intent-luis 
var intents = new builder.IntentDialog({ recognizers: [qnarecognizer] });

bot.dialog('GreetingDialog',
    (session) => {
        session.send('You reached the Greeting intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Greeting'
})

bot.dialog('HelpDialog',
    (session) => {
        session.send('You reached the Help intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Help'
})

bot.dialog('SearchForVacuum',
    (session) => {
        session.send('You reached the SearchForVacuum intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'SearchForVacuum'
})

bot.dialog('MaterialToVacuum',
    (session) => {
        session.send('You reached the MaterialToVacuum intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'MaterialToVacuum'
})

bot.dialog('DetailsToVacuum',
    (session) => {
        session.send('You reached the DetailsToVacuum intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'DetailsToVacuum'
})

bot.dialog('AccessoryToVacuum',
    (session) => {
        session.send('You reached the AccessoryToVacuum intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'AccessoryToVacuum'
})

bot.dialog('None', [
    (session) => {
        session.conversationData.question = session.message.text;
        builder.Prompts.text(session, 'I am sorry, unfortunately I cannot answer your question. I will inform an employee to answer your question via mail. What is your email adress?');
    },
    (session, results) => {
        var transporter = nodemailer.createTransport({
            host: 'smtp.mail.de',
            port: '465',
            secure: true,
            auth: {
                user: 'delibot@mail.de',
                pass: 'DeliBot18!'
            }
        });
        var mailOptions = {
            from: 'delibot@mail.de',
            to: results.response,
            subject: 'BotMail',
            text: session.conversationData.question
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                session.send('Sorry something went wrong I could send the mail. Please contact the support 0702480424010.')
            } else {
                session.send('Thank you for providing your email adress. I have informed an employee to answer your question.');
            }
        });
        session.endDialog();
    }
]).triggerAction({
    matches: 'None'
})

bot.dialog('/', intents);

intents.matches('qna', [
    function (session, args, next) {
        var answerEntity = builder.EntityRecognizer.findEntity(args.entities, 'answer');
        session.send(answerEntity.entity);
    }
]);

/* bot.dialog('QNA',
    (session, args, next) => {
        var answerEntity = builder.EntityRecognizer.findEntity(args.entities, 'answer');
        session.send(answerEntity.entity);
        session.endDialog();
    }
).triggerAction({
    matches: 'QNA'
}) */
