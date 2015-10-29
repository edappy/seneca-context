'use strict';

var debug = require('debug')('seneca-context');
var URLSafeBase64 = require('urlsafe-base64');

module.exports = {
  getContext: getContext,
  setContext: setContext
};

/**
 * Loads the context from the seneca transaction ID.
 *
 * @param {seneca} seneca The seneca object, which is the context of a running action.
 * @returns {Object} A context object
 */
function getContext(seneca) {
  var transactionId = seneca.fixedargs.tx$;
  var context = seneca.fixedargs.context$;

  if (typeof context === 'undefined') {
    try {
      context = seneca.fixedargs.context$ = JSON.parse(URLSafeBase64.decode(transactionId).toString('utf8'));
      debug('context loaded from tx$ and cached in context$', transactionId, context);
    } catch (error) {
      context = null;
      debug('context cannot be loaded from tx$', transactionId, error);
    }
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
