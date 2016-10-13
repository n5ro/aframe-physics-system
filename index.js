var CANNON = require('cannon'),
    math = require('./src/components/math');

module.exports = {
  'dynamic-body':   require('./src/components/body/dynamic-body'),
  'static-body':    require('./src/components/body/static-body'),
  'constraint':     require('./src/components/constraint'),
  'system':         require('./src/system/physics'),

  registerAll: function (AFRAME) {
    if (this._registered) return;

    AFRAME = AFRAME || window.AFRAME;

    math.registerAll();
    if (!AFRAME.systems.physics)            AFRAME.registerSystem('physics',         this.system);
    if (!AFRAME.components['dynamic-body']) AFRAME.registerComponent('dynamic-body', this['dynamic-body']);
    if (!AFRAME.components['static-body'])  AFRAME.registerComponent('static-body',  this['static-body']);
    if (!AFRAME.components['constraint'])   AFRAME.registerComponent('constraint',   this['constraint']);

    this._registered = true;
  }
};

// Export CANNON.js.
window.CANNON = window.CANNON || CANNON;
