'use strict';

var debug = require('debug')('seneca-context');
var URLSafeBase64 = require('urlsafe-base64');

module.exports = {
    setContextPlugin: setContextPlugin,
    getContextPlugin: getContextPlugin,
    getContext: getContext
};

/**
 * A seneca plugin, which automatically saves the context for all HTTP requests.
 *
 * @param {{
 *   // A function which creates a context based on the HTTP request and response.
 *   // It is used by the `setContextPlugin`.
 *   // The `defaultContext` is `{requestId: req.headers[options.contextHeader]}`.
 *   // Default is noop.
 *   createContext: function (request, response, defaultContext, function(error, context))
 *
 *   // The name of the HTTP request header containing the request context.
 *   // Default is 'x-request-id'.
 *   contextHeader: string
 * }} options
 */
function setContextPlugin(options) {
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
function getContextPlugin(options) {
    var seneca = this;
    var plugin = 'load-context';

    seneca.wrap(options.pin, function (message, done) {
        var seneca = this;
        message.context$ = getContext(seneca);
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
function getContext(seneca) {
    var transactionId = seneca.fixedargs.tx$;
    var context = seneca.fixedargs.context$;

    if (!context) {
        context = seneca.fixedargs.context$ = JSON.parse(URLSafeBase64.decode(transactionId).toString('utf8'));
        debug('context loaded from tx$ and cached in context$', transactionId, context);
    } else {
        debug('context loaded from context$', transactionId, context);
    }

    return context;
}

/**
 * Saves the specified context inside the seneca transaction ID.
 *
 * @param {seneca} seneca The seneca object, which is the context of a running action.
 * @param {Object} context A context object
 */
function setContext(seneca, context) {
    seneca.fixedargs.tx$ = URLSafeBase64.encode(new Buffer(JSON.stringify(context)));
    seneca.fixedargs.context$ = context;
    debug('context saved', seneca.fixedargs.tx$, context);
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
            setContext(seneca, context);
            next();
        }
    });
}

/**
 * Creates a context based on the value of the `options.contextHeader` header, or the original value of seneca tx$.
 */
function createDefaultContext(options, req) {
    var context = {
        requestId: req.headers[options.contextHeader] || req.seneca.fixedargs.tx$
    };

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
