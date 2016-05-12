'use strict';

/**
 * @name Mail
 * @description mongoose schema & model implementation of nodemailer mail
 * @see {@link https://github.com/nodemailer/nodemailer#e-mail-message-fields|Email Message Fields}
 */

//dependencies
var path = require('path');
var _ = require('lodash');
var async = require('async');
var config = require('config');
var environment = require('execution-environment');
var nodemailer = require('nodemailer');
var sendgrid = require('nodemailer-sendgrid-transport');
var emailTemplates = require('email-templates');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Mixed = Schema.Types.Mixed;

//obtain configuration from config
var _config = config.has('mailer') ? config.get('mailer') : {};

//merge default configurations
_config = _.merge({}, {
    transport: {
        auth: {
            //jshint camelcase:false
            api_key: '',
            //jshint camelcase:true
        }
    },
    templatesDir: path.join(process.cwd(), 'views', 'emails')
}, _config);


var mailTransport =
    nodemailer.createTransport(sendgrid(_config.transport));


//default schema fields
var schemaFields = {

    /**
     * @name type
     * @description type of email sent
     * @type {Object}
     */
    type: {
        type: String,
        required: true,
        default: 'Normal'
    },


    /**
     * @name from
     * @description The e-mail address of the sender. 
     *              All e-mail addresses can be plain 'sender@server.com' or 
     *              formatted '"Sender Name" <sender@server.com>'
     * @type {Object}
     */
    from: {
        type: String,
        required: true,
        trim: true
    },


    /**
     * @name sender
     * @description  An e-mail address that will appear on the 
     *               Sender: field (always prefer from if you're not sure 
     *               which one to use)
     * @type {Object}
     */
    sender: {
        type: String,
        required: true,
        isEmail: true
    },


    /**
     * @name level
     * @description array of recipients e-mail addresses that will appear 
     *              on the To: field
     * @type {Object}
     */
    to: {
        type: [String],
        required: true
    },


    /**
     * @name cc
     * @description  an array of recipients e-mail addresses that will appear 
     * on the Cc: field
     * @type {Object}
     */
    cc: {
        type: [String]
    },


    /**
     * @name bcc
     * @description  an array of recipients e-mail addresses that will appear 
     * on the Bcc: field
     * @type {Object}
     */
    bcc: {
        type: [String]
    },


    /**
     * @name subject
     * @description subject of the sent e-mail
     * @type {Object}
     */
    subject: {
        type: String,
        required: true,
        trim: true
    },


    /**
     * @name text
     * @description plaintext version of the message as an Unicode string
     * @type {Object}
     */
    text: {
        type: String
    },


    /**
     * @name html
     * @description HTML version of the message as an Unicode string 
     * @type {Object}
     */
    html: {
        type: String,
        required: true
    },


    /**
     * @name response
     * @description mail send response
     * @type {Object}
     */
    response: {
        type: Mixed
    },


    /**
     * @name sentAt
     * @description a time when an email is successfully sent to receiver(s)
     * @type {Object}
     */
    sentAt: {
        type: Date
    }
};


//merge additional fields
var definition = _.merge({}, schemaFields, (_config.model || {}).fields);


//mail schema
var MailSchema = new Schema(definition);

//-----------------------------------------------------
// hooks
//-----------------------------------------------------
MailSchema.pre('validate', function(next) {

    //ensure mail `type`
    if (!this.type) {
        this.type = 'Normal';
    }

    //ensure `to` field is in array format
    if (this.to && _.isString(this.to)) {
        this.to = [].concat(this.to.split(','));
    }

    //ensure `cc` field is in array format
    if (this.cc && _.isString(this.cc)) {
        this.cc = [].concat(this.cc.split(','));
    }

    //ensure `bcc` field is in array format
    if (this.bcc && _.isString(this.bcc)) {
        this.bcc = [].concat(this.bcc.split(','));
    }

    //ensure sender is set
    if (this.from && !this.sender) {
        //extract sender from
        //`example <no-reply@example.com>` format
        var sender = this.from.replace('<', '').replace('>', '').split(' ');
        this.sender = sender && sender.length === 2 ? sender[1] : sender[0];
    }

    next();

});


//-----------------------------------------------------
// instance methods
//-----------------------------------------------------


/**
 * @function
 * @name send
 * @description send this mail
 * @param  {Function} done a callback to invoke on success or failure
 * @private
 */
MailSchema.methods.send = function(done) {

    //reference
    var mail = this;

    //obtain current environment
    var isLocal = environment.isLocal();

    //if local environment return mail instance
    if (isLocal) {
        this.sentAt = new Date();
        mail.save(function(error, mail) {
            done(error, mail);
        });
    }

    //send email using transport
    else {
        //prepare payload
        var payload = _.omit(mail.toObject(), 'sender');

        async.waterfall([

            function sendMail(next) {
                mailTransport.sendMail(payload, function(error, response) {

                    //compose error
                    if (error) {
                        response = {
                            code: error.code,
                            message: error.message,
                            status: error.status
                        };
                    }

                    //pass error too
                    next(null, response, error);

                });

            },

            function afterSend(response, error, next) {
                //set respinse
                mail.response = response;

                //set send date
                if (response.message.toLowerCase() === 'success') {
                    mail.sentAt = new Date();
                }

                //update mail
                mail.save(function(_error, _mail) {
                    //fire original error
                    if (error) {
                        next(error);
                    }

                    //continue
                    else {
                        next(_error, _mail);
                    }
                });
            }

        ], done);

    }
};


//-----------------------------------------------------
// static methods
//-----------------------------------------------------

/**
 * @name _send
 * @private
 */
MailSchema.statics._send = function(type, data, done) {

    //extend data with default configuration
    data = _.merge({ type: type }, _config, data);

    //reference mail
    var Mail = this;

    async.waterfall([

        function accessTemplateDir(next) {
            emailTemplates(_config.templatesDir, next);
        },

        function prepareTemplate(template, next) {
            template(type, data, function(error, html) {
                next(error, html);
            });
        },

        function sendEmail(html, next) {
            //extend mail data
            data = _.extend(data, {
                html: html
            });

            //save mail
            Mail.create(data, next);

        }

    ], done);

};


/**
 * @function
 * @name send
 * @param  {String}   type type of email to send. it used to detect a template
 *                         to use in send email
 * @param  {Object}   data valid nodemailer email fields
 * @param  {Function} done a callback to invoke on success or failure
 * @return {Mail}          an instance of mail sent
 * @public
 */
MailSchema.statics.send = function(type, data, done) {

    //reference mail
    var Mail = this;

    Mail._send(type, data, function(error, mail) {
        //notify creation error
        if (error) {
            done(error);
        }

        //send email
        else {
            mail.send(done);
        }

    });

};


/**
 * @function
 * @name queue
 * @description queue email for later send
 * @param  {String}   type type of email to send. it used to detect a template
 *                         to use in send email
 * @param  {Object}   data valid nodemailer email fields
 * @return {Mail}          an instance of mail queued
 * @public
 */
MailSchema.statics.queue = function(type, data, done) {

    //reference mail
    var Mail = this;

    Mail._send(type, data, function(error, mail) {

        if (error) {
            //fire mail:queue:error event
            Mail.emit('mail:queue:error', error);
        } else {
            //fire mail:queue event
            Mail.emit('mail:queued', mail);
        }

        //invoke callback if provided
        if (done && _.isFunction(done)) {
            done(error, mail);
        }

    });

};


/**
 * @function
 * @name resend
 * @description re-send all failed email based on specified criteria
 * @param  {Function} done a callback to invoke on success or failure
 * @public
 */
MailSchema.statics.resend = function(criteria, done) {
    //normalize arguments
    if (criteria && _.isFunction(criteria)) {
        done = criteria;
        criteria = {};
    }

    criteria = _.merge({}, {
        sentAt: null //ensure email have not been sent
    }, criteria);

    //reference Mail
    var Mail = this;

    //resend fail or unsent mail(s)
    async.waterfall([

        function findUnsentMails(next) {
            Mail.find(criteria, next);
        },

        function resendMails(unsents, next) {

            //check for unsent mail(s)
            if (unsents) {

                //prepare send work
                //TODO make use of multi process
                unsents = _.map(unsents, function(unsent) {
                    return function(_next) {
                        unsent.send(_next);
                    };
                });

                async.parallel(_.compact(unsents), next);

            } else {
                next(null, unsents);
            }
        }

    ], done);
};

//exports log schema
module.exports = MailSchema;