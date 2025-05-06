import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname, 'output.txt');
const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.output', 'assets'];
const ignoreFiles = ['dump-vue-project.js', 'readme.md', 'style.css','output.txt', 'package-lock.json', 'package.json', 'vite.svg'];

async function dumpDirectory(dir, writeStream) {
    const items = await fs.promises.readdir(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.promises.stat(fullPath);

        if (stat.isDirectory()) {
            if (!ignoreDirs.includes(item)) {
                await dumpDirectory(fullPath, writeStream);
            }
        } else {
            if (!ignoreFiles.includes(item)) {
            try {
                const content = await fs.promises.readFile(fullPath, 'utf8');
                writeStream.write(`--- FILE: ${fullPath} ---\n`);
                writeStream.write(content + '\n\n');
            } catch (err) {
                console.error(`Ошибка при чтении файла ${fullPath}:`, err.message);
            }
        }
    }
}
}

async function main() {
    const writeStream = fs.createWriteStream(outputPath, { flags: 'w' });
    await dumpDirectory(__dirname, writeStream);
    writeStream.end(() => {
        console.log(`✅ Содержимое проекта сохранено в ${outputPath}`);
    });
}

main();
