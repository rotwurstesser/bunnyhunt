# Shooting Only Branch 🎯

A high-performance version of Bio Sim 3D optimized for pure shooting gameplay.

## What's Different

This branch removes all simulation/AI processing for maximum performance:

- **Static Mode**: Animals don't move, reproduce, or die naturally - they're pure shooting targets
- **Instant Respawn**: When you kill an animal, a new one spawns elsewhere immediately
- **No Tick Processing**: Skips all plant/animal AI updates = much faster

## Controls

### Desktop (Keyboard + Mouse)
- **WASD** - Move camera
- **Q/E** - Move up/down
- **Mouse** - Aim
- **Space** - Shoot

### Mobile (Touch)
- **Drag** - Pan camera around
- **Tap** - Shoot at target
- **Hold** - Auto-fire with minigun (spools up after 400ms)

## Improved Gatling Gun 🔫

The minigun has been significantly improved:
- **Faster Spool-Up** - Reaches firing speed quicker
- **Higher Fire Rate** - More bullets per second
- **Tracer Bullets** - Yellow tracer lines show where you're shooting
- **Brighter Muzzle Flash** - More satisfying visual feedback
- **Touch Hold Support** - Hold finger on mobile to auto-fire

## Performance Optimizations

- Smaller world size (150 vs 300)
- Fewer animals (200 rabbits, 5 wolves)
- Reduced vegetation density
- No AI processing per tick
- Collapsible config panel (less UI clutter)

## Weapon Progression

- **0-19 points**: Rifle (semi-auto)
- **20-39 points**: Minigun (full-auto)
- **40-59 points**: Rocket Launcher (explosions)
- **60+ points**: NUKE (kills everything)

## Running

```bash
npm install
npm run dev
```

Open http://localhost:5173/ on desktop or mobile browser.
