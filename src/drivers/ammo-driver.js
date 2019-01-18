/* global THREE */
var Driver = require('./driver');
window.AmmoModule = window.Ammo;
window.Ammo = null;

const EPS = 10e-6;

function AmmoDriver() {
  this.collisionConfiguration = null;
  this.dispatcher = null;
  this.broadphase = null;
  this.solver = null;
  this.physicsWorld = null;
  this.debugDrawer = null;

  this.els = {};
  this.eventListeners = [];
  this.collisions = [];
}

AmmoDriver.prototype = new Driver();
AmmoDriver.prototype.constructor = AmmoDriver;

module.exports = AmmoDriver;

/* @param {object} worldConfig */
AmmoDriver.prototype.init = function(worldConfig) {
  return new Promise(resolve => {
    AmmoModule().then(result => {
      Ammo = result;
      this.epsilon = worldConfig.epsilon || EPS;  
      this.debugDrawMode = worldConfig.debugDrawMode || THREE.AmmoDebugConstants.NoDebug;
      this.maxSubSteps = worldConfig.maxSubSteps || 10;
      this.fixedTimeStep = worldConfig.fixedTimeStep || 1/60;
      this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
      this.dispatcher = new Ammo.btCollisionDispatcher( this.collisionConfiguration );
      this.broadphase = new Ammo.btDbvtBroadphase();
      this.solver = new Ammo.btSequentialImpulseConstraintSolver();
      this.physicsWorld = new Ammo.btDiscreteDynamicsWorld( this.dispatcher, this.broadphase, this.solver, this.collisionConfiguration);
      this.physicsWorld.setGravity( new Ammo.btVector3( 0, worldConfig.hasOwnProperty('gravity') ? worldConfig.gravity : -9.8, 0 ) );
      this.physicsWorld.getSolverInfo().set_m_numIterations(worldConfig.solverIterations);
      resolve();
    });
  });
};

/* @param {Ammo.btCollisionObject} body */
AmmoDriver.prototype.addBody = function(body, group, mask) {
  this.physicsWorld.addRigidBody(body, group, mask);
  this.els[Ammo.getPointer(body)] = body.el;
};

/* @param {Ammo.btCollisionObject} body */
AmmoDriver.prototype.removeBody = function (body) {
  this.physicsWorld.removeRigidBody(body);
  delete this.els[Ammo.getPointer(body)];
};

AmmoDriver.prototype.updateBody = function (body) {
  if (this.els.hasOwnProperty(Ammo.getPointer(body))) {
    this.physicsWorld.updateSingleAabb(body);
  }
}

/* @param {number} deltaTime */
AmmoDriver.prototype.step = function(deltaTime) {
  this.physicsWorld.stepSimulation(deltaTime, this.maxSubSteps, this.fixedTimeStep);

  var numManifolds = this.dispatcher.getNumManifolds();
  for(var i = 0; i < numManifolds; i++) {
    var persistentManifold = this.dispatcher.getManifoldByIndexInternal(i);
    var numContacts = persistentManifold.getNumContacts();
    var manifoldPoint = persistentManifold.getContactPoint(j);
    var body0 = persistentManifold.getBody0();
    var body1 = persistentManifold.getBody1();
    var distance = manifoldPoint.getDistance();
    var key = Ammo.getPointer(body0) + '_' + Ammo.getPointer(body1);
    var collided = false;
    for (var j = 0; j < numContacts; j++) {
      if (Ammo.getPointer(body0) !== Ammo.getPointer(body1) && distance <= this.epsilon) {
        collided = true;
        break;  
      }
    }
    if (collided && this.collisions.indexOf(key) === -1) {
      this.collisions.push(key);
      if (this.eventListeners.indexOf(Ammo.getPointer(body0)) !== -1) {
        this.els[Ammo.getPointer(body0)].emit('collide', {targetEl: this.els[Ammo.getPointer(body1)]});
      } 
      if (this.eventListeners.indexOf(Ammo.getPointer(body1)) !== -1) {
        this.els[Ammo.getPointer(body1)].emit('collide', {targetEl: this.els[Ammo.getPointer(body0)]});
      }
    } else if (!collided && this.collisions.indexOf(key) !== -1) {
      this.collisions.splice(this.collisions.indexOf(key), 1);
      if (this.eventListeners.indexOf(Ammo.getPointer(body0)) !== -1) {
        this.els[Ammo.getPointer(body0)].emit('collide-end', {targetEl: this.els[Ammo.getPointer(body1)]});
      } 
      if (this.eventListeners.indexOf(Ammo.getPointer(body1)) !== -1) {
        this.els[Ammo.getPointer(body1)].emit('collide-end', {targetEl: this.els[Ammo.getPointer(body0)]});
      }
    }
  }

  if (this.debugDrawer) {
    this.debugDrawer.update();
  }
};

/* @param {?} constraint */
AmmoDriver.prototype.addConstraint = function(constraint) {
  this.physicsWorld.addConstraint(constraint, false);
};

/* @param {?} constraint */
AmmoDriver.prototype.removeConstraint = function (constraint) {
  this.physicsWorld.removeConstraint(constraint);
};


/* @param {Ammo.btCollisionObject} body */
AmmoDriver.prototype.addEventListener = function(body) {
  this.eventListeners.push(Ammo.getPointer(body));
};

/* @param {Ammo.btCollisionObject} body */
AmmoDriver.prototype.removeEventListener = function(body) {
  this.eventListeners.splice(this.eventListeners.indexOf(Ammo.getPointer(body)), 1);
};

AmmoDriver.prototype.destroy = function() {
  Ammo.destroy(this.collisionConfiguration);
  Ammo.destroy(this.dispatcher);
  Ammo.destroy(this.broadphase);
  Ammo.destroy(this.solver);
  Ammo.destroy(this.physicsWorld);
  Ammo.destroy(this.debugDrawer);
};

/** 
 * @param {THREE.Scene} scene 
 * @param {object} options
*/
AmmoDriver.prototype.getDebugDrawer = function(scene, options) {
  if (!this.debugDrawer) {
    options = options || {};
    options.debugDrawMode = options.debugDrawMode || this.debugDrawMode;
    this.debugDrawer = new THREE.AmmoDebugDrawer(scene, this.physicsWorld, options);
  }
  return this.debugDrawer;
};
