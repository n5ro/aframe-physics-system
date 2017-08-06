var CANNON = require('cannon');
var mathUtils = require('./math');

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
    shapes: body.shapes.map(serializeShape),
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

module.exports.deserializeInterpBodyUpdate = function (message1, message2, body, mix) {
  var weight1 = 1 - mix;
  var weight2 = mix;

  body.position.set(
    message1.position[0] * weight1 + message2.position[0] * weight2,
    message1.position[1] * weight1 + message2.position[1] * weight2,
    message1.position[2] * weight1 + message2.position[2] * weight2
  );
  var quaternion = mathUtils.slerp(message1.quaternion, message2.quaternion, mix);
  body.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
  body.velocity.set(
    message1.velocity[0] * weight1 + message2.velocity[0] * weight2,
    message1.velocity[1] * weight1 + message2.velocity[1] * weight2,
    message1.velocity[2] * weight1 + message2.velocity[2] * weight2
  );
  body.angularVelocity.set(
    message1.angularVelocity[0] * weight1 + message2.angularVelocity[0] * weight2,
    message1.angularVelocity[1] * weight1 + message2.angularVelocity[1] * weight2,
    message1.angularVelocity[2] * weight1 + message2.angularVelocity[2] * weight2
  );

  body.linearDamping = message2.linearDamping;
  body.angularDamping = message2.angularDamping;
  body.fixedRotation = message2.fixedRotation;
  body.allowSleep = message2.allowSleep;
  body.sleepSpeedLimit = message2.sleepSpeedLimit;
  body.sleepTimeLimit = message2.sleepTimeLimit;

  if (body.mass !== message2.mass) {
    body.mass = message2.mass;
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

  for (var shapeMsg, i = 0; (shapeMsg = message.shapes[i]); i++) {
    body.addShape(
      deserializeShape(shapeMsg),
      deserializeVec3(message.shapeOffsets[i]),
      deserializeQuaternion(message.shapeOrientations[i])
    );
  }

  body[ID] = message.id;

  return body;
};

/******************************************************************************
 * Shapes
 */

module.exports.serializeShape = serializeShape;
function serializeShape (shape) {
  var shapeMsg = {type: shape.type};
  if (shape.type === CANNON.Shape.types.BOX) {
    shapeMsg.halfExtents = serializeVec3(shape.halfExtents);

  } else if (shape.type === CANNON.Shape.types.SPHERE) {
    shapeMsg.radius = shape.radius;

  // Patch schteppe/cannon.js#329.
  } else if (shape._type === CANNON.Shape.types.CYLINDER) {
    shapeMsg.type = CANNON.Shape.types.CYLINDER;
    shapeMsg.radiusTop = shape.radiusTop;
    shapeMsg.radiusBottom = shape.radiusBottom;
    shapeMsg.height = shape.height;
    shapeMsg.numSegments = shape.numSegments;

  } else {
    // TODO(donmccurdy): Support for other shape types.
    throw new Error('Unimplemented shape type: %s', shape.type);
  }
  return shapeMsg;
}

module.exports.deserializeShape = deserializeShape;
function deserializeShape (message) {
  var shape;

  if (message.type === CANNON.Shape.types.BOX) {
    shape = new CANNON.Box(deserializeVec3(message.halfExtents));

  } else if (message.type === CANNON.Shape.types.SPHERE) {
    shape = new CANNON.Sphere(message.radius);

  // Patch schteppe/cannon.js#329.
  } else if (message.type === CANNON.Shape.types.CYLINDER) {
    shape = new CANNON.Cylinder(message.radiusTop, message.radiusBottom, message.height, message.numSegments);
    shape._type = CANNON.Shape.types.CYLINDER;

  } else {
    // TODO(donmccurdy): Support for other shape types.
    throw new Error('Unimplemented shape type: %s', message.type);
  }

  return shape;
}

/******************************************************************************
 * Constraints
 */

module.exports.serializeConstraint = function (constraint) {

  var message = {
    id: constraint[ID],
    type: constraint.type,
    maxForce: constraint.maxForce,
    bodyA: constraint.bodyA[ID],
    bodyB: constraint.bodyB[ID]
  };

  switch (constraint.type) {
    case 'LockConstraint':
      break;
    case 'DistanceConstraint':
      message.distance = constraint.distance;
      break;
    case 'HingeConstraint':
    case 'ConeTwistConstraint':
      message.axisA = serializeVec3(constraint.axisA);
      message.axisB = serializeVec3(constraint.axisB);
      message.pivotA = serializeVec3(constraint.pivotA);
      message.pivotB = serializeVec3(constraint.pivotB);
      break;
    case 'PointToPointConstraint':
      message.pivotA = serializeVec3(constraint.pivotA);
      message.pivotB = serializeVec3(constraint.pivotB);
      break;
    default:
      throw new Error(''
        + 'Unexpected constraint type: ' + constraint.type + '. '
        + 'You may need to manually set `constraint.type = "FooConstraint";`.'
      );
  }

  return message;
};

module.exports.deserializeConstraint = function (message, bodies) {
  var TypedConstraint = CANNON[message.type];
  var bodyA = bodies[message.bodyA];
  var bodyB = bodies[message.bodyB];

  var constraint;

  switch (message.type) {
    case 'LockConstraint':
      constraint = new CANNON.LockConstraint(bodyA, bodyB, message);
      break;

    case 'DistanceConstraint':
      constraint = new CANNON.DistanceConstraint(
        bodyA,
        bodyB,
        message.distance,
        message.maxForce
      );
      break;

    case 'HingeConstraint':
    case 'ConeTwistConstraint':
      constraint = new TypedConstraint(bodyA, bodyB, {
        pivotA: deserializeVec3(message.pivotA),
        pivotB: deserializeVec3(message.pivotB),
        axisA: deserializeVec3(message.axisA),
        axisB: deserializeVec3(message.axisB),
        maxForce: message.maxForce
      });
      break;

    case 'PointToPointConstraint':
      constraint = new CANNON.PointToPointConstraint(
        bodyA,
        deserializeVec3(message.pivotA),
        bodyB,
        deserializeVec3(message.pivotB),
        message.maxForce
      );
      break;

    default:
      throw new Error('Unexpected constraint type: ' + message.type);
  }

  constraint[ID] = message.id;
  return constraint;
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
