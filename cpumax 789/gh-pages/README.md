# 📷 SAB — เวอร์ชัน GitHub Pages (กล้องสดทำงาน 100%)

หน้าเว็บนี้รันบน GitHub Pages (origin ของเราเอง = top-level) → `getUserMedia` (กล้องสด) ทำงานเต็มที่ ไม่ถูก Google iframe บล็อก โดยใช้ **GAS เป็น JSON API backend** (Sheets เป็นฐานข้อมูลเหมือนเดิม)

```
GitHub Pages (หน้าเว็บ + กล้องสด)  ──fetch text/plain──▶  GAS /exec (doPost → api)  ◀──▶  Google Sheets
```

---

## ขั้นที่ 1 — Deploy GAS เป็น Web App (ให้ได้ /exec URL)

1. เปิด Apps Script editor ของโปรเจกต์ → ตรวจ `appsscript.json` ว่ามี
   `"timeZone": "Asia/Bangkok"` + `oauthScopes` (6 ตัว) + `webapp: ANYONE_ANONYMOUS`
2. เมนู **Deploy → New deployment → ⚙️ → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (สำคัญ — ให้ GitHub Pages เรียกได้)
3. **Deploy** → คัดลอก **Web app URL** (ลงท้าย `/exec`)
4. ครั้งแรกอย่าลืม **เริ่มใช้งานระบบ** (เมนู 🎯 SAB) + **ขออนุญาตสิทธิ์**

> แก้โค้ดทุกครั้งต้อง **Deploy → Manage deployments → ✏️ → New version** (ไม่งั้น /exec ยังเป็นโค้ดเก่า)

## ขั้นที่ 2 — ใส่ URL ลงหน้าเว็บ

รัน (จากโฟลเดอร์โปรเจกต์):
```bash
node build-ghpages.js "https://script.google.com/macros/s/XXXX/exec"
```
→ ได้ `gh-pages/index.html` ที่ฝัง URL แล้ว
(หรือเปิด `gh-pages/index.html` แก้บรรทัด `window.SAB_API_URL = "..."` เอง)

## ขั้นที่ 3 — อัปขึ้น GitHub Pages

```bash
cd gh-pages
git init && git add . && git commit -m "SAB scanner"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```
แล้วใน GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**
รอ ~1 นาที → เปิด `https://<user>.github.io/<repo>/`

> หรือลากไฟล์ `index.html` ขึ้น repo ผ่านหน้าเว็บ GitHub โดยตรงก็ได้

## ขั้นที่ 4 — ใช้งาน

- เปิดลิงก์ GitHub Pages บนมือถือ → ล็อกอิน → เลือกห้อง → **สแกนกล้องสด** เปิดกล้องได้เลย ✓
- ครั้งแรกเบราว์เซอร์จะถาม "อนุญาตกล้อง" → กดอนุญาต

---

## หมายเหตุเทคนิค

| เรื่อง | รายละเอียด |
|---|---|
| **CORS** | ส่ง fetch แบบ `Content-Type: text/plain` = simple request → ไม่มี preflight → คุย GAS ข้าม origin ได้ |
| **Auth** | token เก็บใน localStorage ส่งไปใน body ทุก request (server ตรวจเหมือนเดิม) |
| **ความปลอดภัย** | เหมือนเวอร์ชัน GAS ทุกอย่าง (PBKDF2 + RBAC + lockout) — front-end เป็นแค่ UI |
| **โค้ดชุดเดียว** | `index.html` สร้างจากไฟล์เดียวกับเวอร์ชัน GAS (`build-ghpages.js`) แก้ที่เดียว build ใหม่ |
| **กล้องไม่ติด** | ตรวจว่าเปิดผ่าน **https://** (GitHub Pages เป็น https) + อนุญาตกล้องในเบราว์เซอร์ |

ผู้พัฒนา: ครูวิรัตน์ หาดคำ · www.kruwirat.com
