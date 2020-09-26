# Ammo Driver

[Ammo.js](https://github.com/kripken/ammo.js/) is an [Emscripten](https://emscripten.org/) port of [Bullet](https://github.com/bulletphysics/bullet3), a widely used open-source physics engine.

## Contents

- [Considerations](#considerations-before-use)
- [Installation](#installation)
- [Basics](#basics)
- [Components](#components)
  - [`ammo-body`](#ammo-body)
  - [`ammo-shape`](#ammo-shape)
  - [`ammo-constraint`](#ammo-constraint)
- [Using the Ammo.js API](#using-the-ammojs-api)
- [Events](#events)
- [System Configuration](#system-configuration)

## Considerations Before Use

The Ammo.js driver provides many features and new functionality that the existing Cannon.js integration lacks. However, there are several things to keep in mind before using the Ammo.js driver:

- The Ammo.js binaries are not a dependency of `Aframe-Physics-System`. You will need to include this into your project yourself. See: [Including the Ammo.js Build](#including-the-ammojs-build).
- The Ammo.js binaries are several times larger than the Cannon.js binary. This shouldn't matter for most usages unless working in very memory sensitive environments.
- new Ammo specific components provide a simple interface for interacting with the Ammo.js code, however it is possible to directly use Ammo.js classes and functions. It is recommended to familiarize yourself with [Emscripten](https://emscripten.org/) if you do so. See: [Using the Ammo.js API](#using-the-ammojs-api).

## Installation

Initial installation is the same as for Cannon.js. See: [Scripts](https://github.com/donmccurdy/aframe-physics-system/blob/master/README.md#installation), then see [Including the Ammo.js Build](#including-the-ammojs-build).

### Including the Ammo.js build

Ammo.js is not a dependency of this project. As a result, it must be included into your project manually. Recommended options are: [script tag](#script-tag) or [NPM and Webpack](#npm-and-webpack).
The latest [WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly) build is available either via the [Ammo.js github](http://kripken.github.io/ammo.js/builds/ammo.wasm.js) (`http://kripken.github.io/ammo.js/builds/ammo.wasm.js`) or the [Mozilla Reality fork](https://mixedreality.mozilla.org/ammo.js/builds/ammo.wasm.js) (`https://mixedreality.mozilla.org/ammo.js/builds/ammo.wasm.js`) maintained by the [Mozilla Hubs](https://github.com/mozilla/hubs) team. The latter is especially optimized for use with the Ammo Driver and includes [some functionality](#hacd-and-vhacd) not yet available in the main repository.

#### Script Tag

This is the easiest way to include Ammo.js in your project and is recommended for most AFrame projects. Simply add the following to your html file:

```html
<script src="https://mixedreality.mozilla.org/ammo.js/builds/ammo.wasm.js"></script>
or
<script src="http://kripken.github.io/ammo.js/builds/ammo.wasm.js"></script>
```

#### NPM and Webpack

For more advanced projects that use npm and webpack, first `npm install` whichever version of ammo.js desired.
`npm install github:mozillareality/ammo.js#hubs/master`
or
`npm install github:kripken/ammo.js#master`
Then, the following is a workaround to allow webpack to load the .wasm binary correctly. Include the following in your `package.json`'s `main` script (or some other path as configured by your `webpack.config.json`):

```js
const Ammo = require("ammo.js/builds/ammo.wasm.js");
const AmmoWasm = require("ammo.js/builds/ammo.wasm.wasm");
window.Ammo = Ammo.bind(undefined, {
  locateFile(path) {
    if (path.endsWith(".wasm")) {
      return AmmoWasm;
    }
    return path;
  }
});
require("aframe-physics-system"); //note this require must happen after the above
```

Finally, add the following rule to your `webpack.config.json`:

```js
{
    test: /\.(wasm)$/,
    type: "javascript/auto",
    use: {
        loader: "file-loader",
        options: {
            outputPath: "assets/wasm", //set this whatever path you desire
            name: "[name]-[hash].[ext]"
        }
    }
},
```

See [this gist](https://gist.github.com/surma/b2705b6cca29357ebea1c9e6e15684cc) for more information.

## Basics

To begin using the Ammo.js driver, `driver: ammo` must be set in the declaration for the physics system on the `a-scene`. Similar to the old API, `debug: true` will enable wireframe debugging of physics shapes/bodies, however this can further be configured via `debugDrawMode`. See [AmmoDebugDrawer](https://github.com/InfiniteLee/ammo-debug-drawer/blob/0b2c323ef65b4fd414235b6a5e705cfc1201c765/AmmoDebugDrawer.js#L3) for debugDrawMode options.

```html
<a-scene physics=" driver: ammo; debug: true; debugDrawMode: 1;">
  <!-- ... -->
</a-scene>
```

To create a physics body, both an `ammo-body` and at least one `ammo-shape` component should be added to an entity.

```html
<!-- Static box -->
<a-box position="0 0.5 -5" width="3" height="1" depth="1" ammo-body="type: static" ammo-shape="type: box"></a-box>

<!-- Dynamic box -->
<a-box position="5 0.5 0" width="1" height="1" depth="1" ammo-body="type: dynamic" ammo-shape="type: box"></a-box>
```

See [examples/ammo.html](/examples/ammo.html) for a working sample.

## Components

### `ammo-body`

An `ammo-body` component may be added to any entity in a scene. While having only an `ammo-body` will technically give you a valid physics body in the scene, only after adding an `ammo-shape` will your entity begin to collide with other objects.

| Property                 | Default    | Description                                                                                                                                             |
| ------------------------ |----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type                     | `dynamic`  | Options: `dynamic`, `static`, `kinematic`. See [ammo-body type](#ammo-body-type).                                                                       |
| loadedEvent              | —          | Optional event to wait for before the body attempt to initialize.                                                                                       |
| mass                     | `1`        | Simulated mass of the object, >= 0.                                                                                                                     |
| gravity                  | `0 -9.8 0` | Set the gravity for this specific object.                                                                                                               |
| linearDamping            | `0.01`     | Resistance to movement.                                                                                                                                 |
| angularDamping           | `0.01`     | Resistance to rotation.                                                                                                                                 |
| linearSleepingThreshold  | `1.6`      | Minimum movement cutoff before a body can enter `activationState: wantsDeactivation`                                                                   |
| angularSleepingThreshold | `2.5`      | Minimum rotation cutoff before a body can enter `activationState: wantsDeactivation`                                                                   |
| angularFactor            | `1 1 1`    | Constrains how much the body is allowed to rotate on an axis. E.g. `1 0 1` will prevent rotation around y axis.                                         |
| activationState          | `active`   | Options: `active`, `islandSleeping`, `wantsDeactivation`, `disableDeactivation`, `disableSimulation`. See [Activation States](#activation-states)   |
| emitCollisionEvents      | `false`    | Set to true to enable firing of `collidestart` and `collideend` events on this entity. See [Events](#events).                                           |
| disableCollision         | `false`    | Set to true to disable object from colliding with all others.                                                                                           |
| collisionFilterGroup     | `1`        | 32-bit bitmask to determine what collision "group" this object belongs to. See: [Collision Filtering](#collision-filtering).                            |
| collisionFilterMask      | `1`        | 32-bit bitmask to determine what collision "groups" this object should collide with. See: [Collision Filtering](#collision-filtering).                 |
| scaleAutoUpdate          | `true`     | Should the shapes of the objecct be automatically scaled to match the scale of the entity.                                                              |

#### `ammo-body` type

The `type` of an ammo body can be one of the following:

- `dynamic`: A freely-moving object. Dynamic bodies have mass, collide with other bodies, bounce or slow during collisions, and fall if gravity is enabled.
- `static`: A fixed-position object. Other bodies may collide with static bodies, but static bodies themselves are unaffected by gravity and collisions. These bodies should typically not be moved after initialization as they cannot impart forces on `dynamic` bodies.
- `kinematic`: Like a `static` body, except that they can be moved via updating the position of the entity. Unlike a `static` body, they impart forces on `dynamic` bodies when moved. Useful for animated or remote (networked) objects.

#### Activation States

Activation states are only used for `type: dynamic` bodies. Most bodies should be left at the default `activationState: active` so that they can go to sleep (sleeping bodies are very cheap). It can be useful to set bodies to `activationState: disableDeactivation` if also using an `ammo-constraint` as constraints will stop functioning if the body goes to sleep, however they should be used sparingly. Each activation state has a color used for wireframe rendering when debug is enabled.

| state                   | debug rendering color | description                                                                                                                                                                                 |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `active`                | white                 | Waking state. Bodies will enter this state if collisions with other bodies occur. This is the default state.                                                                                |
| `islandSleeping`       | green                 | Sleeping state. Bodies will enter this state if they fall below `linearSleepingThreshold` and `angularSleepingThreshold` and no other `active` or `disableDeactivation` bodies are nearby. |
| `wantsDeactivation`    | cyan                  | Intermediary state between `active` and `islandSleeping`. Bodies will enter this state if they fall below `linearSleepingThreshold` and `angularSleepingThreshold`.                        |
| `disableDeactivation`  | red                   | Forced `active` state. Bodies set to this state will never enter `islandSleeping` or `wantsDeactivation`.                                                                                 |
| `disableSimulation`    | yellow                | Bodies in this state will be completely ignored by the physics system.                                                                                                                      |

#### Collision Filtering

Collision filtering allows you to control what bodies are allowed to collide with others. For Ammo.js, they are represented as two 32-bit bitmasks, `collisionFilterGroup` and `collisionFilterMask`.

Using collision filtering requires basic understanding of the [bitwise OR](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators#(Bitwise_OR)) (`a | b`) and [bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators#(Bitwise_AND)) (`a & b`) operations.

Example:
Imagine 3 groups of objects, `A`, `B`, and `C`. We will say their bit values are as follows:

```js
collisionGroups: {
    A: 1,
    B: 2,
    C: 4
}
```

Assume all A objects should only collide with other A objects, and only B objects should collide with other B objects.

```html
<!-- All A objects will look like this -->
<a-entity id="alpha" ammo-body="collisionFilterGroup: 1; collisionFilterMask: 1;"></a-entity>
<!-- All B objects will look like this -->
<a-entity id="beta" ammo-body="collisionFilterGroup: 2; collisionFilterMask: 2;"></a-entity>
```

Now Assume all C objects can collide with either A or B objects.

```html
<!-- All A objects will look like this -->
<a-entity id="alpha" ammo-body="collisionFilterGroup: 1; collisionFilterMask: 5;"></a-entity>
<!-- All B objects will look like this -->
<a-entity id="beta" ammo-body="collisionFilterGroup: 2; collisionFilterMask: 6;"></a-entity>
<!-- All C objects will look like this -->
<a-entity id="gamma" ammo-body="collisionFilterGroup: 4; collisionFilterMask: 7;"></a-entity>
```

Note that the `collisionFilterMask` for `A` and `B` changed to `5` and `6` respectively. This is because the bitwise `OR` of collision groups `A` and `C` is  `1 | 4 = 5` and for `B` and `C` is  `2 | 4 = 6` . The `collisionFilterMask` for `C` is `7` because `1 | 2 | 4 = 7`. When two bodies collide, both bodies compare their `collisionFilterMask` with the colliding body's `collisionFilterGroup` using the bitwise `AND` operator and checks for equality with `0`. If the result of the `AND` for either pair is equal to `0`, the objects are not allowed to collide.

```js
// Object α (alpha) in group A and object β (beta) in group B overlap.

// α checks if it can collide with β. (α's collisionFilterMask AND β's collisionFilterGroup)
(5 & 2) = 0;

// β checks if it can collide with α. (β's collisionFilterMask AND α's collisionFilterGroup)
(6 & 1) = 0;

// Both checks equal 0; α and β do not collide.

// Now, object γ (gamma) in group C is overlapping with object β.

// β checks if it can collide with γ. (β's collisionFilterMask AND γ's collisionFilterGroup)
(6 & 7) = 6;

// γ checks if it can collide with β. (γ's collisionFilterMask AND β's collisionFilterGroup)
(7 & 2) = 2;

// Neither check equals 0; β and γ collide.
````

See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators#Flags_and_bitmasks for more information about bitmasks.

### `ammo-shape`

Any entity with an `ammo-body` component can also have 1 or more `ammo-shape` components. The `ammo-shape` component is what defines the collision shape of the entity. `ammo-shape` components can be added and removed at any time. The actual work of generating a `btCollisionShape` is done via an external library, [Three-to-Ammo](https://github.com/infinitelee/three-to-ammo).

| Property            | Dependencies                                              | Default                       | Description                                                                                                                               |
| ------------------- | --------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| type                | —                                                         | `hull`                        | Options: `box`, `cylinder`, `sphere`, `capsule`, `cone`, `hull`, `hacd`, `vhacd`, `mesh`, `heightfield`. see [Shape Types](#shape-types). |
| fit                 | —                                                         | `all`                         | Options: `all`, `manual`. Use `manual` if defining `halfExtents` or `sphereRadius` below. See [Shape Fit](#shape-fit).                    |
| halfExtents         | `fit: manual` and `type: box, cylinder, capsule, cone`    | `1 1 1`                       | Set the halfExtents to use.                                                                                                               |
| minHalfExtent       | `fit: all` and `type: box, cylinder, capsule, cone`       | `0`                           | The minimum value for any axis of the halfExtents.                                                                                        |
| maxHalfExtent       | `fit: all` and `type: box, cylinder, capsule, cone`       | `Number.POSITIVE_INFINITY`    | The maximum value for any axis of the halfExtents.                                                                                        |
| sphereRadius        | `fit: manual` and `type: sphere`                          | `NaN`                         | Set the radius for spheres.                                                                                                               |
| cylinderAxis        | —                                                         | `y`                           | Options: `x`, `y`, `z`. Override default axis for `cylinder`, `capsule`, and `cone` types.                                                |
| margin              | —                                                         | `0.01`                        | The amount of 'padding' to add around the shape. Larger values have better performance but reduce collision shape precision.              |
| offset              | —                                                         | `0 0 0`                       | Where to position the shape relative to the origin of the entity.                                                                         |
| heightfieldData     | `fit: manual` and `type: heightfield`                     | `[]`                          | An array of arrays of float values that represent a height at a fixed interval `heightfieldDistance`                                      |
| heightfieldDistance | `fit: manual` and `type: heightfield`                     | `1`                           | The distance between each height value in both the x and z direction in `heightfieldData`                                                 |
| includeInvisible    | `fit: all`                                                | `false`                       | Should invisible meshes be included when using `fit: all`                                                                                 |

#### Shape Types

- **Primitives**
  - **Box** (`box`) – Requires `halfExtents` if using `fit: manual`.
  - **Cylinder** (`cylinder`) – Requires `halfExtents` if using `fit: manual`. Use `cylinderAxis` to change which axis the length of the cylinder is aligned.
  - **Sphere** (`sphere`) – Requires `sphereRadius` if using `fit: manual`.
  - **Capsule** (`capsule`) – Requires `halfExtents` if using `fit: manual`. Use `cylinderAxis` to change which axis the length of the capsule is aligned.
  - **Cone** (`cone`) – Requires `halfExtents` if using `fit: manual`. Use `cylinderAxis` to change which axis the point of the cone is aligned.
- **Hull** (`hull`) – Wraps a model in a convex hull, like a shrink-wrap. Not quite as performant as primitives, but still very fast.
- **Hull Approximate Convex Decomposition** (`hacd`) – This is an experimental feature that generates multiple convex hulls to approximate any convex or concave shape.
- **Volumetric Hull Approximate Convex Decomposition** (`vhacd`) – Also experimental, this is `hacd` with a different algorithm. See: http://kmamou.blogspot.com/2014/11/v-hacd-v20-is-here.html for more information.
- **Mesh** (`mesh`) – Creates a 1:1 concave collision shape with the triangles of the meshes of the entity. May only be used on `static` bodies. This is the least performant shape, however they can work very well for static environments if the following is observed:
  - Avoid using meshes with very high triangle density relative to size of convex objects (primitives and hulls) colliding with the mesh. E.g. avoid meshes where an object could collide with dozens or more triangles in a single spot.
  - Avoid very high poly meshes in general and use mesh decimation (simplification) if possible.
- **Heightfield** (`heightfield`) – Similar to a mesh shape, but you must provide an array of heights and the distance between those values. E.g. `heightfieldData: [[0, 0, 0], [0, 1, 0], [0, 0, 0]]` and `heightfieldDistance: 1` will create a 3x3 meter heightfield with a height of 0 except for the center with a height of 1.

#### Shape Fit

- `fit: all` – Requires a mesh to exist on the entity. The specified shape will be created to contain all the vertices of the mesh.
- `fit: manual` – Does not require a mesh, however you must specifiy either the `halfExtents` or `sphereRadius` manually. This is not supported for `hull`, `hacd`, `vhacd` and `mesh` types.

### `ammo-constraint`

The `ammo-constraint` component is used to bind `ammo-bodies` together using hinges, fixed distances, or fixed attachment points. Note that an `ammo-shape` is not required for `ammo-constraint` to work, however you may get strange results with some constraint types.

Example:

```html
<a-box id="other-box" ammo-body ammo-shape />
<a-box ammo-constraint="target: #other-box;" ammo-body ammo-shape />
```

| Property    | Dependencies                           | Default | Description                                                                               |
| ----------- | -------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| type        | —                                      | `lock`  | Options: `lock`, `fixed`, `spring`, `slider`, `hinge`, `coneTwist`, `pointToPoint`.     |
| target      | —                                      | —       | Selector for a single entity to which current entity should be bound.                     |
| pivot       | `type: pointToPoint, coneTwist, hinge` | `0 0 0` | Offset of the hinge or point-to-point constraint, defined locally in this element's body. |
| targetPivot | `type: pointToPoint, coneTwist, hinge` | `0 0 0` | Offset of the hinge or point-to-point constraint, defined locally in the target's body.   |
| axis        | `type: hinge`                          | `0 0 1` | An axis that each body can rotate around, defined locally to this element's body.         |
| targetAxis  | `type: hinge`                          | `0 0 1` | An axis that each body can rotate around, defined locally to the target's body.           |

## Using the Ammo.js API

The Ammo.js API lacks any usage documentation. Instead, it is recommended to read the [Bullet 2.83 documentation](https://github.com/bulletphysics/bullet3/tree/master/docs), the [Bullet forums](https://pybullet.org/Bullet/phpBB3/) and the [Emscripten WebIDL Binder documentation](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/WebIDL-Binder.html). Note that the linked Bullet documentation is for Bullet 2.83, where as Ammo.js is using 2.82, so some features described in the documentation may not be available.

Some things to note:

- Not all classes and properties in Bullet are available. Each class and property has to be 'exposed' via a definition in [ammo.idl](https://github.com/MozillaReality/ammo.js/blob/hubs/master/ammo.idl).
- There is no automatic garbage collection for instantiated Bullet objects. Any time you use the `new` keyword for a Bullet class you must also at some point (when you are done with the object) release the memory by calling `Ammo.destroy`.

```js
const vector3 = new Ammo.btVector3();
... do stuff
Ammo.destroy(vector3);
```

- Exposed properties on classes can be accessed via specially generated `get_<property>()` and `set_<property>()` functions. E.g. `rayResultCallback.get_m_collisionObject();`
- Sometimes when calling certain functions you will receive a pointer object instead of an instance of the class you are expecting. Use `Ammo.wrapPointer` to "wrap" the pointer in the class you expected. E.g. `Ammo.wrapPointer(ptr, Ammo.btRigidBody);`
- Conversely, sometimes you need the pointer of an object. Use `Ammo.getPointer`. E.g. `const ptr = Ammo.getPointer(object);`.

In A-Frame, each entity's `btRigidBody` instance is exposed on the `el.body` property. To apply a quick push to an object, you might do the following:

```html
<a-scene>
  <a-entity id="nyan" dynamic-body="shape: hull" obj-model="obj: url(nyan-cat.obj)"></a-entity>
  <a-plane static-body></a-plane>
</a-scene>
```

```javascript
var el = sceneEl.querySelector('#nyan');
const force = new Ammo.btVector3(0, 1, -0);
const pos = new Ammo.btVector3(el.object3D.position.x, el.object3D.position.y, el.object3D.position.z);
el.body.applyForce(force, pos);
Ammo.destroy(force);
Ammo.destroy(pos);
```

## Events

| event         | description                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `body-loaded` | Fired when physics body (`el.body`) has been created.                                               |
| `collidestart`     | Fired when two bodies collide. `emitCollisionEvents: true` must be set on the `ammo-body`.          |
| `collideend` | Fired when two bodies stop colliding. `emitCollisionEvents: true` must be set on the `ammo-body`.   |

### Collisions

`ammo-driver` generates events when a collision has started or ended, which are propagated onto the associated A-Frame entity. Example:

```javascript
var playerEl = document.querySelector("[camera]");
playerEl.addEventListener("collide", function(e) {
  console.log("Player has collided with body #" + e.detail.targetEl.id);
  e.detail.targetEl; // Other entity, which playerEl touched.
});
```

The current map of collisions can be accessed via `AFRAME.scenes[0].systems.physics.driver.collisions`. This will return a map keyed by each `btRigidBody` (by pointer) with value of an array of each other `btRigidBody` it is currently colliding with.

## System Configuration

| Property      | Default   | Description                                                                                                                                 |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| driver        | `local`   | [`local`, `worker`, `ammo`]                                                                                                                 |
| debug         | `true`    | Whether to show wireframes for debugging.                                                                                                   |
| debugDrawMode | `0`       | See [AmmoDebugDrawer](https://github.com/InfiniteLee/ammo-debug-drawer/blob/0b2c323ef65b4fd414235b6a5e705cfc1201c765/AmmoDebugDrawer.js#L3) |
| gravity       | `-9.8`    | Force of gravity (in m/s^2).                                                                                                                |
| iterations    | `10`      | The number of solver iterations determines quality of the constraints in the world.                                                         |
| maxSubSteps   | `4`       | The max number of physics steps to calculate per tick.                                                                                      |
| fixedTimeStep | `0.01667` | The internal framerate of the physics simulation.                                                                                           |
