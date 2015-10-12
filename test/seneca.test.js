var createSeneca = require('seneca');
var http = require('http');
var bodyParser = require('body-parser');
var express = require('express');
var createSenecaContext = require('../index');
var vasync = require('vasync');
var extend = require('extend');

describe('seneca-context', function () {
    describe('end-to-end', function () {
        var app, server, seneca1, seneca2, senecaContext;

        beforeEach(function (done) {
            senecaContext = createSenecaContext({
                createContext: function (req, res, context, done) {
                    process.nextTick(done.bind(null, null, extend({test: 'abc'}, context)));
                },
                contextHeader: 'x-context'
            });

            // set up seneca1
            // --------------
            seneca1 = createSeneca();
            seneca1.add('role:seneca1,cmd:task1', function task1(message, done) {
                try {
                    expect(message.context$).to.be.undefined;
                    this.act('role:seneca2,cmd:task2', {trace: message.trace + '1'}, done);
                } catch (e) {
                    done(e);
                }
            });
            seneca1.add('role:seneca1,cmd:task3', function task3(message, done) {
                done(null, {trace: message.trace + '3', context: message.context$});
            });
            seneca1.use(senecaContext.saveContextPlugin);
            seneca1.use(senecaContext.loadContextPlugin, {pin: 'role:seneca1,cmd:task3'});
            seneca1.act('role:web', {
                use: {
                    prefix: '/',
                    pin: 'role:seneca1,cmd:*',
                    map: {
                        task1: {GET: true}
                    }
                }
            });
            seneca1.client({port: 9011});
            seneca1.listen({port: 9010});

            // set up seneca2
            // --------------
            seneca2 = createSeneca();
            seneca2.add('role:seneca2,cmd:task2', function task2(message, done) {
                try {
                    expect(message.context$).to.be.undefined;
                    this.act('role:seneca1,cmd:task3', {trace: message.trace + '2'}, done);
                } catch (e) {
                    done(e);
                }
            });
            seneca2.client({port: 9010});
            seneca2.listen({port: 9011});

            // set up express
            // --------------
            app = express();
            app.use(bodyParser.json());
            app.use(seneca1.export('web'));

            vasync.parallel({
                funcs: [
                    function (onExpressReady) {
                        server = app.listen(3010, onExpressReady);
                    },
                    seneca1.ready.bind(seneca1),
                    seneca2.ready.bind(seneca2)
                ]
            }, done);
        });

        afterEach(function (done) {
            vasync.parallel({
                funcs: [
                    server.close.bind(server),
                    seneca1.close.bind(seneca1),
                    seneca2.close.bind(seneca2)
                ]
            }, done);
        });

        it('should propagate and eventually return the request context', function (done) {
            var requestId = 'test-request-id-1';
            http.get({
                hostname: '127.0.0.1',
                port: 3010,
                path: '/task1?trace=request',
                headers: {
                    'X-Context': requestId
                }
            }, function (res) {
                var responseText = '';
                res.on('data', function (data) {
                    responseText += data;
                });
                res.on('end', function () {
                    try {
                        var response = JSON.parse(responseText);
                        response.should.deep.equal({context: {requestId: requestId, test: 'abc'}, trace: 'request123'});
                        done();
                    } catch (error) {
                        done(error);
                    }
                });
            });
        });
    });

    describe('saveContext and loadContext', function () {
        var seneca, senecaContext;

        beforeEach(function () {
            seneca = createSeneca();
            senecaContext = createSenecaContext();
        });

        afterEach(function (done) {
            seneca.close(done);
        });

        it('should save and load context', function (done) {
            var testContext = {a: {b: 1, hello: 'world', l: [2, 3]}};
            var testContext2 = {z: 9};
            seneca.add('role:test,cmd:run', function (message, respond) {
                var seneca = this;
                vasync.waterfall([
                    senecaContext.loadContext.bind(senecaContext, seneca),
                    function (context, next) {
                        expect(context).to.be.null;
                        next();
                    },
                    senecaContext.saveContext.bind(senecaContext, seneca, testContext),
                    senecaContext.loadContext.bind(senecaContext, seneca),
                    function (context, next) {
                        expect(context).to.deep.equal(testContext);
                        next();
                    },
                    senecaContext.saveContext.bind(senecaContext, seneca, testContext2),
                    senecaContext.loadContext.bind(senecaContext, seneca),
                    function (context, next) {
                        expect(context).to.deep.equal(testContext2);
                        next();
                    }
                ], respond);
            });

            seneca.act('role:test,cmd:run', done);
        });
    });
});
