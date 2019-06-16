/**
 * Simple pool of generic objects.
 * @param {function():T} Function that creates a resource.
 * @param {function():T} Function that resets a resource.
 */
function Pool ( factory, reset ) {
  this.factory = factory;
  this.reset = reset;
  this.resources = [];
};

/**
 * @return {T}
 */
Pool.prototype.obtain = function () {
  if (this.resources.length > 0) {
    return this.resources.pop();
  } else {
    return this.factory();
  }
};

/**
 * @param {T} resource
 */
Pool.prototype.recycle = function ( resource ) {
  if (this.reset) this.reset(resource);
  this.resources.push(resource);
};

module.exports = Pool;
