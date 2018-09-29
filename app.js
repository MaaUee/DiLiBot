/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var cognitiveservices = require('botbuilder-cognitiveservices');
var nodemailer = require('nodemailer');
var dusts = require('./dusts.json');
var models = require('./models.json');
var request = require('request');
require('dotenv-extended').load();
var AdaptiveCards = require("adaptivecards");


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

//var tableName = 'botdata';
//var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
//var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector);
bot.set('storage', new builder.MemoryBotStorage());

//bot.set('storage', tableStorage);


var qnarecognizer = new cognitiveservices.QnAMakerRecognizer({
    knowledgeBaseId: '8f297337-8959-44f6-a8cd-8127e94f350d',
    authKey: '7e9cdf99-4bc5-4c55-81d9-4e9371fecc75',
    endpointHostName: 'https://diliqnakb.azurewebsites.net/qnamaker',
    top: 4
});

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westeurope.api.cognitive.microsoft.com';


const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;
// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

// Add a dialog for each intent that the LUIS app recognizes.
var intents = new builder.IntentDialog({ recognizers: [qnarecognizer] });

function getToken(){
    return new Promise((resolve)=>{
        var tokenOptions = {
            url: 'https://login-festool-qs.azurewebsites.net/connect/token',
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.siren+json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic aGFja2F0aG9uLmhkbS5zdGFnaW5nOkw2ZUJKUWhBUzdlQ01zOE9NM1pl'
            },
            body: 'grant_type=client_credentials&scope=tts.pim_catalog'
        } 
    
        request.post(tokenOptions, function(error, response, body){
            resolve(body);
        })
    })
}

function getProduct(token, id){
    return new Promise((resolve)=>{
        var headers = {
            'Accept': 'application/vnd.siren+json',
            'X-TTS-ApiKey': '580deae71c371f0001000008670cd3a266244d69494b6d96ffe12227',
            'Authorization': 'Bearer ' + token
        }
    
        var options = {
            url: 'https://api-qs.tts-company.com:443/pimservice/MachineModel/de-DE/' + id,
            method: 'GET',
            headers: headers
        }
    
        request.get(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                resolve(body);
            }
        })
    })
}

/*
async function connectApi(){
    const token = await getToken();
    const tokenId = JSON.parse(token);
    const product = await getProduct(tokenId, 'id-96c3adba-dbc4-11e6-80dc-005056b345de');


    session.send('Your Toke:' + tokenId + 'and your product: ' + JSON.parse(product));
}
*/

bot.dialog('/', intents);

bot.on('conversationUpdate',(session,activity,message) => {
    if(session.membersAdded){
       session.membersAdded.forEach(function (identity) {
    if(identity.id === session.address.bot.id){
       bot.beginDialog(session.address,'GreetingDialog');
       }
    });
   }
 })
 
bot.dialog('GreetingDialog',
    (session)=>{
        session.send("Hallo, ich bin DiLiBot, Was kann ich für dich tun?");
        session.endDialog();
}).triggerAction({
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

bot.dialog('SearchForVacuum',[
    function (session, args, next) {
        var material = builder.EntityRecognizer.findEntity(args.intent.entities,'Material');
        if(material) {
            findVacuumToMaterial(session, material);
        } else {
           next();
        }
   },
   function (session) {
        //builder.Prompts.choice(session, "Für was benötigst du deinen Sauger? \n", ["Privat", "Gewerblich"],{ listStyle: builder.ListStyle.button }); 
        choicebox = {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.0",
                "body": [
                    {
                        "type": "Container",
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": "Für was benötigst du deinen Sauger?",
                                "weight": "bolder",
                                "size": "medium"
                            }
                        ]
                    }
                ],
                "actions": [
                  {
                    "type": "Action.Submit",
                    "title": "Privat",
                    "data":{
                        "forUse":"private" 
                    }
                  },
                  {
                    "type": "Action.Submit",
                    "title": "Geschäftlich",
                    "data":{
                        "forUse":"business" 
                    }
                  }
                ]
              
        }
        var msg = new builder.Message(session)
            .addAttachment(choicebox);
        session.send(msg);
    },
    function (session, args) {
        session.send( args.response +'is added to the basket');
        session.endDialog(); //ToDo
    }
]).triggerAction({
   matches: 'SearchForVacuum'
})

function findVacuumToMaterial(session, material){
    for(i in dusts.dustmatches) {
        if(dusts.dustmatches[i].dust === material.entity){
            session.send("Alle Sauger mit Klasse %s und höher können %s saugen. \n Folgende Produkte kann ich Ihnen empfehlen:", dusts.dustmatches[i].dustclass, dusts.dustmatches[i].dust);
            var msg = new builder.Message(session);
            msg.attachmentLayout(builder.AttachmentLayout.carousel);
            var attachmentsArray = [];
            for(j in models.vacuumTypes){
                var ctx= (models.vacuumTypes[j].model).substring(0,3);
                var condition = (models.vacuumTypes[j].model).includes(dusts.dustmatches[i].dustclass);
                if(dusts.dustmatches[i].dustclass === "L"){
                    condition = ctx.includes(dusts.dustmatches[i].dustclass) || ctx.includes("M") || ctx.includes("H");
                }else if(dusts.dustmatches[i].dustclass === "M"){
                    condition = ctx.includes(dusts.dustmatches[i].dustclass) || ctx.includes("H");
                }else if(dusts.dustmatches[i].dustclass === "H"){
                    condition = ctx.includes(dusts.dustmatches[i].dustclass);
                }
                if(condition){
                    var url = "https://www.festool.de/@" + models.vacuumTypes[j].id;
                    var obj = 
                        new builder.HeroCard(session)
                            .title("Absaugmobil %s",models.vacuumTypes[j].model)
                            .images([builder.CardImage.create(session, models.vacuumTypes[j].img)])
                            .buttons([
                                builder.CardAction.openUrl(session, url, "mehr")
                            ])
                    ;
                    attachmentsArray.push(obj);
                }
            }
            msg.attachments(attachmentsArray);
        }
    }
    session.send(msg).endDialog();
}

bot.dialog('MaterialToVacuum', [
    (session, args, next) => {

        var vaccumModel = builder.EntityRecognizer.findEntity(args.intent.entities, 'VacuumModel');
        var material = builder.EntityRecognizer.findEntity(args.intent.entities, 'Material');
        var materialEntity = material.entity;

        if (vaccumModel && material) {
            session.send('You are searching for a Vaccum: ' + vaccumModel.entity);
            session.send('Your Material is: ' + material.entity);
            next({
                response: {
                    vaccumModel: vaccumModel.entity,
                    material: material.entity
                }
            });
        }
        else if (material && !vaccumModel) {
            // no entities detected, ask user for a destination
            session.conversationData.material = material.entity;
            builder.Prompts.text(session, 'Please enter your Vaccum Model');
        }

        session.send('You reached the MaterialToVacuum intent. You said \'%s\'.', session.message.text);

    }, (session, results) => {
        //TODO unterscheiden von prompt oder nicht prompt daten
            var vacuumModel = results.response.vaccumModel || results.response;
            var material = results.response.material || session.conversationData.material;
            session.send('Your Model: ' + vacuumModel + 'And your Material: ' + material);
            dusts.dustmatches.forEach((dustType) => {
                if(dustType.dust === material){
                    session.send('Alle Sauger mit Klasse ' + dustType.dustclass + ' und höher können ' + material + 'saugen');
                    models.vacuumTypes.forEach((vacuum) => {
                        if((vacuum.model).includes(vacuumModel) && (vacuum.model).includes(dustType.dustclass)){
                            session.send('Ihr Staubsauger: ' + vacuumModel + 'kann ' + material + 'saugen!');
                        }
                    });
                }
            });
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

intents.matches('qna', [
    function (session, args, next) {
        var answerEntity = builder.EntityRecognizer.findEntity(args.entities, 'answer');
        session.send(answerEntity.entity);
    }
]);
