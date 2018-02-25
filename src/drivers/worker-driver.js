/* global performance */

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
  this.interpolate = options.interpolate;
  // Approximate number of physics steps to 'pad' rendering.
  this.interpBufferSize = options.interpolationBufferSize;
  this.debug = options.debug;

  this.bodies = {};
  this.contacts = [];

  // https://gafferongames.com/post/snapshot_interpolation/
  this.frameDelay = this.interpBufferSize * 1000 / this.fps;
  this.frameBuffer = [];

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

/**
 * Increments the physics world forward one step, if interpolation is enabled.
 * If disabled, increments are performed as messages arrive.
 * @param {number} deltaMS
 */
WorkerDriver.prototype.step = function () {
  if (!this.interpolate) return;

  // Get the two oldest frames that haven't expired. Ideally we would use all
  // available frames to keep things smooth, but lerping is easier and faster.
  var prevFrame = this.frameBuffer[0];
  var nextFrame = this.frameBuffer[1];
  var timestamp = performance.now();
  while (prevFrame && nextFrame && timestamp - prevFrame.timestamp > this.frameDelay) {
    this.frameBuffer.shift();
    prevFrame = this.frameBuffer[0];
    nextFrame = this.frameBuffer[1];
  }

  if (!prevFrame || !nextFrame) return;

  var mix = (timestamp - prevFrame.timestamp) / this.frameDelay;
  mix = (mix - (1 - 1 / this.interpBufferSize)) * this.interpBufferSize;

  for (var id in prevFrame.bodies) {
    if (prevFrame.bodies.hasOwnProperty(id) && nextFrame.bodies.hasOwnProperty(id)) {
      protocol.deserializeInterpBodyUpdate(
        prevFrame.bodies[id],
        nextFrame.bodies[id],
        this.bodies[id],
        mix
      );
    }
  }
};

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

    // If interpolation is enabled, store the frame. If not, update all bodies
    // immediately.
    if (this.interpolate) {
      this.frameBuffer.push({timestamp: performance.now(), bodies: bodies});
    } else {
      for (var id in bodies) {
        if (bodies.hasOwnProperty(id)) {
          protocol.deserializeBodyUpdate(bodies[id], this.bodies[id]);
        }
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

/**
 * @param  {string} name
 * @return {CANNON.Material}
 */
WorkerDriver.prototype.getMaterial = function (name) {
  // No access to materials here. Eventually we might return the name or ID, if
  // multiple materials were selected, but for now there's only one and it's safe
  // to assume the worker is already using it.
  return undefined;
};

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
