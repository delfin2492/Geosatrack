# 📋 Progress & Task Tracker: GeoSaTrack

Dokumen ini melacak status pengerjaan proyek Platform Asset Tracking Multi-Tenant (Wirepas Mesh + Teltonika). File ini dirancang agar agen AI Antigravity di perangkat mana pun dapat langsung membaca status pengerjaan saat ini dan melanjutkan tanpa perlu mempelajari ulang seluruh konsep dari nol.

---

## 🎯 Fokus Saat Ini
*   **Fase Sedang Berjalan**: Fase 3 - Pembuatan API RESTful & Integrasi WebSocket Real-Time.
*   **Target Terdekat**: Membuat modul REST API untuk mengekspos data Aset, Cabang (Sites), dan Peta Zona (Zones) untuk frontend Next.js.

---

## 🗺️ Peta Jalan & Check-list Tugas

### [x] Fase 1: Fondasi & Setup Lingkungan Lokal (Minggu 1 - 3)
*   [x] Inisialisasi Monorepo (Setup pnpm/npm workspaces).
*   [x] Konfigurasi berkas sistem (`.gitignore`, `.env.example`, `package.json` di root).
*   [x] Membuat berkas orkestrasi `docker-compose.yml` untuk EMQX, PostgreSQL/TimescaleDB, Redis, dan Keycloak.
*   [x] Konfigurasi skema database multi-tenant awal di `schema.prisma`.
*   [x] Menyiapkan migrasi database awal (`prisma migrate dev`) dan melakukan seeding data uji coba (`seed.ts`).
*   [x] Mengonversi tabel data sensor menjadi TimescaleDB Hypertable (`timescaledb.sql`).
*   [x] Sinkronisasi repositori awal ke GitHub.

### [x] Fase 2: Ingesti & Decoder Telemetri (Minggu 4 - 6)
*   [x] Menginstal dependensi `mqtt` dan `@nestjs/config` di backend.
*   [x] Membuat `PrismaService` dan `PrismaModule` global untuk koneksi database.
*   [x] Membuat `DecoderService` untuk parsing payload Endpoint 11 (Telemetry) dan Endpoint 238 (Health Status).
*   [x] Menulis logika state machine untuk menentukan kondisi fisik aset (Static, Moving, Tilt Warning, Fall Detected, High Vibration).
*   [x] Membuat `MqttService` untuk subskripsi otomatis topik EMQX dan ingesti telemetri real-time.
*   [x] Menerapkan filter validasi `gatewayId` (Isolasi Multi-Tenant) pada layer ingesti MQTT.
*   [x] Menambahkan logika pemicu peringatan otomatis (`Alert`) untuk baterai lemah, sensor jatuh, atau kemiringan tidak aman.
*   [x] Uji coba kompilasi kode dan sinkronisasi pembaruan ke GitHub.

### [/] Fase 3: Backend API & Autentikasi (Minggu 7 - 9)
*   [/] Pembuatan modul REST API untuk mengelola data:
    *   [ ] Modul Aset (`AssetController` - CRUD & filter tenant)
    *   [ ] Modul Peta Zona (`ZoneController` - manajemen koordinat dan gambar denah)
    *   [ ] Modul Cabang (`SiteController` & `TenantController`)
*   [ ] Integrasi Swagger/OpenAPI untuk dokumentasi interaktif API backend.
*   [ ] Pembuatan WebSocket Gateway di NestJS untuk menyiarkan status aset dan notifikasi alert secara real-time ke frontend.
*   [ ] Integrasi Keycloak Guard untuk otentikasi REST API dan WebSocket (Validasi JWT & hak akses tenant).

### [ ] Fase 4: Frontend Next.js 15 & Dashboard (Minggu 10 - 13)
*   [ ] Setup UI template dasar menggunakan Tailwind CSS & Shadcn/ui.
*   [ ] Integrasi otentikasi Keycloak client di Next.js.
*   [ ] Peta Denah Lantai 2D (Floor Map Visualizer) menggunakan Canvas/React Konva.
*   [ ] Peta Topologi Jaringan Mesh menggunakan React Flow.
*   [ ] Visualisasi analitik menggunakan grafik histori (suhu, kelembapan, status baterai).

### [ ] Fase 5: QA, Simulasi Skala & Tuning (Minggu 14 - 16)
*   [ ] Membuat simulator IoT pengirim telemetri skala besar untuk menguji beban EMQX & database.
*   [ ] Mengatur kebijakan kompresi dan retensi TimescaleDB.
*   [ ] Pengerasan keamanan TLS (MQTTS) pada koneksi broker EMQX.

### [ ] Fase 6: Deployment Produksi & CI/CD (Minggu 17 - 20)
*   [ ] Pembuatan Manifest Kubernetes & Helm Charts.
*   [ ] Pembuatan Pipeline CI/CD otomatis untuk deploy ke kluster cloud.
*   [ ] Setup dashboard monitoring dengan Prometheus dan Grafana.
