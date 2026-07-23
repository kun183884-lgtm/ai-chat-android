const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
};

function renderDirList(dirPath, entries, reqUrl) {
    const breadcrumbs = reqUrl.split('/').filter(Boolean);
    let bcHtml = '<a href="/">根目录</a>';
    let acc = '';
    for (const crumb of breadcrumbs) {
        acc += '/' + crumb;
        bcHtml += ` / <a href="${acc}">${crumb}</a>`;
    }

    const items = entries.map(entry => {
        const isDir = entry.isDirectory();
        const icon = isDir ? '📁' : '📄';
        const size = isDir ? '-' : (entry.size ? formatSize(entry.size) : '-');
        const mtime = entry.mtime ? formatTime(entry.mtime) : '-';
        const href = path.join(reqUrl, entry.name).replace(/\\/g, '/');
        return `<tr>
            <td class="name">${icon} <a href="${href}">${isDir ? entry.name + '/' : entry.name}</a></td>
            <td class="size">${size}</td>
            <td class="date">${mtime}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📂 ${path.basename(dirPath) || '文件浏览'}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
    background: #0f0f13;
    color: #e0e0e0;
    min-height: 100vh;
}
.header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    padding: 20px 32px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(12px);
}
.header h1 {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 10px;
}
.header h1 small {
    font-size: 13px;
    font-weight: 400;
    color: rgba(255,255,255,0.4);
}
.breadcrumb {
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    margin-top: 6px;
}
.breadcrumb a {
    color: #64b5f6;
    text-decoration: none;
    transition: color .2s;
}
.breadcrumb a:hover { color: #90caf9; }
.container {
    max-width: 960px;
    margin: 0 auto;
    padding: 24px 16px;
}
.table-wrap {
    background: #1a1a24;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.06);
    overflow: hidden;
}
table {
    width: 100%;
    border-collapse: collapse;
}
th {
    text-align: left;
    padding: 12px 16px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .5px;
    color: rgba(255,255,255,0.35);
    background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.06);
}
td {
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    font-size: 14px;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255,255,255,0.03); }
.name { width: 60%; }
.name a {
    color: #e0e0e0;
    text-decoration: none;
    margin-left: 8px;
    transition: color .2s;
}
.name a:hover { color: #64b5f6; }
.size, .date {
    width: 20%;
    color: rgba(255,255,255,0.4);
    font-size: 13px;
}
.empty {
    text-align: center;
    padding: 48px 16px;
    color: rgba(255,255,255,0.3);
}
.empty p { font-size: 15px; margin-top: 8px; }
.footer {
    text-align: center;
    padding: 24px;
    color: rgba(255,255,255,0.2);
    font-size: 12px;
}
@media (max-width: 600px) {
    .header { padding: 14px 16px; }
    .header h1 { font-size: 16px; }
    .container { padding: 12px 8px; }
    td, th { padding: 8px 10px; }
    .name { width: 50%; }
    .size, .date { width: 25%; font-size: 12px; }
}
</style>
</head>
<body>
<div class="header">
    <h1>📂 ${path.basename(dirPath) || '文件浏览'} <small>${entries.length} 项</small></h1>
    <div class="breadcrumb">${bcHtml}</div>
</div>
<div class="container">
    <div class="table-wrap">
        <table>
            <thead><tr><th>名称</th><th>大小</th><th>修改时间</th></tr></thead>
            <tbody>
                ${items || '<tr><td colspan="3"><div class="empty"><div style="font-size:40px">📭</div><p>此目录为空</p></div></td></tr>'}
            </tbody>
        </table>
    </div>
</div>
<div class="footer">AIChat 文件服务器</div>
</body>
</html>`;
}

function renderFilePage(filePath, reqUrl) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.png','.jpg','.jpeg','.gif','.svg','.ico'].includes(ext)) {
        const data = fs.readFileSync(filePath);
        const mime = MIME[ext] || 'application/octet-stream';
        return { type: 'raw', data, mime };
    }
    if (ext === '.html') {
        const data = fs.readFileSync(filePath, 'utf-8');
        return { type: 'raw', data, mime: 'text/html; charset=utf-8' };
    }
    return { type: 'download', filePath };
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

const server = http.createServer((req, res) => {
    let reqUrl = decodeURIComponent(req.url);
    if (reqUrl.indexOf('?') !== -1) reqUrl = reqUrl.split('?')[0];
    if (reqUrl !== '/' && reqUrl.endsWith('/')) reqUrl = reqUrl.slice(0, -1);

    const safePath = path.normalize(path.join(ROOT, reqUrl));
    if (!safePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    try {
        const stat = fs.statSync(safePath);
        if (stat.isDirectory()) {
            const entries = fs.readdirSync(safePath, { withFileTypes: true }).sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });
            const html = renderDirList(safePath, entries, reqUrl);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
        } else {
            const result = renderFilePage(safePath, reqUrl);
            if (result.type === 'raw') {
                res.writeHead(200, { 'Content-Type': result.mime, 'Content-Length': Buffer.byteLength(result.data) });
                res.end(result.data);
            } else {
                const name = path.basename(safePath);
                const stream = fs.createReadStream(safePath);
                res.writeHead(200, {
                    'Content-Type': 'application/octet-stream',
                    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
                    'Content-Length': stat.size,
                });
                stream.pipe(res);
            }
        }
    } catch (e) {
        res.writeHead(404);
        res.end(`<!DOCTYPE html><html><body style="background:#0f0f13;color:#e0e0e0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:12px"><div style="font-size:64px">🔍</div><h2>404 未找到</h2><p style="color:rgba(255,255,255,0.4)">${reqUrl}</p></body></html>`);
    }
});

server.listen(PORT, () => {
    console.log(`\n  ✨ 文件服务器已启动`);
    console.log(`  ─────────────────────────────`);
    console.log(`  📱 手机访问: http://192.168.0.102:${PORT}`);
    console.log(`  💻 本机访问: http://127.0.0.1:${PORT}`);
    console.log(`  ─────────────────────────────`);
    console.log(`  按 Ctrl+C 停止\n`);
});
