export class Inventory {
    constructor() {
        this.auth_code = localStorage.getItem("auth_code");
        this.inventory = JSON.parse(
            localStorage.getItem(`inventory_${this.auth_code}`)
        ) || [];
        this.initializeInventoryMenu();
        this.initializeInventoryEventListeners();
    }

    saveInventory() {
        localStorage.setItem(
            `inventory_${this.auth_code}`,
            JSON.stringify(this.inventory)
        );
    }

    addToInventory(item) {
        const existingItem = this.inventory.find(
            (inventoryItem) => inventoryItem.url === item.url
        );

        if (existingItem) {
            existingItem.count = (existingItem.count || 1) + 1;
        } else {
            this.inventory.push({ ...item, count: 1 });
        }
        this.saveInventory();
    }

    removeFromInventory(item) {
        const existingItem = this.inventory.find(
            (inventoryItem) => inventoryItem.url === item.url
        );

        if (existingItem) {
            existingItem.count -= 1;
            if (existingItem.count <= 0) {
                this.inventory = this.inventory.filter(
                    (inventoryItem) => inventoryItem.url !== item.url
                );
            }
            this.saveInventory();
        } else {
            console.warn(`Item with url ${item.url} not found in inventory.`);
        }
    }

    displayInventory() {
        const sidebar = document.querySelector('.inventory-menu');
        sidebar.innerHTML = '';

        const inventoryList = document.createElement('ul');
        this.inventory.forEach((item) => {
            const listItem = document.createElement('li');
            listItem.textContent = `${item.name} (x${item.count})`;
            inventoryList.appendChild(listItem);
        });

        sidebar.appendChild(inventoryList);
    }

    initializeInventoryMenu() {
        let inventoryButton = document.getElementById('inventory-button');
        if (inventoryButton) {
            inventoryButton.addEventListener('click', (e) => {
                const sidebar = document.querySelector('.inventory-menu');
                sidebar.style.right = sidebar.style.right === '0px' ? '-33%' : '0px';
            });
        }

        const sidebar = document.createElement('div');
        sidebar.classList.add('inventory-menu', 'side-menu');

        // Search Field
        const searchField = document.createElement('input');
        searchField.type = 'text';
        searchField.placeholder = 'Search for items';
        searchField.id = 'inventory-search-field';
        sidebar.appendChild(searchField);

        // Search Button
        const searchButton = document.createElement('button');
        searchButton.textContent = 'Search';
        searchButton.id = 'inventory-search-button';
        sidebar.appendChild(searchButton);

        // Search Results Container
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'inventory-search-results';
        sidebar.appendChild(resultsContainer);

        document.body.appendChild(sidebar);
        document.body.dispatchEvent(new Event('ready.inventory'));

        // Add search button event listener
        searchButton.addEventListener('click', async () => {
            const query = searchField.value;
            if (query.trim() !== '') {
                this.searchItems(query);
            }
        });
    }

    async searchItems(query) {
        try {
            //const response = await fetch(`https://api.example.com/search?q=${encodeURIComponent(query)}`);
            const results = await response.json();

            const resultsContainer = document.getElementById('inventory-search-results');
            resultsContainer.innerHTML = '';

            results.forEach((result) => {
                const resultItem = document.createElement('div');
                resultItem.classList.add('search-result');

                const nameElement = document.createElement('span');
                nameElement.textContent = result.name;

                const addButton = document.createElement('button');
                addButton.textContent = '+';
                addButton.addEventListener('click', () => {
                    this.addToInventory(result);
                });

                resultItem.appendChild(nameElement);
                resultItem.appendChild(addButton);
                resultsContainer.appendChild(resultItem);
            });
        } catch (error) {
            console.error('Error get search results:', error);
        }
    }

    initializeInventoryEventListeners() {
        document.body.addEventListener('ready.inventory', (e) => {
            this.displayInventory();
        });
    }
}
