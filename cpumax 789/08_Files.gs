/**
 * ═══════════════════════════════════════════════════════════════
 *  SAB · ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด
 *  File:        08_Files.gs — Image upload → Drive folder (same name as spreadsheet) → lh3 link
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

/* ── โฟลเดอร์ระดับเดียวกับสเปรดชีต ชื่อเดียวกับสเปรดชีต ── */
function Files_folder_() {
  var ss = _ss_();
  var file = DriveApp.getFileById(ss.getId());
  var parents = file.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var name = ss.getName();
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function _lh3_(fileId) { return 'https://lh3.googleusercontent.com/d/' + fileId; }

/* ── upload base64 image → คืน lh3 url ── */
function Files_upload(user, p) {
  Auth_requireCap(user, 'file.upload');
  var dataUrl = String((p && p.data) || '');
  var m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('ไฟล์ไม่ถูกต้อง');
  var mime = m[1];
  if (mime.indexOf('image/') !== 0) throw new Error('รองรับเฉพาะไฟล์ภาพ');
  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 6 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 6MB');
  var folder = Files_folder_();
  var sub = String((p && p.folder) || 'uploads');
  var subIt = folder.getFoldersByName(sub);
  var dest = subIt.hasNext() ? subIt.next() : folder.createFolder(sub);
  var ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  var name = (p && p.name ? String(p.name).replace(/[^a-zA-Z0-9_.-]/g, '_') : 'img_' + new Date().getTime()) + '.' + ext;
  var blob = Utilities.newBlob(bytes, mime, name);
  var f = dest.createFile(blob);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  Audit_log_(user, 'file.upload', 'file', f.getId(), { name: name });
  return { ok: true, url: _lh3_(f.getId()), id: f.getId() };
}

/* ── Telegram notify (best-effort, optional) ── */
function Telegram_settings_() {
  var m = Settings_map_();
  return { enabled: _yes_(m.tg_enabled), token: String(m.tg_token || ''), admins: String(m.tg_admin_chat_ids || '') };
}
function _tgEsc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function Telegram_send_(chatId, text) {
  var cfg = Telegram_settings_();
  if (!cfg.enabled || !cfg.token || !chatId) return { ok: false };
  try {
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.token + '/sendMessage', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ chat_id: String(chatId), text: String(text).substring(0, 4096), parse_mode: 'HTML', disable_web_page_preview: true }),
      muteHttpExceptions: true
    });
    return { ok: res.getResponseCode() < 300 };
  } catch (e) { return { ok: false }; }
}
function Telegram_test(user) {
  Auth_requireCap(user, 'setting.manage');
  var cfg = Telegram_settings_();
  if (!cfg.enabled) throw new Error('ยังไม่เปิดใช้ Telegram');
  var ids = cfg.admins.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  if (!ids.length) throw new Error('ยังไม่ได้ตั้ง Chat ID');
  var ok = 0; ids.forEach(function (id) { if (Telegram_send_(id, '<b>' + _tgEsc_(APP.NAME) + '</b>\nทดสอบการแจ้งเตือนสำเร็จ ✓').ok) ok++; });
  return { ok: true, sent: ok, total: ids.length };
}
