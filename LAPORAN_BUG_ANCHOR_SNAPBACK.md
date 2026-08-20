# Laporan Bug: Posisi Anchor Kembali ke Posisi Lama Setelah Digeser (Snap-Back)

**Komponen:** RTLS Planner — `apps/frontend/src/app/(dashboard)/planner/page.tsx`
**Status:** Sudah diperbaiki & diverifikasi
**Tanggal:** 2026-08-20

---

## Gejala

Saat anchor digeser (drag) ke posisi baru pada denah lantai, posisi barunya tampak berhasil tersimpan — marker tetap berada di posisi baru setelah dilepas. Namun, posisi tersebut akan kembali secara diam-diam ke posisi lama begitu peta digambar ulang karena aksi lain yang tidak terkait (mengedit zona, menambah geofence, berpindah tab lalu kembali).

## Akar Masalah

Handler drag sudah benar mengirim `PATCH` koordinat baru ke backend, namun setelah itu memanggil fungsi refresh yang salah:

```js
await fetch(`.../floorplan/anchors/${anchor.id}/position`, { method: 'PATCH', ... });
fetchAllAnchors();   // ← fungsi yang salah
```

`fetchAllAnchors()` mengisi state `allTenantAnchors`, yang dipakai di bagian lain UI (daftar anchor seluruh tenant) — **bukan** yang dipakai untuk menggambar peta. Marker anchor pada peta digambar dari `selectedZone.anchors`, yang hanya diperbarui oleh fungsi lain, yaitu `fetchZoneDetails(selectedZoneId)`. Karena fungsi ini tidak pernah dipanggil, state `selectedZone` tetap menyimpan koordinat anchor yang lama (sebelum digeser).

Ini terlihat baik-baik saja tepat setelah anchor dilepas, karena elemen marker Leaflet memang tetap berada di posisi terakhir yang di-drag (independen dari state React) — sampai render berikutnya membersihkan dan menggambar ulang seluruh marker anchor dari data `selectedZone` yang sudah usang tersebut, sehingga posisi anchor "melompat kembali" ke posisi lama.

## Perbaikan

Menambahkan pemanggilan fungsi yang benar, berdampingan dengan pemanggilan yang sudah ada (bukan menggantikannya, karena `fetchAllAnchors()` tetap dibutuhkan untuk komponen UI lain):

```js
if (selectedZoneId) fetchZoneDetails(selectedZoneId);
fetchAllAnchors();
```

## Verifikasi

Perbaikan telah diterapkan dan di-deploy ke frontend live. Setelahnya, ketiga anchor pada zona "Lt. M" digeser ke posisi yang benar dan dikonfirmasi tetap tersimpan melalui berbagai aksi Planner berikutnya, reload halaman, dan restart container — tidak ada lagi gejala snap-back yang teramati.
