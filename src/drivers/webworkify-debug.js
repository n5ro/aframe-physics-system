/**
 * Stub version of webworkify, for debugging code outside of a webworker.
 */
function webworkifyDebug (worker) {
  var targetA = new EventTarget(),
      targetB = new EventTarget();

  targetA.setTarget(targetB);
  targetB.setTarget(targetA);

  worker(targetA);
  return targetB;
}

module.exports = webworkifyDebug;

/******************************************************************************
 * EventTarget
 */

function EventTarget () {
  this.listeners = [];
}

EventTarget.prototype.setTarget = function (target) {
  this.target = target;
};

EventTarget.prototype.addEventListener = function (type, fn) {
  this.listeners.push(fn);
};

EventTarget.prototype.dispatchEvent = function (type, event) {
  for (var i = 0; i < this.listeners.length; i++) {
    this.listeners[i](event);
  }
};

EventTarget.prototype.postMessage = function (msg) {
  this.target.dispatchEvent('message', {data: msg});
};
