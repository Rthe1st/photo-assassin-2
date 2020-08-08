const dotenv = require('dotenv')
const path = require('path');
const webpack = require('webpack');
// const SentryWebpackPlugin = require('@sentry/webpack-plugin');
// it cant fetch the source basue we're on loachost
// 1) would it just work on proper webpack
// 2) why isn't it finding the styff we;ve uploaded?
// I think its because of the source folder prefix
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
      'process.env': JSON.stringify(dotenv.config().parsed)
      // 'process.env.BROWSER_SENTRY': JSON.stringify(process.env.BROWSER_SENTRY)
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