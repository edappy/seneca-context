'use strict';

var seneca = require('seneca')();
var contextManager = require('./index')();
var app = require('express')();
var bodyParser = require('body-parser');

// configure seneca
// ----------------
seneca.add('role:worker,cmd:work', function (message, done) {
    console.log('Got message 1', message.tx$);
    this.act('role:worker2,cmd:wait', done);
});

seneca.client({port: 9000});
seneca.listen({port: 9001});

//seneca.add('role:worker2,cmd:wait', function (message, done) {
//    console.log('Got message 2', message.tx$, message);
//    contextManager.loadContext(this, function (error, context) {
//        if (error) {
//            done(error);
//        } else {
//            done(null, {
//                context: context
//            });
//        }
//    });
//});
//
//seneca.add('role:api,path:work', function (message, done) {
//    this.act('role:worker,cmd:work', done);
//});
//
//seneca.use(contextManager.contextPlugin);
//
//seneca.act('role:web', {
//    use: {
//        prefix: '/api',
//        pin: 'role:api,path:*',
//        map: {
//            work: {GET: true, data: true}
//        }
//    }
//});
//
//// configure express
//// -----------------
//app.use(bodyParser.json());
//app.use(seneca.export('web'));
//
//// start the server
//// ----------------
//app.listen(3000);
