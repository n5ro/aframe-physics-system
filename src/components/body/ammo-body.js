/* global Ammo,THREE */
var AmmoDebugDrawer = require('ammo-debug-drawer');

//Activation States
const ACTIVE_TAG = 1;
const ISLAND_SLEEPING = 2;
const WANTS_DEACTIVATION = 3;
const DISABLE_DEACTIVATION = 4;
const DISABLE_SIMULATION = 5;

//CollisionFlags
const CF_STATIC_OBJECT= 1;
const CF_KINEMATIC_OBJECT= 2;
const CF_NO_CONTACT_RESPONSE = 4;
const CF_CUSTOM_MATERIAL_CALLBACK = 8; //this allows per-triangle material (friction/restitution)
const CF_CHARACTER_OBJECT = 16;
const CF_DISABLE_VISUALIZE_OBJECT = 32; //disable debug drawing
const CF_DISABLE_SPU_COLLISION_PROCESSING = 64; //disable parallel/SPU processing

var Body = {
  schema: {
    mass: {default: 5, if: {type: 'dynamic'}},
    margin: {default: 0},
    activationState: {
      default: DISABLE_DEACTIVATION, 
      oneOf: [ACTIVE_TAG, ISLAND_SLEEPING, WANTS_DEACTIVATION, DISABLE_DEACTIVATION, DISABLE_SIMULATION]
    },
    shape: {default: 'box', oneOf: ['box', 'cylinder', 'sphere', 'hull', 'mesh', 'none']},
    cylinderAxis: {default: 'y', oneOf: ['x', 'y', 'z']},
    sphereRadius: {default: NaN},
    type: {default: 'dynamic', oneOf: ['static', 'dynamic', 'kinematic']}
  },

  /**
   * Initializes a body component, assigning it to the physics system and binding listeners for
   * parsing the elements geometry.
   */
  init: function () {
    this.system = this.el.sceneEl.systems.physics;

    if (this.el.sceneEl.hasLoaded) {
      this.initBody();
    } else {
      this.el.sceneEl.addEventListener('loaded', this.initBody.bind(this));
    }
  },

  /**
   * Parses an element's geometry and component metadata to create a CANNON.Body instance for the
   * component.
   */
  initBody: function () {
    var el = this.el,
        data = this.data;

    var obj = this.el.object3D;
    var pos = obj.position;
    var quat = obj.quaternion;

    this.msTransform = new Ammo.btTransform();
    this.msTransform.setIdentity();
    this.vector3 = new Ammo.btVector3(pos.x, pos.y, pos.z);
    this.quaternion = new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w);
    this.msTransform.setOrigin(this.vector3);
    this.msTransform.setRotation(this.quaternion);
    this.motionState = new Ammo.btDefaultMotionState( this.msTransform );
    this.localInertia = new Ammo.btVector3( 0, 0, 0 );

    this.debugDrawer = this.system.driver.getDebugDrawer(this.el.sceneEl.object3D);
    this.debugDrawer.enable();

    switch (this.data.shape) {
      case 'box':
        var box = new THREE.Box3();

        var clone = obj.clone();
        clone.quaternion.set(0, 0, 0, 1);
        clone.updateMatrixWorld();

        box.setFromObject(clone);

        if (!isFinite(box.min.lengthSq())) return null;

        this.halfExtents = new Ammo.btVector3( 
          (box.max.x - box.min.x) / 2, 
          (box.max.y - box.min.y) / 2, 
          (box.max.z - box.min.z) / 2
        );
        this.physicsShape = new Ammo.btBoxShape( this.halfExtents );
        break;

      default:
        console.warning(this.data.shape + ' is currently unsupported');
        break;
    }

    this.physicsShape.setMargin( this.data.margin );

    if (this.data.mass > 0)
      this.physicsShape.calculateLocalInertia( this.data.mass, this.localInertia );

    this.rbInfo = new Ammo.btRigidBodyConstructionInfo(this.data.mass, this.motionState, this.physicsShape, this.localInertia);
    this.body = new Ammo.btRigidBody(this.rbInfo);
    this.body.setActivationState( this.data.activationState );

    switch (this.data.type) {
      case 'static':
        this.body.setCollisionFlags(CF_STATIC_OBJECT);
        break;
      case 'kinematic':
        this.body.setCollisionFlags(CF_KINEMATIC_OBJECT);
        break;
      default:
        break;
    }
    
    this.system.addBody( this.body );

    this.isLoaded = true;

    // Matrix World must be updated at root level, if scale is to be applied – updateMatrixWorld()
    // only checks an object's parent, not the rest of the ancestors. Hence, a wrapping entity with
    // scale="0.5 0.5 0.5" will be ignored.
    // Reference: https://github.com/mrdoob/three.js/blob/master/src/core/Object3D.js#L511-L541
    // Potential fix: https://github.com/mrdoob/three.js/pull/7019
    this.el.object3D.updateMatrixWorld(true);

    this.el.body = this.body;
    this.body.el = el;

    // If component wasn't initialized when play() was called, finish up.
    if (this.isPlaying) {
      this._play();
    }

    this.el.emit('body-loaded', {body: this.el.body});
  },

  tick: function () {
  },

  /**
   * Registers the component with the physics system, if ready.
   */
  play: function () {
    if (this.isLoaded) this._play();
  },

  /**
   * Internal helper to register component with physics system.
   */
  _play: function () {
    this.syncToPhysics();
    this.system.addComponent(this);
    this.system.addBody(this.body);
  },

  /**
   * Unregisters the component with the physics system.
   */
  pause: function () {
    if (this.isLoaded) this._pause();
  },

  _pause: function () {
    this.system.removeComponent(this);
    if (this.body) this.system.removeBody(this.body);
  },

  /**
   * Updates the CANNON.Body instance, where possible.
   */
  update: function (prevData) {
    if (!this.body) return;

    var data = this.data;
  },

  /**
   * Removes the component and all physics and scene side effects.
   */
  remove: function () {
    if (this.body) {
      delete this.body.el;
      delete this.body;
    }

    //TODO: delete these
    // this.msTransform = new Ammo.btTransform();
    // this.msTransform.setIdentity();
    // this.vector3 = new Ammo.btVector3(pos.x, pos.y, pos.z);
    // this.quaternion = new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w);
    // this.msTransform.setOrigin(vector3);
    // this.msTransform.setRotation(quaternion);
    // this.motionState = new Ammo.btDefaultMotionState( this.msTransform );
    // this.localInertia = new Ammo.btVector3( 0, 0, 0 );
  },

  beforeStep: function () {
    if (this.data.mass !== 'dynamic') {
      this.syncToPhysics();
    }
  },

  step: function () {
    if (this.data.type === 'dynamic') {
      this.syncFromPhysics();
    }
  },

  /**
   * Updates the CANNON.Body instance's position, velocity, and rotation, based on the scene.
   */
  syncToPhysics: (function () {
    var q =  new THREE.Quaternion(),
        v = new THREE.Vector3();
    return function () {
      var el = this.el,
          parentEl = el.parentEl,
          body = this.body;

      if (!body) return;

      if (el.components.velocity) body.velocity.copy(el.getAttribute('velocity'));

      if (parentEl.isScene) {
        var pos = el.object3D.position;
        var quat = el.object3D.quaternion;
        this.vector3.setValue(pos.x, pos.y, pos.z);
        this.msTransform.setOrigin(this.vector3);
        this.quaternion.setValue(quat.x, quat.y, quat.z, quat.w);
        this.msTransform.setRotation(this.quaternion);
        this.motionState.setWorldTransform(this.msTransform);
        body.setWorldTransform(this.msTransform);
      } else {
        // el.object3D.getWorldQuaternion(q);
        // body.quaternion.copy(q);
        // el.object3D.getWorldPosition(v);
        // body.position.copy(v);
      }

    };
  }()),

  /**
   * Updates the scene object's position and rotation, based on the physics simulation.
   */
  syncFromPhysics: (function () {
    var v = new THREE.Vector3(),
        q1 = new THREE.Quaternion(),
        q2 = new THREE.Quaternion();

    return function () {
      this.motionState.getWorldTransform(this.msTransform);
      var position = this.msTransform.getOrigin();
      var quaternion = this.msTransform.getRotation();

      var el = this.el,
          parentEl = el.parentEl,
          body = this.body;

      if (!body) return;
      if (!parentEl) return;

      if (parentEl.isScene) {
        el.object3D.position.set(position.x(), position.y(), position.z());
        el.object3D.quaternion.set(quaternion.x(), quaternion.y(), quaternion.z(), quaternion.w());
      } else {
        // TODO - Nested rotation doesn't seem to be working as expected.
        q1.set(quaternion.x(), quaternion.y(), quaternion.z(), quaternion.w());
        parentEl.object3D.getWorldQuaternion(q2);
        q1.multiply(q2.inverse());
        el.object3D.quaternion.copy(q1);

        v.set(position.x(), position.y(), position.z());
        parentEl.object3D.worldToLocal(v);
        el.object3D.position.copy(v);
      }
    };
  }())
};

module.exports.definition = Body;
module.exports.Component = AFRAME.registerComponent('ammo-body', Body);
