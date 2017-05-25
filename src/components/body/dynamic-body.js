var Body = require('./body');

/**
 * Dynamic body.
 *
 * Moves according to physics simulation, and may collide with other objects.
 */
var DynamicBody = AFRAME.utils.extend({}, Body, {
  dependencies: ['quaternion', 'velocity'],

  schema: AFRAME.utils.extend({}, Body.schema, {
    mass:           { default: 5 },
    linearDamping:  { default: 0.01 },
    angularDamping: { default: 0.01 }
  }),

  step: function () {
    this.syncFromPhysics();
  }
});

module.exports = AFRAME.registerComponent('dynamic-body', DynamicBody);
