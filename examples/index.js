'use strict';


//dependencies
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/byteskode-mailer');
var Mail = require('byteskode-mailer');
var faker = require('faker');

//Alert!: Probably your should start mail processing in your worker process
//and not main process
Mail.worker.start();

//listen for the worker queue events
Mail.worker.queue.on('job complete', function(id, result) {
    console.log(id, result);
});

setInterval(function(argument) {
    
    //queue email for send
    Mail.queue({
        recipientName: faker.name.findName(),
        token: faker.random.uuid(),
        to: faker.internet.email(),
        baseUrl: faker.internet.url(),
        subject: 'Account confirmation',
        html: faker.lorem.sentence(),
        sender: faker.internet.email(),
        from: faker.internet.email(),
        type: 'confirm'
    });

}, 4000);