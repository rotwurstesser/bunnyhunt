import * as THREE from 'three';
import { Component } from '../../core/Component';
import { Ammo, createConvexHullShape } from '../../core/AmmoLib';

export default class LevelSetup extends Component {
  public readonly name = 'LevelSetup';

  private scene: THREE.Scene;
  private physicsWorld: Ammo.btDiscreteDynamicsWorld;
  private mesh: THREE.Object3D;

  constructor(mesh: THREE.Object3D, scene: THREE.Scene, physicsWorld: Ammo.btDiscreteDynamicsWorld) {
    super();
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.mesh = mesh;
  }

  LoadScene(): void {
    this.mesh.traverse((node) => {
      if ((node as THREE.Mesh).isMesh || (node as THREE.Light).isLight) {
        node.castShadow = true;
      }
      if ((node as THREE.Mesh).isMesh) {
        node.receiveShadow = true;
        this.SetStaticCollider(node as THREE.Mesh);
      }

      if ((node as THREE.Light).isLight) {
        const light = node as THREE.DirectionalLight;
        light.intensity = 3;
        const shadow = light.shadow;
        const lightCam = shadow.camera as THREE.OrthographicCamera;

        shadow.mapSize.width = 1024 * 3;
        shadow.mapSize.height = 1024 * 3;
        shadow.bias = -0.00007;

        const dH = 35,
          dV = 35;
        lightCam.left = -dH;
        lightCam.right = dH;
        lightCam.top = dV;
        lightCam.bottom = -dV;
      }
    });

    this.scene.add(this.mesh);
  }

  SetStaticCollider(mesh: THREE.Mesh): void {
    const shape = createConvexHullShape(mesh);
    const mass = 0;
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    const motionState = new Ammo.btDefaultMotionState(transform);

    const localInertia = new Ammo.btVector3(0, 0, 0);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    const object = new Ammo.btRigidBody(rbInfo);
    (object as any).parentEntity = this.parent;
    (object as any).mesh = mesh;

    this.physicsWorld.addRigidBody(object);
  }

  Initialize(): void {
    this.LoadScene();
  }
}
