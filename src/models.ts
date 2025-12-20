
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';

export class ModelFactory {

  static createTree(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    // Trunk - slightly tapered
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 1.2, 7);
    trunkGeo.translate(0, 0.6, 0);
    geometries.push(trunkGeo);

    // Leaves (3 layers of low-poly cones)
    const l1 = new THREE.ConeGeometry(1.6, 2.2, 7);
    l1.translate(0, 2.2, 0);
    geometries.push(l1);

    const l2 = new THREE.ConeGeometry(1.2, 1.8, 7);
    l2.translate(0, 3.2, 0);
    geometries.push(l2);

    const l3 = new THREE.ConeGeometry(0.8, 1.2, 7);
    l3.translate(0, 4.0, 0);
    geometries.push(l3);

    const merged = BufferGeometryUtils.mergeGeometries(geometries);
    return merged;
  }

  static createRabbit(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    // Ultra low-poly stylized rabbit (similar to Sketchfab reference)
    // Body - chonky oval
    const body = new THREE.SphereGeometry(0.35, 5, 4);
    body.scale(0.9, 0.8, 1.1);
    body.translate(0, 0.3, 0);
    geometries.push(body);

    // Head - round
    const head = new THREE.SphereGeometry(0.22, 5, 4);
    head.translate(0, 0.55, 0.28);
    geometries.push(head);

    // Long ears - the signature rabbit look
    const earL = new THREE.ConeGeometry(0.06, 0.5, 4);
    earL.translate(-0.1, 0.95, 0.2);
    earL.rotateX(-0.15);
    earL.rotateZ(0.15);
    geometries.push(earL);

    const earR = new THREE.ConeGeometry(0.06, 0.5, 4);
    earR.translate(0.1, 0.95, 0.2);
    earR.rotateX(-0.15);
    earR.rotateZ(-0.15);
    geometries.push(earR);

    // Fluffy tail
    const tail = new THREE.SphereGeometry(0.1, 4, 3);
    tail.translate(0, 0.25, -0.35);
    geometries.push(tail);

    // Front paws (optional, adds character)
    const pawF = new THREE.SphereGeometry(0.06, 3, 2);
    const pf1 = pawF.clone(); pf1.translate(-0.12, 0.08, 0.2); geometries.push(pf1);
    const pf2 = pawF.clone(); pf2.translate(0.12, 0.08, 0.2); geometries.push(pf2);

    // Back paws (bigger)
    const pawB = new THREE.SphereGeometry(0.08, 3, 2);
    const pb1 = pawB.clone(); pb1.translate(-0.15, 0.05, -0.1); geometries.push(pb1);
    const pb2 = pawB.clone(); pb2.translate(0.15, 0.05, -0.1); geometries.push(pb2);

    return BufferGeometryUtils.mergeGeometries(geometries);
  }

  static createWolf(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    // Ultra low-poly stylized fox
    // Body - elongated
    const body = new THREE.CylinderGeometry(0.25, 0.28, 0.9, 5);
    body.rotateX(Math.PI / 2);
    body.translate(0, 0.55, 0);
    geometries.push(body);

    // Chest - wider front
    const chest = new THREE.CylinderGeometry(0.3, 0.28, 0.35, 5);
    chest.rotateX(Math.PI / 2);
    chest.translate(0, 0.6, 0.35);
    geometries.push(chest);

    // Head - angular
    const head = new THREE.SphereGeometry(0.2, 4, 3);
    head.scale(0.9, 0.9, 1.1);
    head.translate(0, 0.85, 0.65);
    geometries.push(head);

    // Snout - pointed fox nose
    const snout = new THREE.ConeGeometry(0.08, 0.35, 4);
    snout.rotateX(Math.PI / 2);
    snout.translate(0, 0.82, 0.95);
    geometries.push(snout);

    // Ears - tall triangular fox ears
    const ear = new THREE.ConeGeometry(0.08, 0.3, 3);
    const e1 = ear.clone(); e1.translate(-0.12, 1.1, 0.6); e1.rotateZ(0.15); geometries.push(e1);
    const e2 = ear.clone(); e2.translate(0.12, 1.1, 0.6); e2.rotateZ(-0.15); geometries.push(e2);

    // Legs - simple cylinders
    const leg = new THREE.CylinderGeometry(0.06, 0.05, 0.5, 4);
    const l1 = leg.clone(); l1.translate(-0.12, 0.25, 0.3); geometries.push(l1);
    const l2 = leg.clone(); l2.translate(0.12, 0.25, 0.3); geometries.push(l2);
    const l3 = leg.clone(); l3.translate(-0.12, 0.25, -0.25); geometries.push(l3);
    const l4 = leg.clone(); l4.translate(0.12, 0.25, -0.25); geometries.push(l4);

    // Bushy tail - signature fox feature
    const tailBase = new THREE.ConeGeometry(0.15, 0.6, 4);
    tailBase.rotateX(-0.6);
    tailBase.translate(0, 0.55, -0.6);
    geometries.push(tailBase);

    const tailTip = new THREE.SphereGeometry(0.12, 3, 2);
    tailTip.translate(0, 0.4, -0.95);
    geometries.push(tailTip);

    return BufferGeometryUtils.mergeGeometries(geometries);
  }

  static createGrass(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    // Create a tuft of 4 blades
    // A blade is a simple tapered Triangle (Plane)
    const bladeGeo = new THREE.PlaneGeometry(0.15, 0.8, 1, 2);

    // Taper the top vertices to make it pointy
    const pos = bladeGeo.attributes.position;
    // The plane has 6 vertices (2 triangles, 3x2).
    // Indexed or not? BufferGeometryUtils usually handles indexed.
    // PlaneGeometry(width, height, wSeg, hSeg)
    // Let's manually manipulate specific vertices.
    // Top row are vertices 0, 1 (if standard). Let's check non-indexed iteration.
    // Standard Plane geometry vertices (w=1, h=2 means 3 rows of verts)
    // It's safer to just iterate and pinch top Y values.

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0.2) { // Top half
        const x = pos.getX(i);
        // Pinch x towards 0 based on height
        pos.setX(i, x * 0.3); // Make tip very thin
      }
    }
    bladeGeo.computeVertexNormals();

    // Blade 1
    const b1 = bladeGeo.clone();
    b1.translate(0, 0.4, 0);
    b1.rotateY(0);
    b1.rotateX(0.1); // Slight lean
    geometries.push(b1);

    // Blade 2
    const b2 = bladeGeo.clone();
    b2.translate(0, 0.4, 0);
    b2.rotateY(2.2); // ~120 deg
    b2.rotateZ(0.1);
    b2.scale(0.8, 0.9, 0.8); // Variability
    geometries.push(b2);

    // Blade 3
    const b3 = bladeGeo.clone();
    b3.translate(0, 0.4, 0);
    b3.rotateY(4.2); // ~240 deg
    b3.rotateX(-0.15);
    b3.scale(0.9, 0.8, 0.9);
    geometries.push(b3);

    const merged = BufferGeometryUtils.mergeGeometries(geometries);
    return merged;
  }
}
