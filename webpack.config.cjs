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
let expected_vars = ["BROWSER_SENTRY", "NODE_SENTRY", "NODE_ENV"];
for(let env of expected_vars){
  if(envs[env] == undefined){
    console.log(env);
    throw Error(`no ${env} environment variable`);
  }
}

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'public'),
  },
  mode: 'development',
  devtool: 'source-map',
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(envs)
    })
    // ,
    // new SentryWebpackPlugin({
    //   include: '.',
    //   ignoreFile: '.sentrycliignore',
    //   ignore: ['node_modules', 'webpack.config.cjs'],
    //   configFile: 'sentry.properties'
    // })
  ]
};