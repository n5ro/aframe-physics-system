var webworkify = require('webworkify'),
    webworkifyDebug = require('./webworkify-debug'),
    Driver = require('./driver'),
    Event = require('./event'),
    worker = require('./worker'),
    protocol = require('../utils/protocol');

var ID = protocol.ID;

/******************************************************************************
 * Constructor
 */

function WorkerDriver (options) {
  this.fps = options.fps;
  this.engine = options.engine;
  this.debug = options.debug;

  this.bodies = {};
  this.contacts = [];

  this.worker = this.debug
    ? webworkifyDebug(worker)
    : webworkify(worker);
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
  this.worker.postMessage({
    type: Event.INIT,
    worldConfig: worldConfig,
    fps: this.fps,
    engine: this.engine
  });
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
    var data = event.data,
        bodies = data.bodies;

    this.contacts = event.data.contacts;

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
  protocol.assignID('body', body);
  this.bodies[body[ID]] = body;
  this.worker.postMessage({type: Event.ADD_BODY, body: protocol.serializeBody(body)});
};

/* @param {CANNON.Body} body */
WorkerDriver.prototype.removeBody = function (body) {
  this.worker.postMessage({type: Event.REMOVE_BODY, bodyID: body[ID]});
  delete this.bodies[body[ID]];
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
        bodyID: body[ID],
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
  protocol.assignID('constraint', constraint);
  this.worker.postMessage({
    type: Event.ADD_CONSTRAINT,
    constraint: protocol.serializeConstraint(constraint)
  });
};

/* @param {CANNON.Constraint} constraint */
WorkerDriver.prototype.removeConstraint = function (constraint) {
  this.worker.postMessage({
    type: Event.REMOVE_CONSTRAINT,
    constraintID: constraint[ID]
  });
};

/******************************************************************************
 * Contacts
 */

/** @return {Array<object>} */
WorkerDriver.prototype.getContacts = function () {
  // TODO(donmccurdy): There's some wasted memory allocation here.
  var bodies = this.bodies;
  return this.contacts.map(function (message) {
    return protocol.deserializeContact(message, bodies);
  });
};
