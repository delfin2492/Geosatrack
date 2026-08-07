// ============================================================
// PM2 Ecosystem Config — GeoMesh Production (No Docker)
// ============================================================
// Install PM2 global: npm install -g pm2
//
// Commands:
//   pm2 start ecosystem.config.js       # Start semua
//   pm2 restart all                     # Restart semua
//   pm2 reload all                      # Zero-downtime reload
//   pm2 stop all                        # Stop semua
//   pm2 logs                            # Lihat log
//   pm2 monit                           # Dashboard monitoring
//   pm2 save && pm2 startup             # Auto-start saat reboot

module.exports = {
  apps: [
    // ─── BACKEND (NestJS) ─────────────────────────────────────────────
    {
      name: 'geomesh-backend',
      cwd: './apps/backend',

      // Mode produksi (compiled JS)
      script: '../../node_modules/.bin/ts-node',
      args: '-r tsconfig-paths/register src/main.ts',
      // ATAU jika sudah build: script: 'dist/main.js'

      interpreter: 'node',
      watch: false,         // false untuk prod, true untuk dev-like
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',

      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        DATABASE_URL: 'postgresql://geouser:geopassword@localhost:5432/geomesh?schema=public',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        MQTT_BROKER_URL: 'mqtt://localhost:1883',
        MQTT_USERNAME: 'admin_geomesh',
        MQTT_PASSWORD: 'admin_geomesh',
        KEYCLOAK_URL: 'http://localhost:8080',
        KEYCLOAK_REALM: 'geomesh',
        KEYCLOAK_CLIENT_ID: 'geomesh-app',
        KEYCLOAK_CLIENT_SECRET: 'change-me-on-production',
        JWT_SECRET: 'super-secret-jwt-key-change-me',
      },

      // Log configuration
      out_file: '../../logs/backend-out.log',
      error_file: '../../logs/backend-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ─── FRONTEND (Next.js) ────────────────────────────────────────────
    {
      name: 'geomesh-frontend',
      cwd: './apps/frontend',

      // Next.js built server
      script: 'node_modules/.bin/next',
      args: 'start -p 3300',

      interpreter: 'node',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',

      env: {
        NODE_ENV: 'production',
        PORT: 3300,
        NEXT_PUBLIC_API_URL: 'http://localhost:4000/api',
        NEXT_PUBLIC_WS_URL: 'ws://localhost:4000',
        NEXT_PUBLIC_KEYCLOAK_URL: 'http://localhost:8080',
        NEXT_PUBLIC_KEYCLOAK_REALM: 'geomesh',
        NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: 'geomesh-frontend',
      },

      out_file: '../../logs/frontend-out.log',
      error_file: '../../logs/frontend-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
