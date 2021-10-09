module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "\\.ts$": "ts-jest",
  },
  extensionsToTreatAsEsm: [".ts"],
  moduleDirectories: ["node_modules"],
  moduleFileExtensions: ["ts", "js"],
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.json",
      useESM: true,
    },
  },
}
