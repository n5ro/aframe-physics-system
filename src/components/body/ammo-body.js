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
    mass: {default: 1},
    linearDamping:  {default: 0.01},
    angularDamping: {default: 0.01},
    angularFactor: {type: 'vec3', default: { x: 1, y: 1, z: 1 }},
    margin: {default: 0.01},
    activationState: {
      default: DISABLE_DEACTIVATION, 
      oneOf: [ACTIVE_TAG, ISLAND_SLEEPING, WANTS_DEACTIVATION, DISABLE_DEACTIVATION, DISABLE_SIMULATION]
    },
    shape: {default: 'hull', oneOf: ['box', 'cylinder', 'sphere', 'capsule', 'cone', 'hull', 'mesh']},
    autoGenerateShape: {default: true},
    halfExtents: {type: 'vec3', default: {x: 1, y: 1, z: 1}},
    offset: {type: 'vec3', default: {x: 0, y: 0, z: 0}},
    orientation: {type: 'vec4', default: {x: 0, y: 0, z: 0, w: 1}},
    cylinderAxis: {default: 'y', oneOf: ['x', 'y', 'z']},
    sphereRadius: {default: NaN},
    type: {default: 'dynamic', oneOf: ['static', 'dynamic', 'kinematic']},
    addCollideEventListener: {default: false},
    collisionFlags: {default: 0}, //32-bit mask
    collisionFilterGroup: {default: 1}, //32-bit mask, 
    collisionFilterMask: {default: 1}, //32-bit mask
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

    if (this.el.object3DMap.mesh && this.data.autoGenerateShape) {
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
            var x = components[i];
            var y = components[i+1];
            var z = components[i+2];

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
    var box = new THREE.Box3();
    return function(obj) {

      if (this.data.autoGenerateShape) {
        var {min, max} = box.setFromPoints(this._getVertices(obj));
        return {
          x: (Math.abs(max.x - min.x) * 0.5),
          y: (Math.abs(max.y - min.y) * 0.5),
          z: (Math.abs(max.z - min.z) * 0.5)
        };
      }
      else {
        return {
          x: this.data.halfExtents.x,
          y: this.data.halfExtents.y,
          z: this.data.halfExtents.z
        };
      }
      
    };
  }()),

  _recenter: function (obj) {
    var meshes = this._getMeshes(obj);
    for (var j = 0; j < meshes.length; j++) {
      meshes[j].geometry.center();
    }
  },

  /**
   * Parses an element's geometry and component metadata to create an Ammo body instance for the
   * component.
   */
  initBody: (function () {
    var pos = new THREE.Vector3();
    var quat = new THREE.Quaternion();

    return function() {
      if (!(this.loaded && (this.meshSet || !this.data.autoGenerateShape))) {
        return;
      }

      var el = this.el,
          data = this.data;

      var obj = this.el.object3D;
      obj.getWorldPosition(pos);
      obj.getWorldQuaternion(quat);

      this.prevObjScale = new THREE.Vector3(1,1,1);
      this.prevMeshScale = new THREE.Vector3(1,1,1);

      var mesh = this.el.object3DMap.mesh || this.el.object3D; //TODO: why is object3DMap.mesh not set sometimes?

      if (this.system.debug) {
        this.debugDrawer = this.system.driver.getDebugDrawer(this.el.sceneEl.object3D);
        this.debugDrawer.enable();
      }

      //This is for helping migration between cannon and ammo
      if (data.shape === 'none') {
        data.shape = 'box';
      }

      if (data.shape !== 'mesh') {
        this._recenter(mesh);
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
          if(data.sphereRadius) {
            radius = data.sphereRadius;
          } else {
            var sphere = new THREE.Sphere();
            sphere.setFromPoints(this._getVertices(mesh));
            if (isFinite(sphere.radius)) {
              radius = sphere.radius;
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
          var scale = new Ammo.btVector3(mesh.scale.x, mesh.scale.y, mesh.scale.z);
          var vec3 = new Ammo.btVector3(); 
          var originalHull = new Ammo.btConvexHullShape();
          originalHull.setMargin(data.margin);

          this._recenter(mesh);

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

          var scale = new Ammo.btVector3(mesh.scale.x, mesh.scale.y, mesh.scale.z);
          var a = new Ammo.btVector3(); 
          var b = new Ammo.btVector3(); 
          var c = new Ammo.btVector3(); 
          this.triMesh = new Ammo.btTriangleMesh(true, false);

          var vertices = this._getVertices(mesh);
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
      this.msTransform.getOrigin().setValue(pos.x, pos.y, pos.z);
      this.rotation = new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w);
      this.msTransform.setRotation(this.rotation);
      this.motionState = new Ammo.btDefaultMotionState( this.msTransform );

      this.localInertia = new Ammo.btVector3( 0, 0, 0 );

      this.physicsShape.setMargin( data.margin );

      if (data.type === "dynamic") {
        this.physicsShape.calculateLocalInertia( data.mass, this.localInertia );
      }

      this.rbInfo = new Ammo.btRigidBodyConstructionInfo(data.mass, this.motionState, this.physicsShape, this.localInertia);
      this.body = new Ammo.btRigidBody(this.rbInfo);
      this.body.setActivationState( data.activationState );


      if (data.type !== 'dynamic' && data.shape === 'mesh') {
        //TODO: is this right?
        var transform = this.body.getCenterOfMassTransform();
        transform.setIdentity();
        this.body.setCenterOfMassTransform(transform);
      }

      this.body.setDamping(data.linearDamping, data.angularDamping);

      this.angularFactor = new Ammo.btVector3(data.angularFactor.x, data.angularFactor.y, data.angularFactor.z);
      this.body.setAngularFactor(this.angularFactor);

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

      this.el.emit('body-loaded', {body: this.el.body});
    };
  }()),

  tick: function () {
    var updated = false;

    var mesh = this.el.object3DMap.mesh;
    if (this.data.autoGenerateShape && mesh && this.data.autoUpdateScale && this.prevMeshScale && !almostEquals(0.001, mesh.scale, this.prevMeshScale)) {
      this.prevMeshScale.copy(mesh.scale);
      updated = true;
    }

    var obj = this.el.object3D;
    if (obj !== mesh && this.data.autoUpdateScale && this.prevObjScale && !almostEquals(0.001, obj.scale, this.prevObjScale)) {
      this.prevObjScale.copy(obj.scale);
      updated = true;
    }

    if (updated) {
      var shape = this.body.getCollisionShape();

      if (!this.localScaling) {
        this.localScaling = new Ammo.btVector3();
      }
      this.localScaling.setValue(
        this.prevObjScale.x * this.prevMeshScale.x, 
        this.prevObjScale.y * this.prevMeshScale.y, 
        this.prevObjScale.z * this.prevMeshScale.z
      );
      shape.setLocalScaling(this.localScaling);
      if (this.data.type === 'dynamic') {
        shape.setMargin(this.data.margin);
        shape.calculateLocalInertia(this.data.mass, this.localInertia);
        this.body.setMassProps(this.data.mass, this.localInertia);
        this.body.updateInertiaTensor();    
      }

      this.system.driver.updateBody(this.body);
      
      if (this.data.shape === 'hull' && this.system.debug) {
        this.physicsShape.initializePolyhedralFeatures(0);
      }
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
    this.system.addComponent(this);
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

    if (this.body) {
      if (prevData.type !== this.data.type) {
        this.updateCollisionFlags();
      }

      if(prevData.collisionFilterGroup !== this.data.collisionFilterGroup) {
        this.body.getBroadphaseProxy().set_m_collisionFilterGroup(this.data.collisionFilterGroup);
      }

      if(prevData.collisionFilterMask !== this.data.collisionFilterMask) {
        this.body.getBroadphaseProxy().set_m_collisionFilterMask(this.data.collisionFilterMask);
      }
    }
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

    //TODO: fix this
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

  _applyOffsetAndOrientation: (function () {
    var offset = new THREE.Vector3(),
        orientation = new THREE.Quaternion();
    return function(v, q) {
      var data = this.data;
      if (data.offset.x !== 0 || data.offset.y !== 0 || data.offset.z !== 0) {
        offset.copy(data.offset);
        offset.applyQuaternion(q);
        v.add(offset);
      }
      if (data.orientation.x !== 0 || 
          data.orientation.y !== 0 || 
          data.orientation.z !== 0 || 
          data.orientation.w !== 1) {
        orientation.copy(data.orientation);
        q.multiply(orientation);
      }
    };
  }()),

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

      this.motionState.getWorldTransform(this.msTransform);

      if (parentEl.isScene) {
        v.copy(el.object3D.position);
        q.copy(el.object3D.quaternion);
      } else {
        el.object3D.getWorldPosition(v);
        el.object3D.getWorldQuaternion(q);
      }

      this._applyOffsetAndOrientation(v, q);

      if(this.data.type === 'kinematic') {
        this.msTransform.getOrigin().setValue(v.x, v.y, v.z);
      }
      this.rotation.setValue(q.x, q.y, q.z, q.w);
      this.msTransform.setRotation(this.rotation);
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

      this._applyOffsetAndOrientation(el.object3D.position, el.object3D.quaternion);
    };
  }()),

  updateCollisionFlags: function() {
    var flags = this.data.collisionFlags;
    switch (this.data.type) {
      case 'static':
        flags |= CF_STATIC_OBJECT;
        break;
      case 'kinematic':
        flags |= CF_KINEMATIC_OBJECT;
        break;
      default:
        break;
    }
    this.body.setCollisionFlags(flags);
  },

  getVelocity: function() {
    return this.body.getLinearVelocity().length();
  }
};

module.exports.definition = Body;
module.exports.Component = AFRAME.registerComponent('ammo-body', Body);
