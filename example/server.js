'use strict';

var seneca = require('seneca')();
var senecaContext = require('../index');
var app = require('express')();
var bodyParser = require('body-parser');
var debug = require('debug')('seneca-context-example');

// configure seneca
// ----------------
seneca.add('role:api,path:work', function (message, done) {
    debug('role:api,path:work', message.tx$, message.context$);
    this.act('role:worker,cmd:work', done);
});
seneca.add('role:worker2,cmd:wait', function (message, done) {
    debug('role:worker2,cmd:wait', message.tx$, message.context$);
    done(null, message.context$);
});

seneca.use(senecaContext.saveContextPlugin);
seneca.use(senecaContext.loadContextPlugin, {pin: 'role:worker2'});

seneca.act('role:web', {
    use: {
        prefix: '/api',
        pin: 'role:api,path:*',
        map: {
            work: {GET: true}
        }
    }
});

seneca.client({port: 9001});
seneca.listen({port: 9000});

// configure express
// -----------------
app.use(bodyParser.json());
app.use(seneca.export('web'));

// start the server
// ----------------
app.listen(3000);
