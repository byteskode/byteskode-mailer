'use strict';

/**
 * @name byteskode-mailer
 * @description byteskode sendgrid mailer with persistance support
 * @singleton
 */

//set environment to development by default
if (!(process.env || {}).NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

//suppress configuration warning
process.env.SUPPRESS_NO_CONFIG_WARNING = true;

//dependencies
var config = require('config');
var path = require('path');
var mongoose = require('mongoose');
var environment = require('execution-environment');
var MailSchema = require(path.join(__dirname, 'lib', 'schema'));
var Mail;

//configure execution-environment
if (!environment.isLocal) {
    environment.registerEnvironments({
        isLocal: ['test', 'dev', 'development']
    });
}

//obtain configuration from config
var _config = config.has('mailer') ? config.get('mailer') : {};

//obtain model name
var modelName = (_config.model || {}).name || 'Mail';

// initialize mongoose mail model
try {
    if (!mongoose.model(modelName)) {
        Mail = mongoose.model(modelName, MailSchema);
    } else {
        Mail = mongoose.model(modelName);
    }
} catch (e) {
    Mail = mongoose.model(modelName, MailSchema);
}


//export mail model
module.exports = Mail;