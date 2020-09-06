const dotenv = require('dotenv')
const path = require('path');
const webpack = require('webpack');
// this is used to upload map files to sentry
// but I can't work out how to get sentry to actually used them in issues
// const SentryWebpackPlugin = require('@sentry/webpack-plugin');
let envs = dotenv.config().parsed;
if(envs == undefined){
  envs = process.env
}

// error if variables we depend on aren't set
// because I lost 2 hours from setting BROWER_SENTRY
let expected_vars = [
  "BROWSER_SENTRY",
  "NODE_SENTRY",
  "NODE_ENV",
  // wether to true to log artificial errors to sentry to prove that it's working
  // anything else to turn off
  "SENTRY_TESTS"
];
for(let env of expected_vars){
  if(envs[env] == undefined){
    console.log(env);
    throw Error(`no ${env} environment variable`);
  }
}

module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'public'),
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
      { test: /\.tsx?$/, loader: "awesome-typescript-loader", options: { configFileName: './tsconfig.webpack.json'} },

      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      { test: /\.js$/, loader: "source-map-loader" }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(envs)
    })
    // ,
    // new SentryWebpackPlugin({
    //   include: '.',
    //   ignoreFile: '.sentrycliignore',
    //   ignore: ['node_modules', 'webpack.config.ts'],
    //   configFile: 'sentry.properties'
    // })
  ]
};