var CANNON = require('CANNON');

/******************************************************************************
 * IDs
 */

var ID = '__id';
module.exports.ID = ID;

var nextID = {};
module.exports.assignID = function (prefix, object) {
  if (object[ID]) return;
  nextID[prefix] = nextID[prefix] || 1;
  object[ID] = prefix + '_' + nextID[prefix]++;
};

/******************************************************************************
 * Bodies
 */

module.exports.serializeBody = function (body) {
  var message = {
    // Shapes.
    shapes: body.shapes.map(function (shape) {
      if (shape.type === CANNON.Shape.types.BOX) {
        return {type: 'Box', halfExtents: serializeVec3(shape.halfExtents)};
      }
      // TODO(donmccurdy): Support for other shape types.
      throw new Error('Unimplemented shape type: %s', shape.type);
    }),
    shapeOffsets: body.shapeOffsets.map(serializeVec3),
    shapeOrientations: body.shapeOrientations.map(serializeQuaternion),

    // Vectors.
    position: serializeVec3(body.position),
    quaternion: body.quaternion.toArray(),
    velocity: serializeVec3(body.velocity),
    angularVelocity: serializeVec3(body.angularVelocity),

    // Properties.
    id: body[ID],
    mass: body.mass,
    linearDamping: body.linearDamping,
    angularDamping: body.angularDamping,
    fixedRotation: body.fixedRotation,
    allowSleep: body.allowSleep,
    sleepSpeedLimit: body.sleepSpeedLimit,
    sleepTimeLimit: body.sleepTimeLimit
  };

  return message;
};

module.exports.deserializeBodyUpdate = function (message, body) {
  body.position.set(message.position[0], message.position[1], message.position[2]);
  body.quaternion.set(message.quaternion[0], message.quaternion[1], message.quaternion[2], message.quaternion[3]);
  body.velocity.set(message.velocity[0], message.velocity[1], message.velocity[2]);
  body.angularVelocity.set(message.angularVelocity[0], message.angularVelocity[1], message.angularVelocity[2]);

  body.linearDamping = message.linearDamping;
  body.angularDamping = message.angularDamping;
  body.fixedRotation = message.fixedRotation;
  body.allowSleep = message.allowSleep;
  body.sleepSpeedLimit = message.sleepSpeedLimit;
  body.sleepTimeLimit = message.sleepTimeLimit;

  if (body.mass !== message.mass) {
    body.mass = message.mass;
    body.updateMassProperties();
  }

  return body;
};

module.exports.deserializeBody = function (message) {
  var body = new CANNON.Body({
    mass: message.mass,

    position: deserializeVec3(message.position),
    quaternion: deserializeQuaternion(message.quaternion),
    velocity: deserializeVec3(message.velocity),
    angularVelocity: deserializeVec3(message.angularVelocity),

    linearDamping: message.linearDamping,
    angularDamping: message.angularDamping,
    fixedRotation: message.fixedRotation,
    allowSleep: message.allowSleep,
    sleepSpeedLimit: message.sleepSpeedLimit,
    sleepTimeLimit: message.sleepTimeLimit
  });

  // TODO(donmccurdy): Support for other shape types.
  for (var shape, i = 0; (shape = message.shapes[i]); i++) {
    body.addShape(
      new CANNON[shape.type](deserializeVec3(shape.halfExtents)),
      deserializeVec3(message.shapeOffsets[i]),
      deserializeQuaternion(message.shapeOrientations[i])
    );
  }

  body[ID] = message.id;

  return body;
};

/******************************************************************************
 * Constraints
 */

module.exports.serializeConstraint = function (constraint) {

  var message = {
    id: constraint[ID],
    maxForce: constraint.maxForce,
    bodyA: constraint.bodyA.id,
    bodyB: constraint.bodyB.id
  };

  if (constraint instanceof CANNON.LockConstraint) {
    message.type = 'LockConstraint';
  } else if (constraint instanceof CANNON.DistanceConstraint) {
    message.type = 'DistanceConstraint';
  } else if (constraint instanceof CANNON.HingeConstraint) {
    message.type = 'HingeConstraint';
  } else if (constraint instanceof CANNON.ConeTwistConstraint) {
    message.type = 'ConeTwistConstraint';
  } else if (constraint instanceof CANNON.PointToPointConstraint) {
    message.type = 'PointToPointConstraint';
  } else {
    throw new Error('Unexpected constraint type');
  }

  return message;
};

module.exports.deserializeConstraint = function (message) {
  throw new Error('[utils] Not implemented');
};

/******************************************************************************
 * Contacts
 */

module.exports.serializeContact = function (contact) {
  return {
    bi: contact.bi[ID],
    bj: contact.bj[ID],
    ni: serializeVec3(contact.ni),
    ri: serializeVec3(contact.ri),
    rj: serializeVec3(contact.rj)
  };
};

module.exports.deserializeContact = function (message, bodies) {
  return {
    bi: bodies[message.bi],
    bj: bodies[message.bj],
    ni: deserializeVec3(message.ni),
    ri: deserializeVec3(message.ri),
    rj: deserializeVec3(message.rj)
  };
};

/******************************************************************************
 * Math
 */

module.exports.serializeVec3 = serializeVec3;
function serializeVec3 (vec3) {
  return vec3.toArray();
}

module.exports.deserializeVec3 = deserializeVec3;
function deserializeVec3 (message) {
  return new CANNON.Vec3(message[0], message[1], message[2]);
}

module.exports.serializeQuaternion = serializeQuaternion;
function serializeQuaternion (quat) {
  return quat.toArray();
}

module.exports.deserializeQuaternion = deserializeQuaternion;
function deserializeQuaternion (message) {
  return new CANNON.Quaternion(message[0], message[1], message[2], message[3]);
}
