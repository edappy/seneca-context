var createSeneca = require('seneca');
var http = require('http');
var bodyParser = require('body-parser');
var express = require('express');
var createSenecaContext = require('../index');
var vasync = require('vasync');
var extend = require('extend');

describe('seneca-context', function () {
    describe('end-to-end', function () {
        var app, server, seneca1, seneca2, senecaContext, task1Spy, task2Spy, task3Spy;

        beforeEach(function (done) {
            senecaContext = createSenecaContext({
                createContext: function (req, res, context, done) {
                    done(null, extend({test: 'abc'}, context));
                },
                contextHeader: 'x-context'
            });

            // set up seneca1
            // --------------
            seneca1 = createSeneca();
            task1Spy = sinon.spy(function task1(message, done) {
                this.act('role:seneca2,cmd:task2', done);
            });
            task3Spy = sinon.spy(function task3(message, done) {
                done(null, message.context$);
            });
            seneca1.add('role:seneca1,cmd:task1', task1Spy);
            seneca1.add('role:seneca1,cmd:task3', task3Spy);
            seneca1.use(senecaContext.saveContextPlugin);
            seneca1.use(senecaContext.loadContextPlugin, {pin: 'role:seneca1'});
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
            task2Spy = sinon.spy(function task2(message, done) {
                this.act('role:seneca1,cmd:task3', done);
            });
            seneca2.add('role:seneca2,cmd:task2', task2Spy);
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
                path: '/task1',
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
                        response.should.deep.equal({requestId: requestId, test: 'abc'});
                        done();
                    } catch (error) {
                        done(error);
                    }
                });
            });
        });
    });
});
