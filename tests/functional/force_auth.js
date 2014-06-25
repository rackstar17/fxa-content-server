/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'intern',
  'intern!object',
  'intern/chai!assert',
  'require',
  'intern/node_modules/dojo/node!xmlhttprequest',
  'app/bower_components/fxa-js-client/fxa-client',
  'intern/node_modules/dojo/Deferred',
  'tests/lib/restmail',
  'tests/lib/helpers',
  'tests/functional/lib/helpers'
], function (intern, registerSuite, assert, require, nodeXMLHttpRequest, FxaClient, Deferred, restmail, TestHelpers, FunctionalHelpers) {
  'use strict';

  var config = intern.config;
  var AUTH_SERVER_ROOT = config.fxaAuthRoot;
  var EMAIL_SERVER_ROOT = config.fxaEmailRoot;
  var FORCE_AUTH_URL = config.fxaContentRoot + 'force_auth';

  var PASSWORD = 'password';
  var user;
  var email;
  var accountData;
  var client;

  registerSuite({
    name: 'force_auth',

    setup: function () {
      email = TestHelpers.createEmail();
      user = TestHelpers.emailToUser(email);
      client = new FxaClient(AUTH_SERVER_ROOT, {
        xhr: nodeXMLHttpRequest.XMLHttpRequest
      });
      var self = this;
      return client.signUp(email, PASSWORD)
        .then(function (result) {
          accountData = result;
        })
        .then(function () {
          return restmail(EMAIL_SERVER_ROOT + '/mail/' + user);
        })
        .then(function (emails) {
          var code = emails[0].html.match(/code=([A-Za-z0-9]+)/)[1];
          return client.verifyCode(accountData.uid, code);
        })
        .then(function () {
          // clear localStorage to avoid polluting other tests.
          return FunctionalHelpers.clearBrowserState(self);
        });
    },

    'sign in via force-auth': function () {
      return this.get('remote')
        .get(require.toUrl(FORCE_AUTH_URL + '?email=' + email))
        .waitForElementById('fxa-force-auth-header')

        .elementByCssSelector('form input.password')
          .click()
          .type(PASSWORD)
        .end()

        .elementByCssSelector('button[type="submit"]')
          .click()
        .end()

        .waitForElementById('fxa-settings-header')
        .end();
    },

    'forgot password flow via force-auth goes directly to confirm email screen': function () {
      return this.get('remote')
        .get(require.toUrl(FORCE_AUTH_URL + '?email=' + email))
        .waitForElementById('fxa-force-auth-header')

        .elementByCssSelector('.reset-password')
          .click()
        .end()

        .waitForElementById('fxa-confirm-reset-password-header')
        .end()

        // user remembers her password, clicks the "sign in" link. They
        // should go back to the /force_auth screen.
        .elementByClassName('sign-in')
          .click()
        .end()

        .waitForElementById('fxa-force-auth-header');
    },

    'visiting the tos/pp links saves information for return': function () {
      var self = this;
      return testRepopulateFields.call(self, '/legal/terms', 'fxa-tos-header')
              .then(function () {
                return testRepopulateFields.call(self, '/legal/privacy', 'fxa-pp-header');
              });
    }
  });

  function testRepopulateFields(dest, header) {
    /*jshint validthis: true*/
    var self = this;
    var email = TestHelpers.createEmail();
    var password = '12345678';

    return self.get('remote')
      .get(require.toUrl(FORCE_AUTH_URL + '?email=' + email))
      .waitForElementById('fxa-force-auth-header')

      .elementByCssSelector('input[type=password]')
        .clear()
        .click()
        .type(password)
      .end()

      .elementByCssSelector('a[href="' + dest + '"]')
        .click()
      .end()

      .waitForElementById(header)

      .elementByCssSelector('.back')
        .click()
      .end()

      .waitForElementById('fxa-force-auth-header')

      .elementByCssSelector('input[type=password]')
        .getValue()
        .then(function (resultText) {
          // check the email address was re-populated
          assert.equal(resultText, password);
        })
      .end();
  }
});
