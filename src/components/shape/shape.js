var CANNON = require('cannon-es');

var Shape = {
  schema: {
    shape: {default: 'box', oneOf: ['box', 'sphere', 'cylinder']},
    offset: {type: 'vec3', default: {x: 0, y: 0, z: 0}},
    orientation: {type: 'vec4', default: {x: 0, y: 0, z: 0, w: 1}},

    // sphere
    radius: {type: 'number', default: 1, if: {shape: ['sphere']}},

    // box
    halfExtents: {type: 'vec3', default: {x: 0.5, y: 0.5, z: 0.5}, if: {shape: ['box']}},
    
    // cylinder
    radiusTop: {type: 'number', default: 1, if: {shape: ['cylinder']}},
    radiusBottom: {type: 'number', default: 1, if: {shape: ['cylinder']}},
    height: {type: 'number', default: 1, if: {shape: ['cylinder']}},
    numSegments: {type: 'int', default: 8, if: {shape: ['cylinder']}}
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
    var bodyType = this._findType(this.bodyEl);
    var data = this.data;

    while (!bodyType && this.bodyEl.parentNode != this.el.sceneEl) {
      this.bodyEl = this.bodyEl.parentNode;
      bodyType = this._findType(this.bodyEl);
    }

    if (!bodyType) {
      console.warn('body not found');
      return;
    }

    var scale = new THREE.Vector3();
    this.bodyEl.object3D.getWorldScale(scale);
    var shape, offset, orientation;

    if (data.hasOwnProperty('offset')) {
      offset = new CANNON.Vec3(
        data.offset.x * scale.x, 
        data.offset.y * scale.y, 
        data.offset.z * scale.z
      );
    }

    if (data.hasOwnProperty('orientation')) {
      orientation = new CANNON.Quaternion();
      orientation.copy(data.orientation);
    }

    switch(data.shape) {
      case 'sphere':
        shape = new CANNON.Sphere(data.radius * scale.x);
        break;
      case 'box':
        var halfExtents = new CANNON.Vec3(
          data.halfExtents.x * scale.x, 
          data.halfExtents.y * scale.y, 
          data.halfExtents.z * scale.z
        );
        shape = new CANNON.Box(halfExtents);
        break;
      case 'cylinder':
        shape = new CANNON.Cylinder(
          data.radiusTop * scale.x, 
          data.radiusBottom * scale.x, 
          data.height * scale.y, 
          data.numSegments
        );

        //rotate by 90 degrees similar to mesh2shape:createCylinderShape
        var quat = new CANNON.Quaternion();
        quat.setFromEuler(90 * THREE.Math.DEG2RAD, 0, 0, 'XYZ').normalize();
        orientation.mult(quat, orientation);
        break;
      default:
          console.warn(data.shape + ' shape not supported');
        return;
    }

    if (this.bodyEl.body) {
      this.bodyEl.components[bodyType].addShape(shape, offset, orientation);
    } else {
      this.bodyEl.addEventListener('body-loaded', function() {
        this.bodyEl.components[bodyType].addShape(shape, offset, orientation);
      }, {once: true});
    }
  },

  _findType: function(el) {
    if (el.hasAttribute('body')) {
      return 'body';
    } else if (el.hasAttribute('dynamic-body')) {
      return 'dynamic-body';
    } else if (el.hasAttribute('static-body')) {
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
