module.exports = {
  testEnvironment: 'jest-environment-node',
  transform: {
    "\\.ts$": "ts-jest",
  },
  extensionsToTreatAsEsm: [".ts"],
  moduleDirectories: [
    'node_modules'
  ],
  moduleFileExtensions: ['ts', "js"],
  globals: {
    "ts-jest": {
      // when we start testing client side ts
      // where going to have to choose a tsconfig based on what we're testing?
      tsconfig: '<rootDir>/tsconfig.json',
      useESM: true
    }
  }
};