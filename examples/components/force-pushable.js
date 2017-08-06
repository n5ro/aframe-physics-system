/**
 * Force Pushable component.
 *
 * Applies behavior to the current entity such that cursor clicks will apply a
 * strong impulse, pushing the entity away from the viewer.
 *
 * Requires: physics
 */
AFRAME.registerComponent('force-pushable', {
  schema: {
    force: { default: 10 }
  },
  init: function () {
    this.pStart = new THREE.Vector3();
    this.sourceEl = this.el.sceneEl.querySelector('[camera]');
    this.el.addEventListener('click', this.forcePush.bind(this));
  },
  forcePush: function () {
    var force,
        el = this.el,
        pStart = this.pStart.copy(this.sourceEl.getAttribute('position'));

    // Compute direction of force, normalize, then scale.
    force = el.body.position.vsub(pStart);
    force.normalize();
    force.scale(this.data.force, force);

    el.body.applyImpulse(force, el.body.position);
  }
});
