var Shape = require('./shape');

var BoxShape = AFRAME.utils.extend({}, Shape.definition);

module.exports = AFRAME.registerComponent('box-shape', BoxShape);
