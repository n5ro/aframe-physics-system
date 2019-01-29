/* global Ammo,THREE */
let AmmoDebugDrawer = require("ammo-debug-drawer");

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

let Body = {
  schema: {
    mass: { default: 1 },
    gravity: { default: { x: 0, y: -9.8, z: 0 } },
    linearDamping: { default: 0.01 },
    angularDamping: { default: 0.01 },
    angularFactor: { type: "vec3", default: { x: 1, y: 1, z: 1 } },
    margin: { default: 0.01 },
    activationState: {
      default: DISABLE_DEACTIVATION,
      oneOf: [ACTIVE_TAG, ISLAND_SLEEPING, WANTS_DEACTIVATION, DISABLE_DEACTIVATION, DISABLE_SIMULATION]
    },
    shape: { default: "hull", oneOf: ["box", "cylinder", "sphere", "capsule", "cone", "hull", "mesh"] },
    autoGenerateShape: { default: true },
    halfExtents: { type: "vec3", default: { x: 1, y: 1, z: 1 } },
    recenter: { default: false }, //recenter the object3D's geometry
    offset: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
    orientation: { type: "vec4", default: { x: 0, y: 0, z: 0, w: 1 } },
    cylinderAxis: { default: "y", oneOf: ["x", "y", "z"] },
    sphereRadius: { default: NaN },
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

    if (this.el.sceneEl.hasLoaded) {
      this.loaded = true;
    } else {
      this.el.sceneEl.addEventListener("loaded", () => {
        //TODO: remove this after?
        this.loaded = true;
        this.initBody();
      });
    }

    if (this.el.object3DMap.mesh && this.data.autoGenerateShape) {
      this.meshSet = true;
    } else {
      ["model-loaded", "video-loaded", "image-loaded"].forEach(eventName => {
        this.el.addEventListener(eventName, () => {
          if (!this.meshSet) {
            this.meshSet = true;
            this.initBody();
          }
        });
      });
    }

    this.initBody();
  },

  _getMeshes: function(sceneRoot) {
    let meshes = [];
    sceneRoot.traverse(o => {
      if (o.type === "Mesh" && (!THREE.Sky || o.__proto__ != THREE.Sky.prototype)) {
        meshes.push(o);
      }
    });
    return meshes;
  },

  _getVertices: (function() {
    let vertexPool = [];
    let vertices = [];
    let matrix = new THREE.Matrix4();
    let inverse = new THREE.Matrix4();
    return function(sceneRoot, meshes) {
      while (vertices.length > 0) {
        vertexPool.push(vertices.pop());
      }

      inverse.getInverse(sceneRoot.matrixWorld);

      for (let j = 0; j < meshes.length; j++) {
        let mesh = meshes[j];

        let geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();

        if (this.data.shape === "mesh") {
          geometry.applyMatrix(mesh.matrixWorld);
        } else {
          matrix.multiplyMatrices(inverse, mesh.matrixWorld);
          geometry.applyMatrix(matrix);
        }

        if (geometry.isBufferGeometry) {
          let components = geometry.attributes.position.array;
          for (let i = 0; i < components.length; i += 3) {
            let x = components[i];
            let y = components[i + 1];
            let z = components[i + 2];

            if (vertexPool.length > 0) {
              vertices.push(vertexPool.pop().set(x, y, z));
            } else {
              vertices.push(new THREE.Vector3(x, y, z));
            }
          }
        } else {
          for (let i = 0; i < geometry.vertices.length; i++) {
            let vertex = geometry.vertices[i];
            if (vertexPool.length > 0) {
              vertices.push(vertexPool.pop().copy(vertex));
            } else {
              vertices.push(new THREE.Vector3(vertex.x, vertex.y, vertex.z));
            }
          }
        }
      }

      return vertices;
    };
  })(),

  _getHalfExtents: (function() {
    let halfExtents = new THREE.Vector3();
    return function(boundingBox) {
      if (this.data.autoGenerateShape) {
        let { min, max } = boundingBox;
        halfExtents.subVectors(max, min).multiplyScalar(0.5);
        return {
          x: halfExtents.x,
          y: halfExtents.y,
          z: halfExtents.z
        };
      } else {
        return {
          x: this.data.halfExtents.x,
          y: this.data.halfExtents.y,
          z: this.data.halfExtents.z
        };
      }
    };
  })(),

  _recenter: (function() {
    let offset = new THREE.Matrix4();
    let center = new THREE.Vector3();
    let geometries = [];
    return function(sceneRoot, meshes) {
      if (meshes.length === 1) {
        meshes[0].geometry.center();
        return;
      }

      let { min, max } = this._getBoundingBox(meshes);
      center.addVectors(max, min).multiplyScalar(-0.5);
      offset.makeTranslation(center.x, center.y, center.z);

      for (let j = 0; j < meshes.length; j++) {
        let mesh = meshes[j];
        if (geometries.indexOf(mesh.geometry.uuid) !== -1) {
          continue;
        }
        mesh.geometry.applyMatrix(offset);
        geometries.push(mesh.geometry.uuid);
      }
    };
  })(),

  _getBoundingBox: (function() {
    let boundingBox = {
      min: new THREE.Vector3(Number.MAX_VALUE),
      max: new THREE.Vector3(Number.MIN_VALUE)
    };
    return function(meshes) {
      for (let i = 0; i < meshes.length; ++i) {
        let mesh = meshes[i];
        if (!mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox();
        }
        let box = mesh.geometry.boundingBox;

        boundingBox.min.x = Math.min(box.min.x, box.min.x);
        boundingBox.min.y = Math.min(box.min.y, box.min.y);
        boundingBox.min.z = Math.min(box.min.z, box.min.z);

        boundingBox.max.x = Math.max(box.max.x, box.max.x);
        boundingBox.max.y = Math.max(box.max.y, box.max.y);
        boundingBox.max.z = Math.max(box.max.z, box.max.z);
      }
      return boundingBox;
    };
  })(),

  /**
   * Parses an element's geometry and component metadata to create an Ammo body instance for the
   * component.
   */
  initBody: (function() {
    let pos = new THREE.Vector3();
    let quat = new THREE.Quaternion();
    let boundingBox = new THREE.Box3();

    return function() {
      if (!(this.system.initialized && this.loaded && (this.meshSet || !this.data.autoGenerateShape))) {
        return;
      }

      let el = this.el,
        data = this.data;

      let obj = this.el.object3D;
      obj.getWorldPosition(pos);
      obj.getWorldQuaternion(quat);

      this.prevObjScale = new THREE.Vector3(1, 1, 1);
      this.prevMeshScale = new THREE.Vector3(1, 1, 1);

      let sceneRoot = this.el.object3DMap.mesh || this.el.object3D; //TODO: why is object3DMap.mesh not set sometimes?

      //This is for helping migration between cannon and ammo
      if (data.shape === "none") {
        data.shape = "box";
      }

      let meshes = this._getMeshes(sceneRoot);

      if (data.shape !== "mesh") {
        if (data.recenter) {
          this._recenter(sceneRoot, meshes);
        }
      }

      let vertices = this._getVertices(sceneRoot, meshes);
      boundingBox.setFromPoints(vertices);

      //TODO: Support convex hull decomposition, compound shapes, gimpact (dynamic trimesh)
      switch (data.shape) {
        case "box": {
          let { x, y, z } = this._getHalfExtents(boundingBox);
          let halfExtents = new Ammo.btVector3(x, y, z);
          this.physicsShape = new Ammo.btBoxShape(halfExtents);
          Ammo.destroy(halfExtents);
          break;
        }
        case "sphere": {
          let radius = 1;
          if (data.sphereRadius) {
            radius = data.sphereRadius;
          } else {
            let sphere = new THREE.Sphere();
            sphere.setFromPoints(vertices);
            if (isFinite(sphere.radius)) {
              radius = sphere.radius;
            }
          }
          this.physicsShape = new Ammo.btSphereShape(radius);
          break;
        }
        case "cylinder": {
          let { x, y, z } = this._getHalfExtents(boundingBox);
          let halfExtents = new Ammo.btVector3(x, y, z);
          switch (data.cylinderAxis) {
            case "y":
              this.physicsShape = new Ammo.btCylinderShape(halfExtents);
              break;
            case "x":
              this.physicsShape = new Ammo.btCylinderShapeX(halfExtents);
              break;
            case "z":
              this.physicsShape = new Ammo.btCylinderShapeZ(halfExtents);
              break;
          }
          Ammo.destroy(halfExtents);
          break;
        }
        case "capsule": {
          let { x, y, z } = this._getHalfExtents(boundingBox);
          switch (data.cylinderAxis) {
            case "y":
              this.physicsShape = new Ammo.btCapsuleShape(Math.max(x, z), y * 2);
              break;
            case "x":
              this.physicsShape = new Ammo.btCapsuleShapeX(Math.max(y, z), x * 2);
              break;
            case "z":
              this.physicsShape = new Ammo.btCapsuleShapeZ(Math.max(x, y), z * 2);
              break;
          }
          break;
        }
        case "cone": {
          let { x, y, z } = this._getHalfExtents(boundingBox);
          switch (data.cylinderAxis) {
            case "y":
              this.physicsShape = new Ammo.btConeShape(Math.max(x, z), y * 2);
              break;
            case "x":
              this.physicsShape = new Ammo.btConeShapeX(Math.max(y, z), x * 2);
              break;
            case "z":
              this.physicsShape = new Ammo.btConeShapeZ(Math.max(x, y), z * 2);
              break;
          }
          break;
        }
        case "hull": {
          let scale = new Ammo.btVector3(sceneRoot.scale.x, sceneRoot.scale.y, sceneRoot.scale.z);
          let vec3 = new Ammo.btVector3();
          let originalHull = new Ammo.btConvexHullShape();
          originalHull.setMargin(data.margin);

          for (let i = 0; i < vertices.length; i++) {
            vec3.setValue(vertices[i].x, vertices[i].y, vertices[i].z);
            originalHull.addPoint(vec3, i == vertices.length - 1);
          }

          this.physicsShape = originalHull;
          if (originalHull.getNumVertices() >= 100) {
            //Bullet documentation says don't use convexHulls with 100 verts or more
            this.shapeHull = new Ammo.btShapeHull(originalHull);
            this.shapeHull.buildHull(data.margin);
            Ammo.destroy(originalHull);
            this.physicsShape = new Ammo.btConvexHullShape(
              Ammo.getPointer(this.shapeHull.getVertexPointer()),
              this.shapeHull.numVertices()
            );
          }
          this.physicsShape.setLocalScaling(scale);

          if (this.system.debug) {
            this.polyHedralFeaturesInitialized = true;
            this.physicsShape.initializePolyhedralFeatures(0);
          }

          Ammo.destroy(scale);
          Ammo.destroy(vec3);
          break;
        }
        case "mesh": {
          if (data.type !== "static") {
            //TODO: support btTriangleMeshShape for dynamic trimeshes. (not performant)
            console.warn("non-static mesh colliders are not currently supported");
            break;
          }

          let a = new Ammo.btVector3();
          let b = new Ammo.btVector3();
          let c = new Ammo.btVector3();
          this.triMesh = new Ammo.btTriangleMesh(true, false);

          for (let j = 0; j < vertices.length; j += 3) {
            a.setValue(vertices[j].x, vertices[j].y, vertices[j].z);
            b.setValue(vertices[j + 1].x, vertices[j + 1].y, vertices[j + 1].z);
            c.setValue(vertices[j + 2].x, vertices[j + 2].y, vertices[j + 2].z);
            this.triMesh.addTriangle(a, b, c, j == vertices.length - 3);
          }

          this.physicsShape = new Ammo.btBvhTriangleMeshShape(this.triMesh, true, true);
          this.physicsShape.setMargin(data.margin);
          //TODO: support btScaledBvhTriangleMeshShape?

          Ammo.destroy(a);
          Ammo.destroy(b);
          Ammo.destroy(c);
          break;
        }

        default:
          console.warn(data.shape + " is not currently supported");
          return;
      }

      this.msTransform = new Ammo.btTransform();
      this.msTransform.setIdentity();
      this.rotation = new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w);
      if (this.data.shape !== "mesh") {
        //mesh shape origin and rotation are already accounted for
        this.msTransform.getOrigin().setValue(pos.x, pos.y, pos.z);
        this.msTransform.setRotation(this.rotation);
      }
      this.motionState = new Ammo.btDefaultMotionState(this.msTransform);

      this.localInertia = new Ammo.btVector3(0, 0, 0);

      this.physicsShape.setMargin(data.margin);

      if (data.type === "dynamic") {
        this.physicsShape.calculateLocalInertia(data.mass, this.localInertia);
      }

      this.rbInfo = new Ammo.btRigidBodyConstructionInfo(
        data.mass,
        this.motionState,
        this.physicsShape,
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

      this.system.addBody(this.body, this.data.collisionFilterGroup, this.data.collisionFilterMask);

      if (this.data.addCollideEventListener) {
        this.system.driver.addEventListener(this.body);
      }

      this.isLoaded = true;

      // If component wasn't initialized when play() was called, finish up.
      if (this.isPlaying) {
        this._play();
      }

      this.el.emit("body-loaded", { body: this.el.body });
    };
  })(),

  tick: function() {
    if (!this.isLoaded && this.system.initialized) {
      this.initBody();
    }

    let updated = false;

    let mesh = this.el.object3DMap.mesh;
    if (
      this.data.autoGenerateShape &&
      mesh &&
      this.data.autoUpdateScale &&
      this.prevMeshScale &&
      !almostEquals(0.001, mesh.scale, this.prevMeshScale)
    ) {
      this.prevMeshScale.copy(mesh.scale);
      updated = true;
    }

    let obj = this.el.object3D;
    if (
      obj !== mesh &&
      this.data.autoUpdateScale &&
      this.prevObjScale &&
      !almostEquals(0.001, obj.scale, this.prevObjScale)
    ) {
      this.prevObjScale.copy(obj.scale);
      updated = true;
    }

    if (updated && this.data.shape !== "mesh") {
      //dynamic scaling of meshes not currently supported

      if (!this.localScaling) {
        this.localScaling = new Ammo.btVector3();
      }
      this.localScaling.setValue(
        this.prevObjScale.x * this.prevMeshScale.x,
        this.prevObjScale.y * this.prevMeshScale.y,
        this.prevObjScale.z * this.prevMeshScale.z
      );
      this.physicsShape.setLocalScaling(this.localScaling);

      if (this.data.type === "dynamic") {
        this.updateMass();
      }

      this.system.driver.updateBody(this.body);
    }

    if (
      this.physicsShape &&
      this.data.shape === "hull" &&
      this.system.debug &&
      (updated || !this.polyHedralFeaturesInitialized)
    ) {
      //the scale was updated or debug was turned on for a hull shape
      this.polyHedralFeaturesInitialized = true;
      this.physicsShape.initializePolyhedralFeatures(0);
    }
  },

  /**
   * Registers the component with the physics system, if ready.
   */
  play: function() {
    if (this.isLoaded) this._play();
  },

  /**
   * Internal helper to register component with physics system.
   */
  _play: function() {
    this.system.addComponent(this);
  },

  /**
   * Unregisters the component with the physics system.
   */
  pause: function() {
    if (this.isLoaded) this._pause();
  },

  _pause: function() {
    this.system.removeComponent(this);
    if (this.body) this.system.removeBody(this.body);
  },

  /**
   * Updates the rigid body instance, where possible.
   */
  update: function(prevData) {
    if (this.body) {
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
    if (this.data.addCollideEventListener) {
      this.system.driver.removeEventListener(this.body);
    }

    if (this.body) {
      this.system.removeBody(this.body);
      delete this.body.el;
      Ammo.destroy(this.body);
    }

    if (this.shapeHull) Ammo.destroy(this.shapeHull);
    if (this.triMesh) Ammo.destroy(this.triMesh);
    if (this.localScaling) Ammo.destroy(this.localScaling);
    if (this.physicsShape) Ammo.destroy(this.physicsShape);
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

  _applyOffsetAndOrientation: (function() {
    let offset = new THREE.Vector3(),
      orientation = new THREE.Quaternion();
    return function(v, q) {
      let data = this.data;
      if (data.offset.x !== 0 || data.offset.y !== 0 || data.offset.z !== 0) {
        offset.copy(data.offset);
        offset.applyQuaternion(q);
        v.add(offset);
      }
      if (
        data.orientation.x !== 0 ||
        data.orientation.y !== 0 ||
        data.orientation.z !== 0 ||
        data.orientation.w !== 1
      ) {
        orientation.copy(data.orientation);
        q.multiply(orientation);
      }
    };
  })(),

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

      this._applyOffsetAndOrientation(v, q);

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

      this._applyOffsetAndOrientation(el.object3D.position, el.object3D.quaternion);
    };
  })(),

  updateMass: function() {
    let shape = this.body.getCollisionShape();
    shape.setMargin(this.data.margin);
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
    }
    this.system.driver.updateBody(this.body);
  },

  getVelocity: function() {
    return this.body.getLinearVelocity().length();
  }
};

module.exports.definition = Body;
module.exports.Component = AFRAME.registerComponent("ammo-body", Body);
