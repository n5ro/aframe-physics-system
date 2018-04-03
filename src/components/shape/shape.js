var CANNON = require('cannon');

var Shape = {
	schema: {
		shape: {default: 'box', oneOf: ['box', 'sphere', 'cylinder']},
		radius: {type: 'number', default: 1},
		offset: {type: 'vec3', default: {x: 0, y: 0, z: 0}},
		halfExtents: {type: 'vec3', default: {x: 1, y: 1, z: 1}},
		orientation: {type: 'vec4', default: {x: 0, y: 0, z: 0, w: 1}},
		radiusTop: {type: 'number', default: 1},
		radiusBottom: {type: 'number', default: 1},
		height: {type: 'number', default: 1},
		numSegments: {type: 'int', default: 6}
	},

	multiple: true,

	init: function() {
		if (this.el.sceneEl.hasLoaded) {
      this.initShape();
    } else {
      this.el.sceneEl.addEventListener('loaded', this.initShape.bind(this));
    }
	},

	initShape: function() {
		this.bodyEl = this.el;
		var type = this._findType(this.bodyEl);

		while (!type && this.bodyEl.parentNode) {
			this.bodyEl = this.bodyEl.parentNode;
			type = this._findType(this.bodyEl);
		}
		this.bodyEl.components[type].addShape(this.data);
	},

	_findType: function(el) {
		if (el.components.hasOwnProperty('body')) {
			return 'body';
		} else if (el.components.hasOwnProperty('dynamic-body')) {
			return 'dynamic-body';
		} else if (el.components.hasOwnProperty('static-body')) {
			return'static-body';
		}
		return null;
	},

	remove: function() {
		if (this.bodyEl.parentNode) {
			console.warn('removing shape component not currently supported');
		}
	}
};

module.exports.definition = Shape;
module.exports.Component = AFRAME.registerComponent('shape', Shape);
