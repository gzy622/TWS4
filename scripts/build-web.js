const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'www');

function copyStatic() {
    if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outDir, { recursive: true });

    const targets = ['index.html', 'sw.js', 'css', 'js', 'fonts', 'assets'];

    for (const item of targets) {
        const src = path.join(rootDir, item);
        const dest = path.join(outDir, item);
        if (fs.existsSync(src)) {
            const stat = fs.statSync(src);
            if (stat.isDirectory()) {
                fs.cpSync(src, dest, { recursive: true });
            } else {
                fs.copyFileSync(src, dest);
            }
        }
    }

    console.log(`[构建完成] 静态资源已打包至: ${outDir}`);
}

if (require.main === module) {
    copyStatic();
}

module.exports = { copyStatic };
