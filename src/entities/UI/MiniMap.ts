import * as THREE from 'three';
import Component from '../../core/Component';
import { Entity } from '../../core/Entity';
import SpawnManager from '../Spawn/SpawnManager';
import type { IEntity } from '../../types/entity.types';

/** TileManager interface for getting entities */
interface TileManagerComponent {
    tiles: Array<{ entities: IEntity[] }>;
}

/** Animal controller interface for checking if dead */
interface AnimalControllerLike {
    isDead?: boolean;
}

/** Pickup component interface for checking if collected */
interface PickupComponentLike {
    collected?: boolean;
    isCollected?: boolean;
}

export default class MiniMap extends Component {
    override name = 'MiniMap';

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private size = 200;
    private range = 50; // Map range in world units

    private spawnManager: SpawnManager | null = null;
    private tileManager: TileManagerComponent | null = null;
    private player: Entity | null = null;

    constructor() {
        super();
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '20px';
        this.canvas.style.left = '20px';
        this.canvas.style.borderRadius = '50%';
        this.canvas.style.border = '2px solid #00ff00';
        this.canvas.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.canvas.style.boxShadow = '0 0 10px #00ff00';
        this.ctx = this.canvas.getContext('2d')!;
        document.body.appendChild(this.canvas);
    }

    override Initialize(): void {
        const spawnManagerEntity = this.FindEntity('SpawnManager');
        if (spawnManagerEntity) {
            this.spawnManager = spawnManagerEntity.GetComponent('SpawnManager') as SpawnManager;
        }
        const level = this.FindEntity('Level');
        if (level) {
            this.tileManager = level.GetComponent('TileManager') as TileManagerComponent | undefined ?? null;
        }
        this.player = this.FindEntity('Player') as Entity;
    }

    /** Get all entities with a specific component from TileManager */
    private getEntitiesWithComponent(componentName: string): IEntity[] {
        if (!this.tileManager) return [];
        const result: IEntity[] = [];
        for (const tile of this.tileManager.tiles) {
            for (const entity of tile.entities) {
                if (entity.GetComponent(componentName)) {
                    result.push(entity);
                }
            }
        }
        return result;
    }

    /** Filter out dead animals from entity list */
    private filterAlive(entities: IEntity[], controllerName: string): IEntity[] {
        return entities.filter(entity => {
            const controller = entity.GetComponent(controllerName) as AnimalControllerLike | undefined;
            return controller && !controller.isDead;
        });
    }

    /** Get active pickups (not collected) */
    private getActivePickups(componentName: string): IEntity[] {
        const entities = this.getEntitiesWithComponent(componentName);
        return entities.filter(entity => {
            const pickup = entity.GetComponent(componentName) as PickupComponentLike | undefined;
            return pickup && !pickup.collected && !pickup.isCollected;
        });
    }

    override Update(_deltaTime: number): void {
        if (!this.player) return;

        // Clear
        this.ctx.clearRect(0, 0, this.size, this.size);

        // Draw background (radar lines)
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(this.size / 2, this.size / 2, this.size / 2 - 1, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(this.size / 2, this.size / 2, this.size / 4, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(0, this.size / 2);
        this.ctx.lineTo(this.size, this.size / 2);
        this.ctx.moveTo(this.size / 2, 0);
        this.ctx.lineTo(this.size / 2, this.size);
        this.ctx.stroke();

        const playerPos = this.player.Position;
        const playerRot = this.player.Rotation;

        // Draw Player (Center)
        this.ctx.fillStyle = '#00ff00';
        this.ctx.beginPath();
        this.ctx.arc(this.size / 2, this.size / 2, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // Get animals from SpawnManager (filter out dead ones)
        if (this.spawnManager) {
            this.drawEntities(this.filterAlive(this.spawnManager.GetRabbits(), 'RabbitController'), 'white', playerRot, playerPos, 3);
            this.drawEntities(this.filterAlive(this.spawnManager.GetFoxes(), 'FoxController'), 'orange', playerRot, playerPos, 4);
            this.drawEntities(this.filterAlive(this.spawnManager.GetTrexes(), 'TRexController'), 'red', playerRot, playerPos, 6);
            this.drawEntities(this.filterAlive(this.spawnManager.GetApatosauruses(), 'ApatosaurusController'), 'cyan', playerRot, playerPos, 5);
        }

        // Also get animals from TileManager (dynamically spawned, filter dead)
        this.drawEntities(this.filterAlive(this.getEntitiesWithComponent('RabbitController'), 'RabbitController'), 'white', playerRot, playerPos, 3);
        this.drawEntities(this.filterAlive(this.getEntitiesWithComponent('FoxController'), 'FoxController'), 'orange', playerRot, playerPos, 4);
        this.drawEntities(this.filterAlive(this.getEntitiesWithComponent('TRexController'), 'TRexController'), 'red', playerRot, playerPos, 6);
        this.drawEntities(this.filterAlive(this.getEntitiesWithComponent('ApatosaurusController'), 'ApatosaurusController'), 'cyan', playerRot, playerPos, 5);

        // Draw pickups (weapon pickups = yellow, ammo pickups = green)
        this.drawEntities(this.getActivePickups('WeaponPickup'), 'yellow', playerRot, playerPos, 4, true);
        this.drawEntities(this.getActivePickups('AmmoPickup'), '#00ff00', playerRot, playerPos, 3, true);
    }

    private drawEntities(entities: IEntity[], color: string, playerRot: THREE.Quaternion, playerPos: THREE.Vector3, dotSize: number = 3, isPickup: boolean = false) {
        this.ctx.fillStyle = color;

        // Player Coordinate System
        // Z is forward (world -Z)
        // X is right
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerRot);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerRot);

        for (const entity of entities) {
            const pos = entity.Position;

            // Vector to entity
            const dx = pos.x - playerPos.x;
            const dz = pos.z - playerPos.z;

            // Project onto player axes to get local coordinates (Player-centric)
            // positive dot(forward) = in front
            // positive dot(right) = to the right
            const localZ = dx * forward.x + dz * forward.z;
            const localX = dx * right.x + dz * right.z;

            // Map to Canvas
            // Center = (size/2, size/2)
            // Up (-Y) is Forward (+localZ)
            // Right (+X) is Right (+localX)
            const scale = (this.size / 2) / this.range;

            const cx = this.size / 2 + localX * scale;
            const cy = this.size / 2 - localZ * scale;

            // Check range (Radius check)
            const distSq = (cx - this.size / 2) ** 2 + (cy - this.size / 2) ** 2;
            if (distSq < (this.size / 2 - 2) ** 2) {
                if (isPickup) {
                    // Draw pickups as squares
                    this.ctx.fillRect(cx - dotSize, cy - dotSize, dotSize * 2, dotSize * 2);
                } else {
                    // Draw animals as circles
                    this.ctx.beginPath();
                    this.ctx.arc(cx, cy, dotSize, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
    }

    override Cleanup(): void {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}
