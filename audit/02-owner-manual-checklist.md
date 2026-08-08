# Meta Dashboard Manual Checklist
# Phase 2 — Instagram API Setup Audit
# Date: 2026-08-06

## Instruksi
Buka setiap URL di bawah dan screenshot bagian yang diminta (TANPA menampilkan App Secret/token).
Kirim screenshot ke Hermes untuk dilanjutkan ke Phase 5 (Root Cause Analysis).

---

## A. App Overview
URL: https://developers.facebook.com/apps/1076777758636119/dashboard/

Screenshot yang dibutuhkan:
- [ ] App ID yang terlihat
- [ ] App mode (Development / Live)
- [ ] Status verifikasi business (jika ada)
- [ ] Warning/error yang muncul di dashboard

---

## B. Use Cases / Products Aktif
URL: https://developers.facebook.com/apps/1076777758636119/use-cases/

Screenshot yang dibutuhkan:
- [ ] Daftar use cases yang sudah ditambahkan
- [ ] Apakah ada "Instagram API with Instagram Login" (Route A)?
- [ ] Apakah ada "Instagram API" (tanpa Instagram Login)?
- [ ] Apakah ada "Facebook Login for Business"?
- [ ] Apakah ada "Threads API"?
- [ ] Status masing-masing (active/inactive/setup required)

---

## C. Instagram API Settings (jika ada)
URL: https://developers.facebook.com/apps/1076777758636119/instagram/

Screenshot yang dibutuhkan:
- [ ] Halaman yang muncul (bisa jadi redirect ke use cases)
- [ ] Permission yang tersedia: instagram_business_basic, instagram_business_content_publish
- [ ] Status permission (granted / not requested / under review)
- [ ] Valid OAuth Redirect URIs yang terdaftar

---

## D. App Roles
URL: https://developers.facebook.com/apps/1076777758636119/roles/roles/

Screenshot yang dibutuhkan:
- [ ] Apakah akun kamu sudah sebagai Administrator/Developer?
- [ ] Apakah ada akun tester?

---

## E. Error "Business Account Not Allowed to Advertise"
Ini muncul di mana? 
- [ ] Di Meta Developer Dashboard?
- [ ] Di Instagram Settings saat coba connect Facebook Page?
- [ ] Di OAuth redirect?
- [ ] Di tempat lain?

Catat URL persis di mana error muncul.

---

## Catatan Penting
- Error "Not Allowed to Advertise" biasanya TIDAK memblokir organic posting
- Instagram API with Instagram Login (Route A) TIDAK memerlukan Facebook Page
- Route A hanya butuh: instagram_business_basic + instagram_business_content_publish
- Route A tersedia jika use case "Instagram API with Instagram Login" aktif di app
