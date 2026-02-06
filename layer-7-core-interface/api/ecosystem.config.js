module.exports = {
  apps: [{
    name: 'layer-7-api',
    script: 'src/index.js',
    // Reduced from 12 to 4 to prevent database connection exhaustion
    // 4 instances × 5 Prisma connections = 20 total (safe for PostgreSQL 100 max_connections)
    instances: 4, 
    exec_mode: 'cluster',
    watch: false,
    env: {
      NODE_ENV: 'production',
      // M4 Unified Memory allows large heaps. 
      // 2GB per instance * 12 instances = 24GB RAM usage (Safe on 64GB M4)
      MAX_OLD_SPACE_SIZE: 2048, 
      UV_THREADPOOL_SIZE: 128 // Critical for avoiding I/O blocking
    },
    // V8 Flags for M4/ARM64 Performance
    node_args: [
      '--max-old-space-size=2048',
      '--no-lazy',             // Compile immediately (startup slower, runtime faster)
      '--use-largepages=on',   // Use larger memory pages (better for high throughput)
      '--optimize-for-size'    // Keep GC pauses short
    ].join(' ')
  }]
};