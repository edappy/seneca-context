'use strict';

var chai = require('chai');
chai.use(require('sinon-chai'));
chai.config.includeStack = true;
chai.should();

global.expect = chai.expect;
global.AssertionError = chai.AssertionError;
global.Assertion = chai.Assertion;
global.assert = chai.assert;
global.sinon = require('sinon');
