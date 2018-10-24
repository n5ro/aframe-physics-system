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
    shape: {default: 'hull', oneOf: ['box', 'cylinder', 'sphere', 'capsule', 'cone', 'hull', 'mesh']},
    cylinderAxis: {default: 'y', oneOf: ['x', 'y', 'z']},
    sphereRadius: {default: NaN},
    type: {default: 'dynamic', oneOf: ['static', 'dynamic', 'kinematic']},
    addCollideEventListener: {default: false},
    collisionFlags: {default: 0}, //32-bit mask
    collisionGroup: {default: NaN}, //32-bit mask
    collisionFilter: {defualt: NaN} //32-bit mask
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

  _getMeshRoot: function (obj) {
    //TODO: is there a better way to do this?
    if (obj.children.length > 0 && obj.children[0].type === 'Scene') {
      obj = obj.children[0].children[0];
    } else if (obj.children.length > 0 && obj.children[0].type === 'Object3D') {
      obj = obj.children[0];
    }
    return obj;
  },

  _getVertices: (function () {
      var vertexPool = [];
      var vertices = [];
    return function (obj) {
      while (vertices.length > 0) {
        vertexPool.push(vertices.pop());
      }
      for (var i = 0; i < obj.children.length; i+=3) {
        var mesh = obj.children[i];
        if (mesh.type === 'Mesh') {
          var geometry = mesh.geometry;
          var components = geometry.attributes.position.array;
          for (var i = 0; i < components.length; i+=3) {
            if (vertexPool.length > 0) {
              vertices.push(vertexPool.pop().set(components[i], components[i+1], components[i+2]))
            } else {
              vertices.push(new THREE.Vector3(components[i], components[i+1], components[i+2]));
            }
          }
        }
      }
      return vertices;
    };
  }()),

  _getHalfExtents: (function () {
    var q = new THREE.Quaternion(),
        box = new THREE.Box3(),
        scale = new THREE.Vector3();
    var halfExtents;
    return function (obj) {
        scale.copy(obj.scale);
        box.setFromPoints(this._getVertices(obj));

        if (!isFinite(box.min.lengthSq())) return null;

        if (!halfExtents) {
          halfExtents = new Ammo.btVector3();
        }

        halfExtents.setValue(
          (box.max.x - box.min.x) / 2 * scale.x, 
          (box.max.y - box.min.y) / 2 * scale.y, 
          (box.max.z - box.min.z) / 2 * scale.z
        );

        return halfExtents;
    };
  }()),

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

    if (this.system.debug) {
      this.debugDrawer = this.system.driver.getDebugDrawer(this.el.sceneEl.object3D);
      this.debugDrawer.enable();
    }
        
    //TODO: Support convex hull decomposition, compound shapes, gimpact (dynamic trimesh)
    switch (this.data.shape) {
      case 'box':
        this.physicsShape = new Ammo.btBoxShape( this._getHalfExtents(obj) );
        break;

      case 'sphere':
        var radius = 1;
        var scale = new THREE.Vector3(obj.scale.x, obj.scale.y, obj.scale.z);
        if(data.sphereRadius) {
          radius = data.sphereRadius;
        } else {
          var sphere = new THREE.Sphere();
          obj = this._getMeshRoot(obj);
          sphere.setFromPoints(this._getVertices(obj));
          if (isFinite(sphere.radius)) {
            radius = sphere.radius * obj.scale[data.cylinderAxis];
          }
        }
        this.physicsShape = new Ammo.btSphereShape(radius);
        break;

      case 'cylinder':
        var halfExtents = this._getHalfExtents(obj)
        switch(data.cylinderAxis) {
          case 'y':
            this.physicsShape = new Ammo.btCylinderShape(halfExtents);
            break;
          case 'x':
            this.physicsShape = new Ammo.btCylinderShapeX(halfExtents);
            break;
          case 'z':
            this.physicsShape = new Ammo.btCylinderShapeZ(halfExtents);
            break;
        }
        break;

      case 'capsule':
        var halfExtents = this._getHalfExtents(obj);
        switch(data.cylinderAxis) {
          case 'y':
            this.physicsShape = new Ammo.btCapsuleShape(Math.max(halfExtents.x(), halfExtents.z()), halfExtents.y()*2);
            break;
          case 'x':
            this.physicsShape = new Ammo.btCapsuleShapeX(Math.max(halfExtents.y(), halfExtents.z()), halfExtents.x()*2);
            break;
          case 'z':
            this.physicsShape = new Ammo.btCapsuleShapeZ(Math.max(halfExtents.x(), halfExtents.y()), halfExtents.z()*2);
            break;
        }
        break;

      case 'cone':
        var halfExtents = this._getHalfExtents(obj);
        switch(data.cylinderAxis) {
          case 'y':
            this.physicsShape = new Ammo.btConeShape(Math.max(halfExtents.x(), halfExtents.z()), halfExtents.y()*2);
            break;
          case 'x':
            this.physicsShape = new Ammo.btConeShapeX(Math.max(halfExtents.y(), halfExtents.z()), halfExtents.x()*2);
            break;
          case 'z':
            this.physicsShape = new Ammo.btConeShapeZ(Math.max(halfExtents.x(), halfExtents.y()), halfExtents.z()*2);
            break;
        }
        break;

      case 'hull':
        var scale = new Ammo.btVector3(obj.scale.x, obj.scale.y, obj.scale.z);
        var vec3 = new Ammo.btVector3(); 
        var originalHull = new Ammo.btConvexHullShape();
        originalHull.setMargin(data.margin);

        obj = this._getMeshRoot(obj);

        for (var i = 0; i < obj.children.length; i++) {
          var mesh = obj.children[i];
          if (mesh.type === 'Mesh') {
            var geometry = mesh.geometry;
            var components = geometry.attributes.position.array;
            for (var i = 0; i < components.length; i+=3) {
              vec3.setValue( components[i], components[i+1], components[i+2] );
              originalHull.addPoint(vec3, i == components.length - 3);
            }
          }

          this.physicsShape = originalHull;
          if (originalHull.getNumVertices() >= 100) { //Bullet documentation says don't use convexHulls with 100 verts or more
            this.shapeHull = new Ammo.btShapeHull(originalHull);
            this.shapeHull.buildHull(data.margin);
            Ammo.destroy(originalHull);
            this.physicsShape = new Ammo.btConvexHullShape(this.shapeHull.getVertexPointer().ptr, this.shapeHull.numVertices());
          }
          this.physicsShape.setLocalScaling(scale);

          if (this.system.debug) {
            this.physicsShape.initializePolyhedralFeatures(0);
          }
        }

        Ammo.destroy(scale);
        Ammo.destroy(vec3);
        break;

      case 'mesh':
        if (this.data.type !== 'static') {
          //TODO: support btTriangleMeshShape for dynamic trimeshes. (not performant)
          console.warn('non-static mesh colliders are not currently supported');
          break;
        }

        var scale = new Ammo.btVector3(obj.scale.x, obj.scale.y, obj.scale.z);
        var a = new Ammo.btVector3(); 
        var b = new Ammo.btVector3(); 
        var c = new Ammo.btVector3(); 
        this.triMesh = new Ammo.btTriangleMesh(true, false);

        obj = this._getMeshRoot(obj);

        for (var i = 0; i < obj.children.length; i++) {
          var mesh = obj.children[i];

          if(mesh.type == "Mesh") {
            var geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
            geometry.applyMatrix( mesh.matrixWorld );
            var components = geometry.attributes.position.array;
            for (var j = 0; j < components.length; j+=9) {
              a.setValue(components[j], components[j+1], components[j+2]);
              b.setValue(components[j+3], components[j+4], components[j+5]);
              c.setValue(components[j+6], components[j+7], components[j+8]);
              this.triMesh.addTriangle(a, b, c, j == components.length - 9);
            }
          }
        }
        this.physicsShape = new Ammo.btBvhTriangleMeshShape(this.triMesh, true, true);

        Ammo.destroy(a);
        Ammo.destroy(b);
        Ammo.destroy(c);
        Ammo.destroy(scale);
        break;

      default:
        console.warn(this.data.shape + ' is not currently supported');
        break;
    }

    this.msTransform = new Ammo.btTransform();
    this.msTransform.setIdentity();
    this.vector3 = new Ammo.btVector3(pos.x, pos.y, pos.z);
    this.quaternion = new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w);
    this.msTransform.setOrigin(this.vector3);
    this.msTransform.setRotation(this.quaternion);
    this.motionState = new Ammo.btDefaultMotionState( this.msTransform );
    this.localInertia = new Ammo.btVector3( 0, 0, 0 );

    this.physicsShape.setMargin( data.margin );

    if (this.data.mass > 0) {
      this.physicsShape.calculateLocalInertia( data.mass, this.localInertia );
    }

    this.rbInfo = new Ammo.btRigidBodyConstructionInfo(data.mass, this.motionState, this.physicsShape, this.localInertia);
    this.body = new Ammo.btRigidBody(this.rbInfo);
    this.body.setActivationState( data.activationState );

    if (data.type !== 'dynamic' && data.shape === 'mesh') {
      //TODO: is this right?
      var transform = this.body.getCenterOfMassTransform();
      this.vector3 = new Ammo.btVector3(0, 0, 0);
      this.quaternion = new Ammo.btQuaternion(0, 0, 0, 1);
      transform.setOrigin(this.vector3);
      transform.setRotation(this.quaternion);
      this.body.setCenterOfMassTransform(transform);
    }
    switch (data.type) {
      case 'static':
        this.body.setCollisionFlags(CF_STATIC_OBJECT | data.collisionFlags);
        break;
      case 'kinematic':
        this.body.setCollisionFlags(CF_KINEMATIC_OBJECT | data.collisionFlags);
        break;
      default:
        break;
    }

    this.el.body = this.body;
    this.body.el = el;
    
    this.system.addBody(this.body);

    if (this.data.addCollideEventListener) {
      this.system.driver.addEventListener(this.body);
    }

    this.isLoaded = true;

    // Matrix World must be updated at root level, if scale is to be applied – updateMatrixWorld()
    // only checks an object's parent, not the rest of the ancestors. Hence, a wrapping entity with
    // scale="0.5 0.5 0.5" will be ignored.
    // Reference: https://github.com/mrdoob/three.js/blob/master/src/core/Object3D.js#L511-L541
    // Potential fix: https://github.com/mrdoob/three.js/pull/7019
    this.el.object3D.updateMatrixWorld(true);

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
   * Updates the rigid body instance, where possible.
   */
  update: function (prevData) {
    if (!this.body) return;

    var data = this.data;

    //TODO: handle updates
  },

  /**
   * Removes the component and all physics and scene side effects.
   */
  remove: function () {
    if (this.data.addCollideEventListener) {
      this.system.driver.removeEventListener(this.body);
    }

    if (this.body) {
      delete this.body.el;
      delete this.body;
    }

    if (this.shapeHull) Ammo.destroy(this.shapeHull);
    if (this.triMesh) Ammo.destroy(this.triMesh);
    Ammo.destroy(this.msTransform);
    Ammo.destroy(this.vector3);
    Ammo.destroy(this.quaternion);
    Ammo.destroy(this.motionState);
    Ammo.destroy(this.localInertia);
  },

  beforeStep: function () {
    if (this.data.type !== 'dynamic') {
      this.syncToPhysics();
    }
  },

  step: function () {
    if (this.data.type === 'dynamic') {
      this.syncFromPhysics();
    }
  },

  /**
   * Updates the rigid body's position, velocity, and rotation, based on the scene.
   */
  syncToPhysics: (function () {
    var q =  new THREE.Quaternion(),
        v = new THREE.Vector3();
    return function () {
      var el = this.el,
          parentEl = el.parentEl,
          body = this.body;

      if (!body) return;

      if (parentEl.isScene) {
        var pos = el.object3D.position;
        var quat = el.object3D.quaternion;
        this.vector3.setValue(pos.x, pos.y, pos.z);
        this.quaternion.setValue(quat.x, quat.y, quat.z, quat.w);
      } else {
        el.object3D.getWorldPosition(v);
        el.object3D.getWorldQuaternion(q);
        this.vector3.setValue(v.x, v.y, v.z);
        this.quaternion.setValue(q.x, q.y, q.z, q.w);
      }

      if(this.data.type === 'kinematic') {
        this.msTransform.setOrigin(this.vector3);
        this.msTransform.setRotation(this.quaternion);
        this.motionState.setWorldTransform(this.msTransform);
        body.setWorldTransform(this.msTransform);
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
