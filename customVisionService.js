
'use strict';

const request = require('request-promise').defaults({ encoding: null });

module.exports = {
    predict: predict
}

function predict(stream) {
    const options = {
        method: 'POST',
        url: 'https://southcentralus.api.cognitive.microsoft.com/customvision/v2.0/Prediction/d1d7e55b-5802-43b7-8abf-bdbcb7328bdf/image?iterationId=a3a78bb8-242b-4ae6-8df8-84c83c32da79',        
        headers: {
            'Content-Type': 'application/octet-stream',
            'Prediction-Key': 'b56db42d6b294c769c56d98e57d4f0fa'
        },        
        body: stream
    };

    return request(options);
}