const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android');

function buildApk() {
    const isWindows = os.platform() === 'win32';
    const gradlewCmd = isWindows ? path.join(androidDir, 'gradlew.bat') : path.join(androidDir, 'gradlew');

    console.log('[APK构建] 开始执行 Gradle assembleRelease...');
    const startTime = Date.now();
    const result = spawnSync(gradlewCmd, ['assembleRelease', '--daemon'], {
        cwd: androidDir,
        stdio: 'inherit',
        shell: isWindows
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    if (result.status !== 0) {
        console.error(`[APK构建失败] 耗时 ${duration}s, 退出码:`, result.status);
        process.exit(result.status || 1);
    }

    const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
    console.log(`[APK构建成功] 耗时: ${duration}s | 产物路径: ${apkPath}`);
}

if (require.main === module) {
    buildApk();
}

module.exports = { buildApk };
