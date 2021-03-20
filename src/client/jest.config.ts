module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    "\\.ts$": "ts-jest",
  },
  extensionsToTreatAsEsm: [".ts"],
  moduleDirectories: [
    'node_modules'
  ],
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$",
  moduleFileExtensions: ['ts', "js"],
  globals: {
    "ts-jest": {
      // we need a dedicate jest tsconfig
      // because for some reason, the webpack is consuming our jest tests
      // and failing because it can't process them
      // this config exclude the jest tests explicitly
      tsconfig: '<rootDir>/tsconfig_for_jest.json',
      useESM: true
    }
  }
};