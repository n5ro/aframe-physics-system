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
    axis: {type: 'vec3', default: { x: 0, y: 0, z: 1 }},
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
    var el = this.el,
        data = this.data;

    this.remove();

    if (!el.body || !data.target.body) {
      (el.body ? data.target : el).addEventListener('body-loaded', this.update.bind(this, {}));
      return;
    }

    /* 
     * This is actually the simplest way even with the superficial code duplication
     * Cannon's constraint interface's inconsistencies makes it so.
     */
    switch (data.type) {
      case 'lock':
        this.constraint = new CANNON.LockConstraint(this.el.body, data.target.body, { "maxForce": data.maxForce });
        break;
      case 'distance':
        this.constraint = new CANNON.DistanceConstraint(this.el.body, data.target.body, data.distance, data.maxForce);
        break;
      case 'hinge':
        this.constraint = new CANNON.HingeConstraint(
          this.el.body,
          data.target.body, {
            "pivotA": data.axis,
            "pivotB": data.axisTarget,
            "axisA": data.pivot,
            "axisB": data.pivotTarget,
            "maxForce": data.maxForce
          });
        break;
      case 'coneTwist':
        this.constraint = new CANNON.ConeTwistConstraint(
          this.el.body,
          data.target.body, {
            "pivotA": data.axis,
            "pivotB": data.axisTarget,
            "axisA": data.pivot,
            "axisB": data.pivotTarget,
            "maxForce": data.maxForce
          });
        break;
      case 'pointToPoint':
        this.constraint = new Cannon.PointToPointConstraint(
          this.el.body,
          data.pivot,
          data.target.body,
          data.pivotTarget,
          data.maxForce);
        break;
      default:
        throw new Error('[constraint] Unimplemented type.');
    }
    this.system.world.addConstraint(this.constraint);
  },
};
