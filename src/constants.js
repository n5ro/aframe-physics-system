module.exports = {
  GRAVITY: -9.8,
  MAX_INTERVAL: 4 / 60,
  ITERATIONS: 4,
  CONTACT_MATERIAL: {
    friction: 0.01,
    restitution: 0.3,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3,
    frictionEquationStiffness: 1e8,
    frictionEquationRegularization: 3
  },
  ACTIVATION_STATES: {
    ACTIVE_TAG: 1,
    ISLAND_SLEEPING: 2,
    WANTS_DEACTIVATION: 3,
    DISABLE_DEACTIVATION: 4,
    DISABLE_SIMULATION: 5
  },
  COLLISION_FLAGS: {
    STATIC_OBJECT: 1,
    KINEMATIC_OBJECT: 2,
    NO_CONTACT_RESPONSE: 4,
    CUSTOM_MATERIAL_CALLBACK: 8, //this allows per-triangle material (friction/restitution)
    CHARACTER_OBJECT: 16,
    DISABLE_VISUALIZE_OBJECT: 32, //disable debug drawing
    DISABLE_SPU_COLLISION_PROCESSING: 64 //disable parallel/SPU processing
  }
};
