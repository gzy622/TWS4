const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { syncVersion } = require('./scripts/sync-version');

const root = __dirname;
const port = Number.parseInt(process.env.PORT, 10) || 8080;
const host = process.env.HOST || '0.0.0.0';
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function getCodeBuildInfo() {
    let commitTime = '';
    let commitVer = '';
    try {
        const out = execFileSync('git', ['log', '-1', '--format=%cd', '--date=format:%Y-%m-%d %H:%M:%S'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 2000
        }).trim();
        if (out) {
            commitTime = out;
            commitVer = out.replace(/[- :]/g, '').replace(/^(\d{8})(\d{6})$/, '$1-$2');
        }
    } catch (_) {}

    let latestMtimeMs = 0;
    function scanDir(dir) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanDir(fullPath);
            } else if (/\.(js|css|html|json)$/i.test(entry.name) && entry.name !== 'version.js') {
                const stat = fs.statSync(fullPath);
                if (stat.mtimeMs > latestMtimeMs) {
                    latestMtimeMs = stat.mtimeMs;
                }
            }
        }
    }

    scanDir(path.join(__dirname, 'js'));
    scanDir(path.join(__dirname, 'css'));
    const indexHtmlPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
        const indexStat = fs.statSync(indexHtmlPath);
        if (indexStat.mtimeMs > latestMtimeMs) latestMtimeMs = indexStat.mtimeMs;
    }

    const d = new Date(latestMtimeMs || Date.now());
    const pad = (n) => String(n).padStart(2, '0');
    const fileTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const fileVer = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

    if (commitTime && latestMtimeMs) {
        const commitDate = new Date(commitTime.replace(/-/g, '/'));
        if (latestMtimeMs > commitDate.getTime() + 2000) {
            return { time: fileTime, version: fileVer };
        }
        return { time: commitTime, version: commitVer };
    }

    return { time: commitTime || fileTime, version: commitVer || fileVer };
}

function ensureGitHooks() {
    const gitHooksDir = path.join(__dirname, '.git', 'hooks');
    if (!fs.existsSync(gitHooksDir)) return;
    const preCommitPath = path.join(gitHooksDir, 'pre-commit');
    const hookScript = `#!/bin/sh\nnode scripts/sync-version.js\ngit add js/config/version.js index.html css/main.css js/components/drawer.js\n`;
    try {
        fs.writeFileSync(preCommitPath, hookScript, { mode: 0o755 });
    } catch (_) {}
}

function getAllowedOrigin(request) {
    const origin = request.headers.origin;
    if (!origin) return null;
    try {
        const parsed = new URL(origin);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        const hostname = parsed.hostname;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return origin;
        }

        const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
        if (ipv4Match) {
            const [, oct1, oct2, oct3, oct4] = ipv4Match.map(Number);
            if (oct1 <= 255 && oct2 <= 255 && oct3 <= 255 && oct4 <= 255) {
                if (oct1 === 10) {
                    return origin;
                }
                if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) {
                    return origin;
                }
                if (oct1 === 192 && oct2 === 168) {
                    return origin;
                }
            }
        }
    } catch (_) {}
    return null;
}

function resolveRequestPath(url) {
    const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(root, relativePath);
    const rel = path.relative(root, filePath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    const segments = rel.split(/[\\/]/);
    if (segments.some(segment => segment.startsWith('.'))) {
        return null;
    }
    return filePath;
}

const server = http.createServer((request, response) => {
    const allowedOrigin = getAllowedOrigin(request);
    const corsHeaders = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With'
    };
    if (allowedOrigin) {
        corsHeaders['Access-Control-Allow-Origin'] = allowedOrigin;
        corsHeaders['Vary'] = 'Origin';
    }

    // 统一配置 CORS 跨域响应头
    const setCorsHeaders = (statusCode = 200, contentType = 'application/json; charset=utf-8') => {
        response.writeHead(statusCode, {
            'Content-Type': contentType,
            ...corsHeaders
        });
    };

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
        response.writeHead(204, {
            ...corsHeaders
        });
        response.end();
        return;
    }

    // 接收手机端/前端调试日志回传
    if (request.method === 'POST' && request.url.startsWith('/api/logs')) {
        const MAX_LOG_PAYLOAD = 2 * 1024 * 1024;
        const chunks = [];
        let receivedBytes = 0;
        let exceeded = false;

        request.on('data', chunk => {
            receivedBytes += chunk.length;
            if (receivedBytes > MAX_LOG_PAYLOAD) {
                if (!exceeded) {
                    exceeded = true;
                    chunks.length = 0;
                    setCorsHeaders(413);
                    response.end(JSON.stringify({ success: false, error: 'Payload Too Large' }));
                }
                return;
            }
            chunks.push(chunk);
        });

        request.on('error', err => {
            if (exceeded || response.writableEnded) return;
            console.error('[接收请求流错误]', err);
            setCorsHeaders(500);
            response.end(JSON.stringify({ success: false, error: '数据传输中断: ' + err.message }));
        });

        request.on('end', () => {
            if (exceeded || response.writableEnded) return;
            try {
                const rawBuffer = Buffer.concat(chunks);
                const rawText = rawBuffer.toString('utf-8').trim();

                if (!rawText) {
                    setCorsHeaders(400);
                    response.end(JSON.stringify({ success: false, error: '请求体为空' }));
                    return;
                }

                const parsed = JSON.parse(rawText);
                const logDir = path.join(__dirname, '.debug-logs');
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true });
                }

                const filePath = path.join(logDir, 'latest.json');
                fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8');

                const clientIP = request.socket.remoteAddress || '未知';
                const eventCount = (parsed.events && parsed.events.length) || 0;
                console.log(`[调试日志接收] 客户端: ${clientIP} | 采集事件: ${eventCount} 条 | 大小: ${(receivedBytes / 1024).toFixed(1)} KB | 写入 .debug-logs/latest.json`);

                setCorsHeaders(200);
                response.end(JSON.stringify({ success: true, count: eventCount, savedPath: '.debug-logs/latest.json' }));
            } catch (err) {
                console.error('[调试日志解析或保存失败]', err.message);
                setCorsHeaders(400);
                response.end(JSON.stringify({ success: false, error: 'JSON解析失败: ' + err.message }));
            }
        });
        return;
    }

    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);

    // 动态返回最新代码版本时间戳，确保开发与使用时实时生效
    if (pathname === '/js/config/version.js') {
        const buildInfo = getCodeBuildInfo();
        const versionScript = `(function() {\n    window.TWS3 = window.TWS3 || {};\n    window.TWS3.BUILD_INFO = {\n        time: "${buildInfo.time}",\n        version: "${buildInfo.version}"\n    };\n})();\n`;
        const buf = Buffer.from(versionScript, 'utf8');
        response.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Content-Length': buf.length,
            ...corsHeaders
        });
        response.end(buf);
        return;
    }
    const filePath = resolveRequestPath(request.url);
    if (!filePath) {
        response.writeHead(403).end('Forbidden');
        return;
    }

    fs.stat(filePath, (statError, stat) => {
        if (statError || !stat.isFile()) {
            response.writeHead(404).end('Not Found');
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[extension] || 'application/octet-stream';
        const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
        const isVersioned = new URL(request.url, 'http://localhost').searchParams.has('v');
        const isImmutableAsset = extension === '.woff2' || isVersioned;
        const cacheControl = isImmutableAsset
            ? 'public, max-age=31536000, immutable'
            : 'no-cache';
        const headers = {
            'Content-Type': contentType,
            'Content-Length': stat.size,
            'Cache-Control': cacheControl,
            'ETag': etag,
            'Last-Modified': stat.mtime.toUTCString(),
            ...corsHeaders
        };

        if (request.headers['if-none-match'] === etag) {
            response.writeHead(304, headers);
            response.end();
            return;
        }
        response.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(response);
    });
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`[错误] 端口 ${port} 已被占用，请关闭占用程序或设置其他 PORT。`);
    } else {
        console.error(`[错误] 服务器启动失败：${error.message}`);
    }
    process.exitCode = 1;
});

// 初始化版本与 Git 钩子
try {
    ensureGitHooks();
    syncVersion();
} catch (_) {}

server.listen(port, host, () => {
    console.log(`本机访问：http://localhost:${port}`);

    if (host === '0.0.0.0' || host === '::') {
        const addresses = Object.values(os.networkInterfaces())
            .flat()
            .filter((address) => address && address.family === 'IPv4' && !address.internal)
            .map((address) => address.address);

        if (addresses.length === 0) {
            console.log(`[提示] 未找到局域网 IPv4 地址，请使用本机局域网 IP 和端口 ${port} 访问。`);
        } else {
            for (const address of [...new Set(addresses)]) {
                console.log(`局域网访问：http://${address}:${port}`);
            }
        }
    } else {
        console.log(`网络访问：http://${host}:${port}`);
    }

    console.log('按 Ctrl+C 停止服务。');
});
