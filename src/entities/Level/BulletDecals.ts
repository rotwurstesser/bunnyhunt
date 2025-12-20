import * as THREE from 'three';
import { Ammo } from '../../core/AmmoLib';
import { Component } from '../../core/Component';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry';
import type { HitEvent } from '../../types/events.types';

interface HitResult {
  intersectionNormal: THREE.Vector3;
  intersectionPoint: THREE.Vector3;
  collisionObject: unknown;
}

export default class LevelBulletDecals extends Component {
  public readonly name = 'LevelBulletDecals';

  private scene: THREE.Scene;
  private rot: THREE.Euler;
  private mat4: THREE.Matrix4;
  private position: THREE.Vector3;
  private up: THREE.Vector3;
  private scale: THREE.Vector3;
  private material: THREE.MeshStandardMaterial;

  constructor(
    scene: THREE.Scene,
    colorMap: THREE.Texture,
    normalMap: THREE.Texture,
    alphaMap: THREE.Texture
  ) {
    super();
    this.scene = scene;

    this.rot = new THREE.Euler();
    this.mat4 = new THREE.Matrix4();
    this.position = new THREE.Vector3(0, 0, 0);
    this.up = new THREE.Vector3(0, 1, 0);
    this.scale = new THREE.Vector3(1, 1, 1);
    this.material = new THREE.MeshStandardMaterial({
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      alphaMap,
      normalMap,
      map: colorMap,
      transparent: true,
    });
  }

  Hit = (e: { hitResult: HitResult }): void => {
    this.mat4.lookAt(this.position, e.hitResult.intersectionNormal, this.up);
    this.rot.setFromRotationMatrix(this.mat4);

    const size = Math.random() * 0.3 + 0.2;
    this.scale.set(size, size, 1.0);

    const rigidBody = Ammo.castObject(e.hitResult.collisionObject, Ammo.btRigidBody);
    const mesh = (rigidBody as any).mesh as THREE.Mesh;

    const m = new THREE.Mesh(
      new DecalGeometry(mesh, e.hitResult.intersectionPoint, this.rot, this.scale),
      this.material
    );
    this.scene.add(m);
  };

  Initialize(): void {
    this.parent.RegisterEventHandler(this.Hit, 'hit');
  }
}
