# Project Updates

## 1. Headless Simulation Mode
Added a headless simulation runner `src/headless.ts`.
- **Usage**: `npx tsx src/headless.ts [ticks]`
- **Purpose**: fast-forward simulation to test stability over generations without rendering overhead.
- **Output**: Logs stats to `simulation_stats.csv`.

## 2. Optimizations
- **Spatial Partitioning**: Optimized neighbor lookups using allocation-free searches.
- **Render Logic**: Disabled color updates and ground cover updates in headless mode.
- **Performance**: Simulation speed increased by ~2-3x.

## 3. Ecosystem Tuning
- **Reduced Forest Takeover**: Lowered tree reproduction chance significantly to prevent them from choking out grass.
- **Predator/Prey Balance**:
    - **Rabbits**: Increased birth rate (litter size 3-6, cooldown 500), boosted eating threshold.
    - **Wolves**: Slightly reduced hunting efficiency (Vision 10, Speed 2) to give rabbits a chance to recover.
- **Stability**: Goal is to prevent extinction spirals.
