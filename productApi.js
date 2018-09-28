var request = require('request');

exports.getProduct = function(productId){

    var token = '';

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
        token = body;
        console.log(body.access_token);
        if(body){

            var headers = {
                'Accept': 'application/vnd.siren+json',
                'X-TTS-ApiKey': '580deae71c371f0001000008670cd3a266244d69494b6d96ffe12227',
                'Authorization': 'Bearer ' + token
            }
        
            var options = {
                url: 'https://api-qs.tts-company.com:443/pimservice/MachineModel/de-DE/' + productId,
                method: 'GET',
                headers: headers
            }

            request.get(options, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    return body;
                }
            })
        }
      });
}
