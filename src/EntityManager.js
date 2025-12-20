export default class EntityManager{
    constructor(){
        this.ids = 0;
        this.entities = [];
    }

    Get(name){
        return this.entities.find(el=>el.Name===name);
    }

    Add(entity){
        if(!entity.Name){
            entity.SetName(this.ids);
        }
        entity.id = this.ids;
        this.ids++;
        entity.SetParent(this);
        this.entities.push(entity);
    }

    EndSetup(){
        for(const ent of this.entities){
            for(const key in ent.components){
                ent.components[key].Initialize();
            }
        }
    }

    PhysicsUpdate(world, timeStep){
        for (const entity of this.entities) {
            entity.PhysicsUpdate(world, timeStep);
        }
    }

    Update(timeElapsed){
        for (const entity of this.entities) {
            if (entity.active !== false) {
                entity.Update(timeElapsed);
            }
        }
    }

    Remove(entity){
        const idx = this.entities.indexOf(entity);
        if (idx > -1) {
            this.entities.splice(idx, 1);
        }
    }

    GetAll(){
        return this.entities;
    }
}