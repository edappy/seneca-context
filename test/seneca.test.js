var createSeneca = require('seneca');
var http = require('http');
var bodyParser = require('body-parser');
var express = require('express');
var createSenecaContext = require('../index');
var vasync = require('vasync');
var extend = require('extend');

describe('seneca-context', function () {
    var app, server, seneca1, seneca2, senecaContext;
    var requestId = 'test-request-id-1';
    var expectedContext = {requestId: requestId, test: 'abc'};

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
            // message.context$ is automatically populated on the first action called by seneca-web
            message.context$.should.deep.equal(expectedContext);

            // load cached context
            senecaContext.loadContext(this).should.equal(message.context$).and.deep.equal(expectedContext);

            this.act('role:seneca2,cmd:task2', {trace: message.trace + '1'}, done);
        });
        seneca1.add('role:seneca1,cmd:task3', function task3(message, done) {
            // message.context$ is populated here by `senecaContext.loadContextPlugin`
            message.context$.should.deep.equal(expectedContext);

            // load cached context
            senecaContext.loadContext(this).should.equal(message.context$).and.deep.equal(expectedContext);

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
            expect(message.context$).to.be.undefined;

            // load context from tx$
            var context = senecaContext.loadContext(this);
            context.should.deep.equal(expectedContext);

            // load cached context
            senecaContext.loadContext(this).should.equal(context).and.deep.equal(expectedContext);

            // message should not be modified
            expect(message.context$).to.be.undefined;

            this.act('role:seneca1,cmd:task3', {trace: message.trace + '2'}, done);
        });
        seneca2.client({port: 9010});
        seneca2.listen({port: 9011});

        // set up express
        // --------------
        app = express();
        app.use(bodyParser.json());
        app.use(seneca1.export('web'));

        // wait for seneca and express to start
        vasync.parallel({
            funcs: [
                function (onExpressReady) {
                    server = app.listen(3010, onExpressReady);
                },
                seneca1.ready.bind(seneca1),
                seneca2.ready.bind(seneca2)
            ]
        }, function (error) {
            if (error) {
                return done(error);
            }

            // send an HTTP request
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
                        response.should.deep.equal({context: expectedContext, trace: 'request123'});
                        done();
                    } catch (error) {
                        done(error);
                    }
                });
            });
        });
    });
});
