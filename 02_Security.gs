/**
 * ═══════════════════════════════════════════════════════════════
 *  SAB · ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด
 *  File:        02_Security.gs — PBKDF2 hashing · timing-safe · lockout · password policy
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

var SEC = Object.freeze({ MAX_ATTEMPTS: 5, LOCKOUT_SEC: 900, WINDOW_SEC: 900, ITER: 1000 });

/* ── salt ── */
function cfg_salt_() { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + ':' + new Date().getTime())).replace(/=+$/, '').substring(0, 22); }

/* ── PBKDF2-style iterated HMAC-SHA256 ── */
function Sec_pbkdf2_(pw, salt, iter) {
  iter = iter || SEC.ITER;
  var saltKey = Utilities.newBlob('sab:' + String(salt)).getBytes();
  var acc = Utilities.computeHmacSha256Signature(Utilities.newBlob(String(pw)).getBytes(), saltKey);
  for (var i = 1; i < iter; i++) acc = Utilities.computeHmacSha256Signature(acc, saltKey);
  return Utilities.base64EncodeWebSafe(acc).replace(/=+$/, '');
}
function cfg_hash_(pw, salt) { return 'p2$' + SEC.ITER + '$' + Sec_pbkdf2_(pw, salt, SEC.ITER); }

/* ── verify (รองรับ legacy SHA-256 + คืน {ok, upgrade}) ── */
function cfg_verify_(pw, salt, stored) {
  stored = String(stored || '');
  if (stored.indexOf('p2$') === 0) {
    var it = Number(stored.split('$')[1]) || SEC.ITER;
    return { ok: Sec_timingEq_('p2$' + it + '$' + Sec_pbkdf2_(pw, salt, it), stored), upgrade: false };
  }
  var legacy = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw, Utilities.Charset.UTF_8)).replace(/=+$/, '');
  return { ok: Sec_timingEq_(legacy, stored), upgrade: true };
}

/* ── timing-safe compare ── */
function Sec_timingEq_(a, b) {
  a = String(a); b = String(b);
  var diff = a.length ^ b.length, n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/* ── token (32-byte web-safe) ── */
function Sec_token_() {
  var raw = Utilities.getUuid() + ':' + Utilities.getUuid() + ':' + new Date().getTime();
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

/* ── brute-force lockout (by username) ── */
function Sec_lockedUntil_(u) { try { var v = _cache_().get('sec:lock:' + u); return v ? Number(v) : 0; } catch (e) { return 0; } }
function Sec_recordFail_(u) {
  try {
    var k = 'sec:fail:' + u, n = (Number(_cache_().get(k)) || 0) + 1;
    _cache_().put(k, String(n), SEC.WINDOW_SEC);
    if (n >= SEC.MAX_ATTEMPTS) { _cache_().put('sec:lock:' + u, String(new Date().getTime() + SEC.LOCKOUT_SEC * 1000), SEC.LOCKOUT_SEC); _cache_().remove(k); }
    return n;
  } catch (e) { return 0; }
}
function Sec_clearFail_(u) { try { _cache_().remove('sec:fail:' + u); _cache_().remove('sec:lock:' + u); } catch (e) {} }

/* ── password policy (เฉพาะตอนตั้ง/เปลี่ยนใหม่) ── */
function Sec_passwordPolicy_(pw) {
  pw = String(pw || '');
  if (pw.length < 6) return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
  if (/^(123456|password|qwerty|111111|000000)$/i.test(pw)) return 'รหัสผ่านคาดเดาง่ายเกินไป';
  return '';
}
function Sec_requirePassword_(pw) { var e = Sec_passwordPolicy_(pw); if (e) throw new Error(e); }
function Sec_tempPassword_() {
  var src = Utilities.getUuid().replace(/[^a-z0-9]/gi, '');
  return (src.substring(0, 6) + Math.floor(1000 + (new Date().getTime() % 9000))).substring(0, 10);
}

/* ── last-admin protection ── */
function Sec_activeAdminCount_() {
  return DB_readAll(SHEETS.USERS).filter(function (u) { return u.role === 'admin' && _yes_(u.is_active); }).length;
}
