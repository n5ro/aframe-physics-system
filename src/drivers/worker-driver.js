var webworkify = require('webworkify'),
    Driver = require('./driver'),
    Event = require('./event'),
    worker = require('./worker'),
    protocol = require('../utils/protocol');

/******************************************************************************
 * Constructor
 */

function WorkerDriver () {
  this.bodies = {};
  this.worker = webworkify(worker);
  this.worker.addEventListener('message', this._onMessage.bind(this));
}

WorkerDriver.prototype = new Driver();
WorkerDriver.prototype.constructor = WorkerDriver;

module.exports = WorkerDriver;

/******************************************************************************
 * Lifecycle
 */

/* @param {object} worldConfig */
WorkerDriver.prototype.init = function (worldConfig) {
  this.worker.postMessage({type: Event.INIT, worldConfig: worldConfig});
};

/* @param {number} deltaMS */
WorkerDriver.prototype.step = function () {};

WorkerDriver.prototype.destroy = function () {
  this.worker.terminate();
  delete this.worker;
};

/** {Event} event */
WorkerDriver.prototype._onMessage = function (event) {
  if (event.data.type === Event.STEP) {
    var bodies = event.data.bodies;
    for (var id in bodies) {
      if (bodies.hasOwnProperty(id)) {
        protocol.deserializeBodyUpdate(bodies[id], this.bodies[id]);
      }
    }
  } else {
    throw new Error('[WorkerDriver] Unexpected message type.');
  }
};

/******************************************************************************
 * Bodies
 */

/* @param {CANNON.Body} body */
WorkerDriver.prototype.addBody = function (body) {
  // TODO(donmccurdy): IDs are not consistent across protocol.
  this.bodies[body.id] = body;
  this.worker.postMessage({type: Event.ADD_BODY, body: protocol.serializeBody(body)});
};

/* @param {CANNON.Body} body */
WorkerDriver.prototype.removeBody = function (body) {
  // TODO(donmccurdy): IDs are not consistent across protocol.
  this.worker.postMessage({type: Event.REMOVE_BODY, bodyID: body.id});
  this.bodies[body.id];
};

/**
 * @param {CANNON.Body} body
 * @param {string} methodName
 * @param {Array} args
 */
WorkerDriver.prototype.applyBodyMethod = function (body, methodName, args) {
  switch (methodName) {
    case 'applyForce':
    case 'applyImpulse':
      this.worker.postMessage({
        type: Event.APPLY_BODY_METHOD,
        bodyID: body.id,
        methodName: methodName,
        args: [args[0].toArray(), args[1].toArray()]
      });
      break;
    default:
      throw new Error('Unexpected methodName: %s', methodName);
  }
};

/** @param {CANNON.Body} body */
WorkerDriver.prototype.updateBodyProperties = function (body) {
  this.worker.postMessage({
    type: Event.UPDATE_BODY_PROPERTIES,
    body: protocol.serializeBody(body)
  });
};

/******************************************************************************
 * Materials
 */

/** @param {object} materialConfig */
WorkerDriver.prototype.addMaterial = function (materialConfig) {
  this.worker.postMessage({type: Event.ADD_MATERIAL, materialConfig: materialConfig});
};

/**
 * @param {string} matName1
 * @param {string} matName2
 * @param {object} contactMaterialConfig
 */
WorkerDriver.prototype.addContactMaterial = function (matName1, matName2, contactMaterialConfig) {
  this.worker.postMessage({
    type: Event.ADD_CONTACT_MATERIAL,
    materialName1: matName1,
    materialName2: matName2,
    contactMaterialConfig: contactMaterialConfig
  });
};

/******************************************************************************
 * Constraints
 */

/* @param {CANNON.Constraint} constraint */
WorkerDriver.prototype.addConstraint = function (constraint) {
  // TODO(donmccurdy): Constraints IDs are not consistent across protocol.
  this.worker.postMessage({
    type: Event.ADD_CONSTRAINT,
    constraint: protocol.serializeConstraint(constraint)
  });
};

/* @param {CANNON.Constraint} constraint */
WorkerDriver.prototype.removeConstraint = function (constraint) {
  this.worker.postMessage({
    type: Event.REMOVE_CONSTRAINT,
    constraintID: constraint.id
  });
};

/******************************************************************************
 * Collisions
 */

/** @return {Array<object>} */
WorkerDriver.prototype.getCollisions = function () {
  // TODO(donmccurdy)
  throw new Error('[WorkerDriver] Not implemented');
};
