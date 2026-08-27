/**
 * ═══════════════════════════════════════════════════════════════
 *  SAB · ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด
 *  File:        01_DB.gs — Sheet-as-DB layer (cache 2-layer · batch · version invalidation)
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

var CACHE_TTL = 300;
var __L1 = {};          // in-memory memo: name -> {ver, data}
var __VERMEMO = null;   // ScriptProperties snapshot ต่อ request
var __BATCH = false, __BATCH_DIRTY = {};

function _resetReq_() { __VERMEMO = null; }
function _ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function _cache_() { return CacheService.getScriptCache(); }

/* ── Version counters ── */
function _ver_(scope) {
  if (!__VERMEMO) __VERMEMO = PropertiesService.getScriptProperties().getProperties() || {};
  return Number(__VERMEMO['ver:' + scope] || '1');
}
function _bumpVer_(scope) {
  if (__BATCH) { __BATCH_DIRTY[scope] = true; return; }
  var p = PropertiesService.getScriptProperties();
  var v = Number(p.getProperty('ver:' + scope) || '1') + 1;
  p.setProperty('ver:' + scope, String(v));
  if (__VERMEMO) __VERMEMO['ver:' + scope] = String(v);
  delete __L1[scope.replace('sheet:', '')];
}
function _verAll_(scopes) { return scopes.map(function (s) { return _ver_('sheet:' + s); }).join('.'); }

/* ── Cache get/put (chunked >95KB) ── */
function _cacheGet_(key) {
  try {
    var raw = _cache_().get(key);
    if (!raw) return null;
    if (raw.indexOf('CHUNK:') === 0) {
      var n = Number(raw.substring(6)), parts = [];
      for (var i = 0; i < n; i++) { var c = _cache_().get(key + ':' + i); if (!c) return null; parts.push(c); }
      return JSON.parse(parts.join(''));
    }
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function _cachePut_(key, val, ttl) {
  try {
    var json = JSON.stringify(val);
    if (json.length < 95000) { _cache_().put(key, json, ttl || CACHE_TTL); return; }
    var n = Math.ceil(json.length / 90000);
    _cache_().put(key, 'CHUNK:' + n, ttl || CACHE_TTL);
    for (var i = 0; i < n; i++) _cache_().put(key + ':' + i, json.substring(i * 90000, (i + 1) * 90000), ttl || CACHE_TTL);
  } catch (e) {}
}
function Cache_compute_(key, ttl, fn) {
  var c = _cacheGet_(key);
  if (c !== null && c !== undefined) return c;
  var v = fn();
  if (v !== null && v !== undefined) _cachePut_(key, v, ttl || CACHE_TTL);
  return v;
}

/* ── Batch mode (กัน timeout ตอน seed/import) ── */
function DB_beginBatch() { __BATCH = true; __BATCH_DIRTY = {}; }
function DB_endBatch() {
  if (!__BATCH) return;
  __BATCH = false;
  SpreadsheetApp.flush();
  var scopes = Object.keys(__BATCH_DIRTY); __BATCH_DIRTY = {};
  if (scopes.length) {
    var p = PropertiesService.getScriptProperties(), cur = p.getProperties() || {}, set = {};
    scopes.forEach(function (s) { set['ver:' + s] = String(Number(cur['ver:' + s] || '1') + 1); });
    p.setProperties(set);
    __VERMEMO = null;
    scopes.forEach(function (s) { delete __L1[s.replace('sheet:', '')]; });
  }
}
function _flush_() { if (!__BATCH) SpreadsheetApp.flush(); }

/* ── Schema ensure (ตั้ง TEXT format เฉพาะตอนสร้าง/แก้ schema) ── */
function DB_ensureSchema_(name) {
  var ss = _ss_(), sh = ss.getSheetByName(name);
  var cols = SCHEMAS[name];
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#1d1d1f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    cols.forEach(function (c, i) {
      if (TEXT_COLUMNS.indexOf(c) >= 0) {
        try { sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@'); } catch (e) {}
      }
    });
    return sh;
  }
  var lastCol = sh.getLastColumn();
  var head = lastCol ? sh.getRange(1, 1, 1, Math.max(lastCol, cols.length)).getValues()[0] : [];
  var need = false;
  for (var i = 0; i < cols.length; i++) { if (String(head[i] || '') !== cols[i]) { need = true; break; } }
  if (need) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#1d1d1f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    cols.forEach(function (c, i) {
      if (TEXT_COLUMNS.indexOf(c) >= 0) {
        try { sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@'); } catch (e) {}
      }
    });
  }
  return sh;
}
function DB_initAllSchemas() { Object.keys(SCHEMAS).forEach(function (n) { DB_ensureSchema_(n); }); }

/* ── Read all (L1 → cache → sheet, column-aware date/time) ── */
function DB_readAll(name) {
  var ver = _ver_('sheet:' + name);
  var l1 = __L1[name]; if (l1 && l1.ver === ver) return l1.data;
  var cacheKey = 'sheet:' + name + ':v' + ver;
  var cached = _cacheGet_(cacheKey);
  if (cached) { __L1[name] = { ver: ver, data: cached }; return cached; }

  var sh = DB_ensureSchema_(name), cols = SCHEMAS[name], last = sh.getLastRow();
  if (last < 2) { _cachePut_(cacheKey, []); __L1[name] = { ver: ver, data: [] }; return []; }
  var values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  var keyIdx = cols.indexOf('id'); if (keyIdx < 0) keyIdx = 0;
  var result = values.map(function (row) {
    var o = {};
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i], v = row[i];
      if (v instanceof Date) {
        if (TIME_COLUMNS.indexOf(c) >= 0) v = Utilities.formatDate(v, APP.TIMEZONE, 'HH:mm');
        else if (DATE_COLUMNS.indexOf(c) >= 0) v = Utilities.formatDate(v, APP.TIMEZONE, 'yyyy-MM-dd');
        else v = cfg_iso_(v);
      }
      o[c] = (v == null) ? '' : v;
    }
    return o;
  }).filter(function (o) { return String(o[cols[keyIdx]] || '').trim() !== ''; });

  _cachePut_(cacheKey, result);
  __L1[name] = { ver: ver, data: result };
  return result;
}

function DB_buildIndex(name) {
  var arr = DB_readAll(name), cols = SCHEMAS[name];
  var keyIdx = cols.indexOf('id'); if (keyIdx < 0) keyIdx = 0;
  var key = cols[keyIdx], map = {};
  arr.forEach(function (o) { map[String(o[key])] = o; });
  return map;
}
function DB_get(name, id) { return DB_buildIndex(name)[String(id)] || null; }
function DB_findOne(name, pred) { var a = DB_readAll(name); for (var i = 0; i < a.length; i++) if (pred(a[i])) return a[i]; return null; }

/* ── Insert (text-format-safe) ── */
function DB_insert(name, data) {
  var sh = DB_ensureSchema_(name), cols = SCHEMAS[name];
  var obj = {};
  cols.forEach(function (c) { obj[c] = (data[c] == null) ? '' : data[c]; });
  if (cols.indexOf('id') >= 0 && !obj.id) obj.id = cfg_uuid_();
  if (cols.indexOf('created_at') >= 0 && !obj.created_at) obj.created_at = cfg_now_();
  if (cols.indexOf('updated_at') >= 0 && !obj.updated_at) obj.updated_at = cfg_now_();
  var row = cols.map(function (c) { return obj[c]; });
  var newRow = sh.getLastRow() + 1;
  var range = sh.getRange(newRow, 1, 1, cols.length);
  cols.forEach(function (c, i) { if (TEXT_COLUMNS.indexOf(c) >= 0) sh.getRange(newRow, i + 1).setNumberFormat('@'); });
  range.setValues([row]);
  _flush_(); _bumpVer_('sheet:' + name);
  return obj;
}

/* ── Bulk insert (เร็ว · ใช้กับ seed/import) ── */
function DB_bulkInsert(name, list) {
  if (!list || !list.length) return 0;
  var sh = DB_ensureSchema_(name), cols = SCHEMAS[name];
  var now = cfg_now_();
  var rows = list.map(function (data) {
    var obj = {};
    cols.forEach(function (c) { obj[c] = (data[c] == null) ? '' : data[c]; });
    if (cols.indexOf('id') >= 0 && !obj.id) obj.id = cfg_uuid_();
    if (cols.indexOf('created_at') >= 0 && !obj.created_at) obj.created_at = now;
    if (cols.indexOf('updated_at') >= 0 && !obj.updated_at) obj.updated_at = now;
    return cols.map(function (c) { return obj[c]; });
  });
  var start = sh.getLastRow() + 1;
  var range = sh.getRange(start, 1, rows.length, cols.length);
  cols.forEach(function (c, i) {
    if (TEXT_COLUMNS.indexOf(c) >= 0) sh.getRange(start, i + 1, rows.length, 1).setNumberFormat('@');
  });
  range.setValues(rows);
  _flush_(); _bumpVer_('sheet:' + name);
  return rows.length;
}

/* ── Update by id ── */
function DB_update(name, id, patch) {
  var sh = DB_ensureSchema_(name), cols = SCHEMAS[name];
  var keyIdx = cols.indexOf('id'); if (keyIdx < 0) keyIdx = 0;
  var last = sh.getLastRow(); if (last < 2) return null;
  var keyCol = sh.getRange(2, keyIdx + 1, last - 1, 1).getValues();
  for (var r = 0; r < keyCol.length; r++) {
    if (String(keyCol[r][0]) === String(id)) {
      var rowNum = r + 2;
      var cur = sh.getRange(rowNum, 1, 1, cols.length).getValues()[0];
      var obj = {};
      cols.forEach(function (c, i) { obj[c] = cur[i]; });
      Object.keys(patch).forEach(function (k) { if (cols.indexOf(k) >= 0 && patch[k] != null) obj[k] = patch[k]; });
      if (cols.indexOf('updated_at') >= 0) obj.updated_at = cfg_now_();
      var range = sh.getRange(rowNum, 1, 1, cols.length);
      cols.forEach(function (c, i) { if (TEXT_COLUMNS.indexOf(c) >= 0) sh.getRange(rowNum, i + 1).setNumberFormat('@'); });
      range.setValues([cols.map(function (c) { return obj[c]; })]);
      _flush_(); _bumpVer_('sheet:' + name);
      return obj;
    }
  }
  return null;
}

/* ── Delete by id (hard) ── */
function DB_delete(name, id) {
  var sh = DB_ensureSchema_(name), cols = SCHEMAS[name];
  var keyIdx = cols.indexOf('id'); if (keyIdx < 0) keyIdx = 0;
  var last = sh.getLastRow(); if (last < 2) return false;
  var keyCol = sh.getRange(2, keyIdx + 1, last - 1, 1).getValues();
  for (var r = 0; r < keyCol.length; r++) {
    if (String(keyCol[r][0]) === String(id)) { sh.deleteRow(r + 2); _flush_(); _bumpVer_('sheet:' + name); return true; }
  }
  return false;
}
function DB_count(name) { var sh = _ss_().getSheetByName(name); return sh ? Math.max(0, sh.getLastRow() - 1) : 0; }

/* ── Audit log (append-only) ── */
function Audit_log_(user, action, entity, entityId, meta) {
  try {
    DB_insert(SHEETS.AUDIT, {
      ts: cfg_now_(),
      user_id: (user && user.id) || '',
      username: (user && user.username) || 'system',
      action: action, entity: entity || '', entity_id: entityId || '',
      meta: meta ? JSON.stringify(meta) : ''
    });
  } catch (e) {}
}
