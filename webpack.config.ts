const dotenv = require('dotenv')
const path = require('path');
const webpack = require('webpack');

const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');

// this is used to upload map files to sentry
// but I can't work out how to get sentry to actually used them in issues
// const SentryWebpackPlugin = require('@sentry/webpack-plugin');
let envs = dotenv.config().parsed;
if (envs == undefined) {
  envs = process.env
}

// error if variables we depend on aren't set
// because I lost 2 hours from setting BROWSER_SENTRY
let expected_vars = [
  "BROWSER_SENTRY",
  "NODE_SENTRY",
  "NODE_ENV",
  // if true log artificial errors to sentry to prove that it's working
  "SENTRY_TESTS",
  "GOOGLE_MAPS_KEY"
];
for (let env of expected_vars) {
  if (envs[env] == undefined) {
    console.log(env);
    throw Error(`no ${env} environment variable`);
  }
}

module.exports = {
  entry: {
    index: './src/client/index.ts',
    archived: './src/client/archived.ts',
    lobby: './src/client/lobby.ts',
  },
  output: {
    publicPath: '/static',
    path: path.resolve(__dirname, 'dist/public')
  },
  mode: 'development',
  devtool: 'source-map',
  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
      { test: /\.tsx?$/, loader: "awesome-typescript-loader", options: { configFileName: './src/client/tsconfig.json' } },

      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      { test: /\.js$/, loader: "source-map-loader" }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(envs)
    }),
    new HtmlWebpackPlugin({
      template: `./assets/templates/error.html`, // relative path to the HTML files
      filename: `game_doesnt_exist.html`, // output HTML files
      templateParameters: {
        'error': 'Can\'t join - game doesn\'t exist'
      },
      chunks: []
    }),
    new HtmlWebpackPlugin({
      template: `./assets/templates/error.html`,
      filename: `game_in_progress.html`,
      templateParameters: {
        'error': 'Can\'t join - game already in progress'
      },
      chunks: []
    }),
    new HtmlWebpackPlugin({
      template: `./assets/templates/error.html`,
      filename: `no_username.html`,
      templateParameters: {
        'error': 'No username supplied'
      },
      chunks: []
    }),
    new HtmlWebpackPlugin({
      template: `./assets/templates/archived.html`,
      filename: `archived.html`,
      templateParameters: {
        'key': envs["GOOGLE_MAPS_KEY"]
      },
      chunks: ['archived'],
      inject: "head",
      scriptLoading: "defer"
    }),
    new HtmlWebpackPlugin({
      template: `./assets/templates/archived_for_save.html`,
      filename: `archived_for_save.html`,
      templateParameters: {
        'key': envs["GOOGLE_MAPS_KEY"]
      },
      chunks: ['archived'],
      inject: "head",
      scriptLoading: "defer"
    }),
    new CopyPlugin({
      patterns: [
        { from: "./assets/css", to: "." },
        { from: "./assets/images", to: "." },
      ],
    }),
    // ,
    // new SentryWebpackPlugin({
    //   include: '.',
    //   ignoreFile: '.sentrycliignore',
    //   ignore: ['node_modules', 'webpack.config.ts'],
    //   configFile: 'sentry.properties'
    // })
  ]
    .concat(
      ['index', 'lobby'].map(name => {
        return new HtmlWebpackPlugin({
          template: `./assets/templates/${name}.html`, // relative path to the HTML files
          filename: `${name}.html`, // output HTML files
          chunks: [`${name}`], // respective JS files
          inject: "head",
          // todo: we don't actually want to defer the script that loads the websocket
          // we want this to run asap
          scriptLoading: "defer"
        })
      })
    )
};