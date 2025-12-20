import * as THREE from 'three';
import { Component } from '../../core/Component';

export default class Sky2 extends Component {
  public readonly name = 'Sky';

  private scene: THREE.Scene;
  private texture: THREE.Texture;

  constructor(scene: THREE.Scene, skyTexture: THREE.Texture) {
    super();
    this.scene = scene;
    this.texture = skyTexture;
  }

  Initialize(): void {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xfffffff, 1);
    hemiLight.color.setHSL(0.6, 1, 0.6);
    hemiLight.groundColor.setHSL(0.095, 1, 0.75);
    this.scene.add(hemiLight);

    const skyGeo = new THREE.SphereGeometry(1000, 25, 25);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.texture,
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.rotateY(THREE.MathUtils.degToRad(-60));
    this.scene.add(sky);
  }
}
