<template>
    <div>
        <ul v-if="products.length">
            <li v-for="product in products" :key="product['reward_id']" class="product-item">
                <span v-if="parseInt(product['reward_cost'])">{{ product['reward_title'] }} - {{ cost(product) }} <button

                    @click="buyProduct(product)">🛒</button>
                </span>

            </li>
        </ul>
        <p v-else>Загрузка товаров...</p>

        <div class="cart" v-if="cart">
            <h3>Корзина</h3>
            <ul>
                <li v-for="item in cart.items" :key="item.id">
                    {{ item.name }} x{{ item.quantity }}
                </li>
            </ul>
        </div>
    </div>
</template>

<script>


import {GoogleSheetDB, ORM, spreadsheetId, Table} from "../../../dnd/static/js/db/google.js";
import {generateUUIDv4} from "@/utils/uuid.js";
import { useStore } from 'vuex'

export default {
    name: 'ProductList',
    data() {
        return {
            products: [],
            cart: null,
            api: null,
        }
    },
    computed: {
        hero() {
            return this.$store.getters["hero/getHero"];
        },
    },
    methods: {
        cost (product){
            return parseInt(Math.round(product['reward_cost'] * this.calc()) )
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

            if (calc && calc.today){
                return calc.month / calc.today
            }
            return calc.week;
        },
        async buyProduct(product) {
            // получить текущий баланс
            let heroTable = new Table({
                spreadsheetId: this.spreadsheetId,
                list: 'real_life_hero',
            });
            let hero = await heroTable.getAll({formated: true, format: 'array'});

            let reward_cost = parseInt(Math.round(product['reward_cost'] * this.calc()) )

            // вычесть стоимость из баланса
            let balance = parseInt(hero.hero_money) - reward_cost;

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
            this.$store.dispatch("hero/initHero");
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

.cart {
    margin-top: 20px;
}
</style>
