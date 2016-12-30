AFRAME.registerComponent('collision-filter', {
  schema: {
    group: {default: 'default'},
    collidesWith: {default: ['default']},
  },
  init: function () {
    this.system.registerMe(this);
    if (this.el.body) {
      this.updateBody();
    } else {
      this.el.addEventListener('body-loaded', this.initBody.bind(this));
    }
  },
  remove: function () {
    this.pause();
  },
  initBody: function () {
    this.oldFilterGroup = this.el.body.collisionFilterGroup;
    this.oldFilterMask = this.el.body.collisionFilterMask;
    this.updateBody();
  },
  updateBody: function () {
    this.el.body.collisionFilterMask =
      this.system.getFilterCode(this.data.collidesWith);
    this.el.body.collisionFilterGroup =
      this.system.getFilterCode(this.data.group);
  },
  update: function () {
    // register any new groups
    this.system.registerMe(this);
    if(this.el.body) this.updateBody();
  },
  play: function () {
    if(this.el.body) this.updateBody();
  },
  pause: function () {
    if (this.el.body) {
      this.el.body.collisionFilterMask = this.oldFilterMask;
      this.el.body.collisionFilterGroup = this.oldFilterGroup;
    }
  },

});


AFRAME.registerSystem('collision-filter', {
  schema: {
    collisionGroups: {default: ['default']}
  },

  dependencies: ['physics'],

  registerMe: function (comp) {
    // add any unknown groups to the master list
    elGroups = comp.data.collidesWith.slice();
    elGroups.push(comp.data.group);
    var collisionGroups = this.data.collisionGroups;
    elGroups.forEach(function(elGroup) {
      if(collisionGroups.indexOf(elGroup) === -1) {
        collisionGroups.push(elGroup);
      }
    });
  },

  getFilterCode: function (elGroups) {
    var code = 0;
    var collisionGroups = this.data.collisionGroups;
    // convert single item groups for processing
    if(!Array.isArray(elGroups)) elGroups = Array.of(elGroups);
    // each group corresponds to a bit which is turned on when matched
    // floor negates any unmatched groups (2^-1 = 0.5)
    elGroups.forEach(function(elGroup) {
      code = code + Math.floor(Math.pow(2, collisionGroups.indexOf(elGroup)));
    });
    return code;
  }

});
