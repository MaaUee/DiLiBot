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
var cards = require('./adaptiveCards.json');
const utils = require('./utils.js');
const customVisionService = require('./customVisionService.js');


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
var luisAppId = '87dcb46e-14e5-438a-be34-a9e321a1cd0b';
var luisAPIKey = 'fe6e32de84f74dfca2cb86892b47f945';
var luisAPIHostName = process.env.LuisAPIHostName || 'westeurope.api.cognitive.microsoft.com';


const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + '87dcb46e-14e5-438a-be34-a9e321a1cd0b' + '?subscription-key=' + 'fe6e32de84f74dfca2cb86892b47f945';
// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

// Add a dialog for each intent that the LUIS app recognizes.
var intents = new builder.IntentDialog({ recognizers: [qnarecognizer] });

//API call um TOKEN zu bekommen
//wird nicht verwendet weil wir die API nicht nach Produkte anfrage
function getToken() {
    return new Promise((resolve) => {
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

        request.post(tokenOptions, function (error, response, body) {
            resolve(body);
        })
    })
}
//API call für Produkte
//wird nicht verwendet weil JSON sehr unpraktisch ist
function getProduct(token, id) {
    return new Promise((resolve) => {
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

//Standart Dialog checkt alle Intents durch und sucht sich das richtige aus
bot.dialog('/', intents);

bot.on('conversationUpdate', (session, activity, message) => {
    if (session.membersAdded) {
        session.membersAdded.forEach(function (identity) {
            if (identity.id === session.address.bot.id) {
                bot.beginDialog(session.address, 'GreetingDialog');
            }
        });
    }
})

/*
* Wenn der Benutzer Begrüßungen eingibt 
*/
bot.dialog('GreetingDialog',
    (session) => {
        session.send("Hallo, ich bin DiLiBot, Was kann ich für dich tun?");
        session.endDialog();
    }
).triggerAction({
    matches: 'Greeting'
})

/*
* Falls der Benutzer nich weiß, wie DeliBot benutzt werden kann
*/
bot.dialog('HelpDialog',
    (session) => {
        session.send('Hallo, ich bin DiLiBot, ich kann dich auf der Suche nach einem Absaugmobil beraten, oder dir Fragen zu deinem Modell beantworten', session.message.text);
        session.endDialog();
    }, (session, __, next) => {
        choicebox = cards.endConversation;
        var msg = new builder.Message(session)
            .addAttachment(choicebox);
        session.send(msg);
        next();
    },
    (session) => {

    }
).triggerAction({
    matches: 'Help'
})

/*
* Der Benutzer Hat die Intension, einen Sauger zu einem Anwendungsszenario zu finden. 
* z.B. "Ich möchte einen Sauger kaufen" oder "Welcher Sauger kann Holz saugen?"
*/
bot.dialog('SearchForVacuum', [
    function (session, args, next) {
        //checkt ob etwas augewählt wurde
        if (session.message && session.message.value) {
            processSubmitAction(session, session.message.value);
            return;
        }
        //Material wurde bereits angegeben oder wird im laufe des Dialogs erfragt
        var material = session.conversationData.material || builder.EntityRecognizer.findEntity(args.intent.entities, 'Material');
        if (material) {
            session.conversationData.material = material;
            session.endDialog();
            session.beginDialog("BusinessForm");
        } else {
            next();
        }
    },
    (session, __, next) => {
        choicebox = cards.privateBusiness;
        var msg = new builder.Message(session)
            .addAttachment(choicebox);
        session.send(msg);
        next();
    },
    (session) => {
    }

]).triggerAction({
    matches: 'SearchForVacuum'
})

/*
* 
*/
bot.dialog('BusinessForm', [
    function (session, args, next) {
        if (session.message && session.message.value && session.message.value.volume) {
            formSubmitAction(session, session.message.value);
            return;
        }
        else {
            next();
        }
    },
    (session, __, next) => {
        form = cards.findVacuum;
        var msg = new builder.Message(session)
            .addAttachment(form);
        session.send(msg);
        next();
    }, (session, results) => {
    }
])

/*
* Wenn kein Material angegeben wurde, wird es hier Erfragt. 
* Zur Sicherheit kann der Benutzer dann unter allen gefundenen vorschlägen Stäube auswählen (findMaterial)
*/
bot.dialog('Business', [
    (session) => {
        builder.Prompts.text(session, 'Mit welchen Stäuben möchtest du arbeiten?');
    },
    (session, results, next) => {
        session.conversationData.material = results.response;
        if (session.conversationData.material) {
            var materials = findMaterial(session);
            if (materials.length > 0) {
                session.conversationData.materials = materials;
                session.endDialog();
                session.beginDialog('findMaterial');
            } else {
                session.endDialog();
                session.beginDialog('Business');
            }
        } else {
            session.endDialog();
            session.beginDialog('Business');
        }
    },
    (session) => {
        session.endDialog();
    }
])

/*
* Die vom Benutzer angegebenen Materialien werden überprüft und als Auswahlliste ausgegeben, 
* So kann beispielsweiße zwischen verschiedenen Holzarten unterschieden werden
*/
bot.dialog('findMaterial', [
    (session, results, next) => {
        if (session.message && session.message.value) {
            materialSubmitAction(session, session.message.value);
            return;
        }
        else {
            next();
        }
    },
    (session, __, next) => {
        var choices = [];
        for (i in session.conversationData.materials) {
            choice = {
                "type": "Input.Choice",
                "title": session.conversationData.materials[i],
                "value": session.conversationData.materials[i]
            }
            choices.push(choice);
        }

        askmaterials = {
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.0",
                "body": [{
                    "type": "Container",
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": "Bitte wähle aus, welche dieser Stäube du saugen möchtest",
                            "weight": "bolder",
                            "size": "medium"
                        },
                        {
                            "type": "Input.ChoiceSet",
                            "id": "materials",
                            "isMultiSelect": "true",
                            "choices": choices
                        }
                    ]
                }],
                "actions": [
                    {
                        "type": "Action.Submit",
                        "title": "Absenden"
                    }
                ]
            }

        }
        var msg = new builder.Message(session)
            .addAttachment(askmaterials);
        session.send(msg);
        next();
    }, (session, results) => {

    }

])


/*
* Wenn im SearchForVacuum Dialog die Option Business gewählt wurde.
* Beachtet alle im Laufe des Dialogs eingegebenen Optionen, sucht dann nach passenden Modellen und gibt diese aus
*/
bot.dialog('findBusinessVacuum', [
    function (session, args, next) {
        //Angaben, die im laufe das Dialogs gemacht wurden
        var material = session.conversationData.material;
        var volume = session.message.value.volume;
        var ac = session.message.value.ac;
        if (material) {
            showVacuums(findVacuumToMaterial(session, material, volume, ac), session);
            session.endDialog();
            session.endConversation();
        } else {
            next();
        }
    },
    (session, __, next) => {
        choicebox = cards.privateBusiness;
        var msg = new builder.Message(session)
            .addAttachment(choicebox);
        session.send(msg);
        next();
    },
    (session) => {

    }
])

/*
* Wenn im SearchForVacuum Dialog die Option Private gewählt wurde.
*/
bot.dialog('askForMobility', [
    function (session, args, next) {
        if (session.message && session.message.value && session.message.value.mobility) {
            // A Card's Submit Action obj was received
            processSubmitAction(session, session.message.value);
            return;
        }
        next();
    },
    (session, __, next) => {
        choicebox = cards.mobility;
        var msg = new builder.Message(session)
            .addAttachment(choicebox);
        session.send(msg);
    },

])

/*
* Je nach dem, ob Der Benutzer Mobil oder Stationäre Nutzung wählt, werden vorgegebene Modelle ausgegeben
*/
bot.dialog('Mobility', [
    (session, next) => {
        if (session.message.value.mobility) {
            var mobility = session.message.value.mobility;
            if (mobility === "mobile") {
                showVacuums(findPrivateVacuum(session, mobility), session);
            } else if (mobility === "stationary") {
                showVacuums(findPrivateVacuum(session, mobility), session);
            }
        }
    },
    (session) => {
        choicebox = cards.endConversation;
        var msg = new builder.Message(session)
            .addAttachment(choicebox);
        setTimeout(() => { session.send(msg); }, 3000);
    }
])

//Dialog um Konversation abzuschließen
bot.dialog('EndConversation', [
    (session) => {
        session.send('Cool das freut mich! Danke dir.');
        session.send('Frag mich etwas, falls ich dir noch helfen kann.');
        session.endConversation();
    }
])

/* Optionales Showcase Szenario
// Dieser Dialog erkennt Bilder und gibt den namen als Text raus
bot.dialog('SendImage',[
    function (session) { 
        session.send('HALLOOOOOO');
        builder.Prompts.attachment(session,'Lad ein Bild von deinem Absaugmobils.');
    },
    (session, __, next) => {
        if(utils.hasImageAttachment(session)){
            var stream = utils.getImageStreamFromMessage(session.message); 
            customVisionService.predict(stream)
                .then(function (response) {
                    // Convert buffer into string then parse the JSON string to object
                    var jsonObj = JSON.parse(response.toString('utf8'));
                    console.log(jsonObj);
                    //Array mit predictions
                    var topPrediction = jsonObj.predictions;
                    topPrediction.find(function(element) {
                        //wir holen uns die Prediction mit 0.50 oder höher
                        if(element.probability >= 0.50){
                            // element.tagName ist der Tag was Vision erkennt
                            session.send('Hey, I think this image is a' + element.tagName + ' !');
                        } else {
                            session.send('Sorry! I don\'t know what that is :(');
                        }
                      });
                }).catch(function (error) {
                    console.log(error);
                    session.send('Oops, there\'s something wrong with processing the image. Please try again.');
                });
    
        } else {
            //Falls er kein Bild bekommt
            session.send('I did not receive any image');
        }
    },

])*/

/*
* Wenn der Benutzer z.B. fragt "Kann ich mit meinem Sauger Holz saugen?"
*/
bot.dialog('MaterialToVacuum', [
    //STEP 1
    (session, args, next) => {

        //Checkt ob Adaptive card geklickt wurde und ruft processSubmitAction() auf //Für Optionales Showcase Scenario
        if (session.message && session.message.value && session.message.value.help) {
            //ImageSubmitAction(session, session.message.value);
            processSubmitAction(session, session.message.value);
            return;
        }

        //prüft ob Entities im Satz sind
        var vaccumModel = builder.EntityRecognizer.findEntity(args.intent.entities, 'VacuumModel');
        var material = builder.EntityRecognizer.findEntity(args.intent.entities, 'Material');

        //falls beides erkannt ist wird gleich mit der Antwort im STEP 2 weitergemacht
        if (vaccumModel && material) {
            next({
                response: {
                    vaccumModel: vaccumModel.entity,
                    material: material.entity
                }
            });
        }
        //falls nur material erkannt wurde gehen fragen wir nochmal nach MODEL und gehen in STEP 2
        else if (material && !vaccumModel) {
            // no entities detected, ask user for a model
            session.conversationData.material = material.entity;
            //choicebox = cards.imageConversation;
            builder.Prompts.text(session, 'Ich konnte das Modell deines Absaugmobils nicht identifizieren. \n Bitte sag mir, welches Absaugmobil du hast.');
            /* var msg = new builder.Message(session)
                    .addAttachment(choicebox);
                session.send(msg);*/
        }

    },
    //STEP 2 
    (session, results, next) => {
        //results.response.vaccumModel ist wenn beides am anfang erkannt wurde wenn nicht steht Prompt in results.response
        var vacuumModel = results.response.vaccumModel || results.response;
        //gleiche wie oben
        var material = results.response.material || session.conversationData.material;
        if (vacuumModel) {
            //falls erkannt gehen wir hier rein und checken ob der sauger das kann und senden zum nächsten Step
            checkMaterialToVacuum(session, vacuumModel, material);
            next();
        } else {
            session.send("Tut mir leid, ich konnte das Model deines Absaugmobils nicht identifizieren. Bitte stelle eine neue Anfrage");
        }
    },
    //STEP 3
    (session) => {
        //hier wird die CARD gepusht um zu checken ob der Kunde zurfrieden war <endConversation> im File adaptiveCards.json
        choicebox = cards.endConversation;
        var msg = new builder.Message(session)
            .addAttachment(choicebox);
        setTimeout(() => { session.send(msg); }, 3000);
    },
    (session) => {
    }
]).triggerAction({
    matches: 'MaterialToVacuum'
})

/*Wenn der benutzer nach Produktdetails fragt */
bot.dialog('DetailsToVacuum', [
    (session) => {
        url = {
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": {
                "actions": [
                    {
                        "type": "Action.OpenUrl",
                        "title": "Details zu den Produkten findest du auf unserer Homepage",
                        "url": "https://www.festool.de/produkte/saugen"
                    }
                ]
            }
        }
        var msg = new builder.Message(session)
            .addAttachment(url);
        session.send(msg);
        next();
    }, (session, results) => {
        session.send(JSON.stringify(results));
    }
]).triggerAction({
    matches: 'DetailsToVacuum'
})

/*Wenn der Benutzer nach Verbrauchsmaterial oder Zubehör fragt */
bot.dialog('AccessoryToVacuum', [
    (session) => {
        url = {
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": {
                "actions": [
                    {
                        "type": "Action.OpenUrl",
                        "title": "passendes Zubehör zu den Produkten findest du auf unserer Homepage",
                        "url": "https://www.festool.de/produkte/saugen"
                    }
                ]
            }
        }
        var msg = new builder.Message(session)
            .addAttachment(url);
        session.send(msg);
        next();
    }, (session, results) => {
        session.send(JSON.stringify(results));
    }
]).triggerAction({
    matches: 'AccessoryToVacuum'
})

/* Wenn keine Intension erkannt wird */
bot.dialog('None', [
    (session) => {
        session.conversationData.question = session.message.text;
        builder.Prompts.text(session, 'Es tut mir leid, dass ich dir nicht helfen konnte. Wenn du möchtest, schreibe ich für dich eine Mail an den Service. Gib mir bitte deine E-Mail Adresse.');
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
            to: 'ka026@hdm-stuttgart.de',
            subject: 'BotMail',
            text: 'Frage/Problem: ' + session.conversationData.question + 'eMail: ' + results.response
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                session.send('Hoppla da ist etwas schief gelaufen. Bitte wende dich an den Support: 0702 / 480424010.');
                session.send('Falls du noch Fragen hast, kannst du mich ruhig fragen :)')
            } else {
                session.send('Danke, dass du mir deine E-Mail gegeben hast. Ich habe die Servicemitarbeiter benachrichtigt um deine Frage so schnell es geht zu beantworten.');
                session.send('Falls du noch Fragen hast, kannst du mich ruhig fragen :)');
            }
        });
        session.endConversation();
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

/* optionales ShowCase Szenario */
function ImageSubmitAction(session, value) {
    session.endDialog();
    session.beginDialog('sendImage', value);
}

/*
* Submit Action für Dialog
*/
function processSubmitAction(session, value) {
    var defaultErrorMessage = 'Bitte wähle';
    if (value.mobility) {
        session.endDialog();
        session.beginDialog('Mobility', value);
    }
    else if (value.usecase === 'business') {
        session.endDialog();
        session.beginDialog('Business', value);
    } else if (value.usecase === 'private') {
        session.endDialog();
        session.beginDialog('askForMobility', value);
    } else if (value.help === 'no') {
        //Falls wir keine Hilfe waren wird das NONE dialog geöffnet und dem Kunden erlaubt eine mail zu schreiben
        session.beginDialog('None', value);
    } else if (value.help === 'yes') {
        session.beginDialog('EndConversation', value);
    }

}

/*
* Submit des Formulars für das Business case 
*/
function formSubmitAction(session, value) {
    session.endDialog();
    session.beginDialog('findBusinessVacuum', value);
}

/*
* Ausgabe der Modelle für private Anwendung
*/
function findPrivateVacuum(session, mobility) {
    if (mobility === "mobile") {
        var vacuums = ["CTL MIDI", "CTL 26 E", "CTL SYS", "CTL MINI", "CTL 26 E AC", "CTL 26 E AC HD"];
    } else if (mobility === "stationary") {
        var vacuums = ["CTL 36 E", "CTL 36 E AC", "CTL 36 E AC HD", "CTL 48 E", "CTL 48 EAC"];
    }
    var attachmentsArray = [];
    for (j in models.vacuumTypes) {
        if (vacuums.includes(models.vacuumTypes[j].model)) {
            obj = buildHeroCard(j, session);
            attachmentsArray.push(obj);
        }
    }
    return attachmentsArray;
}

/*
* Sucht alle Modelle, die auf die Benutzereingaben passen
*/
function findVacuumToMaterial(session, material, volume, ac) {
    for (i in dusts.dustmatches) {
        materialToUse = material.entity || material;
        if (dusts.dustmatches[i].dust.toLowerCase() === materialToUse.toLowerCase()) {
            session.send("Folgende Produkte kann ich dir empfehlen:");
            var attachmentsArray = [];
            for (j in models.vacuumTypes) {
                var ctx = (models.vacuumTypes[j].model).substring(0, 3);
                var condition = (models.vacuumTypes[j].model).includes(dusts.dustmatches[i].dustclass);
                if (dusts.dustmatches[i].dustclass === "L") {
                    condition = ctx.includes(dusts.dustmatches[i].dustclass) || ctx.includes("M") || ctx.includes("H");
                } else if (dusts.dustmatches[i].dustclass === "M") {
                    condition = ctx.includes(dusts.dustmatches[i].dustclass) || ctx.includes("H");
                } else if (dusts.dustmatches[i].dustclass === "H") {
                    condition = ctx.includes(dusts.dustmatches[i].dustclass);
                }
                if (condition) {
                    var obj = false;
                    if (volume && ac) {
                        if ((models.vacuumTypes[j].model).includes(volume) && (models.vacuumTypes[j].model).includes("AC")) {
                            obj = buildHeroCard(j, session);
                        }
                    } else {
                        obj = buildHeroCard(j, session);
                    }
                    if (obj) {
                        attachmentsArray.push(obj);
                    }
                }
            }
        }
    }
    return attachmentsArray;
}

/*
* Gibt die Produkte als HeroCards aus
*/
function buildHeroCard(j, session) {
    var url = "https://www.festool.de/@" + models.vacuumTypes[j].id;
    var obj =
        new builder.HeroCard(session)
            .title("Absaugmobil %s", models.vacuumTypes[j].model)
            .images([builder.CardImage.create(session, models.vacuumTypes[j].img)])
            .buttons([
                builder.CardAction.openUrl(session, url, "mehr")
            ])
        ;
    return obj;
}

/*
* Anzeige der Herocards als Carousel
*/
function showVacuums(attachmentsArray = [], session) {
    var msg = new builder.Message(session);
    msg.attachmentLayout(builder.AttachmentLayout.carousel);
    msg.attachments(attachmentsArray);
    session.send(msg);
}

/*
* überprüft, ob ein bestimmte Sauger ein bestimmtes material saugen kann
*/
function checkMaterialToVacuum(session, vacuumModel, material) {
    //wird alles zu lowerCase gemacht und leerzeichen und bashes gesäubert von Ctl- 26 wir -> ctl26
    var cleanedVaccumModel = vacuumModel.toLocaleLowerCase().replace(/-|\s/g, "");
    builder.LuisRecognizer.recognize(vacuumModel, LuisModelUrl, function (err, intents, entities) {
        if (entities[0] && entities[0].type === 'VacuumModel') {
            for (i in dusts.dustmatches) {
                if (dusts.dustmatches[i].dust.toLocaleLowerCase() === material.toLocaleLowerCase()) {
                    //Falls Staubklasse L kann jeder Staubsauger es Saugen direkt raus aus for schleife
                    if (dusts.dustmatches[i].dustclass === 'L') {
                        session.send('Dieses Absaugmobil kann ' + dusts.dustmatches[i].dust.toUpperCase() + ' saugen. Viel Spass damit!');
                    } else {
                        for (j in models.vacuumTypes) {
                            //falls model gefunden wird dann geprüft welche klasse es hat
                            if ((models.vacuumTypes[j].model.replace(/-|\s/g, "").toLocaleLowerCase()).includes(cleanedVaccumModel)) {
                                //wenn staub M und model klasse H ist alles kein problem
                                if (dusts.dustmatches[i].dustclass === 'M' && (models.vacuumTypes[j].model).substring(0, 3).includes('H')) {
                                    session.send('Dieses Absaugmobil kann ' + dusts.dustmatches[i].dust.toUpperCase() + ' saugen. Viel Spass damit!');
                                    return;
                                }
                                //wenn staubklasse und modelklasse gleich dann auch alles easy
                                else if ((models.vacuumTypes[j].model).substring(0, 3).includes(dusts.dustmatches[i].dustclass)) {
                                    session.send('Dieses Absaugmobil kann ' + dusts.dustmatches[i].dust.toUpperCase() + ' saugen. Viel Spass damit!');
                                    return;
                                }
                                else {
                                    //falls nicht gehts nicht
                                    session.send('Leider kann dieses Absaugmobil ' + dusts.dustmatches[i].dust.toUpperCase() + ' nicht saugen. Wenn du wissen möchtest, welches Absaugmobil welches Material saugen kann, frag mich einfach :)');
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        } else {
            //falls alles nichts hilft wird der Client wohl eine neue frage stellen müssen
            session.send('Ich konnte das Model deines Absaugmobils nicht identifizieren. Stell mir einfach eine neue Frage, vielleicht verstehe ich dich dann :)');
        }
    })
}

/*
* nach Angabe des Materials (der Stäube) im Business Case Dialog
*/
function materialSubmitAction(session, value) {
    session.conversationData.material = findMostSensitive(session, value);
    session.endDialog();
    session.beginDialog('BusinessForm');
}

/*
* Aus evtl. mehreren Stäuben wird der kritischste ausgewählt sodass im weiteren Vorgang nurnoch ein Material beachtet werden muss
*/
function findMostSensitive(session, value) {
    var mset = false;
    var currentdust;
    for (i in session.message.value.materials) {
        dustclass = dusts.dustmatches[i].dustclass;
        if (dustclass === "H") {
            material = dusts.dustmatches[i].dust;
            return material;
        } else if (dustclass === "M") {
            currentdust = dusts.dustmatches[i];
            mset = true;
            break;
        } else if (mset == false) {
            currentdust = dusts.dustmatches[i];
        }
    }
    return currentdust.dust;
}

/*
* Sucht in dem im Businesscase angegebenen Material-Text nach bekannten Stäuben
*/
function findMaterial(session) {
    var materials = [];
    var dust;
    material = session.conversationData.material.toLowerCase();
    material = material.replace(/\,/g, " ");
    for (i in dusts.dustmatches) {
        dust = dusts.dustmatches[i].dust.toLowerCase();
        if (dust.includes(material) || material.includes(dust)) {
            materials.push(dusts.dustmatches[i].dust);
        }
    }
    return materials;
}