module.exports = {
  // todo: '<rootDir>/integration_tests' should be in here to
  // however these tests need the webserver to be spun up first
  // and I can't get jest's global setup to work with typescript + es6 modules
  // resources on that:
  // https://github.com/facebook/jest/issues/5164
  // https://github.com/kulshekhar/ts-jest/issues/411
  // as a work around, we run then with `npm run-script integration-tests` for now
  // todo: we probably want separate projects for server/client/shared
  projects: ['<rootDir>/src'],
};