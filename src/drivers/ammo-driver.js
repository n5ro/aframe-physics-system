var Ammo = require('ammo.js'),
Driver = require('./driver');

Ammo().then(function(Ammo) {
  console.log("Ammo", Ammo)

  function AmmoDriver() {
    this.collisionConfiguration = null;
    this.dispatcher = null;
    this.broadphase = null;
    this.solver = null;
    this.physicsWorld = null;
    this.debugDrawer = null;
  }

  AmmoDriver.prototype = new Driver();
  AmmoDriver.prototype.constructor = AmmoDriver;

  module.exports = AmmoDriver;

  /* @param {object} worldConfig */
  AmmoDriver.prototype.init = function(worldConfig) {
    this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new Ammo.btCollisionDispatcher( this.collisionConfiguration );
    this.broadphase = new Ammo.btDbvtBroadphase();
    this.solver = new Ammo.btSequentialImpulseConstraintSolver();
    this.physicsWorld = new Ammo.btDiscreteDynamicsWorld( this.dispatcher, this.broadphase, this.solver, this.collisionConfiguration);
    this.physicsWorld.setGravity( new Ammo.btVector3( 0, worldConfig.hasOwnProperty('gravity') ? worldConfig.gravity : -9.8, 0 ) );
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
  };

  /* @param {number} deltaTime */
  AmmoDriver.prototype.step = function(deltaTime) {
    this.physicsWorld.stepSimulation(deltaTime, 10);
    if (this.debugDrawer) {
      this.debugDrawer.update();
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
      this.debugDrawer = new THREE.AmmoDebugDrawer(scene, this.physicsWorld, options);
    }
    return this.debugDrawer;
  };



});
