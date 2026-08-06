const modules = import.meta.glob('./*.test.js', { eager: true });

export async function runTests() {
    const results = [];
    for (const [path, mod] of Object.entries(modules)) {
        const test = mod.default;
        try {
            const res = await test.run();
            results.push({ name: test.name, ...res });
        } catch (e) {
            results.push({ name: test.name, passed: false, details: 'Ошибка: ' + e.message });
        }
    }
    return results;
}
