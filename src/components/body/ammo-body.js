/* global Ammo,THREE */
const AmmoDebugDrawer = require("ammo-debug-drawer");
const threeToAmmo = require("three-to-ammo");

//Activation States
const ACTIVE_TAG = 1;
const ISLAND_SLEEPING = 2;
const WANTS_DEACTIVATION = 3;
const DISABLE_DEACTIVATION = 4;
const DISABLE_SIMULATION = 5;

//CollisionFlags
const CF_STATIC_OBJECT = 1;
const CF_KINEMATIC_OBJECT = 2;
const CF_NO_CONTACT_RESPONSE = 4;
const CF_CUSTOM_MATERIAL_CALLBACK = 8; //this allows per-triangle material (friction/restitution)
const CF_CHARACTER_OBJECT = 16;
const CF_DISABLE_VISUALIZE_OBJECT = 32; //disable debug drawing
const CF_DISABLE_SPU_COLLISION_PROCESSING = 64; //disable parallel/SPU processing

function almostEquals(epsilon, u, v) {
  return Math.abs(u.x - v.x) < epsilon && Math.abs(u.y - v.y) < epsilon && Math.abs(u.z - v.z) < epsilon;
}

let AmmoBody = {
  schema: {
    loadedEvent: { default: "" },
    mass: { default: 1 },
    gravity: { type: "vec3", default: { x: 0, y: -9.8, z: 0 } },
    linearDamping: { default: 0.01 },
    angularDamping: { default: 0.01 },
    angularFactor: { type: "vec3", default: { x: 1, y: 1, z: 1 } },
    activationState: {
      default: DISABLE_DEACTIVATION,
      oneOf: [ACTIVE_TAG, ISLAND_SLEEPING, WANTS_DEACTIVATION, DISABLE_DEACTIVATION, DISABLE_SIMULATION]
    },
    type: { default: "dynamic", oneOf: ["static", "dynamic", "kinematic"] },
    addCollideEventListener: { default: false },
    collisionFlags: { default: 0 }, //32-bit mask
    collisionFilterGroup: { default: 1 }, //32-bit mask,
    collisionFilterMask: { default: 1 }, //32-bit mask
    autoUpdateScale: { default: true }
  },

  /**
   * Initializes a body component, assigning it to the physics system and binding listeners for
   * parsing the elements geometry.
   */
  init: function() {
    this.system = this.el.sceneEl.systems.physics;
    this.shapeComponents = [];

    if (this.data.loadedEvent === "") {
      this.loadedEventFired = true;
    } else {
      this.el.addEventListener(
        this.data.loadedEvent,
        () => {
          this.loadedEventFired = true;
        },
        { once: true }
      );
    }

    if (this.system.initialized && this.loadedEventFired) {
      this.initBody();
    }
  },

  /**
   * Parses an element's geometry and component metadata to create an Ammo body instance for the
   * component.
   */
  initBody: (function() {
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const boundingBox = new THREE.Box3();

    return function() {
      const el = this.el,
        data = this.data;

      this.localScaling = new Ammo.btVector3();

      const obj = this.el.object3D;
      obj.getWorldPosition(pos);
      obj.getWorldQuaternion(quat);

      this.prevObjScale = new THREE.Vector3(1, 1, 1);
      this.prevMeshScale = new THREE.Vector3(1, 1, 1);
      this.prevNumChildShapes = 0;

      this.msTransform = new Ammo.btTransform();
      this.msTransform.setIdentity();
      this.rotation = new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w);

      this.msTransform.getOrigin().setValue(pos.x, pos.y, pos.z);
      this.msTransform.setRotation(this.rotation);

      this.motionState = new Ammo.btDefaultMotionState(this.msTransform);

      this.localInertia = new Ammo.btVector3(0, 0, 0);

      this.compoundShape = new Ammo.btCompoundShape(true);

      this.rbInfo = new Ammo.btRigidBodyConstructionInfo(
        data.mass,
        this.motionState,
        this.compoundShape,
        this.localInertia
      );
      this.body = new Ammo.btRigidBody(this.rbInfo);
      this.body.setActivationState(data.activationState);

      this.body.setDamping(data.linearDamping, data.angularDamping);

      let angularFactor = new Ammo.btVector3(data.angularFactor.x, data.angularFactor.y, data.angularFactor.z);
      this.body.setAngularFactor(angularFactor);
      Ammo.destroy(angularFactor);

      this.body.getGravity().setValue(data.gravity.x, data.gravity.y, data.gravity.z);

      this.updateCollisionFlags();

      this.el.body = this.body;
      this.body.el = el;

      this.isLoaded = true;

      this.el.emit("body-loaded", { body: this.el.body });

      this._addToSystem();
    };
  })(),

  tick: function() {
    if (!this.system.initialized || !this.loadedEventFired) {
      return;
    } else if (this.system.initialized && !this.isLoaded && this.loadedEventFired) {
      this.initBody();
    }

    let updated = false;

    const mesh = this.el.object3DMap.mesh;
    if (
      mesh &&
      this.data.autoUpdateScale &&
      this.prevMeshScale &&
      !almostEquals(0.001, mesh.scale, this.prevMeshScale)
    ) {
      this.prevMeshScale.copy(mesh.scale);
      updated = true;
    }

    const obj = this.el.object3D;
    if (
      obj !== mesh &&
      this.data.autoUpdateScale &&
      this.prevObjScale &&
      !almostEquals(0.001, obj.scale, this.prevObjScale)
    ) {
      this.prevObjScale.copy(obj.scale);
      updated = true;
    }

    if (this.shapeComponentsChanged) {
      this.shapeComponentsChanged = false;
      updated = true;
    }

    if (updated) {
      this.localScaling.setValue(
        this.prevObjScale.x * this.prevMeshScale.x,
        this.prevObjScale.y * this.prevMeshScale.y,
        this.prevObjScale.z * this.prevMeshScale.z
      );
      this.compoundShape.setLocalScaling(this.localScaling);

      for (let i = 0; i < this.shapeComponents.length; i++) {
        const shapeComponent = this.shapeComponents[i];
        if (!shapeComponent.getShape()) {
          this._createCollisionShape(shapeComponent);
        }
        const collisionShape = shapeComponent.getShape();
        if (!collisionShape.added) {
          this.compoundShape.addChildShape(shapeComponent.getLocalTransform(), collisionShape);
          collisionShape.added = true;
        }

        if (shapeComponent.data.type !== "mesh") {
          //dynamic scaling of meshes not supported
          shapeComponent.getShape().setLocalScaling(this.localScaling);
        }
      }

      if (this.data.type === "dynamic") {
        this.updateMass();
      }

      this.system.driver.updateBody(this.body);
    }

    //call initializePolyhedralFeatures for hull shapes if debug is turned on and/or scale changes
    if (this.system.debug && (updated || !this.polyHedralFeaturesInitialized)) {
      for (let i = 0; i < this.shapeComponents.length; i++) {
        const shape = this.shapeComponents[i].getShape();
        if (shape.type === "hull") {
          shape.initializePolyhedralFeatures(0);
        }
      }
      this.polyHedralFeaturesInitialized = true;
    }
  },

  _createCollisionShape: function(shapeComponent) {
    const data = shapeComponent.data;

    const localTransform = new Ammo.btTransform();
    localTransform.setIdentity();
    localTransform.getOrigin().setValue(data.offset.x, data.offset.y, data.offset.z);

    this.rotation.setValue(data.orientation.x, data.orientation.y, data.orientation.z, data.orientation.w);
    localTransform.setRotation(this.rotation);

    const collisionShape = threeToAmmo.createCollisionShape(shapeComponent.getMesh(), data);
    shapeComponent.setShape(collisionShape, localTransform);
    return { collisionShape: collisionShape, localTransform: localTransform };
  },

  /**
   * Registers the component with the physics system.
   */
  play: function() {
    if (this.isLoaded) {
      this._addToSystem();
    }
  },

  _addToSystem: function() {
    if (!this.addedToSystem) {
      this.system.addBody(this.body, this.data.collisionFilterGroup, this.data.collisionFilterMask);

      if (this.data.addCollideEventListener) {
        this.system.driver.addEventListener(this.body);
      }

      this.system.addComponent(this);
      this.addedToSystem = true;
    }
  },

  /**
   * Unregisters the component with the physics system.
   */
  pause: function() {
    if (this.addedToSystem) {
      this.system.removeComponent(this);

      if (this.data.addCollideEventListener) {
        this.system.driver.removeEventListener(this.body);
      }
      this.system.removeBody(this.body);
      this.addedToSystem = false;
    }
  },

  /**
   * Updates the rigid body instance, where possible.
   */
  update: function(prevData) {
    if (this.isLoaded) {
      if (prevData.type !== this.data.type) {
        this.updateCollisionFlags();
      }

      //TODO: support dynamic update for other properties

      if (prevData.collisionFilterGroup !== this.data.collisionFilterGroup) {
        this.body.getBroadphaseProxy().set_m_collisionFilterGroup(this.data.collisionFilterGroup);
      }

      if (prevData.collisionFilterMask !== this.data.collisionFilterMask) {
        this.body.getBroadphaseProxy().set_m_collisionFilterMask(this.data.collisionFilterMask);
      }
    }
  },

  /**
   * Removes the component and all physics and scene side effects.
   */
  remove: function() {
    if (this.triMesh) Ammo.destroy(this.triMesh);
    if (this.localScaling) Ammo.destroy(this.localScaling);
    if (this.compoundShape) Ammo.destroy(this.compoundShape);
    if (this.body) {
      Ammo.destroy(this.body);
      delete this.body;
    }
    Ammo.destroy(this.rbInfo);
    Ammo.destroy(this.msTransform);
    Ammo.destroy(this.motionState);
    Ammo.destroy(this.localInertia);
    Ammo.destroy(this.rotation);
  },

  beforeStep: function() {
    if (this.data.type !== "dynamic") {
      this.syncToPhysics();
    }
  },

  step: function() {
    if (this.data.type === "dynamic") {
      this.syncFromPhysics();
    }
  },

  /**
   * Updates the rigid body's position, velocity, and rotation, based on the scene.
   */
  syncToPhysics: (function() {
    let q = new THREE.Quaternion(),
      v = new THREE.Vector3();
    return function() {
      let el = this.el,
        parentEl = el.parentEl,
        body = this.body;

      if (!body) return;

      if (this.data.shape === "mesh") {
        //dynamic translations and rotations not currently supported for meshes
        return;
      }

      this.motionState.getWorldTransform(this.msTransform);

      if (parentEl.isScene) {
        v.copy(el.object3D.position);
        q.copy(el.object3D.quaternion);
      } else {
        el.object3D.getWorldPosition(v);
        el.object3D.getWorldQuaternion(q);
      }

      if (this.data.type === "kinematic") {
        this.msTransform.getOrigin().setValue(v.x, v.y, v.z);
      }
      this.rotation.setValue(q.x, q.y, q.z, q.w);
      this.msTransform.setRotation(this.rotation);
      this.motionState.setWorldTransform(this.msTransform);
    };
  })(),

  /**
   * Updates the scene object's position and rotation, based on the physics simulation.
   */
  syncFromPhysics: (function() {
    let v = new THREE.Vector3(),
      q1 = new THREE.Quaternion(),
      q2 = new THREE.Quaternion();
    let x = (y = z = 0);
    return function() {
      this.motionState.getWorldTransform(this.msTransform);
      let position = this.msTransform.getOrigin();
      let quaternion = this.msTransform.getRotation();

      let el = this.el,
        parentEl = el.parentEl,
        body = this.body;

      if (!body) return;
      if (!parentEl) return;

      if (parentEl.isScene) {
        el.object3D.position.set(position.x(), position.y(), position.z());
        el.object3D.quaternion.set(quaternion.x(), quaternion.y(), quaternion.z(), quaternion.w());
      } else {
        q1.set(quaternion.x(), quaternion.y(), quaternion.z(), quaternion.w());
        parentEl.object3D.getWorldQuaternion(q2);
        q1.multiply(q2.inverse());
        el.object3D.quaternion.copy(q1);

        v.set(position.x(), position.y(), position.z());
        parentEl.object3D.worldToLocal(v);
        el.object3D.position.copy(v);
      }
    };
  })(),

  addShape: function(shapeComponent) {
    if (shapeComponent.data.type === "mesh" && this.data.type !== "static") {
      console.warn("non-static mesh colliders not supported");
      return;
    }

    this.shapeComponents.push(shapeComponent);
    this.shapeComponentsChanged = true;
  },

  removeShape: function(shapeComponent) {
    const index = this.shapeComponents.indexOf(shapeComponent);
    if (this.compoundShape && index !== -1 && index < this.compoundShape.getNumChildShapes()) {
      this.shapeComponents.splice(index, 1);
      this.compoundShape.removeChildShapeByIndex(index);
      this.shapeComponentsChanged = true;
    }
  },

  updateMass: function() {
    const shape = this.body.getCollisionShape();
    shape.calculateLocalInertia(this.data.mass, this.localInertia);
    this.body.setMassProps(this.data.mass, this.localInertia);
    this.body.updateInertiaTensor();
  },

  updateCollisionFlags: function() {
    let flags = this.data.collisionFlags;
    switch (this.data.type) {
      case "static":
        flags |= CF_STATIC_OBJECT;
        break;
      case "kinematic":
        flags |= CF_KINEMATIC_OBJECT;
        break;
      default:
        this.body.applyGravity();
        break;
    }
    this.body.setCollisionFlags(flags);

    if (this.data.type === "dynamic") {
      this.updateMass();
      // TODO: enable CCD?
      // this.body.setCcdMotionThreshold(0.001);
      // this.body.setCcdSweptSphereRadius(0.001);
    }

    this.system.driver.updateBody(this.body);
  },

  getVelocity: function() {
    return this.body.getLinearVelocity().length();
  }
};

module.exports.definition = AmmoBody;
module.exports.Component = AFRAME.registerComponent("ammo-body", AmmoBody);
