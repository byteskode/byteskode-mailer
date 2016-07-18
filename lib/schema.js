'use strict';

/**
 * @name Mail
 * @description mongoose schema and model implementation for nodemailer mail
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
    from: 'byteskode <no-reply@byteskode.com>',
    senderName: 'The byteskode Team',
    transport: {
        auth: {
            //jshint camelcase:false
            api_key: '',
            //jshint camelcase:true
        }
    },
    logger: console.log, //use console log as default logger
    templatesDir: path.join(process.cwd(), 'views', 'emails'),
    kue: { // kue settings
        concurrency: 10,
        connection: {}
    }
}, _config);


//obtain logger
var log = _config.logger;


//initiate sendgrid mail transport
var mailTransport =
    nodemailer.createTransport(sendgrid(_config.transport));


//default schema fields
var schemaFields = {

    /**
     * @name type
     * @description type of email sent
     * @type {Object}
     * @private
     */
    type: {
        type: String,
        required: true,
        default: 'Normal'
    },


    /**
     * @name from
     * @description The e-mail address of the sender 
     *              
     *              All e-mail addresses can be plain 'sender@server.com' or 
     *              formatted '"Sender Name" <sender@server.com>'
     *
     * @see {@link https://github.com/nodemailer/nodemailer#address-formatting|Addressing Format}
     * @type {Object}
     * @private
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
     *               
     * @type {Object}
     * @private
     */
    sender: {
        type: String,
        required: true,
        isEmail: true
    },


    /**
     * @name to
     * @description array of recipients e-mail addresses that will appear 
     *              on the To: field
     * @type {Object}
     * @private
     */
    to: {
        type: [String],
        required: true
    },


    /**
     * @name cc
     * @description  array of recipients e-mail addresses that will appear 
     *               on the Cc: field
     * @type {Object}
     * @private
     */
    cc: {
        type: [String]
    },


    /**
     * @name bcc
     * @description  array of recipients e-mail addresses that will appear 
     *               on the Bcc: field
     * @type {Object}
     * @private
     */
    bcc: {
        type: [String]
    },


    /**
     * @name subject
     * @description subject of the sent e-mail
     * @type {Object}
     * @private
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
     * @private
     */
    text: {
        type: String
    },


    /**
     * @name html
     * @description HTML version of the message as an Unicode string 
     * @type {Object}
     * @private
     */
    html: {
        type: String,
        required: true
    },


    /**
     * @name response
     * @description mail send response
     * @type {Object}
     * @private
     */
    response: {
        type: Mixed
    },


    /**
     * @name sentAt
     * @description a time when an email is successfully sent to receiver(s)
     * @type {Object}
     * @private
     */
    sentAt: {
        type: Date
    },


    /**
     * @name options
     * @description mail send options
     * @type {Object}
     * @private
     */
    options: {
        type: Mixed
    }

};


//merge additional schema fields
var definition = _.merge({}, schemaFields, (_config.model || {}).fields);


//define mail schema with timestamp options
var MailSchema = new Schema(definition, { timestamps: true });


//-----------------------------------------------------
// hooks
//-----------------------------------------------------

/**
 * @name preValidate
 * @description mail schema pre validate hook
 * @private
 */
MailSchema.pre('validate', function preValidate(next) {

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


//------------------------------------------------------------------------------
// MailSchema Instance Properties & Methods
//------------------------------------------------------------------------------


/**
 * @function
 * @name send
 * @description send this mail using actual transport or log it on console
 * @param  {Function} done a callback to invoke on success or failure
 * @private
 */
MailSchema.methods.send = function(done) {
    //reference
    var mail = this;

    //obtain current environment
    var isLocal = environment.isLocal() || (this.options || {}).fake;

    //if local environment return mail instance
    if (isLocal) {
        mail.sentAt = new Date();
        mail.save(function(error, _mail) {
            //log email
            log(_mail);
            done(error, _mail);
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
                //set response
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


//------------------------------------------------------------------------------
// MailSchema Static Properties & Methods
//------------------------------------------------------------------------------

/**
 * @name _send
 * @description helper static methods to perform mail send
 * @private
 */
MailSchema.statics._send = function(mail, options, done) {

    //merge mail with configuration
    mail = _.merge({}, _config, mail);

    //reference Mail model
    var Mail = this;

    async.waterfall([

        function accessTemplateDir(next) {
            emailTemplates(_config.templatesDir, function(error, template) {
                // catch error to allow template to be passed from data
                if (error) {
                    template = false;
                }
                next(null, template);
            });
        },

        function prepareTemplate(template, next) {
            //if there is compiled template
            if (template) {
                template(mail.type, mail, function(error, html) {
                    next(error, html);
                });
            } else {
                next(null, template);
            }
        },

        function createEmail(html, next) {
            //extend mail data with html template
            if (html) {
                mail = _.extend(mail, {
                    html: html,
                    options: options
                });
            }

            //ensure is text or html email
            if (!mail.text && !mail.html) {
                next(new Error('No text or html provide for this email'));
            } else {
                //save mail
                Mail.create(mail, next);
            }

        }

    ], done);

};


/**
 * @name send
 * @description perform direct mail send. For better performance consider using
 *              queue version
 * @param  {Object}   mail valid nodemailer email fields plus additional data
 *                         to html template if available
 * @param  {String}   mail.type valid email type
 * @param  {String}   mail.from e-mail address of the sender
 * @param  {String}   [mail.sender] e-mail address that will appear on the 
 *                                Sender: field
 *                                
 * @param {String[]} mail.to array of recipients e-mail addresses that will appear 
 *                           on the To: field
 *
 * @param {String[]} mail.cc
 * @param {String[]} mail.bcc
 * @param {String}   mail.subject subject of the sent e-mail
 * @param {String}   [mail.text] plaintext version of the message as an unicode string
 * @param {String}   mail.html HTML version of the message as an unicode string
 * @param  {Object}  [options] valid email sending options
 * @param  {Boolen}  [options.fake] signal to simulate mail send
 * @param {Function} done a callback to invoke on success or failure
 * @return {Mail}          an instance of mail sent
 * @type {Function}
 * @public
 */
MailSchema.statics.send = function(mail, options, done) {

    //normalize arguments
    if (options && _.isFunction(options)) {
        done = options;
        options = {};
    }

    //reference mail
    var Mail = this;

    //perform in process direct mail send
    Mail._send(mail, options, function(error, mail) {

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
 * @name queue
 * @description queue email for later send
 * @param  {Object}   mail valid nodemailer email fields plus additional data
 *                         to html template if available
 * @param  {String}   mail.type valid email type
 * @param  {String}   mail.from e-mail address of the sender
 * @param  {String}   [mail.sender] e-mail address that will appear on the 
 *                                Sender: field
 *                                
 * @param {String[]} mail.to array of recipients e-mail addresses that will appear 
 *                           on the To: field
 *
 * @param {String[]} mail.cc
 * @param {String[]} mail.bcc
 * @param {String}   mail.subject subject of the sent e-mail
 * @param {String}   [mail.text] plaintext version of the message as an unicode string
 * @param {String}   mail.html HTML version of the message as an unicode string
 * @param  {Object}  [options] valid email sending options
 * @param  {Boolen}  [options.fake] signal to simulate mail send
 * @param {Function} [done] an optional callback to invoke on success or failure
 * @return {Mail}          an instance of mail queued
 * @type {Function}
 * @public
 */
MailSchema.statics.queue = function(mail, options, done) {
    //normalize arguments
    if (options && _.isFunction(options)) {
        done = options;
        options = {};
    }

    //reference mail
    var Mail = this;

    Mail._send(mail, options, function(error, mail) {

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
 * @name unsent
 * @description obtain unsent mail(s)
 * @param {Object} [criteria] valid mongoose query criteria
 * @param  {Function} done a callback to invoke on success or failure
 * @type {Function}
 * @public
 */
MailSchema.statics.unsent = function(criteria, done) {

    //normalize arguments
    if (criteria && _.isFunction(criteria)) {
        done = criteria;
        criteria = {};
    }

    criteria = _.merge({}, {
        sentAt: null //ensure email have not been sent
    }, criteria);

    //find unsent mails
    this.find(criteria, done);

};


/**
 * @name sent
 * @description obtain already sent mail(s)
 * @param {Object} [criteria] valid mongoose query criteria
 * @param  {Function} done a callback to invoke on success or failure
 * @type {Function}
 * @public
 */
MailSchema.statics.sent = function(criteria, done) {

    //normalize arguments
    if (criteria && _.isFunction(criteria)) {
        done = criteria;
        criteria = {};
    }

    criteria = _.merge({}, {
        sentAt: { $ne: null } //ensure email have been sent
    }, criteria);

    //find unsent mails
    this.find(criteria, done);

};


/**
 * @name resend
 * @description re-send all failed email based on specified criteria
 * @param {Object} [criteria] valid mongoose query criteria
 * @param  {Function} done a callback to invoke on success or failure
 * @type {Function}
 * @public
 */
MailSchema.statics.resend = function(criteria, done) {

    //normalize arguments
    if (criteria && _.isFunction(criteria)) {
        done = criteria;
        criteria = {};
    }

    //reference Mail
    var Mail = this;

    //resend fail or unsent mail(s)
    async.waterfall([

        function findUnsentMails(next) {
            Mail.unsent(criteria, next);
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



/**
 * @name requeue
 * @description requeue all failed email based on specified criteria
 * @param {Object} [criteria] valid mongoose query criteria
 * @param  {Function} done a callback to invoke on success or failure
 * @type {Function}
 * @public
 */
MailSchema.statics.requeue = function(criteria, done) {

    //normalize arguments
    if (criteria && _.isFunction(criteria)) {
        done = criteria;
        criteria = {};
    }

    //reference Mail
    var Mail = this;

    //obtain all unsent email
    Mail.unsent(criteria, function(error, unsents) {

        if (error) {

            //fire mail:queue:error event
            Mail.emit('mail:queue:error', error);

        } else {

            //fire mail:queue event per mail
            _.forEach(unsents, function(unsent) {
                Mail.emit('mail:queued', unsent);
            });

        }

        //invoke callback if provided
        if (done && _.isFunction(done)) {
            done(error, unsents);
        }

    });

};

//exports MailSchema
module.exports = MailSchema;