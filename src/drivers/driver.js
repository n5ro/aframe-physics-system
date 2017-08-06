/**
 * Driver - defines limited API to local and remote physics controllers.
 */

function Driver () {}

module.exports = Driver;

/******************************************************************************
 * Lifecycle
 */

/* @param {object} worldConfig */
Driver.prototype.init = abstractMethod;

/* @param {number} deltaMS */
Driver.prototype.step = abstractMethod;

Driver.prototype.destroy = abstractMethod;

/******************************************************************************
 * Bodies
 */

/* @param {CANNON.Body} body */
Driver.prototype.addBody = abstractMethod;

/* @param {CANNON.Body} body */
Driver.prototype.removeBody = abstractMethod;

/**
 * @param {CANNON.Body} body
 * @param {string} methodName
 * @param {Array} args
 */
Driver.prototype.applyBodyMethod = abstractMethod;

/** @param {CANNON.Body} body */
Driver.prototype.updateBodyProperties = abstractMethod;

/******************************************************************************
 * Materials
 */

/** @param {object} materialConfig */
Driver.prototype.addMaterial = abstractMethod;

/**
 * @param {string} materialName1
 * @param {string} materialName2
 * @param {object} contactMaterialConfig
 */
Driver.prototype.addContactMaterial = abstractMethod;

/******************************************************************************
 * Constraints
 */

/* @param {CANNON.Constraint} constraint */
Driver.prototype.addConstraint = abstractMethod;

/* @param {CANNON.Constraint} constraint */
Driver.prototype.removeConstraint = abstractMethod;

/******************************************************************************
 * Contacts
 */

/** @return {Array<object>} */
Driver.prototype.getContacts = abstractMethod;

/*****************************************************************************/

function abstractMethod () {
  throw new Error('Method not implemented.');
}
