// webpack doesn't allow esm imports without babel
/* eslint @typescript-eslint/no-var-requires:"off" */
const dotenv = require("dotenv")
const path = require("path")
const webpack = require("webpack")
const CopyPlugin = require("copy-webpack-plugin")
const HtmlWebpackPlugin = require("html-webpack-plugin")

// this is used to upload map files to sentry
// but I can't work out how to get sentry to actually used them in issues
const SentryCliPlugin = require("@sentry/webpack-plugin")
// const SentryWebpackPlugin = require('@sentry/webpack-plugin');
let envs = dotenv.config({ path: "./secret/.env.dev" }).parsed
if (envs == undefined) {
  envs = process.env
}

// error if variables we depend on aren't set
// because I lost 2 hours from setting BROWSER_SENTRY
const expected_vars = [
  "BROWSER_SENTRY",
  "NODE_SENTRY",
  "NODE_ENV",
  // if true log artificial errors to sentry to prove that it's working
  "SENTRY_TESTS",
  "GOOGLE_MAPS_KEY",
  "SENTRY_RELEASE",
  "SENTRY_AUTH_TOKEN",
]
for (const env of expected_vars) {
  if (envs[env] == undefined) {
    console.log(env)
    throw Error(`no ${env} environment variable`)
  }
}

module.exports = {
  entry: {
    index: "./src/client/index.ts",
    archived: "./src/client/archived.ts",
    lobby: "./src/client/lobby.ts",
  },
  output: {
    publicPath: "/static",
    path: path.resolve(__dirname, "dist/public"),
  },
  mode: "development",
  devtool: "source-map",
  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js"],
    fallback: {
      buffer: require.resolve("buffer"),
      https: require.resolve("https-browserify"),
      url: require.resolve("url/"),
      http: require.resolve("stream-http"),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          onlyCompileBundledFiles: true,
          configFile: "src/client/tsconfig.json",
        },
      },
      { test: /\.js$/, loader: "source-map-loader" },
    ],
  },
  plugins: [
    // https://github.com/webpack/changelog-v5/issues/10
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
    new webpack.DefinePlugin({
      "process.env": JSON.stringify(envs),
    }),
    new HtmlWebpackPlugin({
      template: `./assets/templates/index.html`,
      filename: `index.html`,
      templateParameters: {
        key: envs["GOOGLE_MAPS_KEY"],
      },
      chunks: ["index"],
      inject: "head",
      scriptLoading: "defer",
    }),
    new HtmlWebpackPlugin({
      template: `./assets/templates/archived.html`,
      filename: `archived.html`,
      templateParameters: {
        key: envs["GOOGLE_MAPS_KEY"],
      },
      chunks: ["archived"],
      inject: "head",
      scriptLoading: "defer",
    }),
    new CopyPlugin({
      patterns: [
        { from: "./assets/css", to: "." },
        { from: "./assets/images", to: "." },
        { from: "./assets/views", to: "../views" },
      ],
    }),
    new SentryCliPlugin({
      include: "./dist/public",
      // from https://sentry.io/settings/account/api/auth-tokens/
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: "photo-snipe",
      project: "javascript",
      release: "SENTRY_RELEASE",
    }),
  ].concat(
    ["lobby"].map((name) => {
      return new HtmlWebpackPlugin({
        template: `./assets/templates/${name}.html`, // relative path to the HTML files
        filename: `${name}.html`, // output HTML files
        chunks: [`${name}`], // respective JS files
        inject: "head",
        // todo: we don't actually want to defer the script that loads the websocket
        // we want this to run asap
        scriptLoading: "defer",
      })
    })
  ),
}
