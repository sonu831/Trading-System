const net = require('net');

const [host, port] = process.argv[2].split(':');
const TIMEOUT = 30000; // 30 seconds
const START = Date.now();

if (!host || !port) {
  console.error('Usage: node wait-for-it.js host:port');
  process.exit(1);
}

function tryConnect() {
  if (Date.now() - START > TIMEOUT) {
    console.error(`Timeout waiting for ${host}:${port}`);
    process.exit(1);
  }

  const socket = new net.Socket();
  socket.setTimeout(1000);

  socket.on('connect', () => {
    console.log(`Connected to ${host}:${port}`);
    socket.destroy();
    process.exit(0);
  });

  socket.on('timeout', () => {
    socket.destroy();
    setTimeout(tryConnect, 1000);
  });

  socket.on('error', (err) => {
    socket.destroy();
    setTimeout(tryConnect, 1000);
  });

  socket.connect(port, host);
}

console.log(`Waiting for ${host}:${port}...`);
tryConnect();
