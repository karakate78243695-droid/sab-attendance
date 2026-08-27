/**
 * ═══════════════════════════════════════════════════════════════
 *  SAB · ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด (Student Attendance Barcode)
 *  File:        00_Config.gs — ค่าคงที่ + Schemas + RBAC + Helpers + TH module
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

var APP = Object.freeze({
  NAME: 'ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด',
  SHORT: 'SAB',
  TITLE: 'ระบบเช็คชื่อนักเรียน · Barcode Attendance',
  VERSION: '1.0.0',
  LAST_UPDATED: '2026-06-19',
  DESCRIPTION: 'เช็คชื่อนักเรียนหน้าเสาธงด้วยการสแกนบาร์โค้ด กำหนดสถานะอัตโนมัติตามเวลา พร้อมรายงานสรุปดาวน์โหลดได้',
  ORG: 'โรงเรียนในสังกัด สพฐ.',
  TIMEZONE: 'Asia/Bangkok',
  LOGO_ICON: 'upc-scan',
  DEV: {
    NAME: 'ครูวิรัตน์  หาดคำ',
    URL: 'https://www.kruwirat.com',
    LOGO: 'https://mts-ssk3.com/uploads/team/team_1771053860_6990232440dc8.png'
  }
});

/* ── 15 ห้องเรียนมาตรฐาน ── */
var ROOMS = Object.freeze(['1/1','1/2','1/3','2/1','2/2','2/3','2/4','3/1','3/2','4/1','4/2','5/1','5/2','6/1','6/2']);

/* ── สถานะการเช็คชื่อ ── */
var STATUS = Object.freeze({ PRESENT: 'present', LATE: 'late', ABSENT: 'absent', LEAVE: 'leave' });
var STATUS_LABEL = Object.freeze({ present: 'มาแถว', late: 'มาสาย', absent: 'ขาดแถว', leave: 'ลา' });
var STATUS_COLOR = Object.freeze({ present: '#34c759', late: '#ff9f0a', absent: '#ff3b30', leave: '#5e5ce6' });
var STATUS_ICON  = Object.freeze({ present: 'check-circle-fill', late: 'clock-fill', absent: 'x-circle-fill', leave: 'calendar2-check-fill' });

/* ── Roles ── */
var ROLE_LABEL = Object.freeze({ admin: 'ผู้ดูแลระบบ', teacher: 'ครู' });

/* ── RBAC: capabilities ต่อ role · 'xxx.manage' implies 'xxx.<sub>' (entity เดียวกัน) ── */
var CAPS = Object.freeze({
  admin: [
    'student.manage', 'attendance.manage', 'attendance.view_all',
    'report.view_all', 'user.manage', 'setting.manage', 'audit.view_all', 'file.upload'
  ],
  teacher: [
    'student.view_all', 'attendance.create', 'attendance.view_all',
    'report.view_all', 'setting.read', 'file.upload'
  ]
});

/* ── Sheet names ── */
var SHEETS = Object.freeze({
  USERS: 'Users', SESSIONS: 'Sessions', STUDENTS: 'Students',
  ATTENDANCE: 'Attendance', SETTINGS: 'Settings', AUDIT: 'Audit'
});

/* ── Schemas (primary key = column แรกเสมอ) ── */
var SCHEMAS = Object.freeze({
  Users:      ['id','username','password_hash','salt','full_name','role','email','phone','photo_url','rooms','is_active','created_at','updated_at'],
  Sessions:   ['token','user_id','created_at','expires_at','user_agent'],
  Students:   ['id','student_id','name','number','room','barcode','photo_url','is_active','created_at','updated_at'],
  Attendance: ['id','student_id','room','date','time','status','method','note','checked_by','created_at'],
  Settings:   ['key','value','updated_at'],
  Audit:      ['id','ts','user_id','username','action','entity','entity_id','meta']
});

/* ── คอลัมน์ที่บังคับ TEXT format (กัน Sheet auto-coerce) ── */
var TEXT_COLUMNS = Object.freeze([
  'student_id','barcode','phone','number','time','date','value','room','rooms','user_id','checked_by','entity_id'
]);
var TIME_COLUMNS = Object.freeze(['time']);
var DATE_COLUMNS = Object.freeze(['date']);

/* ── Settings defaults (Admin Runtime Toggle) ── */
var SETTINGS_DEFAULTS = Object.freeze({
  org_name:        'โรงเรียน',
  org_address:     '',
  org_phone:       '',
  academic_year:   '2569',
  present_start:   '06:50',   // เริ่มมาแถว
  present_end:     '08:30',   // สิ้นสุดมาแถว
  late_end:        '08:40',   // สิ้นสุดมาสาย (หลังจากนี้ = ขาดแถว)
  scan_sound:      'yes',
  scan_vibrate:    'yes',
  show_demo_users: 'yes',
  show_user_manual:'yes',
  theme:           'blue',
  tg_enabled:      'no',
  tg_token:        '',
  tg_admin_chat_ids:''
});
var SETTINGS_SENSITIVE = Object.freeze(['tg_token','tg_admin_chat_ids']);

/* ══════════════════ RBAC helper (server) ══════════════════ */
function hasCap_(role, cap) {
  if (!cap || cap === '*') return true;
  var arr = CAPS[role];
  if (!Array.isArray(arr)) return false;
  return String(cap).split('|').some(function (c) {
    c = String(c || '').trim();
    if (!c) return false;
    if (c === '*') return true;
    if (arr.indexOf(c) >= 0) return true;
    if (/\.(view_own|edit_own|view_self|edit_self|create_own|cancel_own)$/.test(c)) return false;
    var dot = c.indexOf('.');
    if (dot > 0 && arr.indexOf(c.substring(0, dot) + '.manage') >= 0) return true;
    return false;
  });
}
function Auth_requireCap(user, cap) {
  if (!user) throw new Error('ต้องเข้าสู่ระบบก่อน');
  if (!hasCap_(user.role, cap)) throw new Error('คุณไม่มีสิทธิ์ใช้งานฟังก์ชันนี้ (' + cap + ')');
  return true;
}

/* ══════════════════ Generic helpers ══════════════════ */
function cfg_uuid_() { return Utilities.getUuid(); }
function cfg_now_() { return Utilities.formatDate(new Date(), APP.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function cfg_iso_(d) { return (d instanceof Date) ? Utilities.formatDate(d, APP.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX") : String(d || ''); }
function cfg_dateOnly_(d) {
  if (d instanceof Date && !isNaN(d.getTime())) return Utilities.formatDate(d, APP.TIMEZONE, 'yyyy-MM-dd');
  var s = String(d == null ? '' : d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  try { var p = new Date(s); if (!isNaN(p.getTime())) return Utilities.formatDate(p, APP.TIMEZONE, 'yyyy-MM-dd'); } catch (e) {}
  return s;
}
function cfg_today_() { return Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyy-MM-dd'); }
function cfg_timeNow_() { return Utilities.formatDate(new Date(), APP.TIMEZONE, 'HH:mm'); }
function cfg_time_(t) {
  if (t instanceof Date && !isNaN(t.getTime())) return Utilities.formatDate(t, APP.TIMEZONE, 'HH:mm');
  var s = String(t == null ? '' : t).trim();
  if (!s) return '';
  if (/^\d{1,2}:\d{2}/.test(s)) { var p = s.split(':'); return _pad2_(p[0]) + ':' + _pad2_(p[1]); }
  var iso = s.match(/T(\d{2}):(\d{2})/); if (iso) return iso[1] + ':' + iso[2];
  var js = s.match(/\s(\d{2}):(\d{2}):\d{2}\s/); if (js) return js[1] + ':' + js[2];
  try { var d = new Date(s); if (!isNaN(d.getTime())) return Utilities.formatDate(d, APP.TIMEZONE, 'HH:mm'); } catch (e) {}
  return s;
}
function cfg_d10_(v) { if (v instanceof Date) return cfg_dateOnly_(v); return String(v == null ? '' : v).substring(0, 10); }
function _pad2_(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
function cfg_num_(v) { var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
function _yes_(v) { var s = String(v == null ? '' : v).toLowerCase().trim(); return s === 'yes' || s === 'true' || s === '1'; }
function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── นาทีจาก "HH:mm" (ใช้คำนวณ status) ── */
function cfg_minutes_(t) {
  var s = cfg_time_(t); var m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

/* ── คำนวณสถานะตามเวลา (ใช้ settings) ── */
function Status_byTime_(timeStr, settings) {
  settings = settings || {};
  var mNow = cfg_minutes_(timeStr);
  if (mNow < 0) return STATUS.PRESENT;
  var ps = cfg_minutes_(settings.present_start || SETTINGS_DEFAULTS.present_start);
  var pe = cfg_minutes_(settings.present_end   || SETTINGS_DEFAULTS.present_end);
  var le = cfg_minutes_(settings.late_end      || SETTINGS_DEFAULTS.late_end);
  if (mNow <= pe) return STATUS.PRESENT;       // <= 08:30 (รวมก่อน present_start ถือว่ามาแถว)
  if (mNow <= le) return STATUS.LATE;          // 08:31–08:40
  return STATUS.ABSENT;                         // >= 08:41
}
