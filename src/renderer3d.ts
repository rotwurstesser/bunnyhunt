
import * as THREE from 'three';
import { World } from './world';
import { CONFIG } from './config';
import { AnimalType, PlantType, GroundType } from './enums';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { ModelFactory } from './models';


import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';

export class Renderer3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  // Meshes (Definite assignment assertions !)
  private groundMesh!: THREE.Mesh;
  private treesMesh!: THREE.InstancedMesh;
  private grassMesh!: THREE.InstancedMesh;
  private rabbitMesh!: THREE.InstancedMesh;
  private wolfMesh!: THREE.InstancedMesh;

  // Loaded Assets
  private loader = new GLTFLoader();
  private clock = new THREE.Clock();
  private loadedAssets: {
    rabbit: { geo: THREE.BufferGeometry, mat: THREE.Material, scene: THREE.Group, animations: THREE.AnimationClip[] } | null,
    fox: { geo: THREE.BufferGeometry, mat: THREE.Material, scene: THREE.Group, animations: THREE.AnimationClip[] } | null
  } = { rabbit: null, fox: null };

  // Death Animation Pools
  private deathPool: {
    mesh: THREE.Group;
    mixer: THREE.AnimationMixer;
    active: boolean;
    type: 'rabbit' | 'fox';
    manualAnim?: boolean;
    animTime?: number;
  }[] = [];
  // private deathMixers: THREE.AnimationMixer[] = []; // Removed redundant array, will iterate pool directly

  // Data reuse
  private dummy = new THREE.Object3D();
  private _color = new THREE.Color();
  private score = 0; // Player Score

  // Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private activeWeapon: 'rifle' | 'minigun' | 'launcher' | 'nuke' = 'rifle';
  private weaponGroups: { [key: string]: THREE.Group } = {};
  private muzzleRef!: THREE.Object3D; // Generic muzzle ref

  private projectiles: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    life: number;
    type: 'rocket' | 'nuke_bomb';
  }> = [];

  private keysPressed: { [key: string]: boolean } = {};
  private lastShotTime = 0;

  private worldRef!: World;
  private effectsGroup = new THREE.Group(); // Restored

  // Pooled geometries for effects (avoid allocating new geometry each kill)
  private pooledSphereGeo = new THREE.SphereGeometry(0.5, 6, 6); // Reduced segments
  private pooledPuddleGeo = new THREE.CircleGeometry(0.6, 8); // Reduced segments
  private pooledParticleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  private pooledParticleMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  private _lerpColor = new THREE.Color(); // Reusable color for lerp operations

  constructor() {
    // Setup Basic Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.Fog(0x0f172a, 50, 150);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 30, 30); // Closer view for small map
    this.camera.lookAt(0, 0, 0);

    // Renderer - Performance Optimized
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // Disabled for performance
      powerPreference: 'high-performance' // Request high-performance GPU
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap pixel ratio
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffdfba, 1.0); // Warm sun
    dirLight.position.set(100, 200, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 150;
    dirLight.shadow.camera.bottom = -150;
    dirLight.shadow.camera.left = -150;
    dirLight.shadow.camera.right = 150;
    dirLight.shadow.mapSize.width = 1024; // Reduced from 2048 for performance
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
    this.controls.minDistance = 5; // Allow close zoom
    this.controls.maxDistance = 100;

    // Init Content
    this.initGround();
    this.initInstances();
    this.loadModels();

    this.scene.add(this.effectsGroup);

    this.initWeapons();

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Mobile touch controls
    window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });

    // Start loading external assets
    this.loadAssets();
  }

  // Touch control state
  private touchStartPos: { x: number; y: number } | null = null;
  private touchStartTime = 0;
  private isTouchDragging = false;
  private isTouchHolding = false; // For minigun auto-fire on touch hold
  private lastTouchPos: { x: number; y: number } | null = null;
  private readonly TAP_THRESHOLD = 15; // Max pixels moved to count as tap
  private readonly TAP_TIME_THRESHOLD = 300; // Max ms for a tap
  private readonly HOLD_THRESHOLD = 400; // Ms to count as hold for auto-fire

  private onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      this.touchStartPos = { x: touch.clientX, y: touch.clientY };
      this.lastTouchPos = { x: touch.clientX, y: touch.clientY };
      this.touchStartTime = Date.now();
      this.isTouchDragging = false;

      // Update mouse position for aiming
      this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
      this.updateWeaponAim();
    }
  }

  private onTouchMove(e: TouchEvent) {
    if (e.touches.length === 1 && this.touchStartPos && this.lastTouchPos) {
      e.preventDefault();
      const touch = e.touches[0];

      const dx = touch.clientX - this.touchStartPos.x;
      const dy = touch.clientY - this.touchStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If moved beyond threshold, it's a drag (pan)
      if (distance > this.TAP_THRESHOLD) {
        this.isTouchDragging = true;
        this.isTouchHolding = false;
      }

      // If holding still for long enough, enable auto-fire for minigun
      const holdDuration = Date.now() - this.touchStartTime;
      if (!this.isTouchDragging && holdDuration > this.HOLD_THRESHOLD) {
        this.isTouchHolding = true;
        // Update aim position while holding
        this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        this.updateWeaponAim();
      }

      if (this.isTouchDragging) {
        // Pan camera based on finger movement
        const moveDx = touch.clientX - this.lastTouchPos.x;
        const moveDy = touch.clientY - this.lastTouchPos.y;

        const panSpeed = 0.5;
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // Invert movement for natural panning feel
        this.camera.position.addScaledVector(right, moveDx * panSpeed);
        this.camera.position.addScaledVector(forward, -moveDy * panSpeed);
        this.controls.target.addScaledVector(right, moveDx * panSpeed);
        this.controls.target.addScaledVector(forward, -moveDy * panSpeed);
      }

      this.lastTouchPos = { x: touch.clientX, y: touch.clientY };
    }
  }

  private onTouchEnd(e: TouchEvent) {
    if (this.touchStartPos) {
      e.preventDefault();
      const touchDuration = Date.now() - this.touchStartTime;

      // If it was a quick tap without much movement, shoot!
      if (!this.isTouchDragging && !this.isTouchHolding && touchDuration < this.TAP_TIME_THRESHOLD) {
        this.shoot();
      }

      this.touchStartPos = null;
      this.lastTouchPos = null;
      this.isTouchDragging = false;
      this.isTouchHolding = false;
    }
  }

  private initWeapons() {
    this.muzzleRef = new THREE.Object3D();
    this.muzzleRef.position.set(0, 0, 1.0); // Forward

    // 1. Rifle
    const rifle = new THREE.Group();
    // -- Geometry --
    const rStock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
    rStock.position.set(0, -0.1, -0.2);
    rifle.add(rStock);
    const rBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    rBarrel.rotateX(Math.PI / 2);
    rBarrel.position.set(0, 0.05, 0.4);
    rifle.add(rBarrel);
    const rScope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    rScope.rotateX(Math.PI / 2);
    rScope.position.set(0, 0.12, 0.1);
    rifle.add(rScope);

    rifle.add(this.muzzleRef.clone()); // Add muzzle point
    rifle.position.set(0.5, -0.5, -1.5);
    this.weaponGroups['rifle'] = rifle;
    this.camera.add(rifle);

    // 2. Minigun
    const minigun = new THREE.Group();
    const mBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    minigun.add(mBody);
    // Barrels
    const mBarrels = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0), new THREE.MeshStandardMaterial({ color: 0x555555 }));
      b.rotateX(Math.PI / 2);
      const ang = (i / 6) * Math.PI * 2;
      b.position.set(Math.cos(ang) * 0.1, Math.sin(ang) * 0.1, 0.6);
      mBarrels.add(b);
    }
    minigun.add(mBarrels);
    minigun.position.set(0.5, -0.6, -1.2);
    minigun.visible = false;
    minigun.userData = { barrels: mBarrels, spin: 0 };
    this.weaponGroups['minigun'] = minigun;
    this.camera.add(minigun);

    // 3. Rocket Launcher
    const launcher = new THREE.Group();
    const lTube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 16), new THREE.MeshStandardMaterial({ color: 0x394a32 }));
    lTube.rotateX(Math.PI / 2);
    launcher.add(lTube);
    const lBox = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    lBox.position.set(0, -0.15, 0);
    launcher.add(lBox);
    launcher.position.set(0.5, -0.4, -1.2);
    launcher.visible = false;
    this.weaponGroups['launcher'] = launcher;
    this.camera.add(launcher);

    // 4. NUKE (Remote)
    const nuke = new THREE.Group();
    const nBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    nuke.add(nBody);
    const nBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x550000 }));
    nBtn.rotateX(Math.PI / 2);
    nBtn.position.set(0, 0.1, 0.05);
    nuke.add(nBtn);
    const nAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5), new THREE.MeshStandardMaterial({ color: 0xaaaaaa }));
    nAntenna.position.set(0.1, 0.4, 0);
    nuke.add(nAntenna);
    nuke.position.set(0.5, -0.6, -1.0);
    nuke.visible = false;
    this.weaponGroups['nuke'] = nuke;
    this.camera.add(nuke);

    // Camera must be in scene for children to render if we are using OrbitControls?
    // Actually OrbitControls moves the camera, so children move with it.
    // But Camera needs to be in scene graph? Usually scene.add(camera) is not strictly required for rendering,
    // but IS required if camera has children we want to see.
    this.scene.add(this.camera);
  }

  private onMouseMove(e: MouseEvent) {
    // Map mouse to -1 to 1
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Visual Aiming update
    // We want the rifle to point towards the cursor's intersection with the world
    this.updateWeaponAim();
  }

  private updateWeaponAim() {
    if (!this.groundMesh) return;
    const group = this.weaponGroups[this.activeWeapon];
    if (!group || !group.visible) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.groundMesh);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      group.lookAt(point);
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    this.keysPressed[e.code] = true;
    // Single fire for semi-auto (Space)
    if (e.code === 'Space') {
      if (this.activeWeapon === 'rifle' || this.activeWeapon === 'launcher' || this.activeWeapon === 'nuke') {
        this.shoot();
      }
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keysPressed[e.code] = false;
  }

  private shoot() {
    if (!this.worldRef) return;

    const now = Date.now();
    // Fire Rates
    if (this.activeWeapon === 'minigun' && now - this.lastShotTime < 50) return; // Automatic handled in render, but cooldown here
    if (this.activeWeapon === 'rifle' && now - this.lastShotTime < 300) return;
    if (this.activeWeapon === 'launcher' && now - this.lastShotTime < 1000) return;

    this.lastShotTime = now;
    const group = this.weaponGroups[this.activeWeapon];

    // Muzzle Flash - bigger and brighter for minigun
    if (this.activeWeapon !== 'nuke') {
      const flashIntensity = this.activeWeapon === 'minigun' ? 5 : 2;
      const flashRange = this.activeWeapon === 'minigun' ? 8 : 5;
      const flash = new THREE.PointLight(0xffaa00, flashIntensity, flashRange);
      flash.position.set(0, 0, 1.2); // Approx Muzzle
      group.add(flash);
      setTimeout(() => group.remove(flash), this.activeWeapon === 'minigun' ? 30 : 50);

      // Recoil - less for minigun
      group.userData.recoil = this.activeWeapon === 'minigun' ? 0.05 : 0.2;

      // Tracer bullet effect for minigun
      if (this.activeWeapon === 'minigun') {
        this.createTracerBullet();
      }
    }

    if (this.activeWeapon === 'nuke') {
      this.nukeAll();
      return;
    }

    if (this.activeWeapon === 'launcher') {
      this.fireRocket();
      return;
    }

    // Raycast logic (Rifle & Minigun)
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects([this.rabbitMesh, this.wolfMesh]);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const instanceId = hit.instanceId;
      const object = hit.object;

      if (instanceId === undefined) return;

      let hitAnimalId = -1;
      let meshType: 'rabbit' | 'wolf' | null = null;
      if (object === this.rabbitMesh) meshType = 'rabbit';
      else if (object === this.wolfMesh) meshType = 'wolf';

      for (const [id, vis] of this.visualAnimals) {
        let matches = false;
        if (meshType === 'rabbit' && vis.type === AnimalType.Rabbit && vis.meshIdx === instanceId) matches = true;
        if (meshType === 'wolf' && vis.type === AnimalType.Wolf && vis.meshIdx === instanceId) matches = true;

        if (matches) {
          hitAnimalId = id;
          break;
        }
      }

      if (hitAnimalId !== -1) {
        this.worldRef.killAnimal(hitAnimalId);

        const offset = -this.worldRef.width / 2;
        const gx = Math.round(hit.point.x - offset);
        const gy = Math.round(hit.point.z - offset);

        if (gx >= 0 && gx < this.worldRef.width && gy >= 0 && gy < this.worldRef.height) {
          this.spawnKillEffect(gx, gy, this.worldRef);
          // Trigger death animation
          const type = meshType === 'rabbit' ? AnimalType.Rabbit : AnimalType.Wolf;
          this.spawnDeathAnimation(gx, gy, type);
        }

        // Score Logic
        if (meshType === 'rabbit') this.score += 2;
        else if (meshType === 'wolf') this.score += 5;

        const scoreEl = document.getElementById('scoreBoard');
        if (scoreEl) scoreEl.innerText = `SCORE: ${this.score}`;
      }
    }
  }

  private fireRocket() {
    const group = this.weaponGroups['launcher'];
    const origin = new THREE.Vector3();
    group.getWorldPosition(origin);

    // Direction? Raycast to look target
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.groundMesh);
    let dir = new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion); // Fallback

    if (intersects.length > 0) {
      const p = intersects[0].point;
      dir = p.clone().sub(origin).normalize();
    }

    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4), new THREE.MeshStandardMaterial({ color: 0x394a32 }));
    mesh.rotateX(Math.PI / 2); // Cylinder default Y up. Point Z.
    mesh.position.copy(origin).add(dir.clone().multiplyScalar(1.0)); // Spawn slightly in front
    // Align to dir
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    this.scene.add(mesh);

    this.projectiles.push({
      mesh: mesh,
      vel: dir.multiplyScalar(1.5), // Faster speed
      life: 200, // frames
      type: 'rocket'
    });
  }

  private createTracerBullet() {
    // Create a visible tracer from weapon to target
    const group = this.weaponGroups['minigun'];
    if (!group) return;

    const origin = new THREE.Vector3();
    group.getWorldPosition(origin);

    // Get target from raycast
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.groundMesh);

    let targetPoint: THREE.Vector3;
    if (intersects.length > 0) {
      targetPoint = intersects[0].point;
    } else {
      // Fallback: shoot into distance
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      targetPoint = origin.clone().add(dir.multiplyScalar(100));
    }

    // Create tracer line
    const points = [origin, targetPoint];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8
    });
    const tracer = new THREE.Line(geometry, material);
    tracer.userData = { type: 'tracer', life: 0.15 };
    this.effectsGroup.add(tracer);
  }

  private nukeAll() {
    if (!this.worldRef) return;

    // Spawn Nuke Bomb Projectile High Up
    const bombGeo = new THREE.Group();
    // Fat Man shape approx
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    body.scale.set(1, 1, 1.5);
    bombGeo.add(body);
    const fins = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    fins.position.set(0, 0, 0.8);
    bombGeo.add(fins);

    bombGeo.rotateX(Math.PI / 2); // Point down
    bombGeo.position.set(0, 50, 0); // High up

    this.scene.add(bombGeo);

    this.projectiles.push({
      mesh: bombGeo as unknown as THREE.Mesh, // Group cast to Mesh for interface simplicity
      vel: new THREE.Vector3(0, -0.5, 0), // Fall down
      life: 200,
      type: 'nuke_bomb'
    });
  }

  private triggerNukeExplosion() {
    // Flash
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.top = '0'; el.style.left = '0'; el.style.width = '100vw'; el.style.height = '100vh';
    el.style.background = 'white';
    el.style.opacity = '1';
    el.style.pointerEvents = 'none';
    el.style.transition = 'opacity 3s';
    document.body.appendChild(el);
    setTimeout(() => el.style.opacity = '0', 50);
    setTimeout(() => el.remove(), 3000);

    const animals: number[] = [];
    for (const [id, vis] of this.visualAnimals) {
      animals.push(id);
      if (vis.type === AnimalType.Rabbit) this.score += 2;
      else if (vis.type === AnimalType.Wolf) this.score += 5;
    }

    // Use killAllAnimals to avoid respawning in static mode
    this.worldRef.killAllAnimals();

    // Burn Trees
    for (let y = 0; y < this.worldRef.height; y++) {
      for (let x = 0; x < this.worldRef.width; x++) {
        const cell = this.worldRef.cells[y][x];
        if (cell.plant) {
          cell.plant.isBurnt = true;
        }
      }
    }
    this.updateGround(this.worldRef); // Force re-render of trees

    // Mushroom Cloud
    this.spawnMushroomCloud();

    const scoreEl = document.getElementById('scoreBoard');
    if (scoreEl) scoreEl.innerText = `SCORE: ${this.score}`;
  }

  private spawnMushroomCloud() {
    const cloud = new THREE.Group();

    // Stalk (Scaled down 4x)
    const stalkGeo = new THREE.CylinderGeometry(0.5, 1.5, 5, 16);
    const stalkMat = new THREE.MeshStandardMaterial({ color: 0x555555, emissive: 0x221100, transparent: true, opacity: 0.9 });
    const stalk = new THREE.Mesh(stalkGeo, stalkMat);
    stalk.position.set(0, 2.5, 0);
    cloud.add(stalk);

    // Cap (Scaled down 4x)
    const capGeo = new THREE.SphereGeometry(3.0, 16, 16);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x442200, transparent: true, opacity: 0.9 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.scale.set(1, 0.6, 1);
    cap.position.set(0, 5, 0);
    cloud.add(cap);

    // Ring (Scaled down 4x)
    const ringGeo = new THREE.TorusGeometry(2, 0.5, 16, 32);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x888888, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotateX(Math.PI / 2);
    ring.position.set(0, 3.5, 0);
    cloud.add(ring);

    cloud.position.set(0, 0, 0);
    cloud.userData = { life: 300, grow: 0 }; // 5 seconds
    this.effectsGroup.add(cloud);
  }

  private initGround() {
    // Placeholder geometry, will be updated by syncWorld
    const geometry = new THREE.PlaneGeometry(100, 100, 10, 10);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true
    });

    this.groundMesh = new THREE.Mesh(geometry, material);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

  private initInstances() {
    // Trees
    const treeGeo = ModelFactory.createTree();
    const treeMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // Standard material, no wind
    this.treesMesh = new THREE.InstancedMesh(treeGeo, treeMat, 5000); // Reduced from 50000
    this.treesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.treesMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(5000 * 3), 3);
    this.treesMesh.castShadow = true;
    this.treesMesh.receiveShadow = true;
    this.scene.add(this.treesMesh);

    // Grass
    const grassGeo = ModelFactory.createGrass();
    // No wind, usage MeshLambertMaterial
    const grassMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });

    this.grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, 10000); // Reduced from 100000
    this.grassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grassMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(10000 * 3), 3);
    // Grass doesn't need to cast shadows - performance optimization
    this.scene.add(this.grassMesh);

    // Rabbits
    const rabbitGeo = ModelFactory.createRabbit();
    const rabbitMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    this.rabbitMesh = new THREE.InstancedMesh(rabbitGeo, rabbitMat, 200); // Reduced from 5000
    this.rabbitMesh.castShadow = true;
    this.rabbitMesh.receiveShadow = true;
    this.scene.add(this.rabbitMesh);

    // Wolves
    const wolfGeo = ModelFactory.createWolf();
    const wolfMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 });
    this.wolfMesh = new THREE.InstancedMesh(wolfGeo, wolfMat, 50); // Reduced from 500
    this.wolfMesh.castShadow = true;
    this.wolfMesh.receiveShadow = true;
    this.scene.add(this.wolfMesh);
  }

  private loadModels() {
    // DISABLED: External models are 4MB+ and hurt performance
    // Using ultra-low-poly procedural models from ModelFactory instead
    // If you want to re-enable, uncomment the code below

    /*
    const objLoader = new OBJLoader();
    const gltfLoader = new GLTFLoader();

    // Load Rabbit (GLB)
    gltfLoader.load('models/bun-bun_buddy.glb', (gltf) => {
      let geometry: THREE.BufferGeometry | null = null;
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          if (!geometry) geometry = (child as THREE.Mesh).geometry;
        }
      });

      if (geometry) {
        (geometry as THREE.BufferGeometry).center();
        (geometry as THREE.BufferGeometry).computeVertexNormals();
        const box = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = (1.0 / maxDim) * 0.7;
          (geometry as THREE.BufferGeometry).scale(scale, scale, scale);
          (geometry as THREE.BufferGeometry).translate(0, 0.0, 0);
        }
        this.rabbitMesh.geometry.dispose();
        this.rabbitMesh.geometry = geometry as THREE.BufferGeometry;
      }
    }, undefined, (e) => console.warn("Failed to load bun-bun_buddy.glb", e));

    // Load Wolf (Fox) - OBJ
    objLoader.load('models/fox.obj', (group) => {
      let geometry: THREE.BufferGeometry | null = null;
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          geometry = (child as THREE.Mesh).geometry;
        }
      });

      if (geometry) {
        (geometry as THREE.BufferGeometry).center();
        (geometry as THREE.BufferGeometry).computeVertexNormals();
        const box = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = (1.0 / maxDim) * 3;
          (geometry as THREE.BufferGeometry).scale(scale, scale, scale);
          (geometry as THREE.BufferGeometry).rotateX(-Math.PI / 2);
          (geometry as THREE.BufferGeometry).translate(0, 0.0, 0);
        }
        this.wolfMesh.geometry.dispose();
        this.wolfMesh.geometry = geometry as THREE.BufferGeometry;
      }
    }, undefined, (e) => console.warn("Failed to load fox.obj", e));
    */
  }

  // Load external assets (Rabbit/Fox)
  public async loadAssets() {
    // Load Rabbit
    try {
      const gltf = await this.loader.loadAsync('/models/low_poly_rabbit.glb');
      let mesh: THREE.Mesh | null = null;
      gltf.scene.traverse((c) => {
        if ((c as THREE.Mesh).isMesh && !mesh) mesh = c as THREE.Mesh;
      });
      if (mesh) {
        this.loadedAssets.rabbit = {
          geo: (mesh as THREE.Mesh).geometry,
          mat: (mesh as THREE.Mesh).material as THREE.Material,
          scene: gltf.scene,
          animations: gltf.animations
        };
        this.createDeathPool('rabbit', gltf.scene); // Removed unused anims param
      }
    } catch (e) {
      console.warn('Rabbit model load failed:', e);
    }

    // Load Fox
    try {
      const gltf = await this.loader.loadAsync('/models/low_poly_fox.glb');
      let mesh: THREE.Mesh | null = null;
      gltf.scene.traverse((c) => {
        if ((c as THREE.Mesh).isMesh && !mesh) mesh = c as THREE.Mesh;
      });
      if (mesh) {
        this.loadedAssets.fox = {
          geo: (mesh as THREE.Mesh).geometry,
          mat: (mesh as THREE.Mesh).material as THREE.Material,
          scene: gltf.scene,
          animations: gltf.animations
        };
        this.createDeathPool('fox', gltf.scene);
      }
    } catch (e) {
      console.warn('Fox model load failed:', e);
    }

    // Swaps procedural meshes with new models
    this.recreateAnimalMeshes();
  }

  private createDeathPool(type: 'rabbit' | 'fox', scene: THREE.Group) {
    const scale = type === 'rabbit' ? CONFIG.visual.rabbitScale * 18 : CONFIG.visual.wolfScale * 14;

    for (let i = 0; i < 5; i++) {
      const clone = SkeletonUtils.clone(scene) as THREE.Group;
      clone.visible = false;
      clone.scale.set(scale, scale, scale);
      this.scene.add(clone);

      const mixer = new THREE.AnimationMixer(clone);
      this.deathPool.push({ mesh: clone, mixer, active: false, type, manualAnim: false, animTime: 0 });
    }
  }

  public spawnDeathAnimation(wx: number, wz: number, type: AnimalType) {
    const poolType = type === AnimalType.Rabbit ? 'rabbit' : 'fox';
    const item = this.deathPool.find(p => !p.active && p.type === poolType);
    if (!item) return;

    item.active = true;
    item.mesh.visible = true;
    item.animTime = 0;

    // Position
    const offset = -this.worldRef.width / 2;
    item.mesh.position.set(wx + offset, 0, wz + offset);
    const randomRot = Math.random() * Math.PI * 2;
    item.mesh.rotation.set(0, randomRot, 0);

    // Find Animation
    let clip: THREE.AnimationClip | undefined;
    const assets = poolType === 'rabbit' ? this.loadedAssets.rabbit : this.loadedAssets.fox;

    if (assets && assets.animations.length > 0) {
      // Strict check: only actual death animations
      clip = assets.animations.find(a => a.name.toLowerCase().includes('death'));
      if (!clip) clip = assets.animations.find(a => a.name.toLowerCase().includes('die'));
    }

    if (clip) {
      item.manualAnim = false;
      item.mixer.stopAllAction();
      const action = item.mixer.clipAction(clip);
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();

      // Auto-hide
      setTimeout(() => {
        item.active = false;
        item.mesh.visible = false;
      }, clip.duration * 1000 + 2000); // 2 seconds extra
    } else {
      // Procedural Death (Topple)
      item.manualAnim = true;
      item.mixer.stopAllAction(); // Stop anything else

      setTimeout(() => {
        item.active = false;
        item.mesh.visible = false;
      }, 1500);
    }
  }

  public updateDeathAnimations(delta: number) {
    this.deathPool.forEach(item => {
      if (!item.active) return;

      if (item.manualAnim) {
        // Procedural Topple
        item.animTime = (item.animTime || 0) + delta;
        const dur = 0.5;
        if (item.animTime < dur) {
          const t = item.animTime / dur;
          const ease = t * (2 - t);
          item.mesh.rotation.x = (Math.PI / 2) * ease;
        } else {
          item.mesh.rotation.x = Math.PI / 2;
        }
      } else {
        item.mixer.update(delta);
      }
    });
  }

  private recreateAnimalMeshes() {
    // 1. Rabbit
    if (this.loadedAssets.rabbit) {
      if (this.rabbitMesh) {
        this.scene.remove(this.rabbitMesh);
        if (this.rabbitMesh.geometry) this.rabbitMesh.geometry.dispose();
        // Materials might be shared or single, check type
        if (this.rabbitMesh.material) {
          if (Array.isArray(this.rabbitMesh.material)) {
            this.rabbitMesh.material.forEach(m => m.dispose());
          } else {
            (this.rabbitMesh.material as THREE.Material).dispose();
          }
        }
      }
      const geo = this.loadedAssets.rabbit.geo.clone();

      const mat = this.loadedAssets.rabbit.mat;

      this.rabbitMesh = new THREE.InstancedMesh(geo, mat, 200);
      this.rabbitMesh.castShadow = true;
      this.rabbitMesh.receiveShadow = true;

      // Rabbit model orientation (rotate Y 180 or something if needed)
      // For now, identity is fine as procedural was simple.

      this.scene.add(this.rabbitMesh);
    }

    // 2. Wolf (Fox)
    if (this.loadedAssets.fox) {
      if (this.wolfMesh) {
        this.scene.remove(this.wolfMesh);
        if (this.wolfMesh.geometry) this.wolfMesh.geometry.dispose();
        if (this.wolfMesh.material) {
          if (Array.isArray(this.wolfMesh.material)) {
            this.wolfMesh.material.forEach(m => m.dispose());
          } else {
            (this.wolfMesh.material as THREE.Material).dispose();
          }
        }
      }
      const geo = this.loadedAssets.fox.geo.clone();
      const mat = this.loadedAssets.fox.mat;

      this.wolfMesh = new THREE.InstancedMesh(geo, mat, 50);
      this.wolfMesh.castShadow = true;
      this.wolfMesh.receiveShadow = true;
      this.scene.add(this.wolfMesh);
    }
  }

  public syncWorld(world: World) {
    this.worldRef = world;
    this.updateGround(world);
    this.updateEntities(world);

    // Handle Events
    for (const evt of world.events) {
      if (evt.type === 'kill') {
        this.spawnKillEffect(evt.x, evt.y, world);
      }
    }
  }

  private updateGround(world: World) {
    const w = world.width;
    const h = world.height;
    const geoCtx = this.groundMesh.geometry as THREE.PlaneGeometry;

    // Rebuild geometry if needed
    if (geoCtx.parameters.width !== w || geoCtx.parameters.height !== h) {
      this.groundMesh.geometry.dispose();
      // Segments = w-1, h-1 so we have a vertex for each cell
      const newGeo = new THREE.PlaneGeometry(w, h, w - 1, h - 1);
      newGeo.rotateX(-Math.PI / 2); // Lay flat
      this.groundMesh.geometry = newGeo;
    }

    const positionAttribute = this.groundMesh.geometry.attributes.position;
    const colors: number[] = [];

    // Grid is centered at (0,0,0) so top-left is (-w/2, -h/2)
    // PlaneGeometry builds row-by-row (Y then X usually).
    // Let's iterate linearly via the vertices

    const count = positionAttribute.count;
    for (let i = 0; i < count; i++) {
      // Reconstruct Grid Coordinates from index
      const ix = i % w;
      const iy = Math.floor(i / w);

      if (iy < h && ix < w) {
        const cell = world.cells[iy][ix];

        // Height Scaling
        const heightVal = Math.max(0.1, cell.height);
        // We modify the Y coordinate (up)
        positionAttribute.setY(i, heightVal * 8);

        // Color Logic
        let r = 0, g = 0, b = 0;
        if (!cell.isLand) { // Water
          r = 0.2; g = 0.4; b = 0.7; // Blue
        } else if (cell.ground === GroundType.ForestFloor) {
          r = 0.25; g = 0.18; b = 0.12; // Brown
        } else {
          // Ground / Grass base
          // tint by moisture slightly
          r = 0.35; g = 0.28; b = 0.18;
        }
        colors.push(r, g, b);
      } else {
        colors.push(0, 0, 0);
      }
    }

    positionAttribute.needsUpdate = true;
    this.groundMesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.groundMesh.geometry.computeVertexNormals();
  }

  // State for smooth animation
  private visualAnimals = new Map<number, {
    meshIdx: number;
    type: AnimalType;
    currentPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    scale: number;
    id: number;
  }>();

  private updateEntities(world: World) {
    let tIdx = 0;
    let gIdx = 0;
    // NOTE: We don't rebuild animal meshes every frame linearly from grid anymore.
    // We track them by ID.

    const w = world.width;
    const h = world.height;
    const offset = -w / 2;

    const dummy = this.dummy;
    const _color = this._color;

    // 1. Scan for Plants (Stateless, standard instanced mesh is fine as they don't move)
    // AND build the list of current animal targets
    const activeAnimalIds = new Set<number>();

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = world.cells[y][x];

        // Coordinates
        const cx = x + offset;
        const cz = y + offset;
        const cy = (Math.max(0.1, cell.height) * 8);

        // PLANT UPDATE
        // Optimization: Only update plants if we really need to (e.g. they died or grew significantly).
        // Actually, for now let's just update them to be safe, but ensure calculations are consistent.
        if (cell.plant) {
          dummy.position.set(cx, cy, cz);

          const hash = (x * 374761393 + y * 668265263) ^ 0xDEADBEEF;
          const pr = (hash & 0xFFFF) / 65535.0;

          if (cell.plant.type === PlantType.Oak || cell.plant.type === PlantType.Pine) {
            const ageScale = Math.min(1.0, 0.3 + (cell.plant.age / 100));
            const variance = 0.8 + (pr * 0.7);
            const finalScale = (ageScale * variance) * CONFIG.visual.treeScale;

            dummy.position.set(cx, cy + CONFIG.visual.treeY, cz);
            dummy.scale.set(finalScale, finalScale, finalScale);

            if (cell.plant.isBurnt) {
              // Fallen: Rotate 90 deg around X or Z
              dummy.rotation.set(Math.PI / 2, pr * 6.28, 0);
              dummy.position.y += 0.5; // Lift up slightly so it doesn't clip fully
            } else {
              dummy.rotation.set(0, pr * 6.28, 0);
            }

            dummy.updateMatrix();

            this.treesMesh.setMatrixAt(tIdx, dummy.matrix);

            if (cell.plant.isBurnt) {
              _color.setHex(0x111111); // Black/Charred
            } else {
              _color.setHex(0x1e5025);
              _color.offsetHSL(pr * 0.05, 0, (pr - 0.5) * 0.2);
            }
            this.treesMesh.setColorAt(tIdx, _color);

            tIdx++;
          } else if (cell.plant.type === PlantType.Grass || cell.plant.type === PlantType.AridGrass) {
            // Kill Grass too if burnt? User said "kill trees", implying grass might survive or just vanish.
            // Let's burn grass too for consistency.

            const s = (Math.min(1.0, 0.3 + (cell.plant.age / 100))) * CONFIG.visual.grassScale;
            dummy.position.set(cx, cy + CONFIG.visual.grassY, cz);
            dummy.scale.set(s, s, s);
            dummy.rotation.set(0, pr * 6.28, 0);
            dummy.updateMatrix();

            this.grassMesh.setMatrixAt(gIdx, dummy.matrix);

            if (cell.plant.isBurnt) {
              _color.setHex(0x222222); // Burnt grass
            } else {
              if (cell.plant.type === PlantType.AridGrass) _color.setHex(0xd4d448);
              else _color.setHex(0x4ade80);

              if (cell.plant.currentEnergy < cell.plant.maxEnergy * 0.3) {
                // Use pooled color to avoid allocation in hot loop
                this._lerpColor.setHex(0x8B4513);
                _color.lerp(this._lerpColor, 0.5);
              }
            }

            this.grassMesh.setColorAt(gIdx, _color);
            gIdx++;
          }
        }
        // Extra Grass spawning on "Bare" ground for lush look
        else if (cell.isLand && cell.ground !== GroundType.ForestFloor) {
          // Check if we should spawn "filler" grass
          const hash = (x * 982451653 + y * 324161903) ^ 0xBAADF00D;
          const pr = (hash & 0xFFFF) / 65535.0;
          if (pr < CONFIG.visual.grassCoverage) { // Dynamic Coverage
            const density = Math.floor(CONFIG.visual.grassDensity);
            for (let d = 0; d < density; d++) {
              // Seeded random for sub-position
              const subHash = (hash + d * 15485863) & 0xFFFFFFFF;
              const dx = ((subHash & 0xFFFF) / 65535.0) - 0.5; // -0.5 to 0.5
              const dz = (((subHash >> 16) & 0xFFFF) / 65535.0) - 0.5;

              // Slightly randomize scale for variety
              const scaleVar = 1.0 + (dx + dz) * 0.3; // +/- 0.3

              // Make sure we stay somewhat within the cell (cellSize=3 roughly visually, but logic uses x,y as center)
              // The visual grid size is arbitrary if we don't know it, but assuming 1 unit steps?
              // Actually world x,y corresponds to 1 unit distance in rendering?
              // Checked loop: cx = x + offset. Renderer does direct mapping.
              // So offset +/- 0.5 is safe.

              dummy.position.set(cx + dx * 0.8, cy + CONFIG.visual.grassY, cz + dz * 0.8);

              const s = 0.6 * CONFIG.visual.grassScale * scaleVar;
              dummy.scale.set(s, s, s); // smaller filler grass
              dummy.rotation.set(0, (pr + d) * 6.28, 0);
              dummy.updateMatrix();

              if (gIdx < this.grassMesh.count) {
                this.grassMesh.setMatrixAt(gIdx, dummy.matrix);
                _color.setHex(0x3a9e50); // darker base
                // slight fake AO at bottom or something?
                this.grassMesh.setColorAt(gIdx, _color);
                gIdx++;
              }
            }
          }
        }

        // ANIMAL TARGET UPDATE
        if (cell.animal) {
          const anim = cell.animal;
          activeAnimalIds.add(anim.id);
          const targetPos = new THREE.Vector3(cx, cy, cz);

          if (!this.visualAnimals.has(anim.id)) {
            // New animal
            const baseScale = 2.5;
            const ageFactor = (anim.age < anim.maturityAge) ? 0.6 : 1.0;
            const finalScale = baseScale * ageFactor;

            this.visualAnimals.set(anim.id, {
              meshIdx: -1, // Assigned later
              type: anim.type,
              currentPos: targetPos.clone(),
              targetPos: targetPos,
              scale: finalScale,
              id: anim.id
            });
          } else {
            // Existing
            const vis = this.visualAnimals.get(anim.id)!;
            // IMPORTANT: Reset meshIdx because we rebuild the lists every frame (rIdx/wIdx reset)
            // Actually we do assign it below in render(), so we just need to ensure we capture it correctly.
            // But wait, render() runs AFTER this logic?
            // "updateEntities" runs in world tick loop. "render" runs every frame.
            // The meshIdx is determined in RENDER loop.
            // Raycast happens asynchronously (on key press).
            // So we need to know the meshIdx from the LAST render frame.
            // In render(), we write: vis.meshIdx = rIdx;
            // So we are good.
            vis.targetPos.copy(targetPos);
            // Update scale if age changed significantly? (Optional)
          }
        }
      }
    }

    // Cleanup dead animals
    for (const [id] of this.visualAnimals) {
      if (!activeAnimalIds.has(id)) {
        this.visualAnimals.delete(id);
      }
    }

    // Apply Plant Updates
    this.treesMesh.count = tIdx;
    this.treesMesh.instanceMatrix.needsUpdate = true;
    if (this.treesMesh.instanceColor) this.treesMesh.instanceColor.needsUpdate = true;

    this.grassMesh.count = gIdx;
    this.grassMesh.instanceMatrix.needsUpdate = true;
    if (this.grassMesh.instanceColor) this.grassMesh.instanceColor.needsUpdate = true;
  }

  private spawnKillEffect(x: number, y: number, world: World) {
    const offset = -world.width / 2;
    const cx = x + offset;
    const cz = y + offset;
    const cell = world.cells[Math.floor(y)][Math.floor(x)];
    let groundY = 0;
    if (cell) groundY = Math.max(0.1, cell.height) * 8;

    // 0. Flash Sphere - use pooled geometry
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 });
    const sphere = new THREE.Mesh(this.pooledSphereGeo, sphereMat);
    sphere.position.set(cx, groundY + 2.0, cz);
    sphere.userData = { type: 'legacy_kill', life: 1.0 };
    this.effectsGroup.add(sphere);

    // 1. Blood Puddle - use pooled geometry
    const puddleMat = new THREE.MeshBasicMaterial({ color: 0x8a0303, transparent: true, opacity: 0.9, depthWrite: false });
    const puddle = new THREE.Mesh(this.pooledPuddleGeo, puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(cx, groundY + 0.05, cz);
    puddle.userData = { type: 'puddle', life: 1.0, maxScale: 1.5 };
    this.effectsGroup.add(puddle);

    // 2. Blood Particles - use pooled geometry and material, reduced count
    for (let i = 0; i < 4; i++) { // Reduced from 8 to 4 for performance
      const mesh = new THREE.Mesh(this.pooledParticleGeo, this.pooledParticleMat);
      mesh.position.set(cx, groundY + 0.5, cz);
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.1 + Math.random() * 0.2;
      const vy = 0.2 + Math.random() * 0.2;

      mesh.userData = {
        type: 'particle',
        life: 1.0,
        vel: new THREE.Vector3(Math.cos(angle) * speed, vy, Math.sin(angle) * speed),
        groundY: groundY
      };
      this.effectsGroup.add(mesh);
    }
  }

  public render() {
    // Weapon Logic
    // Switcher
    let targetWep: 'rifle' | 'minigun' | 'launcher' | 'nuke' = 'rifle';
    if (this.score >= 60) targetWep = 'nuke';
    else if (this.score >= 40) targetWep = 'launcher';
    else if (this.score >= 20) targetWep = 'minigun';

    if (targetWep !== this.activeWeapon) {
      // Hide old
      if (this.weaponGroups[this.activeWeapon]) this.weaponGroups[this.activeWeapon].visible = false;
      this.activeWeapon = targetWep;
      // Show new
      if (this.weaponGroups[this.activeWeapon]) this.weaponGroups[this.activeWeapon].visible = true;
    }

    // Minigun Spin & Auto Fire
    if (this.activeWeapon === 'minigun') {
      const grp = this.weaponGroups['minigun'];
      if (grp) {
        // Also check for touch hold (isTouchDragging with no movement)
        const isFiring = this.keysPressed['Space'] || this.isTouchHolding;
        if (isFiring) {
          grp.userData.spin += 0.8; // Faster spool up
          if (grp.userData.spin > 25) grp.userData.spin = 25; // Higher max speed

          // Actually shoot if fast enough - lower threshold for faster fire
          if (grp.userData.spin > 6) {
            this.shoot();
          }
        } else {
          grp.userData.spin *= 0.92; // Slightly faster spool down
        }
        // Rotate barrels faster
        grp.userData.barrels.rotation.z += grp.userData.spin * 0.06;
      }
    }

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.add(p.vel);
      p.life--;

      // Collision (Ground)
      if (p.mesh.position.y < 0 && p.type === 'rocket') { // Hit ground approx
        p.life = 0;
        // Explosion
        const offset = -this.worldRef.width / 2;
        const gx = Math.round(p.mesh.position.x - offset);
        const gy = Math.round(p.mesh.position.z - offset);
        // Kill radius 5
        for (let yy = -5; yy <= 5; yy++) {
          for (let xx = -5; xx <= 5; xx++) {
            const tx = gx + xx;
            const ty = gy + yy;
            if (tx >= 0 && tx < this.worldRef.width && ty >= 0 && ty < this.worldRef.height) {
              if (xx * xx + yy * yy <= 25) { // Circular radius
                const cell = this.worldRef.cells[ty][tx];
                if (cell.animal) {
                  if (cell.animal.type === AnimalType.Rabbit) this.score += 2;
                  else if (cell.animal.type === AnimalType.Wolf) this.score += 5;

                  this.worldRef.killAnimal(cell.animal.id);
                  this.spawnKillEffect(tx, ty, this.worldRef);
                }
              }
            }
          }
        }
        const scoreEl = document.getElementById('scoreBoard');
        if (scoreEl) scoreEl.innerText = `SCORE: ${this.score}`;

        // Visual Explosion
        const flash = new THREE.PointLight(0xff0000, 5, 20);
        flash.position.copy(p.mesh.position);
        this.effectsGroup.add(flash);
        setTimeout(() => this.effectsGroup.remove(flash), 200);
      }
      // Nuke Bomb Impact
      else if (p.mesh.position.y < 0 && p.type === 'nuke_bomb') {
        p.life = 0;
        this.triggerNukeExplosion();
      }

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // Recoil Animation Generic
    const curGrp = this.weaponGroups[this.activeWeapon];
    if (curGrp && curGrp.userData.recoil !== undefined) {
      let r = curGrp.userData.recoil;
      if (r > 0.001) {
        r *= 0.85; // Decay
        curGrp.userData.recoil = r;
        curGrp.position.setZ((this.activeWeapon === 'rifle' ? -1.5 : (this.activeWeapon === 'minigun' ? -1.2 : -1.2)) + r);
      }
    }



    // Update Effects
    for (let i = this.effectsGroup.children.length - 1; i >= 0; i--) {
      const child = this.effectsGroup.children[i] as THREE.Mesh;

      if (child.userData.type === 'tracer') {
        // Tracer bullets fade fast
        child.userData.life -= 0.05;
        (child.material as THREE.LineBasicMaterial).opacity = child.userData.life;
      }
      else if (child.userData.type === 'puddle') {
        child.userData.life -= 0.005; // Slow fade
        // Scale up initially
        if (child.scale.x < child.userData.maxScale) {
          child.scale.multiplyScalar(1.02);
        }
        (child.material as THREE.MeshBasicMaterial).opacity = child.userData.life;
      }
      else if (child.userData.type === 'particle') {
        child.userData.life -= 0.02;
        const vel = child.userData.vel as THREE.Vector3;
        child.position.add(vel);
        vel.y -= 0.02; // Gravity

        // Ground collision (simple)
        if (child.position.y < child.userData.groundY) { // if we knew ground Y...
          // Approximation
          if (child.position.y < -10) child.userData.life = 0; // Kill if falls too far
        }

        child.rotation.x += 0.1;
        child.rotation.z += 0.1;
        (child.material as THREE.MeshBasicMaterial).opacity = child.userData.life;
      }
      else if (child.userData.grow !== undefined) {
        // Mushroom Cloud Logic
        child.userData.life--;
        child.userData.grow++;

        // Grow
        const scale = 1.0 + Math.min(child.userData.grow * 0.05, 10.0);
        child.scale.set(scale, scale, scale);

        // Fade
        child.children.forEach((mesh) => {
          if (mesh instanceof THREE.Mesh) {
            (mesh.material as THREE.Material).opacity = Math.min(1.0, child.userData.life / 100);
          }
        });

        // Rotate Ring
        if (child.children[2]) {
          child.children[2].scale.multiplyScalar(1.01);
        }
      }
      else {
        // Legacy / fallback (Sphere)
        child.userData.life -= 0.1;
        child.scale.multiplyScalar(1.05); // Expand
        (child.material as THREE.Material).opacity = child.userData.life;
      }

      if (child.userData.life <= 0) {
        this.effectsGroup.remove(child);
        child.geometry.dispose();
        // reuse material if possible, but here we dispose for safety
        // particleMat is shared technically if created outside loop, but we created inside.
        // The puddle mat is unique.
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    }

    // 2. Animate Animals (Lerp)
    let rIdx = 0;
    let wIdx = 0;
    const lerpFactor = 0.1; // Adjust for smoothness vs lag

    for (const vis of this.visualAnimals.values()) {
      // Lerp position
      vis.currentPos.lerp(vis.targetPos, lerpFactor);

      this.dummy.position.copy(vis.currentPos);
      this.dummy.scale.set(vis.scale, vis.scale, vis.scale);

      // Look at target if moving
      const dist = vis.currentPos.distanceTo(vis.targetPos);
      if (dist > 0.1) {
        this.dummy.lookAt(vis.targetPos);
      } else {
        this.dummy.rotation.set(0, (vis.id * 0.1) % 6.28, 0);
      }

      // Apply Scale & Offset depending on type
      let s = vis.scale;
      let yOff = 0;
      if (vis.type === AnimalType.Rabbit) {
        s *= CONFIG.visual.rabbitScale;
        yOff = CONFIG.visual.rabbitY;
      } else if (vis.type === AnimalType.Wolf) {
        s *= CONFIG.visual.wolfScale;
        yOff = CONFIG.visual.wolfY;
      }

      this.dummy.position.setY(vis.currentPos.y + yOff);
      this.dummy.scale.set(s, s, s);

      this.dummy.updateMatrix();

      if (vis.type === AnimalType.Rabbit) {
        this.rabbitMesh.setMatrixAt(rIdx, this.dummy.matrix);
        vis.meshIdx = rIdx; // Store for raycasting
        rIdx++;
      } else if (vis.type === AnimalType.Wolf) {
        this.wolfMesh.setMatrixAt(wIdx, this.dummy.matrix);
        vis.meshIdx = wIdx; // Store for raycasting
        wIdx++;
      }
    }

    // Update Animal InstanceBuffers
    this.rabbitMesh.count = rIdx;
    this.rabbitMesh.instanceMatrix.needsUpdate = true;
    this.wolfMesh.count = wIdx;
    this.wolfMesh.instanceMatrix.needsUpdate = true;

    // WASD Camera Movement
    const moveSpeed = 1.5;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement horizontal
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (this.keysPressed['KeyW']) {
      this.camera.position.addScaledVector(forward, moveSpeed);
      this.controls.target.addScaledVector(forward, moveSpeed);
    }
    if (this.keysPressed['KeyS']) {
      this.camera.position.addScaledVector(forward, -moveSpeed);
      this.controls.target.addScaledVector(forward, -moveSpeed);
    }
    if (this.keysPressed['KeyA']) {
      this.camera.position.addScaledVector(right, -moveSpeed);
      this.controls.target.addScaledVector(right, -moveSpeed);
    }
    if (this.keysPressed['KeyD']) {
      this.camera.position.addScaledVector(right, moveSpeed);
      this.controls.target.addScaledVector(right, moveSpeed);
    }
    // Q/E for vertical movement
    if (this.keysPressed['KeyQ']) {
      this.camera.position.y -= moveSpeed;
      this.controls.target.y -= moveSpeed;
    }
    if (this.keysPressed['KeyE']) {
      this.camera.position.y += moveSpeed;
      this.controls.target.y += moveSpeed;
    }
    const delta = this.clock.getDelta();
    this.updateDeathAnimations(delta);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }



  public onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
