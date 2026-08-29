const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android');

function buildApk() {
    const isWindows = os.platform() === 'win32';
    const gradlewCmd = isWindows ? path.join(androidDir, 'gradlew.bat') : path.join(androidDir, 'gradlew');

    console.log('[APK构建] 开始执行 Gradle assembleRelease...');
    const result = spawnSync(gradlewCmd, ['assembleRelease'], {
        cwd: androidDir,
        stdio: 'inherit',
        shell: true
    });

    if (result.status !== 0) {
        console.error('[APK构建失败] 退出码:', result.status);
        process.exit(result.status || 1);
    }

    const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
    console.log(`[APK构建成功] 产物路径: ${apkPath}`);
}

if (require.main === module) {
    buildApk();
}

module.exports = { buildApk };
