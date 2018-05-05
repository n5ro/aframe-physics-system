var CANNON = require('cannon'),
    Driver = require('./driver');

function LocalDriver () {
  this.world = null;
  this.materials = {};
  this.contactMaterial = null;
}

LocalDriver.prototype = new Driver();
LocalDriver.prototype.constructor = LocalDriver;

module.exports = LocalDriver;

/******************************************************************************
 * Lifecycle
 */

/* @param {object} worldConfig */
LocalDriver.prototype.init = function (worldConfig) {
  var world = new CANNON.World();
  world.quatNormalizeSkip = worldConfig.quatNormalizeSkip;
  world.quatNormalizeFast = worldConfig.quatNormalizeFast;
  world.solver.iterations = worldConfig.solverIterations;
  world.gravity.set(0, worldConfig.gravity, 0);
  world.broadphase = new CANNON.NaiveBroadphase();

  this.world = world;
};

/* @param {number} deltaMS */
LocalDriver.prototype.step = function (deltaMS) {
  this.world.step(deltaMS);
};

LocalDriver.prototype.destroy = function () {
  delete this.world;
  delete this.contactMaterial;
  this.materials = {};
};

/******************************************************************************
 * Bodies
 */

/* @param {CANNON.Body} body */
LocalDriver.prototype.addBody = function (body) {
  this.world.addBody(body);
};

/* @param {CANNON.Body} body */
LocalDriver.prototype.removeBody = function (body) {
  this.world.removeBody(body);
};

/**
 * @param {CANNON.Body} body
 * @param {string} methodName
 * @param {Array} args
 */
LocalDriver.prototype.applyBodyMethod = function (body, methodName, args) {
  body['__' + methodName].apply(body, args);
};

/** @param {CANNON.Body} body */
LocalDriver.prototype.updateBodyProperties = function () {};

/******************************************************************************
 * Materials
 */

/**
 * @param {string} name
 * @return {CANNON.Material}
 */
LocalDriver.prototype.getMaterial = function (name) {
  return this.materials[name];
};

/** @param {object} materialConfig */
LocalDriver.prototype.addMaterial = function (materialConfig) {
  this.materials[materialConfig.name] = new CANNON.Material(materialConfig);
  this.materials[materialConfig.name].name = materialConfig.name;
};

/**
 * @param {string} matName1
 * @param {string} matName2
 * @param {object} contactMaterialConfig
 */
LocalDriver.prototype.addContactMaterial = function (matName1, matName2, contactMaterialConfig) {
  var mat1 = this.materials[matName1],
      mat2 = this.materials[matName2];
  this.contactMaterial = new CANNON.ContactMaterial(mat1, mat2, contactMaterialConfig);
  this.world.addContactMaterial(this.contactMaterial);
};

/******************************************************************************
 * Constraints
 */

/* @param {CANNON.Constraint} constraint */
LocalDriver.prototype.addConstraint = function (constraint) {
  this.world.addConstraint(constraint);
};

/* @param {CANNON.Constraint} constraint */
LocalDriver.prototype.removeConstraint = function (constraint) {
  this.world.removeConstraint(constraint);
};

/******************************************************************************
 * Contacts
 */

/** @return {Array<object>} */
LocalDriver.prototype.getContacts = function () {
  return this.world.contacts;
};
