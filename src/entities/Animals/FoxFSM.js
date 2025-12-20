import { State, FiniteStateMachine } from '../../FiniteStateMachine'

class IdleState extends State {
    get Name() { return 'idle'; }

    Enter(prevState) {
        this.waitTime = Math.random() * 2 + 1; // Wait 1-3 seconds
        this.parent.proxy.PlayAnimation('idle');
    }

    Update(t) {
        this.waitTime -= t;

        // Check if player is visible - chase!
        if (this.parent.proxy.CanSeePlayer()) {
            this.parent.SetState('chase');
            return;
        }

        // Done waiting, patrol somewhere
        if (this.waitTime <= 0) {
            this.parent.SetState('patrol');
        }
    }

    Exit() {}
}

class PatrolState extends State {
    get Name() { return 'patrol'; }

    Enter(prevState) {
        this.parent.proxy.NavigateToRandomPoint();
        this.parent.proxy.PlayAnimation('run');
        this.stuckTimer = 0;
        this.lastPos = this.parent.proxy.model.position.clone();
    }

    Update(t) {
        // Check if player is visible - chase!
        if (this.parent.proxy.CanSeePlayer()) {
            this.parent.SetState('chase');
            return;
        }

        // Check if we've reached destination
        if (!this.parent.proxy.path?.length) {
            this.parent.SetState('idle');
            return;
        }

        // Check if stuck
        this.stuckTimer += t;
        if (this.stuckTimer > 2.0) {
            const currentPos = this.parent.proxy.model.position;
            if (currentPos.distanceTo(this.lastPos) < 0.5) {
                this.parent.proxy.ClearPath();
                this.parent.SetState('idle');
                return;
            }
            this.lastPos.copy(currentPos);
            this.stuckTimer = 0;
        }
    }

    Exit() {}
}

class ChaseState extends State {
    get Name() { return 'chase'; }

    Enter(prevState) {
        this.parent.proxy.NavigateToPlayer();
        this.parent.proxy.PlayAnimation('run');
        this.updateTimer = 0.5;
        this.chaseTime = 0;
        this.lostPlayerTime = 0;
    }

    Update(t) {
        this.chaseTime += t;
        this.updateTimer -= t;

        // Check if close enough to attack
        if (this.parent.proxy.IsCloseToPlayer()) {
            this.parent.SetState('attack');
            return;
        }

        // Recalculate path periodically
        if (this.updateTimer <= 0) {
            if (this.parent.proxy.CanSeePlayer()) {
                this.parent.proxy.NavigateToPlayer();
                this.lostPlayerTime = 0;
            } else {
                this.lostPlayerTime += 0.5;
            }
            this.updateTimer = 0.5;
        }

        // Give up if lost player for too long
        if (this.lostPlayerTime > 5.0 || !this.parent.proxy.path?.length) {
            this.parent.SetState('idle');
            return;
        }
    }

    Exit() {}
}

class AttackState extends State {
    get Name() { return 'attack'; }

    Enter(prevState) {
        this.attackTimer = 0;
        this.hasHit = false;
        this.attackDuration = 0.8; // Attack animation duration
        this.parent.proxy.PlayAnimation('attack');
    }

    Update(t) {
        this.attackTimer += t;

        // Face the player
        this.parent.proxy.FacePlayer(t, 5.0);

        // Hit at 60% through the attack
        if (!this.hasHit && this.attackTimer > this.attackDuration * 0.6) {
            if (this.parent.proxy.IsCloseToPlayer()) {
                this.parent.proxy.HitPlayer();
            }
            this.hasHit = true;
        }

        // Attack finished
        if (this.attackTimer >= this.attackDuration) {
            // Continue attacking if still close, otherwise chase
            if (this.parent.proxy.IsCloseToPlayer()) {
                this.parent.SetState('attack'); // Reset attack
            } else {
                this.parent.SetState('chase');
            }
        }
    }

    Exit() {}
}

class DeadState extends State {
    get Name() { return 'dead'; }

    Enter(prevState) {
        this.parent.proxy.ClearPath();
        this.parent.proxy.PlayAnimation('die');
        this.parent.proxy.OnDeath();
        this.deathTime = 0;
    }

    Update(t) {
        this.deathTime += t;
        // Let death animation play, then shrink
        if (this.deathTime > 1.5) {
            const shrinkTime = this.deathTime - 1.5;
            const scale = Math.max(0, 1 - shrinkTime * 2);
            this.parent.proxy.model.scale.setScalar(scale * this.parent.proxy.baseScale);
        }
    }

    Exit() {}
}

export default class FoxFSM extends FiniteStateMachine {
    constructor(proxy) {
        super();
        this.proxy = proxy;
        this.AddState('idle', new IdleState(this));
        this.AddState('patrol', new PatrolState(this));
        this.AddState('chase', new ChaseState(this));
        this.AddState('attack', new AttackState(this));
        this.AddState('dead', new DeadState(this));
    }
}
