const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function getTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());

    const timeStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    const verStr = `${year}${month}${day}-${hours}${minutes}${seconds}`;
    return { timeStr, verStr };
}

function getAppVersionInfo() {
    let appVersion = '1.0.0';
    try {
        const pkgFile = path.join(rootDir, 'package.json');
        if (fs.existsSync(pkgFile)) {
            const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
            if (pkg.version) appVersion = pkg.version;
        }
    } catch (_) {}

    let commitCount = 1;
    try {
        const output = execSync('git rev-list --count HEAD', { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        commitCount = parseInt(output, 10) || 1;
    } catch (_) {}

    const versionCode = commitCount;
    const versionName = `${appVersion}`;

    return { appVersion, versionCode, versionName };
}

function syncVersion(customTime, customVer) {
    const { timeStr, verStr } = (customTime && customVer) ? { timeStr: customTime, verStr: customVer } : getTimestamp();
    const { appVersion, versionCode, versionName } = getAppVersionInfo();

    // 1. js/config/version.js
    const versionFile = path.join(rootDir, 'js', 'config', 'version.js');
    const versionContent = `(function() {
    window.TWS3 = window.TWS3 || {};
    window.TWS3.BUILD_INFO = {
        appVersion: "${appVersion}",
        versionCode: ${versionCode},
        versionName: "${versionName}",
        time: "${timeStr}",
        version: "${verStr}"
    };
})();
`;
    fs.writeFileSync(versionFile, versionContent, 'utf8');

    // 2. android/app/build.gradle
    const gradleFile = path.join(rootDir, 'android', 'app', 'build.gradle');
    if (fs.existsSync(gradleFile)) {
        let gradle = fs.readFileSync(gradleFile, 'utf8');
        gradle = gradle.replace(/versionCode\s+\d+/g, `versionCode ${versionCode}`);
        gradle = gradle.replace(/versionName\s+"[^"]+"/g, `versionName "${versionName}"`);
        fs.writeFileSync(gradleFile, gradle, 'utf8');
    }

    // 3. css/main.css
    const mainCssFile = path.join(rootDir, 'css', 'main.css');
    if (fs.existsSync(mainCssFile)) {
        let mainCss = fs.readFileSync(mainCssFile, 'utf8');
        mainCss = mainCss.replace(/(\.css\?v=)[^"']+/g, `$1${verStr}`);
        fs.writeFileSync(mainCssFile, mainCss, 'utf8');
    }

    // 4. index.html
    const indexHtmlFile = path.join(rootDir, 'index.html');
    if (fs.existsSync(indexHtmlFile)) {
        let indexHtml = fs.readFileSync(indexHtmlFile, 'utf8');
        indexHtml = indexHtml.replace(/(\.css\?v=)[^"']+/g, `$1${verStr}`);
        indexHtml = indexHtml.replace(/(\.js\?v=)[^"']+/g, `$1${verStr}`);
        indexHtml = indexHtml.replace(/(<span class="drawer-footer-text">)[^<]+(<\/span>)/g, `$1v${appVersion} · ${timeStr}$2`);
        fs.writeFileSync(indexHtmlFile, indexHtml, 'utf8');
    }

    // 5. js/components/drawer.js fallback
    const drawerJsFile = path.join(rootDir, 'js', 'components', 'drawer.js');
    if (fs.existsSync(drawerJsFile)) {
        let drawerJs = fs.readFileSync(drawerJsFile, 'utf8');
        drawerJs = drawerJs.replace(/(window\.TWS3\.BUILD_INFO\.time\s*:\s*')[^']+'/g, `$1${timeStr}'`);
        drawerJs = drawerJs.replace(/(window\.TWS3\.BUILD_INFO\.appVersion\s*:\s*')[^']+'/g, `$1${appVersion}'`);
        fs.writeFileSync(drawerJsFile, drawerJs, 'utf8');
    }

    console.log(`[版本同步] 应用版本: v${appVersion} (versionCode: ${versionCode}) | 时间戳: ${timeStr} (${verStr})`);
}

if (require.main === module) {
    syncVersion();
}

module.exports = { syncVersion, getTimestamp, getAppVersionInfo };
