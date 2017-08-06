/**
 * Rain of Entities component.
 *
 * Creates a spawner on the scene, which periodically generates new entities
 * and drops them from the sky. Objects falling below altitude=0 will be
 * recycled after a few seconds.
 *
 * Requires: physics
 */
AFRAME.registerComponent('rain-of-entities', {
  schema: {
    tagName:    { default: 'a-box' },
    components: { default: ['dynamic-body', 'force-pushable', 'color|#39BB82', 'scale|0.2 0.2 0.2'] },
    spread:     { default: 10, min: 0 },
    maxCount:   { default: 10, min: 0 },
    interval:   { default: 1000, min: 0 },
    lifetime:   { default: 10000, min: 0 }
  },
  init: function () {
    this.boxes = [];
    this.timeout = setInterval(this.spawn.bind(this), this.data.interval);
  },
  spawn: function () {
    if (this.boxes.length >= this.data.maxCount) {
      clearTimeout(this.timeout);
      return;
    }

    var data = this.data,
        physics = this.el.sceneEl.systems.physics,
        box = document.createElement(data.tagName);

    this.boxes.push(box);
    this.el.appendChild(box);

    box.setAttribute('position', this.randomPosition());
    data.components.forEach(function (s) {
      var parts = s.split('|');
      box.setAttribute(parts[0], parts[1] || '');
    });

    // Recycling is important, kids.
    setInterval(function () {
      if (box.body.position.y > 0) return;
      box.body.position.copy(this.randomPosition());
      box.body.quaternion.set(0, 0, 0, 1);
      box.body.velocity.set(0, 0, 0);
      box.body.angularVelocity.set(0, 0, 0);
      box.body.updateProperties();
    }.bind(this), this.data.lifetime);

    var colliderEls = this.el.sceneEl.querySelectorAll('[sphere-collider]');
    for (var i = 0; i < colliderEls.length; i++) {
      colliderEls[i].components['sphere-collider'].update();
    }
  },
  randomPosition: function () {
    var spread = this.data.spread;
    return {
      x: Math.random() * spread - spread / 2,
      y: 3,
      z: Math.random() * spread - spread / 2
    };
  }
});
