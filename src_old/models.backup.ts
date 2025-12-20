
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';

// BACKUP: Original model factory methods before low-poly optimization
// Date: 2025-12-20

export class ModelFactoryBackup {

  static createRabbit(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    // Main Body (Rounder)
    const body = new THREE.SphereGeometry(0.3, 7, 7);
    body.scale(0.8, 0.7, 1.0);
    body.translate(0, 0.25, 0);
    geometries.push(body);

    // Head
    const head = new THREE.SphereGeometry(0.18, 6, 6);
    head.translate(0, 0.45, 0.3);
    geometries.push(head);

    // Ears - Distinctive long ears
    const earLeft = new THREE.ConeGeometry(0.05, 0.4, 4);
    earLeft.translate(-0.08, 0.75, 0.25);
    earLeft.rotateX(-0.2);
    earLeft.rotateZ(0.2);
    geometries.push(earLeft);

    const earRight = new THREE.ConeGeometry(0.05, 0.4, 4);
    earRight.translate(0.08, 0.75, 0.25);
    earRight.rotateX(-0.2);
    earRight.rotateZ(-0.2);
    geometries.push(earRight);

    // Small Tail
    const tail = new THREE.SphereGeometry(0.08, 4, 4);
    tail.translate(0, 0.2, -0.25);
    geometries.push(tail);

    return BufferGeometryUtils.mergeGeometries(geometries);
  }

  static createWolf(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    // Body: Cylinder for smoother look
    const body = new THREE.CylinderGeometry(0.25, 0.3, 0.9, 8);
    body.rotateX(Math.PI / 2);
    body.translate(0, 0.6, 0); // Center height
    geometries.push(body);

    // Chest/Front (slightly larger)
    const chest = new THREE.CylinderGeometry(0.32, 0.3, 0.4, 8);
    chest.rotateX(Math.PI / 2);
    chest.translate(0, 0.65, 0.3);
    geometries.push(chest);

    // Neck
    const neck = new THREE.ConeGeometry(0.2, 0.5, 8);
    neck.rotateX(-0.7);
    neck.translate(0, 0.9, 0.6);
    geometries.push(neck);

    // Head
    const head = new THREE.SphereGeometry(0.22, 6, 6);
    head.translate(0, 1.1, 0.8);
    body.scale(0.9, 1, 1); // Make it slightly narrow
    geometries.push(head);

    // Snout (Fox-like point)
    const snout = new THREE.ConeGeometry(0.08, 0.3, 5);
    snout.rotateX(Math.PI / 2); // Point forward
    snout.translate(0, 1.1, 1.05);
    geometries.push(snout);

    // Ears (Large triangles)
    const ear = new THREE.ConeGeometry(0.06, 0.25, 4);
    const e1 = ear.clone(); e1.translate(-0.12, 1.35, 0.75); e1.rotateZ(0.2); geometries.push(e1);
    const e2 = ear.clone(); e2.translate(0.12, 1.35, 0.75); e2.rotateZ(-0.2); geometries.push(e2);

    // Legs (Tapered)
    const leg = new THREE.CylinderGeometry(0.12, 0.06, 0.6, 5);
    const l1 = leg.clone(); l1.translate(-0.15, 0.3, 0.35); geometries.push(l1);
    const l2 = leg.clone(); l2.translate(0.15, 0.3, 0.35); geometries.push(l2);
    const lBack = new THREE.CylinderGeometry(0.12, 0.07, 0.6, 5); // Slightly different rear legs
    const l3 = lBack.clone(); l3.translate(-0.15, 0.3, -0.35); geometries.push(l3);
    const l4 = lBack.clone(); l4.translate(0.15, 0.3, -0.35); geometries.push(l4);

    // Tail (Bushy Fox Tail)
    // Made of 2 parts to have a curve/volume
    const tailBase = new THREE.ConeGeometry(0.15, 0.5, 6);
    tailBase.rotateX(-0.8); // Stick out and down
    tailBase.translate(0, 0.6, -0.55);
    geometries.push(tailBase);

    const tailTip = new THREE.ConeGeometry(0.12, 0.5, 6);
    tailTip.rotateX(-0.4); // Less angle
    tailTip.translate(0, 0.45, -0.85);
    geometries.push(tailTip);

    return BufferGeometryUtils.mergeGeometries(geometries);
  }
}

// NOTE: The external model files are still available in public/models/:
// - bun-bun_buddy.glb (500KB) - Rabbit
// - fox.obj (4MB) - Fox/Wolf
// - hare.obj (1.8MB) - Hare
// - bunny.vtk (2.5MB) - Bunny
