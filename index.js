var CANNON = require('cannon');

require('./src/components/math');
require('./src/components/body/body');
require('./src/components/body/dynamic-body');
require('./src/components/body/static-body');
require('./src/components/shape/shape')
require('./src/components/constraint');
require('./src/system');

module.exports = {
  registerAll: function () {
    console.warn('registerAll() is deprecated. Components are automatically registered.');
  }
};

// Export CANNON.js.
window.CANNON = window.CANNON || CANNON;
