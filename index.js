'use strict';

var debug = require('debug')('seneca-context');

module.exports = {
    saveContextPlugin: saveContextPlugin,
    loadContextPlugin: loadContextPlugin,
    loadContext: loadContext
};

/**
 * A seneca plugin, which automatically saves the context for all HTTP requests.
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
 */
function saveContextPlugin(options) {
    var seneca = this;
    var plugin = 'save-context';

    options = seneca.util.deepextend({
        createContext: createContext,
        contextHeader: 'x-request-id'
    }, options);

    seneca.act({
        role: 'web',
        plugin: plugin,
        use: processRequest.bind(null, options)
    });

    return {name: plugin};
}

/**
 * A seneca plugin, which automatically exposes the context as a property of the incoming message.
 *
 * @param {{
 *   pin: string|Object // a seneca pattern to which this plugin should be applied
 * }} options
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
 * Loads the context from the seneca transaction ID.
 *
 * @param {seneca} seneca The seneca object, which is the context of a running action.
 * @returns {Object} A context object
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
 * Saves the specified context inside the seneca transaction ID.
 *
 * @param {seneca} seneca The seneca object, which is the context of a running action.
 * @param {Object} context A context object
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
 * Derives a context from an HTTP request and
 * ensures that it is available to all seneca actions in this transaction.
 */
function processRequest(options, req, res, next) {
    debug('processing HTTP request');

    var seneca = req.seneca;

    options.createContext(req, res, createDefaultContext(options, req), function (error, context) {
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
function createDefaultContext(options, req) {
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
