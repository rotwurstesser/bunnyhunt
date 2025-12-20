import { State, FiniteStateMachine } from '../../FiniteStateMachine'

class IdleState extends State {
    get Name() { return 'idle'; }

    Enter(prevState) {
        this.waitTime = Math.random() * 3 + 1; // Wait 1-4 seconds
        this.parent.proxy.PlayAnimation('idle');
    }

    Update(t) {
        this.waitTime -= t;

        // Check if player is near - flee!
        if (this.parent.proxy.IsPlayerNear()) {
            this.parent.SetState('flee');
            return;
        }

        // Done waiting, wander somewhere
        if (this.waitTime <= 0) {
            this.parent.SetState('wander');
        }
    }

    Exit() {}
}

class WanderState extends State {
    get Name() { return 'wander'; }

    Enter(prevState) {
        this.parent.proxy.NavigateToRandomPoint();
        this.parent.proxy.PlayAnimation('run');
        this.stuckTimer = 0;
        this.lastPos = this.parent.proxy.model.position.clone();
    }

    Update(t) {
        // Check if player is near - flee!
        if (this.parent.proxy.IsPlayerNear()) {
            this.parent.SetState('flee');
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
                // We're stuck, go idle
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

class FleeState extends State {
    get Name() { return 'flee'; }

    Enter(prevState) {
        this.parent.proxy.NavigateAwayFromPlayer();
        this.parent.proxy.PlayAnimation('run');
        this.updateTimer = 0.5;
        this.fleeTime = 0;
    }

    Update(t) {
        this.fleeTime += t;
        this.updateTimer -= t;

        // Recalculate flee path periodically
        if (this.updateTimer <= 0 && this.parent.proxy.IsPlayerNear()) {
            this.parent.proxy.NavigateAwayFromPlayer();
            this.updateTimer = 0.5;
        }

        // Stop fleeing if safe and path is done, or after max flee time
        if (this.fleeTime > 3.0 || (!this.parent.proxy.IsPlayerNear() && !this.parent.proxy.path?.length)) {
            this.parent.SetState('idle');
            return;
        }
    }

    Exit() {}
}

class DeadState extends State {
    get Name() { return 'dead'; }

    Enter(prevState) {
        this.parent.proxy.ClearPath();
        this.parent.proxy.PlayAnimation('die', false); // Play once, don't loop
        this.parent.proxy.OnDeath();
        this.parent.proxy.CreateBloodPool();
        this.deathTime = 0;
    }

    Update(t) {
        this.deathTime += t;
    }

    Exit() {}
}

export default class RabbitFSM extends FiniteStateMachine {
    constructor(proxy) {
        super();
        this.proxy = proxy;
        this.AddState('idle', new IdleState(this));
        this.AddState('wander', new WanderState(this));
        this.AddState('flee', new FleeState(this));
        this.AddState('dead', new DeadState(this));
    }
}
