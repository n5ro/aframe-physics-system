/**
 * Creates one or more physics bodies using custom attributes attached to
 * node.userData. Each node in the original model is removed from the current
 * entity, appended to the scene attached to a new entity, and given a static-
 * or dynamic-body component managing physics.
 *
 * TODO(donmccurdy): Rename expected userData.
 *   - physicsDisabled
 *   - physicsDynamic
 *   - physicsStatic
 *   - physicsShape
 *   - physicsMass
 *
 * TODO(donmccurdy): Allow specifying default behavior? [static|dynamic|disabled]
 */
module.exports = AFRAME.registerComponent('custom-body', {
  init: function () {
    this.rootEl = this.el.sceneEl;
    this.el.addEventListener('model-loaded', this.addBodies.bind(this));
  },

  remove: function () {
    this.rootEl.parentEl.remove(this.rootEl);
  },

  addBodies: function (e) {
    var dynamicNodes = [];
    var staticNodes = [];

    this.el.object3D.updateMatrixWorld();

    // Mark descendants of no-physics nodes.
    e.detail.model.traverse(function (node) {
      if (node.userData.skipPhysics) {
        node.traverse(function (child) { child.userData.skipPhysics = true; });
      }
    });

    // Mark descendants of no-physics nodes.
    e.detail.model.traverse(function (node) {
      if (node.userData.dynamic) {
        node.traverse(function (child) { child.userData.dynamic = true; });
      }
    });

    // Divide dynamic and static meshes.
    e.detail.model.traverse(function (node) {
      if (!node.isMesh || node.userData.skipPhysics) {
        return;
      } else if (node.userData.dynamic) {
        dynamicNodes.push(node);
      } else {
        staticNodes.push(node);
      }
    });

    // Assign physics bodies to each mesh.
    dynamicNodes.forEach(this.addDynamicBody.bind(this));
    staticNodes.forEach(this.addStaticBody.bind(this));
  },

  /**
   * @param {THREE.Mesh} mesh
   */
  addDynamicBody: function (mesh) {
    this._createBodyEl(mesh).then(function (meshEl) {
      meshEl.setAttribute('dynamic-body', '');
    });
  },

  /**
   * @param {THREE.Mesh} mesh
   */
  addStaticBody: function (mesh) {
    this._createBodyEl(mesh).then(function (meshEl) {
      meshEl.setAttribute('static-body', '');
    });
  },

  /**
   * @param {THREE.Mesh} mesh
   * @return {Promise<AFRAME.Entity>}
   */
  _createBodyEl: function (mesh) {
    var position = mesh.getWorldPosition();
    var rotation = mesh.getWorldRotation();
    var scale = mesh.getWorldScale();

    var meshEl = document.createElement('a-entity');
    meshEl.setAttribute('name', mesh.name);
    this.rootEl.appendChild(meshEl);

    return new Promise(function (resolve) {
      meshEl.addEventListener('loaded', function () {
        mesh.parent.remove(mesh);
        meshEl.setObject3D('mesh', mesh);
        meshEl.setAttribute('rotation', rotation);
        meshEl.setAttribute('position', position);
        meshEl.setAttribute('scale', scale);
        resolve(meshEl);
      });
    });
  }
});
