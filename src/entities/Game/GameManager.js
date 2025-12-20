import Component from '../../Component'

export default class GameManager extends Component {
    constructor() {
        super();
        this.name = 'GameManager';
        this.kills = 0;
        this.currentWeaponTier = 0;
        this.weaponThresholds = [0, 15, 30, 50]; // Rifle, AK-47, Gatling, Nuke
        this.weaponNames = ['Hunting Rifle', 'AK-47', 'Gatling Gun', 'NUKE'];
    }

    Initialize() {
        this.uimanager = this.FindEntity("UIManager").GetComponent("UIManager");
        this.player = this.FindEntity("Player");

        // Listen for animal kills
        this.parent.RegisterEventHandler(this.OnAnimalKilled, 'animal_killed');

        // Initial UI update
        this.uimanager.SetScore(this.kills);
        this.uimanager.SetWeaponName(this.weaponNames[0]);
    }

    OnAnimalKilled = (msg) => {
        this.kills++;
        this.uimanager.SetScore(this.kills);
        this.CheckWeaponUpgrade();
    }

    CheckWeaponUpgrade() {
        // Find the highest tier we qualify for
        let newTier = 0;
        for (let i = this.weaponThresholds.length - 1; i >= 0; i--) {
            if (this.kills >= this.weaponThresholds[i]) {
                newTier = i;
                break;
            }
        }

        if (newTier > this.currentWeaponTier) {
            this.currentWeaponTier = newTier;
            const weaponName = this.weaponNames[newTier];

            // Notify player about weapon upgrade
            this.player.Broadcast({
                topic: 'weapon_upgrade',
                tier: newTier,
                weaponName: weaponName
            });

            // Show upgrade notification in UI
            this.uimanager.ShowUpgradeNotification(weaponName);
            this.uimanager.SetWeaponName(weaponName);
        }
    }

    GetKills() {
        return this.kills;
    }

    GetCurrentWeaponTier() {
        return this.currentWeaponTier;
    }
}
