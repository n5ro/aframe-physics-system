// Make dynamic bodies idle when not grabbed

AFRAME.registerComponent('sleepy', {
  schema: {
    speedLimit: {default: 0.25, type: 'number'},
    delay: {default: 0.25, type: 'number'},
    linearDamping: {default: 0.99, type: 'number'},
    angularDamping: {default: 0.99, type: 'number'},
    holdState: {default: 'grabbed'}
  },
  
  dependencies: ['dynamic-body'],

  init: function () {
    if (this.el.body) {
      this.initBody();
    } else {
      this.el.addEventListener('body-loaded', this.initBody.bind(this));
    }
  },
  
  initBody: function () {
    this.el.sceneEl.systems.physics.world.allowSleep = true;
    this.update();
    this.play();
    this.resumeState({detail: {state: this.data.holdState}});
  },
  

  update: function() {
    if(this.el.body) {
      this.el.body.sleepSpeedLimit = this.data.speedLimit;
      this.el.body.sleepTimeLimit = this.data.delay;
      this.el.body.linearDamping = this.data.linearDamping;
      this.el.body.angularDamping = this.data.angularDamping;
    }
  },
  
  play: function () {
    this.el.addEventListener('stateadded', this.holdState.bind(this));
    this.el.addEventListener('stateremoved', this.resumeState.bind(this));
  },
  
  pause: function () {
    this.el.removeEventListener('stateadded', this.holdState.bind(this));
    this.el.addEventListener('stateremoved', this.resumeState.bind(this));
  },
  // disble the sleeping while grabbed because sleep will break constraints
  holdState: function(evt) {
    if(evt.detail.state == this.data.holdState) {
       this.el.body.allowSleep = false;
    }
  },
  
  resumeState: function(evt) {
    if(evt.detail.state == this.data.holdState) {
      this.el.body.allowSleep = true;
    }
  }

});