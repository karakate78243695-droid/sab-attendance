/**
 * ═══════════════════════════════════════════════════════════════
 *  SAB · ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด
 *  File:        06_Reports.gs — room/individual reports (single scan O(n)) · export rows
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function _rangeFilter_(from, to) {
  from = cfg_d10_(from || ''); to = cfg_d10_(to || '');
  return function (d10) {
    if (from && d10 < from) return false;
    if (to && d10 > to) return false;
    return true;
  };
}

/* ── รายงานสรุป (รายห้อง + รายบุคคล) ในการ scan เดียว ── */
function Reports_summary(user, p) {
  Auth_requireCap(user, 'report.view_all');
  var room = String((p && p.room) || '').trim();
  var from = cfg_d10_((p && p.from) || '');
  var to = cfg_d10_((p && p.to) || '');
  var inRange = _rangeFilter_(from, to);

  var students = DB_readAll(SHEETS.STUDENTS).filter(function (s) {
    return _yes_(s.is_active) && (!room || String(s.room) === room);
  });
  var sIndex = {}; students.forEach(function (s) { sIndex[String(s.student_id)] = s; });

  // per-student accumulator
  var per = {};
  students.forEach(function (s) {
    per[String(s.student_id)] = { student_id: s.student_id, name: s.name, number: cfg_num_(s.number), room: s.room, present: 0, late: 0, absent: 0, leave: 0, total: 0, last: '' };
  });

  var roomAgg = {};   // room -> counts
  var statusAgg = { present: 0, late: 0, absent: 0, leave: 0 };
  var daySet = {};

  DB_readAll(SHEETS.ATTENDANCE).forEach(function (a) {
    var d10 = cfg_d10_(a.date);
    if (!inRange(d10)) return;
    if (room && String(a.room) !== room) return;
    var s = sIndex[String(a.student_id)];
    if (!s) return;
    daySet[d10] = 1;
    var st = a.status;
    statusAgg[st] = (statusAgg[st] || 0) + 1;
    var rr = String(a.room);
    if (!roomAgg[rr]) roomAgg[rr] = { room: rr, present: 0, late: 0, absent: 0, leave: 0, total: 0 };
    roomAgg[rr][st] = (roomAgg[rr][st] || 0) + 1; roomAgg[rr].total++;
    var pp = per[String(a.student_id)];
    if (pp) { pp[st] = (pp[st] || 0) + 1; pp.total++; if (d10 > pp.last) pp.last = d10; }
  });

  var totalStatus = statusAgg.present + statusAgg.late + statusAgg.absent + statusAgg.leave;
  var rooms = Object.keys(roomAgg).map(function (k) { return roomAgg[k]; }).sort(function (a, b) { return a.room < b.room ? -1 : 1; });
  rooms.forEach(function (r) { r.attend_rate = r.total ? Math.round((r.present + r.late) / r.total * 100) : 0; });

  var individuals = students.map(function (s) {
    var pp = per[String(s.student_id)];
    var t = pp.total;
    pp.attend_rate = t ? Math.round((pp.present + pp.late) / t * 100) : 0;
    pp.present_rate = t ? Math.round(pp.present / t * 100) : 0;
    return pp;
  }).sort(function (a, b) { return (a.room < b.room ? -1 : a.room > b.room ? 1 : 0) || (a.number - b.number); });

  return {
    room: room, from: from, to: to, days: Object.keys(daySet).length,
    overall: { present: statusAgg.present, late: statusAgg.late, absent: statusAgg.absent, leave: statusAgg.leave, total: totalStatus,
               attend_rate: totalStatus ? Math.round((statusAgg.present + statusAgg.late) / totalStatus * 100) : 0 },
    rooms: rooms, individuals: individuals,
    total_students: students.length, generated_at: cfg_now_()
  };
}

/* ── แถวสำหรับ export (CSV/Excel) ── */
function Reports_exportRows(user, p) {
  Auth_requireCap(user, 'report.view_all');
  var r = Reports_summary(user, p);
  var header = ['เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ห้อง', 'มาแถว', 'มาสาย', 'ขาดแถว', 'ลา', 'รวม', 'อัตราเข้าแถว (%)'];
  var rows = r.individuals.map(function (s) {
    return [s.number, s.student_id, s.name, s.room, s.present, s.late, s.absent, s.leave, s.total, s.attend_rate];
  });
  return { header: header, rows: rows, meta: r };
}

/* ── Audit log (admin) ── */
function Audit_list(user, p) {
  Auth_requireCap(user, 'audit.view_all');
  var arr = DB_readAll(SHEETS.AUDIT).slice().sort(function (a, b) { return a.ts < b.ts ? 1 : -1; }).slice(0, 500);
  return { items: arr };
}
