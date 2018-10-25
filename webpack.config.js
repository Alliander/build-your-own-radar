'use strict';

const webpack = require('webpack');
const path = require('path');
const buildPath = path.join(__dirname, './dist');
const args = require('yargs').argv;

const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const fs = require('fs');

let isProd = args.prod;
let isDev = args.dev;

let main = ['./src/site.js'];
let common = ['./src/common.js'];
let devtool;

function getFileNames(path) {
  return fs.readdirSync(path)
    .sort()
    .reverse();
}

if (isDev) {
    main.push('webpack-dev-server/client?http://0.0.0.0:8080');
    devtool = 'source-map';
}

let plugins = [
    new ExtractTextPlugin('[name].[hash].css'),
    new HtmlWebpackPlugin({
        template: './src/index.html',
        chunks: ['main'],
        inject: 'body'
    }),
    new HtmlWebpackPlugin({
        template: './src/error.html',
        chunks: ['common'],
        inject: 'body',
        filename: 'error.html'
    }),
    // Export some environment variables to client side JavaScript
    new webpack.DefinePlugin({
      'process.env': {
        RADAR_FILE_NAMES: JSON.stringify(getFileNames('src/resources/radars/'))
      },
    })
];

if (isProd) {
    plugins.push(
        new webpack.NoErrorsPlugin(),
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false
            },
            mangle: true
        }),
        new webpack.optimize.OccurenceOrderPlugin()
    );
}

module.exports = {
    entry: {
        'main' : main,
        'common' : common
    },
    node: {
        fs: 'empty',
        net: 'empty',
        tls: 'empty',
        child_process: 'empty'
    },

    output: {
        path: buildPath,
        publicPath: '/',
        filename: '[name].[hash].js'
    },

    module: {
        loaders: [
            { test: /\.json$/, loader: 'json'},
            { test: /\.js$/, exclude: /node_modules/, loader: 'babel'},
            { test: /\.scss$/, exclude: /node_modules/, loader: ExtractTextPlugin.extract('style', 'css?sourceMap!sass') },
            { test: /\.(png|jpg|ico)$/, exclude: /node_modules/, loader: 'file-loader?name=images/[name].[ext]&context=./src/images' },
            { test: /\.csv$/, loader: 'dsv-loader' }
        ]
    },

    quiet: false,
    noInfo: false,

    plugins: plugins,

    devtool: devtool,

    devServer: {
        contentBase: buildPath,
        host: '0.0.0.0',
        port: 8080
    }
};
