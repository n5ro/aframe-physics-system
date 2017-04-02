var CANNON = require('cannon');

module.exports = {
  dependencies: ['dynamic-body'],

  multiple: true,

  schema: {
    // Type of constraint.
    type: {default: 'lock', oneOf: ['coneTwist', 'distance', 'hinge', 'lock', 'pointToPoint']},

    // Target (other) body for the constraint.
    target: {type: 'selector'},

    // Maximum force that should be applied to constraint the bodies.
    maxForce: {default: 1e6, min: 0},

    // If true, bodies can collide when they are connected.
    collideConnected: {default: true},

    // Wake up bodies when connected.
    wakeUpBodies: {default: true},

    // The distance to be kept between the bodies. If 0, will be set to current distance.
    distance: {default: 0, min: 0},

    // Offset of the hinge or point-to-point constraint, defined locally in the body.
    pivot: {type: 'vec3'},
    pivotTarget: {type: 'vec3'},

    // An axis that each body can rotate around, defined locally to that body.
    axis: {type: 'vec3'},
    axisTarget: {type: 'vec3'},
  },

  init: function () {
    this.system = this.el.sceneEl.systems.physics;
    this.constraint = /* {CANNON.Constraint} */ null;
  },

  remove: function () {
    if (!this.constraint) return;

    this.system.world.removeConstraint(this.constraint);
    this.constraint = null;
  },

  update: function () {
    /* Wrap constraint functions for a consistent interface */
    function WrappedDistanceConstraint(bodyA, bodyB, options) {
      CANNON.DistanceConstraint.call(this, bodyA, bodyB, options.distance, options.maxForce);
    }
    WrappedDistanceConstraint.prototype = CANNON.DistanceConstraint.prototype;

    function WrappedPointToPointConstraint(bodyA, bodyB, options) {
      CANNON.PointToPointConstraint.call(this, bodyA, options.pivotA, bodyB, options.pivotB, options.maxForce);
    }
    WrappedPointToPointConstraint.prototype = CANNON.PointToPointConstraint.prototype;
    WrappedPointToPointConstraint.constructor = WrappedPointToPointConstraint;

    var el = this.el,
        data = this.data,
        constraintTypes = {
          'lock': CANNON.LockConstraint,
          'distance': WrappedDistanceConstraint,
          'pointToPoint': WrappedPointToPointConstraint,
          'hinge': CANNON.HingeConstraint,
          'coneTwist': CANNON.ConeTwistConstraint
        },
        options = {
          'maxForce': data.maxForce
        };

    this.remove();

    if (!el.body || !data.target.body) {
      (el.body ? data.target : el).addEventListener('body-loaded', this.update.bind(this, {}));
      return;
    }

    /* Generate the options object */
    switch (data.type) {
      case 'lock':
        break;
      case 'distance':
        AFRAME.utils.extend(options, { "distance": data.distance || undefined });
        break;
      case 'hinge':
      case 'coneTwist':
        options = AFRAME.utils.extend(options, {
          "axisA": data.axis,
          "axisB": data.axisTarget
        });
      case 'pointToPoint':
        options = AFRAME.utils.extend(options, {
          "pivotA": data.pivot,
          "pivotB": data.pivotTarget
        });
        break;
      default:
        throw new Error('[constraint] Unimplemented type.');
    }
    this.constraint = new constraintTypes[data.type](this.el.body, data.target.body, options);

    this.system.world.addConstraint(this.constraint);
  }
};
