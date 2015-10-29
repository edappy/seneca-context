'use strict';

var getContext = require('..').getContext;

module.exports = getContextPlugin;

/**
 * A seneca plugin, which automatically exposes the context as a property of the incoming message.
 *
 * @param {{
 *   pin: string|Object // a seneca pattern to which this plugin should be applied
 * }} options
 */
function getContextPlugin(options) {
  var seneca = this;
  var plugin = 'get-context';

  seneca.wrap(options.pin, function (message, done) {
    var seneca = this;
    message.context$ = getContext(seneca);
    seneca.prior(message, done);
  });

  return {name: plugin};
}
