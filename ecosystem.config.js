module.exports = {
  apps: [{
    name: 'mushamumwe',
    script: 'src/index.js',
    cwd: '/home/wrld/Desktop/PROJECTS/MushaMumwe',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 4000,
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    time: true,
  }],
};
