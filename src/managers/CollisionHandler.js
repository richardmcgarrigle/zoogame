/**
 * CollisionHandler
 *
 * Listens for Matter.js collisionstart events and dispatches to registered
 * handler functions based on the labels of the two colliding bodies.
 *
 * New collision types can be added as entries in the _handlers dispatch table
 * without editing the main handler block.
 */
export default class CollisionHandler {
  constructor(scene) {
    this.scene = scene;

    // Label-pair dispatch table. Order of `a` and `b` does not matter —
    // _onCollision normalises the pair before looking up handlers.
    this._handlers = [
      {
        a: 'fruit',
        b: 'goal',
        fn: (_fBody, _gBody) => scene.onGoalScored(),
      },
      {
        a: 'fruit',
        b: 'platform',
        fn: (fBody, _pBody) => scene.bounceFruitOffPlatform(fBody),
      },
    ];

    scene.matter.world.on('collisionstart', this._onCollision, this);
  }

  _onCollision(event) {
    const walls = this.scene.matter.world.walls;

    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;

      // Run label-pair dispatch table.
      for (const entry of this._handlers) {
        if (
          (bodyA.label === entry.a && bodyB.label === entry.b) ||
          (bodyA.label === entry.b && bodyB.label === entry.a)
        ) {
          // Always pass the 'a'-labelled body as the first argument.
          const bodyForA = bodyA.label === entry.a ? bodyA : bodyB;
          const bodyForB = bodyForA === bodyA ? bodyB : bodyA;
          entry.fn(bodyForA, bodyForB);
        }
      }

      // Wall bounce and bounce sound — these depend on wall identity, not just
      // labels, so they live outside the dispatch table.
      if (bodyA.label === 'fruit' || bodyB.label === 'fruit') {
        const fruitBody = bodyA.label === 'fruit' ? bodyA : bodyB;
        const otherBody = fruitBody === bodyA ? bodyB : bodyA;

        if (otherBody === walls.left || otherBody === walls.right) {
          this.scene.bounceFruitOffWall(
            fruitBody,
            otherBody === walls.left ? 1 : -1,
          );
        }

        // Only play on real impacts — rolling has near-zero vy, bouncing doesn't.
        const vy = Math.abs(fruitBody.velocity.y);
        if (vy > 2) this.scene.sounds?.playBounce(vy);
      }
    }
  }

  destroy() {
    this.scene.matter.world.off('collisionstart', this._onCollision, this);
  }
}
