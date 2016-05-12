byteskode-mailer
=====================

[![Build Status](https://travis-ci.org/byteskode/byteskode-mailer.svg?branch=master)](https://travis-ci.org/byteskode/byteskode-mailer)

byteskode sendgrid mailer with mongoose persistence support

*Note: mailer is configured using [config](https://github.com/lorenwest/node-config) using key `mailer`*

## Requirements
- [mongoose](https://github.com/Automattic/mongoose)

## Installation
```sh
$ npm install --save mongoose byteskode-mailer
```

## Usage

```javascript
var mongoose = require('mongoose');

//connect to mongoose if production environment

var Mail = require('byteskode-mailer');

//send immediate
Mail.send('confirmation', {
            recipientName: faker.name.findName(),
            token: faker.random.uuid(),
            to: faker.internet.email(),
            baseUrl: faker.internet.url(),
            subject: 'Account confirmation'
        }, function(error, mail){
            ...
        });

//queue for later sending
//you will have to implement worker for later resend
Mail.send('confirmation', {
            recipientName: faker.name.findName(),
            token: faker.random.uuid(),
            to: faker.internet.email(),
            baseUrl: faker.internet.url(),
            subject: 'Account confirmation'
        });

```

## API

### `send(type:String, data:Object, callback(error, mail))`
Send will compile [mail template](https://github.com/niftylettuce/node-email-templates) found at a path obtain using the `type` parameter and `templateDir` configuration options and set `html` value to data. [View for sample](https://github.com/byteskode/byteskode-mailer/tree/master/views/emails) template directory layout.

Before send all mails are persisted to mongodb using mongoose before send. Data object should constitute valid [nodemailer email fields](https://github.com/nodemailer/nodemailer#e-mail-message-fields) plus other data to be passed to mail template.

*Note: Current attachment are not supported*

Example
```js
Mail.send('confirmation', {
            recipientName: faker.name.findName(),
            token: faker.random.uuid(),
            to: faker.internet.email(),
            baseUrl: faker.internet.url(),
            subject: 'Account confirmation'
        }, function(error, mail){
            ...
        });
```

### `resend([criteria:Object], callback(error, mails))`
Resend will try to resend failed mails that are in the database. `criteria` is a valid mongoose criteria used to specify which failed mails to resend.

Example
```js
Mail.resend(fuction(error, mails){
    ...
});

//or pass criteria
Mail.resend(criteria,fuction(error, mails){
    ...
});
```

### `queue(type:String, data:Object, [callback(error, mail)])`
Unlike send, queue will save compiled email for later processing. After mail persisted into database `mail:queued` event will be fired with an instance of saved mail. If any error occur an event `mail:queue:error` will be fired.

Example
```js
Mail.on('mail:queued', fuction(mail){
    ...
    //process mail in background or real queue like kue
    ...
});

Mail.on('mail:queue:error', fuction(error){
   ...
   //handle error
   ... 
});

Mail.queue('confirmation', {
            recipientName: faker.name.findName(),
            token: faker.random.uuid(),
            to: faker.internet.email(),
            baseUrl: faker.internet.url(),
            subject: 'Account confirmation'
        });
```

### `requeue(type:String, data:Object, [callback(error, mail)])`
Unlike resend, requeue will fire `mail:queued` event on every unsent mail.

Example
```js
Mail.requeue();

//or pass criteria
Mail.requeue(criteria);
```

## Configuration Options
Base on your environment setup, ensure you have the following configurations in your `config` files.

```js
mailer: {
        from: '<yourname> <no-reply@<yourdomain>.com>',
        sender: '<sendername>',
        transport: {
            auth: {
                api_key: '<sendgrid_api_key>',
            }
        },
        model:{
            name:'<name_of_mongoose_model>',
            fields:<additional_schema_fields>
        },
        templatesDir:<path_to_ejs_template>
    }
```

## Testing
* Clone this repository

* Install all development dependencies
```sh
$ npm install
```

* Then run test
```sh
$ npm test
```

## Contribute
It will be nice, if you open an issue first so that we can know what is going on, then, fork this repo and push in your ideas. Do not forget to add a bit of test(s) of what value you adding.

## Licence
The MIT License (MIT)

Copyright (c) 2015 byteskode & Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 