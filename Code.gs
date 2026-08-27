/**
 * ═══════════════════════════════════════════════════════════════
 *  SAB · ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด
 *  File:        Code.gs — doGet · include · api() universal router · inline boot
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function doGet(e) {
  _resetReq_();
  var t = HtmlService.createTemplateFromFile('Index');
  var boot;
  try { boot = App_publicBundle_(); } catch (err) { boot = { app: { name: APP.NAME, version: APP.VERSION }, error: String(err) }; }
  t.bootData = boot;
  return t.evaluate()
    .setTitle(APP.TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

/* ── doPost: JSON API สำหรับ front-end ภายนอก (GitHub Pages) ──
   ใช้ Content-Type: text/plain ฝั่ง client → simple request → ไม่มี CORS preflight */
function doPost(e) {
  _resetReq_();
  var req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) {}
  var res = api(req);
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

/* ── Universal API router ── */
function api(req) {
  _resetReq_();
  var action = (req && req.action) || '';
  var token = (req && req.token) || '';
  var p = (req && req.payload) || {};
  try {
    // public actions
    if (action === 'app.bootstrap') return _ok(App_bootstrap(token));
    if (action === 'auth.login') return _ok(Auth_login(p));
    if (action === 'auth.demo_login') return _ok(Auth_login({ username: p.username, password: '123456', ua: p.ua }));
    if (action === 'auth.logout') { Auth_logout(token); return _ok({ ok: true }); }

    // authed
    var user = Auth_verify_(token);
    switch (action) {
      case 'profile.update':          return _ok(Profile_update(user, p));
      case 'profile.change_password': return _ok(Profile_changePassword(user, p));

      case 'student.list':            return _ok(Students_list(user, p));
      case 'student.upsert':          return _ok(Students_upsert(user, p));
      case 'student.delete':          return _ok(Students_delete(user, p));
      case 'student.import':          return _ok(Students_import(user, p));

      case 'attendance.roster':       return _ok(Attendance_roster(user, p));
      case 'attendance.check':        return _ok(Attendance_check(user, p));
      case 'attendance.set_status':   return _ok(Attendance_setStatus(user, p));
      case 'attendance.unset':        return _ok(Attendance_unset(user, p));
      case 'attendance.room_status':  return _ok(Attendance_roomStatus(user, p));
      case 'attendance.dashboard':    return _ok(Attendance_dashboard(user, p));

      case 'report.summary':          return _ok(Reports_summary(user, p));
      case 'report.export_rows':      return _ok(Reports_exportRows(user, p));

      case 'user.list':               return _ok(Users_list(user));
      case 'user.upsert':             return _ok(Users_upsert(user, p));
      case 'user.delete':             return _ok(Users_delete(user, p));

      case 'audit.list':              return _ok(Audit_list(user, p));
      case 'setting.get':             return _ok(Settings_get(user));
      case 'setting.update':          return _ok(Settings_update(user, p));
      case 'setting.repair':          Auth_requireCap(user, 'setting.manage'); return _ok(Settings_repair());
      case 'tg.test':                 return _ok(Telegram_test(user));
      case 'file.upload':             return _ok(Files_upload(user, p));
    }
    throw new Error('ไม่พบ action: ' + action);
  } catch (err) {
    return { ok: false, error: (err && err.message) ? err.message : String(err) };
  }
}
function _ok(data) { return { ok: true, data: data }; }
