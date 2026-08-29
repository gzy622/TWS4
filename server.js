const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = __dirname;
const port = Number.parseInt(process.env.PORT, 10) || 8080;
const host = process.env.HOST || '0.0.0.0';
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.woff2': 'font/woff2',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function resolveRequestPath(url) {
    const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(root, relativePath);
    return filePath.startsWith(`${root}${path.sep}`) ? filePath : null;
}

const server = http.createServer((request, response) => {
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

        const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        response.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
        });
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
