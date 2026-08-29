const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number.parseInt(process.env.PORT, 10) || 8080;
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

http.createServer((request, response) => {
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
}).listen(port, '0.0.0.0', () => {
    console.log(`TWS4：http://localhost:${port}`);
});
