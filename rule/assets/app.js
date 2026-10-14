/* ===== APP NHÂN VIÊN (Flutter Matthews_staff) ===== */
(function () {
  const T = Store.T, E = Engine, N = UI.N, A = UI.ACT;
  const S = () => Store.S;
  const LOC = {
    q1_in: { label: 'Đứng tại cửa hàng Q1 (~20m)', lat: 10.777049, lng: 106.700906 },
    q1_near: { label: 'Cách cửa hàng Q1 ~350m', lat: 10.779989, lng: 106.701906 },
    td_in: { label: 'Đứng tại cửa hàng Thủ Đức (~40m)', lat: 10.850466, lng: 106.772089 },
    home: { label: 'Ở nhà (~6km)', lat: 10.80, lng: 106.65 }
  };
  const IPS = { '42.114.204.250': 'Wifi Matthews_Q1 (42.114.204.250)', '113.161.77.9': '4G / wifi nhà (113.161.77.9)' };
  const AP = {
    stack: [{ n: 'home' }],
    sim: { loc: 'q1_in', ip: '42.114.204.250', gps: true, perm: true, net: true, cam: true },
    perms: { TI000000: true, TI000001: true, TI000002: true },
    weekOff: 0, pgWeekOff: 0, overlay: null
  };
  const user = () => Store.staff(S().appUser);
  const top = () => AP.stack[AP.stack.length - 1];
  const push = (n, p) => { AP.stack.push(Object.assign({ n }, p || {})); App.render(); };
  const pop = (reload) => { if (AP.stack.length > 1) AP.stack.pop(); AP.overlay = null; App.render(); void reload; };
  A.aback = () => pop();
  A.ago = (d) => push(d.n, Object.assign({}, d));

  /* ---------- dialog / sheet trong điện thoại ---------- */
  const dialog = (title, msg, why, buttons) => new Promise((res) => {
    const scr = document.querySelector('.screen'); if (!scr) return res(false);
    const w = document.createElement('div'); w.className = 'adialog-wrap';
    w.innerHTML = '<div class="adialog"><h4>' + esc(title) + '</h4><p>' + esc(msg) + '</p>' + (why ? '<div class="why">💡 ' + esc(why) + '</div>' : '') + '<div class="acts">' + (buttons || [['Đóng', 1]]).map(([l, v]) => '<button data-r="' + v + '">' + l + '</button>').join('') + '</div></div>';
    w.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { w.remove(); res(b.dataset.r === '1'); } });
    scr.appendChild(w);
  });
  const confirmD = (msg) => dialog('Thông báo', msg, null, [['Huỷ', 0], ['Xác nhận', 1]]);
  const resultD = (r) => dialog('Thông báo', r.message, r.ok ? null : r.why);
  const sheet = (title, body) => { AP.overlay = '<div class="sheet-wrap" data-act="sheetClose"><div class="sheet" data-act="noop"><h4>' + title + '</h4>' + body + '</div></div>'; App.render(); };
  A.sheetClose = (d, el, e) => { if (e.target === el) { AP.overlay = null; App.render(); } };
  A.noop = () => {};

  /* ---------- trạng thái thiết bị ---------- */
  const device = () => { const l = LOC[AP.sim.loc]; return { lat: l.lat, lng: l.lng, ip: AP.sim.ip }; };
  const withImage = () => { const c = Store.cfg('checkin_with_image'); return c.is_actived === 1 && Number(c.value) !== 0; };

  /* ================= SIM PANEL ================= */
  function simPanel() {
    const s = AP.sim;
    const sel = (k, opts) => '<select data-chg="simSet" data-k="' + k + '">' + Object.entries(opts).map(([v, l]) => '<option value="' + v + '"' + (String(s[k]) === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>';
    const tog = (k, l) => '<label>' + l + '<input type="checkbox" data-chg="simTog" data-k="' + k + '"' + (s[k] ? ' checked' : '') + '></label>';
    const cs = E.api.currentShift(S().appUser);
    const loc = LOC[s.loc];
    const b = cs.ok ? Store.branch(cs.data.branch_id) : null;
    const dist = b ? T.distance(b.latitude, b.longitude, loc.lat, loc.lng) : null;
    return '<div class="sim-panel"><h3>Bảng giả lập thiết bị' + N('app-sim') + '</h3>' +
      '<label>Đăng nhập app<select data-chg="appUser">' + S().staffs.map((x) => '<option value="' + x.staff_id + '"' + (x.staff_id === S().appUser ? ' selected' : '') + '>' + esc(x.full_name) + '</option>').join('') + '</select></label>' +
      '<div class="small">' + esc(user().title) + ' · QL: ' + esc(user().staff_manager_id ? E.staffName(user().staff_manager_id) : '—') + '<br>check_in_limit = <b>' + user().check_in_limit + '</b>' + (user().check_in_limit === 0 ? ' (linh động)' : '') + ' · check_approved_time_working = <b>' + user().check_approved_time_working + '</b>' + (user().check_approved_time_working === 0 ? ' (tự duyệt)' : '') + '</div>' +
      '<div class="grp"><b>Quyền (v2/user/permission)</b>' + N('app-perm') + ['TI000000', 'TI000001', 'TI000002'].map((k) => '<label>' + k + '<input type="checkbox" data-chg="permTog" data-k="' + k + '"' + (AP.perms[k] ? ' checked' : '') + '></label>').join('') + '</div>' +
      '<div class="grp"><b>Vị trí & mạng</b><label>Vị trí' + sel('loc', Object.fromEntries(Object.entries(LOC).map(([k, v]) => [k, v.label]))) + '</label><label>IP public' + sel('ip', IPS) + '</label>' + tog('gps', 'Bật dịch vụ định vị') + tog('perm', 'Cho phép quyền vị trí') + tog('net', 'Có kết nối mạng') + tog('cam', 'Cho phép camera') +
      (dist != null ? '<div class="small">Khoảng cách tới ' + esc(b.branch_name) + ': <b>' + dist + 'm</b></div>' : '') + '</div>' +
      '<div class="grp"><b>Cấu hình đang áp dụng</b><div class="small">checkin_with_image: <b>' + (withImage() ? 'BẬT (chụp selfie)' : 'TẮT (chấm tại Home)') + '</b><br>checkin_time_before: ' + Store.cfgMin('checkin_time_before') + 'p · late_check_in: ' + Store.cfgMin('late_check_in') + 'p<br>Đổi ở Portal › Cấu hình.</div><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-default btn-sm" data-act="toggleImg">Bật/tắt chụp ảnh</button></div></div>' +
      '<div class="grp small">Gợi ý thử: đặt giờ giả lập 07:20 (quá sớm), 07:50 (hợp lệ), 08:20 (trễ quá 15p) rồi bấm <b>Giờ vào</b>; đổi vị trí "Ở nhà" + IP 4G để xem lỗi wifi/GPS.</div></div>';
  }
  A.simSet = (d, el) => { AP.sim[d.k] = el.value; App.render(); };
  A.simTog = (d, el) => { AP.sim[d.k] = el.checked; App.render(); };
  A.permTog = (d, el) => { AP.perms[d.k] = el.checked; App.render(); };
  A.appUser = (d, el) => { S().appUser = Number(el.value); Store.save(); AP.stack = [{ n: 'home' }]; App.render(); };
  A.toggleImg = () => { const c = Store.cfg('checkin_with_image'); c.is_actived = c.is_actived && Number(c.value) ? 0 : 1; c.value = 1; Store.save(); App.render(); };

  /* ================= HOME ================= */
  function scrHome() {
    const u = user(); const cs = E.api.currentShift(u.staff_id);
    let card = '';
    if (AP.perms.TI000001) {
      if (!cs.ok) card = '<div class="tk-card"><div class="row" style="color:#999">Thẻ chấm công bị <b>ẩn</b> (API trả errorCode 1: "' + cs.message + '")' + N('app-card') + '</div></div>';
      else {
        const t = cs.data; const step = t.checking_curent_step || 1;
        const inS = E.inOf(t, step), outS = E.outOf(t, step);
        const isCheckIn = !inS ? 1 : (!outS ? 0 : null);
        const hist = t.ins.map((x) => { const o = E.outOf(t, x.step); return '<div class="row">Lần ' + x.step + ': ' + x.time + ' - ' + (o ? o.time : '') + '</div>'; }).join('');
        card = '<div class="tk-card"><div class="sn">' + esc(E.shiftOf(t).shift_name) + N('app-card') + (t.checking_type > 1 ? N('app-card-step') : '') + '<span style="float:right;cursor:pointer" data-act="ago" data-n="schedule">📅</span></div><div class="row">Thời gian: ' + t.working_time + ' - ' + (t.working_end_day !== t.working_day ? T.dmy(t.working_end_day) + ' ' : '') + t.working_end_time + '</div>' + hist +
          (t.checking_type > 1 ? '<div class="row" style="font-size:12px;color:#999">Lượt ' + step + '/' + t.checking_type + '</div>' : '') +
          (isCheckIn === 1 ? '<button class="big" style="background:#FF9800" data-act="doCheck" data-id="' + t.id + '" data-in="1">Giờ vào</button>' : isCheckIn === 0 ? '<button class="big" style="background:#F44336" data-act="doCheck" data-id="' + t.id + '" data-in="0">Giờ ra</button>' : '') +
          (cs.others ? '<div class="row" style="font-size:11.5px;color:#b58d3e">Hôm nay còn ' + cs.others + ' ca khác nhưng API luôn trả ca có giờ bắt đầu sớm nhất</div>' : '') + '</div>';
      }
    }
    const tiles = [];
    if (AP.perms.TI000001) tiles.push(['schedule', '📅', 'LLV'], ['pgList', '👥', 'LLV nhân viên'], ['tkMonth', '🧾', 'Chấm công'], ['history', '🗓', 'Lịch sử chấm công']);
    if (AP.perms.TI000002) tiles.push(['report', '📊', 'Báo cáo chấm công']);
    if (AP.perms.TI000000) tiles.push(['manageTk', '📋', 'Quản lý chấm công']);
    return {
      raw: true,
      html: '<div class="home-hero"><div class="hi">Xin chào,</div><div class="nm">' + esc(u.full_name) + '</div><div class="hi">' + esc(Store.branch(u.branch_id).branch_name) + '</div></div>' + card +
        '<div class="menu-grid">' + tiles.map(([n, ic, l]) => '<div class="mi" data-act="ago" data-n="' + n + '"><span class="ic">' + ic + '</span>' + l + '</div>').join('') + '</div>' +
        (S().noti.filter((x) => x.to === u.staff_id).length ? '<div style="padding:12px"><b>Thông báo mới</b>' + S().noti.filter((x) => x.to === u.staff_id).slice(0, 3).map((x) => '<div class="acard" style="margin-top:8px"><b>' + esc(x.title) + '</b><div style="font-size:12.5px;color:#555">' + esc(x.message) + '</div></div>').join('') + '</div>' : '')
    };
  }

  /* --------- Chấm công --------- */
  A.doCheck = async (d) => {
    const t = Store.tw(d.id); const isIn = d.in === '1';
    UI.showNote('app-flow');
    if (!AP.sim.net) return dialog('Thông báo', 'Kiểm tra kết nối mạng!', 'Client kiểm tra mạng trước mọi request, không có chế độ offline');
    if (withImage()) return push('checkinout', { id: t.id, isIn });
    if (!AP.sim.gps || !AP.sim.perm) return dialog('Thông báo', 'Không thể lấy vị trí hiện tại. Vui lòng thử lại.', 'Luồng KHÔNG ảnh luôn đòi GPS, kể cả nhân viên linh động');
    if (t.working_day !== Store.today()) return dialog('Thông báo', 'Ngày làm việc không hợp lệ', 'Ngày bắt đầu ca (' + T.dmy(t.working_day) + ') ≠ ngày thiết bị (' + T.dmy(Store.today()) + '). ⚠ Ca qua đêm sẽ không check-out được vào ngày hôm sau');
    const dv = device();
    const r = isIn ? E.api.checkIn(user().staff_id, t.id, dv) : E.api.checkOut(user().staff_id, t.id, dv);
    if (r.ok) await dialog('Thông báo', r.message, r.loc ? 'Hợp lệ vị trí: ' + r.loc.detail : null);
    else { await dialog('Thông báo', r.message, r.why); await dialog('Thông báo', r.message, 'Thực tế app hiện 2 dialog lỗi liên tiếp ở luồng không ảnh (Interaction + bloc)'); }
    App.render();
  };

  function scrCheckInOut(p) {
    const t = Store.tw(p.id); const b = Store.branch(t.branch_id); const l = LOC[AP.sim.loc];
    const dist = T.distance(b.latitude, b.longitude, l.lat, l.lng);
    const cfg = S().tkConfigs.find((c) => c.branch_id === t.branch_id && c.timekeeping_type === 'gps' && !c.is_deleted);
    const r = cfg ? (cfg.allowable_radius || 100) : 100;
    const scale = 70 / Math.max(r, 1);
    const dx = (l.lng - b.longitude) * 109000 * scale, dy = -(l.lat - b.latitude) * 111000 * scale;
    const inside = Math.abs(dx) < 180 && Math.abs(dy) < 95;
    const done = p.done;
    return {
      title: p.isIn ? 'Giờ vào' : 'Giờ ra',
      body: '<div class="cam" data-act="snap">' + (done ? '<canvas id="camImg"></canvas>' : '<div style="text-align:center">📷<br><b>Chụp ảnh</b>' + N('app-selfie') + '</div>') + '</div>' +
        '<div class="map"><div class="ring" style="left:50%;top:50%;width:' + (r * scale * 2) + 'px;height:' + (r * scale * 2) + 'px"></div><div class="pin" style="left:50%;top:50%">📍</div>' +
        (inside ? '<div class="me" style="left:calc(50% + ' + dx + 'px);top:calc(50% + ' + dy + 'px)"></div>' : '') + '<div class="lbl">' + esc(b.branch_name) + ' · bán kính ' + r + 'm · bạn cách ' + dist + 'm' + (inside ? '' : ' (ngoài khung)') + '</div></div>' +
        '<div class="acard" style="margin-top:10px"><div class="kv"><span>' + (p.isIn ? 'Thời gian checkin' : 'Thời gian checkout') + '</span><b>' + (done ? T.dmy(Store.today()) + ' ' + done : '') + '</b></div><div style="font-size:11.5px;color:#999;margin-top:6px">Khối "Cách cửa hàng" + so sánh bán kính trên UI đã bị comment → app không chặn theo bán kính.</div></div>',
      bottom: '<button class="abtn" data-act="snap">Làm lại</button><button class="abtn sec" data-act="aback">Thoát</button>'
    };
  }
  A.snap = async () => {
    const p = top(); const t = Store.tw(p.id); const u = user();
    if (!AP.sim.net) return dialog('Thông báo', 'Kiểm tra kết nối mạng!');
    let pos = null, radius = null;
    if (u.check_in_limit !== 0) {
      if (!AP.sim.gps) return dialog('Thông báo', 'Vui lòng bật Dịch vụ Định vị để ứng dụng hiển thị chính xác thông tin mạng');
      if (!AP.sim.perm) return dialog('Thông báo', 'Vui lòng cấp quyền vị trí để sử dụng tính năng này');
      pos = device(); const b = Store.branch(t.branch_id); radius = T.distance(b.latitude, b.longitude, pos.lat, pos.lng);
    }
    if (!AP.sim.cam) return dialog('Cho phép quyền truy cập Camera', 'Chọn Cài đặt vào Thông tin ứng dụng, chọn vào Quyền (Permissions), bật truy cập và vào lại màn hình này để sử dụng quyền Camera');
    if (t.working_day !== Store.today()) return dialog('Thông báo', 'Ngày làm việc không hợp lệ', 'Kiểm tra ngày nằm SAU bước chụp + upload ảnh. ⚠ Ca qua đêm không check-out được vào ngày hôm sau');
    const dv = device();
    const payload = { ip: dv.ip, lat: pos ? pos.lat : null, lng: pos ? pos.lng : null, image: 's3://selfie.png', radius };
    const r = p.isIn ? E.api.checkIn(u.staff_id, t.id, payload) : E.api.checkOut(u.staff_id, t.id, payload);
    if (r.ok) {
      p.done = r.time; App.render(); drawSelfie(p.isIn, u.full_name, pos, radius);
      return dialog('Thông báo', r.message, 'Vị trí: ' + r.loc.detail);
    }
    return dialog('Thông báo', r.message, r.why);
  };
  function drawSelfie(isIn, name, pos, radius) {
    const c = document.getElementById('camImg'); if (!c) return;
    c.width = 340; c.height = 300; const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 300); grd.addColorStop(0, '#9fb7c9'); grd.addColorStop(1, '#5b7184'); g.fillStyle = grd; g.fillRect(0, 0, 340, 300);
    g.fillStyle = '#f1c9a5'; g.beginPath(); g.arc(170, 150, 62, 0, 7); g.fill(); g.fillStyle = '#3b2b20'; g.beginPath(); g.arc(170, 120, 64, Math.PI, 0); g.fill();
    g.fillStyle = '#3b6ea5'; g.fillRect(90, 230, 160, 80);
    g.font = 'bold 13px sans-serif'; g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowBlur = 3;
    const lines = [(isIn ? 'Check-in: ' : 'Check-out: ') + name, 'Time: ' + T.dmy(Store.today()) + ' ' + T.hm(Store.now())];
    if (pos) lines.push('Location: ' + pos.lat.toFixed(6) + ', ' + pos.lng.toFixed(6));
    if (radius) lines.push('Distance: ' + radius + ' m');
    lines.push('Address: (Nominatim reverse geocode)');
    lines.forEach((l, i) => g.fillText(l, 10, 22 + i * 18));
  }

  /* ================= LỊCH LÀM VIỆC CỦA TÔI ================= */
  const weekOf = (off) => { const mon = T.addDays(T.monday(Store.today()), off * 7); return [0, 1, 2, 3, 4, 5, 6].map((i) => T.addDays(mon, i)); };
  function schedCard(t, opts) {
    const st = E.STATUS[t.time_working_staff_status] || E.STATUS.waiting;
    const ci = E.firstIn(t), co = E.lastOut(t);
    let h = '<div class="sched" data-act="' + opts.open + '" data-id="' + t.id + '"><div class="top"><span>' + T.dayNames[T.weekday(t.working_day)] + ', ' + T.dmy(t.working_day) + '</span><span class="chip" style="background:' + st.color + '">' + st.label + '</span></div>' +
      '<div class="ln">🏠 ' + esc(Store.branch(t.branch_id).branch_name) + '</div><div class="ln">🗓 ' + esc(E.shiftOf(t).shift_name) + ' (' + t.working_time + ' -> ' + t.working_end_time + ')</div>';
    if (ci || co) { const dur = ci && co ? T.diffMin(E.inDT(co), E.inDT(ci)) : null; h += '<div class="ln">⏱ <b>' + (ci ? ci.time : '--') + ' -> ' + (co ? co.time : '--') + '</b>' + (dur != null ? '<span style="margin-left:auto;color:#FF9800">' + Math.floor(dur / 60) + ' Giờ ' + (dur % 60) + ' Phút</span>' : '') + '</div>'; }
    if (t.old_shift_id) h += '<div class="ln">↔ Đổi ca từ: ' + esc(E.shiftOf({ shift_id: t.old_shift_id }).shift_name) + ' · Ghi chú: ' + esc(t.old_shift_note) + (t.approve_next_shift_by ? ' · Người duyệt: ' + esc(E.staffName(t.approve_next_shift_by)) : '') + '</div>';
    if (t.time_late_apply_work_late) h += '<div class="ln">⏰ Đi muộn: ' + t.time_late_apply_work_late + ' Phút · ' + esc(t.time_late_apply_work_late_note) + (t.approve_late_by ? ' · Người duyệt: ' + esc(E.staffName(t.approve_late_by)) : '') + '</div>';
    if (t.time_late_apply_work_soon) h += '<div class="ln">⏰ Về sớm: ' + t.time_late_apply_work_soon + ' Phút · ' + esc(t.time_late_apply_work_soon_note) + '</div>';
    if (t.time_working_staff_status === 'confirmed') h += '<div class="ln green">Hệ số công: ' + t.timekeeping_coefficient + '</div>';
    h += '<div class="ln orange">Thời gian ước lượng: ' + T.fmtH(t.time_work) + ' Giờ</div>';
    const acts = [];
    if (opts.mine) {
      const ap = E.app.showApp(t);
      if (ap) {
        if ((ap.showShift || ap.showLate) && E.app.canChangeShift(t)) acts.push('<button data-act="ago" data-n="mShift" data-id="' + t.id + '">Đổi ca làm</button>');
        if (ap.showLate) acts.push('<button data-act="ago" data-n="mLate" data-id="' + t.id + '">Đi muộn / Về sớm</button>');
        if (ap.showOvertime) acts.push('<button class="or" data-act="ago" data-n="mOt" data-id="' + t.id + '">Làm thêm giờ</button>');
      }
    } else {
      if (E.app.canChangeShift(t)) acts.push('<button data-act="pgChange" data-id="' + t.id + '">⏲ Đổi ca</button>');
      if (E.app.canProxy(t)) acts.push('<button class="fill" data-act="pgManual" data-id="' + t.id + '">Chấm công thủ công</button>');
    }
    if (acts.length) h += '<div class="acts">' + acts.join('') + '</div>';
    return h + '</div>';
  }
  function groupCounts(list) {
    const c = { waiting: 0, approved: 0, 'not-confirm': 0, confirmed: 0, 'waiting-confirm': 0 }; let est = 0, act = 0, conf = 0;
    list.forEach((t) => { if (c[t.time_working_staff_status] != null) c[t.time_working_staff_status]++; if (t.approved_manual_time_by) c['waiting-confirm']++; est += Number(t.time_work || 0); act += Number(t.actual_time_work || 0); conf += Number(t.actual_time_work_confirmed || 0); });
    return { c, est, act, conf };
  }
  function pgSummary(name, branch, g) {
    return '<div class="acard"><b>' + esc(name) + '</b><div style="font-size:12px;color:#666">🏠 ' + esc(branch) + '</div>' +
      Object.entries(g.c).map(([k, v]) => '<div class="kv"><span style="color:' + E.STATUS[k].color + '">' + E.STATUS[k].label + '</span><b>' + v + '</b></div>').join('') +
      '<div class="kv"><span>Thời gian làm việc dự kiến</span><b>' + T.fmtH(g.est) + 'h</b></div><div class="kv"><span>Thời gian làm việc thực tế</span><b>' + T.fmtH(g.act) + 'h</b></div><div class="kv"><span>Thời gian làm việc được xác nhận</span><b>' + T.fmtH(g.conf) + 'h</b></div></div>';
  }
  function scrSchedule() {
    const days = weekOf(AP.weekOff); const u = user();
    const list = E.active().filter((t) => t.staff_id === u.staff_id && t.working_day >= days[0] && t.working_day <= days[6]).sort((a, b) => (a.working_day + a.working_time).localeCompare(b.working_day + b.working_time));
    const body = '<div class="week-h"><button data-act="awk" data-d="-1">‹</button><span style="flex:1;text-align:center">Tuần ' + T.isoWeek(days[0]) + ' (' + T.dmy(days[0]) + ' - ' + T.dmy(days[6]) + ')</span><button data-act="awk" data-d="1">›</button></div>' +
      pgSummary(u.full_name, Store.branch(u.branch_id).branch_name, groupCounts(list)) +
      (list.length ? list.map((t) => schedCard(t, { mine: true, open: 'mDetail' })).join('') : '<div class="acard" style="text-align:center;color:#999">Không có lịch làm việc<br><button class="abtn" style="margin-top:10px" data-act="copyWeek">Thêm</button></div>');
    return { title: 'Lịch làm việc', note: 'app-llv', body, right: '<button data-act="pickDay" title="Thêm ca">＋</button>' };
  }
  A.awk = (d) => { AP.weekOff += Number(d.d); App.render(); };
  A.mDetail = (d) => push('mDetail', { id: Number(d.id) });
  A.pickDay = () => {
    const days = weekOf(AP.weekOff);
    sheet('Chọn ngày (trong tuần đang xem)', days.map((dd) => '<button class="abtn sec" style="margin-bottom:6px;width:100%" data-act="ago" data-n="mAddShift" data-day="' + dd + '">' + T.dayNames[T.weekday(dd)] + ' ' + T.dmy(dd) + '</button>').join(''));
  };
  A.copyWeek = async () => {
    const days = weekOf(AP.weekOff); const u = user();
    const last = E.active().filter((t) => t.staff_id === u.staff_id && t.working_day >= T.addDays(days[0], -7) && t.working_day < days[0] && E.shiftOf(t).shift_code !== 'OT');
    const items = last.map((t) => ({ shift_id: t.shift_id, branch_id: t.branch_id, working_day: T.addDays(t.working_day, 7) }));
    if (!(await confirmD('Sao chép ' + items.length + ' ca của tuần trước sang tuần này?'))) return;
    await resultD(E.api.createWeek(u.staff_id, items)); App.render();
  };

  function scrDetail(p, mgr) {
    const t = Store.tw(p.id); const hist = t.ins.map((x) => { const o = E.outOf(t, x.step); const h = o ? T.hours(T.diffMin(E.inDT(o), E.inDT(x))) : null; return '<div class="acard"><b>Thời gian ' + x.step + ': ' + (h != null ? T.fmtH(h) + ' Giờ' : '') + '</b><div class="kv"><span>Giờ vào</span><b>' + x.time + ' ' + (x.created_type === 'admin' ? '👤' : '📱') + '</b></div><div class="kv"><span>Giờ ra</span><b>' + (o ? o.time : '--') + '</b></div></div>'; }).join('');
    let body = (mgr ? '<div class="acard"><b>Nhân viên: ' + esc(E.staffName(t.staff_id)) + '</b></div>' : '') + schedCard(t, { mine: false, open: 'noop' }).replace(/<div class="acts">[\s\S]*<\/div><\/div>$/, '</div>') +
      '<div class="acard"><div class="kv"><span>Thời gian làm việc được xác nhận</span><b>' + T.fmtH(t.actual_time_work_confirmed) + '</b></div><div class="kv"><span>Tổng thời gian</span><b style="color:' + (t.actual_time_work == null ? '#FF9800' : '#3398dc') + '">' + (t.actual_time_work == null ? 'Chưa xác định' : T.fmtH(t.actual_time_work) + ' Giờ') + '</b></div><div class="kv"><span>Thời gian ước lượng</span><b>' + T.fmtH(t.time_work) + ' Giờ</b></div>' + (t.time_working_staff_status === 'confirmed' ? '<div class="kv"><span>Hệ số công</span><b>' + t.timekeeping_coefficient + '</b></div>' : '') + '</div>' +
      (hist ? '<b>Lịch sử vào ra</b>' + hist : '');
    if (mgr) {
      if (t.time_late_apply_work_late) body += '<div class="acard"><b>Đơn phép: Đi muộn</b><div class="kv"><span>Đi muộn</span><b>' + t.time_late_apply_work_late + ' Phút</b></div><div class="kv"><span>Người duyệt</span><b>' + esc(t.approve_soon_by ? E.staffName(t.approve_soon_by) : '') + '</b></div><div style="font-size:11px;color:#b58d3e">⚠ Code hiển thị người duyệt của đơn VỀ SỚM ở đây (tráo field)</div></div>';
    }
    let bottom = '';
    if (!mgr) {
      const ap = E.app.showApp(t);
      if (ap && (ap.showShift || ap.showLate)) bottom = (ap.showLate ? '<button class="abtn" data-act="ago" data-n="mLate" data-id="' + t.id + '">Đi muộn / Về sớm</button>' : '') + (ap.showShift ? '<button class="abtn sec" data-act="ago" data-n="mShift" data-id="' + t.id + '">Đổi ca làm</button>' : '');
    } else {
      const st = t.time_working_staff_status;
      if (st === 'not-confirm') bottom = '<button class="abtn" data-act="ago" data-n="pgConfirm" data-id="' + t.id + '" data-attend="0">Xác nhận thời gian làm việc</button>';
      else if (st === 'waiting' || !st) {
        if (t.old_shift_id && !t.is_approved_next_shift) bottom = '<button class="abtn" data-act="ago" data-n="pgShift" data-id="' + t.id + '">Duyệt lịch làm việc</button>';
        else if ((t.time_late_apply_work_soon && !t.is_approve_soon) || (t.time_late_apply_work_late && !t.is_approve_late)) bottom = '<button class="abtn" data-act="ago" data-n="pgLate" data-id="' + t.id + '">Duyệt lịch làm việc</button>';
        else bottom = '<button class="abtn" data-act="pgApproveOne" data-id="' + t.id + '">Duyệt lịch làm việc</button>';
      } else if (E.app.isSupportConfirm(t)) bottom = '<button class="abtn purple" data-act="ago" data-n="pgConfirm" data-id="' + t.id + '" data-attend="1">Chấm công hộ</button>';
    }
    return { title: 'Chi tiết lịch làm việc', note: mgr ? 'app-pgdetail' : 'app-llv', body, bottom };
  }

  function scrMShift(p) {
    const t = Store.tw(p.id); const br = p.br || t.branch_id; const key = T.dayKeys[T.weekday(t.working_day)];
    const shifts = S().shifts.filter((s) => s.is_actived && !s.is_deleted && s.branches.includes(Number(br)) && s[key]);
    const sel = p.sh || t.shift_id; const ss = Store.shift(sel);
    return {
      title: 'Đổi ca làm', note: 'app-change',
      body: '<div class="acard"><b>' + T.dayNames[T.weekday(t.working_day)] + ', ' + T.dmy(t.working_day) + '</b><div>Ca hiện tại: ' + esc(E.shiftOf(t).shift_name) + '</div></div>' +
        '<div class="afield"><label>Chi nhánh</label><select id="msBr" data-chg="msBr">' + UI.opt(S().branches, br, 'branch_id', 'branch_name') + '</select></div>' +
        '<div class="afield"><label>Đổi ca *</label><select id="msSh" data-chg="msSh">' + UI.opt(shifts, shifts.some((s) => s.shift_id === sel) ? sel : '', 'shift_id', 'shift_name', 'Chọn ca làm việc của bạn') + '</select></div>' +
        '<div class="afield"><label>Ghi chú</label><textarea id="msNote" rows="3" placeholder="Nhập ghi chú"></textarea></div>' +
        '<div class="afield"><label>Ghi đè thời gian (Tùy chọn)</label><div style="display:flex;gap:6px"><input type="time" id="msS" value="' + (ss ? ss.start_work_time : '') + '"><input type="time" id="msE" value="' + (ss ? ss.end_work_time : '') + '"></div></div>' +
        '<div class="afield"><label>Hình ảnh</label><div class="acard" style="text-align:center;color:#999">+ Thêm ảnh (upload S3)</div></div>',
      bottom: '<button class="abtn" data-act="msSave" data-id="' + t.id + '">Lưu</button>'
    };
  }
  A.msBr = (d, el) => { top().br = Number(el.value); top().sh = null; App.render(); };
  A.msSh = (d, el) => { top().sh = Number(el.value) || null; App.render(); };
  A.msSave = async (d) => {
    const sh = document.getElementById('msSh').value;
    if (!sh) return dialog('Thông báo', 'Vui lòng chọn ca làm việc');
    const r = E.api.changeShift(user().staff_id, Number(d.id), { shift_id: sh, branch_id: document.getElementById('msBr').value, note: document.getElementById('msNote').value, working_time: document.getElementById('msS').value, working_end_time: document.getElementById('msE').value });
    await resultD(r); if (r.ok) pop();
  };

  function scrMLate(p) {
    const t = Store.tw(p.id);
    const stp = (id, v) => '<div class="stepper"><button data-act="stp" data-t="' + id + '" data-d="-1">−</button><input id="' + id + '" inputmode="numeric" placeholder="Nhập số phút" value="' + (v || '') + '"><button data-act="stp" data-t="' + id + '" data-d="5">+</button></div>';
    return {
      title: 'Đi muộn / Về sớm', note: 'app-late',
      body: '<div class="acard"><b>' + T.dmy(t.working_day) + '</b> · Ca hiện tại: ' + esc(E.shiftOf(t).shift_name) + '</div><div class="afield"><label>Số phút đi muộn</label>' + stp('lMin', t.time_late_apply_work_late) + '</div><div class="afield"><label>Ghi chú đi muộn</label><textarea id="lNote" placeholder="Nhập ghi chú"></textarea></div><div class="afield"><label>Số phút về sớm</label>' + stp('sMin', t.time_late_apply_work_soon) + '</div><div class="afield"><label>Ghi chú về sớm</label><textarea id="sNote" placeholder="Nhập ghi chú"></textarea></div>',
      bottom: '<button class="abtn" data-act="lateSave" data-id="' + t.id + '">Lưu</button>'
    };
  }
  A.stp = (d) => { const el = document.getElementById(d.t); let v = parseInt(el.value, 10) || 0; if (d.d === '-1') { v = v <= 1 ? '' : v - 1; } else v += 5; el.value = v; };
  A.lateSave = async (d) => {
    const l = parseInt(document.getElementById('lMin').value, 10) || 0, s = parseInt(document.getElementById('sMin').value, 10) || 0;
    if (!l && !s) return dialog('Thông báo', 'Vui lòng nhập phút hợp lệ');
    const r = E.api.submitLateSoon(user().staff_id, Number(d.id), { late: l, lateNote: document.getElementById('lNote').value, soon: s, soonNote: document.getElementById('sNote').value });
    await resultD(r); if (r.ok) pop();
  };

  function scrMOt(p) {
    const t = Store.tw(p.id);
    return {
      title: 'Làm thêm giờ', note: 'app-ot',
      body: '<div class="acard">Ngày làm việc: <b>' + T.dayNames[T.weekday(t.working_day)] + ', ' + T.dmy(t.working_day) + '</b><br>Ca: ' + esc(E.shiftOf(t).shift_name) + '</div><div class="afield"><label>Địa điểm làm việc *</label><select id="oBr">' + UI.opt(S().branches, t.branch_id, 'branch_id', 'branch_name', 'Chọn') + '</select></div><div class="afield"><label>Thời gian bắt đầu *</label><input type="datetime-local" id="oS" value="' + t.working_end_day + 'T' + t.working_end_time + '"></div><div class="afield"><label>Giờ kết thúc *</label><input type="datetime-local" id="oE"></div><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="oNo"> Không cần chấm công</label>',
      bottom: '<button class="abtn" data-act="otSave" data-id="' + t.id + '">Lưu</button>'
    };
  }
  A.otSave = async (d) => {
    const t = Store.tw(d.id); const br = document.getElementById('oBr').value, s = document.getElementById('oS').value, e = document.getElementById('oE').value;
    if (!br) return dialog('Thông báo', 'Bạn chưa chọn Địa điểm làm việc');
    if (!s) return dialog('Thông báo', 'Bạn chưa chọn Thời gian bắt đầu');
    if (!e) return dialog('Thông báo', 'Bạn chưa chọn Thời gian kết thúc');
    if (e <= s) return dialog('Thông báo', 'Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu');
    const r = E.api.createOvertime(user().staff_id, { staff_id: t.staff_id, branch_id: br, shift_id: t.shift_id, working_day: s.slice(0, 10), working_time: s.slice(11, 16), working_end_day: e.slice(0, 10), working_end_time: e.slice(11, 16), is_not_check_in: document.getElementById('oNo').checked });
    await resultD(r); if (r.ok) pop();
  };

  function scrAddShift(p, mgr) {
    const day = p.day; const staffId = mgr ? Number(p.staff) : user().staff_id; const br = p.br || Store.staff(staffId).branch_id; const key = T.dayKeys[T.weekday(day)];
    const shifts = S().shifts.filter((s) => s.is_actived && !s.is_deleted && !s.is_system && s.branches.includes(Number(br)) && s[key]);
    return {
      title: 'Thêm ca',
      body: '<div class="acard">Ngày làm việc: <b>' + T.dayNames[T.weekday(day)] + ', ' + T.dmy(day) + '</b>' + (mgr ? '<br>Nhân viên: ' + esc(E.staffName(staffId)) : '') + '</div><div class="afield"><label>Ca *</label><select id="asSh">' + UI.opt(shifts, '', 'shift_id', 'shift_name', 'Chọn ca làm việc của bạn') + '</select></div><div class="afield"><label>Chi nhánh *</label><select id="asBr" data-chg="asBr">' + UI.opt(S().branches, br, 'branch_id', 'branch_name') + '</select></div><div class="afield"><label>Ghi đè thời gian (Tùy chọn)</label><div style="display:flex;gap:6px"><input type="time" id="asS"><input type="time" id="asE"></div></div>',
      bottom: '<button class="abtn" data-act="asSave" data-day="' + day + '" data-staff="' + staffId + '">Lưu</button>'
    };
  }
  A.asBr = (d, el) => { top().br = Number(el.value); App.render(); };
  A.asSave = async (d) => {
    const sh = document.getElementById('asSh').value; const s = document.getElementById('asS').value, e = document.getElementById('asE').value;
    if (!sh) return dialog('Thông báo', 'Bạn chưa chọn Ca');
    if (s && e && e <= s) return dialog('Thông báo', 'Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu');
    const r = E.api.addShiftStaff(user().staff_id, { staff_id: Number(d.staff), branch_id: document.getElementById('asBr').value, shift_id: sh, working_day: d.day, working_time: s, working_end_time: e });
    await resultD(r); if (r.ok) pop();
  };

  /* ================= CHẤM CÔNG THÁNG ================= */
  function scrTkMonth() {
    const u = user(); const today = Store.today();
    const st = Store.cfg('close_time_working_start'), en = Store.cfg('close_time_working_end');
    const sd = st.is_actived ? Number(st.value) : 26, ed = en.is_actived ? Number(en.value) : 25;
    const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
    const from = T.ymd(new Date(y, m - 2, sd)), to = T.ymd(new Date(y, m - 1, ed));
    const list = E.active().filter((t) => t.staff_id === u.staff_id && t.working_day >= from && t.working_day <= to);
    let std = 0, act = 0; const byCode = {};
    list.forEach((t) => { std += Number(t.min_time_work || 0); act += Number(t.actual_time_work_confirmed || 0); if (t.shift_code_approved) byCode[t.shift_code_approved] = (byCode[t.shift_code_approved] || 0) + 1; });
    const l = S().leaveDays.find((x) => x.staff_id === u.staff_id) || { total_leave_day: 0, total_using_leave_day: 0, total_using_remaining_day: 0 };
    return {
      title: 'Chấm công', note: 'cfg-close',
      body: '<div class="acard"><div class="kv"><span>Từ ngày</span><b>' + T.dmy(from) + '</b></div><div class="kv"><span>Đến ngày</span><b>' + T.dmy(to) + '</b></div><div style="font-size:11.5px;color:#b58d3e;margin-top:6px">Kỳ công: ngày ' + sd + ' tháng trước → ngày ' + ed + ' tháng này' + (en.is_actived ? '' : ' (dòng "Đến ngày" luôn bị lưu tắt nên API dùng mặc định 25)') + '</div></div>' +
        '<div class="acard"><div class="kv"><span><b>Giờ công chuẩn</b></span><b>' + T.fmtH(std) + '</b></div><div class="kv"><span style="color:#3398dc"><b>Giờ công thực tế</b></span><b style="color:#3398dc">' + T.fmtH(act) + '</b></div>' + Object.entries(byCode).map(([k, v]) => '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>').join('') + '</div>' +
        '<div class="acard"><div class="kv"><span><b>Tổng số ngày nghỉ</b></span><b>' + l.total_leave_day + '</b></div><div class="kv"><span style="color:#c62828">Tổng số ngày nghỉ đã sử dụng</span><b>' + l.total_using_leave_day + '</b></div><div class="kv"><span style="color:#1b7a5c">Tổng số ngày nghỉ còn lại</span><b>' + l.total_using_remaining_day + '</b></div></div>',
      bottom: '<button class="abtn" data-act="ago" data-n="schedule">Danh sách lịch làm việc</button>'
    };
  }

  /* ================= LỊCH SỬ CHẤM CÔNG (tháng) ================= */
  function scrHistory(p) {
    const u = user(); const today = Store.today(); const first = today.slice(0, 8) + '01';
    const startPad = (T.weekday(first) + 6) % 7; const sel = p.sel || today;
    const d0 = T.dt(first); d0.setMonth(d0.getMonth() + 1); d0.setDate(0); const nd = d0.getDate();
    let cells = '';
    for (let i = 0; i < startPad; i++) cells += '<div></div>';
    for (let i = 1; i <= nd; i++) {
      const day = first.slice(0, 8) + T.pad(i);
      const list = E.active().filter((t) => t.staff_id === u.staff_id && t.working_day === day);
      const bg = list.length ? E.portalColor(list[list.length - 1], true).color : '#fff';
      cells += '<div class="d ' + (list.some((t) => t.is_ot) ? 'ot ' : '') + (day === sel ? 'sel' : '') + '" style="background:' + bg + '" data-act="hSel" data-day="' + day + '">' + i + (Store.isHoliday(day) ? '<span style="position:absolute;font-size:8px">🎌</span>' : '') + '</div>';
    }
    const logs = E.active().filter((t) => t.staff_id === u.staff_id && t.working_day === sel).map((t) => { const ci = E.firstIn(t), co = E.lastOut(t); return '<div class="acard ' + '" style="background:' + E.portalColor(t, true).color + ';' + (t.is_ot ? 'box-shadow:inset 0 0 0 2px #F44336' : '') + '"><b>' + esc(E.shiftOf(t).shift_name) + '</b><div>' + T.dmy(t.working_day) + ' ' + t.working_time + ' - ' + t.working_end_time + '</div><div>Vào ca (' + (ci ? ci.time : '--:--') + ') · Ra ca (' + (co ? co.time : '--:--') + ')</div><div style="font-size:11.5px;color:#555">' + esc(E.portalColor(t, true).why) + '</div></div>'; }).join('');
    return { title: 'Lịch sử chấm công', note: 'app-history', body: '<div class="acard"><div class="cal">' + ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((x) => '<div class="h">' + x + '</div>').join('') + cells + '</div></div>' + (logs || '<div class="acard" style="text-align:center;color:#999">Chưa có lịch sử chấm công</div>') };
  }
  A.hSel = (d) => { top().sel = d.day; App.render(); };

  function scrManageTk() {
    const today = Store.today();
    const list = E.active().filter((t) => t.working_day === today);
    return { title: 'Lịch sử chấm công', body: '<div class="acard"><b>' + T.dmy(today) + '</b><div class="kv"><span>Vào ca</span><b>' + list.filter((t) => t.ins.length).length + '/' + list.length + '</b></div><div class="kv"><span>Ra ca</span><b>' + list.filter((t) => t.outs.length).length + '/' + list.length + '</b></div></div>' + list.map((t) => '<div class="acard"><b>' + esc(E.staffName(t.staff_id)) + '</b> · ' + esc(E.shiftOf(t).shift_name) + '<div>Vào: ' + (E.firstIn(t) ? E.firstIn(t).time : '--:--') + ' · Ra: ' + (E.lastOut(t) ? E.lastOut(t).time : '--:--') + '</div></div>').join('') };
  }

  /* ================= QUẢN LÝ: LLV NHÂN VIÊN ================= */
  const managed = () => { const u = user(); return S().staffs.filter((s) => s.staff_manager_id === u.staff_id || (u.is_admin && s.staff_id !== u.staff_id)); };
  function scrPgList(p) {
    const days = weekOf(AP.pgWeekOff); const fs = p.fs || ['all'];
    const rows = managed().map((s) => ({ s, g: groupCounts(E.active().filter((t) => t.staff_id === s.staff_id && t.working_day >= days[0] && t.working_day <= days[6])) }))
      .filter(({ g }) => fs.includes('all') || fs.some((k) => g.c[k] > 0));
    let te = 0, ta = 0; rows.forEach(({ g }) => { te += g.est; ta += g.act; });
    const chips = [['all', 'Tất cả', '#3398dc'], ...Object.keys(E.STATUS).filter((k) => k !== 'not-approved').map((k) => [k, E.STATUS[k].label, E.STATUS[k].color])];
    return {
      title: 'Danh sách lịch làm việc', note: 'app-pglist',
      body: '<div class="week-h"><button data-act="pwk" data-d="-1">‹</button><span style="flex:1;text-align:center">Tuần ' + T.isoWeek(days[0]) + ' (' + T.dmy(days[0]) + ' - ' + T.dmy(days[6]) + ')</span><button data-act="pwk" data-d="1">›</button></div><div class="chips">' + chips.map(([k, l, c]) => '<button class="' + (fs.includes(k) ? 'on' : '') + '" style="' + (fs.includes(k) ? 'background:' + c : '') + '" data-act="pgChip" data-k="' + k + '">' + l + '</button>').join('') + '</div>' +
        (rows.length ? rows.map(({ s, g }) => '<div data-act="ago" data-n="pg" data-staff="' + s.staff_id + '" style="cursor:pointer">' + pgSummary(s.full_name, Store.branch(s.branch_id).branch_name, g) + '</div>').join('') : '<div class="acard" style="text-align:center;color:#999">Chưa có dữ liệu<br><small>(bạn không quản lý nhân viên nào — hãy đăng nhập bằng Trần Minh Quân)</small></div>'),
      bottom: '<div style="flex:1"><div style="font-size:12px;color:#888">Tổng giờ ước tính</div><b style="color:#3398dc">' + T.fmtH(te) + '</b></div><div style="flex:1"><div style="font-size:12px;color:#888">Tổng giờ thực tế</div><b style="color:#3398dc">' + T.fmtH(ta) + '</b></div>'
    };
  }
  A.pwk = (d) => { AP.pgWeekOff += Number(d.d); App.render(); };
  A.pgChip = (d) => {
    const p = top(); let fs = p.fs || ['all'];
    if (d.k === 'all') fs = ['all'];
    else { fs = fs.filter((x) => x !== 'all'); if (fs.includes(d.k)) { if (fs.length > 1) fs = fs.filter((x) => x !== d.k); } else fs.push(d.k); }
    p.fs = fs; App.render();
  };

  function scrPg(p) {
    const days = weekOf(AP.pgWeekOff); const sid = Number(p.staff);
    const all = E.active().filter((t) => t.staff_id === sid && t.working_day >= days[0] && t.working_day <= days[6]).sort((a, b) => (a.working_day + a.working_time).localeCompare(b.working_day + b.working_time));
    if (p.f == null) p.f = all.some((t) => t.time_working_staff_status === 'waiting') ? 'waiting' : 'all';
    const list = p.f === 'all' ? all : all.filter((t) => t.time_working_staff_status === p.f);
    const chips = [['all', 'Tất cả', '#3398dc'], ['waiting', 'Chờ duyệt'], ['approved', 'Đã duyệt'], ['not-confirm', 'Chờ xác nhận'], ['confirmed', 'Đã xác nhận']].map(([k, l, c]) => [k, l, c || E.STATUS[k].color]);
    let bottom = '';
    if (p.f === 'waiting' && list.length) bottom = '<button class="abtn" data-act="pgApproveAll" data-staff="' + sid + '">Duyệt tất cả</button>';
    if (p.f === 'not-confirm' && list.length) bottom = '<button class="abtn" data-act="pgConfirmAll" data-staff="' + sid + '">Xác nhận tất cả</button>';
    return {
      title: 'Lịch làm việc', note: 'app-pg',
      body: '<div class="week-h"><span style="flex:1;text-align:center">Tuần ' + T.isoWeek(days[0]) + ' (' + T.dmy(days[0]) + ' - ' + T.dmy(days[6]) + ')</span></div><div class="chips">' + chips.map(([k, l, c]) => { const n = k === 'all' ? '' : all.filter((t) => t.time_working_staff_status === k).length; return '<button class="' + (p.f === k ? 'on' : '') + '" style="' + (p.f === k ? 'background:' + c : '') + '" data-act="pgF" data-k="' + k + '">' + l + (n ? '<span class="cnt">' + n + '</span>' : '') + '</button>'; }).join('') + '</div><div class="acard" style="text-align:center">Nhân viên: <b>' + esc(E.staffName(sid)) + '</b></div>' +
        (list.length ? list.map((t) => schedCard(t, { mine: false, open: 'pgOpen' })).join('') : '<div class="acard" style="text-align:center;color:#999">Không có lịch làm việc</div>'),
      bottom
    };
  }
  A.pgF = (d) => { top().f = d.k; App.render(); };
  A.pgOpen = (d) => push('pgDetail', { id: Number(d.id) });
  A.pgApproveAll = async (d) => {
    const days = weekOf(AP.pgWeekOff);
    const list = E.active().filter((t) => t.staff_id === Number(d.staff) && t.working_day >= days[0] && t.working_day <= days[6] && t.time_working_staff_status === 'waiting');
    if (!(await confirmD('Đã duyệt tất cả thời gian làm việc'))) return;
    UI.showNote('app-pg');
    await resultD(E.api.approveAllV2(user().staff_id, list)); top().f = null; App.render();
  };
  A.pgConfirmAll = async (d) => {
    const days = weekOf(AP.pgWeekOff);
    const list = E.active().filter((t) => t.staff_id === Number(d.staff) && t.working_day >= days[0] && t.working_day <= days[6] && t.time_working_staff_status === 'not-confirm');
    if (!(await confirmD('Xác nhận tất cả thời gian làm việc?'))) return;
    list.forEach((t) => E.api.acceptActualTime(user().staff_id, t.id, { actual_time_work: t.actual_time_work, is_attend: 0 }));
    await dialog('Thông báo', 'Đã gửi ' + list.length + ' request accept-actual-time song song'); top().f = null; App.render();
  };
  A.pgApproveOne = async (d) => { if (!(await confirmD('Đã duyệt thời gian làm việc'))) return; await resultD(E.api.approveOne(user().staff_id, Number(d.id))); pop(); };

  function scrPgConfirm(p) {
    const t = Store.tw(p.id); const att = p.attend === '1';
    let def = t.actual_time_work;
    if (def == null) { let m = T.toMin(t.working_end_time) - T.toMin(t.working_time); if (m < 0) m += 1440; def = T.hours(m); }
    return {
      title: 'Thời gian làm việc', note: 'app-confirm',
      body: '<div class="acard">' + esc(E.staffName(t.staff_id)) + ' · ' + T.dmy(t.working_day) + ' · ' + esc(E.shiftOf(t).shift_name) + (att ? '<br><span class="chip" style="background:#9C27B0">Chấm công hộ (is_attend = 1)</span>' : '') + '</div><div class="afield"><label>Thời gian làm việc thực tế</label><input id="cfA" inputmode="decimal" value="' + def + '"></div><div class="afield"><label>Chấm công</label><select id="cfC">' + S().shiftCodes.map((c) => '<option value="' + c.shift_code + '" data-c="' + c.timekeeping_coefficient + '"' + (c.shift_code === '1' ? ' selected' : '') + '>' + c.shift_code + ' (hệ số ' + c.timekeeping_coefficient + ')</option>').join('') + '</select></div>',
      bottom: '<button class="abtn" data-act="cfSave" data-id="' + t.id + '" data-attend="' + (att ? 1 : 0) + '">Xác nhận</button>'
    };
  }
  A.cfSave = async (d) => {
    if (!(await confirmD('Xác nhận thời gian làm việc?'))) return;
    const sel = document.getElementById('cfC'); const o = sel.options[sel.selectedIndex];
    const r = E.api.acceptActualTime(user().staff_id, Number(d.id), { actual_time_work: document.getElementById('cfA').value.replace(',', '.'), shift_code_approved: o.value, timekeeping_coefficient: o.dataset.c, is_attend: Number(d.attend) });
    await resultD(r); AP.overlay = null; pop();
  };

  function scrPgLate(p) {
    const t = Store.tw(p.id);
    const stp = (id, v) => '<div class="stepper"><button data-act="stp" data-t="' + id + '" data-d="-1">−</button><input id="' + id + '" placeholder="' + v + '" value=""><button data-act="stp" data-t="' + id + '" data-d="5">+</button></div>';
    return {
      title: 'Duyệt lịch làm việc', note: 'app-pglate',
      body: '<div class="acard">Nhân viên: <b>' + esc(E.staffName(t.staff_id)) + '</b><br>' + T.dmy(t.working_day) + ' · Ca: ' + esc(E.shiftOf(t).shift_name) + '</div><div class="acard"><b>Đơn phép: Đi muộn/Về sớm</b>' +
        (t.time_late_apply_work_late ? '<div class="afield"><label>Số phút đi muộn</label>' + stp('plL', t.time_late_apply_work_late) + '<div style="font-size:12px;color:#666">Ghi chú đi muộn: ' + esc(t.time_late_apply_work_late_note) + '</div></div>' : '') +
        (t.time_late_apply_work_soon ? '<div class="afield"><label>Số phút về sớm</label>' + stp('plS', t.time_late_apply_work_soon) + '<div style="font-size:12px;color:#666">Ghi chú về sớm: ' + esc(t.time_late_apply_work_soon_note) + '</div></div>' : '') + '</div>',
      bottom: '<button class="abtn" data-act="plSave" data-id="' + t.id + '">Phê duyệt</button>'
    };
  }
  A.plSave = async (d) => {
    const t = Store.tw(d.id);
    const g = (id, orig) => { const el = document.getElementById(id); if (!el) return 0; return el.value === '' ? orig : (parseInt(el.value, 10) || 0); };
    if (!(await confirmD('Đã duyệt thời gian làm việc'))) return;
    await resultD(E.api.approveLateSoon(user().staff_id, t.id, { late: g('plL', t.time_late_apply_work_late), soon: g('plS', t.time_late_apply_work_soon) }));
    pop(); pop();
  };
  function scrPgShift(p) {
    const t = Store.tw(p.id); const key = T.dayKeys[T.weekday(t.working_day)];
    const shifts = S().shifts.filter((s) => s.is_actived && !s.is_deleted && s[key]);
    return {
      title: 'Duyệt lịch làm việc', note: 'app-pgshift',
      body: '<div class="acard">Nhân viên: <b>' + esc(E.staffName(t.staff_id)) + '</b><br>' + T.dmy(t.working_day) + ' ' + UI.statusChip(t.time_working_staff_status) + '</div><div class="afield"><label>Đổi ca *</label><select id="psSh">' + UI.opt(shifts, t.shift_id, 'shift_id', 'shift_name', 'Chọn ca làm việc của bạn') + '</select></div><div class="acard">Ca cũ: <b style="color:#c62828">' + esc(E.shiftOf({ shift_id: t.old_shift_id }).shift_name) + '</b><br>Lý do: ' + esc(t.old_shift_note) + '</div>',
      bottom: '<button class="abtn" data-act="psSave" data-id="' + t.id + '">Xác nhận</button>'
    };
  }
  A.psSave = async (d) => {
    const t = Store.tw(d.id); const s = Store.shift(document.getElementById('psSh').value);
    let status = (s.checking_type == null || s.checking_type === 0) ? 'not-confirm' : 'approved';
    const both = t.time_late_apply_work_soon > 0 && !t.is_approve_soon && t.time_late_apply_work_late > 0 && !t.is_approve_late;
    if (both) status = null;
    if (!(await confirmD(both ? 'Đơn phép đã được duyệt' : 'Đã duyệt thời gian làm việc'))) return;
    const r = E.api.approveChangeShift(user().staff_id, t.id, { shift_id: s.shift_id, status });
    await resultD(r);
    if (both) { AP.stack.pop(); push('pgLate', { id: t.id }); } else { pop(); pop(); }
  };

  /* --- sheet Đổi ca / Chấm công thủ công (quản lý) --- */
  A.pgChange = (d) => {
    const t = Store.tw(d.id); const key = T.dayKeys[T.weekday(t.working_day)];
    const shifts = S().shifts.filter((s) => s.is_actived && !s.is_deleted && s[key] && s.branches.includes(t.branch_id));
    sheet('Đổi ca', '<div class="afield"><label>Chi nhánh</label><select id="csBr">' + UI.opt(S().branches, t.branch_id, 'branch_id', 'branch_name') + '</select></div><div class="afield"><label>Ca</label><select id="csSh">' + UI.opt(shifts, t.shift_id, 'shift_id', 'shift_name', 'Ca') + '</select></div><div class="afield"><label>Ghi đè thời gian (Tùy chọn)</label><div style="display:flex;gap:6px"><input type="time" id="csS" value="' + t.working_time + '"><input type="time" id="csE" value="' + t.working_end_time + '"></div><div style="font-size:11.5px;color:#b58d3e">Không kiểm tra giờ kết thúc > giờ bắt đầu</div></div><button class="abtn" style="width:100%" data-act="csSave" data-id="' + t.id + '">Chấp nhận</button>' + N('app-change'));
  };
  A.csSave = async (d) => {
    const sh = document.getElementById('csSh').value; if (!sh) return dialog('Thông báo', 'Vui lòng chọn ca làm việc');
    const r = E.api.changeShift(user().staff_id, Number(d.id), { shift_id: sh, branch_id: document.getElementById('csBr').value, working_time: document.getElementById('csS').value, working_end_time: document.getElementById('csE').value });
    AP.overlay = null; App.render(); await resultD(r); App.render();
  };
  A.pgManual = (d) => push('pgConfirm', { id: Number(d.id), attend: '1' });

  /* ================= BÁO CÁO TUẦN ================= */
  function scrReport() {
    const days = weekOf(AP.pgWeekOff); const today = Store.today();
    const staffs = managed().length ? managed() : S().staffs;
    const head = '<tr><th style="text-align:left">Nhân viên <span class="chip" style="background:#e53935">' + staffs.length + '</span></th>' + days.map((d) => '<th class="' + (d === today ? 'today' : '') + '" data-act="noop">' + ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][T.weekday(d)] + '<br>' + d.slice(8) + '</th>').join('') + '</tr>';
    const body = staffs.map((s) => '<tr><td style="min-width:84px;cursor:pointer" data-act="ago" data-n="pg" data-staff="' + s.staff_id + '"><b>' + esc(s.full_name.split(' ').slice(-2).join(' ')) + '</b><br><small>' + esc(Store.branch(s.branch_id).branch_name.replace('Chi nhánh ', '')) + '</small></td>' + days.map((d) => {
      const list = E.active().filter((t) => t.staff_id === s.staff_id && t.working_day === d);
      if (!list.length) return '<td><div class="add" data-act="ago" data-n="mgrAdd" data-day="' + d + '" data-staff="' + s.staff_id + '">⊕</div></td>';
      return '<td>' + list.map((t) => { const rs = E.REPORT[E.reportStatus(t)]; return '<div class="sh" style="border-color:' + rs.color + '" data-act="rpSheet" data-id="' + t.id + '"><b>' + esc(E.shiftOf(t).shift_name.replace('Ca ', '')) + '</b><br>' + (E.firstIn(t) ? E.firstIn(t).time : '--') + '/' + (E.lastOut(t) ? E.lastOut(t).time : '--') + '</div>'; }).join('') + '</td>';
    }).join('') + '</tr>').join('');
    const legend = Object.values(E.REPORT).map((r) => '<span class="chip" style="background:' + r.color + ';color:#222;margin:2px">' + r.label + '</span>').join('');
    return { title: 'Báo cáo lịch làm việc nhân viên', note: 'app-report', body: '<div class="week-h"><button data-act="pwk" data-d="-1">‹</button><span style="flex:1;text-align:center">Tuần ' + T.isoWeek(days[0]) + ' (' + T.dm(days[0]) + ' - ' + T.dm(days[6]) + ')</span><button data-act="pwk" data-d="1">›</button></div><div style="overflow:auto;background:#fff;border-radius:10px"><table class="roster"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div><div style="margin-top:8px">' + legend + '</div>' };
  }
  A.rpSheet = (d) => {
    const t = Store.tw(d.id); const rs = E.REPORT[E.reportStatus(t)];
    const ins = t.ins.map((x) => { const o = E.outOf(t, x.step); return 'Check in/out ' + x.step + ': ' + x.time + '/' + (o ? o.time : '--:--'); }).join('<br>') || 'Check in/out: --:--/--:--';
    sheet('Chi tiết lịch làm việc - ' + T.dmy(t.working_day), '<div class="acard"><b>' + esc(E.shiftOf(t).shift_name) + '</b><div>Thời gian làm việc: ' + t.working_time + ' - ' + t.working_end_time + '</div><div>' + ins + '</div><div>Chi nhánh: ' + esc(Store.branch(t.branch_id).branch_name) + '</div><div>Trạng thái: <span class="chip" style="background:' + rs.color + ';color:#222">' + rs.label + '</span></div></div>' +
      (E.app.canChangeShift(t) ? '<button class="abtn sec" style="width:100%;margin-bottom:6px" data-act="pgChange" data-id="' + t.id + '">Đổi ca</button>' : '') + (E.app.canProxy(t) ? '<button class="abtn" style="width:100%" data-act="rpManual" data-id="' + t.id + '">Chấm công thủ công</button>' : ''));
  };
  A.rpManual = (d) => { AP.overlay = null; push('pgConfirm', { id: Number(d.id), attend: '1' }); };

  /* ================= RENDER ================= */
  const SCR = {
    home: scrHome, checkinout: scrCheckInOut, schedule: scrSchedule, mDetail: (p) => scrDetail(p, false), mShift: scrMShift, mLate: scrMLate, mOt: scrMOt,
    mAddShift: (p) => scrAddShift(p, false), mgrAdd: (p) => scrAddShift(p, true), tkMonth: scrTkMonth, history: scrHistory, manageTk: scrManageTk,
    pgList: scrPgList, pg: scrPg, pgDetail: (p) => scrDetail(p, true), pgConfirm: scrPgConfirm, pgLate: scrPgLate, pgShift: scrPgShift, report: scrReport
  };
  const App = {
    render() {
      const p = top(); const fn = SCR[p.n] || scrHome; const r = fn(p);
      const sb = '<div class="statusbar"><span>' + T.hm(Store.now()) + '</span><span>' + (AP.sim.net ? '📶' : '✈') + ' ' + (AP.sim.gps ? '📍' : '') + ' 🔋</span></div>';
      let inner;
      if (r.raw) inner = sb + '<div class="abody" style="padding:0">' + r.html + '</div>';
      else inner = sb + '<div class="appbar">' + (AP.stack.length > 1 ? '<button data-act="aback">←</button>' : '') + '<h1>' + r.title + '</h1>' + (r.note ? N(r.note) : '') + (r.right || '') + '</div><div class="abody">' + r.body + '</div>' + (r.bottom ? '<div class="abottom">' + r.bottom + '</div>' : '');
      document.getElementById('main').innerHTML = '<div class="app-stage">' + simPanel() + '<div class="phone"><div class="screen">' + inner + (AP.overlay || '') + '</div></div></div>';
      if (p.n === 'checkinout' && p.done) {
        const u = user(); const pos = u.check_in_limit !== 0 ? device() : null; const t = Store.tw(p.id); const b = Store.branch(t.branch_id);
        drawSelfie(p.isIn, u.full_name, pos, pos ? T.distance(b.latitude, b.longitude, pos.lat, pos.lng) : null);
      }
    },
    reset() { AP.stack = [{ n: 'home' }]; AP.overlay = null; }
  };
  window.App = App;
})();
