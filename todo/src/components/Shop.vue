<template>
    <div>
        <ul v-if="products.length">
            <li v-for="product in products" :key="product['reward_id']" class="product-item">
                <span v-if="parseInt(product['reward_cost'])">{{ product['reward_title'] }} - {{ cost(product) }} <button
                    :style="{ backgroundColor: hero.hero_money < cost(product) ? 'red' : '' }"
                    :disabled="buying"

                    @click="buyProduct(product)">🛒</button>
                </span>

            </li>
        </ul>
        <p v-else>Загрузка товаров...</p>
    </div>
</template>

<script>


import {GoogleSheetDB, Table} from "../../../dnd/static/js/db/google.js";
import {generateUUIDv4} from "@/utils/uuid.js";

export default {
    name: 'ProductList',
    data() {
        return {
            products: [],
            api: null,
            buying: false,
        }
    },
    computed: {
        hero() {
            return this.$store.getters["hero/getHero"];
        },
    },
    methods: {
        cost (product){
            let cost = parseInt(product['reward_cost']);
            if (isNaN(cost)) {
                console.error(product);
                return 0
            }
            return parseInt(product['reward_cost']);
            //return parseInt(Math.round(product['reward_cost'] * Math.min(this.calc(), 2)) )
        },
        async fetchProducts() {
            let itemsTable = new Table({
                spreadsheetId: this.spreadsheetId,
                list: 'real_life_rewards',
            });
            this.products = await itemsTable.getAll({formated:true, format: 'orm'});
        },
        calc(){
            let calc = this.$store.getters["settings/allCalc"];

            if (calc && calc.h24_time){
                return calc.month / calc.h24_time
            }
            return calc.week;
        },
        doAuth() {
            let api = window.GoogleSheetDB || new GoogleSheetDB();
            if (api.expired()){
                document.getElementById('authorize_button').click()
            }
        },
        async buyProduct(product) {
            this.doAuth();
            if (this.buying) return;
            this.buying = true;
            try {
                // получить текущий баланс
                let heroTable = new Table({
                    spreadsheetId: this.spreadsheetId,
                    list: 'real_life_hero',
                });
                let hero = await heroTable.getAll({formated: true, format: 'array'});

                let reward_cost = this.cost(product)

                // вычесть стоимость из баланса
                let balance = (parseFloat(hero.hero_money) || 0) - reward_cost;
                // записать баланс в таблицу
                await heroTable.updateRowByCode('hero_money', {value: balance});

                // добавить в историю покупок
                let historyTable = new Table({
                    spreadsheetId: this.spreadsheetId,
                    list: 'rewards_history',
                });
                await historyTable.addRow({
                    claim_date: new Date().getTime(),
                    item_id:generateUUIDv4(),
                    gold_spent: reward_cost,
                    reward_title: product['reward_title'],
                    reward_id: product['reward_id']
                });

                // обновить количество товара
                let itemsTable = new Table({
                    spreadsheetId: this.spreadsheetId,
                    list: 'real_life_rewards',
                });
                await itemsTable.updateRowByCode(product['reward_title'], {'reward_done': parseInt(product['reward_done']) + 1});
                await itemsTable.updateRowByCode(product['reward_title'], {'reward_cost': parseInt(product['reward_cost']) +  parseInt(product['reward_cost_step'])});
                this.$store.dispatch("hero/initHero");
            } catch (err) {
                console.error('Ошибка покупки:', err);
            } finally {
                this.buying = false;
            }
        }
    },
    async mounted() {
        const data = localStorage.getItem('todo-settings');
        let settings =  data ? JSON.parse(data) : [];
        const spreadsheetSetting = settings.find(s => s.code === "spreadsheetId");
        this.spreadsheetId = spreadsheetSetting ? spreadsheetSetting.value : '';
        this.api = window.GoogleSheetDB || new GoogleSheetDB();
        await this.api.waitGoogle();
        await this.fetchProducts()

    }
}
</script>

<style scoped>
.product-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
}
</style>
