module.exports = {
  apps: [
    {
      name: 'youzan-dev',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--harmony',
      merge_logs: true,
      instance_var: 'INSTANCE_ID',
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' },
    },
    {
      name: 'youzan-prod',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--harmony',
      merge_logs: true,
      instance_var: 'INSTANCE_ID',
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' },
    },
  ],
  deploy: {
    production: {
      // user: 'root',
      host: [
        // { host: '' },
      ],
      ref: 'origin/master',
      repo: 'git@github.com:buzz-buzz/youzan.git',
      path: '/var/www/youzan',
      'post-deploy': 'bash post-deploy-prod.sh',
    },
    dev: {
      // user: 'root',
      host: [
        // { host: '', port: '2222' },
      ],
      ref: 'origin/develop',
      repo: 'git@github.com:buzz-buzz/youzan.git',
      path: '/var/www/youzan',
      'post-deploy': 'bash post-deploy.sh',
    },
  },
}
