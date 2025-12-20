# Rabbit Hunt FPS

A first-person shooter game where you hunt rabbits and foxes across an infinite procedurally generated forest.

## Game Overview

Hunt rabbits and foxes in an endless forest! Collect weapon pickups to upgrade your arsenal, from a hunting rifle to the devastating NUKE. Watch out for aggressive foxes that will chase you down!

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look around |
| Left Click | Shoot |
| R | Reload |
| Space | Jump |

## Game Systems

### Infinite Terrain (TileManager)

The world is composed of 40x40 unit tiles that generate procedurally as you explore.

- **Trigger Distance**: New tiles generate when you're within 18 units of a tile edge
- **Max Tiles**: 15 tiles maximum - oldest tiles are removed when exceeded
- **Tile Contents**:
  - 5-8 trees with physics collision
  - 3 rabbits (passive)
  - 1 fox (aggressive)
  - 1 ammo pickup
  - Random weapon pickup (40% chance)

### Animals

#### Rabbits
- **Behavior**: Passive - flee when player approaches
- **Health**: 10 HP
- **Speed**: 8 units/sec when fleeing
- **Flee Distance**: Triggers at 15 units from player
- **States**: Idle → Wander → Flee → Dead

#### Foxes
- **Behavior**: Aggressive - hunt and attack player
- **Health**: 30 HP
- **Speed**: 6 units/sec (chase), 3 units/sec (patrol)
- **View Distance**: 25 units
- **Attack Damage**: 10 HP per hit
- **States**: Idle → Patrol → Chase → Attack → Dead
- **Loot**: 40% chance to drop weapon on death

### Weapons

All weapons start with the Hunting Rifle. Collect weapon pickups to upgrade!

| Weapon | Fire Rate | Damage | Mag Size | Max Ammo | Type |
|--------|-----------|--------|----------|----------|------|
| Hunting Rifle | 0.8s | 25 | 5 | 30 | Hitscan |
| AK-47 | 0.1s | 8 | 30 | 150 | Hitscan |
| Gatling Gun | 0.04s | 4 | 200 | 600 | Hitscan |
| NUKE | 3.0s | 9999 | 1 | 1 | Projectile |

### Weapon Pickups

Weapon pickups spawn on tiles and from fox kills. They float and rotate for visibility.

**Tile Spawn Rates:**
- AK-47: 25% chance per tile
- Gatling Gun: 12% chance per tile
- NUKE: 3% chance per tile

**Fox Drop Rates (40% chance to drop anything):**
- AK-47: 50% of drops
- Gatling Gun: 35% of drops
- NUKE: 15% of drops

**Visual Indicators:**
- Green glow: AK-47
- Blue glow: Gatling Gun
- Red glow: NUKE

### Ammo Pickups

- 1 ammo pickup spawns per tile
- Gives 30 ammo when collected
- Golden floating box with bullet decorations
- Pickup radius: 2 units

### Bullet Impact Effects

- **Trees/Ground**: Small brown sphere, fades in 0.5s
- **Animals**: Larger red sphere (blood), fades in 0.5s

### Death & Cleanup

When animals die:
1. Death animation plays (once, doesn't loop)
2. Blood pool appears on ground
3. Body remains for 6 seconds
4. Body and blood cleaned up from scene and memory

### Respawning

- Dead animals respawn after 5 seconds
- Respawn handled by SpawnManager
- Animals respawn at random positions

## Architecture

### Entity-Component System

The game uses an Entity-Component architecture:

```
EntityManager
├── Entity (Player)
│   ├── PlayerPhysics
│   ├── PlayerControls
│   ├── Weapon
│   └── PlayerHealth
├── Entity (Level)
│   ├── ForestLighting
│   ├── ForestNavmesh
│   └── TileManager
├── Entity (GameManager)
│   └── GameManager
├── Entity (SpawnManager)
│   └── SpawnManager
├── Entity (UIManager)
│   └── UIManager
└── Entity (Rabbit/Fox/Pickup...)
    └── Controller/Pickup Component
```

### Key Components

| Component | Purpose |
|-----------|---------|
| TileManager | Infinite terrain generation, spawning |
| SpawnManager | Respawning, weapon drops, nuke handling |
| GameManager | Kill tracking, score |
| RabbitController | Rabbit AI (flee behavior) |
| FoxController | Fox AI (chase/attack behavior) |
| WeaponPickup | Floating weapon pickup |
| AmmoPickup | Floating ammo pickup |
| Weapon | Player weapon handling |

### State Machines (FSM)

Animals use Finite State Machines for AI:

**RabbitFSM:**
- IdleState: Wait, check for player proximity
- WanderState: Move to random point
- FleeState: Run away from player
- DeadState: Play death anim, create blood pool

**FoxFSM:**
- IdleState: Wait, look for player
- PatrolState: Wander around
- ChaseState: Pursue player
- AttackState: Attack when close
- DeadState: Play death anim, drop loot

### Event System

Components communicate via broadcast events:

```javascript
// Sending
entity.Broadcast({topic: 'animal_killed', type: 'rabbit'});

// Receiving (in Initialize)
this.parent.RegisterEventHandler(this.OnKill, 'animal_killed');
```

**Key Events:**
- `hit` - Entity took damage
- `animal_killed` - Animal was killed
- `animal_died` - Animal died (for respawn)
- `fox_weapon_drop` - Fox should drop weapon
- `weapon_pickup` - Player picked up weapon
- `AmmoPickup` - Player picked up ammo
- `nuke_fired` - Nuke projectile launched
- `nuke_detonated` - Nuke explosion

## File Structure

```
src/
├── entry.js                    # Main entry, setup
├── EntityManager.js            # Entity management
├── Entity.js                   # Base entity class
├── Component.js                # Base component class
├── AmmoLib.js                  # Ammo.js physics wrapper
├── Input.js                    # Input handling
├── FiniteStateMachine.js       # FSM base classes
│
├── entities/
│   ├── Animals/
│   │   ├── RabbitController.js # Rabbit AI
│   │   ├── RabbitFSM.js        # Rabbit states
│   │   ├── FoxController.js    # Fox AI
│   │   └── FoxFSM.js           # Fox states
│   │
│   ├── Game/
│   │   └── GameManager.js      # Score, progression
│   │
│   ├── Level/
│   │   ├── TileManager.js      # Infinite terrain
│   │   ├── ForestLighting.js   # Scene lighting
│   │   └── ForestNavmesh.js    # Pathfinding
│   │
│   ├── Pickups/
│   │   ├── WeaponPickup.js     # Weapon pickup
│   │   └── AmmoPickup.js       # Ammo pickup
│   │
│   ├── Player/
│   │   ├── PlayerControls.js   # FPS controls
│   │   ├── PlayerPhysics.js    # Player physics
│   │   ├── PlayerHealth.js     # Player HP
│   │   ├── Weapon.js           # Weapon handling
│   │   ├── WeaponConfig.js     # Weapon stats
│   │   ├── WeaponFSM.js        # Weapon states
│   │   └── NukeProjectile.js   # Nuke projectile
│   │
│   ├── Spawn/
│   │   └── SpawnManager.js     # Respawning, drops
│   │
│   └── UI/
│       └── UIManager.js        # HUD elements
│
└── assets/                     # Models, sounds, textures
```

## Technologies

- **Three.js** - 3D rendering
- **Ammo.js** - Physics engine (Bullet physics port)
- **Vite** - Build tool and dev server
- **GLTF/GLB** - 3D model format

## Running the Game

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Performance Notes

- Maximum 15 tiles loaded at once
- Oldest tiles automatically cleaned up
- Physics bodies properly disposed
- Meshes and materials disposed on cleanup
- Impact effects auto-remove after 0.5s
- Corpses cleaned up after 6s
