var Shape = require('./shape');

var SphereShape = AFRAME.utils.extend({}, Shape.definition);

SphereShape.schema = AFRAME.utils.extend({}, Shape.definition.schema, {
  shape: {default: 'sphere', oneOf: ['box', 'sphere', 'cylinder']}
});

module.exports = AFRAME.registerComponent('sphere-shape', SphereShape);
