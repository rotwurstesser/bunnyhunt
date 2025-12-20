import * as THREE from 'three'
import Component from '../../Component'
import { Pathfinding } from 'three-pathfinding'

export default class ForestNavmesh extends Component {
    constructor(mapSize = 80) {
        super();
        this.name = 'Navmesh';
        this.mapSize = mapSize;
        this.zone = 'forest';
    }

    Initialize() {
        this.pathfinding = new Pathfinding();

        // Create a simple flat navmesh geometry
        const navmeshGeo = new THREE.PlaneGeometry(this.mapSize - 10, this.mapSize - 10, 4, 4);
        navmeshGeo.rotateX(-Math.PI / 2);

        // Create zone data from geometry
        this.pathfinding.setZoneData(this.zone, Pathfinding.createZone(navmeshGeo));
    }

    GetRandomNode(position, range) {
        try {
            // Normalize Y to navmesh level for pathfinding
            const navPos = new THREE.Vector3(position.x, 0, position.z);
            const groupID = this.pathfinding.getGroup(this.zone, navPos);
            const node = this.pathfinding.getRandomNode(this.zone, groupID, navPos, range);
            if (node) {
                node.y = 0; // Keep at ground level
            }
            return node;
        } catch (e) {
            // Fallback to random position
            const halfMap = this.mapSize / 2 - 10;
            return new THREE.Vector3(
                (Math.random() - 0.5) * 2 * halfMap,
                0,
                (Math.random() - 0.5) * 2 * halfMap
            );
        }
    }

    FindPath(start, end) {
        try {
            // Normalize Y to navmesh level for pathfinding
            const navStart = new THREE.Vector3(start.x, 0, start.z);
            const navEnd = new THREE.Vector3(end.x, 0, end.z);
            const groupID = this.pathfinding.getGroup(this.zone, navStart);
            const path = this.pathfinding.findPath(navStart, navEnd, this.zone, groupID);
            return path && path.length > 0 ? path : [navEnd.clone()];
        } catch (e) {
            // Direct path fallback
            return [new THREE.Vector3(end.x, 0, end.z)];
        }
    }
}
