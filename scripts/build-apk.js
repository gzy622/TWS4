const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { syncVersion } = require('./sync-version');
const { copyStatic } = require('./build-web');

const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android');

function runCommand(command, args, options = {}) {
    const isWindows = os.platform() === 'win32';
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        shell: isWindows,
        ...options
    });
    if (result.status !== 0) {
        console.error(`[执行失败] 命令: ${command} ${args.join(' ')}, 退出码: ${result.status}`);
        process.exit(result.status || 1);
    }
}

function buildApk() {
    console.log('========================================================');
    console.log('              TWS4 - 一键构建 Release APK');
    console.log('========================================================\n');

    const totalStartTime = Date.now();

    // 1. 同步版本与静态资源打包
    console.log('[1/3] 同步版本信息并打包 Web 静态资源...');
    syncVersion();
    copyStatic();
    console.log('');

    // 2. 同步 Capacitor Android 资产与插件
    console.log('[2/3] 同步 Capacitor Android 工程资产...');
    const npxCmd = os.platform() === 'win32' ? 'npx.cmd' : 'npx';
    runCommand(npxCmd, ['cap', 'sync', 'android'], { cwd: rootDir });
    console.log('');

    // 3. 执行 Gradle assembleRelease
    console.log('[3/3] 开始执行 Gradle assembleRelease 构建 Release APK...');
    const isWindows = os.platform() === 'win32';
    const gradlewCmd = isWindows ? path.join(androidDir, 'gradlew.bat') : path.join(androidDir, 'gradlew');
    runCommand(gradlewCmd, ['assembleRelease', '--daemon'], { cwd: androidDir });
    console.log('');

    // 4. 结果汇总与文件校验
    const totalDuration = ((Date.now() - totalStartTime) / 1000).toFixed(2);
    const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

    console.log('========================================================');
    console.log(`[构建成功] Release APK 构建完成！总耗时: ${totalDuration}s`);
    if (fs.existsSync(apkPath)) {
        const stats = fs.statSync(apkPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`产物路径: ${apkPath}`);
        console.log(`文件大小: ${sizeMB} MB (${stats.size.toLocaleString()} 字节)`);
    } else {
        console.log(`产物目录: ${path.dirname(apkPath)}`);
    }
    console.log('========================================================\n');
}

if (require.main === module) {
    buildApk();
}

module.exports = { buildApk };
