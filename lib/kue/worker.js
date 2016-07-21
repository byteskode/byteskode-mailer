'use strict';

/**
 * @name worker
 * @description byteskode-mailer kue worker
 */

//dependencies
var path = require('path');
var _ = require('lodash');
var async = require('async');
var mongoose = require('mongoose');
var kue = require('kue');
var config = require('config');
var noop = function() {};

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
        queue: 'mail:queued',
        connection: {},
        timeout: 5000
    }
}, _config);


//obtain logger
var log = _config.logger;


/**
 * @name stope
 * @description gracefull shutdown kue
 * @see {@link https://github.com/Automattic/kue#graceful-shutdown}
 */
exports.stop = function(done) {

    //ensure callback
    if (!done && !_.isFunction(done)) {
        done = noop;
    }

    //ensure queue to shutdown
    if (exports.queue) {
        var timeout = (_config.kue || {}).timeout || 5000;
        exports.queue.shutdown(timeout, done);
    }

};


/**
 * @name start
 * @description setup kue worker and start to process `email:queue` jobs
 */
exports.start = function(callback) {
    try {

        //obtain Mail model
        var Mail = mongoose.model('Mail');

        //setup kue queue
        if (!exports.queue && Mail) {
            //reference kue options
            var options = (_config.kue || {});

            //create queue instance
            exports.queue = kue.createQueue(options);
            if (_config.debug) {
                log('setup queue');
            }

            //register worker as per configured queue name
            if (_config.debug) {
                log('setup ' + options.queue + ' worker');
            }
            exports.queue.process(options.queue, options.concurrency, function(job, done) {

                //fetch email based in job details
                var _id = (job.data || {})._id;
                if (_id) {

                    async.waterfall([

                        function findEmailById(next) {
                            Mail.findById(_id, next);
                        },

                        function ensureEmailExists(_email, next) {
                            if (!_email) {
                                next(new Error('Mail with id ' + _id + ' does not exists'));
                            } else {
                                next(null, _email);
                            }
                        },

                        function sendEmail(_email, next) {
                            _email.send(next);
                        },

                        function normalizeSuccessResponse(_email, next) {
                            next(null, _email.response);
                        }

                    ], done);
                }

                //no email id specified
                else {
                    done();
                }
            });

            //register success shutdown hook
            if (_config.debug) {
                log('setup process shutdown hook');
            }
            process.once('SIGTERM', function( /*signal*/ ) {
                exports.queue.shutdown(function( /*error*/ ) {
                    process.exit(0);
                });
            });
            if (_config.debug) {
                log('start ' + options.queue + ' jobs processing');
            }

            if (callback && _.isFunction(callback)) {
                callback();
            }

        }
    } catch (error) {

        if (_config.debug) {
            log(error);
        }

        if (callback && _.isFunction(callback)) {
            callback();
        }

        if (!_config.debug && !callback) {
            throw error;
        }
    }
};