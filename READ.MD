Berikut README lengkap dalam format Markdown yang merangkum poin 1–12 secara detail untuk proyek Platform Asset Tracking Multi-Tenant Industri berbasis Wirepas Mesh dan Teltonika.

Markdown

```
# Platform Asset Tracking Multi‑Tenant Industri (Wirepas + Teltonika)

## 1. Latar Belakang

Platform ini dirancang untuk kebutuhan **asset tracking industri** yang bersifat **real-time, multi-tenant, scalable, dan siap dikembangkan menjadi SaaS enterprise**.

Perangkat utama:

- **Teltonika Tiny Gateway** (Sink Wirepas)
- **BlueUp UltraZero** (Anchor / Router)
- **Teltonika EYE Sensor Mesh MTSMP1** (Tag / Sensor pada aset)

Target penggunaan:

- Warehouse / Gudang
- Pabrik
- Rumah sakit
- Pelabuhan
- Forklift & fleet tracking
- Cold-chain
- Multi-site / multi-cabang

---

## 2. Tujuan Sistem

Tujuan utama platform:

- Monitoring aset secara real-time
- Menentukan lokasi/zona aset
- Menyimpan histori telemetry
- Menampilkan alarm dan notifikasi
- Mengelola ribuan perangkat dalam satu platform
- Mendukung banyak tenant (perusahaan)

Fitur inti:

- Asset mapping
- Mesh topology
- Telemetry dashboard
- Battery monitoring
- Motion & tilt detection
- Alert management

---

## 3. Arsitektur Tingkat Tinggi

### Data Flow

EYE Sensor Mesh
↓
Wirepas Mesh
↓
UltraZero (Anchor/Router)
↓
Tiny Gateway (Sink)
↓
MQTT Broker (EMQX)
↓
Kafka (optional for scale)
↓
Backend Services (NestJS)
↓
PostgreSQL + TimescaleDB
↓
WebSocket
↓
Next.js Dashboard

### Penjelasan

- **EYE Sensor** mengirim telemetry.
- **UltraZero** membentuk mesh dan menjadi referensi RSSI.
- **Tiny Gateway** meneruskan data ke MQTT.
- **Backend** memproses, menyimpan, dan menghitung posisi.
- **Dashboard** menampilkan data secara real-time.

---

## 4. Peran Perangkat

### Tiny Gateway

- Sink Wirepas
- Koneksi Ethernet/Wi‑Fi
- Publish ke MQTT
- Mengelola komunikasi mesh

### UltraZero

- Anchor tetap
- Router mesh
- Referensi RSSI untuk positioning

### EYE Sensor Mesh

- Temperature
- Humidity
- Motion
- Accelerometer
- Pitch
- Roll
- Hall sensor
- Battery

---

## 5. Endpoint Wirepas

### Endpoint 11 (Telemetry Sensor)

Berisi:

- Temperature
- Humidity
- Accel X/Y/Z
- Pitch
- Roll
- Hall

Payload perlu didekode di backend atau Node‑RED.

### Endpoint 238 (Status Node)

Berisi:

- Battery voltage
- RSSI
- Motion
- Node info
- Update interval

Tiny Gateway biasanya sudah menyediakan `payload_json`.

---

## 6. Konsep Multi‑Tenant

Hierarki data:

Tenant
└── Site
└── Floor / Zone
└── Gateway
└── Anchor
└── Asset / Tag

### Contoh

PT ABC Logistics
├── Site Jakarta
│ ├── Warehouse A
│ │ ├── Zone Receiving
│ │ ├── Zone Storage
│ │ └── Zone Loading
└── Site Surabaya

### Isolasi Tenant

- Data tenant tidak boleh tercampur.
- User hanya melihat tenant miliknya.
- Query selalu difilter berdasarkan `tenant_id`.

---

## 7. Dashboard yang Direkomendasikan

### 7.1 Overview

- Total gateway
- Total node
- Asset online/offline
- Active alerts
- Battery warning

### 7.2 Floor Map

- Upload denah
- Drag & drop anchor
- Posisi aset real-time
- Heatmap zona

### 7.3 Mesh Topology

Gateway → Anchor → Tag

Menampilkan:

- RSSI
- Hop count
- Link quality

### 7.4 Asset Detail

- Temperature
- Humidity
- Battery
- Motion
- Pitch/Roll
- Last seen
- Zone history

### 7.5 Analytics

- Utilisasi aset
- Heatmap aktivitas
- Tren suhu/kelembapan
- Battery trend

---

## 8. Pentingnya Denah (Floor Plan)

Denah dibuat **sebelum pemasangan anchor**.

### Tujuan

- Menentukan posisi gateway
- Menentukan posisi UltraZero
- Menentukan zona
- Dasar perhitungan posisi

### Contoh

(0,0) A
(20,0) B
(0,15) C
(20,15) D

Koordinat disimpan di database.

---

## 9. Metode Penentuan Lokasi

### 9.1 Zone Based Positioning (Disarankan)

Pilih anchor dengan RSSI terbaik.

Contoh:

- A = -38 dBm
- B = -67 dBm
- C = -72 dBm

Hasil → **Zona A**

Akurasi: **2–10 m**

### 9.2 Weighted Centroid

Gunakan beberapa RSSI:

x = Σ(wi·xi) / Σwi
y = Σ(wi·yi) / Σwi

Akurasi: **2–5 m**

### 9.3 Fingerprinting

Bandingkan pola RSSI dengan database lokasi.

Akurasi: **1–3 m**

Cocok untuk indoor kompleks.

---

## 10. Pemanfaatan Accelerometer, Pitch, dan Roll

### Accelerometer

- Deteksi gerak
- Getaran
- Benturan
- Operasi mesin

### Pitch

- Kemiringan depan-belakang
- Forklift menanjak
- Aset miring

### Roll

- Kemiringan kiri-kanan
- Risiko terguling
- Pallet roboh

### Status Turunan

| Status | Kondisi |
|---|---|
| Static | Tidak bergerak |
| Moving | Bergerak |
| Tilt Warning | Pitch/Roll tinggi |
| Fall Detected | Benturan + perubahan sudut |
| High Vibration | Getaran berlebih |

---

## 11. Tech Stack yang Direkomendasikan

### Frontend

- Next.js 15
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Query
- ApexCharts
- React Konva
- React Flow

### Backend

- NestJS
- TypeScript
- Prisma
- OpenAPI/Swagger
- WebSocket

### Messaging

- **EMQX Cluster**

### Stream Processing (Opsional)

- Kafka
- Kafka Connect
- ksqlDB / Flink

### Database

- PostgreSQL
- TimescaleDB

### Cache

- Redis

### Authentication

- Keycloak

---

## 12. Strategi Database

### 12.1 Metadata (PostgreSQL)

Tabel utama:

- tenants
- users
- roles
- sites
- zones
- gateways
- anchors
- assets
- tags
- alert_rules

### 12.2 Telemetry (TimescaleDB)

| timestamp | asset_id | temp | hum | battery | rssi |
|---|---|---|---|---|---|

### 12.3 Redis

Menyimpan:

- Last known position
- Online status
- Active alerts
- WebSocket sessions

### Retention

- Raw telemetry: 30–90 hari
- Aggregated: 1–5 tahun

---

## Rekomendasi Implementasi untuk Proyek Ini

### MVP

- Tiny Gateway → EMQX
- Decode endpoint 11 & 238
- Simpan telemetry
- Dashboard dasar
- Zone positioning

### Production

- Multi-tenant
- RBAC
- Floor map
- Realtime WebSocket
- Alerts

### Enterprise

- Kafka
- HA deployment
- Weighted positioning
- Analytics
- Mobile app

---

## Stack Final yang Direkomendasikan

Frontend : Next.js + TypeScript
Backend : NestJS + Prisma
MQTT : EMQX
Database : PostgreSQL + TimescaleDB
Cache : Redis
Auth : Keycloak
Deploy : Docker → Kubernetes

---

## Kesimpulan

Arsitektur ini menghasilkan platform **asset tracking industri yang real-time, multi-tenant, aman, scalable, dan siap dikembangkan menjadi SaaS komersial**.

Pendekatan yang disarankan untuk tahap awal:

1. Buat denah dan zona.
2. Pasang beberapa UltraZero.
3. Gunakan Zone Based Positioning.
4. Simpan telemetry di TimescaleDB.
5. Tampilkan posisi dan status aset secara real-time di dashboard Next.js.
```
