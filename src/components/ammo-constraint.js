/* global Ammo */

module.exports = AFRAME.registerComponent('ammo-constraint', {

  multiple: true,

  schema: {
    // Type of constraint.
    type: {default: 'fixed', oneOf: ['fixed', 'spring', 'slider', 'hinge', 'coneTwist', 'pointToPoint']},

    // Target (other) body for the constraint.
    target: {type: 'selector'},

    // TODO: Wake up bodies when connected.
    wakeUpBodies: {default: true},

    // Offset of the hinge or point-to-point constraint, defined locally in the body.
    pivot: {type: 'vec3'},
    targetPivot: {type: 'vec3'},

    // An axis that each body can rotate around, defined locally to that body.
    axis: {type: 'vec3', default: { x: 0, y: 0, z: 1 }},
    targetAxis: {type: 'vec3', default: { x: 0, y: 0, z: 1}}
  },

  init: function () {
    this.system = this.el.sceneEl.systems.physics;
    this.constraint = null;
  },

  remove: function () {
    if (!this.constraint) return;

    this.system.removeConstraint(this.constraint);
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
    this.system.addConstraint(this.constraint);
  },

  /**
   * @return {Ammo.btTypedConstraint}
   */
  createConstraint: function () {
    var constraint,
        data = this.data,
        body = this.el.body,
        targetBody = data.target.body;

    var constraint;

    var bodyTransform = body.getWorldTransform();
    var targetTransform = targetBody.getWorldTransform();
    var distance = targetTransform.getOrigin().op_sub(bodyTransform.getOrigin());
    bodyTransform.setOrigin(distance);
    targetTransform.setOrigin(targetTransform.getOrigin().setValue(0, 0, 0));

    switch (data.type) {
      case 'fixed':
        constraint = new Ammo.btFixedConstraint(body, targetBody, bodyTransform, targetTransform);
        break;

      case 'spring':
        constraint = new Ammo.btGeneric6DofSpringConstraint(body, targetBody, bodyTransform, targetTransform, true);
        break;


      case 'slider':
        //TODO: optionally support axis/limits
        constraint = new Ammo.btSliderConstraint(body, targetBody, bodyTransform, targetTransform, true);
        break;

      case 'hinge':
        var pivot = new Ammo.btVector3(data.pivot.x, data.pivot.y, data.pivot.z);
        var targetPivot = new Ammo.btVector3(data.targetPivot.x, data.targetPivot.y, data.targetPivot.z);
        
        var axis = new Ammo.btVector3(data.axis.x, data.axis.y, data.axis.z);
        var targetAxis = new Ammo.btVector3(data.targetAxis.x, data.targetAxis.y, data.targetAxis.z);

        constraint = new Ammo.btHingeConstraint(body, targetBody, pivot, targetPivot, axis, targetAxis, true);
        
        Ammo.destroy(pivot);
        Ammo.destroy(targetPivot);
        Ammo.destroy(axis);
        Ammo.destroy(targetAxis);
        break;

      case 'coneTwist':
        var pivotTransform = new Ammo.btTransform();
        pivotTransform.setIdentity();
        pivotTransform.setOrigin(targetPivot);
        constraint = new Ammo.btConeTwistConstraint(body, pivotTransform);
        break;

      case 'pointToPoint':
        var pivot = new Ammo.btVector3(data.pivot.x, data.pivot.y, data.pivot.z);
        var targetPivot = new Ammo.btVector3(data.targetPivot.x, data.targetPivot.y, data.targetPivot.z);

        constraint = new Ammo.btPoint2PointConstraint(body, targetBody, pivot, targetPivot);

        Ammo.destroy(pivot);
        Ammo.destroy(targetPivot);
        break;

      default:
        throw new Error('[constraint] Unexpected type: ' + data.type);
    }

    Ammo.destroy(bodyTransform);
    Ammo.destroy(targetTransform);

    return constraint;
  }
});
