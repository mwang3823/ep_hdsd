/* ===== HDSD engine: danh mục, đa ngôn ngữ, trình phát từng bước (con trỏ + bong bóng giải thích) ===== */
(function () {
  const H = window.HDSD = { guides: [], lang: 'vi' };
  if (/[?&]lang=en\b/.test(location.search)) H.lang = 'en'; // mặc định luôn là tiếng Việt khi vào trang
  const tr = H.tr = (x) => (x == null ? '' : Array.isArray(x) ? (H.lang === 'en' && x[1] != null ? x[1] : x[0]) : String(x));
  const L = (vi, en) => (H.lang === 'en' ? en : vi);
  const esc = H.esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const strip = (s) => String(s || '').replace(/<[^>]+>/g, '');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const $ = (id) => document.getElementById(id);
  H.add = (g) => { H.guides.push(g); };

  const TIERS = [
    [1, 't1', ['Chức năng chủ yếu', 'Core functions'], ['Luồng chính từ cấu hình đến tính lương — nên xem theo thứ tự', 'The main flow from configuration to payroll — best viewed in order']],
    [2, 't2', ['Chức năng quan trọng', 'Important functions'], ['Dùng thường xuyên để điều chỉnh và xử lý tình huống', 'Used regularly for adjustments and special cases']],
    [3, 't3', ['Chức năng bổ trợ', 'Supporting functions'], ['Tra cứu, báo cáo và thiết lập phụ', 'Look-ups, reports and secondary settings']]
  ];
  const FLOW = [
    ['cfg-general', 'web', ['Cấu hình nền', 'Base config'], ['Ngưỡng trễ/sớm, điểm wifi/GPS', 'Late/early thresholds, wifi/GPS points']],
    ['shift', 'web', ['Tạo mẫu ca', 'Create shift'], ['Giờ ca, nghỉ trưa, hệ số công', 'Hours, lunch break, coefficient']],
    ['tws-add', 'web', ['Xếp lịch', 'Schedule'], ['Gán ca cho nhân viên theo ngày', 'Assign shifts to staff by day']],
    ['approve', 'app', ['Duyệt lịch', 'Approve'], ['Chờ duyệt → Đã duyệt', 'Pending → Approved']],
    ['checkin', 'app', ['Chấm công', 'Check in/out'], ['Giờ vào → Giờ ra trên app', 'Clock in → clock out in the app']],
    ['change-shift', 'app', ['Điều chỉnh', 'Adjust'], ['Đổi ca, trễ/sớm, OT, chấm hộ', 'Shift change, late/early, OT, proxy']],
    ['confirm', 'app', ['Xác nhận giờ', 'Confirm hours'], ['Chờ xác nhận → Đã xác nhận', 'Pending → Confirmed']],
    ['timesheet', 'web', ['Báo cáo & lương', 'Reports & payroll'], ['Bảng chấm công, liên kết lương', 'Timesheet, payroll link']]
  ];
  const SKIPPED = [
    ['Thêm ca cho 1 nhân viên cả tuần/tháng (Web) — có khả năng đang lỗi', 'Add a shift to one employee for the whole week/month (Web) — likely broken'],
    ['Lịch làm việc mẫu / Phân ca (Web) — đã bị ẩn khỏi menu, dữ liệu sinh ra thiếu thông tin', 'Schedule templates / bulk assignment (Web) — hidden from the menu, generated data is incomplete'],
    ['Tạo ca làm thêm giờ trên Web — không lưu được trạng thái (hướng dẫn OT chỉ dùng App)', 'Creating overtime on the Web — status is not saved (the OT guide uses the App only)'],
    ['Sửa ngày phép còn lại — nút không hoạt động (chỉ hướng dẫn phần xem)', 'Editing remaining leave days — the button does nothing (only viewing is covered)'],
    ['Cấu hình thông báo chấm công, "Nhắc nhở chấm công" — không có tác dụng', 'Attendance notification settings, "Check-in reminder" — have no effect'],
    ['Popup "Check out" hộ ở màn Lịch sử chấm công — không mở được', 'Proxy "Check out" popup on the Attendance history screen — does not open'],
    ['TimeSheet, xuất lịch sử check-in/out, nhập phiếu lương, báo cáo phép năm, báo cáo thời gian thực tế, xuất lịch tuần/tháng — không chạy', 'TimeSheet, check-in/out export, payslip import, annual leave report, actual-time report, weekly/monthly schedule export — do not run'],
    ['Đơn nghỉ phép nhiều cấp — cập nhật ca sai (ngay từ cấp 1, duyệt trên app không cập nhật ca)', 'Multi-level leave requests — shifts are updated incorrectly (at level 1; app approval does not update the shift)'],
    ['Báo cáo Report Studio (nhúng ngoài), quy tắc Rate (không có màn hình cấu hình)', 'Report Studio (embedded externally), Rate rules (no configuration screen)']
  ];

  const sorted = () => H.guides.slice().sort((a, b) => a.tier - b.tier);
  const chTags = (g) => g.ch.map((c) => '<span class="tag ' + c + '">' + (c === 'web' ? 'Web' : 'App') + '</span>').join(' ');
  let Q = '';
  const match = (g) => { if (!Q) return true; const q = Q.toLowerCase(); return [g.title[0], g.title[1], g.sum[0], g.sum[1], g.id].join(' ').toLowerCase().includes(q); };

  /* ---------- thanh trên + menu trái ---------- */
  function renderTop() {
    $('top').innerHTML = '<button class="menu-btn" data-c="nav">☰</button><a class="brand" href="#">📘 ' + L('HDSD Chấm công', 'Timekeeping User Guide') + ' <small>Matthews</small></a>' +
      '<div class="search"><input id="q" placeholder="' + L('Tìm chức năng… (vd: đổi ca, chấm công hộ)', 'Search a function… (e.g. shift change, proxy)') + '" value="' + esc(Q) + '"></div><span class="sp"></span>' +
      '<a class="lnk" href="rule/">🧪 ' + L('Mô phỏng rule', 'Rule simulator') + '</a>' +
      '<div class="lang"><button class="' + (H.lang === 'vi' ? 'on' : '') + '" data-c="lang" data-v="vi">Tiếng Việt</button><button class="' + (H.lang === 'en' ? 'on' : '') + '" data-c="lang" data-v="en">English</button></div>';
  }
  function renderSide() {
    const all = sorted(); let n = 0; let html = '<a class="home ' + (P.g ? '' : 'on') + '" href="#">🏠 ' + L('Tất cả chức năng', 'All functions') + '</a>';
    TIERS.forEach(([t, cls, name]) => {
      const list = all.filter((g) => g.tier === t);
      const shown = list.filter(match);
      if (shown.length) html += '<h4><i class="' + cls + '"></i>' + tr(name) + '</h4>';
      list.forEach((g) => { n++; if (match(g)) html += '<a class="gi ' + (P.g === g ? 'on' : '') + '" href="#' + g.id + '"><span class="ic">' + g.icon + '</span><span class="nm">' + tr(g.title) + '</span><span class="n">' + n + '</span></a>'; });
    });
    if (!all.some(match)) html += '<div class="none">' + L('Không tìm thấy chức năng phù hợp.', 'No matching function.') + '</div>';
    $('side').innerHTML = html;
    const on = $('side').querySelector('.gi.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- trang chủ ---------- */
  function renderHome() {
    const all = sorted(); let n = 0;
    let html = '<div class="hero"><h1>' + L('Hướng dẫn sử dụng module Chấm công', 'Timekeeping module user guide') + '</h1><p>' +
      L('Chọn một chức năng để xem mô phỏng giao diện Web quản trị và App nhân viên. Con trỏ sẽ thao tác từng bước kèm giải thích và rule đang chạy trên hệ thống.', 'Pick a function to see a simulation of the admin Web and the staff App. The pointer performs each step with an explanation and the rule currently enforced by the system.') +
      '</p><div class="how"><span>▶ ' + L('Xem tự động', 'Watch automatically') + '</span><span>✋ ' + L('Tự thao tác theo vùng sáng', 'Do it yourself by clicking the highlight') + '</span><span>🖥 Web ⇄ 📱 App</span><span>VI / EN</span></div></div>';
    if (!Q) {
      html += '<div class="sec-h"><h2>' + L('Luồng tổng thể', 'Overall flow') + '</h2><small>' + L('Bấm vào một bước để xem hướng dẫn', 'Click a step to open its guide') + '</small></div><div class="flow8">' +
        FLOW.map(([id, w, t, s], i) => '<a class="' + w + '" href="#' + id + '"><span class="n">' + L('Bước', 'Step') + ' ' + (i + 1) + '</span><b>' + tr(t) + '</b><small>' + tr(s) + '</small></a>').join('') + '</div>';
    }
    TIERS.forEach(([t, cls, name, desc]) => {
      const list = all.filter((g) => g.tier === t); const base = n; n += list.length;
      const shown = list.filter(match); if (!shown.length) return;
      html += '<div class="sec-h"><h2><i class="' + cls + '"></i>' + tr(name) + ' (' + list.length + ')</h2><small>' + tr(desc) + '</small></div><div class="cards">' +
        shown.map((g) => '<a class="gcard" href="#' + g.id + '"><div class="hd"><div class="ic">' + g.icon + '</div><b>' + (base + list.indexOf(g) + 1) + '. ' + tr(g.title) + '</b></div><p>' + tr(g.sum) + '</p><div class="ft">' + chTags(g) + '<span class="tag role">' + g.steps.length + ' ' + L('bước', 'steps') + '</span><span class="go">' + L('Xem hướng dẫn →', 'Open guide →') + '</span></div></a>').join('') + '</div>';
    });
    if (!all.some(match)) html += '<p>' + L('Không tìm thấy chức năng phù hợp.', 'No matching function.') + '</p>';
    if (!Q) html += '<div class="skipbox"><b>' + L('Các phần đang hỏng / chưa hoàn thiện trên hệ thống nên không có hướng dẫn:', 'Parts that are currently broken / unfinished in the system and therefore have no guide:') + '</b><ul>' + SKIPPED.map((x) => '<li>' + tr(x) + '</li>').join('') + '</ul></div>';
    $('main').innerHTML = html;
  }

  /* ---------- trình phát ---------- */
  const P = { g: null, i: 0, mode: 'watch', playing: true, speed: 1, states: [], tok: 0, busy: false, target: null, timer: null, showall: false };
  const WEB_W = 980, WEB_H = 600;
  const cur = () => (P.g && P.i < P.g.steps.length ? P.g.steps[P.i] : null);

  function buildStates(g) {
    let s = clone(g.init || {}); const arr = [clone(s)];
    g.steps.forEach((st) => {
      s = clone(s);
      if (st.k != null && st.type != null) s[st.k] = tr(st.type);
      if (typeof st.set === 'function') st.set(s); else if (st.set) Object.assign(s, st.set);
      arr.push(clone(s));
    });
    return arr;
  }

  function renderGuide() {
    const g = P.g; const all = sorted(); const idx = all.indexOf(g); const prev = all[idx - 1], next = all[idx + 1];
    const tier = TIERS.find((t) => t[0] === g.tier);
    const onlyApp = !g.web;
    const panel = '<div class="panel' + (onlyApp ? ' sidecard' : '') + '"' + (onlyApp ? ' style="grid-template-columns:1fr;margin-top:0"' : '') + '><div class="pcard"><h3>' + L('Các bước', 'Steps') + '<button class="linkbtn" data-c="showall">' + L('Hiện/ẩn toàn bộ rule', 'Show/hide all rules') + '</button></h3><ol class="steps" id="steps"></ol></div>' +
      '<div class="pcard rules"><h3>' + L('Rule cần nhớ', 'Rules to remember') + '</h3><ul>' + (g.rules || []).map((r) => '<li>' + tr(r) + '</li>').join('') + '</ul></div></div>';
    $('main').innerHTML = '<div class="g-head"><div class="ic">' + g.icon + '</div><div class="tx"><h1>' + (idx + 1) + '. ' + tr(g.title) + '</h1><div class="meta"><span class="tag" style="color:#fff" data-tier="' + tier[1] + '">' + tr(tier[2]) + '</span>' + chTags(g) + (g.who ? '<span class="tag role">👤 ' + tr(g.who) + '</span>' : '') + '</div><p>' + tr(g.sum) + '</p>' + (g.pre ? '<div class="pre"><b>' + L('Điều kiện:', 'Prerequisites:') + '</b> ' + tr(g.pre) + '</div>' : '') + '</div>' +
      '<div class="g-nav">' + (prev ? '<a href="#' + prev.id + '">‹ ' + tr(prev.title) + '</a>' : '') + (next ? '<a href="#' + next.id + '">' + tr(next.title) + ' ›</a>' : '') + '</div></div>' +
      '<div class="ctrl" id="ctrl"></div>' +
      '<div class="stage' + (onlyApp ? ' only-app' : '') + '" id="stage">' +
      (g.web ? '<div class="frame web" id="fweb"><div class="fbar"><i></i><i></i><i></i><span class="url">https://portal.matthews.vn/shift/…</span></div><div class="who" id="whoW"></div><div class="fvp" id="fvp"><div class="fin" id="webIn"></div></div></div>' : '') +
      (g.app ? '<div class="frame app" id="fapp"><div class="who" id="whoA"></div><div class="phone"><div class="screen" id="appIn"></div></div></div>' : '') +
      (onlyApp ? panel : '') +
      '<div id="cursor" class="hide"><svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2l17 9-7.5 2.2L9 21z" fill="#1e2235" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div><div id="bubble" class="hide"></div></div>' +
      '<div class="donebox" id="done"></div>' + (onlyApp ? '' : panel);
    const tg = $('main').querySelector('[data-tier]'); tg.classList.add(tg.dataset.tier);
    $('stage').addEventListener('click', onStageClick, true);
  }

  function renderCtrl() {
    const g = P.g, n = g.steps.length, end = P.i >= n;
    $('ctrl').innerHTML = '<div class="seg"><button class="' + (P.mode === 'watch' ? 'on' : '') + '" data-c="mode" data-v="watch">👁 ' + L('Xem tự động', 'Watch') + '</button><button class="' + (P.mode === 'follow' ? 'on' : '') + '" data-c="mode" data-v="follow">✋ ' + L('Tự thao tác', 'Do it myself') + '</button></div>' +
      '<button class="cb" data-c="restart" title="' + L('Xem lại từ đầu', 'Restart') + '">⏮</button><button class="cb" data-c="prev" title="←">◀</button>' +
      (P.mode === 'watch' ? '<button class="cb pri" data-c="play">' + (end ? '↻ ' + L('Xem lại', 'Replay') : P.playing ? '⏸ ' + L('Tạm dừng', 'Pause') : '▶ ' + L('Phát', 'Play')) + '</button>' : '') +
      '<button class="cb" data-c="next" title="→">▶</button>' +
      '<span class="cnt">' + Math.min(P.i + 1, n) + ' / ' + n + '</span><div class="prog"><i style="width:' + (100 * Math.min(P.i, n) / n) + '%"></i></div>' +
      '<select data-c="speed" title="' + L('Tốc độ', 'Speed') + '">' + [0.6, 1, 1.5, 2].map((v) => '<option value="' + v + '"' + (P.speed === v ? ' selected' : '') + '>' + v + '×</option>').join('') + '</select>';
  }

  function renderSteps() {
    const g = P.g;
    $('steps').innerHTML = g.steps.map((st, i) => '<li class="' + (i === P.i ? 'on' : i < P.i ? 'done' : '') + '" data-c="goto" data-i="' + i + '"><span class="no">' + (i < P.i ? '✓' : i + 1) + '</span><div class="st"><span class="tag ' + st.on + '">' + (st.on === 'web' ? 'Web' : 'App') + '</span>' + tr(st.t) +
      (st.rule ? '<div class="ru">📏 ' + tr(st.rule) + '</div>' : '') + (st.warn ? '<div class="wa">⚠️ ' + tr(st.warn) + '</div>' : '') + '</div></li>').join('');
    $('main').classList.toggle('showall', P.showall);
    const on = $('steps').querySelector('li.on'); const box = $('steps').closest('.sidecard');
    if (on && box) { const pc = on.closest('.pcard'); if (pc.scrollHeight > pc.clientHeight) on.scrollIntoView({ block: 'nearest' }); }
  }

  function fit() {
    const vp = $('fvp'); if (!vp) return 1;
    const sc = vp.clientWidth / WEB_W; $('webIn').style.transform = 'scale(' + sc + ')'; vp.style.height = (WEB_H * sc) + 'px'; return sc;
  }

  function renderScene() {
    const g = P.g, s = P.states[P.i], st = cur();
    const keep = {};
    document.querySelectorAll('#stage [data-scroll]').forEach((el) => { keep[el.dataset.scroll] = el.scrollTop; });
    if (g.web) { $('webIn').innerHTML = g.web(s) || ''; $('whoW').innerHTML = '<b>🖥 Web</b> · ' + tr(s._web || ['Admin / HR', 'Admin / HR']); }
    if (g.app) { $('appIn').innerHTML = g.app(s) || ''; $('whoA').innerHTML = '<b>📱 App</b> · ' + tr(s._app || ['Nhân viên', 'Staff']); }
    document.querySelectorAll('#stage [data-scroll]').forEach((el) => { if (keep[el.dataset.scroll]) el.scrollTop = keep[el.dataset.scroll]; });
    ['fweb', 'fapp'].forEach((id) => { const f = $(id); if (!f) return; const k = id === 'fweb' ? 'web' : 'app'; f.classList.toggle('active', !!st && st.on === k); f.classList.toggle('idle', !!st && st.on !== k); });
    $('main').classList.toggle('follow', P.mode === 'follow');
    fit();
  }

  function ensureVisible(tg, frame) {
    let a = tg.parentElement;
    while (a && a !== frame) {
      if (a.scrollHeight > a.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(a).overflowY)) {
        const ar = a.getBoundingClientRect(), r = tg.getBoundingClientRect(); const sc = ar.height / a.offsetHeight || 1;
        if (r.top < ar.top + 6 || r.bottom > ar.bottom - 6) a.scrollTop += ((r.top + r.height / 2) - (ar.top + ar.height / 2)) / sc;
      }
      a = a.parentElement;
    }
  }

  function place() {
    const st = cur(); const stage = $('stage'); if (!stage) return;
    const c = $('cursor'), b = $('bubble');
    stage.querySelectorAll('.hl').forEach((e) => e.classList.remove('hl'));
    if (!st) { c.classList.add('hide'); b.classList.add('hide'); return; }
    const frame = $(st.on === 'web' ? 'fweb' : 'fapp'); if (!frame) return;
    const box = frame.querySelector(st.on === 'web' ? '.fvp' : '.screen');
    let tg = st.h ? box.querySelector('[data-h="' + st.h + '"]') : null;
    P.target = tg;
    if (tg) { ensureVisible(tg, frame); tg.classList.add('hl'); }
    const sr = stage.getBoundingClientRect(); const br = box.getBoundingClientRect();
    let r = (tg || box).getBoundingClientRect();
    // cắt vùng đích theo khung nhìn của frame
    r = { left: Math.max(r.left, br.left), top: Math.max(r.top, br.top), right: Math.min(r.right, br.right), bottom: Math.min(r.bottom, br.bottom) };
    r.width = Math.max(0, r.right - r.left); r.height = Math.max(0, r.bottom - r.top);
    const big = r.width > 260 || r.height > 150;
    const px = r.left - sr.left + (big ? Math.min(r.width * 0.5, 120) : r.width / 2);
    const py = r.top - sr.top + (big ? Math.min(r.height * 0.5, 34) : r.height / 2);
    c.className = (st.on === 'app' ? 'touch ' : '') + (P.mode === 'follow' && !st.look ? 'hint' : '');
    c.style.transform = 'translate(' + px + 'px,' + py + 'px)';
    // bong bóng
    const n = P.g.steps.length; const follow = P.mode === 'follow';
    const doTxt = st.look ? '' : st.type != null ? L('👉 Bấm vào ô đang sáng để nhập', '👉 Click the highlighted field to fill it') : L('👉 Bấm vào vùng đang sáng', '👉 Click the highlighted area');
    b.innerHTML = '<div class="bh">' + L('Bước', 'Step') + ' ' + (P.i + 1) + '/' + n + ' <span class="tag ' + st.on + '">' + (st.on === 'web' ? 'Web' : 'App') + '</span></div><div class="bt">' + tr(st.t) + '</div>' +
      (st.rule ? '<div class="br">📏 ' + tr(st.rule) + '</div>' : '') + (st.warn ? '<div class="bw">⚠️ ' + tr(st.warn) + '</div>' : '') +
      '<div class="bf"><span class="do">' + (follow ? doTxt : '') + '</span>' + (P.i > 0 ? '<button class="gh" data-c="prev">‹</button>' : '') + '<button class="' + (follow && !st.look ? 'gh' : '') + '" data-c="next">' + (follow && !st.look ? L('Bỏ qua ›', 'Skip ›') : L('Tiếp ›', 'Next ›')) + '</button></div>';
    b.className = '';
    const bw = Math.min(310, sr.width - 12); b.style.width = bw + 'px';
    const bh = b.offsetHeight; const W = sr.width, Hh = Math.max(sr.height, bh + 10);
    const R = { l: r.left - sr.left, t: r.top - sr.top, r: r.right - sr.left, b: r.bottom - sr.top };
    const cl = (v, a, z) => Math.max(a, Math.min(z, v));
    const cands = [
      [R.r + 20, cl(R.t - 6, 0, Hh - bh)], [R.l - bw - 20, cl(R.t - 6, 0, Hh - bh)],
      [cl((R.l + R.r) / 2 - bw / 2, 4, W - bw - 4), R.b + 22], [cl((R.l + R.r) / 2 - bw / 2, 4, W - bw - 4), R.t - bh - 18]
    ];
    let pos = cands.find(([x, y]) => x >= 0 && x + bw <= W && y >= -4 && y + bh <= Hh + 60);
    if (!pos) pos = [cl(R.r - bw - 12, 4, W - bw - 4), cl(R.b - bh - 12, 0, Hh - bh)];
    b.style.transform = 'translate(' + pos[0] + 'px,' + pos[1] + 'px)';
  }

  function schedule() {
    clearTimeout(P.timer);
    const st = cur(); if (!st || !P.playing || P.mode !== 'watch') return;
    const len = strip(tr(st.t)).length + 0.6 * strip(tr(st.rule)).length + 0.6 * strip(tr(st.warn)).length;
    const dwell = Math.max(2400, Math.min(9000, 1500 + len * 34));
    const tok = P.tok;
    P.timer = setTimeout(() => { if (tok === P.tok) advance(); }, (800 + dwell) / P.speed);
  }

  function go(i) {
    const n = P.g.steps.length;
    P.tok++; clearTimeout(P.timer); P.busy = false; P.i = Math.max(0, Math.min(n, i));
    renderScene(); renderCtrl(); renderSteps();
    const end = P.i >= n; const d = $('done');
    if (end) {
      P.playing = false; renderCtrl();
      const all = sorted(); const next = all[all.indexOf(P.g) + 1];
      d.innerHTML = '<b>✅ ' + L('Hoàn tất', 'Done') + '</b><div>' + tr(P.g.done) + '</div><div class="acts"><button data-c="restart">↻ ' + L('Xem lại', 'Replay') + '</button><button data-c="tryme">✋ ' + L('Tự thao tác lại', 'Try it myself') + '</button>' + (next ? '<a class="pri" href="#' + next.id + '">' + L('Chức năng tiếp theo: ', 'Next function: ') + tr(next.title) + ' →</a>' : '') + '</div>';
    }
    d.classList.toggle('on', end);
    place(); schedule();
  }

  function typeInto(el, text, cb) {
    const isInp = 'value' in el && el.tagName !== 'BUTTON'; const tok = P.tok; let k = 0;
    el.classList.remove('ph');
    const put = (v) => { if (isInp) el.value = v; else el.textContent = v; };
    put('');
    const tick = () => { if (tok !== P.tok) return; k++; put(text.slice(0, k)); if (k < text.length) setTimeout(tick, 55 / P.speed); else setTimeout(cb, 420 / P.speed); };
    setTimeout(tick, 150);
  }

  function advance() {
    const st = cur(); if (!st || P.busy) return;
    P.busy = true; clearTimeout(P.timer); const tok = P.tok; const i = P.i;
    const fin = () => { if (tok !== P.tok) return; go(i + 1); };
    const c = $('cursor');
    if (st.look || !P.target) return fin();
    c.classList.remove('click'); void c.offsetWidth; c.classList.add('click');
    if (st.type != null) return typeInto(P.target, tr(st.type), fin);
    P.target.classList.add('pressed');
    setTimeout(fin, 400 / Math.max(1, P.speed));
  }

  function onStageClick(e) {
    if (e.target.closest('#bubble') || e.target.closest('.panel')) return;
    const st = cur(); if (!st) return;
    if (e.target.closest('a')) e.preventDefault();
    const tg = P.target;
    if (tg && !st.look && (tg === e.target || tg.contains(e.target))) { e.stopPropagation(); advance(); return; }
    if (P.mode === 'follow' && e.target.closest('.frame')) { const b = $('bubble'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
  }

  /* ---------- điều hướng ---------- */
  function route() {
    const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const g = H.guides.find((x) => x.id === id) || null;
    P.tok++; clearTimeout(P.timer);
    P.g = g; document.body.classList.remove('nav');
    document.documentElement.lang = H.lang;
    document.title = (g ? tr(g.title) + ' — ' : '') + L('HDSD Chấm công Matthews', 'Matthews Timekeeping Guide');
    renderTop(); renderSide();
    if (!g) { renderHome(); window.scrollTo(0, 0); return; }
    P.states = buildStates(g); P.playing = P.mode === 'watch';
    renderGuide(); window.scrollTo(0, 0);
    const m = /[?&]s=(\d+)/.exec(location.search);
    if (m) { P.playing = false; P.mode = /follow/.test(location.search) ? 'follow' : 'watch'; return go(Number(m[1]) - 1); }
    go(0);
  }
  function setLang(v) {
    H.lang = v;
    const i = P.i, g = P.g, playing = P.playing;
    document.documentElement.lang = v; renderTop(); renderSide();
    if (!g) return renderHome();
    document.title = tr(g.title) + ' — ' + L('HDSD Chấm công Matthews', 'Matthews Timekeeping Guide');
    P.states = buildStates(g); renderGuide(); P.playing = playing; go(i);
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-c]'); if (!el) return;
    const c = el.dataset.c;
    if (c === 'lang') return setLang(el.dataset.v);
    if (c === 'nav') return document.body.classList.toggle('nav');
    if (!P.g) return;
    if (c === 'mode') { P.mode = el.dataset.v; P.playing = P.mode === 'watch'; if (P.i >= P.g.steps.length) return go(0); return go(P.i); }
    if (c === 'tryme') { P.mode = 'follow'; P.playing = false; return go(0); }
    if (c === 'restart') { P.playing = P.mode === 'watch'; return go(0); }
    if (c === 'prev') return go(P.i - 1);
    if (c === 'next') return advance();
    if (c === 'play') { if (P.i >= P.g.steps.length) { P.playing = true; return go(0); } P.playing = !P.playing; renderCtrl(); return schedule(); }
    if (c === 'goto') return go(Number(el.dataset.i));
    if (c === 'showall') { P.showall = !P.showall; return renderSteps(); }
  });
  document.addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.c === 'speed') { P.speed = Number(e.target.value); schedule(); } });
  document.addEventListener('input', (e) => { if (e.target.id !== 'q') return; Q = e.target.value.trim(); renderSide(); if (!P.g) { renderHome(); } });
  document.addEventListener('keydown', (e) => {
    if (!P.g || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') advance(); else if (e.key === 'ArrowLeft') go(P.i - 1);
    else if (e.key === ' ' && P.mode === 'watch') { e.preventDefault(); P.playing = !P.playing; renderCtrl(); schedule(); }
  });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (P.g) { fit(); place(); } }, 120); });
  window.addEventListener('hashchange', route);

  /* ---------- tự kiểm tra: mọi bước phải tìm thấy vùng đích ở cả 2 ngôn ngữ ---------- */
  H.selftest = () => {
    const errs = []; const keepLang = H.lang; const box = document.createElement('div');
    ['vi', 'en'].forEach((lg) => {
      H.lang = lg;
      H.guides.forEach((g) => {
        try {
          ['title', 'sum', 'done'].forEach((k) => { if (!Array.isArray(g[k]) || g[k].length < 2) errs.push(g.id + ': thiếu ' + k + ' song ngữ'); });
          if (![1, 2, 3].includes(g.tier)) errs.push(g.id + ': tier sai');
          const states = buildStates(g);
          states.forEach((s, i) => {
            const st = g.steps[i]; const html = { web: g.web ? g.web(s) : null, app: g.app ? g.app(s) : null };
            ['web', 'app'].forEach((k) => { if (html[k] != null && /undefined|\[object|NaN/.test(html[k])) errs.push(g.id + ' #' + (i + 1) + ' ' + lg + ': HTML ' + k + ' chứa undefined/[object/NaN'); });
            if (!st) return;
            if (!Array.isArray(st.t) || st.t.length < 2) errs.push(g.id + ' #' + (i + 1) + ': thiếu t song ngữ');
            ['rule', 'warn'].forEach((k) => { if (st[k] && (!Array.isArray(st[k]) || st[k].length < 2)) errs.push(g.id + ' #' + (i + 1) + ': ' + k + ' chưa song ngữ'); });
            if (html[st.on] == null) { errs.push(g.id + ' #' + (i + 1) + ': không có khung ' + st.on); return; }
            if (!st.h) { if (!st.look) errs.push(g.id + ' #' + (i + 1) + ': thiếu h'); return; }
            box.innerHTML = html[st.on];
            if (!box.querySelector('[data-h="' + st.h + '"]')) errs.push(g.id + ' #' + (i + 1) + ' ' + lg + ': không thấy [data-h="' + st.h + '"] trên ' + st.on);
          });
        } catch (er) { errs.push(g.id + ' ' + lg + ': lỗi ' + er.message); }
      });
    });
    const ids = H.guides.map((g) => g.id); ids.forEach((id, i) => { if (ids.indexOf(id) !== i) errs.push('trùng id ' + id); });
    FLOW.forEach(([id]) => { if (!ids.includes(id)) errs.push('FLOW trỏ tới id không tồn tại: ' + id); });
    H.lang = keepLang; return errs;
  };

  /* ---------- tự kiểm tra chế độ "Tự thao tác": bấm thật vào vùng đích của mọi bước ---------- */
  H.autotest = async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)); const errs = []; let clicks = 0;
    renderTop();
    for (const g of sorted()) {
      P.g = g; P.mode = 'follow'; P.playing = false; P.speed = 2; P.states = buildStates(g); renderSide(); renderGuide(); go(0);
      for (let i = 0; i < g.steps.length; i++) {
        await wait(60);
        const st = g.steps[i];
        if (P.i !== i) { errs.push(g.id + ' #' + (i + 1) + ': lệch bước (' + P.i + ')'); break; }
        if (!st.look && !P.target) { errs.push(g.id + ' #' + (i + 1) + ': không định vị được vùng đích'); break; }
        const el = st.look ? $('bubble').querySelector('[data-c="next"]') : P.target;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) errs.push(g.id + ' #' + (i + 1) + ': vùng đích không hiển thị');
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); clicks++;
        for (let k = 0; k < 200 && P.i === i; k++) await wait(40);
        if (P.i !== i + 1) { errs.push(g.id + ' #' + (i + 1) + ': bấm không sang bước kế'); break; }
      }
      await wait(30);
      if (P.i === g.steps.length && !$('done').classList.contains('on')) errs.push(g.id + ': không hiện khung Hoàn tất');
    }
    document.body.innerHTML = '<pre id="selftest">AUTOTEST GUIDES=' + H.guides.length + ' CLICKS=' + clicks + ' ERRORS=' + errs.length + '\n' + esc(errs.join('\n')) + '</pre>';
  };

  H.start = () => {
    if (/autotest/.test(location.search)) return H.autotest();
    if (/selftest/.test(location.search)) {
      const e = H.selftest();
      document.body.innerHTML = '<pre id="selftest">GUIDES=' + H.guides.length + ' STEPS=' + H.guides.reduce((a, g) => a + g.steps.length, 0) + ' ERRORS=' + e.length + '\n' + esc(e.join('\n')) + '</pre>';
      return;
    }
    route();
  };
})();
