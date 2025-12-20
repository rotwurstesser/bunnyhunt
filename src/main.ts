import './style.css';
import { World } from './world';
import { CONFIG } from './config';
import { Renderer3D } from './renderer3d';

// Initialize
// Hide 2D Canvas if present or reuse container
const canvas2d = document.getElementById('simCanvas');
if (canvas2d) canvas2d.style.display = 'none';

// Create World
const world = new World(CONFIG.worldSize, CONFIG.seed);
const renderer = new Renderer3D(); // No arg needed in new implementation

// Bind Visual Tweaks
// Bind Visual Tweaks
const bind = (id: string, key: keyof typeof CONFIG.visual) => {
  const el = document.getElementById(id) as HTMLInputElement;
  const valEl = document.getElementById('val_' + id);
  if (el) {
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      CONFIG.visual[key] = v;
      if (valEl) valEl.innerText = v.toFixed(1);
    });
  }
};

bind('treeScale', 'treeScale');
bind('treeY', 'treeY');
bind('grassScale', 'grassScale');
bind('grassY', 'grassY');
bind('grassDensity', 'grassDensity');
bind('grassCoverage', 'grassCoverage');
bind('rabbitScale', 'rabbitScale');
bind('rabbitY', 'rabbitY');
bind('wolfScale', 'wolfScale');
bind('wolfY', 'wolfY');

// Bind Spawn Rate sliders
const bindSpawnRate = (id: string, key: keyof typeof CONFIG.spawnRates) => {
  const el = document.getElementById(id) as HTMLInputElement;
  const valEl = document.getElementById('val_' + id);
  if (el) {
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      CONFIG.spawnRates[key] = v;
      if (valEl) valEl.innerText = v.toFixed(3);
    });
  }
};

bindSpawnRate('rabbitSpawnRate', 'rabbitSpawnRate');
bindSpawnRate('wolfSpawnRate', 'wolfSpawnRate');

// Simple Game Loop
let lastTime = 0;
const loop = (_time: number) => {
  requestAnimationFrame(loop);

  // Throttling logic
  // We probably want to tick the world every X ms, but render every frame
  const now = Date.now();
  if (now - lastTime > CONFIG.tickRate) {
    world.tick();
    try {
      renderer.syncWorld(world);
    } catch (e) { console.error(e); }
    lastTime = now;

    // Minimal stats update
    const stats = world.getStats();
    // Update Info overlay (added in new index.html)
    const info = document.getElementById('info');
    if (info) {
      const totalHours = world.time;
      const years = Math.floor(totalHours / (CONFIG.DAYS_PER_YEAR * CONFIG.TICKS_PER_DAY));
      info.innerText = `Bio Sim 3D | Year: ${years} | R: ${stats.rabbit} W: ${stats.wolf}`;
    }
  }

  renderer.render();
};

// Initial Render
renderer.syncWorld(world);
loop(0);
