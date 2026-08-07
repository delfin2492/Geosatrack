# 📖 DOKUMENTASI DEVELOPER GEOMESH
Panduan Menjalankan, Struktur File, Dampak Perubahan (Impact Analysis), dan Git Workflow.

---

## 🧭 1. CARA MENJALANKAN APLIKASI VIA DOCKER (PRODUKSI & DEPLOYMENT)
Seluruh stack aplikasi (Database, Cache, Broker MQTT, Keycloak, Backend, dan Frontend) dapat dijalankan sepenuhnya di dalam Docker.

### A. Menjalankan Semua Service (Backend, Frontend, & Infra)
Pastikan Docker Desktop aktif, lalu jalankan perintah berikut di root folder `e:\GeoMesh` untuk membangun image dan memulai semua container dalam mode produksi:
```powershell
docker compose up --build -d
```
*Gunakan `docker compose down` untuk mematikan dan menghapus semua kontainer.*

### B. Memantau Log Server
Untuk memantau log aktivitas backend atau frontend yang sedang berjalan:
```powershell
docker compose logs -f backend
docker compose logs -f frontend
```

---

## 🌐 2. AKSES JARINGAN LOKAL (LAN) & PUBLIC DOMAIN (CLOUDFLARE TUNNEL)

Aplikasi GeoMesh kini menggunakan **Nginx Reverse Proxy** untuk menggabungkan Frontend, Backend API, dan Websocket ke dalam **satu port tunggal** (`3300`). 

### A. Akses Melalui IP Lokal (Satu Jaringan Wi-Fi/LAN)
Dapatkan IP Address lokal mesin host Anda (misalnya `192.168.40.71`). Anda dapat langsung mengaksesnya dari HP, tablet, atau laptop lain di jaringan yang sama melalui:
*   **Web Portal (Frontend & API)**: `http://192.168.40.71:3300`
*   **Keycloak Admin**: `http://192.168.40.71:8080` (jika menggunakan fitur login Keycloak)

### B. Akses Melalui Public Domain (Cloudflare Tunnel)
Karena Nginx menangani semua routing secara internal, Anda **hanya perlu memetakan 2 domain** di dashboard Cloudflare Tunnel:
1.  **Aplikasi Utama**: `geomesh.vantara.my.id` ➔ `http://localhost:3300`
2.  **Keycloak Auth**: `geomesh-auth.vantara.my.id` ➔ `http://localhost:8080` (jika menggunakan login Keycloak)

*Kelebihan Nginx: Anda tidak memerlukan subdomain tambahan seperti `api.geomesh` atau `geomesh-api`. Ini sepenuhnya menghilangkan error SSL mismatch dan CORS.*

---

## 📂 3. STRUKTUR FILE UTAMA & RELASI (IMPACT ANALYSIS)

Pahami hubungan antar-bagian berikut sebelum melakukan modifikasi file agar tidak merusak fungsi aplikasi lainnya:

```
geomesh/
├── apps/
│   ├── backend/                  # NestJS Application
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Skema Database PostgreSQL / TimescaleDB
│   │   └── src/
│   │       ├── modules/          # Logika Bisnis (Asset, Zone, Tenant)
│   │       ├── mqtt/             # Listener data real-time dari Hardware/MQTT
│   │       └── websocket/        # Gateway Socket.io untuk push data ke Frontend
│   └── frontend/                 # Next.js Application
│       └── src/
│           ├── context/          # Context React (Auth, Socket.io Connection)
│           └── app/(dashboard)/  # Halaman Dashboard Route (Assets, Planner, Map)
```

### A. Database Schema (`schema.prisma`)
*   **Path**: `apps/backend/prisma/schema.prisma`
*   **Fungsi**: Tempat mendefinisikan model tabel database (seperti `Tenant`, `Asset`, `Zone`, `Anchor`, `Geofence`).
*   **Impact Analysis**:
    *   Jika Anda merubah atau menambah kolom pada model di file ini, Anda **wajib** menjalankan migrasi database dengan perintah:
        ```powershell
        # Dijalankan di dalam folder apps/backend/
        npx prisma migrate dev
        npx prisma generate
        ```
    *   **Dampak ke Backend**: TypeScript types untuk database client akan di-regenerate. Semua service NestJS (seperti `asset.service.ts` atau `zone.service.ts`) yang memanggil database model tersebut harus disesuaikan jika nama kolom berubah atau dihapus agar tidak terjadi error kompilasi NestJS.
    *   **Dampak ke Frontend**: Data yang dikirim dari controller backend ke frontend akan berubah formatnya. Anda harus menyesuaikan tipe data / interface TypeScript di frontend (seperti `ZoneData` atau `AnchorData` pada `assets/page.tsx` dan `planner/page.tsx`) agar tidak terjadi *runtime error* di browser.

### B. Backend Modules Layer (NestJS Services & Controllers)
*   **Path**: `apps/backend/src/modules/`
*   **Fungsi**: Mengatur API endpoint dan logika database.
*   **Impact Analysis**:
    *   Jika Anda mengubah format response API (misalnya mengubah struktur JSON yang dikembalikan oleh endpoint `GET /api/assets/quota` pada `asset.controller.ts`).
    *   **Dampak ke Frontend**: Fungsi pemanggilan API di frontend (seperti `fetchQuota()` di `assets/page.tsx`) akan gagal membaca properti data yang baru karena struktur JSON-nya sudah berubah, sehingga tampilan visual (seperti status quota limit dan tombol `Add` yang di-disable) tidak akan berfungsi.

### C. Real-Time Data Pipeline Layer (MQTT & WebSockets)
*   **Path**: `apps/backend/src/mqtt/` & `apps/backend/src/modules/websocket/`
*   **Fungsi**: `MqttService` menangkap payload data sensor biner/JSON dari gateway hardware, melakukan parsing koordinat, menyimpannya ke database, dan men-trigger `WebsocketGateway` untuk mengirimkan *event* `assetUpdate` ke client browser secara instan.
*   **Impact Analysis**:
    *   Jika Anda mengubah nama event socket atau struktur payload WebSocket di backend.
    *   **Dampak ke Frontend**: File `SocketContext.tsx` di frontend tidak akan bisa menangkap koordinat update live. Akibatnya, pergerakan marker Mesh di halaman `planner/page.tsx` atau Halaman Map Utama akan diam (tidak ter-update secara real-time).

---

## 📡 4. ALUR KERJA PUSH KE GITHUB

Ikuti langkah-langkah di bawah ini untuk mempublikasikan (push) setiap perubahan yang Anda lakukan ke repository GitHub:

### Langkah 1: Periksa Perubahan File
Jalankan perintah ini di terminal root folder project untuk melihat file apa saja yang telah dimodifikasi atau ditambahkan:
```powershell
git status
```

### Langkah 2: Tambahkan File ke Staging Area
*   **Opsi A**: Jika ingin memasukkan **seluruh file yang berubah**:
    ```powershell
    git add .
    ```
*   **Opsi B**: Jika hanya ingin memasukkan **file spesifik** (contoh):
    ```powershell
    git add apps/frontend/src/app/\(dashboard\)/planner/page.tsx
    ```

### Langkah 3: Lakukan Commit (Simpan Lokal dengan Catatan)
Tulis pesan commit singkat dan deskriptif mengenai perubahan yang Anda lakukan:
```powershell
git commit -m "feat: add rssi anchor heatmap feature to planner page"
```

### Langkah 4: Push ke GitHub
Kirim perubahan lokal Anda ke repository remote di GitHub.
*   Jika Anda bekerja di branch utama (`main`):
    ```powershell
    git push origin main
    ```
*   Jika Anda bekerja di branch lain (misalnya `development`):
    ```powershell
    git push origin development
    ```

---
*Dokumen ini dibuat secara otomatis untuk mempermudah onboarding developer baru.*
