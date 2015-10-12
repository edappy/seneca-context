'use strict';

var seneca = require('seneca')();
var debug = require('debug')('seneca-context-example');

// configure seneca
// ----------------
seneca.add('role:worker,cmd:work', function (message, done) {
    debug('role:worker,cmd:work', message.tx$, message.context$);
    this.act('role:worker2,cmd:wait', done);
});

seneca.client({port: 9000});
seneca.listen({port: 9001});
