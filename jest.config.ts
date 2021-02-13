module.exports = {
  // preset: 'ts-jest',
  testEnvironment: 'jest-environment-node',
  roots: ["<rootDir>/server_out/api_tests"],
  transform: {
    // "\\.ts$": "ts-jest",
  },
  // extensionsToTreatAsEsm: [".js"],
  // transform: {},
  moduleDirectories: [
    'node_modules'
  ],
  moduleFileExtensions: ['js'],
  // globals: {
  //   "ts-jest": {
  //     "tsconfig": '<rootDir>/tsconfig.json',
  //     "useESM": true,
  //   }
  // },
};