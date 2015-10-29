# seneca-context

Generate a context object based on an HTTP request and easily access it any seneca services involved in processing of that request.

## Installation

```
npm install --save seneca-context
```

## Basic Usage

See also the `example` and `test` directories.

```
var seneca = require('seneca')();

seneca.add('role:api,path:work', function (message, done) {
  // context is implicitly propagated to the next seneca action
  this.act('role:worker,cmd:work', done);
});
seneca.add('role:worker,cmd:work', function (message, done) {
  // context is accessible at the `context$` property of the message
  done(null, message.context$);
});

// Creates the context from HTTP requests and propagates it to all actions within the transaction.
seneca.use('seneca-context/plugins/setContext');

// Adds the `context$` property to the incoming messages matching the `pin`.
seneca.use('seneca-context/plugins/getContext', {pin: 'role:worker'});

seneca.act('role:web', {
  use: {
    prefix: '/api',
    pin: 'role:api,path:*',
    map: {
      work: {GET: true}
    }
  }
});

// start express
var app = require('express')();
app.use(require('body-parser').json());
app.use(seneca.export('web'));
app.listen(3000);
```

Test that it works.

```
curl -m 1  -H 'X-Request-Id: hello-world' http://localhost:3000/api/work
```

## API

TODO

For now, see comments in index.js
