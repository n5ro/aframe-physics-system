/**
 * Velocity, in m/s.
 */
module.exports = AFRAME.registerComponent('velocity', {
  schema: {type: 'vec3'},

  init: function () {
    this.system = this.el.sceneEl.systems.physics;
    this.defaultVelocity = {x: 0, y: 0, z: 0};
    this.defaultPosition = {x: 0, y: 0, z: 0};
    this.position = {x: 0, y: 0, z: 0};

    if (this.system) {
      this.system.addComponent(this);
    }
  },

  remove: function () {
    if (this.system) {
      this.system.removeComponent(this);
    }
  },

  tick: function (t, dt) {
    if (!dt) return;
    if (this.system) return;
    this.afterStep(t, dt);
  },

  afterStep: function (t, dt) {
    if (!dt) return;

    var physics = this.el.sceneEl.systems.physics || {data: {maxInterval: 1 / 60}},

    // TODO - There's definitely a bug with getComputedAttribute and el.data.
    velocity = this.el.getAttribute('velocity') || this.defaultVelocity,
    position = this.el.getAttribute('position') || this.defaultPosition;

    dt = Math.min(dt, physics.data.maxInterval * 1000);

    this.position.x = position.x + velocity.x * dt / 1000;
    this.position.y = position.y + velocity.y * dt / 1000;
    this.position.z = position.z + velocity.z * dt / 1000;

    this.el.setAttribute('position', this.position);
  }
});
