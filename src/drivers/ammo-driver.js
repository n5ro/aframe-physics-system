/* global THREE */
var Ammo = require('ammo.js'),
Driver = require('./driver');

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
      this.maxSubSteps = worldConfig.maxSubSteps || 4;
      this.fixedTimeStep = worldConfig.fixedTimeStep || 1 / 120;
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
  this.els[Ammo.getPointer(body)] = body.el;
};

/* @param {Ammo.btCollisionObject} body */
AmmoDriver.prototype.removeBody = function(body) {
  this.physicsWorld.removeRigidBody(body);
  delete this.els[Ammo.getPointer(body)];
};

AmmoDriver.prototype.updateBody = function(body) {
  if (this.els.hasOwnProperty(Ammo.getPointer(body))) {
    this.physicsWorld.updateSingleAabb(body);
  }

  AmmoDriver.prototype = new Driver();
  AmmoDriver.prototype.constructor = AmmoDriver;

  module.exports = AmmoDriver;

  /* @param {object} worldConfig */
  AmmoDriver.prototype.init = function(worldConfig) {
    this.epsilon = worldConfig.epsilon || EPS;  
    this.debugDrawMode = worldConfig.debugDrawMode || THREE.AmmoDebugConstants.NoDebug;
    this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new Ammo.btCollisionDispatcher( this.collisionConfiguration );
    this.broadphase = new Ammo.btDbvtBroadphase();
    this.solver = new Ammo.btSequentialImpulseConstraintSolver();
    this.physicsWorld = new Ammo.btDiscreteDynamicsWorld( this.dispatcher, this.broadphase, this.solver, this.collisionConfiguration);
    this.physicsWorld.setGravity( new Ammo.btVector3( 0, worldConfig.hasOwnProperty('gravity') ? worldConfig.gravity : -9.8, 0 ) );
    this.physicsWorld.getSolverInfo().set_m_numIterations(worldConfig.solverIterations);
  };

  // LocalDriver.prototype.getMaterial = function (name) {
  //   return this.materials[name];
  // };

  // AmmoDriver.prototype.addMaterial = function (materialConfig) {
  //   console.log('addMaterial not supported by Ammo.js', materialConfig);
  // };

  // AmmoDriver.prototype.addContactMaterial = function (matName1, matName2, contactMaterialConfig) {
  //   console.log('addContactMaterial not supported by Ammo.js', matName1, matName2, contactMaterialConfig);
  // };

  /* @param {Ammo.btCollisionObject} body */
  AmmoDriver.prototype.addBody = function(body) {
    this.physicsWorld.addRigidBody(body);
    this.els[body.ptr] = body.el;
  };

  /* @param {Ammo.btCollisionObject} body */
  AmmoDriver.prototype.removeBody = function (body) {
    this.physicsWorld.removeRigidBody(body);
    delete this.els[body.ptr];
  };

  /* @param {number} deltaTime */
  AmmoDriver.prototype.step = function(deltaTime) {
    this.physicsWorld.stepSimulation(deltaTime, 10);

    var numManifolds = this.dispatcher.getNumManifolds();
    for(var i = 0; i < numManifolds; i++) {
      var persistentManifold = this.dispatcher.getManifoldByIndexInternal(i);
      var numContacts = persistentManifold.getNumContacts();
      var manifoldPoint = persistentManifold.getContactPoint(j);
      var body0 = persistentManifold.getBody0();
      var body1 = persistentManifold.getBody1();
      var distance = manifoldPoint.getDistance();
      var key = body0.ptr + '_' + body1.ptr;
      var collided = false;
      for (var j = 0; j < numContacts; j++) {
        if (body0.ptr !== body1.ptr && distance <= this.epsilon) {
          collided = true;
          break;  
        }
      }
      if (collided && this.collisions.indexOf(key) === -1) {
        this.collisions.push(key);
        if (this.eventListeners.indexOf(body0.ptr) !== -1) {
          this.els[body0.ptr].emit('collide', {target: this.els[body1.ptr]});
        } 
        if (this.eventListeners.indexOf(body1.ptr) !== -1) {
          this.els[body1.ptr].emit('collide', {target: this.els[body0.ptr]});
        }
      } else if (!collided && this.collisions.indexOf(key) !== -1) {
        this.collisions.splice(this.collisions.indexOf(key), 1);
        if (this.eventListeners.indexOf(body0.ptr) !== -1) {
          this.els[body0.ptr].emit('collide-end', {target: this.els[body1.ptr]});
        } 
        if (this.eventListeners.indexOf(body1.ptr) !== -1) {
          this.els[body1.ptr].emit('collide-end', {target: this.els[body0.ptr]});
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
    this.eventListeners.push(body.ptr);
  };

  /* @param {Ammo.btCollisionObject} body */
  AmmoDriver.prototype.removeEventListener = function(body) {
    this.eventListeners.splice(this.eventListeners.indexOf(body.ptr), 1);
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
});
