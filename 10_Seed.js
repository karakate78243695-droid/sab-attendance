/**
 * ═══════════════════════════════════════════════════════════════
 *  SAB · ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด
 *  File:        10_Seed.gs — Init system · demo users · sample students & attendance
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

var DEMO_PASSWORD = '123456';
var DEMO_USERS = Object.freeze([
  { username: 'admin',   role: 'admin',   full_name: 'นายผู้ดูแล ระบบ',     rooms: '' },
  { username: 'teacher', role: 'teacher', full_name: 'นางสาวครูประจำชั้น ใจดี', rooms: '1/1,2/1,3/1' }
]);

var TH_FIRST = ['ธนกร','ปุณยวีร์','ศุภกร','กิตติพงศ์','ภูริ','ธีรภัทร','นภัส','ปวีณ์','อนุชา','ชญานนท์','พีรพัฒน์','ณัฐวุฒิ','วรเมธ','สิรภพ','กันตพงศ์','พิมพ์มาดา','ณิชา','ปุณิกา','ธัญชนก','กัญญาณัฐ','พิชญา','ศิรประภา','อรปรียา','ชนิกานต์','เบญญาภา','ภัทรวดี','สุพิชญา','วริศรา','กชกร','ปาณิสรา'];
var TH_LAST = ['ศรีสุข','ใจงาม','ทองดี','พงษ์พันธ์','รักเรียน','สุขสันต์','มั่นคง','บุญมา','วงศ์ไทย','แสงทอง','คำมูล','จันทร์เพ็ญ','พรหมมา','ดวงดี','เพชรน้ำหนึ่ง','ภักดี','สมบูรณ์','ก้องเกียรติ','อินทร์แก้ว','นาคสุข'];

function menu_initSystem() {
  DB_initAllSchemas();
  Settings_ensureDefaults_();
  Seed_ensureUsers_();
  var ui = _ui_();
  if (ui) ui.alert('✅ เริ่มใช้งานระบบแล้ว', 'สร้างชีต + ค่าตั้งต้น + บัญชีผู้ใช้เรียบร้อย\nบัญชีทดลอง: admin / teacher (รหัส ' + DEMO_PASSWORD + ')', ui.ButtonSet.OK);
  return 'init ok';
}

function Seed_ensureUsers_() {
  var created = 0;
  DEMO_USERS.forEach(function (u) {
    if (DB_findOne(SHEETS.USERS, function (x) { return String(x.username).toLowerCase() === u.username; })) return;
    var salt = cfg_salt_();
    DB_insert(SHEETS.USERS, {
      username: u.username, password_hash: cfg_hash_(DEMO_PASSWORD, salt), salt: salt,
      full_name: u.full_name, role: u.role, email: u.username + '@example.com', phone: '0812345678',
      rooms: u.rooms, is_active: 'yes'
    });
    created++;
  });
  return created;
}

function Seed_resetDemoPasswords_() {
  var n = 0;
  DEMO_USERS.forEach(function (du) {
    var u = DB_findOne(SHEETS.USERS, function (x) { return String(x.username).toLowerCase() === du.username; });
    if (!u) return;
    var s = cfg_salt_();
    DB_update(SHEETS.USERS, u.id, { salt: s, password_hash: cfg_hash_(DEMO_PASSWORD, s), is_active: 'yes' });
    n++;
  });
  return n;
}

function menu_seedDemo() {
  var ui = _ui_();
  DB_initAllSchemas();
  Settings_ensureDefaults_();
  Seed_ensureUsers_();

  // ── อ่านนักเรียนเดิมก่อนเข้า batch (กัน read-after-write stale) ──
  var existing = {};
  DB_readAll(SHEETS.STUDENTS).forEach(function (s) { existing[String(s.student_id)] = s; });

  // ── สร้าง roster ใน memory: เดิม + ใหม่ (ไม่ re-read ระหว่าง batch) ──
  var roster = [];   // {student_id, room}
  Object.keys(existing).forEach(function (k) { roster.push({ student_id: k, room: String(existing[k].room) }); });

  var toInsert = [], seq = 1;
  ROOMS.forEach(function (room) {
    var n = 18 + (seq % 6);
    var g = room.split('/')[0], rno = room.split('/')[1];
    for (var i = 1; i <= n; i++) {
      // รหัส = ระดับชั้น + ห้อง + เลขที่ (เช่น ม.2/4 เลขที่ 1 → "24001")
      var sid = g + rno + _pad3_(i);
      if (existing[sid]) { seq++; continue; }
      var fn = TH_FIRST[(seq * 7) % TH_FIRST.length];
      var ln = TH_LAST[(seq * 3) % TH_LAST.length];
      toInsert.push({ student_id: sid, name: fn + ' ' + ln, number: i, room: room, barcode: sid, is_active: 'yes' });
      roster.push({ student_id: sid, room: room });
      seq++;
    }
  });

  // ── attendance ที่ยังไม่มี (กันซ้ำ) — 6 ห้องแรก, 6 วันย้อนหลัง ──
  var attKeys = {};
  DB_readAll(SHEETS.ATTENDANCE).forEach(function (a) { attKeys[String(a.student_id) + '|' + cfg_d10_(a.date)] = 1; });
  var sampleRooms = ROOMS.slice(0, 6);
  var byRoom = {}; sampleRooms.forEach(function (r) { byRoom[r] = []; });
  roster.forEach(function (s) { if (byRoom[s.room]) byRoom[s.room].push(s); });

  var att = [];
  for (var d = 6; d >= 1; d--) {
    var date = Utilities.formatDate(new Date(new Date().getTime() - d * 86400000), APP.TIMEZONE, 'yyyy-MM-dd');
    sampleRooms.forEach(function (room) {
      byRoom[room].forEach(function (s, idx) {
        if (attKeys[String(s.student_id) + '|' + date]) return;
        var roll = (idx * 13 + d * 7) % 100;
        var status = roll < 78 ? 'present' : roll < 88 ? 'late' : roll < 95 ? 'absent' : 'leave';
        var hh = status === 'present' ? '07:' + _pad2_(10 + (idx % 40)) : status === 'late' ? '08:3' + (idx % 9) : '08:45';
        att.push({ student_id: s.student_id, room: room, date: date, time: hh, status: status, method: idx % 3 === 0 ? 'manual' : 'scan', note: status === 'leave' ? 'ลาป่วย' : '', checked_by: 'seed' });
      });
    });
  }

  DB_beginBatch();
  try {
    if (toInsert.length) DB_bulkInsert(SHEETS.STUDENTS, toInsert);
    if (att.length) DB_bulkInsert(SHEETS.ATTENDANCE, att);
  } finally { DB_endBatch(); }

  var totalStu = DB_count(SHEETS.STUDENTS);
  if (ui) ui.alert('🌱 เพิ่มข้อมูลตัวอย่างแล้ว',
    'นักเรียนใหม่ ' + toInsert.length + ' คน (รวมในระบบ ' + totalStu + ' คน)\nบันทึกเช็คชื่อตัวอย่างใหม่ ' + att.length + ' รายการ\n\nกรุณารีเฟรชหน้าเว็บแอป', ui.ButtonSet.OK);
  return 'seed ok';
}

function _pad3_(n) { n = String(n); while (n.length < 3) n = '0' + n; return n; }

function menu_clearDemo() {
  var ui = _ui_();
  if (ui) { var r = ui.alert('ล้างข้อมูลตัวอย่าง', 'ลบนักเรียน + การเช็คชื่อทั้งหมด? (ผู้ใช้/ตั้งค่าไม่ถูกลบ)', ui.ButtonSet.YES_NO); if (r !== ui.Button.YES) return; }
  [SHEETS.STUDENTS, SHEETS.ATTENDANCE].forEach(function (n) {
    var sh = _ss_().getSheetByName(n);
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    _bumpVer_('sheet:' + n);
  });
  if (ui) ui.alert('🧹 ล้างข้อมูลตัวอย่างแล้ว');
}

function menu_resetDemoPasswords() {
  var ui = _ui_();
  if (ui) { var r = ui.alert('รีเซ็ตรหัสผ่าน Demo', 'รีเซ็ต admin/teacher เป็น ' + DEMO_PASSWORD + '?', ui.ButtonSet.YES_NO); if (r !== ui.Button.YES) return; }
  var n = Seed_resetDemoPasswords_();
  if (ui) ui.alert(n + ' บัญชีถูกรีเซ็ตแล้ว (รหัส ' + DEMO_PASSWORD + ')');
}

function _ui_() { try { return SpreadsheetApp.getUi(); } catch (e) { return null; } }
