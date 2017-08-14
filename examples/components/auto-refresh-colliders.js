function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}
AFRAME.registerComponent('auto-refresh-colliders', {
  init: function () {
    var el = this.el;
    this.fn = debounce(function () {
      var colliders = el.querySelectorAll('[sphere-collider]');
      for (var i = 0; i < colliders.length; i++) {
        colliders[i].components['sphere-collider'].update();
      }
      var teleporters = el.querySelectorAll('[teleport-controls]');
      for (i = 0; i < teleporters.length; i++) {
        teleporters[i].components['teleport-controls'].queryCollisionEntities();
      }
    }, 200);
    el.addEventListener('body-loaded', this.fn);
  },
  remove: function () {
    this.el.removeEventListener('body-loaded', this.fn);
  }
});
