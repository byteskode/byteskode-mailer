'use strict';

//dependencies
var path = require('path');
var async = require('async');
var expect = require('chai').expect;
var faker = require('faker');
var Mail = require(path.join(__dirname, '..'));

describe('byteskode mailer', function() {

    it('should be exported', function() {
        expect(Mail).to.exist;
    });

    it('should be able to send and resend email', function() {
        expect(Mail.send).to.exist;
        expect(Mail.resend).to.exist;
    });

    it('should be able to validate sent email', function(done) {
        var mail = new Mail();
        mail.validate(function(error) {
            expect(error).to.exist;
            expect(error.name).to.equal('ValidationError');
            done();
        });
    });


    it('should be able to send email in test and development mode', function(done) {

        var email = {
            recipientName: faker.name.findName(),
            token: faker.random.uuid(),
            to: faker.internet.email(),
            baseUrl: faker.internet.url(),
            subject: 'Account confirmation'
        };

        Mail
            .send('confirm', email, function(error, response) {

                expect(error).to.not.exist;

                expect(response).to.exist;

                expect(response.type).to.exist;
                expect(response.type).to.be.equal('confirm');
                expect(response.type).to.be.a.String;

                expect(response.to).to.exist;
                expect(response.to).to.be.an.Array;
                expect(response.to).to.include(email.to);

                expect(response.sentAt).to.exist;
                expect(response.sentAt).to.be.a.Date;

                expect(response.html).to.exist;
                expect(response.html).to.be.a.String;

                expect(response.subject).to.exist;
                expect(response.subject).to.be.equal('Account confirmation');
                expect(response.subject).to.be.a.String;


                done(error, response);
            });
    });



    it('should be able to resend email(s) in test and development mode', function(done) {

        var email = {
            recipientName: faker.name.findName(),
            token: faker.random.uuid(),
            to: faker.internet.email(),
            baseUrl: faker.internet.url(),
            subject: 'Account confirmation',
            html: faker.lorem.sentence(),
            sender: faker.internet.email(),
            from: faker.internet.email()
        };

        async.waterfall([

            function createMail(next) {
                Mail.create(email, next);
            },

            function resend(mail, next) {
                Mail.resend(next);
            }

        ], function(error, response) {

            expect(error).to.not.exist;

            expect(response).to.exist;

            response = response[0];

            expect(response.type).to.exist;
            expect(response.type).to.be.equal('Normal');
            expect(response.type).to.be.a.String;

            expect(response.to).to.exist;
            expect(response.to).to.be.an.Array;
            expect(response.to).to.include(email.to);

            expect(response.sentAt).to.exist;
            expect(response.sentAt).to.be.a.Date;

            expect(response.html).to.exist;
            expect(response.html).to.be.a.String;

            expect(response.subject).to.exist;
            expect(response.subject).to.be.equal('Account confirmation');
            expect(response.subject).to.be.a.String;


            done(error, response);
        });

    });

    it('should be able to queue email in test and development mode for later send', function(done) {

        var email = {
            recipientName: faker.name.findName(),
            token: faker.random.uuid(),
            to: faker.internet.email(),
            baseUrl: faker.internet.url(),
            subject: 'Account confirmation'
        };

        Mail.on('mail:queued', function(response) {

            expect(response).to.exist;

            expect(response.type).to.exist;
            expect(response.type).to.be.equal('confirm');
            expect(response.type).to.be.a.String;

            expect(response.to).to.exist;
            expect(response.to).to.be.an.Array;
            expect(response.to).to.include(email.to);

            expect(response.sentAt).to.not.exist;

            expect(response.html).to.exist;
            expect(response.html).to.be.a.String;

            expect(response.subject).to.exist;
            expect(response.subject).to.be.equal('Account confirmation');
            expect(response.subject).to.be.a.String;

            done(null, response);

        });

        //queue email
        Mail.queue('confirm', email);

    });

});