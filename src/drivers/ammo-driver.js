/* global THREE */
const Driver = require('./driver');
const Pool = require('../utils/pool');

if (typeof window !== 'undefined') {
  window.AmmoModule = window.Ammo;
  window.Ammo = null;
}

const EPS = 10e-6;

function AmmoDriver() {
  this.collisionConfiguration = null;
  this.dispatcher = null;
  this.broadphase = null;
  this.solver = null;
  this.physicsWorld = null;
  this.debugDrawer = null;

  this.els = new Map();
  this.eventListeners = new Set();

  /** Collision mapping (collision key to body pointer pair) from previous step. */
  this.prevCollisions = {};

  // Resource pools for temporary objects.
  this.objectPool = new Pool(() => ({}), (map) => {
    for (let k in map) delete map[k];
  });
  this.arrayPool = new Pool(() => ([]), (pair) => {
    pair.length = 0;
  });
}

AmmoDriver.prototype = new Driver();
AmmoDriver.prototype.constructor = AmmoDriver;

module.exports = AmmoDriver;

/* @param {object} worldConfig */
AmmoDriver.prototype.init = function(worldConfig) {
  //Emscripten doesn't use real promises, just a .then() callback, so it necessary to wrap in a real promise.
  return new Promise(resolve => {
    AmmoModule().then(result => {
      Ammo = result;
      this.epsilon = worldConfig.epsilon || EPS;
      this.debugDrawMode = worldConfig.debugDrawMode || THREE.AmmoDebugConstants.NoDebug;
      this.maxSubSteps = worldConfig.maxSubSteps || 4;
      this.fixedTimeStep = worldConfig.fixedTimeStep || 1 / 60;
      this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
      this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
      this.broadphase = new Ammo.btDbvtBroadphase();
      this.solver = new Ammo.btSequentialImpulseConstraintSolver();
      this.physicsWorld = new Ammo.btDiscreteDynamicsWorld(
        this.dispatcher,
        this.broadphase,
        this.solver,
        this.collisionConfiguration
      );
      this.physicsWorld.setForceUpdateAllAabbs(false);
      this.physicsWorld.setGravity(
        new Ammo.btVector3(0, worldConfig.hasOwnProperty("gravity") ? worldConfig.gravity : -9.8, 0)
      );
      this.physicsWorld.getSolverInfo().set_m_numIterations(worldConfig.solverIterations);
      resolve();
    });
  });
};

/* @param {Ammo.btCollisionObject} body */
AmmoDriver.prototype.addBody = function(body, group, mask) {
  this.physicsWorld.addRigidBody(body, group, mask);
  this.els.set(Ammo.getPointer(body), body.el);
};

/* @param {Ammo.btCollisionObject} body */
AmmoDriver.prototype.removeBody = function(body) {
  this.physicsWorld.removeRigidBody(body);
  this.removeEventListener(body);
  const bodyptr = Ammo.getPointer(body);
  this.els.delete(bodyptr);
};

AmmoDriver.prototype.updateBody = function(body) {
  if (this.els.has(Ammo.getPointer(body))) {
    this.physicsWorld.updateSingleAabb(body);
  }
};

/* @param {number} deltaTime */
AmmoDriver.prototype.step = function(deltaTime) {
  this.physicsWorld.stepSimulation(deltaTime, this.maxSubSteps, this.fixedTimeStep);

  const collisions = this.objectPool.obtain();
  const prevCollisions = this.prevCollisions;

  const numManifolds = this.dispatcher.getNumManifolds();
  for (let i = 0; i < numManifolds; i++) {
    const persistentManifold = this.dispatcher.getManifoldByIndexInternal(i);
    const numContacts = persistentManifold.getNumContacts();
    const body0ptr = Ammo.getPointer(persistentManifold.getBody0());
    const body1ptr = Ammo.getPointer(persistentManifold.getBody1());
    const collisionKey = body0ptr + ':' + body1ptr;
    let collided = false;

    for (let j = 0; j < numContacts; j++) {
      const manifoldPoint = persistentManifold.getContactPoint(j);
      const distance = manifoldPoint.getDistance();
      if (distance <= this.epsilon) {
        collided = true;
        break;
      }
    }

    if (collided) {
      if (prevCollisions[collisionKey]) {
        collisions[collisionKey] = prevCollisions[collisionKey];
      } else {
        collisions[collisionKey] = this.arrayPool.obtain();
        collisions[collisionKey].push(body0ptr, body1ptr);
      }
    }
  }

  const diffCollisions = this.objectPool.obtain();
  AFRAME.utils.diff(prevCollisions, collisions, diffCollisions);

  for (let key in diffCollisions) {
    if (!diffCollisions.hasOwnProperty(key)) continue;
    if (!prevCollisions[key] && collisions[key]) {
      const body0ptr = collisions[key][0];
      const body1ptr = collisions[key][1];
      if (this.eventListeners.has(body0ptr)) {
        this.els.get(body0ptr).emit('collidestart', { targetEl: this.els.get(body1ptr) });
      }
      if (this.eventListeners.has(body1ptr)) {
        this.els.get(body1ptr).emit('collidestart', { targetEl: this.els.get(body0ptr) });
      }
    } else if (prevCollisions[key] && !collisions[key]) {
      const body0ptr = prevCollisions[key][0];
      const body1ptr = prevCollisions[key][1];
      if (this.eventListeners.has(body0ptr)) {
        this.els.get(body0ptr).emit('collideend', { targetEl: this.els.get(body1ptr) });
      }
      if (this.eventListeners.has(body1ptr)) {
        this.els.get(body1ptr).emit('collideend', { targetEl: this.els.get(body0ptr) });
      }
      this.arrayPool.recycle(prevCollisions[key]);
    }
  }

  this.objectPool.recycle(prevCollisions);
  this.objectPool.recycle(diffCollisions);
  this.prevCollisions = collisions;

  if (this.debugDrawer) {
    this.debugDrawer.update();
  }
};

/* @param {?} constraint */
AmmoDriver.prototype.addConstraint = function(constraint) {
  this.physicsWorld.addConstraint(constraint, false);
};

/* @param {?} constraint */
AmmoDriver.prototype.removeConstraint = function(constraint) {
  this.physicsWorld.removeConstraint(constraint);
};

/* @param {Ammo.btCollisionObject} body */
AmmoDriver.prototype.addEventListener = function(body) {
  this.eventListeners.add(Ammo.getPointer(body));
};

/* @param {Ammo.btCollisionObject} body */
AmmoDriver.prototype.removeEventListener = function(body) {
  const ptr = Ammo.getPointer(body);
  if (this.eventListeners.has(ptr)) {
    this.eventListeners.delete(ptr);
  }
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
