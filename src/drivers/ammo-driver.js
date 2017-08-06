var Driver = require('./driver');

function AmmoDriver () {
  throw new Error('[AmmoDriver] Driver not implemented.');
}

AmmoDriver.prototype = new Driver();
AmmoDriver.prototype.constructor = AmmoDriver;

module.exports = AmmoDriver;
