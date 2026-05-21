const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const allowed = ['/index.html', '/shopping-list.html'];
  if (!allowed.includes(url)) { res.writeHead(404); res.end('Not found'); return; }
  const filePath = path.join(__dirname, url);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(8765, '0.0.0.0', () => {
  console.log('Server running at http://0.0.0.0:8765/');
});
