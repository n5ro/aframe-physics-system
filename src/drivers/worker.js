var Event = require('./event'),
    LocalDriver = require('./local-driver'),
    protocol = require('../utils/protocol');

var ID = protocol.ID;

module.exports = function (self) {

  var driver = new LocalDriver();
  var bodies = {};
  var stepSize;

  self.addEventListener('message', function (event) {

    var data = event.data;

    switch (data.type) {
      // Lifecycle.
      case Event.INIT:
        driver.init(data.worldConfig);
        stepSize = 1 / data.fps;
        setInterval(step, 1000 / data.fps);
        break;

      // Bodies.
      case Event.ADD_BODY:
        var body = protocol.deserializeBody(data.body);
        bodies[body[ID]] = body;
        driver.addBody(body);
        break;
      case Event.REMOVE_BODY:
        driver.removeBody(bodies[data.bodyID]);
        delete bodies[data.bodyID];
        break;
      case Event.APPLY_BODY_METHOD:
        bodies[data.bodyID][data.methodName].apply(
          bodies[data.bodyID],
          [protocol.deserializeVec3(data.args[0]), protocol.deserializeVec3(data.args[1])]
        );
        break;
      case Event.UPDATE_BODY_PROPERTIES:
        protocol.deserializeBodyUpdate(data.body, bodies[data.body.id]);
        break;

      // Materials.
      case Event.ADD_MATERIAL:
        driver.addMaterial(data.materialConfig);
        break;
      case Event.ADD_CONTACT_MATERIAL:
        driver.addContactMaterial(
          data.materialName1,
          data.materialName2,
          data.contactMaterialConfig
        );
        break;

      // Constraints.
      case Event.ADD_CONSTRAINT:
      case Event.REMOVE_CONSTRAINT:
        console.warn('[Worker] Not implemented');
        break;

      default:
        throw new Error('[Worker] Unexpected event type: %s', data.type);

    }
  });

  function step () {
    driver.step(stepSize);

    var bodyMessages = {};
    Object.keys(bodies).forEach(function (id) {
      bodyMessages[id] = protocol.serializeBody(bodies[id]);
    });

    self.postMessage({type: Event.STEP, bodies: bodyMessages});
  }

};
