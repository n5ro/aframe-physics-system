/* global Ammo,THREE */
const threeToAmmo = require("three-to-ammo");

var AmmoShape = {
  schema: {
    type: { default: "hull", oneOf: ["box", "cylinder", "sphere", "capsule", "cone", "hull", "mesh"] },
    recenter: { default: false }, //recenter the object3D's geometry
    autoGenerateShape: { default: true }, //disable if using custom halfExtents or sphereRadius
    mergeGeometry: { default: true }, //use all geometry on the object to generate the shape. Otherwise, setMesh must be called explicitly
    halfExtents: { type: "vec3", default: { x: 1, y: 1, z: 1 } },
    minHalfExtent: { default: 0 },
    maxHalfExtent: { default: Number.POSITIVE_INFINITY },
    sphereRadius: { default: NaN },
    cylinderAxis: { default: "y", oneOf: ["x", "y", "z"] },
    margin: { default: 0.01 },
    offset: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
    orientation: { type: "vec4", default: { x: 0, y: 0, z: 0, w: 1 } }
  },

  multiple: true,

  init: function() {
    this.system = this.el.sceneEl.systems.physics;

    let bodyEl = this.el;
    this.body = bodyEl.components["ammo-body"] || null;
    while (!this.body && bodyEl.parentNode != this.el.sceneEl) {
      bodyEl = bodyEl.parentNode;
      if (bodyEl.components["ammo-body"]) {
        this.body = bodyEl.components["ammo-body"];
      }
    }
    if (!this.body) {
      console.warn("body not found");
      return;
    }

    if (this.data.mergeGeometry || !this.data.autoGenerateShape) {
      if (this.el.object3DMap.mesh) {
        this.setMesh(this.el.object3DMap.mesh);
      } else {
        this.body.addShape(this);
      }
    }
  },

  setMesh: function(mesh) {
    this.mesh = mesh;
    this.body.addShape(this);
  },

  getMesh: function() {
    return this.mesh || null;
  },

  setShape: function(collisionShape, localTransform) {
    this.collisionShape = collisionShape;
    this.localTransform = localTransform;
  },

  getShape: function() {
    return this.collisionShape || null;
  },

  getLocalTransform: function() {
    return this.localTransform || null;
  },

  remove: function() {
    if (!this.body) {
      return;
    }

    this.body.removeShape(this);

    if (this.collisionShape) this.collisionShape.destroy();
    if (this.localTransform) Ammo.destroy(this.localTransform);
  }
};

module.exports.definition = AmmoShape;
module.exports.Component = AFRAME.registerComponent("ammo-shape", AmmoShape);
