'use strict';

var debug = require('debug')('seneca-context');
var setContext = require('..').setContext;

module.exports = setContextPlugin;

/**
 * A seneca plugin, which automatically sets the context for all HTTP requests.
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
  var plugin = 'set-context';

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
