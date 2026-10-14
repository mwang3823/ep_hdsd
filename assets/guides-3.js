/* ===== TIER 3 — Chức năng bổ trợ: tra cứu, báo cáo, thiết lập phụ ===== */
(function () {
  const K = HDSD.K, t = K.t;
  const W = K.WHO;
  const TM = '08:00 - 17:00';
  const mgrUser = () => K.P.mgr + ' (' + t('Quản lý', 'Manager') + ')';
  const hNote = (vi, en) => '<div class="wnote">' + t(vi, en) + '</div>';
  const binhRow = () => ({ name: K.P.binh, cells: [
    { h: 'c-b-0', sn: K.sang(), tm: '07:57 - 17:01', col: 'ok', st: 'confirmed' }, { h: 'c-b-1', sn: K.sang(), tm: '07:59 - 17:00', col: 'ok', st: 'nc' },
    { h: 'c-b-2', sn: K.sang(), tm: '07:56 - --:--', col: 'miss', st: 'approved' }, { h: 'c-b-3', sn: K.sang(), tm: TM, col: 'future', st: 'approved' }, null, null, null] });

  /* ---------- 1. Chi tiết ngày làm việc ---------- */
  HDSD.add({
    id: 'detail-day', tier: 3, ch: ['web'], icon: '🔎',
    title: ['Xem chi tiết ngày làm việc', 'View work-day details'],
    sum: ['Mở popup "Chi tiết ngày làm việc" của một ca để xem thông tin ca, công việc, thưởng/phạt và lịch sử chấm công (ai chấm, giá trị cũ).', 'Open the "Work-day details" popup of a shift to see shift info, tasks, rewards/fines and the attendance history (who clocked, old values).'],
    who: ['Admin / HR / Quản lý', 'Admin / HR / Manager'],
    init: { _web: W.admin, menu: 0, modal: 0, tab: 'work' },
    web: (s) => {
      const tabs = K.tabs([[t('Danh sách công việc', 'Task list'), 'tab-work', s.tab === 'work'], [t('Thưởng', 'Rewards'), 'tab-reward', s.tab === 'reward'], [t('Phạt vi phạm', 'Fines'), 'tab-fine', s.tab === 'fine'], [t('Lịch sử chấm công', 'Attendance history'), 'tab-hist', s.tab === 'hist']]);
      const empty = (n) => [[{ v: '<span style="color:#999">' + t('Chưa có dữ liệu', 'No data') + '</span>', h: 'empty' }].concat(new Array(n - 1).fill(''))];
      let tb = '';
      if (s.tab === 'work') tb = '<div data-h="pane">' + K.table(['#', t('Công việc trong ngày', 'Tasks of the day'), t('Trạng thái', 'Status')], empty(3)) + '</div>';
      if (s.tab === 'reward') tb = '<div data-h="pane">' + K.btn('+ ' + t('Thêm hình thức thưởng', 'Add reward'), 'add-reward', 'btn-primary btn-sm') + '<div style="height:8px"></div>' + K.table(['#', t('Hình thức thưởng', 'Reward type'), t('Mức áp dụng', 'Amount'), ''], [['1', t('Thưởng chuyên cần', 'Diligence bonus'), '100,000', '🗑']]) + '</div>';
      if (s.tab === 'fine') tb = '<div data-h="pane">' + K.btn('+ ' + t('Thêm hình thức phạt', 'Add fine'), 'add-fine', 'btn-primary btn-sm') + '<div style="height:8px"></div>' + K.table(['#', t('Hình thức phạt', 'Fine type'), t('Mức áp dụng', 'Amount'), ''], empty(4)) + '</div>';
      if (s.tab === 'hist') tb = '<div data-h="pane">' + K.table(['', t('Giá trị hiện tại', 'Current value'), t('Giá trị cũ', 'Old value')], [
        [t('Giờ vào ca', 'Clock-in'), '<b>13/10/2026 08:00</b> 👤', '<s style="color:#999">13/10/2026 08:05 📱</s>'],
        [t('Giờ ra ca', 'Clock-out'), '<b>13/10/2026 17:00</b> 👤', '<span style="color:#999">—</span>']]) +
        '<div style="margin-top:8px;font-size:11.5px;color:#6b6f80">📱 ' + t('nhân viên tự chấm', 'clocked by the employee') + ' &nbsp;·&nbsp; 👤 ' + t('admin chấm hộ', 'entered by an admin (proxy)') + '</div></div>';
      const body = '<div class="kvg" data-h="info">' + [[t('Tên nhân viên', 'Employee'), K.P.an], [t('Tên ca làm', 'Shift'), K.sang()], [t('Giờ làm', 'Working hours'), '8 ' + t('giờ', 'h')], [t('Hệ số công', 'Work coefficient'), '1'], [t('Ngày làm', 'Work date'), K.d(1)], [t('Vị trí làm', 'Work location'), K.br1()],
        [t('Số giờ làm tối thiểu tính đủ công', 'Minimum hours for a full work unit'), '8'], [t('Tăng ca', 'Overtime'), '—'], [t('Tính tăng ca theo', 'Overtime counted by'), '—']].map(([k, v]) => K.kv(k, v)).join('') + '</div><div style="height:12px"></div>' + tabs + tb;
      const over = s.modal ? K.modal({ title: t('Chi tiết ngày làm việc', 'Work-day details'), size: 'lg', body, foot: K.btn(t('HỦY', 'CANCEL'), 'm-close', 'btn-default') }) : '';
      return K.twsPage({ over, rows: [{ name: K.P.an, cells: [
        { h: 'c-an-0', sn: K.sang(), tm: '08:02 - 17:05', col: 'ok', st: 'confirmed' },
        { h: 'c-an-1', sn: K.sang(), tm: '08:00 - 17:00', col: 'ok', st: 'confirmed', menu: s.menu ? K.cmenu(['detail', 'add', 'ot', '-', 'del']) : '' },
        { h: 'c-an-2', sn: K.sang(), tm: '--:-- - --:--', col: 'miss', st: 'approved' }, { h: 'c-an-3', sn: K.sang(), tm: TM, col: 'future', st: 'approved' }, { add: 'add-an-4' }, null, null] }, binhRow()] });
    },
    steps: [
      { on: 'web', h: 'c-an-1', t: ['Tại màn <b>Lịch làm việc theo nhân viên</b>, bấm dấu <b>⋮</b> ở ô ca cần xem (Lê Văn An, Thứ 3 13/10).', 'On the <b>Work schedule by employee</b> screen, click <b>⋮</b> on the shift cell you want to inspect (Lê Văn An, Tue 13/10).'], set: { menu: 1 } },
      { on: 'web', h: 'm-detail', t: ['Chọn <b>Chi tiết</b>.', 'Choose <b>Details</b>.'], rule: ['Mục "Chi tiết" luôn có trong menu ô ca, không phụ thuộc trạng thái ca.', 'The "Details" item is always present in the cell menu regardless of the shift status.'], set: { menu: 0, modal: 1 } },
      { on: 'web', h: 'info', look: true, t: ['Phần trên là thông tin ca <b>chỉ xem</b>: Tên NV, Ca, Giờ làm, Hệ số công, Ngày, Vị trí, Giờ tối thiểu, Tăng ca, Tính tăng ca theo.', 'The upper part is <b>read-only</b> shift info: employee, shift, hours, coefficient, date, location, minimum hours, overtime and how overtime is counted.'], rule: ['Muốn sửa các thông tin này phải dùng mục "Chỉnh sửa" (chỉ có khi ngày ≥ hôm nay, chưa chốt lương, chưa vào ca).', 'To change these values use "Edit" (only available when the date is today or later, payroll is not closed and the employee has not clocked in).'] },
      { on: 'web', h: 'pane', look: true, t: ['Tab <b>Danh sách công việc</b>: các công việc trong ngày của nhân viên.', 'Tab <b>Task list</b>: the employee\'s tasks for that day.'] },
      { on: 'web', h: 'tab-reward', t: ['Bấm tab <b>Thưởng</b>.', 'Click the <b>Rewards</b> tab.'], set: { tab: 'reward' } },
      { on: 'web', h: 'pane', look: true, t: ['Danh sách khoản thưởng đã gán cho ngày công này: hình thức (lấy từ danh mục Thưởng – Phạt) và <b>Mức áp dụng</b> (số tiền).', 'Rewards assigned to this work day: the type (from the Reward – Fine catalogue) and the <b>Amount</b>.'], rule: ['Các khoản thưởng được cộng, khoản phạt bị trừ vào lương của kỳ đó. Tắt/xoá một mục trong danh mục không loại bỏ các khoản đã gán.', 'Rewards are added to and fines deducted from that period\'s salary. Disabling/deleting a catalogue item does not remove amounts already assigned.'] },
      { on: 'web', h: 'tab-fine', t: ['Bấm tab <b>Phạt vi phạm</b> để xem các khoản phạt (cách dùng giống tab Thưởng).', 'Click the <b>Fines</b> tab to see fines (works like the Rewards tab).'], set: { tab: 'fine' } },
      { on: 'web', h: 'tab-hist', t: ['Bấm tab <b>Lịch sử chấm công</b>.', 'Click the <b>Attendance history</b> tab.'], set: { tab: 'hist' } },
      { on: 'web', h: 'pane', look: true, t: ['Xem giờ vào/ra hiện tại và nguồn chấm: <b>📱 nhân viên tự chấm</b>, <b>👤 admin chấm hộ</b>. Dòng <s>gạch ngang</s> là giá trị cũ trước khi bị sửa.', 'See the current in/out times and their source: <b>📱 clocked by the employee</b>, <b>👤 entered by an admin</b>. A <s>struck-through</s> value is the old one before it was changed.'], rule: ['Ví dụ: An tự chấm vào 08:05 rồi quên ra ca; Admin chấm công hộ 08:00 – 17:00 → chấm công hộ ghi đè cả giờ vào nhân viên đã tự chấm, giá trị cũ được lưu lại ở đây.', 'Example: An clocked in at 08:05 and forgot to clock out; an admin entered 08:00 – 17:00 by proxy → proxy attendance overwrites the employee\'s own clock-in, and the old value is kept here.'] }
    ],
    done: ['Bạn đã biết cách mở popup Chi tiết ngày làm việc và đọc 4 tab của nó.', 'You now know how to open the Work-day details popup and read its 4 tabs.'],
    rules: [
      ['Popup chỉ để xem thông tin ca; riêng tab Thưởng / Phạt vi phạm cho phép thêm, xoá khoản thưởng/phạt theo ngày.', 'The popup is read-only for shift info; only the Rewards / Fines tabs allow adding or deleting daily rewards/fines.'],
      ['Lịch sử chấm công cho biết nguồn: 📱 nhân viên tự chấm, 👤 admin chấm hộ; dòng gạch ngang là giá trị cũ.', 'Attendance history shows the source: 📱 employee, 👤 admin proxy; struck-through rows are old values.'],
      ['Chấm công hộ ghi đè cả giờ vào nhân viên đã tự chấm.', 'Proxy attendance overwrites the clock-in the employee made.']
    ]
  });

  /* ---------- 2. Xoá ca của nhân viên ---------- */
  HDSD.add({
    id: 'delete-shift', tier: 3, ch: ['web'], icon: '🗑',
    title: ['Xoá ca của nhân viên', 'Delete an employee\'s shift'],
    sum: ['Xoá một ca đã xếp cho nhân viên trên lưới Lịch làm việc. Chỉ nên xoá ca chưa có dữ liệu chấm công.', 'Delete a shift assigned to an employee on the Work schedule grid. Only delete shifts that have no attendance data yet.'],
    who: ['Admin / HR', 'Admin / HR'],
    init: { _web: W.admin, menu: 0, ask: 0, gone: 0 },
    web: (s) => K.twsPage({ over: s.ask ? K.swalQ(K.m('Bạn có muốn xóa không?', 'Do you want to delete?'), 'yes') : '', rows: [{ name: K.P.an, cells: [
      { h: 'c-an-0', sn: K.sang(), tm: '08:02 - 17:05', col: 'ok', st: 'confirmed' }, { h: 'c-an-1', sn: K.sang(), tm: '07:58 - 17:00', col: 'ok', st: 'nc' },
      { h: 'c-an-2', sn: K.sang(), tm: '--:-- - --:--', col: 'miss', st: 'approved' }, { h: 'c-an-3', sn: K.sang(), tm: TM, col: 'future', st: 'approved' },
      s.gone ? { add: 'add-an-4' } : { h: 'c-an-4', ch: 'cell-an-4', sn: K.sang(), tm: TM, col: 'future', st: 'approved', menu: s.menu ? K.cmenu(['detail', 'edit', 'add', 'paid', 'unpaid', 'ot', '-', 'del']) : '' }, null, null] }, binhRow()] }),
    steps: [
      { on: 'web', h: 'cell-an-4', look: true, t: ['Ca cần xoá: <b>Ca sáng Thứ 6 16/10</b> của Lê Văn An — ca tương lai, chưa chấm công.', 'Shift to delete: Lê Văn An\'s <b>Morning shift on Fri 16/10</b> — a future shift with no attendance.'], warn: ['Hệ thống <b>không kiểm tra</b> ca đã chấm công hay đã chốt lương — xoá được cả ca đã có dữ liệu. Vì vậy hãy tự kiểm tra trước, chỉ xoá ca chưa có dữ liệu chấm công.', 'The system does <b>not check</b> whether the shift has attendance or the payroll is closed — it will delete shifts that already have data. Check yourself first and only delete shifts without attendance data.'] },
      { on: 'web', h: 'c-an-4', t: ['Bấm dấu <b>⋮</b> trên ô ca.', 'Click <b>⋮</b> on the shift cell.'], set: { menu: 1 } },
      { on: 'web', h: 'm-del', t: ['Chọn <b>Xoá</b> ở cuối menu.', 'Choose <b>Delete</b> at the bottom of the menu.'], set: { menu: 0, ask: 1 } },
      { on: 'web', h: 'yes', t: ['Hệ thống hỏi <b>"Bạn có muốn xóa không?"</b> — bấm <b>Đồng ý</b> để xoá.', 'The system asks <b>"Do you want to delete?"</b> — click <b>Yes</b> to delete.'], set: { ask: 0, gone: 1 } },
      { on: 'web', h: 'add-an-4', look: true, t: ['Ca đã biến mất khỏi lưới; ô trở lại dấu <b>+</b> để thêm ca khác nếu cần.', 'The shift is gone from the grid; the cell shows <b>+</b> again so you can add another shift if needed.'] },
      { on: 'web', h: 'tab-shift', look: true, t: ['Ở tab <b>Theo ca</b> còn có thao tác xoá nhân viên khỏi ca.', 'The <b>By shift</b> tab also lets you remove an employee from a shift.'], rule: ['Xoá nhân viên khỏi ca ở màn "Theo ca" <b>bị chặn</b> nếu nhân viên đã chấm vào/ra trong khoảng ngày đó.', 'Removing an employee from a shift on the "By shift" screen is <b>blocked</b> if the employee has clocked in/out within that date range.'] }
    ],
    done: ['Ca đã được xoá. Nhớ: thao tác Xoá trên ô ca không bị chặn bởi dữ liệu chấm công hay chốt lương.', 'The shift has been deleted. Remember: Delete on a shift cell is not blocked by attendance data or payroll closing.'],
    rules: [
      ['Menu ô ca → Xoá → xác nhận "Bạn có muốn xóa không?".', 'Cell menu → Delete → confirm "Do you want to delete?".'],
      ['Không kiểm tra ca đã chấm công hay đã chốt lương — người dùng phải tự kiểm tra trước khi xoá.', 'No check for existing attendance or closed payroll — verify yourself before deleting.'],
      ['Chốt lương không khoá thao tác Xoá ca.', 'Closing the payroll does not lock the Delete action.'],
      ['Xoá nhân viên khỏi ca ở màn "Theo ca" bị chặn nếu nhân viên đã chấm vào/ra trong khoảng ngày đó.', 'Removing an employee on the "By shift" screen is blocked if they clocked in/out within that date range.']
    ]
  });

  /* ---------- 3. Báo cáo Rate 1–4 ---------- */
  HDSD.add({
    id: 'rate', tier: 3, ch: ['web'], icon: '％',
    title: ['Báo cáo chấm công Rate 1–4 (theo tuần)', 'Attendance report Rate 1–4 (weekly)'],
    sum: ['Xem giờ làm thực tế, giờ được xác nhận và cách hệ thống chia giờ được xác nhận vào 4 mức Rate theo khung giờ của từng thứ.', 'See actual hours, confirmed hours and how confirmed hours are split into 4 Rate levels according to each weekday\'s time bands.'],
    who: ['Admin / HR', 'Admin / HR'],
    pre: ['Các ca đã được quản lý xác nhận giờ (Rate chia theo giờ được xác nhận).', 'Shifts already have manager-confirmed hours (Rates are split from confirmed hours).'],
    init: { _web: W.admin },
    web: () => {
      const c = (name, br, a, sd) => '<b>' + name + '</b><br><i>' + br + '</i><br>Actual: ' + a + '<br>Standard: ' + sd;
      const heads = ['STT', t('Mã NV', 'Code'), t('Họ tên', 'Full name'), t('Người quản lý', 'Manager'), { h: 'h-work', l: t('Giờ làm việc', 'Worked hours') }, { h: 'h-total', l: t('Tổng', 'Total') }, 'Rate 1', 'Rate 2', 'Rate 3', 'Rate 4',
        K.dn(0) + ' 12/10<br>' + t('Ca làm', 'Shift'), t('Giờ làm việc', 'Worked'), t('Giờ duyệt', 'Approved'), K.dn(1) + ' 13/10<br>' + t('Ca làm', 'Shift'), t('Giờ làm việc', 'Worked'), t('Giờ duyệt', 'Approved'), '…'];
      const rows = [
        { h: 'row-an', c: ['1', 'NV001', K.P.an, K.P.mgr, '6.1', '<b>6</b>', { h: 'r1-an', v: '<b>3</b>' }, '<b>3</b>', '', '', '', '', '', { h: 'd-an-1', v: c(K.chieu(), K.br1(), '15:00 - 21:06', '15:00 - 21:00') }, '6.1', '6', '…'] },
        { h: 'row-binh', c: ['2', 'NV002', K.P.binh, K.P.mgr, '8.05', '<b>8</b>', '<b>8</b>', '', '', '', c(K.sang(), K.br1(), '07:57 - 17:00', '08:00 - 17:00'), '8.05', '8', '', '', '', '…'] },
        { h: 'row-total', c: ['', '', '<b>' + t('Tổng', 'Total') + '</b>', '', '<b>14.15</b>', '<b>14</b>', '<b>11</b>', '<b>3</b>', '', '', '', '', '', '', '', '', ''] }];
      return K.web({ nav: 'rate', body: K.portlet(t('Báo cáo chấm công', 'Attendance report'), K.btn(t('Xuất Excel', 'Export Excel'), 'export'),
        '<div data-h="flt">' + K.filter([t('Nhân viên: Tất cả', 'Employees: All'), t('Chi nhánh: Tất cả', 'Branches: All'), K.wk(), '2026']) + '</div><div style="overflow:auto;font-size:11px">' + K.table(heads, rows) + '</div>' +
        hNote('Mô tả gợi ý trên màn hình: Rate 1 = T2–T6 00:00–17:59 · Rate 2 = T2–T6 18:00–23:59 · Rate 3 = Thứ 7 · Rate 4 = Chủ nhật (giá trị thật theo dữ liệu cấu hình).', 'On-screen hint: Rate 1 = Mon–Fri 00:00–17:59 · Rate 2 = Mon–Fri 18:00–23:59 · Rate 3 = Saturday · Rate 4 = Sunday (actual values follow the configured data).')) });
    },
    steps: [
      { on: 'web', h: 'nav-rate', look: true, t: ['Mở menu <b>Chấm công → Báo cáo chấm công</b> (Rate 1–4).', 'Open <b>Timekeeping → Attendance report</b> (Rate 1–4).'] },
      { on: 'web', h: 'flt', look: true, t: ['Bộ lọc: <b>Nhân viên</b> (chọn nhiều), <b>Chi nhánh của ca</b> (chọn nhiều), <b>Tuần</b>, <b>Năm</b>.', 'Filters: <b>Employees</b> (multi-select), <b>Shift branch</b> (multi-select), <b>Week</b>, <b>Year</b>.'], rule: ['Báo cáo theo tuần và chỉ hiện nhân viên có ca trong tuần đó.', 'The report is weekly and only lists employees who have shifts in that week.'] },
      { on: 'web', h: 'h-work', look: true, t: ['Cột <b>Giờ làm việc</b> = tổng giờ <b>thực tế</b> hệ thống tự tính từ giờ vào/ra.', 'Column <b>Worked hours</b> = total <b>actual</b> hours computed by the system from clock-in/out.'] },
      { on: 'web', h: 'h-total', look: true, t: ['Cột <b>Tổng</b> = tổng giờ <b>được xác nhận</b> do quản lý chốt. Đây là con số được chia vào Rate 1 – Rate 4.', 'Column <b>Total</b> = total <b>confirmed</b> hours set by the manager. This is the figure split into Rate 1 – Rate 4.'] },
      { on: 'web', h: 'd-an-1', look: true, t: ['Mỗi ngày có 3 cột: <b>Ca làm</b> (tên ca, chi nhánh, giờ thực tế vào/ra, giờ chuẩn), <b>Giờ làm việc</b>, <b>Giờ duyệt</b>. Ví dụ Thứ 3: ca bắt đầu 15:00, được xác nhận <b>6 giờ</b>.', 'Each day has 3 columns: <b>Shift</b> (name, branch, actual in/out, standard hours), <b>Worked</b>, <b>Approved</b>. Example Tuesday: shift starts 15:00, <b>6 hours</b> confirmed.'] },
      { on: 'web', h: 'row-an', look: true, t: ['Hệ thống lấy khoảng <b>15:00 → 21:00</b> (giờ bắt đầu ca chuẩn + 6 giờ được xác nhận): phần tới 17:59 thuộc Rate 1 (3 giờ), phần từ 18:00 thuộc Rate 2 (3 giờ) → <b>Rate 1 = 3, Rate 2 = 3</b>.', 'The system takes <b>15:00 → 21:00</b> (standard start + 6 confirmed hours): the part up to 17:59 is Rate 1 (3 h), the part from 18:00 is Rate 2 (3 h) → <b>Rate 1 = 3, Rate 2 = 3</b>.'], rule: ['Cách chia: lấy khoảng [giờ bắt đầu ca chuẩn, + giờ được xác nhận], so với các khung giờ Rate của thứ đó, chia giờ được xác nhận theo tỷ lệ phần trùng.', 'Split rule: take [standard shift start, + confirmed hours], compare with that weekday\'s Rate bands and split the confirmed hours proportionally to the overlap.'] },
      { on: 'web', h: 'row-binh', look: true, t: ['Bình làm Ca sáng Thứ 2, xác nhận 8 giờ → 08:00–16:00 nằm trọn trong khung Rate 1 → <b>Rate 1 = 8</b>.', 'Bình worked the Morning shift on Monday with 8 confirmed hours → 08:00–16:00 is fully inside the Rate 1 band → <b>Rate 1 = 8</b>.'], rule: ['Nếu thứ đó không có quy tắc hoặc khoảng giờ không trùng khung nào → dồn hết vào Rate 1. Khoảng vượt quá 23:59 bị cắt.', 'If that weekday has no rule or the range overlaps no band → everything goes to Rate 1. Anything past 23:59 is cut off.'] },
      { on: 'web', h: 'row-total', look: true, t: ['Dòng <b>Tổng</b> cuối bảng cộng các nhân viên của <b>trang đang xem</b>.', 'The <b>Total</b> row at the bottom sums the employees on the <b>page being viewed</b>.'] },
      { on: 'web', h: 'export', look: true, t: ['Nút <b>Xuất Excel</b> xuất báo cáo của <b>toàn bộ</b> nhân viên trong tuần.', 'The <b>Export Excel</b> button exports the report for <b>all</b> employees of the week.'] }
    ],
    done: ['Bạn đã đọc được báo cáo Rate 1–4 và hiểu cách chia giờ được xác nhận theo khung giờ.', 'You can now read the Rate 1–4 report and understand how confirmed hours are split by time band.'],
    rules: [
      ['Giờ làm việc = tổng giờ thực tế; Tổng = tổng giờ được xác nhận.', 'Worked hours = total actual hours; Total = total confirmed hours.'],
      ['Rate chia từ giờ được xác nhận, tính từ giờ bắt đầu ca chuẩn, theo tỷ lệ trùng với khung giờ Rate của thứ đó.', 'Rates are split from confirmed hours, starting at the standard shift start, proportionally to the overlap with that weekday\'s Rate bands.'],
      ['Không có quy tắc cho thứ đó / không trùng khung nào → dồn hết vào Rate 1; khoảng vượt 23:59 bị cắt.', 'No rule for that weekday / no overlapping band → all goes to Rate 1; time past 23:59 is cut.'],
      ['Quy tắc Rate không có màn hình cấu hình trên web (chỉ sửa trong dữ liệu).', 'Rate rules have no configuration screen on the web (data-level only).'],
      ['Dòng Tổng = tổng trang đang xem; Xuất Excel xuất toàn bộ nhân viên.', 'Total row = the page being viewed; Export Excel exports all employees.']
    ]
  });

  /* ---------- 4. Ngày lễ ---------- */
  HDSD.add({
    id: 'holiday', tier: 3, ch: ['web'], icon: '🎌',
    title: ['Ngày lễ ảnh hưởng thế nào đến xếp lịch và chấm công', 'How holidays affect scheduling and attendance'],
    sum: ['Ngày lễ hiển thị chữ đỏ trên lịch; thêm ca 1 ngày vào ngày lễ phải xác nhận, thêm hàng loạt tự bỏ qua; chấm công không bị chặn.', 'Holidays are shown in red on the schedule; adding a single-day shift on a holiday needs confirmation, bulk adding skips it; attendance is not blocked.'],
    who: ['Admin / HR', 'Admin / HR'],
    pre: ['Ngày lễ được khai báo ở module Lương (mục Ngày lễ). Ví dụ minh hoạ: Thứ 6 16/10 là ngày lễ.', 'Holidays are declared in the Salary module (Holidays). Illustration: Fri 16/10 is a holiday.'],
    init: { _web: W.admin, ask: 0, modal: 0, tick: 0, added: 0 },
    web: (s) => {
      const body = '<p style="margin-top:0">' + t('Nhân viên', 'Employee') + ': <b>' + K.P.an + '</b> · ' + t('Ngày', 'Date') + ': <b>' + K.dn(4) + ' ' + K.d(4) + '</b></p>' +
        K.table(['#', t('Chọn', 'Pick'), t('Tên ca', 'Shift'), t('Chi nhánh', 'Branch'), t('Tăng ca', 'Overtime'), t('Tính tăng ca theo', 'Overtime by'), t('Hệ số công', 'Coefficient')], [
          ['1', K.ck('ck-sang', s.tick), '<b>' + K.sang() + '</b><br><small>08:00 - 17:00</small>', K.sel('', s.tick ? K.br1() : '', { ph: t('Chọn chi nhánh', 'Select branch'), dis: !s.tick }), K.ck('', 0), K.sel('', t('Ca', 'Shift'), { dis: 1 }), K.inp('', '1', { w: 60 })],
          ['2', K.ck('', 0), '<b>' + K.chieu() + '</b><br><small>13:00 - 22:00</small>', K.sel('', '', { ph: t('Chọn chi nhánh', 'Select branch'), dis: 1 }), K.ck('', 0), K.sel('', t('Ca', 'Shift'), { dis: 1 }), K.inp('', '1', { w: 60 })]]);
      const over = s.ask ? K.swalQ(K.m('Ca làm việc rơi vào ngày lễ bạn có muốn thêm ca làm việc cho nhân viên?', 'The shift falls on a holiday. Do you still want to add it for the employee?'), 'yes') :
        s.modal ? K.modal({ title: t('Danh sách ca', 'Shift list'), size: 'lg', body, foot: K.btn(t('HỦY', 'CANCEL'), '', 'btn-default') + K.btn(t('CHỌN', 'SELECT'), 'pick', 'btn-primary') }) : '';
      return K.twsPage({ over, grid: K.grid({ h: 'grid', hol: 4, rows: [{ name: K.P.an, cells: [
        { h: 'c-an-0', sn: K.sang(), tm: '08:02 - 17:05', col: 'ok', st: 'confirmed' }, { h: 'c-an-1', sn: K.sang(), tm: '07:58 - 17:00', col: 'ok', st: 'nc' },
        { h: 'c-an-2', sn: K.sang(), tm: '--:-- - --:--', col: 'miss', st: 'approved' }, { h: 'c-an-3', sn: K.sang(), tm: TM, col: 'future', st: 'approved' },
        s.added ? { h: 'c-an-4', ch: 'cell-an-4', sn: K.sang(), tm: TM, col: 'future', st: 'approved', isNew: 1 } : { add: 'add-an-4' }, null, null] }, binhRow()] }) });
    },
    steps: [
      { on: 'web', h: 'grid', look: true, t: ['Trên lưới Lịch làm việc, cột ngày lễ (Thứ 6 16/10) có <b>tiêu đề chữ đỏ</b> kèm nhãn "Ngày lễ".', 'On the Work schedule grid the holiday column (Fri 16/10) has a <b>red header</b> with the label "Holiday".'], rule: ['App nhân viên cũng hiện biểu tượng ngày lễ ở màn Lịch sử chấm công.', 'The staff app also shows a holiday icon on the Attendance history screen.'] },
      { on: 'web', h: 'add-an-4', t: ['Bấm <b>+</b> ở ô trống của ngày lễ để thêm ca cho 1 nhân viên, 1 ngày.', 'Click <b>+</b> in the empty holiday cell to add a shift for one employee on one day.'], set: { ask: 1 } },
      { on: 'web', h: 'yes', t: ['Hệ thống <b>chỉ hỏi xác nhận</b>: "Ca làm việc rơi vào ngày lễ bạn có muốn thêm ca làm việc cho nhân viên?" — bấm <b>Đồng ý</b> để tiếp tục.', 'The system <b>only asks for confirmation</b>: "The shift falls on a holiday…" — click <b>Yes</b> to continue.'], rule: ['Thêm ca <b>1 ngày</b> vào ngày lễ không bị chặn, chỉ hỏi xác nhận.', 'Adding a <b>single-day</b> shift on a holiday is not blocked; it only asks for confirmation.'], set: { ask: 0, modal: 1 } },
      { on: 'web', h: 'ck-sang', t: ['Tick chọn <b>Ca sáng</b> trong popup Danh sách ca.', 'Tick <b>Morning shift</b> in the Shift list popup.'], set: { tick: 1 } },
      { on: 'web', h: 'pick', t: ['Bấm <b>CHỌN</b> để lưu.', 'Click <b>SELECT</b> to save.'], set: { modal: 0, added: 1 } },
      { on: 'web', h: 'cell-an-4', look: true, t: ['Ca đã được thêm vào ngày lễ ở trạng thái <b>Đã duyệt</b>. Đến ngày đó nhân viên vẫn chấm công bình thường.', 'The shift is added on the holiday with status <b>Approved</b>. On that day the employee clocks in/out as usual.'], rule: ['Hệ thống <b>không chặn</b> chấm công vào ngày lễ. Khi tính lương, ngày lễ được tách nhóm riêng và nhân đơn giá lễ.', 'The system does <b>not block</b> attendance on holidays. In payroll, holidays are grouped separately and paid at the holiday rate.'] },
      { on: 'web', h: 'tab-shift', look: true, t: ['Khác với thêm 1 ngày: các thao tác thêm ca <b>hàng loạt</b> (ví dụ "Thêm nhân viên vào ca" ở tab Theo ca) <b>tự bỏ qua</b> ngày lễ.', 'Unlike single-day adding: <b>bulk</b> shift adding (e.g. "Add employees to shift" on the By shift tab) <b>automatically skips</b> holidays.'] }
    ],
    done: ['Bạn đã nắm các ảnh hưởng của ngày lễ: hiển thị, xếp lịch, chấm công và lương.', 'You now know how holidays affect display, scheduling, attendance and payroll.'],
    rules: [
      ['Lịch hiển thị ngày lễ chữ đỏ; app Lịch sử chấm công có biểu tượng ngày lễ.', 'Holidays are shown in red on the schedule; the app\'s Attendance history shows a holiday icon.'],
      ['Thêm ca hàng loạt tự bỏ qua ngày lễ; thêm ca 1 ngày chỉ hỏi xác nhận.', 'Bulk adding skips holidays; single-day adding only asks for confirmation.'],
      ['Không chặn chấm công vào ngày lễ.', 'Attendance on holidays is not blocked.'],
      ['Lương: ngày lễ được tách nhóm, nhân đơn giá lễ (ưu tiên Ngày lễ > Thứ 7 > Chủ nhật > Ngày thường).', 'Payroll: holidays are grouped separately at the holiday rate (priority Holiday > Saturday > Sunday > Weekday).']
    ]
  });

  /* ---------- 5. Quỹ phép còn lại ---------- */
  HDSD.add({
    id: 'leave-quota', tier: 3, ch: ['web'], icon: '🌴',
    title: ['Xem quỹ ngày phép còn lại', 'View remaining annual leave'],
    sum: ['Tra cứu tổng số ngày phép năm, số đã nghỉ và số còn lại của từng nhân viên ở tab "Cấu hình ngày phép còn lại".', 'Look up each employee\'s annual leave total, days used and days remaining on the "Remaining leave days" tab.'],
    who: ['Admin / HR', 'Admin / HR'],
    init: { _web: W.admin, tab: 'general' },
    web: (s) => {
      const tabs = K.tabs([[t('Cấu hình chung', 'General settings'), 'tab-general', s.tab === 'general'], [t('Danh sách cấu hình chấm công', 'Check-in points'), 'tab-point', 0], [t('Cấu hình chấm công linh động', 'Flexible check-in'), 'tab-flex', 0],
        [t('Danh sách nhân viên không cần duyệt lịch làm việc', 'Staff without schedule approval'), 'tab-noappr', 0], [t('Cấu hình ngày phép còn lại', 'Remaining leave days'), 'tab-leave', s.tab === 'leave']]);
      const gen = [[t('Tính là đi trễ khi thời gian chấm công vào sau', 'Counted as late when clock-in is after'), '15'], [t('Tính là về sớm khi thời gian chấm công ra trước', 'Counted as early leave when clock-out is before'), '10'], [t('Được phép checkin trước', 'Check-in allowed before'), '30']]
        .map(([l, v]) => '<div class="form-row wide"><label>' + K.ck('', 1) + l + '</label><div>' + K.inp('', v, { w: 80 }) + '<span class="unit">' + t('Phút', 'Minutes') + '</span></div></div>').join('');
      const leave = K.table(['#', t('Nhân viên', 'Employee'), { h: 'h-total', l: t('Tổng số ngày phép năm', 'Total annual leave days') }, { h: 'h-used', l: t('Số ngày phép năm đã nghỉ', 'Leave days used') }, { h: 'h-remain', l: t('Số ngày phép năm còn lại', 'Leave days remaining') }, t('Năm', 'Year')], [
        { h: 'row-an', c: ['1', K.P.an, '12', '2', '10', '2026'] }, ['2', K.P.binh, '12', '0', '12', '2026'], ['3', K.P.mgr, '12', '5', '7', '2026']]);
      return K.web({ nav: 'cfg', body: K.portlet(t('Cấu hình chấm công', 'Timekeeping settings'), '', tabs + (s.tab === 'leave' ? leave : gen)) });
    },
    steps: [
      { on: 'web', h: 'nav-cfg', look: true, t: ['Vào menu <b>Chấm công → Cấu hình chấm công</b>. Màn hình có 5 tab.', 'Go to <b>Timekeeping → Timekeeping settings</b>. The screen has 5 tabs.'] },
      { on: 'web', h: 'tab-leave', t: ['Bấm tab <b>Cấu hình ngày phép còn lại</b>.', 'Click the <b>Remaining leave days</b> tab.'], set: { tab: 'leave' } },
      { on: 'web', h: 'h-total', look: true, t: ['Cột <b>Tổng số ngày phép năm</b>: quỹ phép của nhân viên trong năm.', 'Column <b>Total annual leave days</b>: the employee\'s leave allowance for the year.'], rule: ['Quỹ mặc định khi hệ thống tự tạo là <b>12 ngày</b>.', 'The default allowance created by the system is <b>12 days</b>.'] },
      { on: 'web', h: 'h-used', look: true, t: ['Cột <b>Số ngày phép năm đã nghỉ</b>: số ngày phép đã sử dụng.', 'Column <b>Leave days used</b>: days already taken.'] },
      { on: 'web', h: 'h-remain', look: true, t: ['Cột <b>Số ngày phép năm còn lại</b> và cột <b>Năm</b> áp dụng.', 'Column <b>Leave days remaining</b> and the applicable <b>Year</b>.'] },
      { on: 'web', h: 'row-an', look: true, t: ['Ví dụ: Lê Văn An có 12 ngày, đã nghỉ 2, còn lại 10 trong năm 2026. Nhân viên cũng thấy 3 con số này trên app, màn <b>Chấm công</b> (công tháng).', 'Example: Lê Văn An has 12 days, used 2, 10 remaining in 2026. The employee sees the same three figures in the app on the <b>Timekeeping</b> (monthly) screen.'], rule: ['Tab này dùng để <b>xem</b> quỹ phép. Đánh dấu "Nghỉ có lương / Nghỉ không lương" thủ công trên lưới lịch không trừ quỹ phép.', 'This tab is for <b>viewing</b> the allowance. Manually marking "Paid / Unpaid leave" on the schedule grid does not deduct from it.'] }
    ],
    done: ['Bạn đã biết nơi tra cứu quỹ phép năm của từng nhân viên.', 'You know where to look up each employee\'s annual leave allowance.'],
    rules: [
      ['Tab hiển thị: Tổng số ngày phép năm, Đã nghỉ, Còn lại, Năm.', 'The tab shows: Total annual leave days, Used, Remaining, Year.'],
      ['Quỹ mặc định khi hệ thống tự tạo: 12 ngày.', 'Default allowance created by the system: 12 days.'],
      ['Nhân viên xem quỹ phép của mình trên app ở màn "Chấm công".', 'Employees see their own allowance in the app on the "Timekeeping" screen.']
    ]
  });

  /* ---------- 6. App: Chấm công tháng ---------- */
  const anHome = (o) => K.home(Object.assign({ name: K.P.an, card: { sn: K.sang(), time: TM, btn: 'in' }, tiles: ['llv', 'pg', 'month'] }, o || {}));
  const anCards = (s) => [
    K.sched({ h: 'c-mon', day: K.dn(0) + ', ' + K.d(0), st: 'confirmed', shift: K.sang(), time: '08:00 -> 17:00', act: '08:02 -> 17:05', dur: '9 ' + t('Giờ', 'h') + ' 3 ' + t('Phút', 'min'), coef: '1', est: '8' }),
    K.sched({ h: 'c-tue', day: K.dn(1) + ', ' + K.d(1), st: 'nc', shift: K.sang(), time: '08:00 -> 17:00', act: '07:58 -> 17:00', dur: '9 ' + t('Giờ', 'h') + ' 2 ' + t('Phút', 'min'), est: '8' }),
    K.sched({ h: 'c-wed', day: K.dn(2) + ', ' + K.d(2), st: 'approved', shift: K.sang(), time: '08:00 -> 17:00', est: '8' }),
    K.sched({ h: 'c-thu', day: K.dn(3) + ', ' + K.d(3), st: 'approved', shift: K.sang(), time: '08:00 -> 17:00', est: '8' }),
    K.sched({ h: 'c-fri', day: K.dn(4) + ', ' + K.d(4), st: 'waiting', shift: K.sang(), time: '08:00 -> 17:00', est: '8' })].join('');
  const anLLV = () => K.app({ time: '07:50', title: t('Lịch làm việc', 'Work schedule'), right: '<button>＋</button>', body: '<div data-h="week">' + K.weekh() + '</div>' + K.sum({ h: 'sum', name: K.P.an, c: { waiting: 1, approved: 2, nc: 1, confirmed: 1 }, est: 40, act: 16.08, conf: 8.05 }) + anCards() });

  HDSD.add({
    id: 'app-month', tier: 3, ch: ['app'], icon: '🧾',
    title: ['App: xem công tháng (màn "Chấm công")', 'App: monthly work summary ("Timekeeping" screen)'],
    sum: ['Nhân viên xem tổng hợp công của kỳ: giờ công chuẩn, giờ công thực tế, số ca theo mã công và quỹ phép.', 'Employees see the period summary: standard hours, actual hours, shift counts by work code and the leave allowance.'],
    who: ['Nhân viên', 'Staff'],
    pre: ['Tài khoản có quyền TI000001.', 'The account has permission TI000001.'],
    init: { _app: W.an, scr: 'home' },
    app: (s) => {
      if (s.scr === 'home') return K.app({ time: '07:50', raw: anHome() });
      if (s.scr === 'llv') return anLLV();
      return K.app({ time: '07:50', title: t('Chấm công', 'Timekeeping'),
        body: K.acard(K.akv(t('Từ ngày', 'From'), '26/09/2026') + K.akv(t('Đến ngày', 'To'), '25/10/2026'), 'period') +
          '<div class="acard">' + '<div data-h="std">' + K.akv('<b>' + t('Giờ công chuẩn', 'Standard hours') + '</b>', '112') + '</div><div data-h="act">' + K.akv('<b>' + t('Giờ công thực tế', 'Actual hours') + '</b>', '96.5', '#3398dc') + '</div><div data-h="codes">' + K.akv('1', '11') + K.akv('1/2', '1') + K.akv('P', '2') + '</div></div>' +
          K.acard(K.akv('<b>' + t('Tổng số ngày nghỉ', 'Total leave days') + '</b>', '12') + K.akv(t('Tổng số ngày nghỉ đã sử dụng', 'Leave days used'), '2', '#c62828') + K.akv(t('Tổng số ngày nghỉ còn lại', 'Leave days remaining'), '10', '#1b7a5c'), 'leave'),
        bottom: K.abtn(t('Danh sách lịch làm việc', 'Work schedule list'), 'btn-list') });
    },
    steps: [
      { on: 'app', h: 't-month', t: ['Ở màn Home, bấm ô <b>Chấm công</b>.', 'On Home, tap the <b>Timekeeping</b> tile.'], set: { scr: 'month' } },
      { on: 'app', h: 'period', look: true, t: ['Kỳ công đang xem: <b>Từ ngày 26/09/2026 – Đến ngày 25/10/2026</b>.', 'Period being viewed: <b>From 26/09/2026 – To 25/10/2026</b>.'], rule: ['Kỳ công tháng lấy theo "Thời gian chốt công hàng tháng" ở Cấu hình chung; mặc định từ ngày 26 tháng trước đến ngày 25 tháng này.', 'The monthly period follows "Monthly closing time" in General settings; default is the 26th of last month to the 25th of this month.'] },
      { on: 'app', h: 'std', look: true, t: ['<b>Giờ công chuẩn</b> = tổng "số giờ làm tối thiểu tính đủ công" của các ca trong kỳ.', '<b>Standard hours</b> = total "minimum hours for a full work unit" of the shifts in the period.'] },
      { on: 'app', h: 'act', look: true, t: ['<b>Giờ công thực tế</b> = tổng <b>giờ được xác nhận</b> do quản lý chốt (không phải giờ hệ thống tự tính).', '<b>Actual hours</b> = total <b>confirmed hours</b> set by the manager (not the system-computed hours).'] },
      { on: 'app', h: 'codes', look: true, t: ['Bên dưới là số ca theo từng <b>mã công</b> (ví dụ 1, 1/2, P…).', 'Below are the shift counts per <b>work code</b> (e.g. 1, 1/2, P…).'], rule: ['Chỉ đếm các ca đang <b>Chờ xác nhận</b> hoặc <b>Đã xác nhận</b>. Mã công: 1 (1 công), 1/2 (nửa công), P (nghỉ phép năm), P/2, OFF, KL (nghỉ không lương), OT (tăng ca).', 'Only shifts that are <b>Pending confirmation</b> or <b>Confirmed</b> are counted. Codes: 1 (one unit), 1/2 (half), P (annual leave), P/2, OFF, KL (unpaid leave), OT (overtime).'] },
      { on: 'app', h: 'leave', look: true, t: ['Quỹ phép năm: <b>Tổng số ngày nghỉ</b>, <b>đã sử dụng</b>, <b>còn lại</b>.', 'Annual leave: <b>total days</b>, <b>used</b>, <b>remaining</b>.'] },
      { on: 'app', h: 'btn-list', t: ['Bấm <b>Danh sách lịch làm việc</b> để chuyển sang màn Lịch làm việc.', 'Tap <b>Work schedule list</b> to jump to the Work schedule screen.'], set: { scr: 'llv' } },
      { on: 'app', h: 'sum', look: true, t: ['Màn <b>Lịch làm việc</b> mở ra với danh sách ca theo tuần.', 'The <b>Work schedule</b> screen opens with the weekly shift list.'] }
    ],
    done: ['Bạn đã đọc được bảng công tháng trên app.', 'You can now read the monthly work summary in the app.'],
    rules: [
      ['Kỳ công mặc định: ngày 26 tháng trước → ngày 25 tháng này.', 'Default period: 26th of last month → 25th of this month.'],
      ['Giờ công chuẩn = tổng giờ tối thiểu; Giờ công thực tế = tổng giờ được xác nhận.', 'Standard hours = total minimum hours; Actual hours = total confirmed hours.'],
      ['Số ca theo mã công chỉ tính ca Chờ xác nhận / Đã xác nhận.', 'Shift counts by code only include Pending confirmation / Confirmed shifts.']
    ]
  });

  /* ---------- 7. App: Lịch làm việc & chi tiết ---------- */
  HDSD.add({
    id: 'app-llv', tier: 3, ch: ['app'], icon: '📅',
    title: ['App: xem Lịch làm việc và Chi tiết lịch làm việc', 'App: view Work schedule and Schedule details'],
    sum: ['Nhân viên xem lịch tuần của mình, khối tổng hợp theo trạng thái và mở chi tiết một ca để xem từng lượt vào/ra.', 'Employees view their weekly schedule, the status summary block and open a shift to see each clock-in/out round.'],
    who: ['Nhân viên', 'Staff'],
    pre: ['Tài khoản có quyền TI000001.', 'The account has permission TI000001.'],
    init: { _app: W.an, scr: 'home' },
    app: (s) => {
      if (s.scr === 'home') return K.app({ time: '07:50', raw: anHome() });
      if (s.scr === 'llv') return anLLV();
      return K.app({ time: '07:50', title: t('Chi tiết lịch làm việc', 'Schedule details'),
        body: K.sched({ h: 'd-card', day: K.dn(0) + ', ' + K.d(0), st: 'confirmed', shift: K.sang(), time: '08:00 -> 17:00', act: '08:02 -> 17:05', dur: '9 ' + t('Giờ', 'h') + ' 3 ' + t('Phút', 'min') }) +
          K.acard(K.akv(t('Thời gian làm việc được xác nhận', 'Confirmed hours'), '8') + K.akv(t('Tổng thời gian', 'Total time'), '8.05 ' + t('Giờ', 'h'), '#3398dc') + K.akv(t('Thời gian ước lượng', 'Estimated time'), '8 ' + t('Giờ', 'h')) + K.akv(t('Hệ số công', 'Work coefficient'), '1'), 'totals') +
          '<div data-h="laps"><b>' + t('Lịch sử vào ra', 'In/out history') + '</b><div style="height:6px"></div>' + K.acard('<b>' + t('Thời gian', 'Round') + ' 1: 8.05 ' + t('Giờ', 'h') + '</b>' + K.akv(t('Giờ vào', 'Clock-in'), '08:02 🖼') + K.akv(t('Giờ ra', 'Clock-out'), '17:05 🖼') + '<div style="text-align:right;margin-top:6px;color:#3398dc;font-weight:600">🗺 ' + t('Bản đồ', 'Map') + '</div>') + '</div>' });
    },
    steps: [
      { on: 'app', h: 't-llv', t: ['Ở màn Home, bấm ô <b>LLV</b> (Lịch làm việc).', 'On Home, tap the <b>LLV</b> (Work schedule) tile.'], set: { scr: 'llv' } },
      { on: 'app', h: 'week', look: true, t: ['Lịch hiển thị <b>theo tuần</b>; dùng ‹ › để chuyển tuần.', 'The schedule is shown <b>by week</b>; use ‹ › to change week.'] },
      { on: 'app', h: 'sum', look: true, t: ['Khối tổng hợp: số ca theo từng <b>trạng thái</b> và 3 con số giờ <b>dự kiến / thực tế / được xác nhận</b> của tuần.', 'Summary block: shift counts per <b>status</b> and the week\'s <b>planned / actual / confirmed</b> hours.'], rule: ['Trạng thái ca: Chờ duyệt (hồng) → Đã duyệt (xanh dương) → Chờ xác nhận (cam) → Đã xác nhận (xanh lá). Chỉ ca "Đã duyệt" mới chấm công được.', 'Shift statuses: Pending approval (pink) → Approved (blue) → Pending confirmation (orange) → Confirmed (green). Only "Approved" shifts can be clocked.'] },
      { on: 'app', h: 'c-mon', look: true, t: ['Mỗi thẻ ca gồm: ngày, trạng thái, chi nhánh, ca + giờ, giờ vào/ra thực tế + thời lượng, <b>hệ số công</b> (khi đã xác nhận) và thời gian ước lượng.', 'Each shift card shows: date, status, branch, shift + hours, actual in/out + duration, the <b>work coefficient</b> (once confirmed) and the estimated time.'] },
      { on: 'app', h: 'c-mon', t: ['Bấm vào thẻ ca Thứ 2 12/10 để mở chi tiết.', 'Tap the Mon 12/10 shift card to open its details.'], set: { scr: 'detail' } },
      { on: 'app', h: 'totals', look: true, t: ['<b>Thời gian làm việc được xác nhận</b> (quản lý chốt), <b>Tổng thời gian</b> (hệ thống tự tính), <b>Thời gian ước lượng</b> (giờ tối thiểu của ca) và <b>Hệ số công</b>.', '<b>Confirmed hours</b> (set by the manager), <b>Total time</b> (system-computed), <b>Estimated time</b> (the shift\'s minimum hours) and the <b>work coefficient</b>.'], rule: ['Tổng thời gian = tổng giờ công các lượt; mỗi lượt = giờ ra − giờ vào − phần trùng giờ nghỉ trưa. Ví dụ 08:02 → 17:05 trừ 1 giờ nghỉ trưa = 8.05 giờ. Con số dùng cho báo cáo/lương là giờ được xác nhận.', 'Total time = sum of all rounds; each round = clock-out − clock-in − overlap with the lunch break. E.g. 08:02 → 17:05 minus the 1-hour lunch = 8.05 h. Reports/payroll use the confirmed hours.'] },
      { on: 'app', h: 'laps', look: true, t: ['<b>Lịch sử vào ra</b>: từng lượt chấm kèm ảnh selfie (nếu có) và nút <b>Bản đồ</b>.', '<b>In/out history</b>: each round with its selfie (if any) and the <b>Map</b> button.'] },
      { on: 'app', h: 'back', t: ['Bấm ← để quay lại danh sách.', 'Tap ← to go back to the list.'], set: { scr: 'llv' } }
    ],
    done: ['Bạn đã xem được lịch tuần và chi tiết từng ca trên app.', 'You have viewed the weekly schedule and a shift\'s details in the app.'],
    rules: [
      ['Lịch làm việc xem theo tuần (có khối tổng hợp) hoặc theo tháng.', 'The schedule can be viewed by week (with a summary block) or by month.'],
      ['Hệ số công chỉ hiện trên thẻ ca khi ca Đã xác nhận.', 'The work coefficient appears on the card only once the shift is Confirmed.'],
      ['Giờ thực tế không cắt theo giờ chuẩn của ca, không làm tròn; giờ được xác nhận mới là con số dùng cho báo cáo và lương.', 'Actual hours are neither capped at the standard hours nor rounded; confirmed hours are what reports and payroll use.']
    ]
  });

  /* ---------- 8. App: Lịch sử chấm công cá nhân ---------- */
  const LIGHT = { future: '#D3D3D3', ok: '#DBEFDC', miss: '#FDD9D7', late: '#FFEACC', paid: '#D9DCF0', unpaid: '#EBD4EF' };
  HDSD.add({
    id: 'app-history', tier: 3, ch: ['app'], icon: '🗓',
    title: ['App: Lịch sử chấm công cá nhân', 'App: personal Attendance history'],
    sum: ['Lịch tháng tô màu theo trạng thái chấm công từng ngày; chọn một ngày để xem giờ vào/ra từng ca.', 'A month calendar coloured by each day\'s attendance status; pick a day to see the in/out times of each shift.'],
    who: ['Nhân viên', 'Staff'],
    pre: ['Tài khoản có quyền TI000001. Mở từ mục Tài khoản.', 'The account has permission TI000001. Opened from Account.'],
    init: { _app: W.an, scr: 'acc', sel: 14 },
    app: (s) => {
      if (s.scr === 'acc') return K.app({ time: '09:30', back: false, title: t('Tài khoản', 'Account'), body: K.acard('<b>' + K.P.an + '</b><div style="font-size:12px;color:#666">' + K.br1() + '</div>') + K.acard('👤 ' + t('Thông tin cá nhân', 'Personal info')) + K.acard('🗓 ' + t('Lịch sử chấm công', 'Attendance history'), 'acc-hist') + K.acard('🔒 ' + t('Đổi mật khẩu', 'Change password')) });
      const col = { 1: 'ok', 2: 'ok', 5: 'ok', 6: 'late', 7: 'ok', 8: 'paid', 9: 'unpaid', 12: 'ok', 13: 'ok', 14: 'miss', 15: 'future', 16: 'future' };
      let cells = '<div></div><div></div><div></div>';
      for (let i = 1; i <= 31; i++) cells += '<div class="d' + (i === 13 ? ' ot' : '') + (i === s.sel ? ' sel' : '') + '" style="background:' + (col[i] ? LIGHT[col[i]] : '#fff') + '" data-h="d-' + i + '">' + i + (i === 16 ? '<span style="position:absolute;right:1px;top:-2px;font-size:9px">🎌</span>' : '') + '</div>';
      const lg = '<div class="legend" data-h="legend" style="margin-top:8px">' + Object.keys(LIGHT).map((k) => '<span><i style="background:' + LIGHT[k] + '"></i>' + K.COL[k].l() + '</span>').join('') + '<span><i style="background:#fff;box-shadow:inset 0 0 0 2px #F44336"></i>' + t('Tăng ca', 'Overtime') + '</span><span>🎌 ' + t('Ngày lễ', 'Holiday') + '</span></div>';
      const log = (name, tm, io, c, ot) => '<div class="acard" style="background:' + LIGHT[c] + ';' + (ot ? 'box-shadow:inset 0 0 0 2px #F44336' : '') + '"><b>' + name + '</b><div>' + tm + '</div><div>' + io + '</div><div style="font-size:11.5px;color:#555">' + K.COL[c].l() + '</div></div>';
      const io = (a, b) => t('Vào ca', 'In') + ' (' + a + ') · ' + t('Ra ca', 'Out') + ' (' + b + ')';
      const logs = s.sel === 13 ? log(K.sang(), '13/10/2026 08:00 - 17:00', io('07:58', '17:00'), 'ok') + log(t('Tăng ca (OT)', 'Overtime (OT)'), '13/10/2026 17:00 - 19:00', io('17:01', '19:02'), 'ok', 1) : log(K.sang(), '14/10/2026 08:00 - 17:00', io('07:55', '--:--'), 'miss');
      return K.app({ time: '09:30', title: t('Lịch sử chấm công', 'Attendance history'), body: '<div class="acard"><div style="text-align:center;font-weight:600;margin-bottom:6px">' + t('Tháng 10/2026', 'October 2026') + '</div><div class="cal" data-h="cal">' + [t('T2', 'Mo'), t('T3', 'Tu'), t('T4', 'We'), t('T5', 'Th'), t('T6', 'Fr'), t('T7', 'Sa'), t('CN', 'Su')].map((x) => '<div class="h">' + x + '</div>').join('') + cells + '</div>' + lg + '</div><div data-h="logs">' + logs + '</div>' });
    },
    steps: [
      { on: 'app', h: 'acc-hist', t: ['Vào mục <b>Tài khoản</b>, bấm <b>Lịch sử chấm công</b>.', 'Go to <b>Account</b> and tap <b>Attendance history</b>.'], set: { scr: 'hist' } },
      { on: 'app', h: 'cal', look: true, t: ['Lịch tháng: mỗi ngày có ca được <b>tô màu theo trạng thái chấm công</b>; ngày đang chọn có viền xanh.', 'Month calendar: each day with a shift is <b>coloured by attendance status</b>; the selected day has a blue ring.'] },
      { on: 'app', h: 'legend', look: true, t: ['Ý nghĩa màu: Chưa đến ca (xám), Chấm công đúng giờ (xanh nhạt), Chưa vào/ra ca (hồng nhạt), Vào trễ/ra sớm (vàng nhạt), Nghỉ phép có lương, Nghỉ phép không lương.', 'Colour meaning: Not yet due (grey), On time (light green), Missing in/out (light pink), Late in / early out (light yellow), Paid leave, Unpaid leave.'], rule: ['Ca ngày đã qua mà không vào và không ra → tính "Nghỉ phép không lương"; có vào nhưng thiếu ra (hoặc ngược lại) → "Chưa vào/ra ca"; vượt ngưỡng trễ/sớm trong Cấu hình chung → "Vào trễ/ra sớm".', 'A past shift with neither clock-in nor clock-out → "Unpaid leave"; in without out (or vice versa) → "Missing in/out"; beyond the late/early thresholds in General settings → "Late in / early out".'] },
      { on: 'app', h: 'd-13', look: true, t: ['Ngày có <b>tăng ca</b> được viền đỏ (ví dụ ngày 13).', 'Days with <b>overtime</b> have a red border (e.g. the 13th).'] },
      { on: 'app', h: 'd-16', look: true, t: ['Ngày lễ có biểu tượng 🎌 ở góc (ví dụ minh hoạ: ngày 16).', 'Holidays show a 🎌 icon in the corner (illustration: the 16th).'] },
      { on: 'app', h: 'd-13', t: ['Bấm vào một ngày (13/10) để xem chi tiết.', 'Tap a day (13/10) to see its details.'], set: { sel: 13 } },
      { on: 'app', h: 'logs', look: true, t: ['Bên dưới lịch hiện <b>giờ vào/ra từng ca</b> của ngày đã chọn: Ca sáng và ca tăng ca (viền đỏ).', 'Below the calendar you see the <b>in/out times of each shift</b> on the selected day: the Morning shift and the overtime shift (red border).'] }
    ],
    done: ['Bạn đã đọc được lịch sử chấm công theo tháng trên app.', 'You can now read the monthly attendance history in the app.'],
    rules: [
      ['Màu ngày theo trạng thái chấm công (bản màu nhạt của bảng màu trên Web).', 'Day colours follow the attendance status (the light version of the Web palette).'],
      ['Viền đỏ = ngày có tăng ca; biểu tượng riêng cho ngày lễ.', 'Red border = day with overtime; a dedicated icon marks holidays.'],
      ['Chọn ngày để xem chi tiết vào/ra từng ca.', 'Select a day to see the in/out details of each shift.']
    ]
  });

  /* ---------- 9. App quản lý: Lịch sử / Quản lý chấm công ---------- */
  const mgrHome = (tiles) => K.home({ name: K.P.mgr, tiles: tiles || ['llv', 'pg', 'month', 'report', 'manage'], card: { sn: K.sang(), time: TM, laps: ['07:50 - '], btn: 'out' } });
  HDSD.add({
    id: 'mgr-manage', tier: 3, ch: ['app'], icon: '📋',
    title: ['App: Lịch sử / Quản lý chấm công (nhiều nhân viên)', 'App: Attendance history / management (many employees)'],
    sum: ['Xem theo ngày có bao nhiêu người đã vào ca, đã ra ca và mở rộng để xem từng nhân viên.', 'See per day how many people have clocked in and out, and expand to see each employee.'],
    who: ['Quản lý / Leader', 'Manager / Leader'],
    pre: ['Tài khoản có quyền TI000000.', 'The account has permission TI000000.'],
    init: { _app: W.mgr, scr: 'home', open: 0 },
    app: (s) => {
      if (s.scr === 'home') return K.app({ time: '10:00', raw: mgrHome() });
      const st = (n, sh, a, b) => '<div style="border-top:1px dashed #eee;padding:6px 0"><b>' + n + '</b> · ' + sh + '<div style="font-size:12px;color:#555">' + t('Vào', 'In') + ': ' + a + ' · ' + t('Ra', 'Out') + ': ' + b + '</div></div>';
      const day = (h, d, i, o, open, list) => '<div class="acard" data-h="' + h + '"><div style="display:flex;justify-content:space-between"><b>' + d + '</b><span>' + (open ? '▴' : '▾') + '</span></div>' + K.akv(t('Vào ca', 'Clocked in'), i) + K.akv(t('Ra ca', 'Clocked out'), o) + (open ? '<div data-h="list">' + list + '</div>' : '') + '</div>';
      return K.app({ time: '10:00', title: t('Lịch sử chấm công', 'Attendance history'),
        body: '<div data-h="flt" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:9px">' + K.asel('', '', t('Chi nhánh', 'Branch')) + K.asel('', '', t('Phòng ban', 'Department')) + K.asel('', '12/10 - 18/10/2026') + K.ainp('', '', t('Tìm tên nhân viên', 'Search name')) + '</div>' +
          day('day-14', K.dn(2) + ', ' + K.d(2), '2/3', '0/3', s.open, st(K.P.an, K.sang(), '07:55', '--:--') + st(K.P.binh, K.sang(), '07:56', '--:--') + st(K.P.mgr, K.sang(), '--:--', '--:--')) +
          day('day-13', K.dn(1) + ', ' + K.d(1), '3/3', '3/3', 0, '') + day('day-12', K.dn(0) + ', ' + K.d(0), '3/3', '3/3', 0, '') });
    },
    steps: [
      { on: 'app', h: 't-manage', t: ['Ở màn Home, bấm ô <b>Quản lý chấm công</b>.', 'On Home, tap the <b>Manage attendance</b> tile.'], rule: ['Menu này chỉ hiện khi tài khoản có mã quyền <b>TI000000</b>.', 'This menu only appears when the account has permission code <b>TI000000</b>.'], set: { scr: 'list' } },
      { on: 'app', h: 'flt', look: true, t: ['Bộ lọc: <b>chi nhánh</b>, <b>phòng ban</b>, <b>thời gian</b>, <b>tên nhân viên</b>.', 'Filters: <b>branch</b>, <b>department</b>, <b>time range</b>, <b>employee name</b>.'] },
      { on: 'app', h: 'day-14', look: true, t: ['Mỗi thẻ là 1 ngày: <b>Vào ca 2/3</b> = 2 trên tổng 3 người có ca đã chấm vào; <b>Ra ca 0/3</b> = chưa ai ra ca.', 'Each card is one day: <b>Clocked in 2/3</b> = 2 of the 3 people with a shift have clocked in; <b>Clocked out 0/3</b> = nobody has clocked out yet.'] },
      { on: 'app', h: 'day-14', t: ['Bấm vào thẻ ngày để <b>mở rộng</b>.', 'Tap the day card to <b>expand</b> it.'], set: { open: 1 } },
      { on: 'app', h: 'list', look: true, t: ['Danh sách từng nhân viên trong ngày kèm giờ vào / giờ ra. Người chưa chấm hiển thị --:--.', 'The list of each employee for that day with in / out times. People who have not clocked show --:--.'], rule: ['Màn này hiện dữ liệu của <b>mọi nhân viên</b>, không giới hạn theo người mình quản lý trực tiếp — hãy dùng bộ lọc chi nhánh/phòng ban để thu hẹp.', 'This screen shows data for <b>all employees</b>, not only your direct reports — use the branch/department filters to narrow it down.'] },
      { on: 'app', h: 'day-13', look: true, t: ['Các ngày trước đó xem tương tự: 13/10 đủ 3/3 vào ca và 3/3 ra ca.', 'Earlier days work the same: on 13/10 all 3/3 clocked in and 3/3 clocked out.'] }
    ],
    done: ['Bạn đã biết cách theo dõi nhanh tình hình vào/ra ca theo ngày trên app.', 'You know how to quickly monitor daily clock-ins/outs in the app.'],
    rules: [
      ['Cần quyền TI000000 để thấy menu "Lịch sử / Quản lý chấm công".', 'Permission TI000000 is required to see "Attendance history / management".'],
      ['Theo ngày: số người đã vào ca / tổng, đã ra ca / tổng; mở rộng để xem từng nhân viên.', 'Per day: clocked in / total, clocked out / total; expand to see each employee.'],
      ['Hiện dữ liệu mọi nhân viên, không giới hạn người mình quản lý.', 'Shows all employees, not limited to your direct reports.']
    ]
  });

  /* ---------- 10 + 11. App quản lý: Báo cáo tuần / theo giờ ---------- */
  const shBox = (h, col, name, io) => '<div class="sh" style="border-color:' + K.COL[col].c + '"' + (h ? ' data-h="' + h + '"' : '') + '><b>' + name + '</b><br>' + io + '</div>';
  const roster = () => {
    const sn = t('Sáng', 'Morn.');
    const row = (n, id, cells) => '<tr><td style="min-width:66px" data-h="nm-' + id + '"><b>' + n + '</b><br><small>' + t('Quận 1', 'Dist. 1') + '</small></td>' + cells.map((c, i) => '<td>' + (c ? shBox('sh-' + id + '-' + i, c[0], sn, c[1]) : '<div class="add" data-h="add-' + id + '-' + i + '">⊕</div>') + '</td>').join('') + '</tr>';
    return '<div style="overflow:auto;border-radius:10px"><table class="roster" data-h="roster"><thead><tr><th style="text-align:left">' + t('Nhân viên', 'Staff') + ' <span class="chip" style="background:#e53935">3</span></th>' +
      [0, 1, 2, 3, 4, 5, 6].map((i) => '<th class="' + (i === 2 ? 'today' : '') + '" data-h="th-' + i + '">' + [t('T2', 'Mo'), t('T3', 'Tu'), t('T4', 'We'), t('T5', 'Th'), t('T6', 'Fr'), t('T7', 'Sa'), t('CN', 'Su')][i] + '<br>' + (12 + i) + '</th>').join('') + '</tr></thead><tbody>' +
      row('Văn An', 'an', [['ok', '08:02/17:05'], ['ok', '07:58/17:00'], ['miss', '07:55/--'], ['future', '--/--'], ['future', '--/--'], null, null]) +
      row('Thu Bình', 'b', [['ok', '07:57/17:01'], ['late', '08:25/17:00'], ['miss', '07:56/--'], ['future', '--/--'], null, null, null]) +
      row('Minh Quân', 'q', [['ok', '07:50/17:10'], ['paid', '--/--'], ['miss', '07:50/--'], ['future', '--/--'], ['future', '--/--'], null, null]) + '</tbody></table></div>';
  };
  const rLegend = () => '<div data-h="legend" style="margin-top:8px">' + Object.keys(K.COL).map((k) => '<span class="chip" style="background:' + K.COL[k].c + ';color:#222;margin:2px">' + K.COL[k].l() + '</span>').join('') + '</div>';
  const rFilter = () => '<div data-h="flt" style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap">' + [t('Tên', 'Name'), t('Địa điểm', 'Location'), t('Ca', 'Shift'), t('Trạng thái', 'Status')].map((x) => '<span class="chip" style="background:#fff;color:#555;border:1px solid #ddd">' + x + ' ▾</span>').join('') + '<span class="chip" style="background:#3398dc">' + t('Hôm nay', 'Today') + '</span></div>';
  const weekScr = (s) => K.app({ time: '10:00', title: t('Báo cáo lịch làm việc nhân viên', 'Staff schedule report'),
    body: K.weekh(t('Tuần 42 (12/10 - 18/10)', 'Week 42 (12/10 - 18/10)')) + rFilter() + roster() + rLegend(),
    sheet: s.sheet ? { title: t('Chi tiết lịch làm việc', 'Schedule details') + ' - ' + K.d(1), body: '<div class="acard" data-h="sheet-info"><b>' + K.sang() + '</b><div>' + t('Thời gian làm việc', 'Working time') + ': 08:00 - 17:00</div><div>Check in/out 1: 08:25/17:00</div><div>' + t('Chi nhánh', 'Branch') + ': ' + K.br1() + '</div><div>' + t('Trạng thái', 'Status') + ': <span class="chip" style="background:' + K.COL.late.c + ';color:#222">' + K.COL.late.l() + '</span></div></div>' } : null });
  const hourScr = (s) => {
    const d = s.day; const fut = d === 3;
    const bk = (h, l, w, col, tx) => '<div class="bk"' + (h ? ' data-h="' + h + '"' : '') + ' style="left:' + l + '%;width:' + w + '%;background:' + K.COL[col].c + '">' + tx + '</div>';
    const rw = (n, blocks) => '<div class="rw"><b>' + n + '</b><div class="tr">' + blocks + '</div></div>';
    const sg = K.sang() + ' 08-17';
    return K.app({ time: '10:00', title: t('Báo cáo lịch làm việc nhân viên', 'Staff schedule report'),
      body: '<div class="week-h"><span class="bt">‹</span><span class="lb" data-h="day-lb">' + K.dn(d) + ', ' + K.d(d) + '</span><span class="bt">›</span></div>' +
        '<div data-h="flt" style="display:flex;gap:5px;margin-bottom:8px">' + [t('Địa điểm', 'Location'), t('Nhân viên', 'Employee'), t('Trạng thái', 'Status')].map((x) => '<span class="chip" style="background:#fff;color:#555;border:1px solid #ddd">' + x + ' ▾</span>').join('') + '</div>' +
        '<div class="tl" data-h="tl"><div class="hrs">' + ['06', '08', '10', '12', '14', '16', '18', '20', '22'].map((x) => '<span>' + x + '</span>').join('') + '</div>' +
        rw('Văn An', bk('bk-an', 11.1, 50, fut ? 'future' : 'miss', sg)) + rw('Thu Bình', bk('', 11.1, 50, fut ? 'future' : 'miss', sg)) + rw('Minh Quân', bk('', 11.1, 50, fut ? 'future' : 'miss', sg) + (fut ? '' : bk('bk-ot', 61.1, 11.1, 'future', 'OT'))) + '</div>' + rLegend() });
  };

  HDSD.add({
    id: 'mgr-report-week', tier: 3, ch: ['app'], icon: '📊',
    title: ['App: Báo cáo lịch làm việc nhân viên theo tuần', 'App: weekly staff schedule report'],
    sum: ['Lưới nhân viên × 7 ngày, mỗi ô ca có vạch màu theo trạng thái báo cáo; từ đây mở chi tiết ca hoặc báo cáo theo giờ.', 'A staff × 7-day grid where each shift has a colour bar for its report status; open shift details or the hourly report from here.'],
    who: ['Quản lý / Leader', 'Manager / Leader'],
    pre: ['Tài khoản có quyền TI000002.', 'The account has permission TI000002.'],
    init: { _app: W.mgr, scr: 'home', sheet: 0, day: 2 },
    app: (s) => (s.scr === 'home' ? K.app({ time: '10:00', raw: mgrHome() }) : s.scr === 'hour' ? hourScr(s) : weekScr(s)),
    steps: [
      { on: 'app', h: 't-report', t: ['Ở màn Home, bấm ô <b>Báo cáo chấm công</b>.', 'On Home, tap the <b>Attendance report</b> tile.'], rule: ['Menu "Báo cáo chấm công dành cho quản lý" chỉ hiện khi có mã quyền <b>TI000002</b>.', 'The "Attendance report for managers" menu only appears with permission code <b>TI000002</b>.'], set: { scr: 'week' } },
      { on: 'app', h: 'roster', look: true, t: ['Lưới <b>nhân viên × 7 ngày</b> của tuần. Mỗi ô ca ghi tên ca và giờ vào/ra; ngày hôm nay được tô nền ở tiêu đề.', 'A <b>staff × 7 days</b> grid for the week. Each shift box shows the shift name and in/out times; today is highlighted in the header.'], rule: ['Báo cáo hiện <b>mọi nhân viên có ca</b> trong tuần, không chỉ nhân viên mình quản lý.', 'The report shows <b>every employee with a shift</b> in the week, not only your reports.'] },
      { on: 'app', h: 'legend', look: true, t: ['Vạch màu bên trái mỗi ô ca là <b>trạng thái báo cáo</b>: Chưa đến ca, Chấm công đúng giờ, Chưa vào/ra ca, Vào trễ/ra sớm, Nghỉ phép có lương, Nghỉ phép không lương.', 'The colour bar on the left of each box is the <b>report status</b>: Not yet due, On time, Missing in/out, Late in / early out, Paid leave, Unpaid leave.'], rule: ['Nghỉ phép không lương gồm: ca đánh dấu không lương; ngày đã qua không vào/ra; hoặc trễ/sớm vượt ngưỡng "tính nghỉ không lương".', 'Unpaid leave covers: shifts marked unpaid; past days with no in/out; or lateness/early leave beyond the "counted as unpaid leave" threshold.'] },
      { on: 'app', h: 'flt', look: true, t: ['Lọc theo <b>tuần</b>, <b>tên</b>, <b>địa điểm</b>, <b>ca</b>, <b>trạng thái</b> và nút <b>Hôm nay</b>.', 'Filter by <b>week</b>, <b>name</b>, <b>location</b>, <b>shift</b>, <b>status</b> and the <b>Today</b> button.'] },
      { on: 'app', h: 'sh-b-1', t: ['Bấm vào một ô có ca (Thu Bình, Thứ 3 13/10 — vạch vàng).', 'Tap a box with a shift (Thu Bình, Tue 13/10 — yellow bar).'], set: { sheet: 1 } },
      { on: 'app', h: 'sheet-info', look: true, t: ['Bảng chi tiết: ca, thời gian làm việc, từng lượt check in/out, chi nhánh và trạng thái <b>Vào trễ/ra sớm</b> (vào 08:25, vượt ngưỡng đi trễ). Chạm ra ngoài để đóng.', 'Details sheet: shift, working time, each check in/out round, branch and the status <b>Late in / early out</b> (in at 08:25, beyond the late threshold). Tap outside to close.'], rule: ['Với ca chưa ra ca, đang Đã duyệt/Chờ duyệt và ngày ≥ hôm nay, bảng này có thêm nút <b>Đổi ca</b>; ca Đã duyệt, chưa ra ca và đã qua giờ kết thúc có nút <b>Chấm công thủ công</b>.', 'For shifts not yet clocked out that are Approved/Pending with date ≥ today, the sheet also offers <b>Change shift</b>; Approved shifts not clocked out and past their end time offer <b>Manual attendance</b>.'], set: { sheet: 0 } },
      { on: 'app', h: 'add-an-5', look: true, t: ['Ô trống có dấu <b>⊕</b>: bấm để <b>Thêm ca</b> cho nhân viên vào ngày đó. Bấm vào <b>tên nhân viên</b> để mở lịch tuần của người đó.', 'Empty cells show <b>⊕</b>: tap to <b>Add a shift</b> for that employee on that day. Tap an <b>employee name</b> to open their weekly schedule.'] },
      { on: 'app', h: 'th-2', t: ['Bấm vào <b>tiêu đề ngày</b> (T4 14) để mở báo cáo theo giờ của ngày đó.', 'Tap a <b>day header</b> (We 14) to open that day\'s hourly report.'], set: { scr: 'hour' } },
      { on: 'app', h: 'tl', look: true, t: ['Màn <b>báo cáo theo giờ</b> của ngày 14/10 mở ra (xem hướng dẫn riêng).', 'The <b>hourly report</b> for 14/10 opens (see its own guide).'] }
    ],
    done: ['Bạn đã dùng được báo cáo tuần trên app để rà soát chấm công của nhân viên.', 'You can use the weekly report in the app to review staff attendance.'],
    rules: [
      ['Cần quyền TI000002.', 'Requires permission TI000002.'],
      ['Bấm ô trống → Thêm ca; bấm ô có ca → chi tiết (Đổi ca / Chấm công thủ công khi đủ điều kiện); bấm tên → lịch tuần NV; bấm tiêu đề ngày → báo cáo theo giờ.', 'Tap empty cell → Add shift; tap a shift → details (Change shift / Manual attendance when eligible); tap a name → that employee\'s week; tap a day header → hourly report.'],
      ['Trạng thái báo cáo dùng cùng quy tắc phân loại với màu trên Web.', 'Report statuses use the same classification rules as the Web colours.'],
      ['Hiện mọi nhân viên có ca, không chỉ người mình quản lý.', 'Shows every employee with a shift, not only your reports.']
    ]
  });

  HDSD.add({
    id: 'mgr-report-hour', tier: 3, ch: ['app'], icon: '🕒',
    title: ['App: Báo cáo lịch làm việc theo giờ (trong 1 ngày)', 'App: hourly staff schedule report (one day)'],
    sum: ['Dòng thời gian của một ngày: mỗi nhân viên một hàng, mỗi ca một khối màu theo trạng thái.', 'A one-day timeline: one row per employee, one coloured block per shift.'],
    who: ['Quản lý / Leader', 'Manager / Leader'],
    pre: ['Tài khoản có quyền TI000002; mở từ báo cáo theo tuần.', 'The account has permission TI000002; opened from the weekly report.'],
    init: { _app: W.mgr, scr: 'week', sheet: 0, day: 2 },
    app: (s) => (s.scr === 'hour' ? hourScr(s) : weekScr(s)),
    steps: [
      { on: 'app', h: 'th-2', t: ['Từ báo cáo theo tuần, bấm vào <b>tiêu đề ngày</b> cần xem (T4 14).', 'From the weekly report, tap the <b>header of the day</b> you want (We 14).'], set: { scr: 'hour' } },
      { on: 'app', h: 'day-lb', look: true, t: ['Tiêu đề cho biết ngày đang xem: <b>Thứ 4, 14/10/2026</b>.', 'The header shows the day being viewed: <b>Wed, 14/10/2026</b>.'] },
      { on: 'app', h: 'tl', look: true, t: ['<b>Dòng thời gian</b> trong ngày: mỗi nhân viên là một hàng, trục ngang là giờ.', 'The day\'s <b>timeline</b>: each employee is a row, the horizontal axis is the hour.'] },
      { on: 'app', h: 'bk-an', look: true, t: ['Mỗi ca là <b>một khối</b> trải từ giờ bắt đầu đến giờ kết thúc, tô màu theo trạng thái báo cáo (ở đây: đã vào chưa ra → Chưa vào/ra ca).', 'Each shift is <b>one block</b> from start to end time, coloured by report status (here: clocked in, not out → Missing in/out).'] },
      { on: 'app', h: 'bk-ot', look: true, t: ['Nhân viên có nhiều ca trong ngày sẽ có <b>nhiều khối</b> trên cùng một hàng (ví dụ thêm ca làm thêm giờ 17:00–19:00 chưa đến giờ).', 'An employee with several shifts that day has <b>several blocks</b> on the same row (e.g. an extra overtime shift 17:00–19:00 not yet due).'] },
      { on: 'app', h: 'flt', look: true, t: ['Lọc theo <b>địa điểm</b>, <b>nhân viên</b>, <b>trạng thái</b>.', 'Filter by <b>location</b>, <b>employee</b>, <b>status</b>.'] },
      { on: 'app', h: 'tl', t: ['<b>Vuốt ngang</b> để chuyển sang ngày kế tiếp.', '<b>Swipe horizontally</b> to move to the next day.'], set: { day: 3 } },
      { on: 'app', h: 'tl', look: true, t: ['Đang xem <b>Thứ 5, 15/10/2026</b>: các ca chưa tới nên có màu xám "Chưa đến ca".', 'Now viewing <b>Thu, 15/10/2026</b>: shifts are in the future so they are grey "Not yet due".'] }
    ],
    done: ['Bạn đã biết cách xem phân bố ca theo giờ trong một ngày.', 'You know how to view the hourly distribution of shifts in a day.'],
    rules: [
      ['Mỗi nhân viên một hàng, mỗi ca một khối theo giờ ca.', 'One row per employee, one block per shift along its hours.'],
      ['Lọc theo địa điểm, nhân viên, trạng thái; vuốt để chuyển ngày.', 'Filter by location, employee, status; swipe to change day.'],
      ['Màu khối theo trạng thái báo cáo giống báo cáo tuần.', 'Block colours follow the same report statuses as the weekly report.']
    ]
  });

  /* ---------- 12. Thông báo đẩy ---------- */
  const NT = () => t('Thông báo', 'Notification');
  HDSD.add({
    id: 'notifications', tier: 3, ch: ['app'], icon: '🔔',
    title: ['Thông báo đẩy: ai nhận gì, khi nào', 'Push notifications: who gets what, and when'],
    sum: ['Theo dõi tuần tự: nhân viên thao tác → quản lý nhận thông báo → quản lý xử lý → nhân viên nhận thông báo. Bấm thông báo để mở chi tiết lịch làm việc.', 'Follow the sequence: the employee acts → the manager is notified → the manager handles it → the employee is notified. Tap a notification to open the schedule details.'],
    who: ['Nhân viên & Quản lý trực tiếp', 'Staff & direct manager'],
    init: { _app: W.an, scr: 'an0', n: 1 },
    app: (s) => {
      const mN = [
        K.noti(NT(), K.m('Lê Văn An đã checkin vào lúc 07:55 của ca Ca sáng', 'Lê Văn An checked in at 07:55 for shift Ca sáng'), 'n1', s.n === 1),
        K.noti(NT(), K.m('Đang có lịch làm việc ngày 13/10/2026 của Phạm Thu Bình đang chờ xác nhận.', 'The schedule of Phạm Thu Bình on 13/10/2026 is waiting for confirmation.'), 'n2', 1),
        K.noti(NT(), K.m('Đang có lịch làm việc ngày 16/10/2026 của Lê Văn An đang chờ phê duyệt.', 'The schedule of Lê Văn An on 16/10/2026 is waiting for approval.'), 'n-wait', 1),
        K.noti(NT(), K.m('Đang có lịch làm việc thêm giờ ngày 15/10/2026 của Lê Văn An đang chờ phê duyệt.', 'The overtime schedule of Lê Văn An on 15/10/2026 is waiting for approval.'), 'n4', 1),
        K.noti(NT(), K.m('Đang có yêu cầu xin đi trễ / về sớm ngày 15/10/2026 của Phạm Thu Bình đang chờ phê duyệt.', 'A late-arrival / early-leave request of Phạm Thu Bình on 15/10/2026 is waiting for approval.'), 'n5', 1)];
      const aN = [
        K.noti(NT(), K.m('Lịch làm việc ngày 16/10/2026 của bạn đã được phê duyệt.', 'Your schedule on 16/10/2026 has been approved.'), 'n-appr', 1),
        K.noti(NT(), K.m('Lịch làm việc tuần 42 của bạn đã được phê duyệt.', 'Your schedule for week 42 has been approved.'), 'a2'),
        K.noti(NT(), K.m('Lịch làm việc ngày 15/10/2026 của bạn đã được phê duyệt đổi ca.', 'The shift change for your schedule on 15/10/2026 has been approved.'), 'a3'),
        K.noti(NT(), K.m('Đã đổi ca lịch làm việc ngày 15/10/2026 của bạn thành Ca chiều', 'Your schedule on 15/10/2026 has been changed to Ca chiều'), 'a4'),
        K.noti(NT(), K.m('Lịch làm việc ngày 15/10/2026 của bạn đã được phê duyệt đi sớm / về trễ.', 'The late/early request for your schedule on 15/10/2026 has been approved.'), 'a5'),
        K.noti(NT(), K.m('Lịch làm việc ngày 12/10/2026 của bạn đã được xác nhận giờ làm.', 'The working hours of your schedule on 12/10/2026 have been confirmed.'), 'a6'),
        K.noti(NT(), K.m('Lịch làm việc ngày 13/10/2026 của bạn đã được chấm công hộ.', 'Your schedule on 13/10/2026 has been clocked by proxy.'), 'a7')];
      const list = (arr) => '<div style="padding:10px" data-h="n-list"><b>' + t('Thông báo mới', 'New notifications') + '</b><div style="height:6px"></div>' + arr.join('') + '</div>';
      const friCard = (st) => K.sched({ h: 'd-card', day: K.dn(4) + ', ' + K.d(4), st, shift: K.sang(), time: '08:00 -> 17:00', est: '8' });
      if (s.scr === 'an0' || s.scr === 'an1') return K.app({ time: '07:55', raw: K.home({ name: K.P.an, tiles: ['llv', 'pg', 'month'], card: s.scr === 'an0' ? { sn: K.sang(), time: TM, btn: 'in' } : { sn: K.sang(), time: TM, laps: ['07:55 - '], btn: 'out' } }),
        dialog: s.scr === 'an1' ? { msg: K.m('Chấm công vào thành công', 'Clock-in successful') } : null });
      if (s.scr === 'mgr') return K.app({ time: '07:56', raw: K.home({ name: K.P.mgr, tiles: ['llv', 'pg', 'month'] }) + list(s.n === 1 ? mN.slice(0, 1) : mN) });
      if (s.scr === 'mdetail') return K.app({ time: '07:57', title: t('Chi tiết lịch làm việc', 'Schedule details'), body: K.acard('<b>' + t('Nhân viên', 'Employee') + ': ' + K.P.an + '</b>') + friCard('waiting'), bottom: K.abtn(t('Duyệt lịch làm việc', 'Approve schedule'), 'btn-approve'),
        dialog: s.ask ? K.confirmDlg(K.m('Đã duyệt thời gian làm việc', 'Working time approved'), 'dyes') : null });
      if (s.scr === 'adetail') return K.app({ time: '07:58', title: t('Chi tiết lịch làm việc', 'Schedule details'), body: friCard('approved') });
      return K.app({ time: '07:58', raw: K.home({ name: K.P.an, tiles: ['llv', 'pg', 'month'], card: { sn: K.sang(), time: TM, laps: ['07:55 - '], btn: 'out' } }) + list(aN) });
    },
    steps: [
      { on: 'app', h: 'btn-in', t: ['<b>Nhân viên</b> Lê Văn An bấm <b>Giờ vào</b> lúc 07:55.', '<b>Employee</b> Lê Văn An taps <b>Clock in</b> at 07:55.'], set: { scr: 'an1' } },
      { on: 'app', h: 'dclose', t: ['App báo "Chấm công vào thành công". Bấm <b>Đóng</b> — đồng thời máy chủ gửi thông báo cho quản lý trực tiếp.', 'The app says "Clock-in successful". Tap <b>Close</b> — meanwhile the server notifies the direct manager.'], set: { scr: 'mgr', _app: W.mgr, n: 1 } },
      { on: 'app', h: 'n1', look: true, t: ['Chuyển sang <b>app của quản lý</b> Trần Minh Quân: nhận ngay "<b>Lê Văn An đã checkin vào lúc 07:55 của ca Ca sáng</b>".', 'Switch to <b>the manager\'s app</b> (Trần Minh Quân): he immediately gets "<b>Lê Văn An checked in at 07:55 for shift Ca sáng</b>".'], rule: ['Người nhận là <b>quản lý trực tiếp</b> được khai báo trong hồ sơ nhân viên. Các thông báo chấm công là cố định trong hệ thống.', 'The recipient is the <b>direct manager</b> declared in the employee profile. Attendance notifications are fixed in the system.'], set: { n: 5 } },
      { on: 'app', h: 'n-list', look: true, t: ['5 loại thông báo <b>quản lý</b> nhận: (1) nhân viên chấm công vào; (2) ra ca lượt cuối → "đang chờ xác nhận"; (3) đăng ký ca / thêm ca / đổi ca cần duyệt → "đang chờ phê duyệt"; (4) đăng ký tăng ca → "lịch làm việc thêm giờ… đang chờ phê duyệt"; (5) xin đi trễ / về sớm.', 'The 5 notifications a <b>manager</b> receives: (1) employee clocks in; (2) clock-out of the last round → "waiting for confirmation"; (3) shift registration / adding / change needing approval → "waiting for approval"; (4) overtime registration → "overtime schedule… waiting for approval"; (5) late-arrival / early-leave request.'] },
      { on: 'app', h: 'n-wait', t: ['Bấm vào thông báo "…ngày 16/10/2026 của Lê Văn An đang chờ phê duyệt".', 'Tap the notification "…of Lê Văn An on 16/10/2026 is waiting for approval".'], rule: ['Bấm thông báo → mở thẳng <b>Chi tiết lịch làm việc</b> của ca đó.', 'Tapping a notification → opens the <b>Schedule details</b> of that shift directly.'], set: { scr: 'mdetail' } },
      { on: 'app', h: 'btn-approve', t: ['Ca đang <b>Chờ duyệt</b>, không kèm đơn đổi ca/đi muộn/về sớm → bấm <b>Duyệt lịch làm việc</b>.', 'The shift is <b>Pending approval</b> with no change/late/early request → tap <b>Approve schedule</b>.'], set: { ask: 1 } },
      { on: 'app', h: 'dyes', t: ['Bấm <b>Xác nhận</b> trong hộp thoại. Ca chuyển Đã duyệt và máy chủ gửi thông báo cho nhân viên.', 'Tap <b>Confirm</b> in the dialog. The shift becomes Approved and the server notifies the employee.'], set: { ask: 0, scr: 'an2', _app: W.an } },
      { on: 'app', h: 'n-list', look: true, t: ['Quay lại <b>app của nhân viên</b>: An nhận "<b>Lịch làm việc ngày 16/10/2026 của bạn đã được phê duyệt.</b>". Danh sách còn minh hoạ 6 loại khác nhân viên nhận: duyệt cả tuần, duyệt đổi ca, quản lý đổi ca hộ, duyệt đi trễ/về sớm, xác nhận giờ, chấm công hộ.', 'Back in <b>the employee\'s app</b>: An gets "<b>Your schedule on 16/10/2026 has been approved.</b>". The list also illustrates the 6 other staff notifications: whole-week approval, shift-change approval, manager changed the shift, late/early approval, hours confirmed, proxy attendance.'] },
      { on: 'app', h: 'n-appr', t: ['Bấm thông báo để mở chi tiết lịch làm việc của ca vừa được duyệt.', 'Tap the notification to open the details of the shift that was just approved.'], set: { scr: 'adetail' } }
    ],
    done: ['Bạn đã thấy trọn vòng thông báo giữa nhân viên và quản lý: 5 loại gửi cho quản lý, 7 loại gửi cho nhân viên.', 'You have seen the full notification loop between staff and manager: 5 types sent to managers, 7 types sent to staff.'],
    rules: [
      ['Quản lý nhận: "[Tên] đã checkin vào lúc [giờ] của ca [ca]"; "Đang có lịch làm việc ngày … của … đang chờ xác nhận."; "…đang chờ phê duyệt."; "Đang có lịch làm việc thêm giờ ngày … của … đang chờ phê duyệt."; "Đang có yêu cầu xin đi trễ / về sớm ngày … của … đang chờ phê duyệt."', 'Managers receive: "[Name] checked in at [time] for shift [shift]"; "The schedule on … of … is waiting for confirmation."; "…is waiting for approval."; "The overtime schedule on … of … is waiting for approval."; "A late / early request on … of … is waiting for approval."'],
      ['Nhân viên nhận: "Lịch làm việc ngày … của bạn đã được phê duyệt."; "Lịch làm việc tuần … của bạn đã được phê duyệt."; "…đã được phê duyệt đổi ca."; "Đã đổi ca lịch làm việc ngày … của bạn thành …"; "…đã được phê duyệt đi sớm / về trễ."; "…đã được xác nhận giờ làm."; "…đã được chấm công hộ."', 'Staff receive: "Your schedule on … has been approved."; "Your schedule for week … has been approved."; "…shift change has been approved."; "Your schedule on … has been changed to …"; "…late/early request has been approved."; "…working hours have been confirmed."; "…has been clocked by proxy."'],
      ['Bấm thông báo → mở chi tiết lịch làm việc.', 'Tap a notification → open the schedule details.'],
      ['Nội dung thông báo cố định trong hệ thống; màn "Cấu hình thông báo chấm công" trên Web không ảnh hưởng tới các thông báo này.', 'Notification content is fixed in the system; the Web "Attendance notification settings" screen does not affect them.']
    ]
  });

  /* ---------- 13. Phân quyền ---------- */
  HDSD.add({
    id: 'permissions', tier: 3, ch: ['app', 'web'], icon: '🔑',
    title: ['Phân quyền chấm công trên App và Web', 'Timekeeping permissions on App and Web'],
    sum: ['3 mã quyền TI000000 / TI000001 / TI000002 quyết định menu nào xuất hiện trên app; trên Web quyền dùng để ẩn/hiện nút và menu.', 'The 3 permission codes TI000000 / TI000001 / TI000002 decide which menus appear in the app; on the Web permissions show/hide buttons and menus.'],
    who: ['Admin / HR', 'Admin / HR'],
    init: { _app: W.mgr, _web: W.admin, p0: 0, p1: 0, p2: 0 },
    app: (s) => {
      const tiles = (s.p1 ? ['llv', 'pg', 'month'] : []).concat(s.p2 ? ['report'] : []).concat(s.p0 ? ['manage'] : []);
      const pill = (code, on) => '<span class="chip" style="background:' + (on ? '#2AA27E' : '#b9bdcc') + ';margin:2px">' + code + (on ? ' ✓' : ' ✕') + '</span>';
      const home = K.home({ name: K.P.mgr, tiles, card: s.p1 ? { sn: K.sang(), time: TM, btn: 'in' } : undefined });
      return K.app({ time: '07:50', raw: home + '<div style="padding:10px"><div class="acard" data-h="perm"><b>' + t('Minh hoạ: quyền của tài khoản', 'Illustration: account permissions') + '</b><div style="margin-top:6px">' + pill('TI000000', s.p0) + pill('TI000001', s.p1) + pill('TI000002', s.p2) + '</div><div style="font-size:11.5px;color:#888;margin-top:4px">' + t('(khung này không có trên app thật)', '(this box does not exist in the real app)') + '</div></div></div>' });
    },
    web: () => K.twsPage({ rows: [{ name: K.P.an, cells: [
      { h: 'c-an-0', sn: K.sang(), tm: '08:02 - 17:05', col: 'ok', st: 'confirmed' }, { h: 'c-an-1', sn: K.sang(), tm: '07:58 - 17:00', col: 'ok', st: 'nc' },
      { h: 'c-an-2', sn: K.sang(), tm: '--:-- - --:--', col: 'miss', st: 'approved', menu: K.cmenu(['detail', 'edit', 'add', 'attend', 'paid', 'unpaid', 'ot', '-', 'del']) }, { h: 'c-an-3', sn: K.sang(), tm: TM, col: 'future', st: 'approved' }, { add: 'add-an-4' }, null, null] }, binhRow()] }),
    steps: [
      { on: 'app', h: 'perm', look: true, t: ['App nhận danh sách quyền <b>từ máy chủ khi đăng nhập</b>. Tài khoản chưa có mã quyền chấm công nào → Home không có thẻ chấm công và không có menu chấm công.', 'The app receives the permission list <b>from the server at login</b>. An account without any timekeeping code → Home has no check-in card and no timekeeping menu.'], set: { p1: 1 } },
      { on: 'app', h: 'card', look: true, t: ['Cấp <b>TI000001</b> → xuất hiện <b>thẻ chấm công</b> ở Home (khi có ca hợp lệ của hôm nay).', 'Grant <b>TI000001</b> → the <b>check-in card</b> appears on Home (when there is a valid shift today).'] },
      { on: 'app', h: 'tiles', look: true, t: ['TI000001 cũng mở các menu <b>LLV</b> (lịch của tôi), <b>LLV nhân viên</b> (duyệt cho nhân viên), <b>Chấm công</b> (công tháng) và mục "Lịch sử chấm công" trong Tài khoản.', 'TI000001 also opens <b>LLV</b> (my schedule), <b>Staff schedule</b> (approve for staff), <b>Timekeeping</b> (monthly) and "Attendance history" under Account.'], rule: ['App không phân biệt quản lý và nhân viên: ai có TI000001 đều thấy menu "LLV nhân viên"; danh sách sẽ rỗng nếu không quản lý trực tiếp ai.', 'The app does not distinguish managers from staff: anyone with TI000001 sees "Staff schedule"; the list is empty if they manage nobody directly.'], set: { p0: 1 } },
      { on: 'app', h: 't-manage', look: true, t: ['Cấp <b>TI000000</b> → thêm menu <b>Lịch sử / Quản lý chấm công</b> (xem chấm công nhiều nhân viên).', 'Grant <b>TI000000</b> → adds <b>Attendance history / management</b> (view attendance of many employees).'], set: { p2: 1 } },
      { on: 'app', h: 't-report', look: true, t: ['Cấp <b>TI000002</b> → thêm menu <b>Báo cáo chấm công dành cho quản lý</b> (báo cáo tuần / theo giờ).', 'Grant <b>TI000002</b> → adds <b>Attendance report for managers</b> (weekly / hourly reports).'] },
      { on: 'web', h: 'menu', look: true, t: ['Trên <b>Web</b>, quyền dùng để <b>ẩn/hiện nút và menu</b> (ví dụ các mục trong menu ô ca). Ngoài quyền, từng mục còn có điều kiện riêng theo trạng thái ca.', 'On the <b>Web</b>, permissions <b>show/hide buttons and menus</b> (e.g. the items of the cell menu). Besides permissions, each item also has its own conditions based on the shift status.'], rule: ['"Duyệt lịch làm việc" chỉ hiện với quản lý trực tiếp; "Confirm working time" hiện với quản lý trực tiếp hoặc Admin khi bật "Cho phép Admin xác nhận ca làm việc" — Web có kiểm tra quyền này khi xác nhận.', '"Approve schedule" appears only for the direct manager; "Confirm working time" appears for the direct manager, or for Admin when "Allow Admin to confirm shifts" is on — the Web checks this permission when confirming.'], warn: ['Menu Web được lưu tạm: sau khi đổi quyền có thể phải xoá bộ nhớ tạm mới thấy thay đổi.', 'The Web menu is cached: after changing permissions you may need to clear the cache to see the change.'] }
    ],
    done: ['Bạn đã biết mỗi mã quyền mở ra phần nào trên app và vai trò của quyền trên Web.', 'You know what each permission code unlocks in the app and the role of permissions on the Web.'],
    rules: [
      ['TI000000 → menu "Lịch sử / Quản lý chấm công".', 'TI000000 → "Attendance history / management" menu.'],
      ['TI000001 → thẻ chấm công ở Home; menu "LLV", "LLV nhân viên", "Chấm công"; "Lịch sử chấm công" trong Tài khoản.', 'TI000001 → check-in card on Home; "LLV", "Staff schedule", "Timekeeping" menus; "Attendance history" under Account.'],
      ['TI000002 → "Báo cáo chấm công dành cho quản lý" (báo cáo tuần/giờ).', 'TI000002 → "Attendance report for managers" (weekly/hourly).'],
      ['Web: quyền chỉ dùng để ẩn/hiện nút và menu; menu được lưu tạm nên đổi quyền xong có thể cần xoá bộ nhớ tạm.', 'Web: permissions only show/hide buttons and menus; the menu is cached so a cache clear may be needed after changes.']
    ]
  });

  /* ---------- 14. Chốt lương khoá gì ---------- */
  HDSD.add({
    id: 'lock', tier: 3, ch: ['web'], icon: '🔒',
    title: ['Chốt lương khoá những thao tác nào', 'What closing the payroll locks'],
    sum: ['So sánh menu của cùng một ô ca trước và sau khi bảng lương của kỳ được chốt.', 'Compare the menu of the same shift cell before and after the period\'s payroll is closed.'],
    who: ['Admin / HR', 'Admin / HR'],
    pre: ['Bảng lương được tính và chốt ở module Lương nhân viên.', 'Payroll is calculated and closed in the Staff salary module.'],
    init: { _web: W.admin, menu: 0, closed: 0 },
    web: (s) => K.twsPage({ rows: [{ name: K.P.an, cells: [
      { h: 'c-an-0', sn: K.sang(), tm: '08:02 - 17:05', col: 'ok', st: 'confirmed' }, { h: 'c-an-1', sn: K.sang(), tm: '07:58 - 17:00', col: 'ok', st: 'nc' },
      { h: 'c-an-2', ch: 'cell-an-2', sn: K.sang(), tm: '--:-- - --:--', col: 'miss', st: 'approved', note: s.closed ? '🔒 ' + t('Đã chốt lương', 'Payroll closed') : '',
        menu: s.menu ? K.cmenu(s.closed ? ['detail', 'add', 'ot', '-', 'del'] : ['detail', 'edit', 'add', 'attend', 'paid', 'unpaid', 'ot', '-', 'del']) : '' },
      { h: 'c-an-3', sn: K.sang(), tm: TM, col: 'future', st: 'approved' }, { add: 'add-an-4' }, null, null] }, binhRow()] }),
    steps: [
      { on: 'web', h: 'c-an-2', t: ['<b>Trước khi chốt lương:</b> bấm <b>⋮</b> ở ô ca hôm nay của Lê Văn An (Đã duyệt, chưa chấm công).', '<b>Before closing:</b> click <b>⋮</b> on Lê Văn An\'s shift today (Approved, not clocked yet).'], set: { menu: 1 } },
      { on: 'web', h: 'menu', look: true, t: ['Menu đầy đủ: Chi tiết, <b>Chỉnh sửa</b>, Thêm ca làm việc, <b>Chấm công hộ</b>, <b>Nghỉ có lương</b>, <b>Nghỉ không lương</b>, Làm thêm giờ, Xoá.', 'Full menu: Details, <b>Edit</b>, Add shift, <b>Proxy attendance</b>, <b>Paid leave</b>, <b>Unpaid leave</b>, Overtime, Delete.'], rule: ['Điều kiện của 4 mục in đậm đều có "chưa chốt lương": Chỉnh sửa (ngày ≥ hôm nay, chưa vào ca); Chấm công hộ (ca Đã duyệt, ngày ≤ hôm nay, còn thiếu vào hoặc ra, không đánh dấu nghỉ); Nghỉ có/không lương (chưa vào và chưa ra).', 'All 4 bold items require "payroll not closed": Edit (date ≥ today, not clocked in); Proxy attendance (Approved, date ≤ today, missing in or out, not marked as leave); Paid/Unpaid leave (neither in nor out).'] },
      { on: 'web', h: 'cell-an-2', look: true, t: ['Giả sử bảng lương của kỳ chứa ngày này vừa được <b>Chốt</b>. Ca được gắn cờ "Đã chốt lương".', 'Suppose the payroll of the period containing this day has just been <b>closed</b>. The shift is flagged "Payroll closed".'], set: { menu: 0, closed: 1 } },
      { on: 'web', h: 'c-an-2', t: ['<b>Sau khi chốt lương:</b> bấm lại <b>⋮</b> trên cùng ô ca.', '<b>After closing:</b> click <b>⋮</b> on the same cell again.'], set: { menu: 1 } },
      { on: 'web', h: 'menu', look: true, t: ['Menu chỉ còn: Chi tiết, Thêm ca làm việc, Làm thêm giờ, Xoá. Các mục <b>Chỉnh sửa, Chấm công hộ, Nghỉ có lương, Nghỉ không lương</b> đã bị khoá (ẩn).', 'The menu now only has: Details, Add shift, Overtime, Delete. <b>Edit, Proxy attendance, Paid leave, Unpaid leave</b> are locked (hidden).'], rule: ['Chốt lương <b>khoá</b>: Chỉnh sửa, Chấm công hộ, Nghỉ có/không lương.', 'Closing the payroll <b>locks</b>: Edit, Proxy attendance, Paid/Unpaid leave.'] },
      { on: 'web', h: 'm-del', look: true, t: ['Lưu ý các thao tác <b>không bị khoá</b> sau khi chốt: Xoá ca, Làm thêm giờ, Thưởng/phạt, duyệt trễ/sớm.', 'Note the actions that are <b>not locked</b> after closing: Delete shift, Overtime, Rewards/fines, late/early approval.'], warn: ['Vì Xoá ca và Thưởng/phạt vẫn thao tác được, sau khi chốt lương hãy tránh thay đổi dữ liệu của kỳ đã chốt.', 'Because Delete and Rewards/fines still work, avoid changing data of a closed period after closing.'] }
    ],
    done: ['Bạn đã thấy sự khác nhau của menu ô ca trước và sau khi chốt lương.', 'You have seen how the cell menu differs before and after the payroll is closed.'],
    rules: [
      ['Bị khoá sau chốt lương: Chỉnh sửa, Chấm công hộ, Nghỉ có lương / Nghỉ không lương.', 'Locked after closing: Edit, Proxy attendance, Paid leave / Unpaid leave.'],
      ['Không bị khoá: Xoá ca, Làm thêm giờ, Thưởng/phạt, duyệt trễ/sớm.', 'Not locked: Delete shift, Overtime, Rewards/fines, late/early approval.']
    ]
  });
})();
