
class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    // Mulberry32 algorithm
    next(): number {
        var t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    
    // Range helper
    range(min: number, max: number): number {
        return min + this.next() * (max - min);
    }
}

class SimpleNoise {
    private rng: SeededRandom;
    private gradients: { [key: string]: number } = {};

    constructor(rng: SeededRandom) {
        this.rng = rng;
    }

    // Simple 2D Value Noise
    get(x: number, y: number): number {
        const intX = Math.floor(x);
        const intY = Math.floor(y);
        const fracX = x - intX;
        const fracY = y - intY;

        const v1 = this.getPseudoRandom(intX, intY);
        const v2 = this.getPseudoRandom(intX + 1, intY);
        const v3 = this.getPseudoRandom(intX, intY + 1);
        const v4 = this.getPseudoRandom(intX + 1, intY + 1);

        const i1 = this.lerp(v1, v2, fracX);
        const i2 = this.lerp(v3, v4, fracX);
        
        return this.lerp(i1, i2, fracY);
    }

    private getPseudoRandom(x: number, y: number): number {
        const key = `${x},${y}`;
        if (this.gradients[key] === undefined) {
            // Using a simple hash for deterministic noise based on coordinate + master seed
            // This is a simplification; normally we'd pre-generate a permutation table
            let h = Math.sin(x * 12.9898 + y * 78.233 + this.rng.next()) * 43758.5453123;
            this.gradients[key] = h - Math.floor(h);
        }
        return this.gradients[key];
    }

    private lerp(a: number, b: number, t: number): number {
        return a + t * (b - a);
    }
}


export { SeededRandom, SimpleNoise };