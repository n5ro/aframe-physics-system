var Body = require('./body');

/**
 * Dynamic body.
 *
 * Moves according to physics simulation, and may collide with other objects.
 */
var DynamicBody = AFRAME.utils.extend({}, Body.definition);

module.exports = AFRAME.registerComponent('dynamic-body', DynamicBody);
