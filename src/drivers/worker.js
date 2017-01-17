var Event = require('./event'),
    LocalDriver = require('./local-driver'),
    protocol = require('../utils/protocol');

module.exports = function (self) {

  var driver = new LocalDriver();

  self.addEventListener('message',function (event){

    var data = event.data;

    console.log('Worker received: %o', data);

    switch (data.type) {
      // Lifecycle.
      case Event.INIT:
        driver.init(data.worldConfig);
        break;

      // Bodies.
      case Event.ADD_BODY:
        driver.addBody(protocol.deserializeBody(data.body));
        break;
      case Event.REMOVE_BODY:
      case Event.APPLY_BODY_METHOD:
        console.warn('[Worker] Not implemented');
        break;
      case Event.UPDATE_BODY_PROPERTIES:
        for (var body, i = 0; (body = driver.world.bodies[i]); i++) {
          // TODO(donmccurdy): IDs are not consistent.
          if (body.id === data.body.id) {
            protocol.deserializeBodyUpdate(data.body, body);
            break;
          }
        }
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

  setInterval(function () {
    if (!driver.world) return;

    // TODO(donmccurdy): This is arbitrary.
    driver.step(0.005);

    var bodies = {};
    driver.world.bodies.forEach(function (body) {
      // TODO(donmccurdy): IDs are not consistent.
      bodies[body.id] = protocol.serializeBody(body);
    });

    self.postMessage({type: Event.STEP, bodies: bodies});

  }, 5);

};
