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
    targetPivot: {type: 'vec3'},

    // An axis that each body can rotate around, defined locally to that body.
    axis: {type: 'vec3', default: { x: 0, y: 0, z: 1 }},
    targetAxis: {type: 'vec3', default: { x: 0, y: 0, z: 1}}
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

    this.constraint = this.createConstraint();
    this.system.world.addConstraint(this.constraint);
  },

  /**
   * Creates a new constraint, given current component data. The CANNON.js constructors are a bit
   * different for each constraint type.
   * @return {CANNON.Constraint}
   */
  createConstraint: function () {
    var data = this.data,
        pivot = new CANNON.Vec3(data.pivot.x, data.pivot.y, data.pivot.z),
        targetPivot = new CANNON.Vec3(data.targetPivot.x, data.targetPivot.y, data.targetPivot.z),
        axis = new CANNON.Vec3(data.axis.x, data.axis.y, data.axis.z),
        targetAxis= new CANNON.Vec3(data.targetAxis.x, data.targetAxis.y, data.targetAxis.z);

    var constraint;

    switch (data.type) {
      case 'lock':
        constraint = new CANNON.LockConstraint(
          this.el.body,
          data.target.body,
          {maxForce: data.maxForce}
        );
        break;

      case 'distance':
        constraint = new CANNON.DistanceConstraint(
          this.el.body,
          data.target.body,
          data.distance,
          data.maxForce
        );
        break;

      case 'hinge':
        constraint = new CANNON.HingeConstraint(
          this.el.body,
          data.target.body, {
            pivotA: pivot,
            pivotB: targetPivot,
            axisA: axis,
            axisB: targetAxis,
            maxForce: data.maxForce
          });
        break;

      case 'coneTwist':
        constraint = new CANNON.ConeTwistConstraint(
          this.el.body,
          data.target.body, {
            pivotA: pivot,
            pivotB: targetPivot,
            axisA: axis,
            axisB: targetAxis,
            maxForce: data.maxForce
          });
        break;

      case 'pointToPoint':
        constraint = new CANNON.PointToPointConstraint(
          this.el.body,
          pivot,
          data.target.body,
          targetPivot,
          data.maxForce);
        break;

      default:
        throw new Error('[constraint] Unexpected type: ' + data.type);
    }

    constraint.collideConnected = data.collideConnected;
    return constraint;
  }
};
