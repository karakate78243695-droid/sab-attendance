/**
 * ═══════════════════════════════════════════════════════════════
 *  SAB · ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด
 *  File:        04_Students.gs — Student CRUD · Excel/CSV import · barcode lookup
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function Student_public_(s) {
  return {
    id: s.id, student_id: String(s.student_id || ''), name: s.name || '',
    number: cfg_num_(s.number), room: String(s.room || ''),
    barcode: String(s.barcode || s.student_id || ''), photo_url: s.photo_url || '',
    is_active: _yes_(s.is_active)
  };
}

function Students_list(user, p) {
  Auth_requireCap(user, 'student.view_all');
  var room = String((p && p.room) || '').trim();
  var arr = DB_readAll(SHEETS.STUDENTS).filter(function (s) { return _yes_(s.is_active); });
  if (room) arr = arr.filter(function (s) { return String(s.room) === room; });
  arr = arr.map(Student_public_).sort(function (a, b) { return (a.number - b.number) || (a.name < b.name ? -1 : 1); });
  return { items: arr };
}

/* ── จำนวนนักเรียนต่อห้อง (สำหรับ room cards) ── */
function Students_countByRoom() {
  var ver = _verAll_([SHEETS.STUDENTS]);
  return Cache_compute_('stu:countByRoom:v' + ver, 300, function () {
    var by = {}; ROOMS.forEach(function (r) { by[r] = 0; });
    DB_readAll(SHEETS.STUDENTS).forEach(function (s) { if (_yes_(s.is_active) && by[s.room] != null) by[s.room]++; });
    return by;
  });
}

function Students_upsert(user, p) {
  Auth_requireCap(user, 'student.manage');
  var id = p && p.id;
  var sid = String((p && p.student_id) || '').trim();
  if (!sid) throw new Error('กรอกรหัสนักเรียน');
  if (!p.name) throw new Error('กรอกชื่อ-นามสกุล');
  if (ROOMS.indexOf(String(p.room)) < 0) throw new Error('เลือกห้องเรียนที่ถูกต้อง');

  var dup = DB_findOne(SHEETS.STUDENTS, function (x) { return String(x.student_id) === sid && String(x.id) !== String(id); });
  if (dup) throw new Error('รหัสนักเรียนนี้มีอยู่แล้ว');

  var data = {
    student_id: sid, name: p.name, number: cfg_num_(p.number), room: String(p.room),
    barcode: String(p.barcode || sid), is_active: (p.is_active === false ? 'no' : 'yes')
  };
  if (p.photo_url != null) data.photo_url = p.photo_url;

  if (id) {
    var ex = DB_get(SHEETS.STUDENTS, id); if (!ex) throw new Error('ไม่พบนักเรียน');
    var up = DB_update(SHEETS.STUDENTS, id, data);
    Audit_log_(user, 'student.update', 'student', id, { student_id: sid });
    return { ok: true, student: Student_public_(up) };
  }
  var obj = DB_insert(SHEETS.STUDENTS, data);
  Audit_log_(user, 'student.create', 'student', obj.id, { student_id: sid });
  return { ok: true, student: Student_public_(obj) };
}

function Students_delete(user, p) {
  Auth_requireCap(user, 'student.manage');
  var ex = DB_get(SHEETS.STUDENTS, p && p.id); if (!ex) throw new Error('ไม่พบนักเรียน');
  DB_update(SHEETS.STUDENTS, ex.id, { is_active: 'no' });   // soft delete
  Audit_log_(user, 'student.delete', 'student', ex.id, { student_id: ex.student_id });
  return { ok: true };
}

/* ── Excel/CSV import (batch) ── */
function Students_import(user, p) {
  Auth_requireCap(user, 'student.manage');
  var rows = (p && p.rows) || [];
  if (!rows.length) throw new Error('ไม่มีข้อมูลนำเข้า');
  if (rows.length > 3000) throw new Error('นำเข้าได้สูงสุด 3000 รายการต่อครั้ง');

  var existing = {};
  DB_readAll(SHEETS.STUDENTS).forEach(function (s) { existing[String(s.student_id)] = s; });

  DB_beginBatch();
  var created = 0, updated = 0, skipped = 0;
  try {
    var toInsert = [];
    rows.forEach(function (d) {
      var sid = String(d.student_id || '').trim();
      var name = String(d.name || '').trim();
      var room = String(d.room || '').trim();
      if (!sid || !name || ROOMS.indexOf(room) < 0) { skipped++; return; }
      var payload = {
        student_id: sid, name: name, number: cfg_num_(d.number), room: room,
        barcode: String(d.barcode || sid), is_active: 'yes'
      };
      if (existing[sid]) { DB_update(SHEETS.STUDENTS, existing[sid].id, payload); updated++; }
      else { toInsert.push(payload); created++; }
    });
    if (toInsert.length) DB_bulkInsert(SHEETS.STUDENTS, toInsert);
  } finally { DB_endBatch(); }

  Audit_log_(user, 'student.import', 'student', '', { created: created, updated: updated, skipped: skipped });
  return { ok: true, created: created, updated: updated, skipped: skipped };
}
