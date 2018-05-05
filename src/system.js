var CANNON = require('cannon'),
    CONSTANTS = require('./constants'),
    C_GRAV = CONSTANTS.GRAVITY,
    C_MAT = CONSTANTS.CONTACT_MATERIAL;

var LocalDriver = require('./drivers/local-driver'),
    WorkerDriver = require('./drivers/worker-driver'),
    NetworkDriver = require('./drivers/network-driver'),
    AmmoDriver = require('./drivers/ammo-driver');

/**
 * Physics system.
 */
module.exports = AFRAME.registerSystem('physics', {
  schema: {
    // CANNON.js driver type
    driver:                         { default: 'local', oneOf: ['local', 'worker', 'network', 'ammo'] },
    networkUrl:                     { default: '', if: {driver: 'network'} },
    workerFps:                      { default: 60, if: {driver: 'worker'} },
    workerInterpolate:              { default: true, if: {driver: 'worker'} },
    workerInterpBufferSize:         { default: 2, if: {driver: 'worker'} },
    workerEngine:                   { default: 'cannon', if: {driver: 'worker'}, oneOf: ['cannon'] },
    workerDebug:                    { default: false, if: {driver: 'worker'} },

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
   * Initializes the physics system.
   */
  init: function () {
    var data = this.data;

    // If true, show wireframes around physics bodies.
    this.debug = data.debug;

    this.callbacks = {beforeStep: [], step: [], afterStep: []};

    this.listeners = {};

    this.driver = null;
    switch (data.driver) {
      case 'local':
        this.driver = new LocalDriver();
        break;

      case 'network':
        this.driver = new NetworkDriver(data.networkUrl);
        break;

      case 'worker':
        this.driver = new WorkerDriver({
          fps: data.workerFps,
          engine: data.workerEngine,
          interpolate: data.workerInterpolate,
          interpolationBufferSize: data.workerInterpBufferSize,
          debug: data.workerDebug
        });
        break;

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
    this.driver.addMaterial({name: 'staticMaterial'});
    this.driver.addContactMaterial('defaultMaterial', 'defaultMaterial', {
      friction: data.friction,
      restitution: data.restitution,
      contactEquationStiffness: data.contactEquationStiffness,
      contactEquationRelaxation: data.contactEquationRelaxation,
      frictionEquationStiffness: data.frictionEquationStiffness,
      frictionEquationRegularization: data.frictionEquationRegularization
    });
    this.driver.addContactMaterial('staticMaterial', 'defaultMaterial', {
      friction: 1.0,
      restitution: 0.0,
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

    var i;
    var callbacks = this.callbacks;

    for (i = 0; i < this.callbacks.beforeStep.length; i++) {
      this.callbacks.beforeStep[i].beforeStep(t, dt);
    }

    this.driver.step(Math.min(dt / 1000, this.data.maxInterval));

    for (i = 0; i < callbacks.step.length; i++) {
      callbacks.step[i].step(t, dt);
    }

    for (i = 0; i < callbacks.afterStep.length; i++) {
      callbacks.afterStep[i].afterStep(t, dt);
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

    this.listeners[body.id] = function (e) { body.el.emit('collide', e); };
    body.addEventListener('collide', this.listeners[body.id]);

    this.driver.addBody(body);
  },

  /**
   * Removes a body and its proxied methods.
   * @param {CANNON.Body} body
   */
  removeBody: function (body) {
    this.driver.removeBody(body);

    body.removeEventListener('collide', this.listeners[body.id]);
    delete this.listeners[body.id];

    body.applyImpulse = body.__applyImpulse;
    delete body.__applyImpulse;

    body.applyForce = body.__applyForce;
    delete body.__applyForce;

    delete body.updateProperties;
  },

  /** @param {CANNON.Constraint} constraint */
  addConstraint: function (constraint) {
    if (!constraint.type) {
      if (constraint instanceof CANNON.LockConstraint) {
        constraint.type = 'LockConstraint';
      } else if (constraint instanceof CANNON.DistanceConstraint) {
        constraint.type = 'DistanceConstraint';
      } else if (constraint instanceof CANNON.HingeConstraint) {
        constraint.type = 'HingeConstraint';
      } else if (constraint instanceof CANNON.ConeTwistConstraint) {
        constraint.type = 'ConeTwistConstraint';
      } else if (constraint instanceof CANNON.PointToPointConstraint) {
        constraint.type = 'PointToPointConstraint';
      }
    }
    this.driver.addConstraint(constraint);
  },

  /** @param {CANNON.Constraint} constraint */
  removeConstraint: function (constraint) {
    this.driver.removeConstraint(constraint);
  },

  /**
   * Adds a component instance to the system and schedules its update methods to be called
   * the given phase.
   * @param {Component} component
   * @param {string} phase
   */
  addComponent: function (component) {
    var callbacks = this.callbacks;
    if (component.beforeStep) callbacks.beforeStep.push(component);
    if (component.step)       callbacks.step.push(component);
    if (component.afterStep)  callbacks.afterStep.push(component);
  },

  /**
   * Removes a component instance from the system.
   * @param {Component} component
   * @param {string} phase
   */
  removeComponent: function (component) {
    var callbacks = this.callbacks;
    if (component.beforeStep) {
      callbacks.beforeStep.splice(callbacks.beforeStep.indexOf(component), 1);
    }
    if (component.step) {
      callbacks.step.splice(callbacks.step.indexOf(component), 1);
    }
    if (component.afterStep) {
      callbacks.afterStep.splice(callbacks.afterStep.indexOf(component), 1);
    }
  },

  /** @return {Array<object>} */
  getContacts: function () {
    return this.driver.getContacts();
  },

  getMaterial: function (name) {
    return this.driver.getMaterial(name);
  }
});
