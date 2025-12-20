import * as THREE from 'three';
import { Component } from '../../core/Component';
import { Ammo, AmmoHelper, CollisionFilterGroups } from '../../core/AmmoLib';
import type { Entity } from '../../core/Entity';

export default class AmmoBox extends Component {
  public readonly name = 'AmmoBox';

  private model: THREE.Object3D;
  private shape: Ammo.btCollisionShape;
  private scene: THREE.Scene;
  private world: Ammo.btDiscreteDynamicsWorld;

  private quat: Ammo.btQuaternion;
  private update = true;
  private trigger: Ammo.btGhostObject | null = null;
  private player: Entity | null = null;
  private playerPhysics: any = null;

  constructor(
    scene: THREE.Scene,
    model: THREE.Object3D,
    shape: Ammo.btCollisionShape,
    physicsWorld: Ammo.btDiscreteDynamicsWorld
  ) {
    super();
    this.model = model;
    this.shape = shape;
    this.scene = scene;
    this.world = physicsWorld;

    this.quat = new Ammo.btQuaternion();
  }

  Initialize(): void {
    this.player = this.FindEntity('Player');
    this.playerPhysics = this.player?.GetComponent('PlayerPhysics');

    this.trigger = AmmoHelper.CreateTrigger(this.shape);

    this.world.addCollisionObject(this.trigger, CollisionFilterGroups.SensorTrigger);
    this.scene.add(this.model);
  }

  Disable(): void {
    this.update = false;
    this.scene.remove(this.model);
    if (this.trigger) {
      this.world.removeCollisionObject(this.trigger);
    }
  }

  Update(t: number): void {
    if (!this.update) {
      return;
    }

    const entityPos = this.parent.position;
    const entityRot = this.parent.rotation;

    this.model.position.copy(entityPos);
    this.model.quaternion.copy(entityRot);

    if (this.trigger) {
      const transform = this.trigger.getWorldTransform();

      this.quat.setValue(entityRot.x, entityRot.y, entityRot.z, entityRot.w);
      transform.setRotation(this.quat);
      transform.getOrigin().setValue(entityPos.x, entityPos.y, entityPos.z);

      if (this.playerPhysics && AmmoHelper.IsTriggerOverlapping(this.trigger, this.playerPhysics.body)) {
        this.player?.Broadcast({ topic: 'AmmoPickup' });
        this.Disable();
      }
    }
  }
}
