/* ===== Bộ dựng giao diện mô phỏng: Portal web (Metronic) + App nhân viên (Flutter) ===== */
(function () {
  const H = window.HDSD, esc = H.esc;
  const t = (vi, en) => (H.lang === 'en' && en != null ? en : vi);
  const ha = (h) => (h ? ' data-h="' + h + '"' : '');
  const K = H.K = { t, esc };

  /* thông báo hệ thống: bản EN kèm nguyên văn tiếng Việt hiển thị trên hệ thống */
  K.m = (vi, en) => (H.lang === 'en' ? en + '<span class="orig">“' + vi + '”</span>' : vi);

  /* ---------- dữ liệu mẫu dùng chung (tuần 42: 12/10 – 18/10/2026, hôm nay = Thứ 4 14/10) ---------- */
  K.P = { admin: 'Nguyễn Thị Hoa', mgr: 'Trần Minh Quân', an: 'Lê Văn An', binh: 'Phạm Thu Bình' };
  K.WHO = {
    admin: ['Nguyễn Thị Hoa · Admin/HR', 'Nguyễn Thị Hoa · Admin/HR'],
    mgr: ['Trần Minh Quân · Quản lý trực tiếp', 'Trần Minh Quân · Direct manager'],
    an: ['Lê Văn An · Nhân viên', 'Lê Văn An · Staff'],
    binh: ['Phạm Thu Bình · Nhân viên', 'Phạm Thu Bình · Staff']
  };
  K.br1 = () => t('Chi nhánh Quận 1', 'District 1 branch');
  K.br2 = () => t('Chi nhánh Thủ Đức', 'Thu Duc branch');
  K.sang = () => t('Ca sáng', 'Morning shift');
  K.chieu = () => t('Ca chiều', 'Afternoon shift');
  K.d = (i) => (12 + i) + '/10/2026';
  K.dn = (i) => [t('Thứ 2', 'Mon'), t('Thứ 3', 'Tue'), t('Thứ 4', 'Wed'), t('Thứ 5', 'Thu'), t('Thứ 6', 'Fri'), t('Thứ 7', 'Sat'), t('Chủ nhật', 'Sun')][i];
  K.wk = () => t('Tuần 42 (12/10/2026 - 18/10/2026)', 'Week 42 (12/10/2026 - 18/10/2026)');

  K.ST = {
    waiting: { c: '#E91E63', l: () => t('Chờ duyệt', 'Pending approval') },
    approved: { c: '#2196F3', l: () => t('Đã duyệt', 'Approved') },
    rejected: { c: '#212121', l: () => t('Không được duyệt', 'Not approved') },
    nc: { c: '#FF9800', l: () => t('Chờ xác nhận', 'Pending confirmation') },
    confirmed: { c: '#4CAF50', l: () => t('Đã xác nhận', 'Confirmed') },
    proxy: { c: '#9C27B0', l: () => t('Chấm công hộ', 'Proxy attendance') }
  };
  K.chip = (st) => '<span class="chip" style="background:' + K.ST[st].c + '">' + K.ST[st].l() + '</span>';
  K.COL = {
    future: { c: '#D3D3D3', l: () => t('Chưa đến ca', 'Not yet due') },
    ok: { c: '#3FAE8F', dark: 1, l: () => t('Chấm công đúng giờ', 'On time') },
    miss: { c: '#F08A5D', dark: 1, l: () => t('Chưa vào/ra ca', 'Missing in/out') },
    late: { c: '#F2B84B', l: () => t('Vào trễ/ra sớm', 'Late in / early out') },
    paid: { c: '#8E9FE6', dark: 1, l: () => t('Nghỉ phép có lương', 'Paid leave') },
    unpaid: { c: '#E5E0FF', l: () => t('Nghỉ phép không lương', 'Unpaid leave') }
  };
  K.swatch = (col) => '<span class="swatch" style="background:' + K.COL[col].c + ';color:' + (K.COL[col].dark ? '#fff' : '#1e2235') + '">' + K.COL[col].l() + '</span>';

  /* ================= WEB ================= */
  const NAV = () => [['shift', '◷', t('Ca làm việc', 'Shifts')], ['tws', '▤', t('Lịch làm việc', 'Schedule')], ['tk', '☑', t('Bảng chấm công', 'Timesheet')], ['rate', '％', t('Báo cáo Rate', 'Rate report')], ['cfg', '⚙', t('Cấu hình', 'Settings')], ['att', '⏱', t('Lịch sử', 'History')], ['rec', '★', t('Thưởng phạt', 'Reward/Fine')]];
  K.web = (o) => '<div class="portal"><nav class="p-aside"><div class="logo">M</div>' + NAV().map(([k, ic, l]) => '<button class="' + (o.nav === k ? 'on' : '') + '" data-h="nav-' + k + '"><span class="ic">' + ic + '</span>' + l + '</button>').join('') +
    '</nav><div class="p-wrap"><div class="p-header"><span class="title_header">' + t('QUẢN LÝ NHÂN VIÊN', 'STAFF MANAGEMENT') + '</span><span class="sp"></span><span class="p-user">👤 ' + (o.user || K.P.admin + ' (Admin)') + '</span></div><div class="p-content" data-scroll="web-' + (o.nav || '') + '">' + o.body + '</div></div>' + (o.over || '') + '</div>';
  K.portlet = (title, tools, body) => '<div class="portlet"><div class="portlet-head"><h2>' + title + '</h2><div class="tools">' + (tools || '') + '</div></div><div class="portlet-body">' + body + '</div></div>';
  K.tabs = (list) => '<div class="ptabs">' + list.map(([l, h, on]) => '<button class="' + (on ? 'on' : '') + '"' + ha(h) + '>' + l + '</button>').join('') + '</div>';
  K.btn = (label, h, cls) => '<button class="btn ' + (cls || 'btn-primary btn-pill') + '"' + ha(h) + '>' + label + '</button>';
  K.table = (heads, rows, h) => '<table class="pt"' + ha(h) + '><thead><tr>' + heads.map((x) => (x && x.h ? '<th data-h="' + x.h + '">' + x.l + '</th>' : '<th>' + x + '</th>')).join('') + '</tr></thead><tbody>' +
    rows.map((r) => { const c = Array.isArray(r) ? r : r.c; return '<tr class="' + (r.cls || '') + '"' + ha(r.h) + '>' + c.map((x) => (x && x.h ? '<td data-h="' + x.h + '">' + x.v + '</td>' : '<td>' + x + '</td>')).join('') + '</tr>'; }).join('') + '</tbody></table>';
  K.filter = (arr) => '<div class="filter">' + arr.map((x) => (String(x).charAt(0) === '<' ? x : '<div class="fc sel ph">' + x + '</div>')).join('') + '</div>';
  K.inp = (h, val, o) => { o = o || {}; return '<input class="fc' + (o.dis ? ' dis' : '') + '" readonly' + ha(h) + ' value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(o.ph || '') + '"' + (o.w ? ' style="width:' + o.w + 'px"' : '') + '>'; };
  K.sel = (h, val, o) => {
    o = o || {};
    const box = '<div class="fc sel' + (val ? '' : ' ph') + (o.dis ? ' dis' : '') + '"' + ha(h) + (o.w ? ' style="width:' + o.w + 'px"' : '') + '>' + (val || o.ph || t('Chọn', 'Select')) + '</div>';
    if (!o.open) return box;
    return '<div class="selwrap"' + (o.w ? ' style="width:' + o.w + 'px"' : '') + '>' + box + '<div class="selopts">' + o.opts.map(([l, oh]) => '<div' + ha(oh) + '>' + l + '</div>').join('') + '</div></div>';
  };
  K.ck = (h, on, label) => '<span class="ckl"><span class="ck' + (on ? ' on' : '') + '"' + ha(h) + '></span>' + (label || '') + '</span>';
  K.rd = (h, on, label) => '<span class="ckl"><span class="ck rd' + (on ? ' on' : '') + '"' + ha(h) + '></span>' + (label || '') + '</span>';
  K.sw = (h, on) => '<span class="switch' + (on ? ' on' : '') + '"' + ha(h) + '></span>';
  K.row = (label, html, req, h) => '<div class="form-row"' + ha(h) + '><label>' + label + (req ? ' <span class="req">*</span>' : '') + '</label><div>' + html + '</div></div>';
  K.modal = (o) => '<div class="w-over"><div class="modal ' + (o.size || '') + '"><div class="modal-h"><h3>' + o.title + '</h3><span class="x">×</span></div><div class="modal-b" data-scroll="modal-' + esc(o.title) + '">' + o.body + '</div><div class="modal-f">' + (o.foot || '') + '</div></div></div>';
  K.swal = (o) => '<div class="w-over mid"><div class="swal"' + ha(o.h) + '><div class="ic ' + o.type + '">' + (o.type === 'success' ? '✓' : o.type === 'error' ? '✕' : '?') + '</div><h3>' + o.title + '</h3>' + (o.text ? '<p>' + o.text + '</p>' : '') + '<div class="acts">' +
    (o.btns || [[t('OK', 'OK'), 'ok', 1]]).map(([l, h, pri]) => K.btn(l, h, pri ? 'btn-primary' : 'btn-default')).join('') + '</div></div></div>';
  K.swalQ = (title, yes) => K.swal({ type: 'question', title, btns: [[t('Huỷ', 'Cancel'), '', 0], [t('Đồng ý', 'Yes'), yes || 'yes', 1]] });
  K.swalOk = (title, text) => K.swal({ type: 'success', title, text });
  K.swalErr = (title, text) => K.swal({ type: 'error', title, text });
  K.kv = (k, v) => '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>';
  K.avatar = (name) => '<div class="avatar" style="background:' + ['#5b8def', '#e07a5f', '#3d9970', '#8e6bbf'][name.length % 4] + '">' + name.split(' ').slice(-1)[0].charAt(0) + '</div>';

  const MENU = () => ({
    detail: ['👁', t('Chi tiết', 'Details')], edit: ['✎', t('Chỉnh sửa', 'Edit')], approve: ['✔', t('Duyệt lịch làm việc', 'Approve schedule')], confirm: ['⏲', 'Confirm working time'],
    add: ['+', t('Thêm ca làm việc', 'Add shift')], attend: ['👤', t('Chấm công hộ', 'Proxy attendance')], paid: ['☂', t('Nghỉ có lương', 'Paid leave')], unpaid: ['☂', t('Nghỉ không lương', 'Unpaid leave')],
    ot: ['⏩', t('Làm thêm giờ', 'Overtime')], del: ['🗑', t('Xoá', 'Delete')]
  });
  K.cmenu = (keys, left) => { const M = MENU(); return '<div class="dropdown' + (left ? ' lft' : '') + '" data-h="menu">' + keys.map((k) => (k === '-' ? '<hr>' : '<button data-h="m-' + k + '"><span>' + M[k][0] + '</span>' + M[k][1] + '</button>')).join('') + '</div>'; };
  K.cell = (c) => {
    if (!c) return '';
    if (c.add) return '<button class="cell-add" data-h="' + c.add + '">+</button>';
    const col = K.COL[c.col || 'future'];
    return '<div class="cell' + (col.dark ? ' dark' : '') + (c.ot ? ' ot' : '') + (c.isNew ? ' new' : '') + '" style="background:' + col.c + '"' + ha(c.ch) + '><div class="sn">' + c.sn + '</div><span class="dots"' + ha(c.h) + '>⋮</span><div>(' + c.tm + ')</div><div class="br">' + (c.br || K.br1()) + '</div>' +
      (c.st ? '<span class="stt">' + K.ST[c.st].l() + '</span>' : '') + (c.note ? '<div style="font-size:9.5px;opacity:.85">' + c.note + '</div>' : '') + (c.menu || '') + '</div>';
  };
  K.grid = (o) => '<table class="grid-tws"' + ha(o.h) + '><thead><tr><th class="staff">' + t('Nhân viên', 'Employee') + '</th>' + [0, 1, 2, 3, 4, 5, 6].map((i) => '<th class="' + (i === 2 ? 'today ' : '') + (o.hol === i ? 'holiday' : '') + '">' + K.dn(i) + '<br>' + (12 + i) + '/10' + (o.hol === i ? '<br><small>' + t('Ngày lễ', 'Holiday') + '</small>' : '') + '</th>').join('') + '</tr></thead><tbody>' +
    o.rows.map((r) => '<tr><td><div class="staff-cell">' + K.avatar(r.name) + '<div><div class="nm"' + ha(r.h) + '>' + r.name + '</div><div class="sub">' + (r.sub || K.br1()) + '</div>' + (r.tag || '') + '</div></div></td>' + r.cells.map((c) => '<td>' + K.cell(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  K.legend = () => '<div class="legend" data-h="legend">' + Object.keys(K.COL).map((k) => '<span><i style="background:' + K.COL[k].c + '"></i>' + K.COL[k].l() + '</span>').join('') + '<span><i style="background:#fff;box-shadow:inset 0 0 0 2px red"></i>' + t('Tăng ca (viền đỏ)', 'Overtime (red border)') + '</span></div>';
  /* khung màn "Lịch làm việc theo nhân viên" */
  K.twsPage = (o) => K.web({ nav: 'tws', user: o.user, over: o.over, body: K.portlet(t('Lịch làm việc', 'Work schedule'), '', K.tabs([[t('Theo ca', 'By shift'), 'tab-shift', o.byShift], [t('Theo nhân viên', 'By employee'), 'tab-staff', !o.byShift]]) +
      K.filter(['2026', t('Theo tuần', 'By week'), K.wk(), t('Chọn ca làm', 'Shift'), t('Chọn chi nhánh', 'Branch'), t('Chọn nhân viên', 'Employee')]) + (o.grid || K.grid({ rows: o.rows, hol: o.hol })) + K.legend()) });

  /* ================= APP ================= */
  K.app = (o) => {
    const sb = '<div class="statusbar"><span>' + (o.time || '08:00') + '</span><span>📶 📍 🔋</span></div>';
    const over = (o.sheet ? '<div class="sheet-wrap"><div class="sheet"><h4>' + o.sheet.title + '</h4>' + o.sheet.body + '</div></div>' : '') +
      (o.dialog ? '<div class="adialog-wrap"><div class="adialog" data-h="dialog"><h4>' + (o.dialog.title || t('Thông báo', 'Notice')) + '</h4><p>' + o.dialog.msg + '</p><div class="acts">' + (o.dialog.btns || [[t('Đóng', 'Close'), 'dclose']]).map(([l, h]) => '<span' + ha(h) + '>' + l + '</span>').join('') + '</div></div></div>' : '');
    if (o.raw) return sb + '<div class="abody" style="padding:0" data-scroll="app-home">' + o.raw + '</div>' + over;
    return sb + '<div class="appbar">' + (o.back === false ? '' : '<button data-h="back">←</button>') + '<h1>' + o.title + '</h1>' + (o.right || '') + '</div><div class="abody" data-scroll="app-' + esc(o.title) + '">' + o.body + '</div>' + (o.bottom ? '<div class="abottom">' + o.bottom + '</div>' : '') + over;
  };
  const TILES = () => ({ llv: ['📅', 'LLV'], pg: ['👥', t('LLV nhân viên', 'Staff schedule')], month: ['🧾', t('Chấm công', 'Timekeeping')], hist: ['🗓', t('Lịch sử chấm công', 'Attendance history')], report: ['📊', t('Báo cáo chấm công', 'Attendance report')], manage: ['📋', t('Quản lý chấm công', 'Manage attendance')] });
  K.noti = (title, msg, h, isNew) => '<div class="acard noti' + (isNew ? ' new' : '') + '"' + ha(h) + '><div class="bell">🔔</div><div><b>' + title + '</b><div>' + msg + '</div></div></div>';
  K.home = (o) => {
    const T = TILES(); const c = o.card;
    const card = c === undefined ? '' : c === null ? '<div class="tk-hidden" data-h="card">' + t('Thẻ chấm công bị ẩn<br>(không có ca hợp lệ cho hôm nay)', 'Check-in card is hidden<br>(no valid shift for today)') + '</div>' :
      '<div class="tk-card" data-h="card"><div class="sn">' + c.sn + '</div><div class="row">' + t('Thời gian', 'Time') + ': ' + c.time + '</div>' + (c.laps || []).map((x, i) => '<div class="row">' + t('Lần', 'Round') + ' ' + (i + 1) + ': ' + x + '</div>').join('') +
      (c.btn === 'in' ? '<button class="big" style="background:#FF9800" data-h="btn-in">' + t('Giờ vào', 'Clock in') + '</button>' : c.btn === 'out' ? '<button class="big" style="background:#F44336" data-h="btn-out">' + t('Giờ ra', 'Clock out') + '</button>' : '') + '</div>';
    return '<div class="home-hero"><div class="hi">' + t('Xin chào,', 'Hello,') + '</div><div class="nm">' + o.name + '</div><div class="hi">' + (o.branch || K.br1()) + '</div></div>' + card +
      '<div class="menu-grid" data-h="tiles">' + (o.tiles || ['llv', 'pg', 'month', 'hist']).map((k) => '<div class="mi" data-h="t-' + k + '"><span class="ic">' + T[k][0] + '</span>' + T[k][1] + '</div>').join('') + '</div>' +
      (o.noti && o.noti.length ? '<div style="padding:10px"><b>' + t('Thông báo mới', 'New notifications') + '</b><div style="height:6px"></div>' + o.noti.join('') + '</div>' : '');
  };
  K.weekh = (label) => '<div class="week-h"><span class="bt">‹</span><span class="lb">' + (label || K.wk()) + '</span><span class="bt">›</span></div>';
  K.sched = (o) => '<div class="sched' + (o.ot ? ' ot' : '') + (o.isNew ? ' new' : '') + '"' + ha(o.h) + '><div class="top"><span>' + o.day + '</span>' + K.chip(o.st) + '</div><div class="ln">🏠 ' + (o.branch || K.br1()) + '</div><div class="ln">🗓 ' + o.shift + ' (' + o.time + ')</div>' +
    (o.act ? '<div class="ln">⏱ <b>' + o.act + '</b>' + (o.dur ? '<span style="margin-left:auto;color:#FF9800">' + o.dur + '</span>' : '') + '</div>' : '') + (o.lines || []).map((l) => '<div class="ln">' + l + '</div>').join('') +
    (o.coef ? '<div class="ln green">' + t('Hệ số công', 'Work coefficient') + ': ' + o.coef + '</div>' : '') + (o.est ? '<div class="ln orange">' + t('Thời gian ước lượng', 'Estimated time') + ': ' + o.est + ' ' + t('Giờ', 'h') + '</div>' : '') +
    (o.acts && o.acts.length ? '<div class="acts">' + o.acts.map(([l, h, cls]) => '<span class="' + (cls || '') + '"' + ha(h) + '>' + l + '</span>').join('') + '</div>' : '') + '</div>';
  K.akv = (k, v, color) => '<div class="kv"><span' + (color ? ' style="color:' + color + '"' : '') + '>' + k + '</span><b>' + v + '</b></div>';
  K.sum = (o) => '<div class="acard"' + ha(o.h) + '><b>' + o.name + '</b><div style="font-size:11.5px;color:#666">🏠 ' + (o.branch || K.br1()) + '</div>' +
    ['waiting', 'approved', 'nc', 'confirmed', 'proxy'].map((k) => K.akv(K.ST[k].l(), (o.c && o.c[k]) || 0, K.ST[k].c)).join('') +
    K.akv(t('Thời gian làm việc dự kiến', 'Planned hours'), (o.est || 0) + 'h') + K.akv(t('Thời gian làm việc thực tế', 'Actual hours'), (o.act || 0) + 'h') + K.akv(t('Thời gian làm việc được xác nhận', 'Confirmed hours'), (o.conf || 0) + 'h') + '</div>';
  K.acard = (html, h, cls) => '<div class="acard ' + (cls || '') + '"' + ha(h) + '>' + html + '</div>';
  K.field = (label, html) => '<div class="afield"><label>' + label + '</label>' + html + '</div>';
  K.ainp = (h, val, ph) => '<input class="ainp" readonly' + ha(h) + ' value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(ph || '') + '">';
  K.asel = (h, val, ph) => '<div class="ainp sel' + (val ? '' : ' ph') + '"' + ha(h) + '>' + (val || ph || t('Chọn', 'Select')) + '</div>';
  K.stepper = (h, val, ph) => '<div class="stepper"><span' + ha(h + '-minus') + '>−</span>' + K.ainp(h, val, ph || t('Nhập số phút', 'Enter minutes')) + '<span' + ha(h + '-plus') + '>+</span></div>';
  K.abtn = (label, h, cls) => '<div class="abtn ' + (cls || '') + '"' + ha(h) + '>' + label + '</div>';
  K.ack = (h, on, label) => '<div style="display:flex;gap:8px;align-items:center;margin:4px 0"><span class="ck' + (on ? ' on' : '') + '"' + ha(h) + '></span>' + label + '</div>';
  K.chips = (list) => '<div class="chips">' + list.map(([l, c, on, h, cnt]) => '<span class="' + (on ? 'on' : '') + '" style="' + (on ? 'background:' + c : '') + '"' + ha(h) + '>' + l + (cnt ? '<span class="cnt">' + cnt + '</span>' : '') + '</span>').join('') + '</div>';
  K.stChips = (on, counts, withProxy) => K.chips([[t('Tất cả', 'All'), '#3398dc', on === 'all', 'f-all']].concat(['waiting', 'approved', 'nc', 'confirmed'].concat(withProxy ? ['proxy'] : []).map((k) => [K.ST[k].l(), K.ST[k].c, on === k, 'f-' + k, counts && counts[k]])));
  K.confirmDlg = (msg, yes) => ({ msg, btns: [[t('Huỷ', 'Cancel'), ''], [t('Xác nhận', 'Confirm'), yes || 'dyes']] });
})();
