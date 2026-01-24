const io = require('socket.io-client');

const socket = io('http://localhost:80'); // Connect via Gateway

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket Server with ID:', socket.id);

  // Join the market stream room
  socket.emit('subscribe', 'market-stream');
});

socket.on('tick', (data) => {
  console.log('📈 Received Tick:', JSON.stringify(data));
  // Exit after receiving one tick to prove flow works
  process.exit(0);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection Error:', err.message);
  process.exit(1);
});

// Timeout if no data received
setTimeout(() => {
  console.log('⚠️ Test Timeout: No tick received in 10s. Server might be up but no data flowing.');
  process.exit(0);
}, 10000);
