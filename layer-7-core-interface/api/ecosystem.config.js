module.exports = {
  apps: [{
    name: 'layer-7-api',
    script: 'src/index.ts',
    interpreter: 'node',
    instances: 4,
    exec_mode: 'cluster',
    watch: process.env.PM2_WATCH === 'true' ? ['src'] : false,
    ignore_watch: ['node_modules', '.git', 'prisma', 'data'],
    watch_delay: 1000,
    kill_timeout: 10000,
    env: {
      NODE_ENV: 'production',
      MAX_OLD_SPACE_SIZE: 2048,
      UV_THREADPOOL_SIZE: 128,
    },
    node_args: '--import tsx/esm --max-old-space-size=2048 --no-lazy --optimize-for-size',
  }],
};