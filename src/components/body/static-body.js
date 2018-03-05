var Body = require('./body');

/**
 * Static body.
 *
 * Solid body with a fixed position. Unaffected by gravity and collisions, but
 * other objects may collide with it.
 */
var StaticBody = AFRAME.utils.extend({}, Body.definition);

StaticBody.schema = AFRAME.utils.extend({}, Body.definition.schema, {
  type: {default: 'static', oneOf: ['static', 'dynamic']},
  mass: {default: 0}
});

module.exports = AFRAME.registerComponent('static-body', StaticBody);
