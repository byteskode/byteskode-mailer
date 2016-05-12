'use strict';

//dependencies
var path = require('path');
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


    it('should be able to log email in test and development mode', function(done) {

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

});