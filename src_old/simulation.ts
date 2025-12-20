import { CONFIG } from './config';
import { World } from './world';
import { Statistics } from './stats';

export class Simulation {
    // ... props
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private world!: World;
    private stats: Statistics; 
    private isRunning: boolean = false;
    
    // UI Elements
    private ui = {
        playBtn: document.getElementById('playBtn') as HTMLButtonElement,
        speedInput: document.getElementById('speedInput') as HTMLInputElement,
        speedVal: document.getElementById('speedVal') as HTMLElement,
        timeDisplay: document.getElementById('timeDisplay') as HTMLElement,
        
        seed: document.getElementById('seedInput') as HTMLInputElement,
        size: document.getElementById('sizeInput') as HTMLInputElement,
        water: document.getElementById('waterInput') as HTMLInputElement,
        waterVal: document.getElementById('waterVal') as HTMLElement,
        river: document.getElementById('riverInput') as HTMLInputElement,
        
        tree: document.getElementById('treeInput') as HTMLInputElement,
        treeVal: document.getElementById('treeVal') as HTMLElement,
        grass: document.getElementById('grassInput') as HTMLInputElement,
        grassVal: document.getElementById('grassVal') as HTMLElement,
        
        rabbit: document.getElementById('rabbitInput') as HTMLInputElement,
        wolf: document.getElementById('wolfInput') as HTMLInputElement,
        
        regenBtn: document.getElementById('regenBtn') as HTMLButtonElement
    };

    constructor() {
        this.canvas = document.getElementById('simCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.stats = new Statistics('graphCanvas');

        this.syncInputsWithConfig();
        this.setupControls();
        this.initWorld();
        this.resize();
        
        window.addEventListener('resize', () => this.resize());
        this.renderLoop();
    }

    private syncInputsWithConfig() {
        if (this.ui.seed) this.ui.seed.value = CONFIG.seed.toString();
        if (this.ui.size) this.ui.size.value = CONFIG.worldSize.toString();
        
        if (this.ui.water) {
            this.ui.water.value = CONFIG.waterLevel.toString();
            if (this.ui.waterVal) this.ui.waterVal.innerText = CONFIG.waterLevel.toString();
        }
        
        if (this.ui.tree) {
            this.ui.tree.value = CONFIG.treeDensity.toString();
            if (this.ui.treeVal) this.ui.treeVal.innerText = `${Math.round(CONFIG.treeDensity * 100)}%`;
        }
        
        if (this.ui.grass) {
            this.ui.grass.value = CONFIG.grassDensity.toString();
            if (this.ui.grassVal) this.ui.grassVal.innerText = `${Math.round(CONFIG.grassDensity * 100)}%`;
        }
        
        if (this.ui.river) this.ui.river.value = CONFIG.riverCount.toString();
        if (this.ui.rabbit) this.ui.rabbit.value = CONFIG.rabbitCount.toString();
        if (this.ui.wolf) this.ui.wolf.value = CONFIG.wolfCount.toString();
    }

    private setupControls() {
        this.ui.playBtn?.addEventListener('click', () => this.togglePlay());
        this.ui.speedInput?.addEventListener('input', (e) => {
            const val = parseInt((e.target as HTMLInputElement).value);
            CONFIG.tickRate = val;
            if (this.ui.speedVal) this.ui.speedVal.innerText = `${val}ms`;
        });
        
        this.ui.regenBtn?.addEventListener('click', () => this.initWorld());

        this.ui.tree?.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            if (this.ui.treeVal) this.ui.treeVal.innerText = `${Math.round(val * 100)}%`;
        });

        this.ui.grass?.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            if (this.ui.grassVal) this.ui.grassVal.innerText = `${Math.round(val * 100)}%`;
        });

        this.ui.water?.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            if (this.ui.waterVal) this.ui.waterVal.innerText = val.toString();
        });
    }

    private togglePlay() {
        this.isRunning = !this.isRunning;
        if (this.ui.playBtn) {
            this.ui.playBtn.innerText = this.isRunning ? "Pause Simulation" : "Start Simulation";
            this.ui.playBtn.style.background = this.isRunning ? "#ea580c" : "#2563eb";
        }
        if (this.isRunning) this.runGameLoop();
    }

    private initWorld() {
        this.isRunning = false;
        if (this.ui.playBtn) {
            this.ui.playBtn.innerText = "Start Simulation";
            this.ui.playBtn.style.background = "#2563eb";
        }

        // Read Inputs
        const seed = parseInt(this.ui.seed?.value) || 12347;
        if (this.ui.size) CONFIG.worldSize = parseInt(this.ui.size.value) || 400;
        if (this.ui.tree) CONFIG.treeDensity = parseFloat(this.ui.tree.value);
        if (this.ui.grass) CONFIG.grassDensity = parseFloat(this.ui.grass.value);
        if (this.ui.water) CONFIG.waterLevel = parseFloat(this.ui.water.value);
        if (this.ui.river) CONFIG.riverCount = parseInt(this.ui.river.value);
        if (this.ui.rabbit) CONFIG.rabbitCount = parseInt(this.ui.rabbit.value);
        if (this.ui.wolf) CONFIG.wolfCount = parseInt(this.ui.wolf.value);

        this.world = new World(CONFIG.worldSize, seed);
        
        this.stats.reset();
        this.recordStats(); 
        this.draw();
        this.updateStatsUI();
    }

    private runGameLoop() {
        if (!this.isRunning) return;
        this.world.tick();
        this.recordStats();
        this.updateStatsUI();
        setTimeout(() => this.runGameLoop(), CONFIG.tickRate);
    }

    private recordStats() {
        const counts = this.world.getStats();
        this.stats.record(this.world.time, counts);
    }

    private renderLoop() {
        if (this.isRunning) this.draw();
        requestAnimationFrame(() => this.renderLoop());
    }

    private updateStatsUI() {
        if (this.ui.timeDisplay) {
            const totalHours = this.world.time;
            const years = Math.floor(totalHours / (CONFIG.DAYS_PER_YEAR * CONFIG.TICKS_PER_DAY));
            const remainingHours = totalHours % (CONFIG.DAYS_PER_YEAR * CONFIG.TICKS_PER_DAY);
            const days = Math.floor(remainingHours / CONFIG.TICKS_PER_DAY);
            const hours = remainingHours % CONFIG.TICKS_PER_DAY;
            this.ui.timeDisplay.innerText = `Y:${years} D:${days} H:${hours}`;
        }
    }

    private resize(): void {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.stats.resize();
        this.draw();
    }

    private draw(): void {
        if (!this.world) return;

        const cellSize = CONFIG.cellSize;
        const mapPxWidth = this.world.width * cellSize;
        const mapPxHeight = this.world.height * cellSize;
        const offsetX = (this.canvas.width - mapPxWidth) / 2;
        const offsetY = (this.canvas.height - mapPxHeight) / 2;

        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        for (let y = 0; y < this.world.height; y++) {
            for (let x = 0; x < this.world.width; x++) {
                const cell = this.world.cells[y][x];
                this.ctx.fillStyle = cell.getColor();
                this.ctx.fillRect(
                    offsetX + x * cellSize, 
                    offsetY + y * cellSize, 
                    cellSize, 
                    cellSize
                );
            }
        }
    }
}