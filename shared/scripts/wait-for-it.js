const http = require('http');
const net = require('net');

const arg = process.argv[2];
const TIMEOUT = 60000;
const START = Date.now();

if (!arg) {
  console.error('Usage: node wait-for-it.js host:port[/health-path]');
  process.exit(1);
}

const hasPath = arg.includes('/');
let host, port, path;

if (hasPath) {
  const urlPart = arg.split('/');
  const hostPort = urlPart[0].split(':');
  host = hostPort[0];
  port = hostPort[1];
  path = '/' + urlPart.slice(1).join('/');
} else {
  [host, port] = arg.split(':');
}

if (!host || !port) {
  console.error('Usage: node wait-for-it.js host:port[/health-path]');
  process.exit(1);
}

function tryHealthCheck() {
  if (Date.now() - START > TIMEOUT) {
    console.error(`Timeout waiting for ${arg}`);
    process.exit(1);
  }

  const req = http.get(`http://${host}:${port}${path || '/'}`, { timeout: 2000 }, (res) => {
    if (res.statusCode === 200) {
      console.log(`${arg} healthy`);
      process.exit(0);
    }
    setTimeout(tryHealthCheck, 1000);
  });

  req.on('timeout', () => { req.destroy(); setTimeout(tryHealthCheck, 1000); });
  req.on('error', () => { setTimeout(tryHealthCheck, 1000); });
}

function tryConnect() {
  if (Date.now() - START > TIMEOUT) {
    console.error(`Timeout waiting for ${host}:${port}`);
    process.exit(1);
  }

  const socket = new net.Socket();
  socket.setTimeout(2000);

  socket.on('connect', () => {
    socket.destroy();
    if (path) {
      tryHealthCheck();
    } else {
      console.log(`Connected to ${host}:${port}`);
      process.exit(0);
    }
  });

  socket.on('timeout', () => { socket.destroy(); setTimeout(tryConnect, 1000); });
  socket.on('error', () => { setTimeout(tryConnect, 1000); });

  socket.connect(port, host);
}

console.log(`Waiting for ${arg}...`);
tryConnect();
