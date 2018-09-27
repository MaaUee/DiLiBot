/*-----------------------------------------------------------------------------
A simple Language Understanding (LUIS) bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
require('dotenv-extended').load();

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var inMemoryStorage = new builder.MemoryBotStorage();

//var tableName = 'botdata';
//var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
//var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't
// match any intents handled by other dialogs.
var bot = new builder.UniversalBot(connector);

bot.set('storage', inMemoryStorage);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westeurope.api.cognitive.microsoft.com';


const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + '87dcb46e-14e5-438a-be34-a9e321a1cd0b' + '?subscription-key=' + 'cb6e1cb4eb494a55b7933066b5cd71a0';

// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

// Add a dialog for each intent that the LUIS app recognizes.
// See https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-recognize-intent-luis 
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

/* dusts.json
** ask for {dustclass} (Model /T-Nr)
** search for {dust}s like {entity}
** ask user for confirmation
*/
bot.dialog('MaterialToVacuum',[
    (session, args, next) => {

        var vaccumModel = builder.EntityRecognizer.findEntity(args.intent.entities, 'VacuumModel');
        var material = builder.EntityRecognizer.findEntity(args.intent.entities,'Material');
        var materialEntity = material.entity;

        if (vaccumModel && material) {
            session.send('You are searching for a Vaccum: ' + vaccumModel.entity);
            session.send('Your Material is: ' + material.entity);
            next({ response: {
                vaccumModel: vaccumModel.entity,
                material: material.entity
            }}); 
        }
        else if (material && !vaccumModel) {
            // no entities detected, ask user for a destination
            session.conversationData.material = material.entity;
            builder.Prompts.text(session, 'Please enter your Vaccum Model');
        }

        session.send('You reached the MaterialToVacuum intent. You said \'%s\'.', session.message.text);
    
    },(session, results) => {
        //TODO unterscheiden von prompt oder nicht prompt daten
            var vacumModel = results.response;
            var material = session.conversationData.material;
            session.send('Your Model: ' + vacumModel + 'And your Material: ' + material); 
            session.endDialog();
    }
]).triggerAction({
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
