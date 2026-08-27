/**
 * ═══════════════════════════════════════════════════════════════
 *  SAB · ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด
 *  File:        05_Attendance.gs — check-in (scan/manual) · time-status · room status · dashboard
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

/* ── หา record การเช็คของวันนั้น (map: student_id -> record) ── */
function Att_dayMap_(room, date) {
  var d10 = cfg_d10_(date);
  var map = {};
  DB_readAll(SHEETS.ATTENDANCE).forEach(function (a) {
    if (String(a.room) === String(room) && cfg_d10_(a.date) === d10) map[String(a.student_id)] = a;
  });
  return map;
}

/* ── โหลดหน้าเช็คชื่อรายห้อง ── */
function Attendance_roster(user, p) {
  Auth_requireCap(user, 'attendance.view_all');
  var room = String((p && p.room) || '').trim();
  if (ROOMS.indexOf(room) < 0) throw new Error('เลือกห้องที่ถูกต้อง');
  var date = cfg_d10_((p && p.date) || cfg_today_());
  var students = DB_readAll(SHEETS.STUDENTS).filter(function (s) { return _yes_(s.is_active) && String(s.room) === room; })
    .map(Student_public_).sort(function (a, b) { return (a.number - b.number) || (a.name < b.name ? -1 : 1); });
  var day = Att_dayMap_(room, date);
  var roster = students.map(function (s) {
    var a = day[String(s.student_id)];
    return {
      student_id: s.student_id, name: s.name, number: s.number, room: s.room,
      barcode: s.barcode, photo_url: s.photo_url,
      status: a ? a.status : '', time: a ? cfg_time_(a.time) : '', method: a ? a.method : '', note: a ? (a.note || '') : '',
      checked: !!a
    };
  });
  var counts = { present: 0, late: 0, absent: 0, leave: 0, unchecked: 0 };
  roster.forEach(function (r) { if (r.status) counts[r.status] = (counts[r.status] || 0) + 1; else counts.unchecked++; });
  return { room: room, date: date, total: roster.length, counts: counts, roster: roster, settings: Settings_getPublic_(), now: cfg_timeNow_() };
}

/* ── เช็คชื่อ 1 คน (scan / manual) — upsert ── */
function Attendance_check(user, p) {
  Auth_requireCap(user, 'attendance.create');
  var room = String((p && p.room) || '').trim();
  if (ROOMS.indexOf(room) < 0) throw new Error('เลือกห้องที่ถูกต้อง');
  var date = cfg_d10_((p && p.date) || cfg_today_());
  var code = String((p && p.code) || '').trim();          // รหัส/บาร์โค้ดที่สแกนหรือพิมพ์
  var sid = String((p && p.student_id) || '').trim();      // เลือกจากรายชื่อ
  var method = (p && p.method === 'scan') ? 'scan' : 'manual';

  var stu = null;
  var students = DB_readAll(SHEETS.STUDENTS);
  if (sid) {
    stu = students.filter(function (s) { return String(s.student_id) === sid; })[0];
  } else if (code) {
    stu = students.filter(function (s) { return _yes_(s.is_active) && (String(s.student_id) === code || String(s.barcode) === code); })[0];
  }
  if (!stu) throw new Error('ไม่พบนักเรียนรหัส "' + esc_(code || sid) + '"');
  if (!_yes_(stu.is_active)) throw new Error('นักเรียนคนนี้ถูกระงับ');
  if (String(stu.room) !== room) throw new Error('นักเรียน "' + esc_(stu.name) + '" อยู่ห้อง ' + esc_(stu.room) + ' ไม่ใช่ห้อง ' + esc_(room));

  var status = p && p.status && STATUS_LABEL[p.status] ? p.status : Status_byTime_(cfg_timeNow_(), Settings_getPublic_());
  var time = cfg_timeNow_();
  var note = String((p && p.note) || '');

  var existing = DB_findOne(SHEETS.ATTENDANCE, function (a) {
    return String(a.student_id) === String(stu.student_id) && String(a.room) === room && cfg_d10_(a.date) === date;
  });
  var rec;
  if (existing) {
    rec = DB_update(SHEETS.ATTENDANCE, existing.id, { status: status, time: time, method: method, note: note, checked_by: user.id });
  } else {
    rec = DB_insert(SHEETS.ATTENDANCE, {
      student_id: stu.student_id, room: room, date: date, time: time,
      status: status, method: method, note: note, checked_by: user.id
    });
  }
  return {
    ok: true, duplicate: !!existing,
    student: { student_id: stu.student_id, name: stu.name, number: cfg_num_(stu.number), photo_url: stu.photo_url || '' },
    status: status, status_label: STATUS_LABEL[status], time: time
  };
}

/* ── กำหนดสถานะลา / แก้สถานะด้วยมือ ── */
function Attendance_setStatus(user, p) {
  Auth_requireCap(user, 'attendance.create');
  var room = String((p && p.room) || '').trim();
  var date = cfg_d10_((p && p.date) || cfg_today_());
  var sid = String((p && p.student_id) || '').trim();
  var status = p && p.status;
  if (!STATUS_LABEL[status]) throw new Error('สถานะไม่ถูกต้อง');
  var stu = DB_findOne(SHEETS.STUDENTS, function (s) { return String(s.student_id) === sid && String(s.room) === room; });
  if (!stu) throw new Error('ไม่พบนักเรียน');
  var note = String((p && p.note) || '');
  var existing = DB_findOne(SHEETS.ATTENDANCE, function (a) {
    return String(a.student_id) === sid && String(a.room) === room && cfg_d10_(a.date) === date;
  });
  if (existing) DB_update(SHEETS.ATTENDANCE, existing.id, { status: status, method: 'manual', note: note, checked_by: user.id, time: cfg_timeNow_() });
  else DB_insert(SHEETS.ATTENDANCE, { student_id: sid, room: room, date: date, time: cfg_timeNow_(), status: status, method: 'manual', note: note, checked_by: user.id });
  return { ok: true, status: status, status_label: STATUS_LABEL[status] };
}

/* ── ลบการเช็ค (ยกเลิก) ── */
function Attendance_unset(user, p) {
  Auth_requireCap(user, 'attendance.create');
  var room = String((p && p.room) || '').trim();
  var date = cfg_d10_((p && p.date) || cfg_today_());
  var sid = String((p && p.student_id) || '').trim();
  var existing = DB_findOne(SHEETS.ATTENDANCE, function (a) {
    return String(a.student_id) === sid && String(a.room) === room && cfg_d10_(a.date) === date;
  });
  if (existing) DB_delete(SHEETS.ATTENDANCE, existing.id);
  return { ok: true };
}

/* ── สถานะวงกลมรายห้อง (red+count / green) — สำหรับหน้าเลือกห้อง ── */
function Attendance_roomStatus(user, p) {
  Auth_requireCap(user, 'attendance.view_all');
  var date = cfg_d10_((p && p.date) || cfg_today_());
  var counts = Students_countByRoom();
  var day = {};
  DB_readAll(SHEETS.ATTENDANCE).forEach(function (a) {
    if (cfg_d10_(a.date) === date) { var r = String(a.room); if (!day[r]) day[r] = {}; day[r][String(a.student_id)] = 1; }
  });
  var out = {};
  ROOMS.forEach(function (r) {
    var total = counts[r] || 0;
    var checked = day[r] ? Object.keys(day[r]).length : 0;
    out[r] = { total: total, checked: checked, remaining: Math.max(0, total - checked), done: total > 0 && checked >= total };
  });
  return { date: date, rooms: out, now: cfg_timeNow_() };
}

/* ── Dashboard stats (single scan) ── */
function Attendance_dashboard(user, p) {
  Auth_requireCap(user, 'attendance.view_all');
  var date = cfg_d10_((p && p.date) || cfg_today_());
  var ver = _verAll_([SHEETS.ATTENDANCE, SHEETS.STUDENTS]);
  var key = 'dash:' + date + ':v' + ver;
  return Cache_compute_(key, 120, function () { return _dashboardCompute_(date); });
}
function _dashboardCompute_(date) {
  var students = DB_readAll(SHEETS.STUDENTS).filter(function (s) { return _yes_(s.is_active); });
  var totalStudents = students.length;
  var countsRoom = {}; ROOMS.forEach(function (r) { countsRoom[r] = 0; });
  students.forEach(function (s) { if (countsRoom[s.room] != null) countsRoom[s.room]++; });

  var today = { present: 0, late: 0, absent: 0, leave: 0 };
  var checkedSet = {};
  var recent = [];
  var attAll = DB_readAll(SHEETS.ATTENDANCE);
  attAll.forEach(function (a) {
    if (cfg_d10_(a.date) === date) {
      today[a.status] = (today[a.status] || 0) + 1;
      checkedSet[String(a.room) + '|' + String(a.student_id)] = 1;
    }
  });
  var checkedToday = Object.keys(checkedSet).length;

  // trend 7 วัน
  var byDay = {};
  attAll.forEach(function (a) {
    var d = cfg_d10_(a.date);
    if (!byDay[d]) byDay[d] = { present: 0, late: 0, absent: 0, leave: 0, total: 0 };
    byDay[d][a.status] = (byDay[d][a.status] || 0) + 1; byDay[d].total++;
  });
  var trend = [];
  for (var i = 6; i >= 0; i--) {
    var dd = Utilities.formatDate(new Date(new Date(date).getTime() - i * 86400000), APP.TIMEZONE, 'yyyy-MM-dd');
    var rec = byDay[dd] || { present: 0, late: 0, absent: 0, leave: 0, total: 0 };
    trend.push({ date: dd, present: rec.present, late: rec.late, absent: rec.absent, leave: rec.leave, total: rec.total });
  }

  // room progress
  var dayRoom = {};
  attAll.forEach(function (a) { if (cfg_d10_(a.date) === date) { var r = String(a.room); if (!dayRoom[r]) dayRoom[r] = {}; dayRoom[r][String(a.student_id)] = 1; } });
  var rooms = ROOMS.map(function (r) {
    var tot = countsRoom[r] || 0, chk = dayRoom[r] ? Object.keys(dayRoom[r]).length : 0;
    return { room: r, total: tot, checked: chk, remaining: Math.max(0, tot - chk), pct: tot ? Math.round(chk / tot * 100) : 0 };
  });

  return {
    date: date, total_students: totalStudents, checked_today: checkedToday,
    unchecked_today: Math.max(0, totalStudents - checkedToday),
    today: today, trend: trend, rooms: rooms,
    rate: totalStudents ? Math.round(checkedToday / totalStudents * 100) : 0
  };
}
