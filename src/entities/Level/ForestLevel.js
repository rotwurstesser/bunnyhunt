import * as THREE from 'three'
import Component from '../../Component'
import { Ammo } from '../../AmmoLib'

export default class ForestLevel extends Component {
    constructor(scene, physicsWorld) {
        super();
        this.name = 'ForestLevel';
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.mapSize = 80;
        this.treeCount = 60;
    }

    Initialize() {
        this.CreateGround();
        this.CreateTrees();
        this.CreateLighting();
    }

    CreateGround() {
        // Simple flat ground plane
        const groundGeo = new THREE.PlaneGeometry(this.mapSize, this.mapSize, 20, 20);
        groundGeo.rotateX(-Math.PI / 2);

        // Add slight height variation for natural look
        const positions = groundGeo.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += Math.random() * 0.3; // Y variation
        }
        groundGeo.computeVertexNormals();

        // Grass green material
        const groundMat = new THREE.MeshLambertMaterial({
            color: 0x3a7d32,
            flatShading: true
        });

        this.ground = new THREE.Mesh(groundGeo, groundMat);
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Physics - simple box for flat ground
        const groundShape = new Ammo.btBoxShape(new Ammo.btVector3(this.mapSize / 2, 0.5, this.mapSize / 2));
        const groundTransform = new Ammo.btTransform();
        groundTransform.setIdentity();
        groundTransform.setOrigin(new Ammo.btVector3(0, -0.5, 0));

        const groundMotionState = new Ammo.btDefaultMotionState(groundTransform);
        const groundInfo = new Ammo.btRigidBodyConstructionInfo(0, groundMotionState, groundShape, new Ammo.btVector3(0, 0, 0));
        const groundBody = new Ammo.btRigidBody(groundInfo);
        this.physicsWorld.addRigidBody(groundBody);
    }

    CreateTrees() {
        // Simple low-poly tree: cone (leaves) + cylinder (trunk)
        const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 1.5, 6);
        const leavesGeo = new THREE.ConeGeometry(1.2, 3, 6);

        // Merge into single geometry for instancing
        const treeGeo = new THREE.BufferGeometry();

        // Create tree as group, then we'll instance the whole thing
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
        const leavesMat = new THREE.MeshLambertMaterial({ color: 0x2d5a1d });

        // Create instanced meshes for trunks and leaves separately
        const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, this.treeCount);
        const leavesMesh = new THREE.InstancedMesh(leavesGeo, leavesMat, this.treeCount);

        trunkMesh.castShadow = true;
        trunkMesh.receiveShadow = true;
        leavesMesh.castShadow = true;
        leavesMesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        const halfMap = this.mapSize / 2 - 5; // Keep trees away from edges
        const centerClearRadius = 8; // Clear area in center for player spawn

        let placed = 0;
        let attempts = 0;
        const maxAttempts = this.treeCount * 10;

        while (placed < this.treeCount && attempts < maxAttempts) {
            attempts++;

            const x = (Math.random() - 0.5) * 2 * halfMap;
            const z = (Math.random() - 0.5) * 2 * halfMap;

            // Skip center area
            if (Math.sqrt(x * x + z * z) < centerClearRadius) continue;

            const scale = 0.8 + Math.random() * 0.6;
            const rotation = Math.random() * Math.PI * 2;

            // Trunk position
            dummy.position.set(x, 0.75 * scale, z);
            dummy.scale.set(scale, scale, scale);
            dummy.rotation.y = rotation;
            dummy.updateMatrix();
            trunkMesh.setMatrixAt(placed, dummy.matrix);

            // Leaves position (on top of trunk)
            dummy.position.set(x, 2.5 * scale, z);
            dummy.updateMatrix();
            leavesMesh.setMatrixAt(placed, dummy.matrix);

            // Add simple cylinder collider for tree trunk
            this.AddTreeCollider(x, z, scale);

            placed++;
        }

        trunkMesh.instanceMatrix.needsUpdate = true;
        leavesMesh.instanceMatrix.needsUpdate = true;

        this.scene.add(trunkMesh);
        this.scene.add(leavesMesh);

        console.log(`Forest: Placed ${placed} trees`);
    }

    AddTreeCollider(x, z, scale) {
        const radius = 0.3 * scale;
        const height = 2 * scale;
        const shape = new Ammo.btCylinderShape(new Ammo.btVector3(radius, height / 2, radius));

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(x, height / 2, z));

        const motionState = new Ammo.btDefaultMotionState(transform);
        const info = new Ammo.btRigidBodyConstructionInfo(0, motionState, shape, new Ammo.btVector3(0, 0, 0));
        const body = new Ammo.btRigidBody(info);
        this.physicsWorld.addRigidBody(body);
    }

    CreateLighting() {
        // Warm sun light
        const sunLight = new THREE.DirectionalLight(0xfff4e5, 1.2);
        sunLight.position.set(30, 50, 20);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 150;
        sunLight.shadow.camera.left = -50;
        sunLight.shadow.camera.right = 50;
        sunLight.shadow.camera.top = 50;
        sunLight.shadow.camera.bottom = -50;
        this.scene.add(sunLight);

        // Ambient light for shadows
        const ambientLight = new THREE.AmbientLight(0x6b8cff, 0.4);
        this.scene.add(ambientLight);

        // Sky color
        this.scene.background = new THREE.Color(0x87ceeb);

        // Optional fog for depth
        this.scene.fog = new THREE.Fog(0x87ceeb, 30, this.mapSize);
    }

    // Get valid spawn position (not on a tree)
    GetSpawnPosition() {
        const halfMap = this.mapSize / 2 - 5;
        return new THREE.Vector3(
            (Math.random() - 0.5) * 2 * halfMap,
            0,
            (Math.random() - 0.5) * 2 * halfMap
        );
    }
}
