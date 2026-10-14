/* ===== PORTAL WEB (matthews-portal-new) ===== */
(function () {
  const T = Store.T, E = Engine, N = UI.N, A = UI.ACT;
  const S = () => Store.S;
  const P = { screen: 'menu', weekOff: 0, fShift: '', fBranch: '', fStaff: '', cfgTab: 'general', tkType: 'by_week', attStatus: '0' };
  const me = () => S().portalUser;

  const NAV = [
    ['menu', '▦', 'Menu chấm công'],
    ['shift', '◷', 'Ca làm việc'],
    ['tws', '▤', 'Lịch làm việc NV'],
    ['ws', '⇆', 'Phân ca'],
    ['tk', '☑', 'Chấm công'],
    ['rate', '％', 'Báo cáo Rate'],
    ['cfg', '⚙', 'Cấu hình'],
    ['att', '⏱', 'Lịch sử chấm công'],
    ['rec', '★', 'Thưởng phạt']
  ];

  const weekDays = () => { const mon = T.addDays(T.monday(Store.today()), P.weekOff * 7); return [0, 1, 2, 3, 4, 5, 6].map((i) => T.addDays(mon, i)); };

  function shell(content) {
    return '<div class="portal"><nav class="p-aside"><div class="logo">M</div>' + NAV.map(([k, ic, l]) => '<button class="' + (P.screen === k ? 'on' : '') + '" data-act="pgo" data-k="' + k + '"><span class="ic">' + ic + '</span>' + l + '</button>').join('') +
      '</nav><div class="p-wrap"><div class="p-header"><span class="title_header">QUẢN LÝ NHÂN VIÊN</span>' + N('perm') + '<span class="sp"></span><span style="color:#9699a2">Đăng nhập với</span><select data-chg="puser">' +
      S().staffs.filter((s) => s.staff_id <= 2).map((s) => '<option value="' + s.staff_id + '"' + (s.staff_id === me() ? ' selected' : '') + '>' + esc(s.full_name) + (s.is_admin ? ' (admin)' : ' (quản lý)') + '</option>').join('') + '</select>' + N('portal-user') + '</div><div class="p-content">' + content + '</div></div></div>';
  }
  A.pgo = (d) => { P.screen = d.k; Portal.render(); };
  A.puser = (d, el) => { S().portalUser = Number(el.value); Store.save(); Portal.render(); };

  const portlet = (title, tools, body, note) => '<div class="portlet"><div class="portlet-head"><h2>' + title + (note ? N(note) : '') + '</h2><div class="tools">' + (tools || '') + '</div></div><div class="portlet-body">' + body + '</div></div>';

  /* ================= MENU ALL ================= */
  function scrMenu() {
    const tiles = [
      ['shift', '◷', 'Ca làm việc', '/shift/shift'], ['tws', '▤', 'Lịch làm việc nhân viên', '/shift/time-working-staff'],
      ['tk', '☑', 'Chấm công', '/shift/timekeeping'], ['cfg', '⚙', 'Cấu hình chấm công', '/shift/timekeeping-config'],
      ['rate', '％', 'Báo cáo chấm công (Rate 1–4)', '/shift/timekeeping/payroll-timekeeping-report'], ['att', '⏱', 'Lịch sử chấm công', '/shift/attendances'],
      ['rec', '★', 'Thưởng – phạt', '/shift/recompense'], ['', '▥', 'Báo cáo chấm công (report studio)', 'iframe – ngoài phạm vi']
    ];
    const body = '<p style="margin-top:0">Nhóm <b>Timekeeping</b> trên trang <code>/admin/menu-all</code>. Bấm vào một ô để mở màn hình mô phỏng.</p><div class="menu-group">' +
      tiles.map(([k, ic, l, u]) => '<div class="menu-tile" ' + (k ? 'data-act="pgo" data-k="' + k + '"' : '') + '><div class="ic">' + ic + '</div><div><b>' + l + '</b><small>' + u + '</small></div></div>').join('') + '</div>' +
      '<p style="margin-top:18px;color:#9699a2">Các màn có route nhưng không có trong menu: <a href="#" data-act="pgo" data-k="ws">Phân ca (work-schedule)</a>, Cấu hình chung (mở qua tab), Cấu hình thông báo.</p>';
    return portlet('Tất cả menu › Chấm công', '', body, 'menu-all');
  }

  /* ================= CA LÀM VIỆC ================= */
  function scrShift() {
    const rows = S().shifts.filter((s) => !s.is_deleted).sort((a, b) => b.shift_id - a.shift_id);
    const tools = '<button class="btn btn-primary btn-pill" data-act="shiftForm">+ Thêm ca làm việc</button>' + '<button class="btn btn-primary btn-pill" data-act="pgo" data-k="tk">Bảng chấm công</button><button class="btn btn-primary btn-pill" data-act="pgo" data-k="tws">Lịch làm việc của nhân viên</button>';
    const body = '<div class="filter"><input placeholder="Nhập tên ca"><select><option>Chọn trạng thái</option><option>Đang hoạt động</option><option>Đã tạm ngừng</option></select><button class="btn btn-primary">TÌM KIẾM</button></div><div class="tw"><table class="pt"><thead><tr><th>#</th><th>Tên ca</th><th>Thời gian</th><th>Giờ làm</th><th>Giờ nghỉ trưa</th><th>Giờ làm tối thiểu</th><th>Hệ số</th><th>Số lần chấm' + N('shift-checking') + '</th><th>Trạng thái' + N('shift-switch') + '</th><th>Ghi chú</th><th>Hành động</th></tr></thead><tbody>' +
      rows.map((s, i) => {
        const lunch = s.start_lunch_break && s.end_lunch_break ? E.shiftHourWork(s.start_lunch_break, s.end_lunch_break) + ' giờ' : '';
        return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(s.shift_name) + '</b>' + (s.is_system ? ' <span class="tag api">hệ thống</span>' : '') + '</td><td>' + s.start_work_time + ' - ' + s.end_work_time + (s.end_work_time <= s.start_work_time ? ' <span class="tag app">qua đêm</span>' : '') + '</td><td>' + s.time_work + ' giờ</td><td>' + lunch + '</td><td>' + s.min_time_work + ' giờ</td><td>' + s.timekeeping_coefficient + '</td><td>' + s.checking_type + '</td><td><label class="switch"><input type="checkbox" data-chg="shiftStatus" data-id="' + s.shift_id + '"' + (s.is_actived ? ' checked' : '') + '><span></span></label></td><td>' + esc(s.note) + '</td><td><button class="icon-btn" title="Sửa" data-act="shiftForm" data-id="' + s.shift_id + '">✎</button><button class="icon-btn" title="Xoá" data-act="shiftDel" data-id="' + s.shift_id + '">🗑</button>' + N('shift-delete') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return portlet('Danh sách ca làm việc', tools, body, 'shift-list');
  }
  A.shiftStatus = (d, el) => { const s = Store.shift(d.id); s.is_actived = el.checked ? 1 : 0; Store.save(); E.log({ api: 'POST shift/shift/update-status', ok: true, message: 'Thay đổi trạng thái thành công', db: ['sf_shifts.is_actived = ' + s.is_actived, 'Không kiểm tra ca đang được dùng'] }); UI.swal('success', 'Thay đổi trạng thái thành công'); };
  A.shiftDel = async (d) => { if (!(await UI.swal('question', 'Bạn có muốn xóa không?'))) return; const r = E.portal.deleteShift(Number(d.id)); await UI.result(r); Portal.render(); };
  A.shiftForm = (d) => {
    const s = d.id ? Store.shift(d.id) : { shift_name: '', start_work_time: '08:00', end_work_time: '17:00', start_lunch_break: '', end_lunch_break: '', min_time_work: '', timekeeping_coefficient: 1, branches: [], is_monday: 1, is_tuesday: 1, is_wednesday: 1, is_thursday: 1, is_friday: 1, is_saturday: 0, is_sunday: 0, checking_type: 1, note: '' };
    const dn = [['is_monday', 'Thứ 2'], ['is_tuesday', 'Thứ 3'], ['is_wednesday', 'Thứ 4'], ['is_thursday', 'Thứ 5'], ['is_friday', 'Thứ 6'], ['is_saturday', 'Thứ 7'], ['is_sunday', 'Chủ nhật']];
    const body = '<form id="fshift">' +
      '<div class="form-row"><label>Tên ca làm <span class="req">*</span>' + N('shift-name') + '</label><input class="fc" name="shift_name" value="' + esc(s.shift_name) + '"></div>' +
      '<div class="form-row"><label>Thời gian làm việc bắt đầu <span class="req">*</span>' + N('shift-time') + '</label><input class="fc" type="time" name="start_work_time" value="' + s.start_work_time + '" data-chg="calcMin"></div>' +
      '<div class="form-row"><label>Thời gian làm việc kết thúc <span class="req">*</span></label><input class="fc" type="time" name="end_work_time" value="' + s.end_work_time + '" data-chg="calcMin"></div>' +
      '<div class="form-row"><label>Thời gian nghỉ trưa bắt đầu' + N('shift-lunch') + '</label><input class="fc" type="time" name="start_lunch_break" value="' + (s.start_lunch_break || '') + '" data-chg="calcMin"></div>' +
      '<div class="form-row"><label>Thời gian nghỉ trưa kết thúc</label><input class="fc" type="time" name="end_lunch_break" value="' + (s.end_lunch_break || '') + '" data-chg="calcMin"></div>' +
      '<div class="form-row"><label>Số giờ làm tối thiểu tính đủ công <span class="req">*</span>' + N('shift-min') + '</label><input class="fc" name="min_time_work" value="' + s.min_time_work + '"></div>' +
      '<div class="form-row"><label>Hệ số công <span class="req">*</span>' + N('shift-coef') + '</label><input class="fc" name="timekeeping_coefficient" value="' + s.timekeeping_coefficient + '"></div>' +
      '<div class="form-row"><label>Chi nhánh làm việc <span class="req">*</span>' + N('shift-branch') + '</label><div class="days">' + S().branches.map((b) => '<label><input type="checkbox" class="br" value="' + b.branch_id + '"' + (s.branches.includes(b.branch_id) ? ' checked' : '') + '> ' + esc(b.branch_name) + '</label>').join('') + '</div></div>' +
      '<div class="form-row"><label>Thời gian hoạt động của ca <span class="req">*</span>' + N('shift-days') + '</label><div class="days">' + dn.map(([k, l]) => '<label><input type="checkbox" name="' + k + '"' + (s[k] ? ' checked' : '') + '> ' + l + '</label>').join('') + '</div></div>' +
      '<div class="form-row"><label>Số lần chấm công <span class="req">*</span>' + N('shift-checking') + '</label><input class="fc" type="number" min="0" max="5" name="checking_type" value="' + s.checking_type + '"></div>' +
      '<div class="form-row"><label>Ghi chú</label><textarea class="fc" rows="3" name="note">' + esc(s.note) + '</textarea></div></form>';
    UI.modal({ title: d.id ? 'Chỉnh sửa ca làm việc' : 'Thêm ca làm việc', body, footer: '<button class="btn btn-default" data-act="closeModal">HỦY</button><button class="btn btn-primary" data-act="shiftSave" data-id="' + (d.id || '') + '">LƯU THÔNG TIN</button>' });
  };
  A.calcMin = () => {
    const f = document.getElementById('fshift'); const v = UI.form(f);
    if (v.start_work_time && v.end_work_time && v.start_lunch_break && v.end_lunch_break) f.min_time_work.value = E.shiftHourWork(v.start_work_time, v.end_work_time, v.start_lunch_break, v.end_lunch_break);
    else if (v.start_work_time && v.end_work_time && !v.start_lunch_break && !v.end_lunch_break) f.min_time_work.value = E.shiftHourWork(v.start_work_time, v.end_work_time);
  };
  A.shiftSave = async (d) => {
    const f = document.getElementById('fshift'); const v = UI.form(f);
    v.branches = [...f.querySelectorAll('.br:checked')].map((x) => Number(x.value));
    const r = E.portal.saveShift(v, d.id ? Number(d.id) : null);
    if (r.ok) UI.closeModal();
    await UI.result(r); if (r.ok) Portal.render();
  };

  /* ================= LỊCH LÀM VIỆC NV ================= */
  function scrTws() {
    const days = weekDays(); const today = Store.today();
    const staffs = S().staffs.filter((s) => !P.fStaff || s.staff_id === Number(P.fStaff)).filter((s) => !P.fBranch || s.branch_id === Number(P.fBranch));
    const wk = T.isoWeek(days[0]);
    const filter = '<div class="filter"><div class="wkbox"><button class="btn btn-default" data-act="wk" data-d="-1">‹</button><select class="fc" disabled><option>Tuần ' + wk + ' (' + T.dmy(days[0]) + ' - ' + T.dmy(days[6]) + ')</option></select><button class="btn btn-default" data-act="wk" data-d="1">›</button></div>' +
      '<select data-chg="pf" data-k="fShift">' + UI.opt(S().shifts.filter((s) => s.is_actived && !s.is_deleted), P.fShift, 'shift_id', 'shift_name', 'Chọn ca làm') + '</select>' +
      '<select data-chg="pf" data-k="fBranch">' + UI.opt(S().branches, P.fBranch, 'branch_id', 'branch_name', 'Chọn chi nhánh nhân viên') + '</select>' +
      '<select data-chg="pf" data-k="fStaff">' + UI.opt(S().staffs, P.fStaff, 'staff_id', 'full_name', 'Chọn nhân viên') + '</select></div>';
    let html = '<div class="ptabs"><button data-act="pgo" data-k="ws">Lịch làm việc</button><button>Theo ca</button><button class="on">Theo nhân viên</button></div>' + filter +
      '<div class="tw"><table class="grid-tws"><thead><tr><th style="text-align:left">Nhân viên</th>' + days.map((dd) => '<th class="' + (Store.isHoliday(dd) ? 'holiday' : '') + '" style="' + (dd === today ? 'background:#eef5fb' : '') + '">' + T.dayNames[T.weekday(dd)] + '<br>' + T.dm(dd) + (Store.isHoliday(dd) ? '<br><small>Ngày lễ</small>' : '') + '</th>').join('') + '</tr></thead><tbody>';
    staffs.forEach((st) => {
      html += '<tr><td class="staff"><div class="staff-cell">' + UI.avatar(st.full_name, st.staff_id) + '<div style="flex:1"><div class="nm">' + esc(st.full_name) + '</div><div class="sub">' + esc(st.title) + '</div><div class="sub">' + esc(Store.branch(st.branch_id).branch_name) + '</div>' +
        (st.check_in_limit === 0 ? '<span class="tag web">linh động</span> ' : '') + (st.check_approved_time_working === 0 ? '<span class="tag app">không cần duyệt</span>' : '') + '<div class="sub">QL: ' + esc(st.staff_manager_id ? E.staffName(st.staff_manager_id) : '—') + '</div></div></div></td>';
      days.forEach((dd) => {
        const list = E.active().filter((t) => t.staff_id === st.staff_id && t.working_day === dd && (!P.fShift || t.shift_id === Number(P.fShift)));
        html += '<td>' + cellHtml(st, dd, list) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>' + legend();
    const tools = '<button class="btn btn-primary btn-pill" data-act="shiftForm">+ Tạo ca làm việc</button>';
    return portlet('Lịch làm việc' + N('tws-grid'), tools, html);
  }
  function legend() {
    const real = [['#D3D3D3', 'Chưa đến ca'], ['#3FAE8F', 'Chấm công đúng giờ'], ['#F08A5D', 'Chưa vào/ra ca'], ['#F2B84B', 'Vào trễ/ra sớm'], ['#8E9FE6', 'Nghỉ phép có lương'], ['#E5E0FF', 'Nghỉ phép không lương']];
    return '<div class="legend"><b>Chú giải màu (màu thực tế code tô)</b>' + N('tws-color') + real.map(([c, l]) => '<span><i style="background:' + c + '"></i>' + l + '</span>').join('') + '<span><i style="background:#fff;box-shadow:inset 0 0 0 2px red"></i>Tăng ca (viền đỏ)</span></div>';
  }
  function cellHtml(st, dd, list) {
    if (!list.length) return '<button class="cell-add" title="Thêm ca" data-act="addShift" data-staff="' + st.staff_id + '" data-day="' + dd + '">+</button>';
    if (list.length >= 2) {
      return '<div class="multi" data-act="myShift" data-staff="' + st.staff_id + '" data-day="' + dd + '"><b>' + list.length + ' Ca</b><br>' + list.map((t) => { const c = E.portalColor(t); return '<span class="dot" style="background:' + c.color + ';' + (t.is_ot ? 'border:2px solid red' : '') + '"></span>'; }).join('') + '</div>';
    }
    return oneCell(list[0], false);
  }
  function oneCell(t, light) {
    const c = E.portalColor(t, light); const today = Store.today();
    const ci = E.firstIn(t), co = E.lastOut(t);
    const icon = (x) => (x ? (x.created_type === 'admin' ? ' 👤' : ' 📱') : '');
    const tm = t.working_day <= today ? '(' + (ci ? ci.time : '--:--') + icon(ci) + ' - ' + (co ? co.time : '--:--') + icon(co) + ')' : '(' + t.working_time + ' - ' + t.working_end_time + ')';
    const dark = ['#3FAE8F', '#F08A5D', '#8E9FE6'].includes(c.color);
    return '<div class="cell ' + (t.is_ot ? 'ot' : '') + '" style="background:' + c.color + ';color:' + (dark ? '#fff' : '#1e2235') + '"><div class="sn">' + esc(E.shiftOf(t).shift_name) + '</div><button class="icon-btn dots" style="color:inherit" data-act="cellMenu" data-id="' + t.id + '">⋮</button><div class="tm">' + tm + '</div><div class="br">' + esc(Store.branch(t.branch_id).branch_name) + '</div><div style="margin-top:3px"><span class="chip" style="background:rgba(0,0,0,.18);font-size:10px">' + (E.STATUS[t.time_working_staff_status] || {}).label + '</span></div><div class="why">' + esc(c.why) + '</div></div>';
  }
  A.wk = (d) => { P.weekOff += Number(d.d); Portal.render(); };
  A.pf = (d, el) => { P[d.k] = el.value; Portal.render(); };

  A.cellMenu = (d, el) => {
    const t = Store.tw(d.id); const st = Store.staff(t.staff_id); const today = Store.today();
    const isMgr = me() === st.staff_manager_id;
    const items = [];
    const add = (label, act, cond, why, icon) => items.push(cond ? { label, act, data: { id: t.id }, icon } : { label, disabled: true, hint: 'Ẩn trên thực tế vì: ' + why, icon });
    add('Chi tiết', 'twDetail', true, '', '👁');
    add('Chỉnh sửa', 'twEdit', t.working_day >= today && !t.is_close && !E.isIn(t), 'cần ngày ≥ hôm nay, chưa chốt, chưa check-in', '✎');
    add('Duyệt lịch làm việc', 'twApprove', isMgr && t.is_deducted === null && t.time_working_staff_status === 'waiting', !isMgr ? 'bạn không phải quản lý trực tiếp' : 'status phải là waiting và is_deducted null', '✔');
    add('Confirm working time', 'twConfirm', E.canConfirm(me(), t) && t.is_deducted === null && t.time_working_staff_status === 'not-confirm', !E.canConfirm(me(), t) ? 'không phải quản lý trực tiếp / admin chưa bật cấu hình' : 'status phải là not-confirm', '⏲');
    add('Thêm ca làm việc', 'addShiftFrom', true, '', '+');
    add('Chấm công hộ', 'twAttend', t.working_day <= today && !t.is_close && (!E.isIn(t) || !E.isOut(t)) && t.is_deducted === null && t.time_working_staff_status === 'approved', t.working_day > today ? 'ngày chưa tới' : (E.isIn(t) && E.isOut(t) ? 'đã đủ vào/ra' : (t.is_deducted !== null ? 'đã đánh dấu nghỉ' : 'status phải là approved')), '👤');
    const leaveOk = !t.is_close && !E.isIn(t) && !E.isOut(t);
    add('Nghỉ có lương', 'twPaid', leaveOk && (t.is_deducted === null || t.is_deducted === 1), leaveOk ? 'đang là nghỉ có lương' : 'đã check-in/out hoặc đã chốt', '☂');
    add('Nghỉ không lương', 'twUnpaid', leaveOk && (t.is_deducted === null || t.is_deducted === 0), leaveOk ? 'đang là nghỉ không lương' : 'đã check-in/out hoặc đã chốt', '☂');
    add('Làm thêm giờ', 'twOt', true, '', '⏩');
    items.push('-');
    add('Xoá', 'twDel', true, '', '🗑');
    UI.dropdown(el, items);
    UI.showNote('tws-menu');
  };
  A.addShiftFrom = (d) => { UI.closeDropdown(); const t = Store.tw(d.id); A.addShift({ staff: t.staff_id, day: t.working_day }); };
  A.addShift = async (d) => {
    UI.closeDropdown();
    const day = d.day; const staffId = Number(d.staff);
    if (Store.isHoliday(day) && !(await UI.swal('question', 'Ca làm việc rơi vào ngày lễ bạn có muốn thêm ca làm việc cho nhân viên?'))) return;
    const key = T.dayKeys[T.weekday(day)];
    const list = S().shifts.filter((s) => s.is_actived && !s.is_deleted && s[key]);
    const body = '<p>Nhân viên: <b>' + esc(E.staffName(staffId)) + '</b> · Ngày: <b>' + T.dayNames[T.weekday(day)] + ' ' + T.dmy(day) + '</b></p><input class="fc" placeholder="Nhập tên ca" style="margin-bottom:10px"><table class="pt" id="tadd"><thead><tr><th>#</th><th>Chọn</th><th>Tên ca</th><th>Chi nhánh</th><th>Tăng ca' + N('tws-ot-type') + '</th><th>Tính tăng ca theo</th><th>Hệ số công</th></tr></thead><tbody>' +
      list.map((s, i) => '<tr data-sid="' + s.shift_id + '"><td>' + (i + 1) + '</td><td><input type="checkbox" class="ck" data-chg="addRow"></td><td><b>' + esc(s.shift_name) + '</b><br><small>' + s.start_work_time + ' - ' + s.end_work_time + '</small></td><td><select class="fc br" disabled>' + UI.opt(S().branches.filter((b) => s.branches.includes(b.branch_id)), '', 'branch_id', 'branch_name', 'Chọn chi nhánh') + '</select></td><td><input type="checkbox" class="ot" disabled data-chg="addRow"></td><td><select class="fc ott" disabled><option value="S">Ca</option><option value="H">Giờ</option></select></td><td><input class="fc coef" value="' + s.timekeeping_coefficient + '" style="width:70px"></td></tr>').join('') +
      '</tbody></table><p style="color:#9699a2;font-size:12px">Chỉ liệt kê ca đang hoạt động và được làm vào ' + T.dayNames[T.weekday(day)] + '.</p>';
    UI.modal({ title: 'Danh sách ca', note: 'tws-add', size: 'lg', body, footer: '<button class="btn btn-default" data-act="closeModal">HỦY</button><button class="btn btn-primary" data-act="addShiftSave" data-staff="' + staffId + '" data-day="' + day + '">CHỌN</button>' });
  };
  A.addRow = (d, el) => {
    const tr = el.closest('tr'); const on = tr.querySelector('.ck').checked;
    tr.querySelector('.br').disabled = !on; tr.querySelector('.ot').disabled = !on;
    if (!on) tr.querySelector('.ot').checked = false;
    tr.querySelector('.ott').disabled = !(on && tr.querySelector('.ot').checked);
    if (on && !tr.querySelector('.br').value && tr.querySelector('.br').options.length === 2) tr.querySelector('.br').selectedIndex = 1;
  };
  A.addShiftSave = async (d) => {
    const rows = [...document.querySelectorAll('#tadd tbody tr')].filter((tr) => tr.querySelector('.ck').checked).map((tr) => ({ shift_id: Number(tr.dataset.sid), branch_id: tr.querySelector('.br').value, is_ot: tr.querySelector('.ot').checked, overtime_type: tr.querySelector('.ott').value, coef: tr.querySelector('.coef').value }));
    const r = E.portal.addShift(me(), Number(d.staff), d.day, rows);
    if (r.ok) UI.closeModal();
    await UI.result(r); if (r.ok) Portal.render();
  };
  A.myShift = (d) => {
    const list = E.active().filter((t) => t.staff_id === Number(d.staff) && t.working_day === d.day);
    UI.modal({ title: 'Ca làm · ' + esc(E.staffName(d.staff)) + ' · ' + T.dmy(d.day), size: 'sm', body: list.map((t) => oneCell(t, true)).join('<div style="height:8px"></div>') + '<button class="cell-add" style="height:44px;margin-top:8px" data-act="addShift" data-staff="' + d.staff + '" data-day="' + d.day + '">+</button>', footer: '<button class="btn btn-default" data-act="closeModal">HỦY</button>' });
  };

  A.twDetail = (d) => {
    UI.closeDropdown();
    const t = Store.tw(d.id); const s = E.shiftOf(t);
    const rec = t.recompense.map((r, i) => { const c = S().recompense.find((x) => x.recompense_id === r.recompense_id); return '<tr><td>' + (i + 1) + '</td><td>' + (c.type === 'R' ? 'Thưởng' : 'Phạt') + '</td><td>' + esc(c.recompense_name) + '</td><td>' + r.money.toLocaleString('vi-VN') + '</td><td><button class="icon-btn" data-act="recDel" data-tw="' + t.id + '" data-id="' + r.id + '">🗑</button></td></tr>'; }).join('');
    const hist = t.ins.map((x) => { const o = E.outOf(t, x.step); return '<tr><td>Lượt ' + x.step + '</td><td>' + T.dmy(x.day) + ' ' + x.time + ' ' + (x.created_type === 'admin' ? '👤' : '📱') + '</td><td>' + (o ? T.dmy(o.day) + ' ' + o.time : '--:--') + '</td><td>' + x.timekeeping_type + '</td></tr>'; }).join('');
    const body = '<div class="rgrid" style="grid-template-columns:1fr 1fr;gap:4px 24px">' +
      [['Tên nhân viên', E.staffName(t.staff_id)], ['Tên ca làm', s.shift_name], ['Giờ làm', t.time_work + ' giờ'], ['Hệ số công', t.timekeeping_coefficient], ['Ngày làm', T.dmy(t.working_day)], ['Vị trí làm', Store.branch(t.branch_id).branch_name], ['Số giờ làm tối thiểu tính đủ công', t.min_time_work], ['Tăng ca', t.is_ot ? '✔ (' + (t.overtime_type === 'H' ? 'Giờ' : 'Ca') + ')' : '—'], ['Trạng thái', (E.STATUS[t.time_working_staff_status] || {}).label], ['Giờ thực tế / được duyệt', T.fmtH(t.actual_time_work) + ' / ' + T.fmtH(t.actual_time_work_confirmed)], ['Phút trễ / sớm', t.number_late_time + ' / ' + t.number_time_back_soon], ['is_deducted', String(t.is_deducted)]].map(([k, v]) => '<div class="kv"><span>' + k + '</span><b>' + esc(v) + '</b></div>').join('') + '</div>' +
      '<h4 style="margin:18px 0 8px">Thưởng / Phạt vi phạm' + N('tws-recompense') + '</h4><div style="display:flex;gap:8px;margin-bottom:8px"><select class="fc" id="recSel" style="max-width:260px">' + UI.opt(S().recompense.filter((r) => r.is_actived && !r.is_deleted).map((r) => ({ id: r.recompense_id, n: (r.type === 'R' ? '[Thưởng] ' : '[Phạt] ') + r.recompense_name })), '', 'id', 'n', 'Hãy chọn loại') + '</select><input class="fc" id="recMoney" placeholder="Mức áp dụng" style="max-width:160px"><button class="btn btn-primary" data-act="recAdd" data-tw="' + t.id + '">+ Thêm</button></div>' +
      '<table class="pt"><thead><tr><th>#</th><th>Loại</th><th>Nội dung</th><th>Mức áp dụng</th><th></th></tr></thead><tbody>' + (rec || '<tr><td colspan="5" style="color:#999">Chưa có</td></tr>') + '</tbody></table>' +
      '<h4 style="margin:18px 0 8px">Lịch sử chấm công</h4><table class="pt"><thead><tr><th>Lượt</th><th>Vào</th><th>Ra</th><th>Hình thức</th></tr></thead><tbody>' + (hist || '<tr><td colspan="4" style="color:#999">Chưa chấm công</td></tr>') + '</tbody></table>';
    UI.modal({ title: 'Chi tiết ngày làm việc', size: 'lg', body, footer: '<button class="btn btn-default" data-act="closeModal">HỦY</button>' });
  };
  A.recAdd = async (d) => { const r = E.portal.addRecompense(Number(d.tw), document.getElementById('recSel').value, document.getElementById('recMoney').value.replace(/[,.]/g, '')); await UI.result(r); if (r.ok) A.twDetail({ id: d.tw }); };
  A.recDel = async (d) => { if (!(await UI.swal('question', 'Bạn có muốn xóa không?'))) return; const t = Store.tw(d.tw); t.recompense = t.recompense.filter((x) => x.id !== Number(d.id)); Store.save(); E.log({ api: 'POST shift/time-working-staff/remove-recompense', ok: true, message: 'Xoá thành công', db: ['Xoá cứng, không kiểm tra chốt lương'] }); A.twDetail({ id: d.tw }); };

  A.twEdit = (d) => {
    UI.closeDropdown();
    const t = Store.tw(d.id);
    const body = '<form id="fedit"><div class="form-row"><label>Tên nhân viên</label><input class="fc" disabled value="' + esc(E.staffName(t.staff_id)) + '"></div><div class="form-row"><label>Tên ca làm</label><input class="fc" disabled value="' + esc(E.shiftOf(t).shift_name) + '"></div>' +
      '<div class="form-row"><label>Vị trí làm <span class="req">*</span></label><select class="fc" name="branch_id">' + UI.opt(S().branches.filter((b) => (E.shiftOf(t).branches || []).includes(b.branch_id)), t.branch_id, 'branch_id', 'branch_name', 'Chọn chi nhánh') + '</select></div>' +
      '<div class="form-row"><label>Hệ số công <span class="req">*</span></label><input class="fc" name="coef" value="' + t.timekeeping_coefficient + '"' + (t.is_ot ? '' : ' disabled') + '></div>' +
      '<div class="form-row"><label>Số giờ làm tối thiểu tính đủ công</label><input class="fc" name="min" value="' + t.min_time_work + '"></div>' +
      '<div class="form-row"><label>Thời gian làm việc bắt đầu <span class="req">*</span></label><input class="fc" type="datetime-local" name="start" value="' + t.working_day + 'T' + t.working_time + '"></div>' +
      '<div class="form-row"><label>Thời gian làm việc kết thúc <span class="req">*</span></label><input class="fc" type="datetime-local" name="end" value="' + t.working_end_day + 'T' + t.working_end_time + '"></div></form>';
    UI.modal({ title: 'Chỉnh sửa ngày làm việc', note: 'tws-edit', body, footer: '<button class="btn btn-default" data-act="closeModal">HỦY</button><button class="btn btn-primary" data-act="twEditSave" data-id="' + t.id + '">LƯU</button>' });
  };
  A.twEditSave = async (d) => {
    const f = document.getElementById('fedit'); const v = UI.form(f); const t = Store.tw(d.id);
    const r = E.portal.updateTime(t.id, { branch_id: v.branch_id, coef: f.coef.value, min: v.min, start: new Date(v.start), end: new Date(v.end) });
    if (r.ok) UI.closeModal(); await UI.result(r); if (r.ok) Portal.render();
  };
  A.twApprove = async (d) => { UI.closeDropdown(); if (!(await UI.swal('question', 'Bạn có muốn duyệt lịch làm việc không?'))) return; await UI.result(E.portal.approve(me(), Number(d.id))); Portal.render(); };
  A.twConfirm = (d) => {
    UI.closeDropdown(); const t = Store.tw(d.id);
    UI.modal({ title: 'Xác nhận lịch làm việc', note: 'tws-confirm', size: 'sm', body: '<label>Giờ làm việc thực tế</label><input class="fc" id="cfH" type="number" step="0.01" min="0" value="' + (t.actual_time_work || 0) + '">', footer: '<button class="btn btn-default" data-act="closeModal">Hủy</button><button class="btn btn-primary" data-act="twConfirmSave" data-id="' + t.id + '">Xác nhận</button>' });
  };
  A.twConfirmSave = async (d) => { const h = document.getElementById('cfH').value; UI.closeModal(); await UI.result(E.portal.confirm(me(), Number(d.id), h)); Portal.render(); };
  A.twAttend = (d) => {
    UI.closeDropdown(); const t = Store.tw(d.id);
    const body = '<div class="form-row"><label>Nhân viên</label><input class="fc" disabled value="' + esc(E.staffName(t.staff_id)) + '"></div><div class="form-row"><label>Tên ca</label><input class="fc" disabled value="' + esc(E.shiftOf(t).shift_name) + '"></div>' +
      '<div class="form-row"><label>Thời gian bắt đầu</label><input class="fc" disabled value="' + T.dmy(t.working_day) + '"></div><div class="form-row"><label>Giờ vào ca <span class="req">*</span></label><input class="fc" type="time" step="300" id="atIn" value="' + t.working_time + '"></div>' +
      '<div class="form-row"><label>Thời gian kết thúc</label><input class="fc" disabled value="' + T.dmy(t.working_end_day) + '"></div><div class="form-row"><label>Giờ ra ca (để trống nếu chưa ra)</label><input class="fc" type="time" step="300" id="atOut" value="' + t.working_end_time + '"></div>' +
      '<p style="font-size:12px;color:#a0753a;background:#fff6e5;padding:8px;border-radius:6px">Ô ẩn lock_check_in/lock_check_out được gửi lên nhưng backend <b>không dùng</b>. Hai hàm kiểm tra giờ (không cho vào sớm ≥3h…) là code chết.</p>';
    UI.modal({ title: 'Chấm công hộ', note: 'tws-attend', body, footer: '<button class="btn btn-default" data-act="closeModal">HỦY</button><button class="btn btn-primary" data-act="twAttendSave" data-id="' + t.id + '">LƯU</button>' });
  };
  A.twAttendSave = async (d) => { const i = document.getElementById('atIn').value, o = document.getElementById('atOut').value; UI.closeModal(); await UI.result(E.portal.timeAttendance(me(), Number(d.id), i, o)); Portal.render(); };
  A.twPaid = async (d) => { UI.closeDropdown(); if (!(await UI.swal('question', 'Bạn có muốn điều chỉnh không?'))) return; UI.showNote('tws-leave'); await UI.result(E.portal.paidLeave(Number(d.id), 'paid')); Portal.render(); };
  A.twUnpaid = async (d) => { UI.closeDropdown(); if (!(await UI.swal('question', 'Bạn có muốn điều chỉnh không?'))) return; UI.showNote('tws-leave'); await UI.result(E.portal.paidLeave(Number(d.id), 'unpaid')); Portal.render(); };
  A.twDel = async (d) => { UI.closeDropdown(); if (!(await UI.swal('question', 'Bạn có muốn xóa không?'))) return; await UI.result(E.portal.removeShift(Number(d.id))); Portal.render(); };
  A.twOt = (d) => {
    UI.closeDropdown(); const t = Store.tw(d.id); const st = T.addMin(E.end(t), 1);
    const loc = (x) => T.ymd(x) + 'T' + T.hm(x);
    const body = '<form id="fot"><div class="form-row"><label>Tên nhân viên</label><input class="fc" disabled value="' + esc(E.staffName(t.staff_id)) + '"></div><div class="form-row"><label>Tên ca làm</label><input class="fc" disabled value="' + esc(E.shiftOf(t).shift_name) + '"></div>' +
      '<div class="form-row"><label>Vị trí làm <span class="req">*</span></label><select class="fc" name="branch_id">' + UI.opt(S().branches, t.branch_id, 'branch_id', 'branch_name', 'Chọn chi nhánh') + '</select></div>' +
      '<div class="form-row"><label>Hệ số công <span class="req">*</span></label><input class="fc" name="coef" value="' + t.timekeeping_coefficient + '"></div>' +
      '<div class="form-row"><label>Thời gian làm việc bắt đầu <span class="req">*</span></label><input class="fc" type="datetime-local" name="start" value="' + loc(st) + '"></div>' +
      '<div class="form-row"><label>Thời gian làm việc kết thúc <span class="req">*</span></label><input class="fc" type="datetime-local" name="end" value=""></div>' +
      '<div class="form-row"><label>Không cần chấm công</label><label><input type="checkbox" name="is_not_check_in"> Tick để tự đánh dấu đã chấm</label></div></form>';
    UI.modal({ title: 'Làm thêm giờ', note: 'tws-ot', body, footer: '<button class="btn btn-default" data-act="closeModal">HỦY</button><button class="btn btn-primary" data-act="twOtSave" data-id="' + t.id + '">LƯU</button>' });
  };
  A.twOtSave = async (d) => {
    const v = UI.form(document.getElementById('fot'));
    if (!v.end) return UI.swal('error', 'Hãy chọn ngày kết thúc', null, 'Validate JS: required');
    const r = E.portal.storeOvertime(me(), Number(d.id), { branch_id: v.branch_id, coef: v.coef, start: new Date(v.start), end: new Date(v.end), is_not_check_in: v.is_not_check_in });
    if (r.ok) UI.closeModal(); await UI.result(r); if (r.ok) Portal.render();
  };

  /* ================= PHÂN CA ================= */
  function scrWs() {
    const rows = S().schedules;
    const body = '<div class="ptabs"><button class="on">Lịch làm việc</button><button>Theo ca</button><button data-act="pgo" data-k="tws">Theo nhân viên</button></div><div class="filter"><input placeholder="Nhập tên lịch làm việc"><select><option>Chọn trạng thái</option><option>Hoạt động</option><option>Không hoạt động</option></select><select><option>Chọn hình thức lặp lại</option><option>Cố định</option><option>Hàng tháng</option></select><button class="btn btn-primary">TÌM KIẾM</button></div>' +
      '<table class="pt"><thead><tr><th>#</th><th>Tên lịch làm việc</th><th>Hình thức lặp lại</th><th>Ngày bắt đầu</th><th>Ngày kết thúc</th><th>Số NV</th><th>Ghi chú</th></tr></thead><tbody>' +
      (rows.length ? rows.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(s.name) + '</td><td>Cố định</td><td>' + T.dmy(s.start) + '</td><td>' + T.dmy(s.end) + '</td><td>' + s.staffs.length + '</td><td>' + esc(s.note) + '</td></tr>').join('') : '<tr><td colspan="7" style="color:#999;text-align:center;padding:24px">Chưa có lịch. Bấm "Phân ca làm" để tạo.</td></tr>') + '</tbody></table>';
    return portlet('Lịch làm việc', '<button class="btn btn-primary btn-pill" data-act="wsForm">+ Phân ca làm</button>', body, 'ws');
  }
  A.wsForm = () => {
    const today = Store.today();
    const body = '<form id="fws"><div class="form-row"><label>Tên lịch làm việc <span class="req">*</span></label><input class="fc" name="name" placeholder="Ca cho dân hành chính"></div>' +
      '<div class="form-row"><label>Hình thức lặp lại <span class="req">*</span></label><label><input type="radio" checked> Cố định</label></div>' +
      '<div class="form-row"><label>Ngày bắt đầu phân ca <span class="req">*</span></label><input class="fc" type="date" name="start" value="' + T.addDays(today, 7) + '"></div>' +
      '<div class="form-row"><label>Ngày kết thúc phân ca <span class="req">*</span></label><input class="fc" type="date" name="end" value="' + T.addDays(today, 13) + '"></div>' +
      '<div class="form-row"><label>Ghi chú</label><textarea class="fc" name="note" rows="2"></textarea></div></form>' +
      '<h4>Danh sách ca</h4><div id="wsRows">' + wsRow() + '</div><button class="btn btn-default btn-sm" data-act="wsAddRow">+ Thêm lịch làm</button>' +
      '<h4 style="margin-top:18px">Nhân viên áp dụng</h4><div class="days">' + S().staffs.filter((s) => s.staff_id > 1).map((s) => '<label><input type="checkbox" class="wsSt" value="' + s.staff_id + '"> ' + esc(s.full_name) + '</label>').join('') + '</div>';
    UI.modal({ title: 'Phân ca làm việc', note: 'ws', size: 'lg', body, footer: '<button class="btn btn-default" data-act="closeModal">HỦY</button><button class="btn btn-primary" data-act="wsSave">LƯU THÔNG TIN</button>' });
  };
  function wsRow() {
    const dn = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']; const keys = ['is_monday', 'is_tuesday', 'is_wednesday', 'is_thursday', 'is_friday', 'is_saturday', 'is_sunday'];
    return '<div class="wsr" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap"><select class="fc sh" style="max-width:200px" data-chg="wsShift">' + UI.opt(S().shifts.filter((s) => s.is_actived && !s.is_deleted && !s.is_system), '', 'shift_id', 'shift_name', 'Chọn ca làm') + '</select><select class="fc br" style="max-width:200px"><option value="">Chọn vị trí làm việc</option></select><span class="days">' + dn.map((l, i) => '<label><input type="checkbox" disabled data-k="' + keys[i] + '"> ' + l + '</label>').join('') + '</span><label><input type="checkbox" class="ot"> Tăng ca</label></div>';
  }
  A.wsAddRow = () => {
    const bad = [...document.querySelectorAll('.wsr')].find((r) => !r.querySelector('.sh').value || !r.querySelector('.br').value);
    if (bad) return UI.swal('error', !bad.querySelector('.sh').value ? 'Hãy chọn ca làm việc' : 'Hãy chọn vị trí làm việc');
    document.getElementById('wsRows').insertAdjacentHTML('beforeend', wsRow());
  };
  A.wsShift = (d, el) => {
    const r = el.closest('.wsr'); const s = Store.shift(el.value);
    r.querySelectorAll('[data-k]').forEach((c) => { c.checked = !!(s && s[c.dataset.k]); });
    r.querySelector('.br').innerHTML = UI.opt(s ? S().branches.filter((b) => s.branches.includes(b.branch_id)) : [], '', 'branch_id', 'branch_name', 'Chọn vị trí làm việc');
  };
  A.wsSave = async () => {
    const v = UI.form(document.getElementById('fws'));
    const rows = [...document.querySelectorAll('.wsr')].map((r) => ({ shift_id: r.querySelector('.sh').value, branch_id: r.querySelector('.br').value, is_ot: r.querySelector('.ot').checked }));
    const staffs = [...document.querySelectorAll('.wsSt:checked')].map((x) => Number(x.value));
    const r = E.portal.storeSchedule({ name: v.name.trim(), start: v.start, end: v.end, note: v.note, rows, staffs });
    if (r.ok) UI.closeModal(); await UI.result(r); if (r.ok) Portal.render();
  };

  /* ================= CHẤM CÔNG TỔNG HỢP ================= */
  function scrTk() {
    const today = Store.today();
    let from, to, label;
    if (P.tkType === 'by_week') { const d = weekDays(); from = d[0]; to = d[6]; label = 'Tuần ' + T.isoWeek(from) + ' (' + T.dmy(from) + ' - ' + T.dmy(to) + ')'; }
    else { from = today.slice(0, 8) + '01'; const e = T.dt(from); e.setMonth(e.getMonth() + 1); e.setDate(0); to = T.ymd(e); label = 'Tháng ' + Number(today.slice(5, 7)); }
    const rows = S().staffs.map((st) => ({ st, r: E.summary(st.staff_id, from, to) }));
    const body = '<div class="filter"><select><option>Chọn chi nhánh</option></select><select><option>Chọn phòng ban</option></select><select><option>Chọn nhân viên</option></select><select data-chg="tkType"><option value="by_week"' + (P.tkType === 'by_week' ? ' selected' : '') + '>Theo tuần</option><option value="by_month"' + (P.tkType === 'by_month' ? ' selected' : '') + '>Theo tháng</option></select><div class="wkbox"><button class="btn btn-default" data-act="wk" data-d="-1">‹</button><input class="fc" disabled value="' + label + '"><button class="btn btn-default" data-act="wk" data-d="1">›</button></div></div>' +
      '<div class="tw"><table class="pt"><thead><tr><th>Nhân viên</th><th>Tổng ca làm</th><th>Tổng ca tăng ca</th><th>Tổng số công</th><th>Số giờ làm yêu cầu tối thiểu</th><th>Tổng giờ làm</th><th>Tổng giờ tăng ca</th><th>Số lần đi trễ</th><th>Số lần về sớm</th><th>Số ca nghỉ không lương</th><th>Số ca nghỉ có lương</th></tr></thead><tbody>' +
      rows.map(({ st, r }) => '<tr><td><a href="#" data-act="pf2" data-staff="' + st.staff_id + '">' + esc(st.full_name) + '</a><br><small>' + esc(Store.branch(st.branch_id).branch_name) + '</small></td><td>' + r.total + '</td><td>' + r.ot + '</td><td><b>' + T.fmtH(r.cong) + '</b></td><td>' + T.fmtH(r.min) + '</td><td>' + T.fmtH(r.hours) + '</td><td>' + T.fmtH(r.otHours) + '</td><td>' + r.late + '</td><td>' + r.soon + '</td><td>' + r.unpaid + '</td><td>' + r.paid + '</td></tr>').join('') + '</tbody></table></div>';
    return portlet('Chấm công', '<button class="btn btn-primary btn-pill">Export</button>', body, 'tk-summary');
  }
  A.tkType = (d, el) => { P.tkType = el.value; Portal.render(); };
  A.pf2 = (d) => { P.fStaff = d.staff; P.screen = 'tws'; Portal.render(); };

  /* ================= RATE 1-4 ================= */
  function rates(t) {
    const r = [0, 0, 0, 0, 0]; const h = Number(t.actual_time_work_confirmed || 0); if (!h) return r;
    const st = T.toMin(t.working_time) * 60; let en = st + Math.round(h * 3600); if (en > 86399) en = 86399;
    const wd = T.weekday(t.working_day);
    const rules = wd === 6 ? [[3, 0, 86399]] : wd === 0 ? [[4, 0, 86399]] : [[1, 0, 64799], [2, 64800, 86399]];
    let tot = 0; const ov = rules.map(([n, a, b]) => { const o = Math.max(0, Math.min(en, b) - Math.max(st, a)); tot += o; return [n, o]; });
    if (!tot) { r[1] = h; return r; }
    ov.forEach(([n, o]) => { r[n] += Math.round(h * o / tot * 100) / 100; });
    return r;
  }
  function scrRate() {
    const days = weekDays();
    const staffs = S().staffs.filter((st) => E.active().some((t) => t.staff_id === st.staff_id && t.working_day >= days[0] && t.working_day <= days[6]));
    let html = '<div class="filter"><select><option>Nhân viên: Tất cả</option></select><select><option>Chi nhánh: Tất cả</option></select><div class="wkbox"><button class="btn btn-default" data-act="wk" data-d="-1">‹</button><input class="fc" disabled value="Tuần ' + T.isoWeek(days[0]) + ' (' + T.dmy(days[0]) + ' - ' + T.dmy(days[6]) + ')"><button class="btn btn-default" data-act="wk" data-d="1">›</button></div></div><div class="tw"><table class="pt"><thead><tr><th>STT</th><th>Họ tên NV</th><th>Người quản lý</th><th>Giờ làm việc</th><th>Tổng</th><th title="Mon-Fri 00:00-17:59">Rate 1</th><th title="Mon-Fri 18:00-23:59">Rate 2</th><th title="Saturday">Rate 3</th><th title="Sunday">Rate 4</th>' + days.map((d) => '<th>' + T.dayNames[T.weekday(d)] + ' ' + T.dm(d) + '</th>').join('') + '</tr></thead><tbody>';
    staffs.forEach((st, i) => {
      const list = E.active().filter((t) => t.staff_id === st.staff_id && t.working_day >= days[0] && t.working_day <= days[6]);
      const tot = [0, 0, 0, 0, 0]; let work = 0, conf = 0;
      list.forEach((t) => { work += Number(t.actual_time_work || 0); conf += Number(t.actual_time_work_confirmed || 0); rates(t).forEach((v, k) => { tot[k] += v; }); });
      html += '<tr><td>' + (i + 1) + '</td><td>' + esc(st.full_name) + '</td><td>' + esc(st.staff_manager_id ? E.staffName(st.staff_manager_id) : '') + '</td><td>' + T.fmtH(work) + '</td><td><b>' + T.fmtH(conf) + '</b></td>' + [1, 2, 3, 4].map((k) => '<td>' + (tot[k] ? T.fmtH(tot[k]) : '') + '</td>').join('') +
        days.map((d) => '<td style="font-size:11px;min-width:130px">' + list.filter((t) => t.working_day === d).map((t) => { const ci = E.firstIn(t), co = E.lastOut(t); return '<b>' + esc(E.shiftOf(t).shift_name) + '</b><br><i>' + esc(Store.branch(t.branch_id).branch_name) + '</i><br>Actual: in ' + (ci ? ci.time : '--') + ' - out ' + (co ? co.time : '--') + '<br>Standard: in ' + t.working_time + ' - out ' + t.working_end_time + '<br>Giờ làm: ' + T.fmtH(t.actual_time_work) + ' · Duyệt: ' + T.fmtH(t.actual_time_work_confirmed); }).join('<hr>') + '</td>').join('') + '</tr>';
    });
    html += '</tbody></table></div>';
    return portlet('Báo cáo chấm công', '<button class="btn btn-primary btn-pill">Xuất Excel</button>', html, 'rate');
  }

  /* ================= CẤU HÌNH ================= */
  function scrCfg() {
    const tabs = [['general', 'Cấu hình chung'], ['wifi', 'Danh sách cấu hình chấm công'], ['free', 'Cấu hình chấm công linh động'], ['approved', 'Danh sách nhân viên không cần duyệt lịch làm việc'], ['leave', 'Cấu hình ngày phép còn lại'], ['noti', 'Cấu hình thông báo']];
    let body = '<div class="ptabs">' + tabs.map(([k, l]) => '<button class="' + (P.cfgTab === k ? 'on' : '') + '" data-act="cfgTab" data-k="' + k + '">' + l + '</button>').join('') + '</div>';
    let tools = '';
    if (P.cfgTab === 'general') {
      tools = '<button class="btn btn-primary btn-pill" data-act="cfgSave">Lưu thông tin</button>';
      const noteId = { late_check_in: 'cfg-late_check_in', off_check_in: 'cfg-off_check_in', back_soon_check_out: 'cfg-back_soon_check_out', off_check_out: 'cfg-off_check_out', checkin_time_before: 'cfg-checkin_time_before', close_time_working_start: 'cfg-close', close_time_working_end: 'cfg-close', remind_checkin_checkout: 'cfg-remind', checkin_with_image: 'cfg-image', admin_confirm_work_schedule: 'cfg-admin-confirm' };
      body += '<div id="cfgBox">' + S().config.map((c) => {
        const cb = c.code === 'close_time_working_end' ? '<span style="width:20px;display:inline-block"></span>' : '<input type="checkbox" class="act"' + (c.is_actived ? ' checked' : '') + '>';
        let input;
        if (c.unit === 'flag') input = '<input type="hidden" class="val" value="' + c.value + '"><span style="color:#9699a2;font-size:12px">(giá trị ẩn = ' + c.value + ')</span>';
        else if (c.code === 'close_time_working_start') input = 'Từ ngày <input class="fc val" style="width:70px" value="' + c.value + '"> Tháng trước';
        else if (c.code === 'close_time_working_end') input = 'Đến ngày <input class="fc val" style="width:70px" value="' + c.value + '"> Tháng này <span style="color:#e24c4b;font-size:11.5px">(không có checkbox → luôn lưu tắt)</span>';
        else input = '<input class="fc val" style="width:90px" value="' + c.value + '"> ' + (c.unit === 'hour' ? 'Giờ' : 'Phút') + ' ' + (c.suffix || '');
        return '<div class="form-row" data-code="' + c.code + '" style="grid-template-columns:420px 1fr"><label>' + cb + ' ' + esc(c.label || '') + N(noteId[c.code]) + '</label><div>' + input + '</div></div>';
      }).join('') + '</div>';
      return portlet('Cấu hình chấm công', tools, body, 'cfg-general');
    }
    if (P.cfgTab === 'wifi') {
      tools = '<button class="btn btn-primary btn-pill" data-act="tkcForm">+ Thêm cấu hình chấm công</button>';
      body += '<div class="filter"><select><option>Chọn chi nhánh</option></select><button class="btn btn-primary">TÌM KIẾM</button></div><table class="pt"><thead><tr><th>#</th><th>Loại chấm công</th><th>Tọa độ</th><th>Tên wifi</th><th>Địa chỉ IP</th><th>Bán kính</th><th>Chi nhánh</th><th>Trạng thái</th><th>Ghi chú</th><th>Hành động</th></tr></thead><tbody>' +
        S().tkConfigs.filter((c) => !c.is_deleted).map((c, i) => '<tr><td>' + (i + 1) + '</td><td>' + (c.timekeeping_type === 'wifi' ? 'Wifi' : 'GPS') + '</td><td>' + (c.timekeeping_type === 'gps' ? c.latitude + ',' + c.longitude : '') + '</td><td>' + esc(c.wifi_name) + '</td><td>' + esc(c.wifi_ip) + '</td><td>' + (c.allowable_radius != null ? c.allowable_radius + ' m' : '') + '</td><td>' + esc(Store.branch(c.branch_id).branch_name) + '</td><td><label class="switch"><input type="checkbox" data-chg="tkcStatus" data-id="' + c.id + '"' + (c.is_actived ? ' checked' : '') + '><span></span></label></td><td>' + esc(c.note) + '</td><td><button class="icon-btn" data-act="tkcForm" data-id="' + c.id + '">✎</button><button class="icon-btn" data-act="tkcDel" data-id="' + c.id + '">🗑</button></td></tr>').join('') + '</tbody></table>';
      return portlet('Cấu hình chấm công', tools, body, 'cfg-wifi');
    }
    if (P.cfgTab === 'free' || P.cfgTab === 'approved') {
      const isFree = P.cfgTab === 'free';
      const fld = isFree ? 'check_in_limit' : 'check_approved_time_working';
      const inList = S().staffs.filter((s) => s[fld] === 0);
      const outList = S().staffs.filter((s) => s[fld] !== 0);
      body += '<div class="filter"><input placeholder="Nhập tên nhân viên"><button class="btn btn-primary">SEARCH</button></div><table class="pt"><thead><tr><th>#</th><th>Nhân viên</th><th>Tài khoản</th><th>Chức vụ</th><th>Chi nhánh</th><th></th></tr></thead><tbody>' +
        (inList.length ? inList.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(s.full_name) + '</td><td>' + s.user_name + '</td><td>' + esc(s.title) + '</td><td>' + esc(Store.branch(s.branch_id).branch_name) + '</td><td><button class="icon-btn" data-act="flagSet" data-f="' + fld + '" data-id="' + s.staff_id + '" data-v="1">🗑</button></td></tr>').join('') : '<tr><td colspan="6" style="color:#999">Chưa có nhân viên</td></tr>') + '</tbody></table>' +
        '<div style="margin-top:14px"><b>Thêm nhân viên vào cấu hình:</b> ' + outList.map((s) => '<button class="btn btn-default btn-sm" style="margin:3px" data-act="flagSet" data-f="' + fld + '" data-id="' + s.staff_id + '" data-v="0">+ ' + esc(s.full_name) + '</button>').join('') + '</div>';
      return portlet('Cấu hình chấm công', '', body, isFree ? 'cfg-free' : 'cfg-approved');
    }
    if (P.cfgTab === 'leave') {
      body += '<table class="pt"><thead><tr><th>#</th><th>Nhân viên</th><th>Tổng số ngày phép năm</th><th>Số ngày phép năm đã nghỉ</th><th>Số ngày phép năm còn lại</th><th>Năm</th><th></th></tr></thead><tbody>' +
        S().staffs.map((s, i) => { const l = S().leaveDays.find((x) => x.staff_id === s.staff_id) || {}; return '<tr><td>' + (i + 1) + '</td><td>' + esc(s.full_name) + '</td><td>' + (l.total_leave_day || 0) + '</td><td>' + (l.total_using_leave_day || 0) + '</td><td>' + (l.total_using_remaining_day || 0) + '</td><td>' + (l.year || '') + '</td><td><button class="icon-btn" data-act="leaveEdit" title="Delete">✎</button></td></tr>'; }).join('') + '</tbody></table>';
      return portlet('Cấu hình chấm công', '', body, 'cfg-leave');
    }
    body += '<table class="pt"><thead><tr><th>#</th><th>Thông báo các hạng mục bên dưới cho</th><th>Mô tả</th><th>Email</th><th>App</th><th>Tiêu đề</th><th>Nội dung</th><th>Trạng thái</th></tr></thead><tbody><tr><td colspan="8" style="padding:24px;color:#9699a2;text-align:center">Dữ liệu của bảng <code>sf_timekeeping_notification</code> nằm trong DB (chưa xác định). Noti thật được gửi cứng trong code staff-api, xem tab "Thông báo đẩy" ở khung bên phải.</td></tr></tbody></table>';
    return portlet('Cấu hình thông báo tự động — tab Chấm công', '<button class="btn btn-primary btn-pill">Chỉnh sửa cấu hình</button>', body, 'cfg-noti');
  }
  A.cfgTab = (d) => { P.cfgTab = d.k; Portal.render(); };
  A.cfgSave = async () => {
    const rows = [...document.querySelectorAll('#cfgBox [data-code]')].map((r) => ({ code: r.dataset.code, is_actived: r.querySelector('.act') ? r.querySelector('.act').checked : false, value: (r.querySelector('.val').value || '').replace(/,/g, '') }));
    const bad = rows.find((r) => !/^\d+$/.test(r.value));
    if (bad) return UI.swal('error', 'Chỉ nhập số nguyên ≥ 0', null, 'AutoNumeric: decimalPlaces 0, minimumValue 0');
    await UI.result(E.portal.saveConfig(rows)); Portal.render();
  };
  A.leaveEdit = () => UI.swal('error', 'Không có phản hồi', null, 'Thực tế: hàm configStaff.showModalEditLeaveDay KHÔNG tồn tại → bấm không có tác dụng (lỗi JS)');
  A.flagSet = async (d) => {
    const s = Store.staff(d.id); s[d.f] = Number(d.v); Store.save();
    E.log({ api: 'POST shift/config-general/' + (d.v === '0' ? 'add' : 'remove') + '-config-staff', ok: true, message: 'Cập nhật thành công', db: ['staffs.' + d.f + ' = ' + d.v + ' cho ' + s.full_name] });
    Portal.render();
  };
  A.tkcStatus = (d, el) => { const c = S().tkConfigs.find((x) => x.id === Number(d.id)); c.is_actived = el.checked ? 1 : 0; Store.save(); E.log({ api: 'POST shift/timekeeping-config/change-status', ok: true, message: 'Thay đổi trạng thái thành công', db: ['is_actived = ' + c.is_actived + (c.is_actived ? '' : ' → cấu hình này bị bỏ qua khi check-in')] }); };
  A.tkcDel = async (d) => { if (!(await UI.swal('question', 'Bạn có muốn xóa không?'))) return; S().tkConfigs.find((x) => x.id === Number(d.id)).is_deleted = 1; Store.save(); E.log({ api: 'POST shift/timekeeping-config/destroy', ok: true, message: 'Xóa thành công', db: ['Xoá mềm is_deleted = 1'] }); Portal.render(); };
  A.tkcForm = (d) => {
    const c = d.id ? S().tkConfigs.find((x) => x.id === Number(d.id)) : { branch_id: '', timekeeping_type: 'wifi', wifi_name: '', wifi_ip: '', latitude: '', longitude: '', allowable_radius: '', note: '' };
    const g = c.timekeeping_type === 'gps';
    const body = '<form id="ftkc"><div class="form-row"><label>Chi nhánh làm việc <span class="req">*</span></label><select class="fc" name="branch_id">' + UI.opt(S().branches, c.branch_id, 'branch_id', 'branch_name', 'Chọn chi nhánh') + '</select></div>' +
      '<div class="form-row"><label>Hình thức</label><div class="days"><label><input type="radio" name="timekeeping_type" value="wifi" data-chg="tkcType"' + (g ? '' : ' checked') + '> Chấm công bằng WIFI</label><label><input type="radio" name="timekeeping_type" value="gps" data-chg="tkcType"' + (g ? ' checked' : '') + '> Chấm công bằng GPS</label></div></div>' +
      '<div class="gw" style="display:' + (g ? 'none' : 'block') + '"><div class="form-row"><label>Tên wifi <span class="req">*</span></label><input class="fc" name="wifi_name" value="' + esc(c.wifi_name) + '"></div><div class="form-row"><label>Địa chỉ IP <span class="req">*</span>' + N('cfg-wifi-ip') + '</label><input class="fc" name="wifi_ip" placeholder="Vd: 42.114.204.250" value="' + esc(c.wifi_ip) + '"></div><div class="form-row"><label></label><a href="https://whatismyipaddress.com/" target="_blank" rel="noopener">Lấy địa chỉ IP từ wifi hiện tại</a></div></div>' +
      '<div class="gg" style="display:' + (g ? 'block' : 'none') + '"><div class="form-row"><label>Vĩ độ <span class="req">*</span></label><input class="fc" name="latitude" value="' + (c.latitude == null ? '' : c.latitude) + '"></div><div class="form-row"><label>Kinh độ <span class="req">*</span></label><input class="fc" name="longitude" value="' + (c.longitude == null ? '' : c.longitude) + '"></div><div class="form-row"><label>Bán kính cho phép (m)' + N('cfg-radius') + '</label><input class="fc" type="number" name="allowable_radius" value="' + (c.allowable_radius == null ? '' : c.allowable_radius) + '"></div></div>' +
      '<div class="form-row"><label>Ghi chú</label><textarea class="fc" name="note" rows="2">' + esc(c.note) + '</textarea></div></form>';
    UI.modal({ title: d.id ? 'Chỉnh sửa cấu hình chấm công' : 'Thêm cấu hình chấm công', note: 'cfg-wifi', body, footer: '<button class="btn btn-default" data-act="closeModal">HỦY</button><button class="btn btn-primary" data-act="tkcSave" data-id="' + (d.id || '') + '">LƯU THÔNG TIN</button>' });
  };
  A.tkcType = (d, el) => { const f = document.getElementById('ftkc'); f.querySelector('.gw').style.display = el.value === 'wifi' ? 'block' : 'none'; f.querySelector('.gg').style.display = el.value === 'gps' ? 'block' : 'none'; };
  A.tkcSave = async (d) => { const v = UI.form(document.getElementById('ftkc')); const r = E.portal.saveTkConfig(v, d.id ? Number(d.id) : null); if (r.ok) UI.closeModal(); await UI.result(r); if (r.ok) Portal.render(); };

  /* ================= LỊCH SỬ CHẤM CÔNG ================= */
  function scrAtt() {
    const today = Store.today();
    let rows = E.active().filter((t) => t.ins.length).sort((a, b) => (b.working_day + E.firstIn(b).time).localeCompare(a.working_day + E.firstIn(a).time));
    const st = P.attStatus;
    if (st === '1') rows = rows.filter((t) => (t.number_late_time === 0 || t.is_approve_late == 1) && (t.number_time_back_soon === 0 || t.is_approve_soon == 1));
    if (st === '2') rows = rows.filter((t) => t.number_late_time > 0 && t.is_approve_late != 1);
    if (st === '3') rows = rows.filter((t) => t.number_time_back_soon > 0);
    if (st === '4') rows = rows.filter((t) => t.working_day < today && !E.lastOut(t));
    const typ = (x) => (!x ? '' : x.timekeeping_type === 'wifi' ? '<a href="#">WIFI</a>' : x.timekeeping_type === 'gps' ? '<a href="#">GPS</a>' : x.timekeeping_type === 'time-attendance' ? 'Chấm công hộ' : '<a href="#">Linh động</a>');
    const body = '<div class="filter"><input placeholder="Nhập tên nhân viên"><select><option>Chọn phòng ban</option></select><select><option>Vui lòng chọn chi nhánh.</option></select><select data-chg="attSt">' + [['0', 'Vui lòng chọn trạng thái'], ['1', 'Đi đúng giờ'], ['2', 'Đi trễ'], ['3', 'Về sớm'], ['4', 'Chưa checkout']].map(([v, l]) => '<option value="' + v + '"' + (st === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select><select><option>Chọn hình thức chấm công</option><option>Wifi</option><option>Gps</option></select></div>' +
      '<div class="tw"><table class="pt"><thead><tr><th>#</th><th>Tên nhân viên</th><th>Vị trí làm việc</th><th>Tên ca</th><th>Ngày làm việc</th><th>Giờ vào</th><th>Giờ ra</th><th>Phút trễ/sớm</th><th>Lý do' + N('att-reason') + '</th><th></th></tr></thead><tbody>' +
      rows.map((t, i) => { const ci = E.firstIn(t), co = E.lastOut(t); const reason = E.attendanceReason(t); const showMenu = (t.number_late_time > 0 && t.is_approve_late != 1) || (t.number_time_back_soon > 0 && t.is_approve_soon != 1) || (t.working_day !== today && !co);
        return '<tr><td>' + (i + 1) + '</td><td>' + esc(E.staffName(t.staff_id)) + '</td><td>' + esc(Store.branch(t.branch_id).branch_name) + '</td><td>' + esc(E.shiftOf(t).shift_name) + '<br><small>(' + t.working_time + ' - ' + t.working_end_time + ')</small></td><td>' + T.dmy(t.working_day) + '</td><td>' + ci.time + '<br><small>' + typ(ci) + '</small></td><td>' + (co ? co.time + '<br><small>' + typ(co) + '</small>' : '') + '</td><td>' + t.number_late_time + ' / ' + t.number_time_back_soon + '</td><td>' + reason.map(esc).join('<br>') + '</td><td>' + (showMenu ? '<button class="icon-btn" data-act="attMenu" data-id="' + t.id + '">…</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return portlet('Lịch sử chấm công', '', body, 'att');
  }
  A.attSt = (d, el) => { P.attStatus = el.value; Portal.render(); };
  A.attMenu = (d, el) => {
    const t = Store.tw(d.id); const items = [];
    if (t.number_late_time > 0 && t.is_approve_late != 1) items.push({ label: 'Duyệt đi trễ', act: 'attApprove', data: { id: t.id, type: 1 }, icon: '✔' });
    if (t.number_time_back_soon > 0 && t.is_approve_soon != 1) items.push({ label: 'Duyệt về sớm', act: 'attApprove', data: { id: t.id, type: 2 }, icon: '✔' });
    if (t.working_day !== Store.today() && !E.lastOut(t)) items.push({ label: 'Check out', disabled: true, hint: 'Thực tế popup KHÔNG hiện: trang thiếu phần tử #show-modal-checkin (bug)', icon: '⇥' });
    UI.dropdown(el, items);
  };
  A.attApprove = async (d) => { UI.closeDropdown(); if (!(await UI.swal('question', 'Duyệt checkin / checkout', 'Bạn có muốn duyệt ' + (d.type === '1' ? 'đi trễ' : 'về sớm') + ' không?'))) return; await UI.result(E.portal.approveLateSoonWeb(me(), Number(d.id), Number(d.type))); Portal.render(); };

  /* ================= THƯỞNG PHẠT ================= */
  function scrRec() {
    const body = '<div class="filter"><input placeholder="Nhập thông tin tìm kiếm"><button class="btn btn-primary">TÌM KIẾM</button></div><table class="pt"><thead><tr><th></th><th>Loại</th><th>Nội dung</th><th>Người tạo</th><th>Ngày tạo</th><th>Trạng thái</th></tr></thead><tbody>' +
      S().recompense.filter((r) => !r.is_deleted).map((r) => '<tr><td>' + (r.is_system ? '<span class="tag api">hệ thống</span>' : '<button class="icon-btn" data-act="recForm" data-id="' + r.recompense_id + '">✎</button><button class="icon-btn" data-act="recCatDel" data-id="' + r.recompense_id + '">🗑</button>') + '</td><td>' + (r.type === 'R' ? 'Thưởng' : 'Phạt') + '</td><td>' + esc(r.recompense_name) + '</td><td>' + esc(E.staffName(r.created_by)) + '</td><td>' + esc(r.created_at) + '</td><td><label class="switch"><input type="checkbox" data-chg="recStatus" data-id="' + r.recompense_id + '"' + (r.is_actived ? ' checked' : '') + '><span></span></label></td></tr>').join('') + '</tbody></table>';
    return portlet('Danh sách thưởng phạt', '<button class="btn btn-primary btn-pill" data-act="recForm">+ Thêm thưởng phạt</button>', body, 'rec');
  }
  A.recStatus = (d, el) => { const r = S().recompense.find((x) => x.recompense_id === Number(d.id)); r.is_actived = el.checked ? 1 : 0; Store.save(); };
  A.recCatDel = async (d) => { if (!(await UI.swal('question', 'Bạn có muốn xóa không?'))) return; S().recompense.find((x) => x.recompense_id === Number(d.id)).is_deleted = 1; Store.save(); Portal.render(); };
  A.recForm = (d) => {
    const r = d.id ? S().recompense.find((x) => x.recompense_id === Number(d.id)) : { type: 'R', recompense_name: '' };
    UI.modal({ title: d.id ? 'Chỉnh sửa thưởng phạt' : 'Thêm thưởng phạt', size: 'sm', note: 'rec', body: '<form id="frec"><div class="days" style="margin-bottom:12px"><label><input type="radio" name="type" value="R"' + (r.type === 'R' ? ' checked' : '') + '> Thưởng</label><label><input type="radio" name="type" value="P"' + (r.type === 'P' ? ' checked' : '') + '> Phạt</label></div><label>Tên nội dung <span class="req">*</span></label><input class="fc" name="recompense_name" value="' + esc(r.recompense_name) + '"></form>', footer: '<button class="btn btn-default" data-act="closeModal">HỦY</button><button class="btn btn-primary" data-act="recSave" data-id="' + (d.id || '') + '">LƯU</button>' });
  };
  A.recSave = async (d) => {
    const v = UI.form(document.getElementById('frec')); const name = v.recompense_name.trim();
    if (!name) return UI.swal('error', 'Hãy nhập tên nội dung');
    if (name.length > 190) return UI.swal('error', 'Tên nội dung tối đa 190 kí tự');
    if (S().recompense.some((x) => !x.is_deleted && x.recompense_name === name && x.recompense_id !== Number(d.id))) return UI.swal('error', 'Tên nội dung đã tồn tại', null, 'Duy nhất KHÔNG phân biệt loại Thưởng/Phạt');
    if (d.id) Object.assign(S().recompense.find((x) => x.recompense_id === Number(d.id)), { type: v.type, recompense_name: name });
    else S().recompense.push({ recompense_id: Store.nextId(), recompense_name: name, type: v.type, is_system: 0, is_actived: 1, is_deleted: 0, created_by: me(), created_at: Store.today() + ' ' + T.hm(Store.now()) });
    Store.save(); UI.closeModal(); await UI.swal('success', d.id ? 'Chỉnh sửa thành công' : 'Thêm thành công'); Portal.render();
  };

  const SCREENS = { menu: scrMenu, shift: scrShift, tws: scrTws, ws: scrWs, tk: scrTk, rate: scrRate, cfg: scrCfg, att: scrAtt, rec: scrRec };
  const Portal = {
    render() { document.getElementById('main').innerHTML = shell(SCREENS[P.screen]()); },
    go(k) { P.screen = k; Portal.render(); }
  };
  window.Portal = Portal;
})();
