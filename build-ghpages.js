#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   SAB · build-ghpages.js — รวม Styles/Scripts จากไฟล์ GAS → gh-pages/index.html
   ใช้:  node build-ghpages.js "<WEBAPP_URL>"
   (WEBAPP_URL = ลิงก์ Deploy Web App ลงท้าย /exec — เว้นว่างได้ แล้วแก้ในไฟล์ทีหลัง)
   ═══════════════════════════════════════════════════════════════ */
var fs = require('fs');
var path = require('path');
var DIR = __dirname;
var WEBAPP_URL = process.argv[2] || '__WEBAPP_URL__';

function read(f) { return fs.readFileSync(path.join(DIR, f), 'utf8'); }
function pickScript(html, marker) {
  var re = new RegExp('<script[^>]*' + marker + '[^>]*>([\\s\\S]*?)<\\/script>');
  var m = html.match(re);
  if (!m) throw new Error('ไม่พบ script ' + marker);
  return m[1];
}
function pickTrailingStyle(html) {
  // ดึงเฉพาะ <style> ที่อยู่ "หลัง </script> ตัวสุดท้าย" — กัน <style> ที่อยู่ในสตริง JS (เช่น printReport)
  var idx = html.lastIndexOf('</script>');
  var after = idx >= 0 ? html.substring(idx + 9) : html;
  var m = after.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
}

var styles = read('Styles.html');                 // <style>..</style>
var styles2 = read('Styles2.html');               // <style>..</style>
var coreJs = pickScript(read('ScriptsCore.html'), 'x-sab-core');
var pagesHtml = read('ScriptsPages.html');
var pagesJs = pickScript(pagesHtml, 'x-sab-pages');
var pagesStyle = pickTrailingStyle(pagesHtml);

var out = '<!DOCTYPE html>\n<html lang="th">\n<head>\n'
  + '<meta charset="UTF-8">\n'
  + '<title>ระบบเช็คชื่อนักเรียนด้วยบาร์โค้ด</title>\n'
  + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  + '<meta name="theme-color" content="#0a84ff">\n'
  + '<link rel="manifest" href="manifest.webmanifest">\n'
  + '<meta name="apple-mobile-web-app-capable" content="yes">\n'
  + '<meta name="mobile-web-app-capable" content="yes">\n'
  + '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n'
  + '<meta name="apple-mobile-web-app-title" content="เช็คชื่อ">\n'
  + '<link rel="apple-touch-icon" href="icon-192.png">\n'
  + '<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">\n'
  + '<link rel="icon" type="image/svg+xml" href="icon.svg">\n'
  + '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
  + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
  + '<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700;800&family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">\n'
  + '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">\n'
  + '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">\n'
  + '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">\n'
  + '<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>\n'
  + styles + '\n' + styles2 + '\n<style>' + pagesStyle + '</style>\n'
  + '</head>\n<body class="sab-doc">\n'
  + '<div id="boot-loader" class="boot-loader"><div class="boot-card"><div class="boot-ring"><i class="bi bi-upc-scan"></i></div>'
  + '<div class="boot-name">ระบบเช็คชื่อนักเรียน</div><div id="bl-text" class="boot-text">กำลังเริ่มต้นระบบ…</div>'
  + '<div class="boot-dots"><span></span><span></span><span></span></div></div></div>\n'
  + '<div id="app-root"></div>\n<div id="modal-host"></div>\n<div id="spin-host"></div>\n<div id="toast-host"></div>\n'
  + '<script>window.SAB_API_URL = ' + JSON.stringify(WEBAPP_URL) + ';</script>\n'
  + '<script>\n' + coreJs + '\n</scr' + 'ipt>\n'
  + '<script>\n' + pagesJs + '\n</scr' + 'ipt>\n'
  + '<script>(function(){function go(){if(window.SAB&&SAB.boot)SAB.boot();else document.getElementById("bl-text").textContent="โหลดสคริปต์ไม่สำเร็จ";}'
  + 'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();</scr' + 'ipt>\n'
  + '<script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}</scr' + 'ipt>\n'
  + '</body>\n</html>\n';

var destDir = path.join(DIR, 'gh-pages');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir);
fs.writeFileSync(path.join(destDir, 'index.html'), out, 'utf8');
console.log('✓ สร้าง gh-pages/index.html (' + Math.round(out.length / 1024) + ' KB)');
console.log('  WEBAPP_URL = ' + WEBAPP_URL);
if (WEBAPP_URL === '__WEBAPP_URL__') console.log('  ⚠ ยังไม่ใส่ URL — แก้ window.SAB_API_URL ในไฟล์ หรือรันใหม่: node build-ghpages.js "<URL>/exec"');
