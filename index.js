'use strict';

var extend = require('extend');
var vasync = require('vasync');
var debug = require('debug')('seneca-context');

module.exports = createContextStore;

/**
 * A seneca plugin for creating request contexts based on HTTP requests and ensuring that the
 * same context is available in all seneca actions running within the same transaction.
 *
 * @note
 * Currently only one context storage mechanism is supported - embedding the context within seneca transaction IDs.
 * More storage mechanisms (eg. RedisStorage) could be implemented as plugins and configured using the `options`.
 * The mechanism for registering plugins would need to be implemented, too.
 *
 * @param {{
 *   // A function which creates a context based on the HTTP request and response.
 *   // It is used by the `saveContextPlugin`.
 *   // The `defaultContext` is `{requestId: req.headers[options.contextHeader]}`.
 *   // Default is noop.
 *   createContext: function (request, response, defaultContext, function(error, context))
 *
 *   // The name of the HTTP request header containing the request context.
 *   // Default is 'x-request-id'.
 *   contextHeader: string
 * }} options
 *
 * @returns {{
 *   // Saves the context for the specified seneca instance.
 *   saveContext: function(seneca, context, function (error)),
 *
 *   // Loads the context for the specified seneca instance.
 *   loadContext: function(seneca, function(error, context)),
 *
 *   // A seneca plugin which automatically creates a request context based on HTTP requests and makes it available
 *   // to all seneca actions within the given transaction.
 *   saveContextPlugin: *,
 *
 *   // A seneca plugin which automatically load the context and exposes it as a property of the incoming message.
 *   loadContextPlugin: *
 * }}
 */
function createContextStore(options) {
    options = extend({
        createContext: createContext,
        contextHeader: 'x-request-id'
    }, options);

    return {
        saveContext: saveContext,
        loadContext: loadContext,
        saveContextPlugin: saveContextPlugin,
        loadContextPlugin: loadContextPlugin
    };

    /**
     * Saves the specified context inside the seneca transaction ID.
     */
    function saveContext(seneca, context, done) {
        debug('saveContext - start');
        var transactionIdPrefix = seneca.fixedargs.tx$.split('?')[0];
        var encodedContext = new Buffer(JSON.stringify(context)).toString('base64');
        var transactionId = transactionIdPrefix + '?' + encodedContext;
        seneca.fixedargs.tx$ = transactionId;

        debug('saveContext - end', transactionId, context);
        process.nextTick(done.bind(null, null));
    }

    /**
     * Loads the context from the seneca transaction ID.
     */
    function loadContext(seneca, done) {
        debug('loadContext - start')
        var transactionId = seneca.fixedargs.tx$;
        var encodedContext = transactionId.split('?')[1];
        var context = encodedContext ? JSON.parse(new Buffer(encodedContext, 'base64').toString('utf8')) : null;

        debug('loadContext - end', transactionId, context);
        process.nextTick(done.bind(null, null, context));
    }

    /**
     * A seneca plugin, which automatically saves the context for all HTTP requests.
     */
    function saveContextPlugin() {
        var seneca = this;
        var plugin = 'save-context';

        seneca.act({
            role: 'web',
            plugin: plugin,
            use: processRequest
        });

        return {name: plugin};
    }

    /**
     * A seneca plugin, which automatically exposes the context as a property of the incoming message.
     */
    function loadContextPlugin(options) {
        var seneca = this;
        var plugin = 'load-context';

        seneca.wrap(options.pin, function (message, done) {
            var seneca = this;
            loadContext(seneca, function (error, context) {
                if (error) {
                    return done(error);
                }

                message.context$ = context;
                seneca.prior(message, done);
            });
        });

        return {name: plugin};
    }

    /**
     * Derives a context from an HTTP request and
     * ensures that it is available to all seneca actions in this transaction.
     */
    function processRequest(req, res, next) {
        var seneca = req.seneca;
        debug('processing HTTP request');

        vasync.waterfall([
            createDefaultContext.bind(null, req, res),
            options.createContext.bind(null, req, res),
            saveContext.bind(null, seneca)
        ], next);
    }

    /**
     * Creates a context based on the value of the `options.contextHeader` header.
     */
    function createDefaultContext(req, res, done) {
        var requestId = req.headers[options.contextHeader];
        var context = {};

        if (requestId) {
            context.requestId = requestId;
        }

        debug('created default context', context);
        done(null, context);
    }

    /**
     * Default implementation of createContext, which responds with the default context.
     */
    function createContext(req, res, context, done) {
        debug('default createContext - do nothing', context);
        process.nextTick(done.bind(null, null, context));
    }
}
