var Driver = require('./driver');

function WorkerDriver () {
  throw new Error('[WorkerDriver] Driver not implemented.');
}

WorkerDriver.prototype = new Driver();
WorkerDriver.prototype.constructor = WorkerDriver;

module.exports = WorkerDriver;
