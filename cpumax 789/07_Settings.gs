/**
 * ═══════════════════════════════════════════════════════════════
 *  SAB · ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด
 *  File:        07_Settings.gs — Settings (EAV) · runtime toggles · sensitive filtering
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function Settings_map_() {
  var map = {};
  DB_readAll(SHEETS.SETTINGS).forEach(function (r) { map[String(r.key)] = String(r.value == null ? '' : r.value); });
  return map;
}
function Settings_forceTextValueColumn_(sh) {
  try { sh.getRange(2, 2, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); } catch (e) {}
}
function Settings_setRaw_(key, value) {
  if (!key) throw new Error('ไม่ระบุ key');
  var sh = DB_ensureSchema_(SHEETS.SETTINGS);
  Settings_forceTextValueColumn_(sh);
  var last = sh.getLastRow();
  if (last >= 2) {
    var keys = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var r = 0; r < keys.length; r++) {
      if (String(keys[r][0]) === String(key)) {
        var range = sh.getRange(r + 2, 1, 1, 3);
        range.setNumberFormat('@');
        range.setValues([[key, String(value), cfg_now_()]]);
        _flush_(); _bumpVer_('sheet:' + SHEETS.SETTINGS); _bumpVer_('public');
        return;
      }
    }
  }
  var nr = sh.getLastRow() + 1;
  var rng = sh.getRange(nr, 1, 1, 3);
  rng.setNumberFormat('@');
  rng.setValues([[key, String(value), cfg_now_()]]);
  _flush_(); _bumpVer_('sheet:' + SHEETS.SETTINGS); _bumpVer_('public');
}
function Settings_ensureDefaults_() {
  DB_ensureSchema_(SHEETS.SETTINGS);
  var map = Settings_map_();
  Object.keys(SETTINGS_DEFAULTS).forEach(function (k) { if (!(k in map)) Settings_setRaw_(k, SETTINGS_DEFAULTS[k]); });
}
function Settings_getPublic_() {
  Settings_ensureDefaults_();
  var all = Settings_map_(), out = {};
  Object.keys(all).forEach(function (k) { if (SETTINGS_SENSITIVE.indexOf(k) < 0) out[k] = all[k]; });
  return out;
}

/* ── API ── */
function Settings_get(user) {
  Auth_requireCap(user, 'setting.read');
  Settings_ensureDefaults_();
  var all = Settings_map_();
  if (hasCap_(user.role, 'setting.manage')) return { settings: all };
  var out = {}; Object.keys(all).forEach(function (k) { if (SETTINGS_SENSITIVE.indexOf(k) < 0) out[k] = all[k]; });
  return { settings: out };
}
function Settings_update(user, p) {
  Auth_requireCap(user, 'setting.manage');
  var patch = (p && p.settings) || {};
  var keys = Object.keys(patch);
  keys.forEach(function (k) { Settings_setRaw_(k, patch[k]); });
  Audit_log_(user, 'setting.update', 'setting', '', { keys: keys });
  return { ok: true };
}
function Settings_repair() {
  var sh = DB_ensureSchema_(SHEETS.SETTINGS), last = sh.getLastRow();
  Settings_forceTextValueColumn_(sh);
  if (last >= 2) {
    var range = sh.getRange(2, 1, last - 1, 3), vals = range.getValues();
    range.setNumberFormat('@');
    range.setValues(vals.map(function (r) { return [String(r[0] || ''), r[1] === '' || r[1] == null ? '' : String(r[1]), r[2]]; }));
  }
  _bumpVer_('sheet:' + SHEETS.SETTINGS); _bumpVer_('public');
  return { fixed: Math.max(0, last - 1) };
}
