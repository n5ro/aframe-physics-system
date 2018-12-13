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

function almostEquals(epsilon, u, v) {
  return Math.abs(u.x - v.x) < epsilon && Math.abs(u.y - v.y) < epsilon && Math.abs(u.z - v.z) < epsilon;
}

var Body = {
  schema: {
    mass: {default: 5, if: {type: 'dynamic'}},
    linearDamping:  { default: 0.01, if: {type: 'dynamic'}},
    angularDamping: { default: 0.01,  if: {type: 'dynamic'}},
    margin: {default: 0.01},
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
    collisionFilter: {defualt: NaN}, //32-bit mask
    autoUpdateScale: {default: true}
  },

  /**
   * Initializes a body component, assigning it to the physics system and binding listeners for
   * parsing the elements geometry.
   */
  init: function () {
    this.system = this.el.sceneEl.systems.physics;

    if (this.el.sceneEl.hasLoaded) {
      this.loaded = true;
    } else {
      this.el.sceneEl.addEventListener('loaded', () => { //TODO: remove this after?
        this.loaded = true;
        this.initBody();
      });
    }

    if (this.el.object3DMap.mesh) {
      this.meshSet = true;
    } else {
      this.el.addEventListener("model-loaded", () => {
        if (!this.meshSet) {
          this.meshSet = true;
          this.initBody();
        }
      });
    }

    this.initBody();
  },

  _getMeshes: function (object) {
    var meshes = [];
    object.traverse(function (o) {
      if (o.type === 'Mesh' && (!THREE.Sky || o.__proto__ != THREE.Sky.prototype)) {
        meshes.push(o);
      }
    });
    return meshes;
  },

  _getVertices: (function () {
    var vertexPool = [];
    var vertices = [];
    var center = new THREE.Vector3();
    return function (obj) {
      while (vertices.length > 0) {
        vertexPool.push(vertices.pop());
      }

      //TODO: this a hack to handle moving the center of mass of a hull shape
      if (this.data.shape === 'hull') {
        var { min, max } = this._getBoundingBox(obj);
        center.addVectors(min, max).multiplyScalar(0.5);
      }

      obj.updateMatrixWorld(true);
      var inverse = new THREE.Matrix4().getInverse(obj.matrixWorld);
      var meshes = this._getMeshes(obj);

      var pos = new THREE.Vector3();
      var scale = new THREE.Vector3();
      var quat = new THREE.Quaternion();

      for (var j = 0; j < meshes.length; j++) {
        var mesh = meshes[j];
        var geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        
        if (this.data.shape === 'mesh') {
          geometry.applyMatrix( mesh.matrixWorld );
        } else {
          geometry.applyMatrix(inverse.multiply(mesh.matrixWorld));
        }
        if (geometry.isBufferGeometry) {
          var components = geometry.attributes.position.array;
          for (var i = 0; i < components.length; i+=3) {
            //TODO: this a hack to handle moving the center of mass of a hull shape
            var x = components[i] + (this.data.shape === 'hull' ? -center.x : 0);
            var y = components[i+1] + (this.data.shape === 'hull' ? -center.y : 0);
            var z = components[i+2] + (this.data.shape === 'hull' ? -center.z : 0);
            if (vertexPool.length > 0) {
              vertices.push(vertexPool.pop().set(x, y, z))
            } else {
              vertices.push(new THREE.Vector3(x, y, z));
            }
          }
        } else {
          for (var i = 0; i < geometry.vertices.length; i++) {
            var vertex = geometry.vertices[i];
            if (vertexPool.length > 0) {
              vertices.push(vertexPool.pop().copy(vertex))
            } else {
              vertices.push(new THREE.Vector3(vertex.x, vertex.y, vertex.z));
            }
          }
        }
      }

      return vertices;
    };
  }()),

  _getHalfExtents: (function () {
    return function(obj) {
      var {min, max} = this._getBoundingBox(obj)
      return halfExtents = {
        x: (Math.abs(min.x - max.x) / 2 * this.el.object3D.scale.x),
        y: (Math.abs(min.y - max.y) / 2 * this.el.object3D.scale.y),
        z: (Math.abs(min.z - max.z) / 2 * this.el.object3D.scale.z)
      };
    };
  }()),

  _getBoundingBox: (function () {
    var box = new THREE.Box3();
    var min = new THREE.Vector3();
    var max = new THREE.Vector3();
    var rotation = new THREE.Vector3();
    var quaternion = new THREE.Quaternion();
    var halfExtents;
    return function (obj) {
      quaternion.copy(this.el.object3D.quaternion);
      this.el.object3D.quaternion.set(0,0,0,1);
      this.el.object3D.updateMatrixWorld(true);
      box.setFromObject(obj);
      this.el.object3D.worldToLocal(box.min);
      this.el.object3D.worldToLocal(box.max);
      this.el.object3D.quaternion.copy(quaternion);
      return box;
    };
  }()),

  /**
   * Parses an element's geometry and component metadata to create a CANNON.Body instance for the
   * component.
   */
  initBody: (function () {
    var pos = new THREE.Vector3();
    var quat = new THREE.Quaternion();

    return function() {
      if (!this.loaded || !this.meshSet) return;

      var el = this.el,
          data = this.data;

      var obj = this.el.object3D;
      this.prevScale = obj.scale.clone();
      obj.getWorldPosition(pos);
      obj.getWorldQuaternion(quat);

      var mesh = this.el.object3DMap.mesh || this.el.object3D; //TODO: why is object3DMap.mesh not set sometimes?

      if (this.system.debug) {
        this.debugDrawer = this.system.driver.getDebugDrawer(this.el.sceneEl.object3D);
        this.debugDrawer.enable();
      }

      //This is for helping migration between cannon and ammo
      if (data.shape === 'none') {
        data.shape = 'box';
      }
          
      //TODO: Support convex hull decomposition, compound shapes, gimpact (dynamic trimesh)
      switch (data.shape) {
        case 'box':
          var {x, y, z} = this._getHalfExtents(mesh);
          var halfExtents = new Ammo.btVector3(x, y, z);
          this.physicsShape = new Ammo.btBoxShape(halfExtents);
          Ammo.destroy(halfExtents);
          break;

        case 'sphere':
          var radius = 1;
          var scale = new THREE.Vector3(obj.scale.x, obj.scale.y, obj.scale.z);
          if(data.sphereRadius) {
            radius = data.sphereRadius;
          } else {
            var sphere = new THREE.Sphere();
            sphere.setFromPoints(this._getVertices(mesh));
            if (isFinite(sphere.radius)) {
              radius = sphere.radius * obj.scale[data.cylinderAxis];
            }
          }
          this.physicsShape = new Ammo.btSphereShape(radius);
          break;

        case 'cylinder':
          var {x, y, z} = this._getHalfExtents(mesh);
          var halfExtents = new Ammo.btVector3(x, y, z);
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
          Ammo.destroy(halfExtents);
          break;

        case 'capsule':
          var {x, y, z} = this._getHalfExtents(mesh);
          switch(data.cylinderAxis) {
            case 'y':
              this.physicsShape = new Ammo.btCapsuleShape(Math.max(x, z), y*2);
              break;
            case 'x':
              this.physicsShape = new Ammo.btCapsuleShapeX(Math.max(y, z), x*2);
              break;
            case 'z':
              this.physicsShape = new Ammo.btCapsuleShapeZ(Math.max(x, y), z*2);
              break;
          }
          break;

        case 'cone':
          var {x, y, z} = this._getHalfExtents(mesh);
          switch(data.cylinderAxis) {
            case 'y':
              this.physicsShape = new Ammo.btConeShape(Math.max(x, z), y*2);
              break;
            case 'x':
              this.physicsShape = new Ammo.btConeShapeX(Math.max(y, z), x*2);
              break;
            case 'z':
              this.physicsShape = new Ammo.btConeShapeZ(Math.max(x, y), z*2);
              break;
          }
          break;

        case 'hull':
          var scale = new Ammo.btVector3(obj.scale.x, obj.scale.y, obj.scale.z);
          var vec3 = new Ammo.btVector3(); 
          var originalHull = new Ammo.btConvexHullShape();
          originalHull.setMargin(data.margin);

          var vertices = this._getVertices(mesh);
          for (var i = 0; i < vertices.length; i++) {
            vec3.setValue( vertices[i].x, vertices[i].y, vertices[i].z );
            originalHull.addPoint(vec3, i == vertices.length - 1);
          }

          this.physicsShape = originalHull;
          if (originalHull.getNumVertices() >= 100) { //Bullet documentation says don't use convexHulls with 100 verts or more
            this.shapeHull = new Ammo.btShapeHull(originalHull);
            this.shapeHull.buildHull(data.margin);
            Ammo.destroy(originalHull);
            this.physicsShape = new Ammo.btConvexHullShape(Ammo.getPointer(this.shapeHull.getVertexPointer()), this.shapeHull.numVertices());
          }
          this.physicsShape.setLocalScaling(scale);
          
          if (this.system.debug) {
            this.physicsShape.initializePolyhedralFeatures(0);
          }

          Ammo.destroy(scale);
          Ammo.destroy(vec3);
          break;

        case 'mesh':
          if (data.type !== 'static') {
            //TODO: support btTriangleMeshShape for dynamic trimeshes. (not performant)
            console.warn('non-static mesh colliders are not currently supported');
            break;
          }

          var scale = new Ammo.btVector3(obj.scale.x, obj.scale.y, obj.scale.z);
          var a = new Ammo.btVector3(); 
          var b = new Ammo.btVector3(); 
          var c = new Ammo.btVector3(); 
          this.triMesh = new Ammo.btTriangleMesh(true, false);

          var vertices = this._getVertices(obj);
          for (var j = 0; j < vertices.length; j+=3) {
            a.setValue(vertices[j].x, vertices[j].y, vertices[j].z);
            b.setValue(vertices[j+1].x, vertices[j+1].y, vertices[j+1].z);
            c.setValue(vertices[j+2].x, vertices[j+2].y, vertices[j+2].z);
            this.triMesh.addTriangle(a, b, c, j == vertices.length - 3);
          }

          this.physicsShape = new Ammo.btBvhTriangleMeshShape(this.triMesh, true, true);
          this.physicsShape.setMargin(data.margin);

          this.physicsShape.setLocalScaling(scale);

          Ammo.destroy(a);
          Ammo.destroy(b);
          Ammo.destroy(c);
          Ammo.destroy(scale);
          break;

        default:
          console.warn(data.shape + ' is not currently supported');
          return;
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
        this.vector3.setValue(0, 0, 0);
        this.quaternion.setValue(0, 0, 0, 1);
        transform.setOrigin(this.vector3);
        transform.setRotation(this.quaternion);
        this.body.setCenterOfMassTransform(transform);
      }

      this.body.setDamping(data.linearDamping, data.angularDamping);

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
      // this.el.object3D.updateMatrixWorld(true);

      // If component wasn't initialized when play() was called, finish up.
      if (this.isPlaying) {
        this._play();
      }

      this.el.emit('body-loaded', {body: this.el.body});
    };
  }()),

  tick: function () {
    var obj = this.el.object3DMap.mesh || this.el.object3D; //TODO???

    if (this.data.autoUpdateScale && this.prevScale && !almostEquals(0.001, obj.scale, this.prevScale)) {
      this.prevScale.copy(obj.scale)
      var shape = this.body.getCollisionShape();
      var scale = this.physicsShape.getLocalScaling();
      scale.setValue(obj.scale.x, obj.scale.y, obj.scale.z);
      shape.setLocalScaling(scale);

      if (this.data.mass > 0) {
        shape.setMargin(this.data.margin);
        shape.calculateLocalInertia(this.data.mass, this.localInertia);
        this.body.setMassProps(this.data.mass, this.localInertia);
        this.body.updateInertiaTensor();    
      }

      this.system.driver.updateBody(this.body);
      
      if (this.data.shape === 'hull' && this.system.debug) {
        this.physicsShape.initializePolyhedralFeatures(0);
      }
      this.syncToPhysics();
    }
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
    // this.system.addBody(this.body);
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
  },

  /**
   * Removes the component and all physics and scene side effects.
   */
  remove: function () {

    if (this.data.addCollideEventListener) {
      this.system.driver.removeEventListener(this.body);
    }

    if (this.body) {
      this.system.removeBody(this.body);
      // delete this.body.el;
      Ammo.destroy(this.body);
    }

    // if (this.shapeHull) Ammo.destroy(this.shapeHull);
    // if (this.triMesh) Ammo.destroy(this.triMesh);
    // Ammo.destroy(this.msTransform);
    // Ammo.destroy(this.vector3);
    // Ammo.destroy(this.quaternion);
    // Ammo.destroy(this.motionState);
    // Ammo.destroy(this.localInertia);
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
      }

      this.msTransform.setRotation(this.quaternion);
      this.motionState.setWorldTransform(this.msTransform);
      body.setWorldTransform(this.msTransform);
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
