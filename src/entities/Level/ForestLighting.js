import * as THREE from 'three'
import Component from '../../Component'

export default class ForestLighting extends Component {
    constructor(scene) {
        super();
        this.name = 'ForestLighting';
        this.scene = scene;
    }

    Initialize() {
        this.CreateLighting();
    }

    CreateLighting() {
        // Warm sun light
        const sunLight = new THREE.DirectionalLight(0xfff4e5, 1.2);
        sunLight.position.set(30, 50, 20);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 300;
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        this.scene.add(sunLight);

        // Ambient light for shadows
        const ambientLight = new THREE.AmbientLight(0x6b8cff, 0.4);
        this.scene.add(ambientLight);

        // Sky color
        this.scene.background = new THREE.Color(0x87ceeb);

        // Optional fog for depth (extended for infinite terrain)
        this.scene.fog = new THREE.Fog(0x87ceeb, 60, 200);
    }
}
