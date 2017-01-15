var Driver = require('./driver');

function ServerDriver () {
  throw new Error('[ServerDriver] Driver not implemented.');
}

ServerDriver.prototype = new Driver();
ServerDriver.prototype.constructor = ServerDriver;

module.exports = ServerDriver;
