var imago = require('./');
var stack = require('simple-stack-common');

var app = module.exports = stack();

app.replace('router', imago());
