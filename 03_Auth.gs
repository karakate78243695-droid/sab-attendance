/**
 * ═══════════════════════════════════════════════════════════════
 *  SAB · ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด
 *  File:        03_Auth.gs — Login · Session · Bootstrap · GC · revoke
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

var SESSION_HOURS = 12;

function Auth_publicUser_(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, full_name: u.full_name, role: u.role,
    email: u.email || '', phone: u.phone || '', photo_url: u.photo_url || '',
    rooms: String(u.rooms || '')
  };
}

/* ── verify token ── */
function Auth_verify_(token) {
  if (!token) throw new Error('ต้องเข้าสู่ระบบก่อน');
  var sess = DB_get(SHEETS.SESSIONS, token);
  if (!sess) throw new Error('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');
  if (cfg_d10_(sess.expires_at) && new Date(sess.expires_at).getTime() < new Date().getTime())
    throw new Error('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');
  var u = DB_get(SHEETS.USERS, sess.user_id);
  if (!u || !_yes_(u.is_active)) throw new Error('บัญชีถูกระงับ');
  return u;
}

/* ── login ── */
function Auth_login(p) {
  var username = String((p && p.username) || '').trim().toLowerCase();
  var password = String((p && p.password) || '');
  if (!username || !password) throw new Error('กรอกชื่อผู้ใช้และรหัสผ่าน');

  var lockedUntil = Sec_lockedUntil_(username);
  if (lockedUntil && lockedUntil > new Date().getTime()) {
    var mins = Math.ceil((lockedUntil - new Date().getTime()) / 60000);
    throw new Error('พยายามเข้าระบบบ่อยเกินไป กรุณารอ ' + mins + ' นาที');
  }

  var u = DB_findOne(SHEETS.USERS, function (x) { return String(x.username).toLowerCase() === username; });
  var ver = (u && _yes_(u.is_active)) ? cfg_verify_(password, u.salt, u.password_hash) : { ok: false };
  if (!ver.ok) {
    var n = Sec_recordFail_(username);
    Audit_log_(null, 'auth.fail', 'user', username, { attempts: n });
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  Sec_clearFail_(username);
  if (ver.upgrade) { var salt = cfg_salt_(); DB_update(SHEETS.USERS, u.id, { salt: salt, password_hash: cfg_hash_(password, salt) }); }

  var token = Sec_token_();
  DB_insert(SHEETS.SESSIONS, {
    token: token, user_id: u.id, created_at: cfg_now_(),
    expires_at: cfg_iso_(new Date(new Date().getTime() + SESSION_HOURS * 3600000)),
    user_agent: String((p && p.ua) || '').substring(0, 120)
  });
  Audit_log_(u, 'auth.login', 'user', u.id, {});
  return { token: token, user: Auth_publicUser_(u), caps: CAPS[u.role] || [] };
}

function Auth_logout(token) {
  if (token) { try { DB_delete(SHEETS.SESSIONS, token); } catch (e) {} }
  return { ok: true };
}

/* ── bootstrap (public bundle + user) ── */
function App_publicBundle_() {
  var ver = _verAll_([SHEETS.SETTINGS, SHEETS.USERS]);
  return Cache_compute_('boot:public:v' + ver, 120, function () {
    var hasUsers = DB_count(SHEETS.USERS) > 0;
    var settings = Settings_getPublic_();
    var demo = [];
    if (_yes_(settings.show_demo_users)) {
      DB_readAll(SHEETS.USERS).forEach(function (u) {
        if (_yes_(u.is_active) && /^(demo_|admin$|teacher$)/.test(String(u.username)))
          demo.push({ username: u.username, role: u.role, full_name: u.full_name });
      });
    }
    return {
      app: { name: APP.NAME, short: APP.SHORT, version: APP.VERSION, org: settings.org_name || APP.ORG },
      dev: APP.DEV, rooms: ROOMS, statuses: STATUS_LABEL, status_color: STATUS_COLOR,
      roles: ROLE_LABEL, has_users: hasUsers, settings: settings, demo: demo
    };
  });
}

function App_bootstrap(token) {
  _resetReq_();
  var bundle = App_publicBundle_();
  var out = { boot: bundle, me: null, caps: [] };
  if (token) {
    try { var u = Auth_verify_(token); out.me = Auth_publicUser_(u); out.caps = CAPS[u.role] || []; }
    catch (e) { out.me = null; }
  }
  return out;
}

/* ── session housekeeping ── */
function Auth_gc_() {
  var nowMs = new Date().getTime(), removed = 0;
  var sh = DB_ensureSchema_(SHEETS.SESSIONS), last = sh.getLastRow();
  if (last < 2) return 0;
  var cols = SCHEMAS.Sessions, expIdx = cols.indexOf('expires_at');
  var data = sh.getRange(2, 1, last - 1, cols.length).getValues();
  for (var r = data.length - 1; r >= 0 && removed < 50; r--) {
    var exp = data[r][expIdx];
    var t = (exp instanceof Date) ? exp.getTime() : new Date(String(exp)).getTime();
    if (!isNaN(t) && t < nowMs) { sh.deleteRow(r + 2); removed++; }
  }
  if (removed) { _flush_(); _bumpVer_('sheet:' + SHEETS.SESSIONS); }
  return removed;
}
function Auth_revokeUserSessions_(userId) {
  var sh = DB_ensureSchema_(SHEETS.SESSIONS), last = sh.getLastRow();
  if (last < 2) return;
  var cols = SCHEMAS.Sessions, uidIdx = cols.indexOf('user_id');
  var data = sh.getRange(2, 1, last - 1, cols.length).getValues();
  var changed = false;
  for (var r = data.length - 1; r >= 0; r--) {
    if (String(data[r][uidIdx]) === String(userId)) { sh.deleteRow(r + 2); changed = true; }
  }
  if (changed) { _flush_(); _bumpVer_('sheet:' + SHEETS.SESSIONS); }
}

/* ══════════════ User management (admin) ══════════════ */
function Users_list(user) {
  Auth_requireCap(user, 'user.manage');
  return { items: DB_readAll(SHEETS.USERS).map(Auth_publicUserFull_).sort(function (a, b) { return a.username < b.username ? -1 : 1; }) };
}
function Auth_publicUserFull_(u) {
  return {
    id: u.id, username: u.username, full_name: u.full_name, role: u.role,
    email: u.email || '', phone: u.phone || '', photo_url: u.photo_url || '',
    rooms: String(u.rooms || ''), is_active: _yes_(u.is_active), created_at: u.created_at
  };
}
function Users_upsert(user, p) {
  Auth_requireCap(user, 'user.manage');
  var id = p && p.id;
  var username = String((p && p.username) || '').trim().toLowerCase();
  if (!username || !/^[-a-z0-9_.]{3,40}$/.test(username)) throw new Error('ชื่อผู้ใช้ต้องเป็น a-z 0-9 . _ - ยาว 3-40 ตัว');
  if (!p.full_name) throw new Error('กรอกชื่อ-นามสกุล');
  var role = (p.role === 'admin') ? 'admin' : 'teacher';

  var dup = DB_findOne(SHEETS.USERS, function (x) { return String(x.username).toLowerCase() === username && String(x.id) !== String(id); });
  if (dup) throw new Error('ชื่อผู้ใช้นี้มีอยู่แล้ว');

  if (id) {
    var ex = DB_get(SHEETS.USERS, id);
    if (!ex) throw new Error('ไม่พบผู้ใช้');
    if (ex.role === 'admin' && role !== 'admin' && Sec_activeAdminCount_() <= 1) throw new Error('ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน');
    if (String(ex.id) === String(user.id) && role !== 'admin') throw new Error('ห้ามลดสิทธิ์ของตนเอง');
    var patch = { username: username, full_name: p.full_name, role: role, email: p.email || '', phone: p.phone || '', rooms: String(p.rooms || ''), is_active: (p.is_active === false ? 'no' : 'yes') };
    if (p.photo_url != null) patch.photo_url = p.photo_url;
    if (p.password) { Sec_requirePassword_(p.password); var s = cfg_salt_(); patch.salt = s; patch.password_hash = cfg_hash_(p.password, s); }
    var up = DB_update(SHEETS.USERS, id, patch);
    if (patch.is_active === 'no') Auth_revokeUserSessions_(id);
    Audit_log_(user, 'user.update', 'user', id, { username: username });
    return { ok: true, user: Auth_publicUserFull_(up) };
  } else {
    if (!p.password) throw new Error('กรอกรหัสผ่านเริ่มต้น');
    Sec_requirePassword_(p.password);
    var salt = cfg_salt_();
    var obj = DB_insert(SHEETS.USERS, {
      username: username, password_hash: cfg_hash_(p.password, salt), salt: salt,
      full_name: p.full_name, role: role, email: p.email || '', phone: p.phone || '',
      photo_url: p.photo_url || '', rooms: String(p.rooms || ''), is_active: 'yes'
    });
    Audit_log_(user, 'user.create', 'user', obj.id, { username: username });
    return { ok: true, user: Auth_publicUserFull_(obj) };
  }
}
function Users_delete(user, p) {
  Auth_requireCap(user, 'user.manage');
  var id = p && p.id; var ex = DB_get(SHEETS.USERS, id);
  if (!ex) throw new Error('ไม่พบผู้ใช้');
  if (String(ex.id) === String(user.id)) throw new Error('ห้ามลบบัญชีตนเอง');
  if (ex.role === 'admin' && Sec_activeAdminCount_() <= 1) throw new Error('ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน');
  DB_delete(SHEETS.USERS, id);
  Auth_revokeUserSessions_(id);
  Audit_log_(user, 'user.delete', 'user', id, { username: ex.username });
  return { ok: true };
}

/* ── profile (self) ── */
function Profile_update(user, p) {
  var patch = { full_name: p.full_name || user.full_name, email: p.email || '', phone: p.phone || '' };
  if (p.photo_url != null) patch.photo_url = p.photo_url;
  var up = DB_update(SHEETS.USERS, user.id, patch);
  Audit_log_(user, 'profile.update', 'user', user.id, {});
  return { ok: true, user: Auth_publicUser_(up) };
}
function Profile_changePassword(user, p) {
  var ex = DB_get(SHEETS.USERS, user.id);
  if (!cfg_verify_(String(p.old_password || ''), ex.salt, ex.password_hash).ok) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
  Sec_requirePassword_(String(p.new_password || ''));
  var s = cfg_salt_();
  DB_update(SHEETS.USERS, user.id, { salt: s, password_hash: cfg_hash_(p.new_password, s) });
  Audit_log_(user, 'profile.change_password', 'user', user.id, {});
  return { ok: true };
}
