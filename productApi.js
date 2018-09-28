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
            console.log('i am im Body!');
            var headers = {
                'Accept': 'application/vnd.siren+json',
                'X-TTS-ApiKey': '580deae71c371f0001000008670cd3a266244d69494b6d96ffe12227',
                'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IkJGMEZEQTY0RTU0NDkxOUYxMzYxRjI0MzEyNTQyRTI3NjhFQkFDMEQiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJ2d19hWk9WRWtaOFRZZkpERWxRdUoyanJyQTAifQ.eyJuYmYiOjE1MzgxMjY2NzUsImV4cCI6MTUzODEzMDI3NSwiaXNzIjoiaHR0cHM6Ly9zdHMtcXMudHRzLWNvbXBhbnkuY29tL2NvcmUiLCJhdWQiOlsiaHR0cHM6Ly9zdHMtcXMudHRzLWNvbXBhbnkuY29tL2NvcmUvcmVzb3VyY2VzIiwidHRzLnBpbV9jYXRhbG9nIl0sImNsaWVudF9pZCI6ImhhY2thdGhvbi5oZG0uc3RhZ2luZyIsInNjb3BlIjpbInR0cy5waW1fY2F0YWxvZyJdfQ.nO6JUQlRtp_2AGJjpSbc-DOJxAmKRzSb0tAPonOzgcIqf82RrLbVbWeVVu6YXOBw8T6ST3xXaNzKcUrStbkDFuhptsJq-KPEGuriAmqaIzYen4_4oVIb0qpwkO-x20HOxePFU0PpyHMHyhcjALH6COU0ovNnrJv0jxQU4U7Sx4Fz2iuO1YfLBnsGTXjjh8JGsyFm9cU604ABM6wajBGP6Q5OwV6nOpelETEfCYt4Z5N44rTABVX1kEKHTYRPfPd8GIw7t_84M86Y5ekRmamTzp2c7uFEr60yTjpOM5phsNiQ382V8ZOL9ooyTLjOfRC4S368xLvKtFIpdCIPXssOtQ'
            }
        
            var options = {
                url: 'https://api-qs.tts-company.com:443/pimservice/MachineModel/de-DE/' + productId,
                method: 'GET',
                headers: headers
            }

            request.get(options, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log('GETTTT:' + body)
                    return body;
                }
            })
        }
      });
}
