var entityFactory = require('../helpers').entityFactory;

var Body = require('../../src/components/body/body').definition,
    CustomBody = function () {};

AFRAME.utils.extend(CustomBody.prototype, Body);
CustomBody.prototype.constructor = CustomBody;

suite('body', function () {
  var el,
      component;

  var body = {type: 'CANNON.Body'},
      physics = {
        removeComponent: sinon.spy(),
        removeBody: sinon.spy()
      };

  setup(function (done) {
    el = body.el = entityFactory();
    el.addEventListener('loaded', function () {
      el.sceneEl.systems.physics = physics;
      component = new CustomBody();
      sinon.stub(component, 'initBody');
      component.el = el;
      done();
    });
  });

  teardown(function () {
    physics.removeComponent.reset();
    physics.removeBody.reset();
  });

  suite('lifecycle', function () {
    test('init', function () {
      el.sceneEl.hasLoaded = true;
      component.init();
      expect(component.system).to.equal(physics);
      expect(component.initBody).to.have.been.calledOnce;
    });

    test.skip('update', function () {
      // TODO
    });

    test('remove', function () {
      component.wireframe = {type: 'Wireframe'};
      component.body = el.body = body;
      component.remove();
      expect(el.body).to.be.undefined;
      expect(body.el).to.be.undefined;
      expect(component.body).to.be.undefined;
      expect(component.wireframe).to.be.undefined;
    });

    test.skip('play', function () {
      // TODO
    });

    test('pause', function () {
      component.isLoaded = true;
      component.system = physics;
      component.body = el.body = body;
      component.pause();
      expect(physics.removeComponent).to.have.been.calledWith(component);
      expect(physics.removeBody).to.have.been.calledWith(body);
    });
  });

  suite('sync', function () {
    var eps = Number.EPSILON
    teardown(function () {
      delete body.quaternion
      delete body.position
    });

    test.skip('syncToPhysics', function () {
      // TODO
    });

    test.skip('syncFromPhysics', function () {
      // TODO
    });

    test('syncFromPhysics nested rotation', function (done) {
      var childEl = el.appendChild(document.createElement('a-entity'));
      childEl.addEventListener('loaded', function () {
        component.el = childEl;
        component.body = el.body = body;
        // body rotation on x and y
        body.quaternion = new THREE.Quaternion()
          .setFromEuler(new THREE.Euler(Math.PI / 2, Math.PI / 2, 0));
        body.position = {x: 0, y: 0, z: 0};
        // parent already rotated on x, so child only needs y rotation
        el.object3D.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
        component.syncFromPhysics();
        var eulerOut = new THREE.Euler();
        eulerOut.setFromQuaternion(childEl.object3D.quaternion);
        expect(eulerOut.x).to.be.closeTo(0, eps, 'x rotation');
        expect(eulerOut.y).to.be.closeTo(Math.PI / 2, eps, 'y rotation');
        expect(eulerOut.z).to.be.closeTo(0, eps, 'z rotation');
        done();
      });
    });
  });
});
