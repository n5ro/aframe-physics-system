var Shape = require('./shape');

var CylinderShape = AFRAME.utils.extend({}, Shape.definition);

CylinderShape.schema = AFRAME.utils.extend({}, Shape.definition.schema, {
  shape: {default: 'cylinder', oneOf: ['box', 'sphere', 'cylinder']}
});

module.exports = AFRAME.registerComponent('cylinder-shape', CylinderShape);
