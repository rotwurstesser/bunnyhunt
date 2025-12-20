import { COLORS } from './colors';

interface PopulationRecord {
    year: number;
    oak: number;
    pine: number;
    grass: number;
    arid: number;
    rabbit: number;
    wolf: number;
}

export class Statistics {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private history: PopulationRecord[] = [];
    private maxHistory: number = 300; 

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.draw();
    }

    reset() {
        this.history = [];
        this.draw();
    }

    record(year: number, counts: any) {
        this.history.push({ year, ...counts });
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        this.draw();
    }

    private draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        if (this.history.length < 2) return;

        const padding = { top: 10, right: 10, bottom: 20, left: 35 };
        const graphW = w - padding.left - padding.right;
        const graphH = h - padding.top - padding.bottom;

        // Calculate Max including Animals (multiply by 5 so they show up on same scale as plants?)
        // Actually, let's keep it 1:1 but use a dynamic max
        let maxVal = 0;
        this.history.forEach(r => {
            maxVal = Math.max(maxVal, r.oak, r.pine, r.grass, r.arid, r.rabbit, r.wolf);
        });
        maxVal = Math.max(maxVal * 1.1, 10); 

        const getX = (i: number) => padding.left + (i / (this.history.length - 1)) * graphW;
        const getY = (val: number) => padding.top + graphH - (val / maxVal) * graphH;

        // Axes
        this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(padding.left, padding.top);
        this.ctx.lineTo(padding.left, padding.top + graphH);
        this.ctx.lineTo(padding.left + graphW, padding.top + graphH);
        this.ctx.moveTo(padding.left, padding.top + graphH / 2);
        this.ctx.lineTo(padding.left + graphW, padding.top + graphH / 2);
        this.ctx.stroke();

        // Labels
        this.ctx.fillStyle = '#94a3b8'; 
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(Math.round(maxVal).toString(), padding.left - 4, padding.top);
        this.ctx.fillText(Math.round(maxVal / 2).toString(), padding.left - 4, padding.top + graphH / 2);
        this.ctx.fillText("0", padding.left - 4, padding.top + graphH);
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        const startYear = this.history[0].year;
        const endYear = this.history[this.history.length - 1].year;
        this.ctx.fillText(startYear.toString(), padding.left, padding.top + graphH + 4);
        this.ctx.fillText(endYear.toString(), padding.left + graphW, padding.top + graphH + 4);

        // Lines
        this.drawLine(r => r.oak, COLORS.Plant.Oak, getX, getY);
        this.drawLine(r => r.pine, COLORS.Plant.Pine, getX, getY);
        this.drawLine(r => r.grass, COLORS.Plant.Grass, getX, getY);
        this.drawLine(r => r.arid, COLORS.Plant.AridGrass, getX, getY);
        this.drawLine(r => r.rabbit, COLORS.Animal.Rabbit, getX, getY);
        this.drawLine(r => r.wolf, COLORS.Animal.Wolf, getX, getY);
    }

    private drawLine(getValue: (r: PopulationRecord) => number, color: string, getX: any, getY: any) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.lineJoin = 'round';
        this.history.forEach((rec, i) => {
            const x = getX(i);
            const y = getY(getValue(rec));
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        });
        this.ctx.stroke();
    }
}