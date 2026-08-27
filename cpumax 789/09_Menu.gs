/**
 * ═══════════════════════════════════════════════════════════════
 *  SAB · ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด
 *  File:        09_Menu.gs — Sheet menu · grant/diagnostic · About · Install guide · User manual · triggers
 *  Version:     1.0.0
 *  Last Update: 2026-06-19
 *  Developer:   ครูวิรัตน์  หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('🎯 ' + APP.SHORT)
      .addItem('🚀 เริ่มใช้งานระบบ (Initialize)', 'menu_initSystem')
      .addItem('🔐 ขออนุญาตสิทธิ์', 'menu_grantPermissions')
      .addItem('🔍 ตรวจสถานะสิทธิ์', 'menu_authorize')
      .addSeparator()
      .addItem('🌱 เพิ่มข้อมูลตัวอย่าง', 'menu_seedDemo')
      .addItem('🧹 ล้างข้อมูลตัวอย่าง', 'menu_clearDemo')
      .addItem('🔑 รีเซ็ตรหัสผ่าน Demo', 'menu_resetDemoPasswords')
      .addItem('🔧 ซ่อมค่าตั้งค่า (Settings)', 'menu_repairSettings')
      .addSeparator()
      .addItem('⚡ ติดตั้ง Warm/GC Trigger', 'menu_installTriggers')
      .addItem('🔗 เปิด Web App URL', 'menu_openWebApp')
      .addSeparator()
      .addItem('📘 คู่มือการติดตั้งระบบ', 'menu_installGuide')
      .addItem('📖 คู่มือการใช้งาน', 'menu_userManual')
      .addItem('ℹ️ เกี่ยวกับระบบ (About)', 'menu_about')
      .addToUi();
  } catch (e) {}
}

function menu_repairSettings() { var n = Settings_repair(); var ui = _ui_(); if (ui) ui.alert('ซ่อมแล้ว ' + n.fixed + ' รายการ'); }

/* ── grant: ปล่อย error ลอยให้ GAS แสดง consent ── */
function menu_grantPermissions() {
  SpreadsheetApp.getActive().getName();
  DriveApp.getRootFolder().getName();
  Session.getActiveUser().getEmail();
  ScriptApp.getService().getUrl();
  UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true });
  var ui = _ui_(); if (ui) ui.alert('✅ พร้อมใช้งาน', 'ระบบได้รับสิทธิ์ครบแล้ว — ใช้อัปโหลดรูป / Telegram ได้', ui.ButtonSet.OK);
}
/* ── diagnostic: มี try/catch (ไม่ trigger consent) ── */
function menu_authorize() {
  var out = [];
  function chk(label, fn) { try { fn(); out.push('✓ ' + label); } catch (e) { out.push('✗ ' + label + ': ' + e.message); } }
  chk('Spreadsheets', function () { SpreadsheetApp.getActive().getName(); });
  chk('Drive', function () { DriveApp.getRootFolder().getName(); });
  chk('External Request', function () { UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true }); });
  chk('Script Service', function () { ScriptApp.getService().getUrl(); });
  chk('User Info', function () { Session.getActiveUser().getEmail(); });
  var ui = _ui_(); if (ui) ui.alert('สถานะสิทธิ์', out.join('\n') + '\n\n(ถ้ามี ✗ กด "🔐 ขออนุญาตสิทธิ์")', ui.ButtonSet.OK);
}

function menu_openWebApp() {
  var ui = _ui_(); var url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) {}
  if (ui) ui.alert('Web App URL', url ? url : 'ยัง Deploy ไม่สำเร็จ — Deploy > New deployment > Web app', ui.ButtonSet.OK);
}

/* ── Warm + GC trigger ── */
function _warm_() {
  _resetReq_();
  try { DB_readAll(SHEETS.SETTINGS); DB_readAll(SHEETS.USERS); App_publicBundle_(); } catch (e) {}
  return new Date().toISOString();
}
function _gc_() { _resetReq_(); try { Auth_gc_(); } catch (e) {} }
function menu_installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (/^(_warm_|_gc_)$/.test(t.getHandlerFunction())) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('_warm_').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('_gc_').timeBased().everyHours(6).create();
  var ui = _ui_(); if (ui) ui.alert('⚡ ติดตั้งแล้ว', 'Warm trigger ทุก 5 นาที + GC ทุก 6 ชม.', ui.ButtonSet.OK);
}

/* ══════════════ About ══════════════ */
function menu_about() {
  var d = APP.DEV;
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700;800&family=Sarabun:wght@400;500&display=swap" rel="stylesheet">'
    + '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">'
    + '<style>body{margin:0;font-family:Kanit,Sarabun,system-ui,sans-serif;color:#1d1d1f;background:#f5f5f7}'
    + '.ab{padding:24px}.ab-h{display:flex;align-items:center;gap:14px;padding-bottom:16px;border-bottom:1px solid #e2e2e7;margin-bottom:16px}'
    + '.ab-lg{width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,#0a84ff,#5e5ce6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:30px;box-shadow:0 8px 24px rgba(10,132,255,.35)}'
    + '.ab-t{font-size:20px;font-weight:800}.ab-v{display:inline-block;padding:2px 10px;background:linear-gradient(135deg,#0a84ff,#5e5ce6);color:#fff;border-radius:99px;font-size:11px;font-weight:700;margin-top:4px}'
    + '.ab-d{font-size:13px;line-height:1.6;color:#3a3a3c;margin-bottom:14px}.ab-m{font-size:12px;color:#6e6e73;margin-bottom:14px;line-height:1.9}'
    + '.ab-dev{display:flex;align-items:center;gap:14px;padding:14px;background:#fff;border:1px solid #e2e2e7;border-radius:14px;text-decoration:none;color:inherit;margin-bottom:14px}'
    + '.ab-dev:hover{border-color:#0a84ff;box-shadow:0 8px 20px rgba(10,132,255,.15)}'
    + '.ab-ph{width:56px;height:56px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 12px rgba(10,132,255,.3);object-fit:cover}'
    + '.ab-nm{font-size:15px;font-weight:700}.ab-lk{font-size:12px;color:#0a84ff;font-weight:600;margin-top:3px}'
    + '.ab-tech{font-size:11px;color:#6e6e73;background:#fff;padding:10px 12px;border-radius:10px;border-left:3px solid #0a84ff}'
    + '.ab-btn{padding:9px 18px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:0;background:linear-gradient(135deg,#0a84ff,#5e5ce6);color:#fff;font-family:inherit;margin-top:16px}</style></head><body>'
    + '<div class="ab"><div class="ab-h"><div class="ab-lg"><i class="bi bi-' + APP.LOGO_ICON + '"></i></div>'
    + '<div><div class="ab-t">' + esc_(APP.NAME) + '</div><span class="ab-v">v' + APP.VERSION + '</span></div></div>'
    + '<div class="ab-d">' + esc_(APP.DESCRIPTION) + '</div>'
    + '<div class="ab-m">📅 <b>อัปเดตล่าสุด:</b> ' + APP.LAST_UPDATED + '<br>🏢 <b>องค์กร:</b> ' + esc_(APP.ORG) + '</div>'
    + '<a class="ab-dev" href="' + d.URL + '" target="_blank" rel="noopener noreferrer">'
    + '<img class="ab-ph" src="' + d.LOGO + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">'
    + '<div><div style="font-size:11px;color:#6e6e73;text-transform:uppercase">ผู้พัฒนาระบบ</div><div class="ab-nm">' + esc_(d.NAME) + '</div>'
    + '<div class="ab-lk"><i class="bi bi-globe"></i> ' + d.URL.replace(/^https?:\/\//, '').replace(/\/$/, '') + '</div></div>'
    + '<i class="bi bi-arrow-up-right" style="color:#0a84ff;font-size:18px;margin-left:auto"></i></a>'
    + '<div class="ab-tech">🔧 Google Apps Script · V8 · Sheets-as-DB · HTML/CSS/JS SPA</div>'
    + '<button class="ab-btn" onclick="google.script.host.close()">ปิด</button></div></body></html>';
  var ui = _ui_(); if (ui) ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(440).setHeight(560), 'เกี่ยวกับ ' + APP.SHORT);
}

/* ══════════════ Install Guide ══════════════ */
function menu_installGuide() {
  var installed = DB_count(SHEETS.USERS) > 0;
  var webUrl = ''; try { webUrl = ScriptApp.getService().getUrl(); } catch (e) {}
  var ss = _ss_();
  var steps = [
    ['1', 'bi-shield-lock', 'ขออนุญาตสิทธิ์', 'เมนู 🎯 ' + APP.SHORT + ' → <b>ขออนุญาตสิทธิ์</b> → กด Continue → Allow', 'ครั้งแรกเท่านั้น เพื่อให้ระบบเข้าถึง Sheet/Drive/อินเทอร์เน็ตได้'],
    ['2', 'bi-rocket-takeoff', 'เริ่มใช้งานระบบ', 'เมนู → <b>เริ่มใช้งานระบบ</b> สร้างชีต + ค่าตั้งต้น + บัญชี admin/teacher (รหัส 123456)', 'รันครั้งเดียวตอนติดตั้ง'],
    ['3', 'bi-box-arrow-up-right', 'Deploy Web App', 'Deploy → New deployment → เลือก <b>Web app</b> → Execute as: Me → Who has access: Anyone → Deploy → คัดลอก URL', 'นำ URL ไปเปิด/แชร์ให้ครูใช้งานบนมือถือ'],
    ['4', 'bi-lightning-charge', 'ติดตั้ง Warm Trigger', 'เมนู → <b>ติดตั้ง Warm/GC Trigger</b> เพื่อให้เปิดเร็ว ไม่ค้าง', 'แนะนำมากเพื่อความเร็วระดับ Production'],
    ['5', 'bi-gear', 'ตั้งค่าระบบ', 'เข้าเว็บแอป → ตั้งค่า → ใส่ชื่อโรงเรียน/โลโก้ · ปรับเวลามาแถว/สาย · ปิด Demo Users ก่อนใช้จริง', 'ตั้งค่าผ่านหน้าเว็บได้ทันที ไม่ต้องแก้โค้ด'],
    ['6', 'bi-people', 'นำเข้านักเรียน + เพิ่มครู', 'นำเข้านักเรียนจาก Excel/CSV (มีแม่แบบ) · เพิ่มบัญชีครูประจำชั้น', 'หรือกด "เพิ่มข้อมูลตัวอย่าง" เพื่อทดสอบก่อน'],
    ['7', 'bi-check2-circle', 'พร้อมใช้งาน', 'ทดลอง flow: เลือกห้อง → สแกน/พิมพ์รหัส → ดูรายงาน', 'ทดสอบครบทุกบทบาทก่อน Production']
  ];
  var stepHtml = steps.map(function (s) {
    return '<div class="ig-step"><div class="ig-no"><i class="bi ' + s[1] + '"></i></div><div class="ig-body">'
      + '<div class="ig-t">' + s[0] + '. ' + s[2] + '</div><div class="ig-d">' + s[3] + '</div>'
      + '<div class="ig-tip"><i class="bi bi-lightbulb"></i> ' + s[4] + '</div></div></div>';
  }).join('');
  var checklist = ['เปลี่ยนรหัสผ่าน admin', 'ปิด Demo Users', 'ตั้งชื่อโรงเรียน + โลโก้', 'ตรวจช่วงเวลามาแถว/สาย', 'เพิ่มครู + นำเข้านักเรียนจริง', 'ติดตั้ง Warm Trigger', 'ทดสอบทุกบทบาท']
    .map(function (c) { return '<li><i class="bi bi-check-circle"></i> ' + c + '</li>'; }).join('');

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + _guideHead_('คู่มือการติดตั้ง')
    + '<style>' + _guideCSS_()
    + '.ig-status{display:flex;gap:8px;margin:12px 0;flex-wrap:wrap}.ig-badge{padding:6px 12px;border-radius:99px;font-size:12px;font-weight:700}'
    + '.ig-ok{background:#e3f9e9;color:#1a7f37}.ig-warn{background:#fff4e0;color:#9a6700}'
    + '.ig-step{display:flex;gap:14px;padding:14px;background:#fff;border:1px solid #e2e2e7;border-radius:14px;margin-bottom:12px}'
    + '.ig-no{flex:0 0 44px;height:44px;border-radius:13px;background:linear-gradient(135deg,#0a84ff,#5e5ce6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px}'
    + '.ig-t{font-weight:700;font-size:15px;margin-bottom:4px}.ig-d{font-size:13px;color:#3a3a3c;line-height:1.6}'
    + '.ig-tip{margin-top:8px;font-size:12px;background:#fffbea;border-left:3px solid #ff9f0a;padding:8px 10px;border-radius:8px;color:#7a5b00}'
    + '.ig-check{background:#e3f9e9;border:1px solid #b6ebc4;border-radius:14px;padding:16px;margin-top:8px}'
    + '.ig-check h3{margin:0 0 10px;font-size:15px;color:#1a7f37}.ig-check ul{list-style:none;padding:0;margin:0}'
    + '.ig-check li{font-size:13px;padding:5px 0;color:#1a4d2e}.ig-check i{color:#1a7f37;margin-right:6px}'
    + '.ig-info{background:#eef4ff;border:1px solid #cfe0ff;border-radius:12px;padding:12px;font-size:12px;color:#1a4480;margin:12px 0;word-break:break-all}</style></head><body>'
    + '<div class="g-hero"><div class="g-hero-ic"><i class="bi bi-journal-check"></i></div><div><div class="g-hero-t">คู่มือการติดตั้งระบบ</div><div class="g-hero-s">' + esc_(APP.NAME) + ' · v' + APP.VERSION + '</div></div></div>'
    + '<div class="g-body">'
    + '<div class="ig-status">' + (installed ? '<span class="ig-badge ig-ok"><i class="bi bi-check-circle-fill"></i> ติดตั้งแล้ว</span>' : '<span class="ig-badge ig-warn"><i class="bi bi-exclamation-triangle-fill"></i> ยังไม่ติดตั้ง</span>')
    + (webUrl ? '<span class="ig-badge ig-ok"><i class="bi bi-globe"></i> Web App พร้อม</span>' : '<span class="ig-badge ig-warn"><i class="bi bi-globe"></i> ยังไม่ Deploy</span>') + '</div>'
    + '<div class="ig-info"><b>Spreadsheet:</b> ' + esc_(ss.getName()) + (webUrl ? '<br><b>Web App URL:</b> ' + esc_(webUrl) : '') + '</div>'
    + stepHtml
    + '<div class="ig-check"><h3><i class="bi bi-clipboard-check"></i> ตรวจก่อนใช้งานจริง (Production)</h3><ul>' + checklist + '</ul></div>'
    + _guideFoot_()
    + '</div></body></html>';
  var ui = _ui_(); if (ui) ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(820).setHeight(720), 'คู่มือการติดตั้ง');
}

/* ══════════════ User Manual ══════════════ */
function menu_userManual() {
  var secs = [
    ['overview', 'bi-grid-1x2', 'ภาพรวมระบบ', '<p>ระบบเช็คชื่อนักเรียนหน้าเสาธงด้วยการสแกนบาร์โค้ด รองรับ 15 ห้อง กำหนดสถานะอัตโนมัติตามเวลา และสรุปรายงานเป็น %</p><div class="um-grid"><div class="um-card"><i class="bi bi-upc-scan"></i><b>สแกนบาร์โค้ด</b><span>เปิดกล้องสแกนบัตรนักเรียน หรือถ่ายภาพ/พิมพ์รหัสแทน</span></div><div class="um-card"><i class="bi bi-clock-history"></i><b>สถานะอัตโนมัติ</b><span>มาแถว/มาสาย/ขาดแถว ตามเวลาจริง · ลา กำหนดเอง</span></div><div class="um-card"><i class="bi bi-bar-chart"></i><b>รายงาน %</b><span>รายห้อง + รายบุคคล ดาวน์โหลด Excel/CSV/PDF</span></div></div>'],
    ['login', 'bi-box-arrow-in-right', 'การเข้าสู่ระบบ', '<p>เปิด Web App URL บนมือถือ → ใส่ชื่อผู้ใช้/รหัสผ่าน หรือคลิกบัญชีทดลอง</p><table class="um-tb"><tr><th>บทบาท</th><th>สิทธิ์</th></tr><tr><td>ผู้ดูแลระบบ</td><td>จัดการนักเรียน/ผู้ใช้/ตั้งค่า + เช็คชื่อ + รายงานทุกห้อง</td></tr><tr><td>ครู</td><td>เช็คชื่อ + ดูรายงานทุกห้อง</td></tr></table>'],
    ['checkin', 'bi-upc-scan', 'การเช็คชื่อ (สำคัญ)', '<ol class="um-ol"><li>เลือก <b>ห้องเรียน</b> จากการ์ด 15 ห้อง (วงกลมแดง=ยังไม่ครบ, เขียว=ครบ)</li><li>กด <b>สแกน</b> เพื่อเปิดกล้อง · หรือ <b>ถ่ายภาพบาร์โค้ด</b> · หรือ <b>พิมพ์/ค้นหา</b> รหัส-ชื่อ</li><li>ระบบจับเวลาให้สถานะอัตโนมัติ (มาแถว/สาย/ขาด)</li><li>กด <b>ลา</b> ที่รายชื่อเพื่อกำหนดสถานะลาด้วยมือ</li></ol><div class="um-tip"><i class="bi bi-lightbulb"></i> ถ้ากล้องเปิดไม่ได้ (บางอุปกรณ์) ให้ใช้ "ถ่ายภาพ" หรือ "พิมพ์รหัส" แทนได้ทันที</div>'],
    ['status', 'bi-palette', 'สถานะ 4 แบบ', '<div class="um-leg"><div><span class="dot" style="background:#34c759"></span> <b>มาแถว</b> 06:50–08:30</div><div><span class="dot" style="background:#ff9f0a"></span> <b>มาสาย</b> 08:31–08:40</div><div><span class="dot" style="background:#ff3b30"></span> <b>ขาดแถว</b> 08:41 เป็นต้นไป</div><div><span class="dot" style="background:#5e5ce6"></span> <b>ลา</b> ครูกำหนดเอง</div></div>'],
    ['students', 'bi-people', 'จัดการนักเรียน (admin)', '<p>เพิ่ม/แก้ไขนักเรียน หรือนำเข้าจาก Excel/CSV (มีแม่แบบให้)</p><ol class="um-ol"><li>เมนู นักเรียน → นำเข้า → ดาวน์โหลดแม่แบบ → กรอก → อัปโหลด</li><li>ระบบจับคู่หัวคอลัมน์อัตโนมัติ + แสดงตัวอย่างก่อนนำเข้า</li></ol>'],
    ['reports', 'bi-graph-up', 'รายงาน', '<p>เลือกห้อง + ช่วงวันที่ → ดูสรุป % รายห้อง/รายบุคคล → พิมพ์ PDF หรือส่งออก Excel/CSV</p>'],
    ['profile', 'bi-person-gear', 'โปรไฟล์', '<p>แก้ไขข้อมูลส่วนตัว อัปโหลดรูป และเปลี่ยนรหัสผ่านได้ที่เมนูโปรไฟล์</p>'],
    ['faq', 'bi-question-circle', 'คำถามที่พบบ่อย', '<details open><summary>กล้องสแกนเปิดไม่ได้?</summary><p>บางอุปกรณ์/เบราว์เซอร์จำกัดสิทธิ์กล้องในกรอบ — ใช้ปุ่ม "ถ่ายภาพบาร์โค้ด" หรือ "พิมพ์รหัส" แทนได้ทันที ระบบทำงานครบทุกฟังก์ชัน</p></details><details><summary>เช็คผิดแก้ได้ไหม?</summary><p>ได้ — กดที่รายชื่อแล้วเลือกสถานะใหม่ หรือยกเลิกการเช็คได้</p></details><details><summary>เปลี่ยนเวลามาแถว/สายได้ไหม?</summary><p>ได้ — admin ปรับที่หน้าตั้งค่า มีผลทันที</p></details><details><summary>ลืมรหัสผ่าน?</summary><p>ติดต่อ admin เพื่อรีเซ็ต หรือใช้เมนูในชีต "รีเซ็ตรหัสผ่าน Demo"</p></details>']
  ];
  var tabs = secs.map(function (s) { return '<a class="um-tab" data-um="' + s[0] + '"><i class="bi ' + s[1] + '"></i> ' + s[2] + '</a>'; }).join('');
  var panes = secs.map(function (s) { return '<section class="um-sec" id="um-' + s[0] + '"><h2><i class="bi ' + s[1] + '"></i> ' + s[2] + '</h2>' + s[3] + '</section>'; }).join('');
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + _guideHead_('คู่มือการใช้งาน')
    + '<style>' + _guideCSS_()
    + '.um-wrap{display:flex;gap:0;height:calc(100vh - 120px);min-height:420px}'
    + '.um-nav{flex:0 0 220px;border-right:1px solid #e2e2e7;overflow:auto;padding:8px}'
    + '.um-tab{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;font-size:13px;color:#3a3a3c;cursor:pointer;margin-bottom:2px}'
    + '.um-tab:hover{background:#f0f0f3}.um-tab.on{background:linear-gradient(135deg,#0a84ff,#5e5ce6);color:#fff}'
    + '.um-content{flex:1;overflow:auto;padding:18px 22px}.um-sec{display:none}.um-sec.on{display:block}'
    + '.um-sec h2{font-size:18px;margin:0 0 14px;display:flex;align-items:center;gap:8px;color:#0a84ff}'
    + '.um-sec p{font-size:13px;line-height:1.7;color:#3a3a3c}.um-ol{font-size:13px;line-height:1.9;padding-left:20px}'
    + '.um-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:12px}'
    + '.um-card{background:#fff;border:1px solid #e2e2e7;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:5px}'
    + '.um-card i{font-size:24px;color:#0a84ff}.um-card b{font-size:13px}.um-card span{font-size:11px;color:#6e6e73}'
    + '.um-tb{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}.um-tb th,.um-tb td{border:1px solid #e2e2e7;padding:8px;text-align:left}.um-tb th{background:#f0f0f3}'
    + '.um-tip{margin-top:10px;font-size:12px;background:#fffbea;border-left:3px solid #ff9f0a;padding:9px 11px;border-radius:8px;color:#7a5b00}'
    + '.um-leg{display:grid;gap:10px;font-size:13px}.um-leg .dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;vertical-align:middle}'
    + 'details{background:#fff;border:1px solid #e2e2e7;border-radius:10px;padding:10px 12px;margin-bottom:8px}summary{font-weight:600;font-size:13px;cursor:pointer}details p{margin:8px 0 0;font-size:12px;color:#6e6e73}'
    + '@media(max-width:640px){.um-wrap{flex-direction:column;height:auto}.um-nav{flex:none;border-right:0;border-bottom:1px solid #e2e2e7;display:flex;overflow-x:auto;gap:6px}.um-tab{white-space:nowrap}}</style></head><body>'
    + '<div class="g-hero"><div class="g-hero-ic"><i class="bi bi-book"></i></div><div><div class="g-hero-t">คู่มือการใช้งาน</div><div class="g-hero-s">' + esc_(APP.NAME) + '</div></div></div>'
    + '<div class="um-wrap"><div class="um-nav">' + tabs + '</div><div class="um-content">' + panes + _guideFoot_() + '</div></div>'
    + '<script>(function(){var tabs=document.querySelectorAll(".um-tab"),secs=document.querySelectorAll(".um-sec");function show(id){tabs.forEach(function(t){t.classList.toggle("on",t.getAttribute("data-um")===id)});secs.forEach(function(s){s.classList.toggle("on",s.id==="um-"+id)})}tabs.forEach(function(t){t.addEventListener("click",function(){show(t.getAttribute("data-um"))})});show("overview");})();</scr'+'ipt>'
    + '</body></html>';
  var ui = _ui_(); if (ui) ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(1000).setHeight(720), 'คู่มือการใช้งาน');
}

function _guideHead_(t) {
  return '<title>' + esc_(t) + '</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;800&family=Sarabun:wght@400;500&display=swap" rel="stylesheet">'
    + '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">';
}
function _guideCSS_() {
  return 'body{margin:0;font-family:Kanit,Sarabun,system-ui,sans-serif;color:#1d1d1f;background:#f5f5f7}'
    + '.g-hero{background:linear-gradient(135deg,#0a84ff,#5e5ce6);color:#fff;padding:20px 24px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden}'
    + '.g-hero::after{content:"";position:absolute;top:-40%;right:-5%;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.18),transparent 60%);pointer-events:none}'
    + '.g-hero-ic{width:52px;height:52px;border-radius:15px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:26px}'
    + '.g-hero-t{font-size:20px;font-weight:800}.g-hero-s{font-size:13px;opacity:.9}'
    + '.g-body{padding:20px 24px}'
    + '.g-foot{margin-top:18px;padding-top:14px;border-top:1px solid #e2e2e7;font-size:11px;color:#6e6e73;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}'
    + '.g-foot a{color:#0a84ff;text-decoration:none}';
}
function _guideFoot_() {
  return '<div class="g-foot"><span>' + new Date().getFullYear() + ' © ' + esc_(APP.NAME) + ' v' + APP.VERSION + '</span>'
    + '<span>ผู้พัฒนา: <a href="' + APP.DEV.URL + '" target="_blank" rel="noopener noreferrer">' + esc_(APP.DEV.NAME) + '</a></span></div>';
}
