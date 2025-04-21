export class NpcApi {
    constructor() {}

    async getNpc(query='') {
        const response = await fetch(`/api/data/npc?name=${encodeURIComponent(query)}`);
        return await response.json();
    }
}