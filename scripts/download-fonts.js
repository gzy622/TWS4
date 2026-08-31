const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const fontsDir = path.join(rootDir, 'fonts');
const cssDir = path.join(rootDir, 'css');

if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
}

async function downloadFile(url, destPath, retries = 5) {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
        return; // Already downloaded
    }
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            }
            const arrayBuffer = await res.arrayBuffer();
            fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
            return;
        } catch (e) {
            if (attempt === retries) {
                throw new Error(`Failed to fetch ${url} after ${retries} attempts: ${e.message}`);
            }
            await new Promise(r => setTimeout(r, attempt * 500));
        }
    }
}

async function main() {
    console.log('[1/3] 下载 Iosevka 等宽西文字库 (用于更纱黑体等宽排版)...');
    const iosevkaUrl = 'https://cdn.jsdelivr.net/npm/@fontsource/iosevka@5.3.0/files/iosevka-latin-400-normal.woff2';
    const iosevkaDest = path.join(fontsDir, 'iosevka-regular.woff2');
    await downloadFile(iosevkaUrl, iosevkaDest);
    console.log('√ iosevka-regular.woff2 已准备就绪');

    console.log('\n[2/3] 下载 LXGW WenKai 霞鹜文楷离线字库 (用于楷体书法)...');
    const lxgwCssUrl = 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css';
    const lxgwCssRes = await fetch(lxgwCssUrl);
    const lxgwCss = await lxgwCssRes.text();
    
    const lxgwMatches = [...lxgwCss.matchAll(/url\(['"]?\.\/files\/([^'"\)]+)['"]?\)/g)];
    const lxgwFiles = [...new Set(lxgwMatches.map(m => m[1]))];
    console.log(`共需同步 ${lxgwFiles.length} 个文楷切片文件...`);

    let lxgwDone = 0;
    const lxgwBatchSize = 6;
    for (let i = 0; i < lxgwFiles.length; i += lxgwBatchSize) {
        const batch = lxgwFiles.slice(i, i + lxgwBatchSize);
        await Promise.all(batch.map(async file => {
            const url = `https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/files/${file}`;
            const dest = path.join(fontsDir, file);
            await downloadFile(url, dest);
            lxgwDone++;
        }));
        process.stdout.write(`\r文楷下载进度: ${lxgwDone}/${lxgwFiles.length} (${Math.round(lxgwDone / lxgwFiles.length * 100)}%)`);
    }
    console.log('\n√ LXGW WenKai 楷体字库切片下载完成');

    console.log('\n[3/3] 下载 Noto Serif SC 思源宋体离线字库 (用于宋体衬线)...');
    const serifCssUrl = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.3.0/400.css';
    const serifCssRes = await fetch(serifCssUrl);
    const serifCss = await serifCssRes.text();

    const serifMatches = [...serifCss.matchAll(/url\(\.\/files\/([^)]+)\)/g)];
    const serifFiles = [...new Set(serifMatches.map(m => m[1]).filter(f => f.endsWith('.woff2')))];
    console.log(`共需同步 ${serifFiles.length} 个宋体切片文件...`);

    let serifDone = 0;
    const serifBatchSize = 6;
    for (let i = 0; i < serifFiles.length; i += serifBatchSize) {
        const batch = serifFiles.slice(i, i + serifBatchSize);
        await Promise.all(batch.map(async file => {
            const url = `https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.3.0/files/${file}`;
            const dest = path.join(fontsDir, file);
            await downloadFile(url, dest);
            serifDone++;
        }));
        process.stdout.write(`\r宋体下载进度: ${serifDone}/${serifFiles.length} (${Math.round(serifDone / serifFiles.length * 100)}%)`);
    }
    console.log('\n√ Noto Serif SC 宋体字库切片下载完成');

    console.log('\n[4/4] 正在合并生成完整的离线 css/fonts.css...');
    // 读取原有 noto sans sc css
    const originalFontsCssPath = path.join(cssDir, 'fonts.css');
    let notoSansCss = '';
    if (fs.existsSync(originalFontsCssPath)) {
        const originalContent = fs.readFileSync(originalFontsCssPath, 'utf8');
        // 仅保留 Noto Sans SC 部分（前 2437 行）
        const splitIdx = originalContent.indexOf('/* ========================================================= */');
        notoSansCss = splitIdx > 0 ? originalContent.slice(0, splitIdx) : originalContent;
    }

    // 1. 更纱黑体 @font-face: 西文与数字由 iosevka-regular.woff2 渲染，汉字由 noto-sans-sc 切片渲染
    let sarasaCss = `/* ========================================================= */
/* 更纱黑体 / 等宽黑体 (Sarasa Gothic / UI / Term SC) 本地离线字体 */
/* ========================================================= */
@font-face {
  font-family: 'Sarasa UI SC';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(../fonts/iosevka-regular.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074-20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Sarasa Gothic SC';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(../fonts/iosevka-regular.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074-20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: '更纱黑体';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(../fonts/iosevka-regular.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074-20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Sarasa Term SC';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(../fonts/iosevka-regular.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074-20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Sarasa Fixed SC';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(../fonts/iosevka-regular.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074-20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
`;

    // 2. 霞鹜文楷 @font-face (替换相对路径为 ../fonts/ 并增加 STKaiti / KaiTi / 楷体 别名)
    let processedLxgwCss = lxgwCss.replace(/\.\/files\//g, '../fonts/');
    const kaitiAliases = `/* ========================================================= */
/* 楷体 / 霞鹜文楷 (KaiTi / LXGW WenKai) 本地离线字体库 */
/* ========================================================= */
` + processedLxgwCss + '\n' +
        processedLxgwCss.replace(/font-family:\s*'LXGW WenKai'/g, "font-family: 'STKaiti'") + '\n' +
        processedLxgwCss.replace(/font-family:\s*'LXGW WenKai'/g, "font-family: 'KaiTi'") + '\n' +
        processedLxgwCss.replace(/font-family:\s*'LXGW WenKai'/g, "font-family: '楷体'");

    // 3. 思源宋体 @font-face (替换相对路径为 ../fonts/ 并增加 SimSun / Songti SC / 宋体 别名)
    let processedSerifCss = serifCss.replace(/\.\/files\//g, '../fonts/');
    const songtiAliases = `/* ========================================================= */
/* 宋体 / 思源宋体 (SongTi / Noto Serif SC) 本地离线字体库 */
/* ========================================================= */
` + processedSerifCss + '\n' +
        processedSerifCss.replace(/font-family:\s*'Noto Serif SC'/g, "font-family: 'SimSun'") + '\n' +
        processedSerifCss.replace(/font-family:\s*'Noto Serif SC'/g, "font-family: 'Songti SC'") + '\n' +
        processedSerifCss.replace(/font-family:\s*'Noto Serif SC'/g, "font-family: 'STSong'") + '\n' +
        processedSerifCss.replace(/font-family:\s*'Noto Serif SC'/g, "font-family: '宋体'");

    // 合并生成完整的 fonts.css
    const combinedFontsCss = [
        notoSansCss.trim(),
        sarasaCss.trim(),
        kaitiAliases.trim(),
        songtiAliases.trim()
    ].join('\n\n');

    fs.writeFileSync(originalFontsCssPath, combinedFontsCss, 'utf8');
    console.log(`√ css/fonts.css 已生成完毕，包含思源黑体、更纱黑体、楷体、宋体全套离线字库！`);
}

main().catch(err => {
    console.error('下载或处理失败:', err);
    process.exit(1);
});
