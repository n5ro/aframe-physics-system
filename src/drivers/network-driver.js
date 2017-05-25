var Driver = require('./driver');

function NetworkDriver () {
  throw new Error('[NetworkDriver] Driver not implemented.');
}

NetworkDriver.prototype = new Driver();
NetworkDriver.prototype.constructor = NetworkDriver;

module.exports = NetworkDriver;
