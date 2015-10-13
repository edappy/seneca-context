'use strict';

var extend = require('extend');
var debug = require('debug')('seneca-context');

module.exports = createContextStore;

/**
 * A seneca plugin for creating request contexts based on HTTP requests and ensuring that the
 * same context is available in all seneca actions running within the same transaction.
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
 *   // Loads the context for the specified seneca instance.
 *   loadContext: function(seneca, function(error, context)),
 *
 *   // A seneca plugin which automatically creates a request context based on HTTP requests and makes it available
 *   // to all seneca actions within the given transaction.
 *   saveContextPlugin: *,
 *
 *   // A seneca plugin which automatically loads the context and exposes it as a `context$` property
 *   // of the incoming message.
 *   loadContextPlugin: *
 * }}
 */
function createContextStore(options) {
    options = extend({
        createContext: createContext,
        contextHeader: 'x-request-id'
    }, options);

    return {
        loadContext: loadContext,
        saveContextPlugin: saveContextPlugin,
        loadContextPlugin: loadContextPlugin
    };

    /**
     * Saves the specified context inside the seneca transaction ID.
     */
    function saveContext(seneca, context) {
        var transactionIdPrefix = seneca.fixedargs.tx$.split('?')[0];
        var encodedContext = new Buffer(JSON.stringify(context)).toString('base64');
        var transactionId = transactionIdPrefix + '?' + encodedContext;
        seneca.fixedargs.tx$ = transactionId;
        seneca.fixedargs.context$ = context;
        debug('context saved', transactionId, context);
    }

    /**
     * Loads the context from the seneca transaction ID.
     */
    function loadContext(seneca) {
        var transactionId = seneca.fixedargs.tx$;

        if (!seneca.fixedargs.context$) {
            var encodedContext = transactionId.split('?')[1];
            var context = encodedContext ? JSON.parse(new Buffer(encodedContext, 'base64').toString('utf8')) : null;
            seneca.fixedargs.context$ = context;
            debug('context loaded from tx$ and cached in context$', transactionId, context);
        } else {
            debug('context loaded from context$', transactionId, context);
        }


        return seneca.fixedargs.context$;
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
            message.context$ = loadContext(seneca);
            seneca.prior(message, done);
        });

        return {name: plugin};
    }

    /**
     * Derives a context from an HTTP request and
     * ensures that it is available to all seneca actions in this transaction.
     */
    function processRequest(req, res, next) {
        debug('processing HTTP request');

        var seneca = req.seneca;

        options.createContext(req, res, createDefaultContext(req), function(error, context) {
            if (error) {
                next(error);
            } else {
                saveContext(seneca, context);
                next();
            }
        });
    }

    /**
     * Creates a context based on the value of the `options.contextHeader` header.
     */
    function createDefaultContext(req) {
        var requestId = req.headers[options.contextHeader];
        var context = {};

        if (requestId) {
            context.requestId = requestId;
        }

        debug('created default context', context);
        return context;
    }

    /**
     * Default implementation of createContext, which responds with the default context.
     */
    function createContext(req, res, context, done) {
        debug('default createContext - does nothing', context);
        process.nextTick(done.bind(null, null, context));
    }
}
