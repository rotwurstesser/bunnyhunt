// @ts-nocheck
import { World } from './world';
import { CONFIG, RUNTIME } from './config';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line args
const args = process.argv.slice(2);
const TICKS_TO_RUN = parseInt(args[0]) || 50000; // Default to ~5 simulation years
const LOG_INTERVAL = 24; // Log every day

console.log(`Starting Headless Simulation for ${TICKS_TO_RUN} ticks.`);

// Initialize World
// We use a fixed seed for reproducibility in this test, or random if specified
RUNTIME.headless = true;

const seed = CONFIG.seed || Date.now();
const world = new World(CONFIG.worldSize, seed);

console.log(`World Initialized. Size: ${CONFIG.worldSize}x${CONFIG.worldSize}, Seed: ${seed}`);

const statsLog: string[] = [];
statsLog.push("Time,Oak,Pine,Grass,Arid,Rabbit,Wolf");

const startTime = Date.now();

for (let i = 0; i < TICKS_TO_RUN; i++) {
    world.tick();

    if (i % LOG_INTERVAL === 0) {
        const stats = world.getStats();
        // CSV format
        const line = `${world.time},${stats.oak},${stats.pine},${stats.grass},${stats.arid},${stats.rabbit},${stats.wolf}`;
        statsLog.push(line);

        // Console progress every year (approx)
        if (i % (24 * 365) === 0 && i > 0) {
            const years = i / (24 * 365);
            console.log(`Year ${years.toFixed(1)} completed. Stats: R:${stats.rabbit} W:${stats.wolf}`);
        }
    }
}

const endTime = Date.now();
const duration = (endTime - startTime) / 1000;

console.log(`Simulation completed in ${duration.toFixed(2)}s`);
console.log(`Ticks per second: ${(TICKS_TO_RUN / duration).toFixed(0)}`);

// Final Stats
const final = world.getStats();
console.log("Final Stats:", final);

// Write to file
const outputPath = path.resolve('simulation_stats.csv');
fs.writeFileSync(outputPath, statsLog.join('\n'));
console.log(`Stats saved to ${outputPath}`);
