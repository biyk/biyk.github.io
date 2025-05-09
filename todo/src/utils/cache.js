export class Cache {
    constructor(id) {
        this.id = id;
        this.ttl = sessionStorage.getItem(this.id+'_ttl');
        if (this.ttl < (new Date()).getTime()){
            this.value = null
        } else {
            try {
                this.value = JSON.parse(sessionStorage.getItem(this.id))
            } finally {
                this.value = null
            }
        }
    }

    get(){
        if (this.checkTTL()) return this.value
        return null
    }
    setTTL(time=60){
        this.ttl = (new Date()).getTime() + 60*1000;
        sessionStorage.setItem(this.id+'_ttl', this.ttl);
    }
    set(value){
        this.setTTL();
        sessionStorage.setItem(this.id, JSON.stringify(value))
        this.value = value;
    }

    checkTTL(){
        return this.ttl < (new Date()).getTime()
    }
}