# 📋 Progress & Task Tracker: Geomesh

Dokumen ini melacak status pengerjaan proyek Platform Asset Tracking Multi-Tenant (Wirepas Mesh + Teltonika). File ini dirancang agar agen AI Antigravity di perangkat mana pun dapat langsung membaca status pengerjaan saat ini dan melanjutkan tanpa perlu mempelajari ulang seluruh konsep dari nol.

---

## 🎯 Fokus Saat Ini
*   **Fase Sedang Berjalan**: Fase 4 - Frontend Next.js 15 & Dashboard (Minggu 10 - 13).
*   **Target Terdekat**: Peta Topologi Jaringan Mesh menggunakan React Flow.

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

### [x] Fase 3: Backend API & Autentikasi (Minggu 7 - 9)
*   [x] Pembuatan modul REST API untuk mengelola data:
    *   [x] Modul Aset (`AssetController` - CRUD & filter tenant)
    *   [x] Modul Peta Zona (`ZoneController` - manajemen koordinat dan gambar denah)
    *   [x] Modul Cabang (`SiteController` & `TenantController`)
*   [x] Integrasi Swagger/OpenAPI untuk dokumentasi interaktif API backend.
*   [x] Pembuatan WebSocket Gateway di NestJS untuk menyiarkan status aset dan notifikasi alert secara real-time ke frontend.
*   [x] Integrasi Keycloak Guard untuk otentikasi REST API dan WebSocket (Validasi JWT & hak akses tenant).

### [/] Fase 4: Frontend Next.js 15 & Dashboard (Minggu 10 - 13)
*   [x] Setup UI template dasar menggunakan Tailwind CSS & Shadcn/ui.
*   [x] Integrasi otentikasi Keycloak client di Next.js.
*   [x] Peta Denah Lantai 2D (Floor Map Visualizer) menggunakan Canvas/React Konva.
*   [/] Peta Topologi Jaringan Mesh menggunakan React Flow.
*   [ ] Visualisasi analitik menggunakan grafik histori (suhu, kelembapan, status baterai).

### [ ] Fase 5: QA, Simulasi Skala & Tuning (Minggu 14 - 16)
*   [ ] Membuat simulator IoT pengirim telemetri skala besar untuk menguji beban EMQX & database.
*   [ ] Mengatur kebijakan kompresi dan retensi TimescaleDB.
*   [ ] Pengerasan keamanan TLS (MQTTS) pada koneksi broker EMQX.

### [ ] Fase 6: Deployment Produksi & CI/CD (Minggu 17 - 20)
*   [ ] Pembuatan Manifest Kubernetes & Helm Charts.
*   [ ] Pembuatan Pipeline CI/CD otomatis untuk deploy ke kluster cloud.
*   [ ] Setup dashboard monitoring dengan Prometheus dan Grafana.

---

## 🛠️ Prosedur Pembaruan Progress (Wajib Diikuti Agen AI/Pengembang)
Setiap kali Anda selesai mengerjakan sebuah langkah, menambahkan fitur, atau mengubah konfigurasi:
1.  **Perbarui Check-list**: Ubah `[ ]` menjadi `[/]` (in-progress) atau `[x]` (completed) pada daftar di atas.
2.  **Perbarui Fokus Saat Ini**: Sesuaikan bagian `## 🎯 Fokus Saat Ini` untuk mencerminkan tugas aktif berikutnya.
3.  **Tulis Riwayat Pembaruan**: Catat entri baru pada bagian `## 📜 Riwayat Pembaruan (Changelog)` di bawah dengan format:
    `[TANGGAL] - [AKTOR] - [DESKRIPSI PERUBAHAN & FILE YANG DIUBAH]`
4.  **Commit & Push**: Commit file `task.md` bersamaan dengan source code fitur yang didevelop.

---

## 📜 Riwayat Pembaruan (Changelog)

*   **2026-08-03** - **Antigravity (AI)** - Memperluas model Tenant dengan properti status, agentLimit, dan assetLimit di database schema & seed. Mengimplementasikan antarmuka CRUD (Create, Edit, Delete) berestetika monokrom Shadcn pada halaman Tenant Manager. Merefaktor halaman manajemen aset untuk memisahkan tab Assets Tree (twin fisik) dan tab Protocol Agents (MQTT, HTTP, BLE) mirip konsep OpenRemote.
*   **2026-08-03** - **Antigravity (AI)** - Mengimplementasikan modul autentikasi email & password terverifikasi, akun Superadmin dengan kontrol penuh ke seluruh sistem dan halaman `Tenants Manager` (`/tenants`), halaman login minimalis bertema GeoMesh, penanganan proteksi rute (`route protection`) & pengalihan logout, serta peta interaktif OpenStreetMap Indonesia dengan fitur scroll zoom dan navigasi zoom otomatis dari titik koordinat ke denah floor plan indoor.
*   **2026-07-31** - **Antigravity (AI)** - Membuat dan mengintegrasikan komponen FloorMap berbasis HTML5 canvas yang mendukung zoom, pan, gridlines, detail data tag via hover, dan drag-and-drop koordinat Anchor node ke page.tsx.
*   **2026-07-31** - **Antigravity (AI)** - Menyiapkan template UI Next.js 15 menggunakan Tailwind CSS v4, mengimplementasikan AuthProvider berbasis keycloak-js untuk otentikasi client-side, dan mendesain dashboard monitoring interaktif real-time dengan simulator.
*   **2026-07-31** - **Antigravity (AI)** - Mengintegrasikan KeycloakConnectModule di backend NestJS untuk validasi JWT token secara offline, serta memperbarui GetTenantId decorator untuk mendeteksi ID penyewa dari payload token Keycloak secara dinamis.
*   **2026-07-31** - **Antigravity (AI)** - Membuat global WebsocketModule dan WebsocketGateway di backend NestJS untuk menyiarkan real-time sensor updates, alert events, dan tag status perubahan secara real-time ke client room.
*   **2026-07-31** - **Antigravity (AI)** - Menginisialisasi modul REST API untuk Tenant, Site, Zone, dan Asset dengan isolasi multi-tenant (menggunakan header x-tenant-id via GetTenantId decorator), mengonfigurasi Swagger OpenAPI docs, dan memverifikasi kelayakan build backend.
*   **2026-07-28** - **Antigravity (AI)** - Menginisialisasi repositori Git dan melakukan commit pertama berkas `README.md`.
*   **2026-07-28** - **Antigravity (AI)** - Membuat boilerplate monorepo: menginisialisasi aplikasi NestJS backend di `apps/backend` dan Next.js 15 frontend di `apps/frontend`.
*   **2026-07-28** - **Antigravity (AI)** - Membuat skema database multi-tenant Prisma, menjalankan migrasi awal database local PostgreSQL/TimescaleDB, melakukan database seeding dengan data tiruan lengkap, serta mengonversi tabel `Telemetry` menjadi TimescaleDB Hypertable.
*   **2026-07-28** - **Antigravity (AI)** - Menginstal dependensi `mqtt` dan `@nestjs/config`, membuat layanan global `PrismaService`, membuat dekoder data sensor Endpoint 11/238, serta membuat `MqttService` untuk ingesti data dari EMQX broker.
*   **2026-07-28** - **Antigravity (AI)** - Membuat berkas panduan progress `task.md` di level root dan menetapkan aturan pencatatan riwayat pembaruan sistem.

