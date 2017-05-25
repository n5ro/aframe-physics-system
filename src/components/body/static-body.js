var Body = require('./body');

/**
 * Static body.
 *
 * Solid body with a fixed position. Unaffected by gravity and collisions, but
 * other objects may collide with it.
 */
var StaticBody = AFRAME.utils.extend({}, Body, {
  step: function () {
    this.syncToPhysics();
  }
});

module.exports = AFRAME.registerComponent('static-body', StaticBody);
