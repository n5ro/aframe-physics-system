var CONSTANTS = require('./constants'),
    C_GRAV = CONSTANTS.GRAVITY,
    C_MAT = CONSTANTS.CONTACT_MATERIAL;

var LocalDriver = require('./drivers/local-driver'),
    WorkerDriver = require('./drivers/worker-driver'),
    ServerDriver = require('./drivers/server-driver');

/**
 * Physics system.
 */
module.exports = {
  schema: {
    // CANNON.js driver type
    driver:                         { default: 'local', oneOf: ['local', 'worker', 'server'] },
    serverUrl:                      { default: '' },
    workerFps:                      { default: 60 },

    gravity:                        { default: C_GRAV },
    iterations:                     { default: CONSTANTS.ITERATIONS },
    friction:                       { default: C_MAT.friction },
    restitution:                    { default: C_MAT.restitution },
    contactEquationStiffness:       { default: C_MAT.contactEquationStiffness },
    contactEquationRelaxation:      { default: C_MAT.contactEquationRelaxation },
    frictionEquationStiffness:      { default: C_MAT.frictionEquationStiffness },
    frictionEquationRegularization: { default: C_MAT.frictionEquationRegularization },

    // Never step more than four frames at once. Effectively pauses the scene
    // when out of focus, and prevents weird "jumps" when focus returns.
    maxInterval:                    { default: 4 / 60 },

    // If true, show wireframes around physics bodies.
    debug:                          { default: false },
  },

  /**
   * Update phases, used to separate physics simulation from updates to A-Frame scene.
   * @enum {string}
   */
  Phase: {
    SIMULATE: 'sim',
    RENDER:   'render'
  },

  /**
   * Initializes the physics system.
   */
  init: function () {
    var data = this.data;

    // If true, show wireframes around physics bodies.
    this.debug = data.debug;

    this.children = {};
    this.children[this.Phase.SIMULATE] = [];
    this.children[this.Phase.RENDER] = [];

    this.listeners = {};

    this.driver = null;
    switch (data.driver) {
      case 'local':  this.driver = new LocalDriver();                break;
      case 'worker': this.driver = new WorkerDriver(data.workerFps); break;
      case 'server': this.driver = new ServerDriver(data.serverUrl); break;
      default:
        throw new Error('[physics] Driver not recognized: "%s".', data.driver);
    }

    this.driver.init({
      quatNormalizeSkip: 0,
      quatNormalizeFast: false,
      solverIterations: data.iterations,
      gravity: data.gravity
    });

    this.driver.addMaterial({name: 'defaultMaterial'});
    this.driver.addContactMaterial('defaultMaterial', 'defaultMaterial', {
      friction: data.friction,
      restitution: data.restitution,
      contactEquationStiffness: data.contactEquationStiffness,
      contactEquationRelaxation: data.contactEquationRelaxation,
      frictionEquationStiffness: data.frictionEquationStiffness,
      frictionEquationRegularization: data.frictionEquationRegularization
    });
  },

  /**
   * Updates the physics world on each tick of the A-Frame scene. It would be
   * entirely possible to separate the two – updating physics more or less
   * frequently than the scene – if greater precision or performance were
   * necessary.
   * @param  {number} t
   * @param  {number} dt
   */
  tick: function (t, dt) {
    if (!dt) return;

    this.driver.step(Math.min(dt / 1000, this.data.maxInterval));

    var i;
    for (i = 0; i < this.children[this.Phase.SIMULATE].length; i++) {
      this.children[this.Phase.SIMULATE][i].step(t, dt);
    }

    for (i = 0; i < this.children[this.Phase.RENDER].length; i++) {
      this.children[this.Phase.RENDER][i].step(t, dt);
    }
  },

  /**
   * Adds a body to the scene, and binds proxied methods to the driver.
   * @param {CANNON.Body} body
   */
  addBody: function (body) {
    var driver = this.driver;

    body.__applyImpulse = body.applyImpulse;
    body.applyImpulse = function () {
      driver.applyBodyMethod(body, 'applyImpulse', arguments);
    };

    body.__applyForce = body.applyForce;
    body.applyForce = function () {
      driver.applyBodyMethod(body, 'applyForce', arguments);
    };

    body.updateProperties = function () {
      driver.updateBodyProperties(body);
    };

    this.driver.addBody(body);
  },

  /**
   * Removes a body and its proxied methods.
   * @param {CANNON.Body} body
   */
  removeBody: function (body) {
    this.driver.removeBody(body);

    body.applyImpulse = body.__applyImpulse;
    delete body.__applyImpulse;

    body.applyForce = body.__applyForce;
    delete body.__applyForce;

    delete body.updateProperties;
  },

  /** @param {CANNON.Constraint} constraint */
  addConstraint: function (constraint) {
    this.driver.addConstraint(constraint);
  },

  /** @param {CANNON.Constraint} constraint */
  removeConstraint: function (constraint) {
    this.driver.removeConstraint(constraint);
  },

  /**
   * Adds a component instance to the system, to be invoked on each tick during
   * the given phase.
   * @param {Component} component
   * @param {string} phase
   */
  addBehavior: function (component, phase) {
    this.children[phase].push(component);
  },

  /**
   * Removes a component instance from the system.
   * @param {Component} component
   * @param {string} phase
   */
  removeBehavior: function (component, phase) {
    this.children[phase].splice(this.children[phase].indexOf(component), 1);
  }
};
