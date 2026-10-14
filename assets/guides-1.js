/* ===== TIER 1 — Chức năng chủ yếu (theo đúng thứ tự luồng: cấu hình → ca → xếp lịch → duyệt → chấm công → điều chỉnh → xác nhận → báo cáo/lương) ===== */
(function () {
  const K = HDSD.K, t = K.t;
  const P = K.P, W = K.WHO;

  /* ---------- mảnh giao diện dùng lại ---------- */
  const cfgTabs = (on) => '<div data-h="tabs">' + K.tabs([
    [t('Cấu hình chung', 'General settings'), 'tab-general', on === 'g'],
    [t('Danh sách cấu hình chấm công', 'Attendance points'), 'tab-wifi', on === 'w'],
    [t('Cấu hình chấm công linh động', 'Flexible attendance'), 'tab-free', on === 'f'],
    [t('Danh sách nhân viên không cần duyệt lịch làm việc', 'Staff without schedule approval'), 'tab-approved', on === 'a'],
    [t('Cấu hình ngày phép còn lại', 'Remaining leave'), 'tab-leave', on === 'l']
  ]) + '</div>';
  const cfgRow = (k, label, s, unit) => '<div class="form-row wide" data-h="r-' + k + '"><label>' + K.ck('c-' + k, s['c' + k]) + label + '</label><div>' + K.inp('v-' + k, s['v' + k], { w: 80 }) + '<span class="unit">' + unit + '</span></div></div>';
  const cfgGeneral = (s) => cfgTabs('g') +
    cfgRow('late', t('Tính là đi trễ khi thời gian chấm công vào sau', 'Counted as late when clock-in is after'), s, t('Phút so với giờ bắt đầu', 'minutes past shift start')) +
    cfgRow('offin', t('Tính là nghỉ không lương khi thời gian chấm công vào sau', 'Counted as unpaid leave when clock-in is after'), s, t('Phút', 'minutes')) +
    cfgRow('soon', t('Tính là về sớm khi thời gian chấm công ra trước', 'Counted as early leave when clock-out is before'), s, t('Phút so với giờ kết thúc', 'minutes before shift end')) +
    cfgRow('offout', t('Tính là nghỉ không lương khi thời gian chấm công ra trước', 'Counted as unpaid leave when clock-out is before'), s, t('Phút', 'minutes')) +
    cfgRow('before', t('Được phép checkin trước', 'Check-in allowed before shift start by'), s, t('Phút', 'minutes')) +
    '<div class="form-row wide" data-h="r-close"><label>' + K.ck('', 1) + t('Thời gian chốt công hàng tháng', 'Monthly attendance closing period') + '</label><div>' + t('Từ ngày', 'From day') + ' ' + K.inp('', '26', { w: 56 }) + ' ' + t('tháng trước — Đến ngày', 'of last month — to day') + ' ' + K.inp('', '25', { w: 56 }) + ' ' + t('tháng này', 'of this month') + '</div></div>' +
    '<div class="form-row wide" data-h="r-img"><label>' + K.ck('c-img', s.cimg) + t('Bắt buộc chấm công với ảnh', 'Require a photo when clocking in/out') + '</label><div></div></div>' +
    '<div class="form-row wide" data-h="r-admin"><label>' + K.ck('c-admin', s.cadmin) + t('Cho phép Admin xác nhận ca làm việc', 'Allow Admin to confirm working time') + '</label><div></div></div>';
  const CFG0 = { clate: 0, vlate: '0', coffin: 0, voffin: '0', csoon: 0, vsoon: '0', coffout: 0, voffout: '0', cbefore: 0, vbefore: '0', cimg: 0, cadmin: 0 };

  const cell = {
    done: (o) => Object.assign({ sn: K.sang(), tm: '08:00 📱 - 17:02 📱', col: 'ok', st: 'confirmed' }, o),
    today: (o) => Object.assign({ sn: K.sang(), tm: '--:-- - --:--', col: 'miss', st: 'approved' }, o),
    fut: (o) => Object.assign({ sn: K.sang(), tm: '08:00 - 17:00', col: 'future', st: 'approved' }, o),
    add: (h) => ({ add: h || 'x' })
  };
  const day = (i) => K.dn(i) + ', ' + K.d(i);
  const acts = (on) => [[t('Đổi ca làm', 'Change shift'), on ? 'chg' : ''], [t('Đi muộn / Về sớm', 'Late / Early'), on ? 'late' : ''], [t('Làm thêm giờ', 'Overtime'), on ? 'ot' : '', 'or']];
  const card = (i, st, o) => K.sched(Object.assign({ day: day(i), st, shift: K.sang(), time: '08:00 -> 17:00', est: 8 }, o));
  const llv = (cards, c, o) => K.app(Object.assign({ title: t('Lịch làm việc', 'Work schedule'), right: '<button data-h="plus">＋</button>', body: K.weekh() + K.sum({ name: P.an, c, est: c.est, act: c.act, conf: c.conf }) + cards }, o || {}));
  const anHome = (o) => K.app(Object.assign({ raw: K.home(Object.assign({ name: P.an, card: { sn: K.sang(), time: '08:00 - 17:00', btn: 'in' } }, o.home || {})) }, o));
  const mgrHome = (noti, o) => K.app(Object.assign({ raw: K.home({ name: P.mgr, tiles: ['llv', 'pg', 'month', 'hist', 'report', 'manage'], noti }) }, o || {}));
  const pgd = (o) => K.app({ title: t('Chi tiết lịch làm việc', 'Schedule details'), time: o.time, body: K.acard('<b>' + t('Nhân viên', 'Employee') + ': ' + o.name + '</b>') + o.card +
      K.acard(K.akv(t('Thời gian làm việc được xác nhận', 'Confirmed hours'), o.conf || '—') + K.akv(t('Tổng thời gian', 'Total time'), o.total || '<span style="color:#FF9800">' + t('Chưa xác định', 'Undetermined') + '</span>') + K.akv(t('Thời gian ước lượng', 'Estimated time'), '8 ' + t('Giờ', 'h')) + (o.coef ? K.akv(t('Hệ số công', 'Work coefficient'), o.coef) : '')) + (o.hist || ''),
    bottom: o.bottom, dialog: o.dialog });
  const hist1 = (a, b, h, icon) => '<b>' + t('Lịch sử vào ra', 'In/out history') + '</b><div style="height:6px"></div>' + K.acard('<b>' + t('Thời gian', 'Round') + ' 1: ' + h + ' ' + t('Giờ', 'h') + '</b>' + K.akv(t('Giờ vào', 'Clock in'), a + ' ' + (icon || '📱')) + K.akv(t('Giờ ra', 'Clock out'), b + ' ' + (icon === '👤' ? '👤' : '')));
  const cfScreen = (o) => K.app({ title: t('Thời gian làm việc', 'Working time'), body: K.acard(o.who + (o.proxy ? '<br>' + K.chip('proxy') : '')) + K.field(t('Thời gian làm việc thực tế', 'Actual working time'), K.ainp('cf-a', o.val)) + K.field(t('Chấm công', 'Attendance code'), K.asel('cf-c', '1 (' + t('hệ số', 'coefficient') + ' 1)')),
    bottom: K.abtn(t('Xác nhận', 'Confirm'), 'cf-save'), dialog: o.dlg ? K.confirmDlg(K.m('Xác nhận thời gian làm việc?', 'Confirm the working time?')) : null });

  /* =====================================================================
     1. CẤU HÌNH CHUNG
     ===================================================================== */
  HDSD.add({
    id: 'cfg-general', tier: 1, ch: ['web'], icon: '⚙️',
    title: ['Cấu hình chung chấm công', 'General timekeeping settings'],
    sum: ['Đặt ngưỡng đi trễ / về sớm, giới hạn check-in sớm, kỳ chốt công, bắt buộc chụp ảnh và quyền Admin xác nhận ca. Đây là bước đầu tiên trước khi dùng module.', 'Set late / early thresholds, the early check-in limit, the closing period, mandatory photo and the Admin confirmation permission. This is the first step before using the module.'],
    who: ['Admin / HR', 'Admin / HR'],
    init: Object.assign({ saved: 0 }, CFG0),
    web: (s) => K.web({ nav: 'cfg', body: K.portlet(t('Cấu hình chấm công', 'Timekeeping settings'), K.btn(t('Lưu thông tin', 'Save'), 'save'), cfgGeneral(s)), over: s.saved ? K.swalOk(t('Lưu thành công', 'Saved successfully')) : '' }),
    steps: [
      { on: 'web', h: 'tabs', look: true, t: ['Mở menu <b>Chấm công → Cấu hình chấm công</b>. Màn hình có 5 tab, tab đầu tiên là <b>Cấu hình chung</b>.', 'Open <b>Timekeeping → Timekeeping settings</b>. The screen has 5 tabs; the first is <b>General settings</b>.'],
        rule: ['Mỗi dòng có ô tick <b>bật/tắt</b> và ô <b>giá trị</b>. Dòng bị tắt được coi như giá trị <b>0</b>. Đơn vị đã cài sẵn, không sửa được trên giao diện.', 'Each row has an <b>on/off</b> tick and a <b>value</b>. A row that is off counts as <b>0</b>. Units are preset and cannot be changed in the UI.'] },
      { on: 'web', h: 'c-late', set: { clate: 1 }, t: ['Tick để bật dòng <b>"Tính là đi trễ…"</b>.', 'Tick to enable the <b>"Counted as late…"</b> row.'] },
      { on: 'web', h: 'v-late', type: '15', k: 'vlate', t: ['Nhập <b>15</b> phút.', 'Enter <b>15</b> minutes.'],
        rule: ['Con số này có 2 tác dụng: (1) ngưỡng để tô màu / báo cáo <b>"Vào trễ"</b>; (2) <b>chặn chấm công vào</b> nếu nhân viên trễ quá 15 phút mà chưa có đơn xin đi trễ được duyệt — app báo <i>"Quá thời gian checkin."</i> Tắt / = 0: không chặn, trễ từ 1 phút đã bị coi là trễ.', 'This number does two things: (1) it is the threshold for colouring / reporting <b>"Late in"</b>; (2) it <b>blocks clock-in</b> when the employee is more than 15 minutes late without an approved late request — the app shows <i>"Quá thời gian checkin."</i> (check-in time exceeded). Off / 0: no blocking, and 1 minute late already counts as late.'] },
      { on: 'web', h: 'v-offin', type: '120', k: 'voffin', set: { coffin: 1 }, t: ['Bật và nhập <b>120</b> cho dòng <b>"Tính là nghỉ không lương khi… vào sau"</b>.', 'Enable and enter <b>120</b> for <b>"Counted as unpaid leave when clock-in is after"</b>.'],
        rule: ['Vào trễ quá 120 phút → ca bị tính <b>nghỉ không lương trên báo cáo</b> (không đổi dữ liệu ca). Khi bật cả hai, ngưỡng "đi trễ" không được lớn hơn ngưỡng "trễ tính nghỉ" → <i>"Số phút đi trễ phải nhỏ hơn số phút đi trễ tính nghỉ"</i> (bằng nhau vẫn lưu được).', 'More than 120 minutes late → the shift is reported as <b>unpaid leave</b> (shift data is not changed). When both are on, the "late" threshold may not exceed the "late = leave" threshold → <i>"Số phút đi trễ phải nhỏ hơn số phút đi trễ tính nghỉ"</i> (equal values are accepted).'] },
      { on: 'web', h: 'v-soon', type: '10', k: 'vsoon', set: { csoon: 1 }, t: ['Bật và nhập <b>10</b> cho dòng <b>"Tính là về sớm…"</b>.', 'Enable and enter <b>10</b> for <b>"Counted as early leave…"</b>.'],
        rule: ['Chỉ là ngưỡng tô màu / báo cáo "Ra sớm". Hệ thống <b>không chặn</b> việc ra ca. Tắt / = 0: ra sớm từ 1 phút đã bị coi là sớm.', 'Only a threshold for colouring / reporting "Early out". The system <b>never blocks</b> clock-out. Off / 0: 1 minute early already counts as early.'] },
      { on: 'web', h: 'v-offout', type: '60', k: 'voffout', set: { coffout: 1 }, t: ['Bật và nhập <b>60</b> cho dòng <b>"Tính là nghỉ không lương khi… ra trước"</b>.', 'Enable and enter <b>60</b> for <b>"Counted as unpaid leave when clock-out is before"</b>.'],
        rule: ['Ra sớm quá 60 phút → báo cáo tính <b>nghỉ không lương</b>. Ngưỡng "về sớm" không được lớn hơn ngưỡng này.', 'Leaving more than 60 minutes early → reported as <b>unpaid leave</b>. The "early leave" threshold may not exceed this one.'] },
      { on: 'web', h: 'v-before', type: '30', k: 'vbefore', set: { cbefore: 1 }, t: ['Bật và nhập <b>30</b> cho dòng <b>"Được phép checkin trước"</b>.', 'Enable and enter <b>30</b> for <b>"Check-in allowed before shift start"</b>.'],
        rule: ['<b>Chặn chấm công vào</b> nếu nhân viên vào sớm hơn 30 phút so với giờ bắt đầu ca — app báo <i>"Chưa đến thời gian được checkin cho phép."</i> Tắt / = 0: không giới hạn vào sớm.', '<b>Blocks clock-in</b> when the employee is more than 30 minutes before shift start — the app shows <i>"Chưa đến thời gian được checkin cho phép."</i> (not yet the allowed check-in time). Off / 0: no early limit.'] },
      { on: 'web', h: 'r-close', look: true, t: ['Dòng <b>Thời gian chốt công hàng tháng</b> xác định kỳ công tháng.', 'The <b>Monthly attendance closing period</b> row defines the monthly period.'],
        rule: ['Kỳ công đang áp dụng: <b>ngày 26 tháng trước → ngày 25 tháng này</b>. Dùng ở màn "Chấm công" (công tháng) trên app và các báo cáo theo kỳ.', 'The period in effect: <b>the 26th of last month → the 25th of this month</b>. Used by the app "Timekeeping" (monthly) screen and period reports.'] },
      { on: 'web', h: 'c-img', set: { cimg: 1 }, t: ['Tick <b>"Bắt buộc chấm công với ảnh"</b> nếu muốn nhân viên chụp selfie khi vào/ra ca.', 'Tick <b>"Require a photo…"</b> if employees must take a selfie when clocking in/out.'],
        rule: ['Bật → app mở màn Giờ vào / Giờ ra có bản đồ và khung chụp ảnh. Tắt → chấm công ngay trên Home, không ảnh.', 'On → the app opens the Clock in / Clock out screen with a map and a photo frame. Off → clocking happens right on Home, without a photo.'] },
      { on: 'web', h: 'c-admin', set: { cadmin: 1 }, t: ['Tick <b>"Cho phép Admin xác nhận ca làm việc"</b> nếu muốn Admin được xác nhận giờ thay quản lý.', 'Tick <b>"Allow Admin to confirm working time"</b> if Admins should confirm hours on behalf of managers.'],
        rule: ['Bật → tài khoản Admin được dùng "Confirm working time" trên Web. Tắt → chỉ <b>quản lý trực tiếp</b> của nhân viên xác nhận được.', 'On → Admin accounts can use "Confirm working time" on the Web. Off → only the employee\'s <b>direct manager</b> can confirm.'] },
      { on: 'web', h: 'save', set: { saved: 1 }, t: ['Bấm <b>Lưu thông tin</b>.', 'Click <b>Save</b>.'], rule: ['Chỉ nhận <b>số nguyên ≥ 0</b>.', 'Only <b>integers ≥ 0</b> are accepted.'] },
      { on: 'web', h: 'ok', set: { saved: 0 }, t: ['Đóng thông báo. Cấu hình có hiệu lực cho các lần chấm công tiếp theo.', 'Close the message. The settings apply to subsequent clock-ins.'] }
    ],
    done: ['Ví dụ với ca 08:00–17:00 và cấu hình vừa nhập: 07:20 bấm vào → bị chặn (sớm hơn 07:30) · 07:45 → hợp lệ · 08:10 → hợp lệ, vẫn tô "đúng giờ" (trong ngưỡng 15 phút) · 08:20 → bị chặn "Quá thời gian checkin." nếu chưa có đơn xin trễ được duyệt.', 'Example with an 08:00–17:00 shift and the values entered: clock-in at 07:20 → blocked (earlier than 07:30) · 07:45 → valid · 08:10 → valid and still "on time" (within 15 minutes) · 08:20 → blocked with "Quá thời gian checkin." unless a late request was approved.'],
    rules: [
      ['Dòng tắt = giá trị 0.', 'A row that is off = value 0.'],
      ['"Đi trễ" vừa là ân hạn tô màu, vừa là giới hạn chặn check-in (trừ khi đã duyệt xin trễ).', '"Late" is both the colouring grace period and the check-in block limit (unless a late request is approved).'],
      ['"Về sớm" không bao giờ chặn check-out.', '"Early leave" never blocks clock-out.'],
      ['Hai ngưỡng "nghỉ không lương" chỉ ảnh hưởng báo cáo / tô màu, không đổi dữ liệu ca.', 'The two "unpaid leave" thresholds only affect reports / colours, not the shift data.'],
      ['Kỳ công tháng: 26 tháng trước → 25 tháng này.', 'Monthly period: the 26th of last month → the 25th of this month.']
    ]
  });

  /* =====================================================================
     2. ĐIỂM CHẤM CÔNG WIFI / GPS
     ===================================================================== */
  const ptRows = (s) => {
    const r = [];
    if (s.rows >= 1) r.push({ cls: s.rows === 1 ? 'new' : '', c: ['1', 'Wifi', '', 'Matthews_Q1', '42.114.204.250', '', K.br1(), K.sw('', 1), '', '<span class="icon-btn">✎</span><span class="icon-btn">🗑</span>'] });
    if (s.rows >= 2) r.push({ cls: 'new', c: ['2', 'GPS', '10.776889,106.700806', '', '', '100 m', K.br1(), K.sw('', 1), '', '<span class="icon-btn">✎</span><span class="icon-btn">🗑</span>'] });
    if (!r.length) r.push(['', '<span style="color:#999">' + t('Chưa có cấu hình', 'No configuration yet') + '</span>', '', '', '', '', '', '', '', '']);
    return r;
  };
  const ptModal = (s) => K.modal({ title: t('Thêm cấu hình chấm công', 'Add attendance point'), body:
      K.row(t('Chi nhánh làm việc', 'Working branch'), K.sel('br', s.br, { ph: t('Chọn chi nhánh', 'Select branch') }), 1) +
      K.row(t('Hình thức', 'Method'), K.rd('r-wifi', s.type === 'wifi', t('Chấm công bằng WIFI', 'Attendance by WIFI')) + K.rd('r-gps', s.type === 'gps', t('Chấm công bằng GPS', 'Attendance by GPS'))) +
      (s.type === 'wifi' ? K.row(t('Tên wifi', 'Wifi name'), K.inp('wname', s.wname), 1) + K.row(t('Địa chỉ IP', 'IP address'), K.inp('ip', s.ip, { ph: 'Vd: 42.114.204.250' }), 1) + K.row('', '<a href="#">' + t('Lấy địa chỉ IP từ wifi hiện tại', 'Get the IP address of the current wifi') + '</a>')
        : K.row(t('Vĩ độ', 'Latitude'), K.inp('lat', s.lat), 1) + K.row(t('Kinh độ', 'Longitude'), K.inp('lng', s.lng), 1) + K.row(t('Bán kính cho phép (m)', 'Allowed radius (m)'), K.inp('rad', s.rad))) +
      K.row(t('Ghi chú', 'Note'), K.inp('', '')),
    foot: K.btn(t('HỦY', 'CANCEL'), '', 'btn-default') + K.btn(t('LƯU THÔNG TIN', 'SAVE'), 'save', 'btn-primary') });
  HDSD.add({
    id: 'cfg-point', tier: 1, ch: ['web'], icon: '📍',
    title: ['Điểm chấm công Wifi / GPS theo chi nhánh', 'Wifi / GPS attendance points per branch'],
    sum: ['Khai báo nơi nhân viên được phép chấm công: theo địa chỉ IP của wifi văn phòng hoặc theo toạ độ GPS và bán kính.', 'Declare where employees may clock in: by the office wifi IP address, or by GPS coordinates and a radius.'],
    who: ['Admin / HR', 'Admin / HR'],
    init: Object.assign({ tab: 'g', m: 0, type: 'wifi', br: '', wname: '', ip: '', lat: '', lng: '', rad: '', rows: 0 }, CFG0, { clate: 1, vlate: '15', cbefore: 1, vbefore: '30' }),
    web: (s) => K.web({ nav: 'cfg', over: s.m ? ptModal(s) : '', body: s.tab === 'g' ? K.portlet(t('Cấu hình chấm công', 'Timekeeping settings'), K.btn(t('Lưu thông tin', 'Save'), ''), cfgGeneral(s))
      : K.portlet(t('Cấu hình chấm công', 'Timekeeping settings'), K.btn('+ ' + t('Thêm cấu hình chấm công', 'Add attendance point'), 'add'), cfgTabs('w') + K.filter([t('Chọn chi nhánh', 'Select branch'), K.btn(t('TÌM KIẾM', 'SEARCH'), '', 'btn-primary')]) +
        K.table(['#', t('Loại chấm công', 'Type'), t('Tọa độ', 'Coordinates'), t('Tên wifi', 'Wifi name'), t('Địa chỉ IP', 'IP address'), t('Bán kính', 'Radius'), t('Chi nhánh', 'Branch'), t('Trạng thái', 'Status'), t('Ghi chú', 'Note'), t('Hành động', 'Actions')], ptRows(s), 'tbl')) }),
    steps: [
      { on: 'web', h: 'tab-wifi', set: { tab: 'w' }, t: ['Trong <b>Cấu hình chấm công</b>, mở tab <b>"Danh sách cấu hình chấm công"</b>.', 'In <b>Timekeeping settings</b>, open the <b>"Attendance points"</b> tab.'] },
      { on: 'web', h: 'add', set: { m: 1 }, t: ['Bấm <b>+ Thêm cấu hình chấm công</b>.', 'Click <b>+ Add attendance point</b>.'], rule: ['Mỗi chi nhánh có thể có <b>nhiều</b> điểm chấm công; mỗi điểm là Wifi <b>hoặc</b> GPS.', 'A branch may have <b>several</b> attendance points; each one is either Wifi <b>or</b> GPS.'] },
      { on: 'web', h: 'br', set: (s) => { s.br = K.br1(); }, t: ['Chọn <b>Chi nhánh làm việc</b> (bắt buộc).', 'Select the <b>Working branch</b> (required).'], rule: ['Khi chấm công, hệ thống lấy các điểm <b>đang hoạt động</b> của <b>chi nhánh làm việc của ca</b> (có thể khác chi nhánh nhân viên trực thuộc).', 'When clocking, the system uses the <b>active</b> points of the <b>shift\'s working branch</b> (which may differ from the employee\'s home branch).'] },
      { on: 'web', h: 'wname', type: 'Matthews_Q1', k: 'wname', t: ['Hình thức mặc định là <b>WIFI</b>. Nhập <b>Tên wifi</b>.', 'The default method is <b>WIFI</b>. Enter the <b>Wifi name</b>.'], rule: ['Tên wifi <b>chỉ để hiển thị</b> trong thông báo lỗi, không dùng để so khớp. Không được trùng với điểm wifi khác (trên mọi chi nhánh).', 'The wifi name is <b>display only</b> (used in error messages), not for matching. It must not duplicate another wifi point (across all branches).'] },
      { on: 'web', h: 'ip', type: '42.114.204.250', k: 'ip', t: ['Nhập <b>Địa chỉ IP</b> public của mạng văn phòng.', 'Enter the office network\'s public <b>IP address</b>.'], rule: ['Điểm wifi khớp khi <b>địa chỉ IP</b> mạng mà điện thoại đang dùng trùng với IP này. Link "Lấy địa chỉ IP từ wifi hiện tại" mở trang whatismyipaddress.com — người cấu hình phải đang ở trong mạng văn phòng. Hệ thống không kiểm tra định dạng IP.', 'A wifi point matches when the <b>IP address</b> of the phone\'s network equals this IP. The "Get the IP address…" link opens whatismyipaddress.com — you must be on the office network. The IP format is not validated.'] },
      { on: 'web', h: 'save', set: { m: 0, rows: 1, br: '', wname: '', ip: '' }, t: ['Bấm <b>LƯU THÔNG TIN</b>. Điểm wifi xuất hiện trong danh sách.', 'Click <b>SAVE</b>. The wifi point appears in the list.'] },
      { on: 'web', h: 'add', set: { m: 1, type: 'wifi' }, t: ['Thêm tiếp một điểm <b>GPS</b> cho cùng chi nhánh: bấm <b>+ Thêm cấu hình chấm công</b>.', 'Add a <b>GPS</b> point for the same branch: click <b>+ Add attendance point</b> again.'] },
      { on: 'web', h: 'br', set: (s) => { s.br = K.br1(); }, t: ['Chọn lại chi nhánh.', 'Select the branch again.'] },
      { on: 'web', h: 'r-gps', set: { type: 'gps' }, t: ['Chọn <b>Chấm công bằng GPS</b>.', 'Choose <b>Attendance by GPS</b>.'] },
      { on: 'web', h: 'lat', type: '10.776889', k: 'lat', t: ['Nhập <b>Vĩ độ</b>.', 'Enter the <b>Latitude</b>.'] },
      { on: 'web', h: 'lng', type: '106.700806', k: 'lng', t: ['Nhập <b>Kinh độ</b>.', 'Enter the <b>Longitude</b>.'] },
      { on: 'web', h: 'rad', type: '100', k: 'rad', t: ['Nhập <b>Bán kính cho phép</b> (mét).', 'Enter the <b>Allowed radius</b> (metres).'], rule: ['Mặc định <b>100 m</b>. Điểm GPS khớp khi khoảng cách từ điện thoại tới toạ độ <b>≤ bán kính</b>.', 'Default <b>100 m</b>. A GPS point matches when the distance from the phone to the coordinates is <b>≤ the radius</b>.'] },
      { on: 'web', h: 'save', set: { m: 0, rows: 2 }, t: ['Bấm <b>LƯU THÔNG TIN</b>.', 'Click <b>SAVE</b>.'] },
      { on: 'web', h: 'tbl', look: true, t: ['Chi nhánh Quận 1 giờ có 2 điểm: 1 Wifi và 1 GPS. Dùng công tắc <b>Trạng thái</b> để tạm tắt một điểm.', 'District 1 branch now has 2 points: one Wifi and one GPS. Use the <b>Status</b> switch to disable a point temporarily.'],
        rule: ['Khi chấm công (cả vào và ra): ① ưu tiên <b>wifi</b> — IP khớp bất kỳ điểm wifi nào → hợp lệ; ② không khớp → thử <b>GPS</b> — trong bán kính của bất kỳ điểm nào → hợp lệ; ③ không khớp gì → báo lỗi. Chi nhánh không có điểm nào → <i>"Chi nhánh chưa cấu hình chấm công."</i> Nhân viên <b>linh động</b> được bỏ qua toàn bộ kiểm tra này.', 'When clocking (in and out): ① <b>wifi</b> first — the IP matches any wifi point → valid; ② otherwise try <b>GPS</b> — within the radius of any point → valid; ③ nothing matches → error. A branch with no point → <i>"Chi nhánh chưa cấu hình chấm công."</i> <b>Flexible</b> employees skip this whole check.'] }
    ],
    done: ['Thông báo khi vị trí không hợp lệ: có cả wifi và GPS → "Vui lòng kết nối với wifi [tên wifi] hoặc đến gần văn phòng để check-in/checkout"; chỉ GPS → "Vui lòng đến gần văn phòng để check-in/checkout"; chỉ wifi → "Vui lòng kết nối với wifi [tên wifi] để check-in/checkout".', 'Messages when the location is invalid: wifi and GPS both configured → "Vui lòng kết nối với wifi [name] hoặc đến gần văn phòng để check-in/checkout"; GPS only → "Vui lòng đến gần văn phòng để check-in/checkout"; wifi only → "Vui lòng kết nối với wifi [name] để check-in/checkout".'],
    rules: [
      ['Wifi so khớp theo địa chỉ IP, không theo tên wifi.', 'Wifi is matched by IP address, not by wifi name.'],
      ['GPS khớp khi khoảng cách ≤ bán kính (mặc định 100 m).', 'GPS matches when distance ≤ radius (default 100 m).'],
      ['Thứ tự kiểm tra: wifi trước, GPS sau; khớp một điểm bất kỳ là đủ.', 'Check order: wifi first, then GPS; matching any single point is enough.'],
      ['Ca làm tại khách hàng vẫn kiểm tra theo điểm chấm công của chi nhánh.', 'Shifts worked at a customer site are still checked against the branch\'s points.'],
      ['Bắt buộc: chi nhánh; với wifi là tên + IP.', 'Required: branch; for wifi, name + IP.']
    ]
  });

  /* =====================================================================
     3. TẠO CA LÀM VIỆC
     ===================================================================== */
  const DN = () => [t('Thứ 2', 'Mon'), t('Thứ 3', 'Tue'), t('Thứ 4', 'Wed'), t('Thứ 5', 'Thu'), t('Thứ 6', 'Fri'), t('Thứ 7', 'Sat'), t('Chủ nhật', 'Sun')];
  const shModal = (s) => K.modal({ title: t('Thêm ca làm việc', 'Add shift'), body:
      K.row(t('Tên ca làm', 'Shift name'), K.inp('name', s.name), 1) +
      '<div data-h="r-time">' + K.row(t('Thời gian làm việc bắt đầu', 'Work start time'), K.inp('', '08:00'), 1) + K.row(t('Thời gian làm việc kết thúc', 'Work end time'), K.inp('', '17:00'), 1) + '</div>' +
      K.row(t('Thời gian nghỉ trưa bắt đầu', 'Lunch break start'), K.inp('ls', s.ls)) + K.row(t('Thời gian nghỉ trưa kết thúc', 'Lunch break end'), K.inp('le', s.le)) +
      K.row(t('Số giờ làm tối thiểu tính đủ công', 'Minimum hours for a full workday'), K.inp('min', s.min), 1) + K.row(t('Hệ số công', 'Work coefficient'), K.inp('coef', '1'), 1) +
      K.row(t('Chi nhánh làm việc', 'Working branches'), K.ck('b1', s.b1, K.br1()) + K.ck('', 0, K.br2()), 1) +
      K.row(t('Thời gian hoạt động của ca', 'Active days'), '<span data-h="days">' + DN().map((d, i) => K.ck('d' + i, i < 5 || (i === 5 && s.sat), d)).join('') + '</span>', 1) +
      K.row(t('Số lần chấm công', 'Number of check-in rounds'), K.inp('chk', '1', { w: 90 }), 1) + K.row(t('Ghi chú', 'Note'), K.inp('', '')),
    foot: K.btn(t('HỦY', 'CANCEL'), '', 'btn-default') + K.btn(t('LƯU THÔNG TIN', 'SAVE'), 'save', 'btn-primary') });
  HDSD.add({
    id: 'shift', tier: 1, ch: ['web'], icon: '🕘',
    title: ['Tạo & quản lý mẫu ca làm việc', 'Create & manage shift templates'],
    sum: ['Định nghĩa khuôn mẫu khung giờ làm (giờ vào/ra, nghỉ trưa, hệ số công, số lần chấm công, chi nhánh, thứ áp dụng). Tạo một lần, dùng để xếp lịch nhiều lần.', 'Define a working-hours template (start/end, lunch break, coefficient, check-in rounds, branches, weekdays). Create once, reuse for scheduling.'],
    who: ['Admin / HR', 'Admin / HR'],
    init: { m: 0, name: '', ls: '', le: '', min: '', b1: 0, sat: 0, rows: 0 },
    web: (s) => K.web({ nav: 'shift', over: s.m ? shModal(s) : '', body: K.portlet(t('Danh sách ca làm việc', 'Shift list'), K.btn('+ ' + t('Thêm ca làm việc', 'Add shift'), 'add'),
      K.filter([t('Nhập tên ca', 'Shift name'), t('Chọn trạng thái', 'Status'), K.btn(t('TÌM KIẾM', 'SEARCH'), '', 'btn-primary')]) +
      K.table(['#', t('Tên ca', 'Shift'), t('Thời gian', 'Time'), t('Giờ làm', 'Hours'), t('Giờ nghỉ trưa', 'Lunch'), t('Giờ làm tối thiểu', 'Min hours'), t('Hệ số', 'Coef.'), t('Số lần chấm', 'Rounds'), t('Trạng thái', 'Status'), t('Hành động', 'Actions')],
        (s.rows ? [{ cls: 'new', c: ['1', '<b>' + K.sang() + '</b>', '08:00 - 17:00', '8 ' + t('giờ', 'h'), '1 ' + t('giờ', 'h'), '8 ' + t('giờ', 'h'), '1', '1', K.sw('sw-new', 1), '<span data-h="act-new"><span class="icon-btn">✎</span><span class="icon-btn">🗑</span></span>'] }] : []).concat([
          [s.rows ? '2' : '1', '<b>' + K.chieu() + '</b>', '13:00 - 22:00', '9 ' + t('giờ', 'h'), '', '9 ' + t('giờ', 'h'), '1', '1', K.sw('', 1), '<span class="icon-btn">✎</span><span class="icon-btn">🗑</span>'],
          [s.rows ? '3' : '2', '<b>OT</b> <span class="tag app">' + t('hệ thống', 'system') + '</span>', '—', '', '', '', '1', '1', K.sw('', 1), '']
        ]))) }),
    steps: [
      { on: 'web', h: 'add', set: { m: 1 }, t: ['Mở <b>Chấm công → Ca làm việc</b>, bấm <b>+ Thêm ca làm việc</b>.', 'Open <b>Timekeeping → Shifts</b> and click <b>+ Add shift</b>.'] },
      { on: 'web', h: 'name', type: ['Ca sáng', 'Morning shift'], k: 'name', t: ['Nhập <b>Tên ca làm</b>.', 'Enter the <b>Shift name</b>.'], rule: ['Bắt buộc, tối đa <b>50 ký tự</b>, không trùng với ca chưa xoá.', 'Required, at most <b>50 characters</b>, must not duplicate a shift that is not deleted.'] },
      { on: 'web', h: 'r-time', look: true, t: ['Giờ bắt đầu / kết thúc mặc định là <b>08:00 / 17:00</b> — giữ nguyên.', 'Start / end default to <b>08:00 / 17:00</b> — keep them.'], rule: ['Giờ kết thúc <b>≤</b> giờ bắt đầu = <b>ca qua đêm</b> (ví dụ 22:00–06:00), ngày kết thúc là ngày hôm sau.', 'End time <b>≤</b> start time = an <b>overnight shift</b> (e.g. 22:00–06:00); the end date is the next day.'] },
      { on: 'web', h: 'ls', type: '12:00', k: 'ls', t: ['Nhập giờ <b>nghỉ trưa bắt đầu</b>.', 'Enter the <b>lunch break start</b>.'] },
      { on: 'web', h: 'le', type: '13:00', k: 'le', set: { min: '8' }, t: ['Nhập giờ <b>nghỉ trưa kết thúc</b>.', 'Enter the <b>lunch break end</b>.'], rule: ['Nghỉ trưa không bắt buộc, nhưng nếu nhập thì phải nhập <b>đủ cả hai</b> và nằm trong khung giờ làm. Thời gian nghỉ <b>không tính công</b>.', 'Lunch is optional, but if used <b>both</b> times are required and must fall inside working hours. Break time is <b>not counted</b> as work.'] },
      { on: 'web', h: 'min', look: true, t: ['<b>Số giờ làm tối thiểu tính đủ công</b> được tự điền = tổng giờ − nghỉ trưa = <b>8</b>.', '<b>Minimum hours for a full workday</b> is auto-filled = total hours − lunch = <b>8</b>.'], rule: ['Giờ làm của ca = (kết thúc − bắt đầu) − nghỉ trưa. Số giờ tối thiểu <b>không được lớn hơn</b> số giờ làm của ca; nó được dùng làm "giờ dự kiến / ước tính".', 'Shift hours = (end − start) − lunch. The minimum <b>may not exceed</b> the shift hours; it is used as the "planned / estimated hours".'] },
      { on: 'web', h: 'coef', look: true, t: ['<b>Hệ số công</b> mặc định <b>1</b>: ca này được tính bao nhiêu công.', '<b>Work coefficient</b> defaults to <b>1</b>: how many workdays this shift counts for.'], rule: ['Phải <b>lớn hơn 0 và ≤ 999</b>. Ví dụ ca nửa ngày = 0,5; ca lễ có thể = 2.', 'Must be <b>greater than 0 and ≤ 999</b>. E.g. half-day shift = 0.5; a holiday shift may be 2.'] },
      { on: 'web', h: 'b1', set: { b1: 1 }, t: ['Tick <b>chi nhánh</b> được dùng ca này.', 'Tick the <b>branch(es)</b> that may use this shift.'], rule: ['Bắt buộc chọn 1 hoặc nhiều chi nhánh.', 'At least one branch is required.'] },
      { on: 'web', h: 'd5', set: { sat: 1 }, t: ['<b>Thời gian hoạt động của ca</b> mặc định Thứ 2–Thứ 6. Tick thêm <b>Thứ 7</b>.', '<b>Active days</b> default to Mon–Fri. Also tick <b>Sat</b>.'], rule: ['Ít nhất 1 ngày. Khi xếp lịch, ca chỉ xuất hiện ở những <b>thứ</b> được tick.', 'At least one day. When scheduling, the shift is only offered on the ticked <b>weekdays</b>.'] },
      { on: 'web', h: 'chk', look: true, t: ['<b>Số lần chấm công</b> = số lượt vào–ra trong ca. Mặc định <b>1</b>.', '<b>Number of check-in rounds</b> = in/out pairs per shift. Default <b>1</b>.'], rule: ['Tối đa <b>5</b> (ca gãy sáng/chiều = 2 lượt). <b>0 = không cần chấm công</b> — ca được coi như đã xác nhận.', 'Up to <b>5</b> (a split shift = 2 rounds). <b>0 = no clocking needed</b> — the shift is treated as already confirmed.'] },
      { on: 'web', h: 'save', set: { m: 0, rows: 1 }, t: ['Bấm <b>LƯU THÔNG TIN</b>. Ca mới nằm đầu danh sách.', 'Click <b>SAVE</b>. The new shift is at the top of the list.'] },
      { on: 'web', h: 'sw-new', look: true, t: ['Công tắc <b>Trạng thái</b>: tắt để tạm ngừng ca.', 'The <b>Status</b> switch: turn off to suspend the shift.'], rule: ['Ca bị tắt <b>không còn trong danh sách chọn</b> khi xếp lịch (các ca đã xếp trước đó không đổi).', 'A suspended shift is <b>no longer selectable</b> when scheduling (already scheduled shifts are unchanged).'] },
      { on: 'web', h: 'act-new', look: true, t: ['Dùng ✎ để <b>sửa</b>, 🗑 để <b>xoá</b> mẫu ca.', 'Use ✎ to <b>edit</b> and 🗑 to <b>delete</b> a template.'], rule: ['Xoá <b>bị chặn</b> nếu ca đang được dùng cho ngày từ hôm nay trở đi ở trạng thái Chờ duyệt / Đã duyệt / Chờ xác nhận → <i>"Ca làm việc đã được sử dụng, bạn không thể xoá"</i>. Ca chỉ dùng trong quá khứ vẫn xoá được.', 'Deleting is <b>blocked</b> when the shift is used from today onward in status Pending approval / Approved / Pending confirmation → <i>"Ca làm việc đã được sử dụng, bạn không thể xoá"</i>. Shifts used only in the past can be deleted.'],
        warn: ['Sửa mẫu ca <b>không cập nhật</b> các ca đã xếp trước đó cho nhân viên.', 'Editing a template <b>does not update</b> shifts already scheduled for employees.'] }
    ],
    done: ['Mẫu "Ca sáng 08:00–17:00, nghỉ trưa 12:00–13:00, 8 giờ, hệ số 1, 1 lần chấm công" đã sẵn sàng để xếp lịch. Hệ thống còn có mẫu ca đặc biệt mã OT dùng cho mọi ca tăng ca.', 'The template "Morning shift 08:00–17:00, lunch 12:00–13:00, 8 hours, coefficient 1, 1 round" is ready for scheduling. The system also has a special OT template used for all overtime shifts.'],
    rules: [
      ['Giờ làm của ca = (giờ kết thúc − giờ bắt đầu) − nghỉ trưa.', 'Shift hours = (end − start) − lunch.'],
      ['Giờ kết thúc ≤ giờ bắt đầu = ca qua đêm.', 'End ≤ start = overnight shift.'],
      ['Số lần chấm công: 1–5; 0 = không cần chấm công.', 'Rounds: 1–5; 0 = no clocking needed.'],
      ['Ca chỉ xếp được vào các thứ và chi nhánh đã tick.', 'A shift can only be scheduled on its ticked weekdays and branches.'],
      ['Mẫu ca OT cũng có cấu hình thứ: app chỉ cho đăng ký tăng ca vào các thứ được bật.', 'The OT template also has weekdays: the app only allows overtime on enabled weekdays.']
    ]
  });

  /* =====================================================================
     4. XẾP LỊCH: THÊM CA CHO NHÂN VIÊN (WEB)
     ===================================================================== */
  const addModal = (s) => K.modal({ size: 'lg', title: t('Danh sách ca', 'Shift list'), body:
      '<p style="margin-top:0">' + t('Nhân viên', 'Employee') + ': <b>' + P.an + '</b> · ' + t('Ngày', 'Date') + ': <b>' + day(3) + '</b></p>' +
      K.table(['#', t('Chọn', 'Pick'), t('Tên ca', 'Shift'), t('Chi nhánh', 'Branch'), t('Tăng ca', 'Overtime'), t('Tính tăng ca theo', 'OT counted by'), t('Hệ số công', 'Coef.')], [
        ['1', K.ck('pick', s.ck), '<b>' + K.sang() + '</b><br><small>08:00 - 17:00</small>', K.sel('pbr', s.br, { ph: t('Chọn chi nhánh', 'Select branch'), dis: !s.ck, w: 170 }), '<span data-h="pot">' + K.ck('', 0) + '</span>', K.sel('', t('Ca', 'Shift'), { dis: 1, w: 90 }), K.inp('pcoef', '1', { w: 60 })],
        ['2', K.ck('', 0), '<b>' + K.chieu() + '</b><br><small>13:00 - 22:00</small>', K.sel('', '', { ph: t('Chọn chi nhánh', 'Select branch'), dis: 1, w: 170 }), K.ck('', 0), K.sel('', t('Ca', 'Shift'), { dis: 1, w: 90 }), K.inp('', '1', { w: 60 })]
      ]),
    foot: K.btn(t('HỦY', 'CANCEL'), '', 'btn-default') + K.btn(t('CHỌN', 'SELECT'), 'choose', 'btn-primary') });
  HDSD.add({
    id: 'tws-add', tier: 1, ch: ['web', 'app'], icon: '🗓️',
    title: ['Xếp lịch: thêm ca cho nhân viên', 'Scheduling: add a shift for an employee'],
    sum: ['Gán một mẫu ca cho một nhân viên vào một ngày trên màn Lịch làm việc. Ca do Admin/Quản lý thêm trên Web được duyệt ngay và hiện trên app của nhân viên.', 'Assign a shift template to an employee on a given day from the Work schedule screen. Shifts added on the Web by Admin/Manager are approved immediately and appear in the employee\'s app.'],
    who: ['Admin / HR / Quản lý', 'Admin / HR / Manager'],
    pre: ['Đã có mẫu ca đang hoạt động, áp dụng cho thứ cần xếp.', 'An active shift template exists for the weekday being scheduled.'],
    init: { m: 0, ck: 0, br: '', added: 0, _web: W.admin, _app: W.an },
    web: (s) => K.twsPage({ over: s.m ? addModal(s) : '', grid: K.grid({ h: 'grid', rows: [
      { name: P.an, cells: [cell.done(), cell.done({ tm: '07:58 📱 - 17:00 📱' }), cell.today(), s.added ? cell.fut({ isNew: 1, ch: 'newcell' }) : cell.add('add-an'), cell.fut(), cell.add(), cell.add()] },
      { name: P.binh, cells: [cell.done(), cell.done(), cell.today(), cell.fut(), cell.fut(), cell.add(), cell.add()] }
    ] }) }),
    app: (s) => llv(card(2, 'approved') + (s.added ? card(3, 'approved', { h: 'newcard', isNew: 1 }) : '') + card(4, 'approved'), { approved: s.added ? 3 : 2, confirmed: 2, est: s.added ? 40 : 32, act: 16.07, conf: 16 }),
    steps: [
      { on: 'web', h: 'grid', look: true, t: ['Mở <b>Chấm công → Lịch làm việc theo nhân viên</b>. Mỗi hàng là một nhân viên, mỗi ô là một ngày; ô trống có nút <b>+</b>.', 'Open <b>Timekeeping → Work schedule by employee</b>. Each row is an employee, each cell a day; empty cells have a <b>+</b> button.'] },
      { on: 'web', h: 'add-an', set: { m: 1 }, t: ['Bấm <b>+</b> ở ô <b>Thứ 5 15/10</b> của Lê Văn An.', 'Click <b>+</b> in Lê Văn An\'s <b>Thu 15/10</b> cell.'], rule: ['Popup chỉ liệt kê ca <b>đang hoạt động và áp dụng cho thứ đó</b>. Không chặn ngày quá khứ. Nếu là ngày lễ, hệ thống hỏi xác nhận trước.', 'The popup lists only shifts that are <b>active and valid for that weekday</b>. Past days are not blocked. On a holiday the system asks for confirmation first.'] },
      { on: 'web', h: 'pick', set: { ck: 1 }, t: ['Tick chọn <b>Ca sáng</b>.', 'Tick <b>Morning shift</b>.'], rule: ['Có thể chọn <b>nhiều ca một lúc</b>, nhưng các ca không được trùng giờ nhau và không trùng với ca đã có của nhân viên → <i>"Thời gian làm việc đã trùng với lịch khác"</i>.', 'You may pick <b>several shifts at once</b>, but they must not overlap each other or the employee\'s existing shifts → <i>"Thời gian làm việc đã trùng với lịch khác"</i>.'] },
      { on: 'web', h: 'pbr', set: (s) => { s.br = K.br1(); }, t: ['Chọn <b>Chi nhánh</b> làm việc của ca.', 'Select the shift\'s working <b>Branch</b>.'], rule: ['Chi nhánh này quyết định điểm wifi/GPS dùng để kiểm tra khi chấm công.', 'This branch decides which wifi/GPS points are used when clocking.'] },
      { on: 'web', h: 'pot', look: true, t: ['Nếu là ca tăng ca, tick <b>Tăng ca</b> và chọn tính theo <b>Ca</b> hoặc <b>Giờ</b>. Ở đây để trống.', 'For an overtime shift tick <b>Overtime</b> and choose counting by <b>Shift</b> or <b>Hour</b>. Leave it empty here.'], rule: ['<b>Hệ số công</b> của từng ca phải lớn hơn 0.', 'Each shift\'s <b>coefficient</b> must be greater than 0.'] },
      { on: 'web', h: 'choose', set: { m: 0, added: 1 }, t: ['Bấm <b>CHỌN</b>.', 'Click <b>SELECT</b>.'], rule: ['Ca tạo từ Web ở trạng thái <b>Đã duyệt</b> ngay (ca có số lần chấm công = 0 thì <b>Đã xác nhận</b> luôn).', 'Shifts created on the Web are <b>Approved</b> right away (shifts with 0 check-in rounds become <b>Confirmed</b>).'] },
      { on: 'web', h: 'newcell', look: true, t: ['Ô Thứ 5 đã có ca: màu xám <b>"Chưa đến ca"</b>, trạng thái <b>Đã duyệt</b>. Bấm <b>⋮</b> trên ô để mở menu thao tác.', 'Thursday now has a shift: grey <b>"Not yet due"</b>, status <b>Approved</b>. Click <b>⋮</b> on the cell for its action menu.'] },
      { on: 'app', h: 'newcard', look: true, t: ['Trên <b>app của An</b>, ca mới xuất hiện trong <b>Lịch làm việc</b> với trạng thái Đã duyệt. Đến ngày 15/10, thẻ chấm công ở Home sẽ hiện ca này.', 'In <b>An\'s app</b> the new shift appears under <b>Work schedule</b> as Approved. On 15/10 the check-in card on Home will show it.'] }
    ],
    done: ['Ca "Ca sáng – Thứ 5 15/10" của Lê Văn An đã được tạo ở trạng thái Đã duyệt và hiển thị trên cả Web lẫn App.', 'Lê Văn An\'s "Morning shift – Thu 15/10" was created as Approved and is visible on both Web and App.'],
    rules: [
      ['Ca thêm trên Web → Đã duyệt ngay; ca nhân viên tự đăng ký trên App → Chờ duyệt.', 'Shift added on the Web → Approved immediately; shift self-registered in the App → Pending approval.'],
      ['Chỉ hiện ca đang hoạt động và áp dụng cho thứ đó.', 'Only shifts that are active and valid for that weekday are listed.'],
      ['Không trùng giờ: "Thời gian làm việc đã trùng với lịch khác".', 'No overlap: "Thời gian làm việc đã trùng với lịch khác".'],
      ['Ngày lễ: hỏi "Ca làm việc rơi vào ngày lễ bạn có muốn thêm ca làm việc cho nhân viên?".', 'Holiday: asks "Ca làm việc rơi vào ngày lễ bạn có muốn thêm ca làm việc cho nhân viên?".'],
      ['Chỉ ca Đã duyệt mới chấm công được.', 'Only Approved shifts can be clocked.']
    ]
  });

  /* =====================================================================
     5. NHÂN VIÊN TỰ ĐĂNG KÝ CA (APP)
     ===================================================================== */
  HDSD.add({
    id: 'app-add', tier: 1, ch: ['app'], icon: '➕',
    title: ['Nhân viên tự đăng ký ca trên app', 'Employee self-registers a shift in the app'],
    sum: ['Nhân viên thêm một ca cho một ngày trong tuần đang xem. Ca ở trạng thái Chờ duyệt và quản lý trực tiếp nhận thông báo.', 'The employee adds a shift for a day of the week in view. The shift is Pending approval and the direct manager is notified.'],
    who: ['Nhân viên → Quản lý trực tiếp', 'Employee → Direct manager'],
    init: { a: 'home', sheet: 0, sh: '', saved: 0, _app: W.an },
    app: (s) => {
      if (s.a === 'home') return anHome({});
      if (s.a === 'mhome') return mgrHome([K.noti(t('Lịch làm việc', 'Work schedule'), K.m('Đang có lịch làm việc ngày 15/10/2026 của Lê Văn An đang chờ phê duyệt.', 'The work schedule of Lê Văn An on 15/10/2026 is awaiting approval.'), 'noti', 1)]);
      if (s.a === 'add') return K.app({ title: t('Thêm ca', 'Add shift'), body: K.acard(t('Ngày làm việc', 'Working day') + ': <b>' + day(3) + '</b>') + K.field(t('Ca', 'Shift') + ' *', K.asel('f-sh', s.sh, t('Chọn ca làm việc của bạn', 'Select your shift'))) + K.field(t('Chi nhánh', 'Branch') + ' *', K.asel('f-br', K.br1())) +
        '<div data-h="f-over">' + K.field(t('Ghi đè thời gian (Tùy chọn)', 'Override time (optional)'), '<div style="display:flex;gap:6px">' + K.ainp('', '', '--:--') + K.ainp('', '', '--:--') + '</div>') + '</div>', bottom: K.abtn(t('Lưu', 'Save'), 'save') });
      return llv(card(2, 'approved') + (s.saved ? card(3, 'waiting', { h: 'newcard', isNew: 1 }) : '') + card(4, 'approved'), { waiting: s.saved ? 1 : 0, approved: 2, confirmed: 2, est: s.saved ? 40 : 32, act: 16.07, conf: 16 },
        { sheet: s.sheet ? { title: t('Chọn ngày (trong tuần đang xem)', 'Pick a day (in the week shown)'), body: [0, 1, 2, 3, 4, 5, 6].map((i) => '<div class="abtn sec" style="margin-bottom:6px" data-h="day-' + i + '">' + day(i) + '</div>').join('') } : null });
    },
    steps: [
      { on: 'app', h: 't-llv', set: { a: 'llv' }, t: ['Trên Home, mở <b>LLV</b> (Lịch làm việc của tôi).', 'On Home, open <b>LLV</b> (my work schedule).'], rule: ['Menu LLV hiện khi tài khoản có quyền <b>TI000001</b>.', 'The LLV menu is shown when the account has permission <b>TI000001</b>.'] },
      { on: 'app', h: 'plus', set: { sheet: 1 }, t: ['Bấm nút <b>＋</b> góc phải rồi chọn <b>Thêm ca</b>.', 'Tap <b>＋</b> at the top right, then <b>Add shift</b>.'] },
      { on: 'app', h: 'day-3', set: { sheet: 0, a: 'add' }, t: ['Chọn ngày <b>Thứ 5, 15/10/2026</b>.', 'Pick <b>Thu, 15/10/2026</b>.'], rule: ['Chỉ chọn được 1 ngày <b>trong tuần đang xem</b>.', 'Only one day <b>within the week in view</b> can be picked.'] },
      { on: 'app', h: 'f-sh', set: (s) => { s.sh = K.sang() + ' (08:00 - 17:00)'; }, t: ['Chọn <b>Ca</b>.', 'Select the <b>Shift</b>.'], rule: ['Chỉ hiện ca áp dụng cho <b>thứ đó</b>. Chưa chọn ca → <i>"Bạn chưa chọn Ca"</i>.', 'Only shifts valid for <b>that weekday</b> are shown. No shift selected → <i>"Bạn chưa chọn Ca"</i>.'] },
      { on: 'app', h: 'f-over', look: true, t: ['Có thể <b>ghi đè giờ bắt đầu/kết thúc</b> (tuỳ chọn). Ở đây để trống để dùng giờ của ca.', 'You may <b>override start/end time</b> (optional). Leave it empty to use the shift\'s hours.'], rule: ['Giờ kết thúc ≤ giờ bắt đầu → <i>"Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu"</i>.', 'End ≤ start → <i>"Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu"</i>.'] },
      { on: 'app', h: 'save', set: { a: 'llv', saved: 1 }, t: ['Bấm <b>Lưu</b>.', 'Tap <b>Save</b>.'], rule: ['Trùng giờ với ca khác → <i>"Thời gian làm việc đã trùng với lịch khác"</i>. Ca tạo ra ở trạng thái <b>Chờ duyệt</b>; nếu nhân viên thuộc danh sách "không cần duyệt lịch" thì <b>Đã duyệt</b> ngay.', 'Overlap with another shift → <i>"Thời gian làm việc đã trùng với lịch khác"</i>. The shift is created as <b>Pending approval</b>; employees on the "no approval needed" list get <b>Approved</b> immediately.'] },
      { on: 'app', h: 'newcard', look: true, set: { a: 'mhome', _app: W.mgr }, t: ['Ca mới hiện trong danh sách với nhãn <b>Chờ duyệt</b> (hồng).', 'The new shift is listed with the pink <b>Pending approval</b> label.'], warn: ['Ca Chờ duyệt <b>chưa chấm công được</b> — phải đợi quản lý duyệt.', 'A Pending approval shift <b>cannot be clocked yet</b> — it needs the manager\'s approval.'] },
      { on: 'app', h: 'noti', look: true, t: ['<b>App của quản lý trực tiếp</b> nhận thông báo có lịch đang chờ phê duyệt. Bấm thông báo để mở chi tiết lịch làm việc và duyệt.', 'The <b>direct manager\'s app</b> receives a notification that a schedule awaits approval. Tap it to open the schedule details and approve.'] }
    ],
    done: ['Ca đã được gửi và đang Chờ duyệt. Xem tiếp hướng dẫn "Duyệt lịch làm việc" để biết quản lý xử lý thế nào.', 'The shift was submitted and is Pending approval. See "Approve work schedule" for the manager\'s side.'],
    rules: [
      ['Ca nhân viên tự đăng ký → Chờ duyệt (trừ nhân viên "không cần duyệt lịch" → Đã duyệt).', 'Self-registered shift → Pending approval (except "no approval needed" employees → Approved).'],
      ['Chỉ hiện ca áp dụng cho thứ được chọn.', 'Only shifts valid for the chosen weekday are shown.'],
      ['Lỗi thường gặp: "Bạn chưa chọn Ca", "Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu", "Thời gian làm việc đã trùng với lịch khác".', 'Common errors: "Bạn chưa chọn Ca", "Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu", "Thời gian làm việc đã trùng với lịch khác".'],
      ['Quản lý nhận: "Đang có lịch làm việc ngày … của … đang chờ phê duyệt."', 'Manager receives: "Đang có lịch làm việc ngày … của … đang chờ phê duyệt."']
    ]
  });

  /* =====================================================================
     6. DUYỆT LỊCH LÀM VIỆC (APP + WEB)
     ===================================================================== */
  HDSD.add({
    id: 'approve', tier: 1, ch: ['app', 'web'], icon: '✅',
    title: ['Duyệt lịch làm việc', 'Approve work schedule'],
    sum: ['Quản lý trực tiếp duyệt ca Chờ duyệt để nhân viên chấm công được: trên App (từng ca hoặc "Duyệt tất cả") và trên Web (menu ô ca).', 'The direct manager approves Pending shifts so the employee can clock: in the App (one by one or "Approve all") and on the Web (cell menu).'],
    who: ['Quản lý trực tiếp', 'Direct manager'],
    init: { a: 'mhome', dlg: 0, one: 0, all: 0, w: 0, _app: W.mgr, _web: W.mgr },
    app: (s) => {
      const nW = s.all ? 0 : s.one ? 1 : 2;
      if (s.a === 'mhome') return mgrHome([K.noti(t('Lịch làm việc', 'Work schedule'), K.m('Đang có lịch làm việc ngày 15/10/2026 của Lê Văn An đang chờ phê duyệt.', 'The work schedule of Lê Văn An on 15/10/2026 is awaiting approval.'))]);
      if (s.a === 'list') return K.app({ title: t('Danh sách lịch làm việc', 'Schedule list'), body: K.weekh() + K.stChips('all', null, 1) + K.sum({ h: 'st-an', name: P.an, c: { waiting: 2, approved: 1, confirmed: 2 }, est: 40, act: 16.07, conf: 16 }) + K.sum({ name: P.binh, c: { waiting: 1, approved: 2, confirmed: 2 }, est: 40, act: 16, conf: 16 }),
        bottom: '<div style="flex:1"><div style="font-size:11px;color:#888">' + t('Tổng giờ ước tính', 'Total estimated hours') + '</div><b style="color:#3398dc">80</b></div><div style="flex:1"><div style="font-size:11px;color:#888">' + t('Tổng giờ thực tế', 'Total actual hours') + '</div><b style="color:#3398dc">32.07</b></div>' });
      if (s.a === 'det') return pgd({ name: P.an, card: card(3, 'waiting'), bottom: K.abtn(t('Duyệt lịch làm việc', 'Approve schedule'), 'approve'), dialog: s.dlg ? K.confirmDlg(K.m('Đã duyệt thời gian làm việc', 'Working time approved')) : null });
      return K.app({ title: t('Lịch làm việc', 'Work schedule'), body: K.weekh() + K.stChips(s.all ? 'all' : 'waiting', { waiting: nW, approved: 3 - nW }) + K.acard('<div style="text-align:center">' + t('Nhân viên', 'Employee') + ': <b>' + P.an + '</b></div>') +
          (s.all ? card(2, 'approved') + card(3, 'approved') + card(4, 'approved', { h: 'c2', isNew: 1 }) : (s.one ? '' : card(3, 'waiting', { h: 'c1' })) + card(4, 'waiting', { h: 'c2' })),
        bottom: s.all ? '' : K.abtn(t('Duyệt tất cả', 'Approve all'), 'all'), dialog: s.dlg ? K.confirmDlg(K.m('Đã duyệt tất cả thời gian làm việc', 'All working time approved')) : null });
    },
    web: (s) => K.twsPage({ user: P.mgr + ' (' + t('quản lý', 'manager') + ')', over: s.w === 2 ? K.swalQ(K.m('Bạn có muốn duyệt lịch làm việc không?', 'Do you want to approve this work schedule?')) : '', grid: K.grid({ rows: [
      { name: P.an, h: 'nm-an', cells: [cell.done(), cell.done(), cell.today(), cell.fut({ st: s.one || s.all ? 'approved' : 'waiting', ch: 'an-thu' }), cell.fut({ st: s.all ? 'approved' : 'waiting' }), cell.add(), cell.add()] },
      { name: P.binh, cells: [cell.done(), cell.done(), cell.today(), cell.fut({ st: s.w === 3 ? 'approved' : 'waiting', h: 'bm', ch: 'b-thu', isNew: s.w === 3, menu: s.w === 1 ? K.cmenu(['detail', 'edit', 'approve', 'add', 'paid', 'unpaid', 'ot', '-', 'del']) : '' }), cell.fut(), cell.add(), cell.add()] }
    ] }) }),
    steps: [
      { on: 'app', h: 't-pg', set: { a: 'list' }, t: ['Quản lý mở <b>LLV nhân viên</b> trên Home.', 'The manager opens <b>Staff schedule</b> on Home.'], rule: ['Danh sách chỉ hiện nhân viên <b>do mình quản lý trực tiếp</b>; mỗi người hiển thị số ca theo từng trạng thái và giờ dự kiến / thực tế / được xác nhận.', 'The list shows only employees <b>you directly manage</b>; each shows shift counts by status and planned / actual / confirmed hours.'] },
      { on: 'app', h: 'st-an', set: { a: 'week' }, t: ['Bấm vào <b>Lê Văn An</b> — đang có 2 ca Chờ duyệt.', 'Tap <b>Lê Văn An</b> — 2 shifts are Pending approval.'], rule: ['Màn lịch tuần mặc định lọc <b>Chờ duyệt</b>; nếu không còn ca chờ duyệt sẽ tự chuyển <b>Tất cả</b>.', 'The weekly screen filters <b>Pending approval</b> by default; when none remain it switches to <b>All</b>.'] },
      { on: 'app', h: 'c1', set: { a: 'det' }, t: ['Bấm vào thẻ ca <b>Thứ 5 15/10</b> để xem chi tiết.', 'Tap the <b>Thu 15/10</b> shift card to see details.'] },
      { on: 'app', h: 'approve', set: { dlg: 1 }, t: ['Bấm <b>Duyệt lịch làm việc</b> ở cuối màn hình.', 'Tap <b>Approve schedule</b> at the bottom.'], rule: ['Nút cuối màn được chọn theo thứ tự: Chờ xác nhận → "Xác nhận thời gian làm việc"; Chờ duyệt có đơn <b>đổi ca</b> → màn duyệt đổi ca; có đơn <b>đi muộn/về sớm</b> → màn duyệt đi muộn/về sớm; không có đơn nào → <b>duyệt luôn</b>.', 'The bottom button follows this order: Pending confirmation → "Confirm working time"; Pending approval with a <b>shift change</b> → shift-change approval; with a <b>late/early</b> request → late/early approval; no request → <b>approve directly</b>.'] },
      { on: 'app', h: 'dyes', set: { dlg: 0, one: 1, a: 'week' }, t: ['Bấm <b>Xác nhận</b> trên hộp thoại.', 'Tap <b>Confirm</b> in the dialog.'], rule: ['Ca chuyển <b>Đã duyệt</b>. Nhân viên nhận thông báo <i>"Lịch làm việc ngày … của bạn đã được phê duyệt."</i> Chỉ ca Đã duyệt mới chấm công được.', 'The shift becomes <b>Approved</b>. The employee receives <i>"Lịch làm việc ngày … của bạn đã được phê duyệt."</i> Only Approved shifts can be clocked.'] },
      { on: 'app', h: 'all', set: { dlg: 1 }, t: ['Còn 1 ca Chờ duyệt. Bấm <b>Duyệt tất cả</b> để duyệt một lần.', 'One Pending shift is left. Tap <b>Approve all</b> to approve at once.'], rule: ['"Duyệt tất cả" duyệt mọi ca chờ duyệt đang hiển thị, <b>đồng thời duyệt luôn</b> các đơn đổi ca, đi muộn, về sớm kèm theo (đúng số phút nhân viên xin).', '"Approve all" approves every Pending shift shown and <b>also approves</b> attached shift-change, late and early requests (with the minutes requested).'] },
      { on: 'app', h: 'dyes', set: { dlg: 0, all: 1 }, t: ['Bấm <b>Xác nhận</b>.', 'Tap <b>Confirm</b>.'], rule: ['Nhân viên nhận 1 thông báo <i>"Lịch làm việc tuần … của bạn đã được phê duyệt."</i> Ca có số lần chấm công = 0 sẽ chuyển thẳng <b>Chờ xác nhận</b>, các ca khác → <b>Đã duyệt</b>.', 'The employee gets one notification <i>"Lịch làm việc tuần … của bạn đã được phê duyệt."</i> Shifts with 0 check-in rounds go straight to <b>Pending confirmation</b>; others → <b>Approved</b>.'] },
      { on: 'web', h: 'an-thu', look: true, t: ['Trên <b>Web</b>, các ô ca của An đã hiện <b>Đã duyệt</b>. Giờ duyệt ca của Phạm Thu Bình ngay trên Web.', 'On the <b>Web</b>, An\'s cells now show <b>Approved</b>. Next, approve Phạm Thu Bình\'s shift on the Web.'] },
      { on: 'web', h: 'bm', set: { w: 1 }, t: ['Bấm <b>⋮</b> trên ô ca Chờ duyệt của Bình.', 'Click <b>⋮</b> on Bình\'s Pending cell.'], rule: ['Mục <b>"Duyệt lịch làm việc"</b> chỉ hiện khi: người đăng nhập <b>là quản lý trực tiếp</b> của nhân viên, ca đang <b>Chờ duyệt</b>, ca <b>không</b> đánh dấu nghỉ, và đang xem màn theo nhân viên ở chế độ tuần.', '<b>"Approve schedule"</b> is shown only when: the user <b>is the employee\'s direct manager</b>, the shift is <b>Pending approval</b>, it is <b>not</b> marked as leave, and the by-employee screen is in week mode.'] },
      { on: 'web', h: 'm-approve', set: { w: 2 }, t: ['Chọn <b>Duyệt lịch làm việc</b>.', 'Choose <b>Approve schedule</b>.'] },
      { on: 'web', h: 'yes', set: { w: 3 }, t: ['Bấm <b>Đồng ý</b> để xác nhận.', 'Click <b>Yes</b> to confirm.'], rule: ['Ca chuyển <b>Đã duyệt</b>, nhân viên nhận thông báo.', 'The shift becomes <b>Approved</b> and the employee is notified.'] },
      { on: 'web', h: 'b-thu', look: true, t: ['Ô ca của Bình đã là <b>Đã duyệt</b>.', 'Bình\'s cell is now <b>Approved</b>.'], warn: ['Cả Web và App hiện <b>chưa có nút từ chối</b> lịch làm việc.', 'Neither Web nor App currently has a <b>reject</b> button for schedules.'] }
    ],
    done: ['Tất cả ca Chờ duyệt đã chuyển Đã duyệt. Nhân viên đã có thể chấm công vào đúng ngày của ca.', 'All Pending shifts are now Approved. Employees can clock in on the shift\'s day.'],
    rules: [
      ['Người duyệt là quản lý trực tiếp khai báo trong hồ sơ nhân viên.', 'The approver is the direct manager declared in the employee profile.'],
      ['Chờ duyệt → Đã duyệt; riêng "Duyệt tất cả" với ca 0 lượt chấm → Chờ xác nhận.', 'Pending approval → Approved; with "Approve all", shifts with 0 rounds → Pending confirmation.'],
      ['"Duyệt tất cả" duyệt kèm đơn đổi ca / đi muộn / về sớm.', '"Approve all" also approves shift-change / late / early requests.'],
      ['Web: nút duyệt chỉ hiện với quản lý trực tiếp, ca Chờ duyệt, không đánh dấu nghỉ.', 'Web: the approve item only shows for the direct manager, Pending shifts, not marked as leave.'],
      ['Nhân viên "không cần duyệt lịch" được tự động duyệt mọi yêu cầu.', '"No approval needed" employees have every request auto-approved.']
    ]
  });

  /* =====================================================================
     7. CHẤM CÔNG VÀO / RA (APP ⇄ WEB)
     ===================================================================== */
  HDSD.add({
    id: 'checkin', tier: 1, ch: ['app', 'web'], icon: '⏱️',
    title: ['Chấm công vào / ra trên app', 'Clock in / out in the app'],
    sum: ['Nhân viên bấm "Giờ vào" và "Giờ ra" trên thẻ chấm công ở Home. Máy chủ kiểm tra khung giờ và vị trí wifi/GPS; Web và quản lý thấy kết quả ngay.', 'The employee taps "Clock in" and "Clock out" on the Home check-in card. The server checks the time window and wifi/GPS location; the Web and the manager see the result immediately.'],
    who: ['Nhân viên', 'Employee'],
    pre: ['Ca hôm nay đang Đã duyệt · Cấu hình: Được checkin trước 30 phút, Đi trễ 15 phút · "Bắt buộc chấm công với ảnh" đang tắt.', 'Today\'s shift is Approved · Settings: check-in allowed 30 minutes early, late threshold 15 minutes · "Require a photo" is off.'],
    init: { clock: '07:20', dlg: '', inn: 0, out: 0, _app: W.an, _web: W.mgr },
    app: (s) => anHome({ time: s.clock, home: { card: { sn: K.sang(), time: '08:00 - 17:00', laps: s.inn ? ['07:55 - ' + (s.out ? '17:05' : '')] : [], btn: !s.inn ? 'in' : !s.out ? 'out' : null } },
      dialog: s.dlg === 'early' ? { msg: K.m('Chưa đến thời gian được checkin cho phép.', 'It is not yet the allowed check-in time.') } : s.dlg === 'in' ? { msg: K.m('Chấm công vào thành công', 'Clocked in successfully') } : s.dlg === 'out' ? { msg: K.m('Chấm công ra thành công', 'Clocked out successfully') } : null }),
    web: (s) => K.twsPage({ user: P.mgr + ' (' + t('quản lý', 'manager') + ')', rows: [
      { name: P.an, cells: [cell.done(), cell.done(), s.out ? cell.done({ tm: '07:55 📱 - 17:05 📱', st: 'nc', ch: 'today', isNew: 1 }) : cell.today({ tm: (s.inn ? '07:55 📱' : '--:--') + ' - --:--', ch: 'today', isNew: s.inn }), cell.fut(), cell.fut(), cell.add(), cell.add()] },
      { name: P.binh, cells: [cell.done(), cell.done(), cell.today(), cell.fut(), cell.fut(), cell.add(), cell.add()] }
    ] }),
    steps: [
      { on: 'app', h: 'card', look: true, t: ['Mở app, ngay trên Home là <b>thẻ chấm công</b> với tên ca, thời gian ca và nút <b>Giờ vào</b>.', 'Open the app: Home shows the <b>check-in card</b> with the shift name, its hours and the <b>Clock in</b> button.'],
        rule: ['Thẻ hiện khi có quyền <b>TI000001</b> và có <b>ca của hôm nay</b>: đang <b>Đã duyệt</b>, không đánh dấu nghỉ. Có nhiều ca → lấy ca có giờ bắt đầu sớm nhất. Không có ca hợp lệ → thẻ bị <b>ẩn</b>.', 'The card shows when you have permission <b>TI000001</b> and there is a <b>shift today</b> that is <b>Approved</b> and not marked as leave. With several shifts, the earliest start is used. No valid shift → the card is <b>hidden</b>.'] },
      { on: 'app', h: 'btn-in', set: { dlg: 'early' }, t: ['Lúc <b>07:20</b>, thử bấm <b>Giờ vào</b>.', 'At <b>07:20</b>, try tapping <b>Clock in</b>.'], rule: ['Cấu hình "Được phép checkin trước" = 30 phút → vào sớm hơn <b>07:30</b> bị máy chủ chặn.', '"Check-in allowed before" = 30 minutes → clocking in before <b>07:30</b> is blocked by the server.'] },
      { on: 'app', h: 'dclose', set: { dlg: '', clock: '07:55' }, t: ['App báo <b>"Chưa đến thời gian được checkin cho phép."</b> Đóng thông báo và đợi đến 07:55.', 'The app shows <b>"Chưa đến thời gian được checkin cho phép."</b> Close it and wait until 07:55.'] },
      { on: 'app', h: 'btn-in', set: { dlg: 'in', inn: 1 }, t: ['Lúc <b>07:55</b>, bấm <b>Giờ vào</b>. App lấy vị trí GPS và gửi lên máy chủ.', 'At <b>07:55</b>, tap <b>Clock in</b>. The app reads the GPS position and sends it to the server.'],
        rule: ['Trình tự kiểm tra: ① ngày của ca phải là <b>hôm nay</b> (sai → "Ngày làm việc không hợp lệ"); ② không sớm hơn mức "Được phép checkin trước"; ③ không trễ hơn mức "Tính là đi trễ" — trừ khi đã có đơn xin đi trễ được duyệt (sai → "Quá thời gian checkin."); ④ đúng <b>wifi/GPS</b> của chi nhánh làm việc (trừ nhân viên linh động); ⑤ ghi nhận giờ vào.', 'Checks in order: ① the shift date must be <b>today</b> (else "Ngày làm việc không hợp lệ"); ② not earlier than "Check-in allowed before"; ③ not later than the "late" threshold — unless a late request is approved (else "Quá thời gian checkin."); ④ correct <b>wifi/GPS</b> of the working branch (except flexible staff); ⑤ the clock-in is recorded.'] },
      { on: 'app', h: 'dclose', set: { dlg: '' }, t: ['<b>"Chấm công vào thành công"</b>. Đóng thông báo: thẻ ghi "Lần 1: 07:55 -" và nút đổi thành <b>Giờ ra</b>.', '<b>"Chấm công vào thành công"</b>. Close it: the card shows "Round 1: 07:55 -" and the button becomes <b>Clock out</b>.'] },
      { on: 'web', h: 'today', look: true, set: { clock: '17:05' }, t: ['Cùng lúc đó trên <b>Web</b>: ô hôm nay của An ghi giờ vào <b>07:55 📱</b>, màu cam "Chưa vào/ra ca" vì chưa có giờ ra. Quản lý nhận thông báo <i>"Lê Văn An đã checkin vào lúc 07:55 của ca Ca sáng"</i>.', 'Meanwhile on the <b>Web</b>: An\'s cell for today shows clock-in <b>07:55 📱</b>, orange "Missing in/out" because there is no clock-out yet. The manager receives <i>"Lê Văn An đã checkin vào lúc 07:55 của ca Ca sáng"</i>.'],
        rule: ['Số phút trễ được lưu = giờ vào − giờ bắt đầu ca (<b>không trừ</b> ân hạn). Vào 07:55 → trễ 0 phút.', 'Stored late minutes = clock-in − shift start (the grace period is <b>not</b> subtracted). In at 07:55 → 0 minutes late.'] },
      { on: 'app', h: 'btn-out', set: { dlg: 'out', out: 1 }, t: ['Hết ca, lúc <b>17:05</b> bấm <b>Giờ ra</b>.', 'After work, at <b>17:05</b>, tap <b>Clock out</b>.'],
        rule: ['Kiểm tra ngày và vị trí như giờ vào; <b>không giới hạn giờ ra</b>. Ghi số phút về sớm (= giờ kết thúc ca − giờ ra). Giờ công của lượt = giờ ra − giờ vào − phần trùng nghỉ trưa = 9 giờ 10 − 1 giờ = <b>8,17 giờ</b> (không cắt theo giờ chuẩn, không làm tròn).', 'Date and location are checked as for clock-in; there is <b>no limit on clock-out time</b>. Early minutes are stored (= shift end − clock-out). Hours of the round = out − in − overlap with lunch = 9h10 − 1h = <b>8.17 h</b> (not capped to standard hours, not rounded).'] },
      { on: 'app', h: 'dclose', set: { dlg: '' }, t: ['<b>"Chấm công ra thành công"</b>. Thẻ ghi "Lần 1: 07:55 - 17:05" và không còn nút.', '<b>"Chấm công ra thành công"</b>. The card shows "Round 1: 07:55 - 17:05" and no button remains.'], rule: ['Ca nhiều lượt: sau khi ra lượt này, thẻ chuyển sang lượt kế. Ra ở <b>lượt cuối</b> thì ca chuyển <b>Chờ xác nhận</b>.', 'Multi-round shifts: after this round the card moves to the next one. Clocking out of the <b>last round</b> moves the shift to <b>Pending confirmation</b>.'] },
      { on: 'web', h: 'today', look: true, t: ['Trên <b>Web</b>: ô chuyển xanh <b>"Chấm công đúng giờ"</b>, trạng thái <b>Chờ xác nhận</b>. Quản lý nhận <i>"Đang có lịch làm việc ngày 14/10/2026 của Lê Văn An đang chờ xác nhận."</i>', 'On the <b>Web</b>: the cell turns green <b>"On time"</b>, status <b>Pending confirmation</b>. The manager receives <i>"Đang có lịch làm việc ngày 14/10/2026 của Lê Văn An đang chờ xác nhận."</i>'],
        rule: ['Giờ công thực tế (8,17) chỉ là con số gợi ý; con số dùng cho báo cáo và lương là <b>giờ được xác nhận</b> do quản lý chốt.', 'Actual hours (8.17) are only a suggestion; reports and payroll use the <b>confirmed hours</b> set by the manager.'] }
    ],
    done: ['An đã hoàn tất 1 lượt vào–ra. Ca đang Chờ xác nhận — bước tiếp theo là quản lý "Xác nhận giờ làm việc".', 'An completed one in/out round. The shift is Pending confirmation — next the manager runs "Confirm working time".'],
    rules: [
      ['Chỉ ca Đã duyệt của hôm nay, không đánh dấu nghỉ mới hiện trên thẻ chấm công.', 'Only today\'s Approved shift that is not marked as leave appears on the check-in card.'],
      ['Vào sớm quá mức cho phép: "Chưa đến thời gian được checkin cho phép." · Vào trễ quá ngưỡng (chưa duyệt xin trễ): "Quá thời gian checkin."', 'Too early: "Chưa đến thời gian được checkin cho phép." · Too late (no approved late request): "Quá thời gian checkin."'],
      ['Sai vị trí: "Vui lòng kết nối với wifi [tên wifi] hoặc đến gần văn phòng để check-in/checkout".', 'Wrong location: "Vui lòng kết nối với wifi [name] hoặc đến gần văn phòng để check-in/checkout".'],
      ['Không giới hạn giờ ra. Giờ công lượt = ra − vào − phần trùng nghỉ trưa.', 'No limit on clock-out. Round hours = out − in − lunch overlap.'],
      ['Mất mạng: "Kiểm tra kết nối mạng!" — không có chế độ offline. Định vị tắt: app yêu cầu bật Dịch vụ Định vị.', 'No network: "Kiểm tra kết nối mạng!" — there is no offline mode. Location off: the app asks to enable Location Services.'],
      ['Ra ca lượt cuối → Chờ xác nhận + thông báo cho quản lý.', 'Clock-out of the last round → Pending confirmation + manager notification.']
    ]
  });

  /* =====================================================================
     8. PHÂN LOẠI CA: ĐÚNG GIỜ / TRỄ / SỚM / NGHỈ KHÔNG LƯƠNG
     ===================================================================== */
  const CL = () => [
    ['08:05', '17:00', t('trễ 5′', '5′ late'), 'ok', t('Hôm nay / đã qua', 'Today / past')],
    ['08:20', '17:00', t('trễ 20′', '20′ late'), 'late', t('Hôm nay / đã qua', 'Today / past')],
    ['07:58', '16:55', t('sớm 5′', '5′ early'), 'ok', t('Hôm nay / đã qua', 'Today / past')],
    ['08:00', '16:30', t('sớm 30′', '30′ early'), 'late', t('Hôm nay / đã qua', 'Today / past')],
    ['08:00', '15:30', t('sớm 90′', '90′ early'), 'unpaid', t('Hôm nay / đã qua', 'Today / past')],
    ['08:00', '—', '', 'miss', t('Ngày đã qua', 'Past day')],
    ['—', '—', '', 'unpaid', t('Ngày đã qua', 'Past day')]
  ];
  HDSD.add({
    id: 'classify', tier: 1, ch: ['web'], icon: '🎨',
    title: ['Hệ thống phân loại ca: đúng giờ, trễ, sớm, nghỉ không lương', 'How shifts are classified: on time, late, early, unpaid leave'],
    sum: ['Hiểu cách hệ thống tô màu ô ca và tính trạng thái báo cáo từ giờ vào/ra thực tế và 4 ngưỡng trong Cấu hình chung.', 'Understand how the system colours shift cells and derives report statuses from actual in/out times and the 4 thresholds in General settings.'],
    who: ['Admin / HR / Quản lý', 'Admin / HR / Manager'],
    init: { n: 0 },
    web: (s) => K.web({ nav: 'tws', body: K.portlet(t('Quy tắc tô màu / trạng thái ca', 'Colour / status rules'), '',
      '<div class="filter" data-h="cfg"><b>' + t('Ca 08:00–17:00', 'Shift 08:00–17:00') + '</b><span class="tag web">' + t('Đi trễ: 15′', 'Late: 15′') + '</span><span class="tag web">' + t('Trễ tính nghỉ không lương: 120′', 'Late = unpaid leave: 120′') + '</span><span class="tag app">' + t('Về sớm: 10′', 'Early: 10′') + '</span><span class="tag app">' + t('Sớm tính nghỉ không lương: 60′', 'Early = unpaid leave: 60′') + '</span></div>' +
      K.table([t('Ngày của ca', 'Shift day'), t('Giờ vào', 'In'), t('Giờ ra', 'Out'), t('Số phút lưu lại', 'Stored minutes'), t('Kết quả tô màu / báo cáo', 'Colour / report result')],
        CL().map((r, i) => ({ h: 'r' + (i + 1), cls: i === s.n - 1 ? 'new' : '', c: [r[4], '<b>' + r[0] + '</b>', '<b>' + r[1] + '</b>', i < s.n ? r[2] : '', i < s.n ? K.swatch(r[3]) : '<span style="color:#bbb">?</span>'] }))) + K.legend()) }),
    steps: [
      { on: 'web', h: 'cfg', look: true, set: { n: 1 }, t: ['Có <b>hai con số khác nhau</b>: số phút trễ/sớm <b>lưu lại</b> khi chấm công (tính cả 1 phút), và cách <b>đánh giá</b> trên màn hình/báo cáo (chỉ tính khi vượt ngưỡng cấu hình).', 'There are <b>two different numbers</b>: the late/early minutes <b>stored</b> at clock time (even 1 minute counts), and the <b>evaluation</b> on screens/reports (only counted beyond the configured thresholds).'],
        rule: ['Ví dụ dùng ngưỡng: đi trễ 15′, trễ tính nghỉ 120′, về sớm 10′, sớm tính nghỉ 60′.', 'The example uses: late 15′, late = leave 120′, early 10′, early = leave 60′.'] },
      { on: 'web', h: 'r1', look: true, set: { n: 2 }, t: ['Vào <b>08:05</b>, ra 17:00 → <b>Chấm công đúng giờ</b>.', 'In at <b>08:05</b>, out at 17:00 → <b>On time</b>.'], rule: ['Trễ 5 phút vẫn nằm trong ngưỡng 15 phút nên được tô "đúng giờ", nhưng hệ thống vẫn <b>lưu trễ 5 phút</b>.', '5 minutes late is within the 15-minute threshold so it is "on time", yet <b>5 late minutes are stored</b>.'] },
      { on: 'web', h: 'r2', look: true, set: { n: 3 }, t: ['Vào <b>08:20</b> → <b>Vào trễ/ra sớm</b> (vàng).', 'In at <b>08:20</b> → <b>Late in / early out</b> (yellow).'], rule: ['Vào sau (giờ bắt đầu + ngưỡng trễ) = sau 08:15. Lưu ý: muốn vào được lúc 08:20 thì ca phải có đơn xin đi trễ được duyệt, nếu không đã bị chặn "Quá thời gian checkin."', 'Clock-in after (start + late threshold) = after 08:15. Note: to clock in at 08:20 the shift needs an approved late request, otherwise it is blocked with "Quá thời gian checkin."'] },
      { on: 'web', h: 'r3', look: true, set: { n: 4 }, t: ['Vào 07:58, ra <b>16:55</b> → <b>Đúng giờ</b>.', 'In 07:58, out <b>16:55</b> → <b>On time</b>.'], rule: ['Sớm 5 phút < ngưỡng về sớm 10 phút.', '5 minutes early < the 10-minute early threshold.'] },
      { on: 'web', h: 'r4', look: true, set: { n: 5 }, t: ['Ra <b>16:30</b> → <b>Vào trễ/ra sớm</b>.', 'Out at <b>16:30</b> → <b>Late in / early out</b>.'], rule: ['Ra trước (giờ kết thúc − ngưỡng sớm) = trước 16:50.', 'Clock-out before (end − early threshold) = before 16:50.'] },
      { on: 'web', h: 'r5', look: true, set: { n: 6 }, t: ['Ra <b>15:30</b> → <b>Nghỉ phép không lương</b>.', 'Out at <b>15:30</b> → <b>Unpaid leave</b>.'], rule: ['Sớm 90 phút > ngưỡng "sớm tính nghỉ không lương" 60 phút. Tương tự, vào trễ quá 120 phút cũng bị tính nghỉ không lương. Điều kiện sau <b>ghi đè</b> điều kiện trước.', '90 minutes early > the 60-minute "early = unpaid leave" threshold. Likewise, more than 120 minutes late is unpaid leave. Later conditions <b>override</b> earlier ones.'] },
      { on: 'web', h: 'r6', look: true, set: { n: 7 }, t: ['Ngày đã qua, có vào nhưng <b>thiếu giờ ra</b> → <b>Chưa vào/ra ca</b> (cam).', 'Past day, clocked in but <b>no clock-out</b> → <b>Missing in/out</b> (orange).'], rule: ['Ca hôm nay thiếu vào hoặc thiếu ra cũng hiển thị "Chưa vào/ra ca".', 'Today\'s shift missing either in or out is also "Missing in/out".'] },
      { on: 'web', h: 'r7', look: true, t: ['Ngày đã qua, <b>không vào và không ra</b> → <b>Nghỉ phép không lương</b> (vắng mặt).', 'Past day, <b>no in and no out</b> → <b>Unpaid leave</b> (absent).'] },
      { on: 'web', h: 'legend', look: true, t: ['Các trường hợp còn lại: ca <b>ngày tương lai</b> → "Chưa đến ca"; ca được <b>đánh dấu nghỉ có lương / không lương</b> → tô theo đánh dấu; ca <b>tăng ca</b> → viền đỏ.', 'Remaining cases: a <b>future</b> shift → "Not yet due"; a shift <b>marked paid / unpaid leave</b> → coloured by the mark; an <b>overtime</b> shift → red border.'],
        warn: ['Cột "Số lần đi trễ / về sớm" trên Bảng chấm công và Excel đếm <b>mọi</b> ca có trễ/sớm > 0 phút — không xét ngưỡng và không xét đơn đã duyệt — nên có thể khác với màu ô.', 'The "Late / Early count" columns in the Timesheet and Excel count <b>every</b> shift with late/early > 0 minutes — ignoring thresholds and approved requests — so they may differ from the cell colours.'] }
    ],
    done: ['Thứ tự xét cho ca hôm nay: Đúng giờ → thiếu vào/ra → đánh dấu nghỉ → vượt ngưỡng trễ/sớm → vượt ngưỡng tính nghỉ không lương (điều sau ghi đè điều trước). Ca đã qua: đánh dấu nghỉ → không vào không ra → thiếu vào/ra → trễ/sớm → đúng giờ.', 'Order for today\'s shift: On time → missing in/out → marked leave → beyond late/early threshold → beyond unpaid-leave threshold (later overrides earlier). Past shift: marked leave → no in and no out → missing in/out → late/early → on time.'],
    rules: [
      ['Số phút trễ = giờ vào − giờ bắt đầu ca; số phút sớm = giờ kết thúc ca − giờ ra (không trừ ân hạn).', 'Late minutes = in − shift start; early minutes = shift end − out (grace not subtracted).'],
      ['Chỉ tô "trễ/sớm" khi vượt ngưỡng cấu hình.', '"Late/early" colour only applies beyond the configured thresholds.'],
      ['"Nghỉ không lương do trễ/sớm" chỉ có trên báo cáo, không lưu vào ca.', '"Unpaid leave due to late/early" exists only in reports; it is not stored on the shift.'],
      ['Đơn xin trễ/sớm được duyệt: không chặn check-in và không tính vào lương, nhưng màn tô màu / Bảng chấm công / Excel vẫn tính trễ/sớm.', 'An approved late/early request: clock-in is not blocked and payroll ignores it, but colours / Timesheet / Excel still count it.']
    ]
  });

  /* =====================================================================
     9. ĐỔI CA (NHÂN VIÊN XIN → QUẢN LÝ DUYỆT)
     ===================================================================== */
  const lineChg = (note) => '↔ ' + t('Đổi ca từ', 'Changed from') + ': ' + K.sang() + ' · ' + t('Ghi chú', 'Note') + ': ' + note;
  HDSD.add({
    id: 'change-shift', tier: 1, ch: ['app'], icon: '🔁',
    title: ['Đổi ca: nhân viên gửi → quản lý duyệt', 'Shift change: employee requests → manager approves'],
    sum: ['Nhân viên xin đổi sang ca khác cho một ngày; quản lý trực tiếp duyệt (có thể chọn ca khác) trên app.', 'The employee asks to switch to another shift for a day; the direct manager approves it (and may pick a different shift) in the app.'],
    who: ['Nhân viên → Quản lý trực tiếp', 'Employee → Direct manager'],
    init: { a: 'llv', sh: '', note: '', sent: 0, dlg: 0, ok: 0, _app: W.an },
    app: (s) => {
      const fri = (o) => card(4, s.ok ? 'approved' : 'waiting', Object.assign({ shift: K.chieu(), time: '13:00 -> 22:00', est: 9, lines: [lineChg(s.note)] }, o));
      if (s.a === 'form') return K.app({ title: t('Đổi ca làm', 'Change shift'), body: K.acard('<b>' + day(4) + '</b><div>' + t('Ca hiện tại', 'Current shift') + ': ' + K.sang() + '</div>') + K.field(t('Chi nhánh', 'Branch'), K.asel('f-br', K.br1())) + K.field(t('Đổi ca', 'New shift') + ' *', K.asel('f-sh', s.sh, t('Chọn ca làm việc của bạn', 'Select your shift'))) +
        K.field(t('Ghi chú', 'Note'), K.ainp('f-note', s.note, t('Nhập ghi chú', 'Enter a note'))) + K.field(t('Ghi đè thời gian (Tùy chọn)', 'Override time (optional)'), '<div style="display:flex;gap:6px">' + K.ainp('', s.sh ? '13:00' : '08:00') + K.ainp('', s.sh ? '22:00' : '17:00') + '</div>') + K.field(t('Hình ảnh', 'Images'), K.acard('<div style="text-align:center;color:#999">+ ' + t('Thêm ảnh', 'Add image') + '</div>')), bottom: K.abtn(t('Lưu', 'Save'), 'save') });
      if (s.a === 'mhome') return mgrHome([K.noti(t('Lịch làm việc', 'Work schedule'), K.m('Đang có lịch làm việc ngày 16/10/2026 của Lê Văn An đang chờ phê duyệt.', 'The work schedule of Lê Văn An on 16/10/2026 is awaiting approval.'), 'noti', 1)]);
      if (s.a === 'det') return pgd({ name: P.an, card: fri({ h: 'dcard' }), bottom: s.ok ? '' : K.abtn(t('Duyệt lịch làm việc', 'Approve schedule'), 'approve') });
      if (s.a === 'pgshift') return K.app({ title: t('Duyệt lịch làm việc', 'Approve schedule'), body: K.acard(t('Nhân viên', 'Employee') + ': <b>' + P.an + '</b><br>' + K.d(4) + ' ' + K.chip('waiting')) + K.field(t('Đổi ca', 'New shift') + ' *', K.asel('ps-sh', K.chieu())) + K.acard(t('Ca cũ', 'Old shift') + ': <b style="color:#c62828">' + K.sang() + '</b><br>' + t('Lý do', 'Reason') + ': ' + s.note),
        bottom: K.abtn(t('Xác nhận', 'Confirm'), 'ps-save'), dialog: s.dlg ? K.confirmDlg(K.m('Đã duyệt thời gian làm việc', 'Working time approved')) : null });
      return llv(card(2, 'approved', { acts: acts(0) }) + (s.sent ? fri({ h: 'c-fri', isNew: 1 }) : card(4, 'approved', { acts: acts(1) })), { waiting: s.sent ? 1 : 0, approved: s.sent ? 1 : 2, confirmed: 2, est: s.sent ? 33 : 32, act: 16.07, conf: 16 });
    },
    steps: [
      { on: 'app', h: 'chg', set: { a: 'form' }, t: ['Trong <b>LLV</b>, trên thẻ ca <b>Thứ 6 16/10</b>, bấm <b>Đổi ca làm</b>.', 'In <b>LLV</b>, on the <b>Fri 16/10</b> card, tap <b>Change shift</b>.'], rule: ['Nút hiện khi: ca <b>chưa ra ca</b>, đang <b>Đã duyệt hoặc Chờ duyệt</b>, ngày làm <b>≥ hôm nay</b>, và còn ít nhất một loại đơn (đổi ca hoặc đi muộn/về sớm) chưa được quản lý duyệt.', 'The button shows when the shift has <b>not been clocked out</b>, is <b>Approved or Pending approval</b>, the day is <b>≥ today</b>, and at least one request type (shift change or late/early) is not yet approved.'] },
      { on: 'app', h: 'f-sh', set: (s) => { s.sh = K.chieu(); }, t: ['Chọn <b>ca mới</b> muốn đổi sang.', 'Select the <b>new shift</b>.'], rule: ['Bắt buộc — bỏ trống báo <i>"Vui lòng chọn ca làm việc"</i>. Danh sách chỉ gồm ca <b>áp dụng cho thứ đó</b> và <b>thuộc chi nhánh đã chọn</b>.', 'Required — empty shows <i>"Vui lòng chọn ca làm việc"</i>. The list contains only shifts <b>valid for that weekday</b> and <b>belonging to the selected branch</b>.'] },
      { on: 'app', h: 'f-note', type: ['Bận việc gia đình buổi sáng', 'Family matter in the morning'], k: 'note', t: ['Nhập <b>ghi chú</b> lý do (có thể kèm hình ảnh, ghi đè giờ).', 'Enter a <b>note</b> with the reason (images and a time override are optional).'], rule: ['Giờ ghi đè trùng với ca khác → <i>"Thời gian làm việc đã trùng với lịch khác"</i>.', 'An override that overlaps another shift → <i>"Thời gian làm việc đã trùng với lịch khác"</i>.'] },
      { on: 'app', h: 'save', set: { a: 'llv', sent: 1 }, t: ['Bấm <b>Lưu</b> để gửi yêu cầu.', 'Tap <b>Save</b> to submit.'], rule: ['Ca quay về <b>Chờ duyệt</b> và quản lý nhận thông báo; được <b>tự duyệt</b> nếu nhân viên "không cần duyệt lịch" hoặc người gửi là quản lý của nhân viên. Giờ, hệ số công, giờ làm được cập nhật theo ca mới.', 'The shift returns to <b>Pending approval</b> and the manager is notified; it is <b>auto-approved</b> if the employee needs no approval or the sender is the employee\'s manager. Hours, coefficient and working hours follow the new shift.'],
        warn: ['Trong lúc Chờ duyệt, ca <b>không hiện ở thẻ chấm công</b>. Nếu ca <b>đã chấm công vào</b>, đổi ca sẽ <b>xoá toàn bộ dữ liệu chấm công</b> của ca — nên đổi ca trước khi chấm công.', 'While Pending, the shift is <b>not shown on the check-in card</b>. If the shift was <b>already clocked in</b>, changing it <b>deletes all its attendance data</b> — change shifts before clocking.'] },
      { on: 'app', h: 'c-fri', look: true, set: { a: 'mhome', _app: W.mgr }, t: ['Thẻ ca hiển thị ca mới, nhãn <b>Chờ duyệt</b> và dòng "Đổi ca từ: Ca sáng".', 'The card shows the new shift, the <b>Pending approval</b> label and "Changed from: Morning shift".'] },
      { on: 'app', h: 'noti', set: { a: 'det' }, t: ['<b>Quản lý</b> nhận thông báo → bấm vào để mở chi tiết lịch làm việc.', 'The <b>manager</b> gets a notification → tap it to open the schedule details.'] },
      { on: 'app', h: 'approve', set: { a: 'pgshift' }, t: ['Bấm <b>Duyệt lịch làm việc</b>.', 'Tap <b>Approve schedule</b>.'], rule: ['Ca Chờ duyệt có đơn <b>đổi ca</b> chưa duyệt → app mở <b>màn duyệt đổi ca</b>.', 'A Pending shift with an unapproved <b>shift change</b> → the app opens the <b>shift-change approval</b> screen.'] },
      { on: 'app', h: 'ps-sh', look: true, t: ['Màn duyệt hiển thị <b>ca cũ</b>, lý do, và ô <b>Đổi ca</b> — mặc định là ca nhân viên xin, quản lý có thể chọn ca khác.', 'The screen shows the <b>old shift</b>, the reason and the <b>New shift</b> field — defaulting to the requested shift; the manager may choose another.'] },
      { on: 'app', h: 'ps-save', set: { dlg: 1 }, t: ['Bấm <b>Xác nhận</b>.', 'Tap <b>Confirm</b>.'] },
      { on: 'app', h: 'dyes', set: { dlg: 0, ok: 1, a: 'det' }, t: ['Xác nhận trên hộp thoại.', 'Confirm in the dialog.'], rule: ['Ca trở lại <b>Đã duyệt</b>; nhân viên nhận <i>"Lịch làm việc ngày … của bạn đã được phê duyệt đổi ca."</i> Nếu ca còn <b>cả</b> đơn đi muộn <b>và</b> về sớm chưa duyệt, app chuyển tiếp sang màn duyệt đi muộn/về sớm.', 'The shift is <b>Approved</b> again; the employee receives <i>"Lịch làm việc ngày … của bạn đã được phê duyệt đổi ca."</i> If <b>both</b> a late <b>and</b> an early request are still pending, the app continues to the late/early approval screen.'] },
      { on: 'app', h: 'dcard', look: true, t: ['Ca Thứ 6 của An giờ là <b>Ca chiều 13:00–22:00 · Đã duyệt</b>.', 'An\'s Friday shift is now <b>Afternoon shift 13:00–22:00 · Approved</b>.'] }
    ],
    done: ['Đổi ca hoàn tất. Ca mới mã KL sẽ được đánh dấu nghỉ không lương; mã P hoặc 1/2 → nghỉ có lương.', 'The change is complete. A new shift with code KL is marked unpaid leave; code P or 1/2 → paid leave.'],
    rules: [
      ['Điều kiện gửi: ca chưa ra ca, Đã duyệt/Chờ duyệt, ngày ≥ hôm nay.', 'To submit: shift not clocked out, Approved/Pending, day ≥ today.'],
      ['Gửi xong ca về Chờ duyệt (trừ khi tự duyệt) và tạm ẩn khỏi thẻ chấm công.', 'After submitting the shift is Pending (unless auto-approved) and hidden from the check-in card.'],
      ['Đổi ca sau khi đã chấm công vào sẽ xoá dữ liệu chấm công của ca.', 'Changing a shift after clocking in deletes its attendance data.'],
      ['Quản lý có thể duyệt sang ca khác với ca nhân viên xin.', 'The manager may approve a different shift than requested.'],
      ['Ca mới mã KL → nghỉ không lương; mã P hoặc 1/2 → nghỉ có lương.', 'New shift code KL → unpaid leave; code P or 1/2 → paid leave.']
    ]
  });

  /* =====================================================================
     10. XIN ĐI MUỘN / VỀ SỚM
     ===================================================================== */
  HDSD.add({
    id: 'late-soon', tier: 1, ch: ['app'], icon: '⏰',
    title: ['Xin đi muộn / về sớm và duyệt', 'Late arrival / early leave request and approval'],
    sum: ['Nhân viên xin trước số phút đi muộn hoặc về sớm; quản lý duyệt (có thể sửa số phút). Đơn được duyệt giúp nhân viên không bị chặn check-in khi vào trễ.', 'The employee requests late or early minutes in advance; the manager approves (and may edit the minutes). An approved request prevents the clock-in block when arriving late.'],
    who: ['Nhân viên → Quản lý trực tiếp', 'Employee → Direct manager'],
    init: { a: 'llv', late: '', lnote: '', sent: 0, dlg: 0, ok: 0, _app: W.an },
    app: (s) => {
      const ln = '⏰ ' + t('Đi muộn', 'Late') + ': ' + s.late + ' ' + t('Phút', 'min') + ' · ' + s.lnote + (s.ok ? ' · ' + t('Người duyệt', 'Approved by') + ': ' + P.mgr : '');
      const fri = (o) => card(4, s.ok ? 'approved' : 'waiting', Object.assign({ lines: [ln] }, o));
      if (s.a === 'form') return K.app({ title: t('Đi muộn / Về sớm', 'Late / Early'), body: K.acard('<b>' + K.d(4) + '</b> · ' + t('Ca hiện tại', 'Current shift') + ': ' + K.sang()) + K.field(t('Số phút đi muộn', 'Late minutes'), K.stepper('lmin', s.late)) + K.field(t('Ghi chú đi muộn', 'Late note'), K.ainp('lnote', s.lnote, t('Nhập ghi chú', 'Enter a note'))) +
        K.field(t('Số phút về sớm', 'Early minutes'), K.stepper('smin', '')) + K.field(t('Ghi chú về sớm', 'Early note'), K.ainp('', '', t('Nhập ghi chú', 'Enter a note'))), bottom: K.abtn(t('Lưu', 'Save'), 'save') });
      if (s.a === 'mhome') return mgrHome([K.noti(t('Lịch làm việc', 'Work schedule'), K.m('Đang có yêu cầu xin đi trễ / về sớm ngày 16/10/2026 của Lê Văn An đang chờ phê duyệt.', 'A late / early request of Lê Văn An for 16/10/2026 is awaiting approval.'), 'noti', 1)]);
      if (s.a === 'det') return pgd({ name: P.an, card: fri({ h: 'dcard' }), bottom: s.ok ? '' : K.abtn(t('Duyệt lịch làm việc', 'Approve schedule'), 'approve') });
      if (s.a === 'pglate') return K.app({ title: t('Duyệt lịch làm việc', 'Approve schedule'), body: K.acard(t('Nhân viên', 'Employee') + ': <b>' + P.an + '</b><br>' + K.d(4) + ' · ' + t('Ca', 'Shift') + ': ' + K.sang()) + K.acard('<b>' + t('Đơn phép: Đi muộn/Về sớm', 'Request: Late/Early') + '</b><div style="height:8px"></div>' + K.field(t('Số phút đi muộn', 'Late minutes'), K.stepper('pl', '', s.late)) + '<div style="font-size:12px;color:#666">' + t('Ghi chú đi muộn', 'Late note') + ': ' + s.lnote + '</div>'),
        bottom: K.abtn(t('Phê duyệt', 'Approve'), 'pl-save'), dialog: s.dlg ? K.confirmDlg(K.m('Đã duyệt thời gian làm việc', 'Working time approved')) : null });
      return llv(card(2, 'approved', { acts: acts(0) }) + (s.sent ? fri({ h: 'c-fri', isNew: 1 }) : card(4, 'approved', { acts: acts(1) })), { waiting: s.sent ? 1 : 0, approved: s.sent ? 1 : 2, confirmed: 2, est: 32, act: 16.07, conf: 16 });
    },
    steps: [
      { on: 'app', h: 'late', set: { a: 'form' }, t: ['Trong <b>LLV</b>, trên thẻ ca Thứ 6 16/10, bấm <b>Đi muộn / Về sớm</b>.', 'In <b>LLV</b>, on the Fri 16/10 card, tap <b>Late / Early</b>.'] },
      { on: 'app', h: 'lmin', type: '30', k: 'late', t: ['Nhập <b>Số phút đi muộn</b>: 30.', 'Enter <b>Late minutes</b>: 30.'], rule: ['Nút <b>−</b> giảm 1, nút <b>+</b> tăng 5. Có thể nhập đi muộn và/hoặc về sớm; cả hai đều 0 → <i>"Vui lòng nhập phút hợp lệ"</i>.', '<b>−</b> decreases by 1, <b>+</b> increases by 5. You may enter late and/or early minutes; both 0 → <i>"Vui lòng nhập phút hợp lệ"</i>.'] },
      { on: 'app', h: 'lnote', type: ['Đưa con đi khám', 'Taking my child to the doctor'], k: 'lnote', t: ['Nhập <b>ghi chú đi muộn</b>.', 'Enter the <b>late note</b>.'] },
      { on: 'app', h: 'save', set: { a: 'llv', sent: 1 }, t: ['Bấm <b>Lưu</b>.', 'Tap <b>Save</b>.'], rule: ['Ca chuyển <b>Chờ duyệt</b> (trừ khi được tự duyệt). Quản lý nhận <i>"Đang có yêu cầu xin đi trễ / về sớm ngày … của … đang chờ phê duyệt."</i>', 'The shift becomes <b>Pending approval</b> (unless auto-approved). The manager receives <i>"Đang có yêu cầu xin đi trễ / về sớm ngày … của … đang chờ phê duyệt."</i>'],
        warn: ['Trong thời gian chờ duyệt, ca <b>không hiện ở thẻ chấm công</b> — hãy gửi đơn sớm để quản lý kịp duyệt trước giờ vào ca.', 'While pending, the shift is <b>not on the check-in card</b> — submit early so the manager can approve before the shift starts.'] },
      { on: 'app', h: 'c-fri', look: true, set: { a: 'mhome', _app: W.mgr }, t: ['Thẻ ca ghi "Đi muộn: 30 Phút" và nhãn <b>Chờ duyệt</b>.', 'The card shows "Late: 30 min" and the <b>Pending approval</b> label.'] },
      { on: 'app', h: 'noti', set: { a: 'det' }, t: ['<b>Quản lý</b> bấm vào thông báo để mở chi tiết ca.', 'The <b>manager</b> taps the notification to open the shift details.'] },
      { on: 'app', h: 'approve', set: { a: 'pglate' }, t: ['Bấm <b>Duyệt lịch làm việc</b>.', 'Tap <b>Approve schedule</b>.'], rule: ['Ca Chờ duyệt có đơn <b>đi muộn / về sớm</b> chưa duyệt → app mở màn duyệt đi muộn/về sớm.', 'A Pending shift with an unapproved <b>late / early</b> request → the app opens the late/early approval screen.'] },
      { on: 'app', h: 'pl', look: true, t: ['Quản lý có thể <b>sửa số phút</b> được duyệt.', 'The manager may <b>edit the approved minutes</b>.'], rule: ['<b>Để trống</b> = duyệt đúng số nhân viên xin (30). Nhập <b>0</b> = không duyệt loại đó.', '<b>Empty</b> = approve exactly what was requested (30). Enter <b>0</b> = do not approve that type.'] },
      { on: 'app', h: 'pl-save', set: { dlg: 1 }, t: ['Bấm <b>Phê duyệt</b>.', 'Tap <b>Approve</b>.'] },
      { on: 'app', h: 'dyes', set: { dlg: 0, ok: 1, a: 'det' }, t: ['Xác nhận trên hộp thoại.', 'Confirm in the dialog.'], rule: ['Ca trở lại <b>Đã duyệt</b> (hoặc <b>Chờ xác nhận</b> nếu ca không cần chấm công). Nhân viên nhận <i>"Lịch làm việc ngày … của bạn đã được phê duyệt đi sớm / về trễ."</i>', 'The shift returns to <b>Approved</b> (or <b>Pending confirmation</b> for shifts without clocking). The employee receives <i>"Lịch làm việc ngày … của bạn đã được phê duyệt đi sớm / về trễ."</i>'] },
      { on: 'app', h: 'dcard', look: true, t: ['Đơn đã được duyệt: ngày 16/10 An vào trễ vẫn <b>không bị chặn</b> "Quá thời gian checkin."', 'The request is approved: on 16/10 An can clock in late <b>without being blocked</b> by "Quá thời gian checkin."'] }
    ],
    done: ['Tác dụng của đơn đã duyệt: (1) chấm công vào không bị chặn; (2) tính lương không tính ca này vào số lần/số phút đi trễ, về sớm; (3) màn Lịch sử chấm công ghi "Đã duyệt đi trễ". Màn tô màu, Bảng chấm công và Excel vẫn hiển thị trễ/sớm.', 'Effects of an approved request: (1) clock-in is not blocked; (2) payroll excludes the shift from late/early counts and minutes; (3) Attendance history shows "Đã duyệt đi trễ". Colours, the Timesheet and Excel still show late/early.'],
    rules: [
      ['Nút − giảm 1 phút, + tăng 5 phút; không được để cả hai bằng 0.', '− decreases 1 minute, + increases 5; both may not be 0.'],
      ['Gửi đơn → ca về Chờ duyệt và tạm ẩn khỏi thẻ chấm công.', 'Submitting → the shift is Pending and hidden from the check-in card.'],
      ['Quản lý: để trống = duyệt đúng số xin; 0 = không duyệt.', 'Manager: empty = approve as requested; 0 = not approved.'],
      ['Trên Web, màn Lịch sử chấm công cũng có "Duyệt đi trễ" / "Duyệt về sớm" cho ca đã phát sinh trễ/sớm.', 'On the Web, Attendance history also offers "Duyệt đi trễ" / "Duyệt về sớm" for shifts that already have late/early minutes.']
    ]
  });

  /* =====================================================================
     11. LÀM THÊM GIỜ (OT)
     ===================================================================== */
  HDSD.add({
    id: 'ot', tier: 1, ch: ['app'], icon: '🌙',
    title: ['Đăng ký làm thêm giờ (OT)', 'Register overtime (OT)'],
    sum: ['Nhân viên đăng ký ca tăng ca nối sau ca chính trên app. Hệ thống tạo một ca OT riêng tính theo giờ và gửi quản lý duyệt.', 'The employee registers overtime after the main shift in the app. The system creates a separate hour-based OT shift and sends it to the manager.'],
    who: ['Nhân viên → Quản lý trực tiếp', 'Employee → Direct manager'],
    init: { a: 'llv', end: '', no: 0, sent: 0, _app: W.an },
    app: (s) => {
      if (s.a === 'form') return K.app({ title: t('Làm thêm giờ', 'Overtime'), body: K.acard(t('Ngày làm việc', 'Working day') + ': <b>' + day(4) + '</b><br>' + t('Ca', 'Shift') + ': ' + K.sang()) + K.field(t('Địa điểm làm việc', 'Work location') + ' *', K.asel('o-br', K.br1())) + K.field(t('Thời gian bắt đầu', 'Start time') + ' *', K.ainp('o-s', '16/10/2026 17:00')) +
        K.field(t('Giờ kết thúc', 'End time') + ' *', K.ainp('o-e', s.end, t('Chọn giờ kết thúc', 'Pick the end time'))) + '<div data-h="o-no-row">' + K.ack('o-no', s.no, t('Không cần chấm công', 'No clocking needed')) + '</div>', bottom: K.abtn(t('Lưu', 'Save'), 'save') });
      if (s.a === 'mhome') return mgrHome([K.noti(t('Lịch làm việc', 'Work schedule'), K.m('Đang có lịch làm việc thêm giờ ngày 16/10/2026 của Lê Văn An đang chờ phê duyệt.', 'An overtime schedule of Lê Văn An for 16/10/2026 is awaiting approval.'), 'noti', 1)]);
      return llv(card(2, 'approved', { acts: acts(0) }) + card(4, 'approved', { acts: acts(1) }) + (s.sent ? card(4, 'waiting', { h: 'c-ot', isNew: 1, ot: 1, shift: 'OT', time: '17:00 -> 19:00', est: 2 }) : ''), { waiting: s.sent ? 1 : 0, approved: 2, confirmed: 2, est: s.sent ? 34 : 32, act: 16.07, conf: 16 });
    },
    steps: [
      { on: 'app', h: 'ot', set: { a: 'form' }, t: ['Trong <b>LLV</b>, trên thẻ ca Thứ 6 16/10, bấm <b>Làm thêm giờ</b>.', 'In <b>LLV</b>, on the Fri 16/10 card, tap <b>Overtime</b>.'], rule: ['Nút hiện khi ca <b>Đã duyệt / Chờ duyệt</b> và ngày <b>≥ hôm nay</b>.', 'The button shows when the shift is <b>Approved / Pending approval</b> and the day is <b>≥ today</b>.'] },
      { on: 'app', h: 'o-br', look: true, t: ['<b>Địa điểm làm việc</b> mặc định là chi nhánh của ca gốc.', '<b>Work location</b> defaults to the main shift\'s branch.'], rule: ['Bắt buộc — thiếu sẽ báo chưa chọn Địa điểm làm việc.', 'Required — missing it shows a "location not selected" message.'] },
      { on: 'app', h: 'o-s', look: true, t: ['<b>Thời gian bắt đầu</b> mặc định = giờ kết thúc ca gốc (17:00).', '<b>Start time</b> defaults to the main shift\'s end (17:00).'] },
      { on: 'app', h: 'o-e', type: '16/10/2026 19:00', k: 'end', t: ['Chọn <b>Giờ kết thúc</b>: 19:00.', 'Pick the <b>End time</b>: 19:00.'], rule: ['Kết thúc ≤ bắt đầu → <i>"Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu"</i>. Trùng giờ với ca khác → <i>"Thời gian làm việc đã trùng với lịch khác"</i>. Thứ đó không được bật trên mẫu ca OT → <i>"Ngày làm việc không hợp lệ"</i>.', 'End ≤ start → <i>"Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu"</i>. Overlap with another shift → <i>"Thời gian làm việc đã trùng với lịch khác"</i>. Weekday not enabled on the OT template → <i>"Ngày làm việc không hợp lệ"</i>.'] },
      { on: 'app', h: 'o-no-row', look: true, t: ['Ô <b>"Không cần chấm công"</b>: để trống nếu nhân viên sẽ tự chấm công cho ca OT.', 'The <b>"No clocking needed"</b> box: leave empty if the employee will clock the OT shift.'], rule: ['<b>Tick</b> → ca coi như đã vào/ra, giờ được xác nhận = số giờ đăng ký. <b>Không tick</b> → nhân viên phải tự chấm <b>1 lượt</b> vào/ra.', '<b>Ticked</b> → the shift counts as clocked in/out and confirmed hours = registered hours. <b>Unticked</b> → the employee must clock <b>one round</b> in/out.'] },
      { on: 'app', h: 'save', set: { a: 'llv', sent: 1 }, t: ['Bấm <b>Lưu</b>.', 'Tap <b>Save</b>.'], rule: ['Hệ thống tạo <b>một ca tăng ca riêng</b>: tính theo <b>giờ</b>, giờ làm = kết thúc − bắt đầu = <b>2 giờ</b> (không trừ nghỉ trưa), hệ số công = 1, mã công <b>OT</b>. Trạng thái <b>Chờ duyệt</b> (trừ khi tự duyệt).', 'The system creates <b>a separate overtime shift</b>: counted by <b>hours</b>, hours = end − start = <b>2 h</b> (lunch not subtracted), coefficient 1, code <b>OT</b>. Status <b>Pending approval</b> (unless auto-approved).'] },
      { on: 'app', h: 'c-ot', look: true, set: { a: 'mhome', _app: W.mgr }, t: ['Ca OT xuất hiện với <b>viền đỏ</b>, 17:00 → 19:00, Chờ duyệt.', 'The OT shift appears with a <b>red border</b>, 17:00 → 19:00, Pending approval.'] },
      { on: 'app', h: 'noti', look: true, t: ['<b>Quản lý</b> nhận thông báo lịch làm thêm giờ chờ phê duyệt và duyệt như một ca thường (xem "Duyệt lịch làm việc").', 'The <b>manager</b> is notified about the overtime awaiting approval and approves it like any shift (see "Approve work schedule").'] }
    ],
    done: ['Ca OT 2 giờ đã được tạo. Sau khi được duyệt, nhân viên chấm 1 lượt vào/ra cho ca OT; giờ được xác nhận của ca OT được dùng để tính lương tăng ca.', 'A 2-hour OT shift was created. Once approved, the employee clocks one in/out round for it; its confirmed hours are used for overtime pay.'],
    rules: [
      ['Ca OT là một ca riêng, tính theo giờ, hệ số 1, mã công OT.', 'An OT shift is a separate shift, hour-based, coefficient 1, code OT.'],
      ['Giờ OT = giờ kết thúc − giờ bắt đầu (không trừ nghỉ trưa).', 'OT hours = end − start (lunch not subtracted).'],
      ['"Không cần chấm công": coi như đã vào/ra, giờ xác nhận = giờ đăng ký.', '"No clocking needed": counts as clocked, confirmed hours = registered hours.'],
      ['Chỉ đăng ký được vào các thứ đang bật trên mẫu ca OT.', 'Overtime can only be registered on weekdays enabled on the OT template.'],
      ['Trên lịch, ca tăng ca hiển thị viền đỏ.', 'On calendars, overtime shifts have a red border.']
    ]
  });

  /* =====================================================================
     12. CHẤM CÔNG HỘ / THỦ CÔNG (WEB + APP)
     ===================================================================== */
  HDSD.add({
    id: 'proxy', tier: 1, ch: ['web', 'app'], icon: '🧑‍💼',
    title: ['Chấm công hộ / chấm công thủ công', 'Proxy / manual attendance'],
    sum: ['Khi nhân viên quên chấm công, Admin/Quản lý nhập giờ vào/ra thay trên Web, hoặc quản lý chấm hộ trên App. Hai kênh ghi giờ khác nhau.', 'When an employee forgets to clock, Admin/Manager enters in/out times on the Web, or the manager does it in the App. The two channels record times differently.'],
    who: ['Admin / Quản lý', 'Admin / Manager'],
    init: { w: 0, a: 'det', cf: '9', dlg: 0, ok: 0, _web: W.admin, _app: W.mgr },
    web: (s) => K.twsPage({ over: s.w === 2 ? K.modal({ title: t('Chấm công hộ', 'Proxy attendance'), body: K.row(t('Nhân viên', 'Employee'), K.inp('', P.an, { dis: 1 })) + K.row(t('Tên ca', 'Shift'), K.inp('', K.sang(), { dis: 1 })) + K.row(t('Thời gian bắt đầu', 'Start date'), K.inp('', K.d(1), { dis: 1 })) + K.row(t('Giờ vào ca', 'Clock-in time'), K.inp('at-in', '08:00'), 1) + K.row(t('Thời gian kết thúc', 'End date'), K.inp('', K.d(1), { dis: 1 })) + K.row(t('Giờ ra ca', 'Clock-out time'), K.inp('at-out', '17:00')),
        foot: K.btn(t('HỦY', 'CANCEL'), '', 'btn-default') + K.btn(t('LƯU', 'SAVE'), 'save', 'btn-primary') }) : '', rows: [
      { name: P.an, cells: [cell.done(), s.w === 3 ? cell.done({ tm: '08:00 👤 - 17:00 👤', ch: 'tue', isNew: 1 }) : { sn: K.sang(), tm: '--:-- - --:--', col: 'unpaid', st: 'approved', h: 'tue-m', ch: 'tue', menu: s.w === 1 ? K.cmenu(['detail', 'add', 'attend', 'paid', 'unpaid', 'ot', '-', 'del'], 1) : '' }, cell.today(), cell.fut(), cell.fut(), cell.add(), cell.add()] },
      { name: P.binh, cells: [cell.done(), { sn: K.sang(), tm: s.ok ? '08:00 👤 - 17:00 👤' : '--:-- - --:--', col: s.ok ? 'ok' : 'unpaid', st: s.ok ? 'confirmed' : 'approved', isNew: s.ok }, cell.today(), cell.fut(), cell.fut(), cell.add(), cell.add()] }
    ] }),
    app: (s) => s.a === 'cf' ? cfScreen({ who: P.binh + ' · ' + K.d(1) + ' · ' + K.sang(), val: s.cf, proxy: 1, dlg: s.dlg })
      : pgd({ name: P.binh, card: card(1, s.ok ? 'confirmed' : 'approved', s.ok ? { act: '08:00 -> 17:00', coef: 1, h: 'dcard' } : { h: 'dcard' }), conf: s.ok ? '8' : '', total: s.ok ? '8 ' + t('Giờ', 'h') : '', coef: s.ok ? '1' : '', hist: s.ok ? hist1('08:00', '17:00', '8', '👤') : '', bottom: s.ok ? '' : K.abtn(t('Chấm công hộ', 'Proxy attendance'), 'proxy', 'purple') }),
    steps: [
      { on: 'web', h: 'tue-m', set: { w: 1 }, t: ['<b>Web:</b> An quên chấm công ngày Thứ 3 13/10 (ô tím nhạt, chưa có giờ vào/ra). Bấm <b>⋮</b> trên ô.', '<b>Web:</b> An forgot to clock on Tue 13/10 (light purple cell, no in/out). Click <b>⋮</b> on the cell.'],
        rule: ['Mục <b>"Chấm công hộ"</b> hiện khi: ca <b>Đã duyệt</b>, ngày <b>≤ hôm nay</b>, <b>chưa chốt lương</b>, còn <b>thiếu vào hoặc ra</b>, không đánh dấu nghỉ.', '<b>"Proxy attendance"</b> shows when the shift is <b>Approved</b>, the day is <b>≤ today</b>, payroll is <b>not closed</b>, it is <b>missing in or out</b>, and it is not marked as leave.'] },
      { on: 'web', h: 'm-attend', set: { w: 2 }, t: ['Chọn <b>Chấm công hộ</b>.', 'Choose <b>Proxy attendance</b>.'] },
      { on: 'web', h: 'at-in', look: true, t: ['<b>Giờ vào ca</b> mặc định = giờ bắt đầu ca (08:00). Sửa nếu cần.', '<b>Clock-in time</b> defaults to the shift start (08:00). Edit if needed.'] },
      { on: 'web', h: 'at-out', look: true, t: ['<b>Giờ ra ca</b> mặc định = giờ kết thúc ca (17:00).', '<b>Clock-out time</b> defaults to the shift end (17:00).'], rule: ['<b>Để trống</b> giờ ra nếu nhân viên chưa ra ca → hệ thống chỉ ghi giờ vào, ca chưa được xác nhận.', '<b>Leave it empty</b> if the employee has not left yet → only the clock-in is recorded and the shift is not confirmed.'] },
      { on: 'web', h: 'save', set: { w: 3 }, t: ['Bấm <b>LƯU</b>.', 'Click <b>SAVE</b>.'], rule: ['Có giờ ra → ca chuyển <b>Đã xác nhận</b> ngay, giờ công = giờ ra − giờ vào = <b>9 giờ</b> (Web <b>không trừ nghỉ trưa</b>). Không tính số phút đi trễ/về sớm, không kiểm tra wifi/GPS. Lịch sử lưu cả giá trị cũ và mới.', 'With a clock-out → the shift is <b>Confirmed</b> immediately, hours = out − in = <b>9 h</b> (the Web <b>does not subtract lunch</b>). No late/early minutes are computed and wifi/GPS is not checked. History keeps old and new values.'],
        warn: ['Chấm công hộ <b>ghi đè</b> cả giờ vào mà nhân viên đã tự chấm.', 'Proxy attendance <b>overwrites</b> a clock-in the employee already made.'] },
      { on: 'web', h: 'tue', look: true, t: ['Ô đã ghi <b>08:00 👤 – 17:00 👤</b> (biểu tượng 👤 = admin chấm hộ), trạng thái Đã xác nhận. Nhân viên nhận <i>"Lịch làm việc ngày 13/10/2026 của bạn đã được chấm công hộ."</i>', 'The cell shows <b>08:00 👤 – 17:00 👤</b> (👤 = entered by admin), status Confirmed. The employee receives <i>"Lịch làm việc ngày 13/10/2026 của bạn đã được chấm công hộ."</i>'] },
      { on: 'app', h: 'proxy', set: { a: 'cf' }, t: ['<b>App quản lý:</b> mở chi tiết ca Thứ 3 của Bình (Đã duyệt, ngày đã qua) → bấm nút tím <b>Chấm công hộ</b>.', '<b>Manager app:</b> open Bình\'s Tuesday shift (Approved, past day) → tap the purple <b>Proxy attendance</b> button.'],
        rule: ['<b>"Chấm công hộ"</b>: ca Đã duyệt và ngày đã qua. <b>"Chấm công thủ công"</b> (nút trên thẻ ca): ca Đã duyệt, chưa ra ca, đã qua giờ kết thúc ca.', '<b>"Proxy attendance"</b>: Approved shift on a past day. <b>"Manual attendance"</b> (button on the shift card): Approved, not clocked out, past the shift end.'] },
      { on: 'app', h: 'cf-a', type: '8', k: 'cf', t: ['Nhập <b>Thời gian làm việc thực tế</b>: 8 giờ.', 'Enter the <b>Actual working time</b>: 8 hours.'], rule: ['Khác với Web, App không nhập giờ vào/ra mà nhập <b>số giờ làm</b> và chọn <b>mã công</b>.', 'Unlike the Web, the App takes the <b>number of hours</b> and an <b>attendance code</b> rather than in/out times.'] },
      { on: 'app', h: 'cf-c', look: true, t: ['Ô <b>Chấm công</b>: chọn mã công, mặc định <b>"1"</b>.', 'The <b>Attendance code</b> field: defaults to <b>"1"</b>.'], rule: ['Mã công: <b>1</b> (1 công), <b>1/2</b> (nửa công), <b>P</b> (nghỉ phép năm), <b>P/2</b> (nửa phép nửa công), <b>OFF</b> (ngày nghỉ), <b>KL</b> (nghỉ không lương) — mỗi mã kèm hệ số công.', 'Codes: <b>1</b> (one workday), <b>1/2</b> (half), <b>P</b> (annual leave), <b>P/2</b> (half leave half work), <b>OFF</b> (day off), <b>KL</b> (unpaid leave) — each with its coefficient.'] },
      { on: 'app', h: 'cf-save', set: { dlg: 1 }, t: ['Bấm <b>Xác nhận</b>.', 'Tap <b>Confirm</b>.'] },
      { on: 'app', h: 'dyes', set: { dlg: 0, ok: 1, a: 'det' }, t: ['Xác nhận trên hộp thoại.', 'Confirm in the dialog.'], rule: ['Ca chuyển <b>Đã xác nhận</b>. Giờ vào/ra được ghi <b>bằng đúng giờ bắt đầu / kết thúc ca chuẩn</b> (08:00 – 17:00). Nhân viên nhận thông báo đã được chấm công hộ.', 'The shift becomes <b>Confirmed</b>. In/out are recorded <b>exactly as the standard shift start / end</b> (08:00 – 17:00). The employee is notified.'] },
      { on: 'app', h: 'dcard', look: true, t: ['Ca của Bình: Đã xác nhận, 8 giờ, hệ số công 1.', 'Bình\'s shift: Confirmed, 8 hours, coefficient 1.'] }
    ],
    done: ['So sánh: Web nhập giờ vào/ra cụ thể và tính giờ = ra − vào (không trừ nghỉ trưa); App nhập số giờ + mã công và ghi giờ vào/ra theo giờ chuẩn của ca. Cả hai đều đưa ca về Đã xác nhận và gửi thông báo cho nhân viên.', 'Comparison: the Web takes explicit in/out times and computes hours = out − in (lunch not subtracted); the App takes hours + a code and records in/out as the standard shift times. Both end in Confirmed and notify the employee.'],
    rules: [
      ['Web: ca Đã duyệt, ngày ≤ hôm nay, chưa chốt lương, thiếu vào/ra, không đánh dấu nghỉ.', 'Web: Approved shift, day ≤ today, payroll not closed, missing in/out, not marked as leave.'],
      ['Web có giờ ra → Đã xác nhận ngay; giờ = ra − vào, không trừ nghỉ trưa, không tính trễ/sớm.', 'Web with clock-out → Confirmed at once; hours = out − in, lunch not subtracted, no late/early.'],
      ['App: "Chấm công hộ" cho ngày đã qua; "Chấm công thủ công" khi đã qua giờ kết thúc ca mà chưa ra ca.', 'App: "Proxy attendance" for past days; "Manual attendance" once the shift end has passed without clock-out.'],
      ['Chấm công hộ ghi đè giờ nhân viên đã tự chấm; không kiểm tra wifi/GPS.', 'Proxy attendance overwrites the employee\'s own clock-in; wifi/GPS is not checked.'],
      ['Sau khi chốt lương, không chấm công hộ được trên Web.', 'After payroll is closed, proxy attendance on the Web is unavailable.']
    ]
  });

  /* =====================================================================
     13. XÁC NHẬN GIỜ LÀM VIỆC (APP + WEB)
     ===================================================================== */
  HDSD.add({
    id: 'confirm', tier: 1, ch: ['app', 'web'], icon: '🔏',
    title: ['Xác nhận giờ làm việc', 'Confirm working time'],
    sum: ['Sau khi nhân viên ra ca lượt cuối, quản lý chốt số giờ công được xác nhận — con số dùng cho báo cáo và lương. Làm trên App (kèm mã công) hoặc trên Web.', 'After the employee clocks out of the last round, the manager fixes the confirmed hours — the figure used by reports and payroll. Done in the App (with a code) or on the Web.'],
    who: ['Quản lý trực tiếp (hoặc Admin nếu được bật)', 'Direct manager (or Admin if enabled)'],
    init: { a: 'mhome', dlg: 0, ok: 0, w: 0, _app: W.mgr, _web: W.mgr },
    app: (s) => {
      if (s.a === 'mhome') return mgrHome([K.noti(t('Lịch làm việc', 'Work schedule'), K.m('Đang có lịch làm việc ngày 14/10/2026 của Lê Văn An đang chờ xác nhận.', 'The work schedule of Lê Văn An on 14/10/2026 is awaiting confirmation.'), 'noti', 1)], { time: '17:10' });
      if (s.a === 'cf') return cfScreen({ who: P.an + ' · ' + K.d(2) + ' · ' + K.sang(), val: '8.17', dlg: s.dlg });
      return pgd({ time: '17:10', name: P.an, card: card(2, s.ok ? 'confirmed' : 'nc', { act: '07:55 -> 17:05', dur: t('9 Giờ 10 Phút', '9 h 10 min'), coef: s.ok ? 1 : 0, h: 'dcard' }), conf: s.ok ? '8.17' : '', total: '8.17 ' + t('Giờ', 'h'), coef: s.ok ? '1' : '', hist: hist1('07:55', '17:05', '8.17'), bottom: s.ok ? '' : K.abtn(t('Xác nhận thời gian làm việc', 'Confirm working time'), 'conf') });
    },
    web: (s) => K.twsPage({ user: P.mgr + ' (' + t('quản lý', 'manager') + ')', over: s.w === 2 ? K.modal({ size: 'sm', title: t('Xác nhận lịch làm việc', 'Confirm work schedule'), body: '<label>' + t('Giờ làm việc thực tế', 'Actual working hours') + '</label><div style="height:6px"></div>' + K.inp('cfh', '7.97'), foot: K.btn(t('Hủy', 'Cancel'), '', 'btn-default') + K.btn(t('Xác nhận', 'Confirm'), 'wsave', 'btn-primary') }) : '', rows: [
      { name: P.an, cells: [cell.done(), cell.done(), cell.done({ tm: '07:55 📱 - 17:05 📱', st: s.ok ? 'confirmed' : 'nc', ch: 'an-today' }), cell.fut(), cell.fut(), cell.add(), cell.add()] },
      { name: P.binh, cells: [cell.done(), cell.done(), cell.done({ tm: '08:02 📱 - 17:00 📱', st: s.w === 3 ? 'confirmed' : 'nc', h: 'bt', ch: 'b-today', isNew: s.w === 3, menu: s.w === 1 ? K.cmenu(['detail', 'confirm', 'add', 'ot', '-', 'del']) : '' }), cell.fut(), cell.fut(), cell.add(), cell.add()] }
    ] }),
    steps: [
      { on: 'app', h: 'noti', set: { a: 'det' }, t: ['<b>App quản lý:</b> bấm thông báo "đang chờ xác nhận" để mở chi tiết ca của An.', '<b>Manager app:</b> tap the "awaiting confirmation" notification to open An\'s shift.'] },
      { on: 'app', h: 'conf', set: { a: 'cf' }, t: ['Ca đang <b>Chờ xác nhận</b>. Bấm <b>Xác nhận thời gian làm việc</b>.', 'The shift is <b>Pending confirmation</b>. Tap <b>Confirm working time</b>.'], rule: ['Ca chuyển Chờ xác nhận khi nhân viên <b>ra ca ở lượt cuối</b>. Phần Lịch sử vào ra cho thấy từng lượt và giờ công của lượt.', 'A shift becomes Pending confirmation when the employee <b>clocks out of the last round</b>. The In/out history lists each round and its hours.'] },
      { on: 'app', h: 'cf-a', look: true, t: ['<b>Thời gian làm việc thực tế</b> mặc định = giờ thực tế hệ thống đã tính (<b>8.17</b>). Quản lý có thể sửa.', '<b>Actual working time</b> defaults to the hours computed by the system (<b>8.17</b>). The manager may edit it.'], rule: ['Không giới hạn số giờ nhập. Đây là <b>giờ được xác nhận</b> — con số dùng cho báo cáo giờ và lương.', 'There is no limit on the value. This is the <b>confirmed hours</b> — the figure used by hour reports and payroll.'] },
      { on: 'app', h: 'cf-c', look: true, t: ['Ô <b>Chấm công</b>: chọn mã công (mặc định "1").', 'The <b>Attendance code</b> field (default "1").'], rule: ['Mã công: 1, 1/2, P, P/2, OFF, KL — mỗi mã kèm <b>hệ số công</b> sẽ được lưu vào ca.', 'Codes: 1, 1/2, P, P/2, OFF, KL — each carries a <b>coefficient</b> saved on the shift.'] },
      { on: 'app', h: 'cf-save', set: { dlg: 1 }, t: ['Bấm <b>Xác nhận</b>.', 'Tap <b>Confirm</b>.'] },
      { on: 'app', h: 'dyes', set: { dlg: 0, ok: 1, a: 'det' }, t: ['Xác nhận trên hộp thoại.', 'Confirm in the dialog.'], rule: ['Ca chuyển <b>Đã xác nhận</b> (trạng thái cuối), lưu giờ được xác nhận, mã công và hệ số công. Nhân viên nhận <i>"Lịch làm việc ngày … của bạn đã được xác nhận giờ làm."</i>', 'The shift becomes <b>Confirmed</b> (final), saving confirmed hours, code and coefficient. The employee receives <i>"Lịch làm việc ngày … của bạn đã được xác nhận giờ làm."</i>'] },
      { on: 'app', h: 'dcard', look: true, t: ['Ca của An: <b>Đã xác nhận</b>, hệ số công 1. Mẹo: ở màn lịch tuần, lọc "Chờ xác nhận" rồi bấm <b>Xác nhận tất cả</b> để chốt mọi ca với giờ = giờ thực tế.', 'An\'s shift: <b>Confirmed</b>, coefficient 1. Tip: on the weekly screen, filter "Pending confirmation" and tap <b>Confirm all</b> to confirm every shift with hours = actual hours.'] },
      { on: 'web', h: 'bt', set: { w: 1 }, t: ['<b>Web:</b> ca hôm nay của Bình cũng đang Chờ xác nhận. Bấm <b>⋮</b> trên ô.', '<b>Web:</b> Bình\'s shift today is also Pending confirmation. Click <b>⋮</b> on the cell.'], rule: ['Mục <b>"Confirm working time"</b> hiện khi ca <b>Chờ xác nhận</b>, không đánh dấu nghỉ, và người dùng là <b>quản lý trực tiếp</b> hoặc <b>Admin</b> (khi bật "Cho phép Admin xác nhận ca làm việc").', '<b>"Confirm working time"</b> shows when the shift is <b>Pending confirmation</b>, not marked as leave, and the user is the <b>direct manager</b> or an <b>Admin</b> (when "Allow Admin to confirm working time" is on).'] },
      { on: 'web', h: 'm-confirm', set: { w: 2 }, t: ['Chọn <b>Confirm working time</b>.', 'Choose <b>Confirm working time</b>.'] },
      { on: 'web', h: 'cfh', look: true, t: ['Ô <b>Giờ làm việc thực tế</b> mặc định = giờ thực tế (08:02 → 17:00, trừ 1 giờ nghỉ trưa = 7.97).', 'The <b>Actual working hours</b> field defaults to the actual hours (08:02 → 17:00 minus 1 h lunch = 7.97).'], rule: ['Trên Web <b>không chọn mã công</b>, chỉ nhập số giờ.', 'The Web has <b>no attendance code</b>; only hours are entered.'] },
      { on: 'web', h: 'wsave', set: { w: 3 }, t: ['Bấm <b>Xác nhận</b>.', 'Click <b>Confirm</b>.'], rule: ['Ca → <b>Đã xác nhận</b>. Web có kiểm tra quyền: không phải quản lý trực tiếp/Admin được phép → <i>"Bạn không có quyền xác nhận ca làm việc này"</i>.', 'Shift → <b>Confirmed</b>. The Web checks permission: neither direct manager nor an allowed Admin → <i>"Bạn không có quyền xác nhận ca làm việc này"</i>.'] },
      { on: 'web', h: 'b-today', look: true, t: ['Ô ca của Bình đã <b>Đã xác nhận</b>. Từ đây nếu nhân viên bấm chấm công nữa thì dữ liệu ca không thay đổi.', 'Bình\'s cell is now <b>Confirmed</b>. From here, further clocking by the employee does not change the shift data.'] }
    ],
    done: ['Hai ca đã được chốt giờ. "Tổng giờ làm" trên Bảng chấm công và phần tính lương lấy đúng con số giờ được xác nhận này.', 'Both shifts have confirmed hours. "Total hours" in the Timesheet and payroll use exactly these confirmed hours.'],
    rules: [
      ['Chờ xác nhận xuất hiện khi nhân viên ra ca lượt cuối (hoặc ca 0 lượt chấm được duyệt bằng "Duyệt tất cả").', 'Pending confirmation appears after the last-round clock-out (or when a 0-round shift is approved via "Approve all").'],
      ['Giờ được xác nhận mặc định = giờ thực tế; quản lý được sửa, không giới hạn.', 'Confirmed hours default to actual hours; the manager may edit them without limit.'],
      ['App lưu thêm mã công + hệ số công; Web chỉ lưu giờ.', 'The App also saves code + coefficient; the Web saves hours only.'],
      ['Web: chỉ quản lý trực tiếp, hoặc Admin khi cấu hình cho phép.', 'Web: only the direct manager, or Admin when the setting allows it.'],
      ['Đã xác nhận là trạng thái cuối của ca.', 'Confirmed is the final shift status.']
    ]
  });

  /* =====================================================================
     14. BẢNG CHẤM CÔNG (WEB)
     ===================================================================== */
  const calCell = (d, col, ot) => '<td style="height:52px"><div class="cell' + (K.COL[col].dark ? ' dark' : '') + (ot ? ' ot' : '') + '" style="min-height:44px;background:' + K.COL[col].c + '"><b>' + d + '</b><div>' + K.sang() + '</div></div></td>';
  HDSD.add({
    id: 'timesheet', tier: 1, ch: ['web'], icon: '📊',
    title: ['Bảng chấm công tổng hợp', 'Timesheet summary'],
    sum: ['Xem tổng hợp công theo tuần hoặc tháng cho từng nhân viên, mở lịch chấm công tháng của một người và xuất Excel.', 'View weekly or monthly attendance totals per employee, open one person\'s monthly attendance calendar and export to Excel.'],
    who: ['Admin / HR / Quản lý', 'Admin / HR / Manager'],
    init: { m: 0, det: 0 },
    web: (s) => K.web({ nav: 'tk', body: K.portlet(s.det ? t('Chi tiết chấm công', 'Attendance details') + ' — ' + P.an + ' — ' + t('Tháng 10/2026', 'October 2026') : t('Chấm công', 'Timesheet'), K.btn('Export', 'export'),
      s.det ? '<table class="grid-tws" data-h="cal"><thead><tr>' + [0, 1, 2, 3, 4, 5, 6].map((i) => '<th>' + K.dn(i) + '</th>').join('') + '</tr></thead><tbody><tr>' + [5, 6, 7, 8, 9].map((d, i) => calCell(d, i === 3 ? 'late' : 'ok')).join('') + '<td></td><td></td></tr><tr>' + calCell(12, 'ok') + calCell(13, 'ok') + calCell(14, 'ok') + calCell(15, 'future') + calCell(16, 'future', 1) + '<td></td><td></td></tr><tr>' + [19, 20, 21, 22, 23].map((d, i) => calCell(d, i === 1 ? 'paid' : 'future')).join('') + '<td></td><td></td></tr></tbody></table>' + K.legend()
        : K.filter([t('Chọn chi nhánh', 'Branch'), t('Chọn phòng ban', 'Department'), t('Chọn nhân viên', 'Employee'), '2026', K.sel('ftype', s.m ? t('Theo tháng', 'By month') : t('Theo tuần', 'By week'), { w: 140 }), '<div class="fc sel" style="width:230px">' + (s.m ? t('Tháng 10', 'October') : K.wk()) + '</div>']) +
          K.table([t('Nhân viên', 'Employee'), t('Tổng ca làm', 'Shifts'), t('Tổng ca tăng ca', 'OT shifts'), { h: 'h-cong', l: t('Tổng số công', 'Workdays') }, t('Giờ làm yêu cầu tối thiểu', 'Min hours'), { h: 'h-hours', l: t('Tổng giờ làm', 'Total hours') }, t('Tổng giờ tăng ca', 'OT hours'), { h: 'h-late', l: t('Số lần đi trễ', 'Late count') }, t('Số lần về sớm', 'Early count'), { h: 'h-unpaid', l: t('Số ca nghỉ không lương', 'Unpaid leave') }, t('Số ca nghỉ có lương', 'Paid leave')],
            s.m ? [['<a href="#" data-h="nm-an">' + P.an + '</a><br><small>' + K.br1() + '</small>', '16', '1', '<b>8</b>', '128', '64.17', '0', '2', '1', '0', '1'], ['<a href="#">' + P.binh + '</a><br><small>' + K.br1() + '</small>', '15', '0', '<b>8</b>', '120', '63.97', '0', '3', '0', '1', '0']]
              : [['<a href="#" data-h="nm-an">' + P.an + '</a><br><small>' + K.br1() + '</small>', '5', '0', '<b>3</b>', '40', '24.17', '0', '1', '0', '0', '0'], ['<a href="#">' + P.binh + '</a><br><small>' + K.br1() + '</small>', '5', '0', '<b>3</b>', '40', '23.97', '0', '1', '0', '0', '0']], 'tbl')) }),
    steps: [
      { on: 'web', h: 'tbl', look: true, t: ['Mở <b>Chấm công → Bảng chấm công</b>. Mỗi dòng là một nhân viên; lọc theo Chi nhánh (trực thuộc của nhân viên), Phòng ban, Nhân viên, Năm, Theo tuần/tháng, Kỳ.', 'Open <b>Timekeeping → Timesheet</b>. One row per employee; filter by Branch (the employee\'s own), Department, Employee, Year, Week/Month, Period.'], rule: ['<b>Tổng ca làm</b> = số ca được xếp trong kỳ, <b>mọi trạng thái, kể cả ca tương lai</b>. Tổng ca tăng ca = số ca tăng ca.', '<b>Shifts</b> = shifts scheduled in the period, <b>any status, including future ones</b>. OT shifts = number of overtime shifts.'] },
      { on: 'web', h: 'h-cong', look: true, t: ['Cột <b>Tổng số công</b>.', 'The <b>Workdays</b> column.'], rule: ['= tổng <b>hệ số công</b> của các ca có <b>đủ cả vào và ra</b>. Ca chưa ra ca hoặc chưa chấm thì chưa được cộng.', '= sum of the <b>coefficients</b> of shifts having <b>both in and out</b>. Shifts not clocked out or not clocked are not added.'] },
      { on: 'web', h: 'h-hours', look: true, t: ['Cột <b>Tổng giờ làm</b>.', 'The <b>Total hours</b> column.'], rule: ['= tổng <b>giờ được xác nhận</b> (không phải giờ thực tế). Ca chưa được quản lý xác nhận thì chưa có giờ ở đây. Tổng giờ tăng ca = giờ được xác nhận của ca tăng ca. "Giờ làm yêu cầu tối thiểu" = tổng giờ tối thiểu của các ca.', '= sum of <b>confirmed hours</b> (not actual hours). Shifts not yet confirmed contribute nothing. OT hours = confirmed hours of OT shifts. "Min hours" = sum of the shifts\' minimum hours.'] },
      { on: 'web', h: 'h-late', look: true, t: ['Cột <b>Số lần đi trễ / về sớm</b>.', 'The <b>Late / Early count</b> columns.'], rule: ['= số ca có số phút trễ/sớm <b>> 0</b>. Không xét ngưỡng cấu hình và không xét đơn xin trễ/sớm đã duyệt — nên trễ 5 phút vẫn được đếm.', '= shifts whose late/early minutes are <b>> 0</b>. Thresholds and approved late/early requests are ignored — 5 minutes late is still counted.'] },
      { on: 'web', h: 'h-unpaid', look: true, t: ['Cột <b>Số ca nghỉ không lương / có lương</b>.', 'The <b>Unpaid / Paid leave</b> columns.'], rule: ['<b>Không lương</b> = ca đã qua, không vào/ra, đánh dấu không lương <b>+</b> ca trễ/sớm vượt ngưỡng "tính nghỉ không lương". <b>Có lương</b> = ca đã qua, không vào/ra, đánh dấu có lương.', '<b>Unpaid</b> = past shifts with no in/out marked unpaid <b>+</b> shifts late/early beyond the "unpaid leave" thresholds. <b>Paid</b> = past shifts with no in/out marked paid.'] },
      { on: 'web', h: 'ftype', set: { m: 1 }, t: ['Đổi bộ lọc sang <b>Theo tháng</b> để xem cả tháng 10.', 'Switch the filter to <b>By month</b> to see all of October.'] },
      { on: 'web', h: 'nm-an', set: { det: 1 }, t: ['Bấm vào <b>tên nhân viên</b> để mở lịch chấm công tháng của người đó.', 'Click the <b>employee name</b> to open that person\'s monthly attendance calendar.'], warn: ['Hãy chuyển sang <b>Theo tháng</b> trước khi bấm tên để mở đúng tháng.', 'Switch to <b>By month</b> before clicking the name so the right month opens.'] },
      { on: 'web', h: 'cal', look: true, t: ['Lịch tháng dạng lưới Thứ 2 → Chủ nhật; mỗi ô tô màu theo quy tắc phân loại (đúng giờ, trễ/sớm, nghỉ…), ca tăng ca có viền đỏ.', 'A Mon → Sun monthly grid; each cell is coloured by the classification rules (on time, late/early, leave…), overtime has a red border.'], rule: ['Mỗi ô có menu thao tác giống màn Lịch làm việc (chi tiết, chấm công hộ, nghỉ có/không lương…).', 'Each cell has the same action menu as the Work schedule screen (details, proxy attendance, paid/unpaid leave…).'] },
      { on: 'web', h: 'export', look: true, t: ['Nút <b>Export</b> xuất bảng tổng hợp ra Excel.', 'The <b>Export</b> button exports the summary to Excel.'], rule: ['Cột Excel: Mã NV, Họ tên, Email, <b>Ngày công chuẩn</b> (= số ca được xếp), Số ngày có checkin, Quên checkin, Nghỉ phép có lương, Nghỉ phép không lương, Số ngày đi trễ, Số ngày về sớm, <b>Tổng thời gian làm việc thực tế</b> (= giờ được xác nhận).', 'Excel columns: Employee code, Name, Email, <b>Standard workdays</b> (= scheduled shifts), Days with check-in, Missed check-in, Paid leave, Unpaid leave, Late days, Early days, <b>Total actual working time</b> (= confirmed hours).'] }
    ],
    done: ['Bạn đã đọc được các chỉ số chính: Tổng số công (hệ số của ca đủ vào/ra), Tổng giờ làm (giờ được xác nhận), số lần trễ/sớm và số ca nghỉ.', 'You can now read the key figures: Workdays (coefficients of shifts with in and out), Total hours (confirmed hours), late/early counts and leave shifts.'],
    rules: [
      ['Tổng số công = Σ hệ số công của ca đủ vào + ra.', 'Workdays = Σ coefficients of shifts with both in and out.'],
      ['Tổng giờ làm = Σ giờ được xác nhận.', 'Total hours = Σ confirmed hours.'],
      ['Số lần trễ/sớm đếm mọi ca có trễ/sớm > 0 phút.', 'Late/early counts include every shift with > 0 minutes.'],
      ['Bộ lọc Chi nhánh là chi nhánh trực thuộc của nhân viên.', 'The Branch filter is the employee\'s home branch.']
    ]
  });

  /* =====================================================================
     15. LIÊN KẾT SANG LƯƠNG
     ===================================================================== */
  const SAL = () => [
    [t('Không vào và không ra, đánh dấu <b>nghỉ có lương</b>', 'No in and no out, marked <b>paid leave</b>'), t('Ngày nghỉ có lương: +1 ngày, + giờ của ca, + hệ số công', 'Paid leave day: +1 day, + shift hours, + coefficient')],
    [t('Không vào và không ra, các trường hợp còn lại', 'No in and no out, all other cases'), t('Ngày nghỉ <b>không lương</b>', '<b>Unpaid</b> leave day')],
    [t('Có vào hoặc ra, là ca <b>tăng ca</b>', 'Has in or out, an <b>overtime</b> shift'), t('Ca OT: giờ OT += giờ được xác nhận × hệ số công', 'OT shift: OT hours += confirmed hours × coefficient')],
    [t('Có vào hoặc ra, ca thường', 'Has in or out, a regular shift'), t('Ngày công: +1, + giờ được xác nhận, + hệ số công', 'Workday: +1, + confirmed hours, + coefficient')],
    [t('Có trễ/sớm <b>chưa được duyệt</b>', 'Late/early <b>not approved</b>'), t('Cộng vào số lần / số phút đi trễ, về sớm', 'Added to late / early counts and minutes')],
    [t('<b>Lương theo tháng</b>', '<b>Monthly salary</b>'), t('Lương tháng − (lương tháng ÷ tổng số ngày [công + nghỉ có lương + nghỉ không lương]) × số ngày nghỉ không lương', 'Monthly salary − (monthly salary ÷ total days [work + paid leave + unpaid leave]) × unpaid leave days')],
    [t('<b>Lương theo giờ</b>', '<b>Hourly salary</b>'), t('Đơn giá giờ ngày thường × (giờ công thường + giờ nghỉ có lương) + phần Thứ 7 / Chủ nhật / lễ', 'Weekday hourly rate × (regular hours + paid-leave hours) + Saturday / Sunday / holiday part')],
    [t('<b>Lương theo ca</b>', '<b>Per-shift salary</b>'), t('Đơn giá ngày thường × tổng hệ số công + phần Thứ 7 / Chủ nhật / lễ × hệ số tương ứng', 'Weekday rate × total coefficient + Saturday / Sunday / holiday part × its coefficient')],
    [t('<b>Tổng thực lĩnh</b>', '<b>Net pay</b>'), t('Lương chính + Phụ cấp + Thưởng + Tăng ca − Phạt', 'Base pay + Allowances + Rewards + Overtime − Fines')]
  ];
  HDSD.add({
    id: 'salary', tier: 1, ch: ['web'], icon: '💰',
    title: ['Dữ liệu chấm công đi vào lương thế nào', 'How attendance data feeds payroll'],
    sum: ['Module Lương nhân viên đọc dữ liệu ca (giờ được xác nhận, hệ số công, đánh dấu nghỉ, tăng ca, trễ/sớm, thưởng/phạt) để tính lương theo tuần hoặc tháng. Phần này là sơ đồ giải thích, không phải màn hình thao tác.', 'The Staff payroll module reads shift data (confirmed hours, coefficient, leave marks, overtime, late/early, rewards/fines) to compute weekly or monthly pay. This is an explanatory diagram, not an operational screen.'],
    who: ['HR / Kế toán', 'HR / Accounting'],
    init: { n: 0 },
    web: (s) => K.web({ nav: 'tk', body: K.portlet(t('Chấm công → Lương nhân viên', 'Timekeeping → Staff payroll'), '',
      '<div class="filter" data-h="intro">' + t('Mỗi ca của nhân viên trong kỳ được <b>phân loại</b>, sau đó tách theo loại ngày: <b>Ngày lễ &gt; Thứ 7 &gt; Chủ nhật &gt; Ngày thường</b>.', 'Each shift in the period is <b>classified</b>, then split by day type: <b>Holiday &gt; Saturday &gt; Sunday &gt; Weekday</b>.') + '</div>' +
      '<div class="board">' + SAL().map((r, i) => (i === 5 ? '<div style="font-weight:600;color:#3f4047;margin-top:6px">' + t('Công thức theo loại lương của nhân viên', 'Formula by the employee\'s salary type') + '</div>' : '') + '<div class="bx' + (i < s.n ? ' on' : '') + '" data-h="b' + (i + 1) + '"><div class="a">' + r[0] + '</div><div class="ar">→</div><div class="b">' + r[1] + '</div></div>').join('') + '</div>') }),
    steps: [
      { on: 'web', h: 'intro', look: true, set: { n: 1 }, t: ['Lương được tính theo <b>tuần</b> hoặc <b>tháng</b> tuỳ cấu hình kỳ trả lương của từng nhân viên, sau đó bảng lương được <b>Chốt</b>.', 'Pay is computed per <b>week</b> or <b>month</b> according to each employee\'s pay period, and the payroll is then <b>Closed</b>.'], rule: ['Mỗi nhóm kết quả được tách theo loại ngày với thứ tự ưu tiên: Ngày lễ > Thứ 7 > Chủ nhật > Ngày thường.', 'Each result group is split by day type in priority order: Holiday > Saturday > Sunday > Weekday.'] },
      { on: 'web', h: 'b1', look: true, set: { n: 2 }, t: ['Ca <b>không vào, không ra</b> và được đánh dấu <b>nghỉ có lương</b> → tính là ngày nghỉ có lương.', 'A shift with <b>no in, no out</b> marked <b>paid leave</b> → counted as a paid leave day.'], rule: ['Cộng 1 ngày, cộng giờ của ca và hệ số công của ca.', 'Adds 1 day, the shift\'s hours and its coefficient.'] },
      { on: 'web', h: 'b2', look: true, set: { n: 3 }, t: ['Ca không vào, không ra mà <b>không</b> đánh dấu nghỉ có lương → <b>nghỉ không lương</b>.', 'A shift with no in, no out that is <b>not</b> marked paid leave → <b>unpaid leave</b>.'] },
      { on: 'web', h: 'b3', look: true, set: { n: 4 }, t: ['Ca <b>tăng ca</b> có vào hoặc ra → cộng vào giờ OT.', 'An <b>overtime</b> shift with in or out → added to OT hours.'], rule: ['Giờ OT += <b>giờ được xác nhận × hệ số công</b>. Tiền tăng ca = đơn giá OT × giờ OT (cộng phần Thứ 7 / Chủ nhật / lễ).', 'OT hours += <b>confirmed hours × coefficient</b>. Overtime pay = OT rate × OT hours (plus Saturday / Sunday / holiday parts).'] },
      { on: 'web', h: 'b4', look: true, set: { n: 5 }, t: ['Ca thường có vào hoặc ra → tính là <b>ngày công</b>.', 'A regular shift with in or out → counted as a <b>workday</b>.'], rule: ['Cộng 1 ngày công, cộng <b>giờ được xác nhận</b> và <b>hệ số công</b> — vì vậy bước "Xác nhận giờ làm việc" rất quan trọng.', 'Adds 1 workday, the <b>confirmed hours</b> and the <b>coefficient</b> — which is why "Confirm working time" matters.'] },
      { on: 'web', h: 'b5', look: true, set: { n: 6 }, t: ['Ca có trễ/sớm <b>chưa được duyệt</b> → cộng vào số lần / số phút đi trễ, về sớm.', 'A shift with <b>unapproved</b> late/early → added to the late / early counts and minutes.'], rule: ['Ca đã được <b>duyệt xin đi trễ / về sớm</b> thì không bị tính.', 'Shifts with an <b>approved late / early request</b> are excluded.'] },
      { on: 'web', h: 'b6', look: true, set: { n: 7 }, t: ['Nhân viên hưởng <b>lương tháng</b>: bị trừ theo số ngày nghỉ không lương.', '<b>Monthly-salary</b> employees: deducted by unpaid leave days.'] },
      { on: 'web', h: 'b7', look: true, set: { n: 8 }, t: ['Nhân viên hưởng <b>lương theo giờ</b>: nhân đơn giá giờ với giờ công.', '<b>Hourly</b> employees: hourly rate multiplied by hours.'], rule: ['Phần Thứ 7 / Chủ nhật / lễ tính theo đơn giá tiền riêng hoặc % của đơn giá ngày thường.', 'Saturday / Sunday / holiday parts use their own rate or a % of the weekday rate.'] },
      { on: 'web', h: 'b8', look: true, set: { n: 9 }, t: ['Nhân viên hưởng <b>lương theo ca</b>: nhân đơn giá với tổng hệ số công.', '<b>Per-shift</b> employees: rate multiplied by the total coefficient.'] },
      { on: 'web', h: 'b9', look: true, t: ['<b>Tổng thực lĩnh</b> = Lương chính + Phụ cấp + Thưởng + Tăng ca − Phạt.', '<b>Net pay</b> = Base pay + Allowances + Rewards + Overtime − Fines.'], rule: ['Thưởng / Phạt là các khoản gán theo từng ngày công trong popup Chi tiết ngày làm việc (xem hướng dẫn "Thưởng – Phạt").', 'Rewards / Fines are the amounts assigned per workday in the Day details popup (see the "Rewards – Fines" guide).'] }
    ],
    done: ['Để lương đúng, trước khi chốt lương cần: xác nhận giờ cho mọi ca, xử lý ca quên chấm công (chấm công hộ), đánh dấu nghỉ có/không lương và duyệt các đơn trễ/sớm hợp lệ.', 'For correct pay, before closing payroll: confirm hours for every shift, fix missed clock-ins (proxy attendance), mark paid/unpaid leave and approve valid late/early requests.'],
    rules: [
      ['Lương dùng giờ được xác nhận và hệ số công của ca.', 'Payroll uses the shift\'s confirmed hours and coefficient.'],
      ['Ca không vào/không ra: có lương nếu được đánh dấu nghỉ có lương, còn lại là không lương.', 'No in/out: paid if marked paid leave, otherwise unpaid.'],
      ['Ca được duyệt xin trễ/sớm không tính vào số lần / số phút trễ, sớm.', 'Shifts with approved late/early requests are not counted as late/early.'],
      ['Loại ngày: Ngày lễ > Thứ 7 > Chủ nhật > Ngày thường.', 'Day type: Holiday > Saturday > Sunday > Weekday.'],
      ['Sau khi chốt lương, ca trong kỳ bị khoá Chỉnh sửa, Chấm công hộ, Nghỉ có/không lương.', 'After payroll is closed, shifts in the period lock Edit, Proxy attendance and Paid/Unpaid leave.']
    ]
  });
})();
