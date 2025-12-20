import Component from '../../Component'

export default class UIManager extends Component{
    constructor(){
        super();
        this.name = 'UIManager';
        this.upgradeTimeout = null;
    }

    SetAmmo(mag, rest){
        document.getElementById("current_ammo").innerText = mag;
        document.getElementById("max_ammo").innerText = rest;
    }

    SetHealth(health){
        document.getElementById("health_progress").style.width = `${health}%`;
    }

    SetScore(kills){
        document.getElementById("score").innerText = `KILLS: ${kills}`;
    }

    SetWeaponName(name){
        document.getElementById("weapon_name").innerText = name.toUpperCase();
    }

    ShowUpgradeNotification(weaponName){
        const el = document.getElementById("upgrade_notification");
        document.getElementById("upgrade_weapon_name").innerText = weaponName;
        el.classList.remove('hidden');
        el.classList.add('animate-in');

        // Clear any existing timeout
        if (this.upgradeTimeout) {
            clearTimeout(this.upgradeTimeout);
        }

        this.upgradeTimeout = setTimeout(() => {
            el.classList.add('hidden');
            el.classList.remove('animate-in');
        }, 3000);
    }

    Initialize(){
        document.getElementById("game_hud").style.visibility = 'visible';
    }
}
