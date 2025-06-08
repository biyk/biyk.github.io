<template>
    <div>
        <ul v-if="products.length">
            <li v-for="product in products" :key="product.id" class="product-item">
                <span>{{ product.name }} - ${{ product.price }}</span>
                <button @click="addToCart(product.id)">
                    🛒
                </button>
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


import {GoogleSheetDB} from "../../../dnd/static/js/db/google.js";

export default {
    name: 'ProductList',
    data() {
        return {
            products: [],
            cart: null
        }
    },
    methods: {
        fetchProducts(api) {
            let axios;
            return;
            axios.get('/api/products')
                .then(response => {
                    this.products = response.data
                })
                .catch(error => {
                    console.error('Ошибка при загрузке товаров:', error)
                })
        },
        fetchCart(api) {
            let axios;
            return;
            axios.get('/api/cart')
                .then(response => {
                    this.cart = response.data
                })
                .catch(error => {
                    console.error('Ошибка при обновлении корзины:', error)
                })
        },
        addToCart(productId) {
            let axios;
            return;
            axios.post('/api/cart/add', { productId })
                .then(() => {
                    this.fetchCart()
                })
                .catch(error => {
                    console.error('Ошибка при добавлении в корзину:', error)
                })
        }
    },
    async mounted() {
        const api = window.GoogleSheetDB || new GoogleSheetDB();
        await api.waitGoogle();
        this.fetchProducts(api)
        this.fetchCart(api)
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
