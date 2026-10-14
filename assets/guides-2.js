/* ===== TIER 2 — Chức năng quan trọng ===== */
(function () {
  const K = HDSD.K, t = K.t;

  /* ---------- dùng chung ---------- */
  const STAFF = () => ({
    an: { name: K.P.an, user: 'an.le', title: t('Nhân viên bán hàng', 'Sales staff') },
    binh: { name: K.P.binh, user: 'binh.pham', title: t('Nhân viên bán hàng', 'Sales staff') },
    chau: { name: 'Đỗ Minh Châu', user: 'chau.do', title: t('Nhân viên giao hàng', 'Delivery staff') }
  });
  const cfgPage = (tab, body, tools, over) => K.web({ nav: 'cfg', over, body: K.portlet(t('Cấu hình chấm công', 'Timekeeping settings'), tools || '', K.tabs([
    [t('Cấu hình chung', 'General settings'), 'tab-general', tab === 'general'], [t('Danh sách cấu hình chấm công', 'Check-in points'), 'tab-wifi', tab === 'wifi'],
    [t('Cấu hình chấm công linh động', 'Flexible check-in'), 'tab-free', tab === 'free'], [t('Danh sách nhân viên không cần duyệt lịch làm việc', 'Staff without schedule approval'), 'tab-approved', tab === 'approved'],
    [t('Cấu hình ngày phép còn lại', 'Remaining leave days'), 'tab-leave', tab === 'leave']]) + body) });
  const generalBody = () => [[t('Tính là đi trễ khi thời gian chấm công vào sau', 'Counted as late when clocking in after'), '15'], [t('Tính là về sớm khi thời gian chấm công ra trước', 'Counted as early when clocking out before'), '10'], [t('Được phép checkin trước', 'Check-in allowed before'), '30']]
    .map(([l, v]) => '<div class="form-row wide"><label>' + K.ck('', 1, l) + '</label><div>' + K.inp('', v, { w: 80 }) + '<span class="unit">' + t('Phút', 'Minutes') + '</span></div></div>').join('');
  const staffTab = (s, tab) => {
    const S = STAFF();
    const heads = ['#', t('Nhân viên', 'Employee'), t('Tài khoản', 'Account'), t('Chức vụ', 'Position'), t('Chi nhánh', 'Branch'), ''];
    const rows = s.list.length ? s.list.map((k, i) => ({ h: 'row-' + k, cls: s.neu === k ? 'new' : '', c: [i + 1, S[k].name, S[k].user, S[k].title, K.br1(), '<span class="icon-btn" data-h="del-' + k + '">🗑</span>'] })) :
      [{ c: ['', '<span style="color:#999">' + t('Chưa có nhân viên', 'No employees yet') + '</span>', '', '', '', ''] }];
    const cand = Object.keys(S).filter((k) => !s.list.includes(k));
    const over = s.modal ? K.modal({ title: t('Thêm nhân viên', 'Add employees'), body: K.table(['', t('Nhân viên', 'Employee'), t('Tài khoản', 'Account'), t('Chức vụ', 'Position'), t('Chi nhánh', 'Branch')], cand.map((k) => [K.ck('pick-' + k, s.pick === k), S[k].name, S[k].user, S[k].title, K.br1()]), 'cand'),
      foot: K.btn(t('HỦY', 'CANCEL'), '', 'btn-default') + K.btn(t('Thêm nhân viên vào cấu hình', 'Add employees to the setting'), 'save', 'btn-primary') }) : '';
    return cfgPage(tab, K.filter(['<input class="fc" readonly placeholder="' + t('Nhập tên nhân viên', 'Employee name') + '">', K.btn(t('TÌM KIẾM', 'SEARCH'), '', 'btn-primary')]) + K.table(heads, rows, 'list'), K.btn('+ ' + t('Thêm nhân viên', 'Add employee'), 'add'), over);
  };
  const C = (o) => Object.assign({ sn: K.sang(), tm: '08:00 - 17:00', st: 'approved', col: 'future' }, o);
  const PAST = (tm) => C({ tm: tm || '07:58 📱 - 17:03 📱', st: 'confirmed', col: 'ok' });
  const PLUS = { add: 'plus' };
  const binhRow = () => ({ name: K.P.binh, cells: [PAST(), PAST('07:55 📱 - 17:01 📱'), C({ tm: '07:57 📱 - --:--', col: 'miss' }), C({}), C({}), PLUS, PLUS] });

  /* =====================================================================
     1. CHẤM CÔNG KÈM ẢNH SELFIE
     ===================================================================== */
  HDSD.add({
    id: 'checkin-photo', tier: 2, ch: ['app'], icon: '🤳',
    title: ['Chấm công kèm ảnh selfie', 'Check in with a selfie'],
    sum: ['Khi bật cấu hình "Bắt buộc chấm công với ảnh", nhân viên phải chụp selfie bằng camera trước; ảnh được đóng dấu thông tin rồi mới gửi chấm công.', 'When "Require photo for check-in" is enabled, staff must take a selfie with the front camera; the photo is stamped with details before the check-in is sent.'],
    who: ['Nhân viên', 'Staff'],
    pre: ['Web › Cấu hình chung đã bật "Bắt buộc chấm công với ảnh"; hôm nay có ca Đã duyệt; đã cho app quyền vị trí và camera.', 'Web › General settings has "Require photo for check-in" enabled; there is an Approved shift today; the app has location and camera permission.'],
    init: { _app: K.WHO.an, scr: 'home', shot: 0, dlg: 0, inn: 0 },
    app: (s) => {
      if (s.scr === 'home') return K.app({ time: s.inn ? '07:56' : '07:55', raw: K.home({ name: K.P.an, card: { sn: K.sang(), time: '08:00 - 17:00', laps: s.inn ? ['07:55 - '] : [], btn: s.inn ? 'out' : 'in' } }) });
      const cam = s.shot ? '<div class="cam shot" data-h="cam"><div class="face"></div><div class="wm" data-h="wm">Check-in: ' + K.P.an + '<br>Time: 14/10/2026 07:55<br>Location: 10.777049, 106.700906<br>Distance: 20 m<br>Address: 12 Lê Lợi, Bến Nghé, Quận 1</div></div>' :
        '<div class="cam" data-h="cam"><div>📷<br><b>' + t('Chụp ảnh', 'Take photo') + '</b></div></div>';
      return K.app({ time: '07:55', title: t('Giờ vào', 'Clock in'),
        body: cam + '<div class="map" data-h="map"><div class="ring"></div><div class="pin">📍</div><div class="me"></div><div class="lbl">' + K.br1() + '</div></div>' +
          K.acard(K.akv(t('Thời gian checkin', 'Check-in time'), s.shot ? '14/10/2026 07:55' : ''), 'time'),
        bottom: K.abtn(t('Làm lại', 'Retake'), 'redo') + K.abtn(t('Thoát', 'Exit'), 'exit', 'sec'),
        dialog: s.dlg ? { msg: K.m('Chấm công vào thành công', 'Clock-in successful') } : null });
    },
    steps: [
      { on: 'app', h: 'card', look: true, t: ['Thẻ chấm công ở Home vẫn như bình thường: tên ca, thời gian và nút <b>Giờ vào</b>.', 'The check-in card on Home looks the same as usual: shift name, time and the <b>Clock in</b> button.'],
        rule: ['Cấu hình "Bắt buộc chấm công với ảnh" <b>tắt</b>: bấm nút là app lấy GPS và gửi ngay. <b>Bật</b>: bấm nút sẽ mở màn chụp ảnh.', 'With "Require photo for check-in" <b>off</b>, tapping the button gets the GPS position and sends immediately. With it <b>on</b>, tapping opens the photo screen.'] },
      { on: 'app', h: 'btn-in', t: ['Bấm <b>Giờ vào</b>.', 'Tap <b>Clock in</b>.'], set: { scr: 'cam' } },
      { on: 'app', h: 'map', look: true, t: ['Màn <b>Giờ vào</b> gồm khung ảnh và bản đồ hiển thị vị trí của tôi cùng điểm làm việc.', 'The <b>Clock in</b> screen has a photo frame and a map showing my position and the workplace.'],
        rule: ['Định vị tắt → "Vui lòng bật Dịch vụ Định vị…"; chưa cấp quyền → app giải thích mục đích rồi xin quyền. Ở chế độ chụp ảnh, nhân viên <b>linh động</b> không cần GPS.', 'Location off → "Vui lòng bật Dịch vụ Định vị…" (please turn on Location Services); no permission → the app explains the purpose and asks for it. In photo mode, <b>flexible</b> staff do not need GPS.'] },
      { on: 'app', h: 'cam', t: ['Bấm <b>Chụp ảnh</b> và chụp selfie.', 'Tap <b>Take photo</b> and take a selfie.'],
        rule: ['Chỉ dùng <b>camera trước</b>, không cho chọn ảnh có sẵn. App đóng dấu thông tin lên ảnh → tải ảnh lên → gửi chấm công. Máy chủ vẫn kiểm tra khung giờ và wifi/GPS như chấm công thường.', 'Only the <b>front camera</b> is used; picking an existing photo is not allowed. The app stamps the photo → uploads it → sends the check-in. The server still checks the time window and wifi/GPS as for a normal check-in.'],
        set: { shot: 1, dlg: 1 } },
      { on: 'app', h: 'dclose', t: ['Hệ thống báo chấm công vào thành công. Bấm <b>Đóng</b>.', 'The system reports a successful clock-in. Tap <b>Close</b>.'],
        rule: ['Mất mạng → "Kiểm tra kết nối mạng!". App không có chế độ offline (không lưu tạm để gửi sau).', 'No network → "Kiểm tra kết nối mạng!" (check your network connection). The app has no offline mode (nothing is queued to send later).'],
        set: { dlg: 0 } },
      { on: 'app', h: 'wm', look: true, t: ['Ảnh đã được <b>đóng dấu</b>: họ tên, ngày giờ, toạ độ, khoảng cách tới điểm làm việc và địa chỉ.', 'The photo is <b>stamped</b> with: full name, date and time, coordinates, distance to the workplace and address.'],
        rule: ['Nội dung dấu: Check-in/Check-out: [họ tên] — Time: [ngày giờ] — Location: [tọa độ] — Distance: [khoảng cách] m — Address: [địa chỉ].', 'Stamp content: Check-in/Check-out: [full name] — Time: [date time] — Location: [coordinates] — Distance: [distance] m — Address: [address].'] },
      { on: 'app', h: 'time', look: true, t: ['Dòng <b>Thời gian checkin</b> hiển thị theo giờ máy chủ trả về.', 'The <b>Check-in time</b> line shows the time returned by the server.'] },
      { on: 'app', h: 'redo', look: true, t: ['Nếu ảnh chưa đạt, bấm <b>Làm lại</b> để chụp lại và gửi lại.', 'If the photo is not good, tap <b>Retake</b> to shoot and send again.'],
        rule: ['"Làm lại" <b>ghi đè</b> lần vừa chấm và tăng bộ đếm số lần thử lại.', '"Retake" <b>overwrites</b> the check-in just made and increases the retry counter.'] },
      { on: 'app', h: 'exit', t: ['Bấm <b>Thoát</b> để về Home.', 'Tap <b>Exit</b> to go back to Home.'], set: { scr: 'home', inn: 1 } },
      { on: 'app', h: 'btn-out', look: true, t: ['Thẻ ghi "Lần 1: 07:55 –" và đổi sang nút <b>Giờ ra</b>. Khi ra ca cũng chụp ảnh theo đúng trình tự này.', 'The card shows "Round 1: 07:55 –" and switches to <b>Clock out</b>. Clocking out follows the same photo sequence.'] }
    ],
    done: ['Bạn đã chấm công vào kèm ảnh selfie có đóng dấu thông tin.', 'You have clocked in with a stamped selfie.'],
    rules: [
      ['Chỉ camera trước; không chọn ảnh có sẵn.', 'Front camera only; existing photos cannot be chosen.'],
      ['Ảnh được đóng dấu họ tên, thời gian, toạ độ, khoảng cách, địa chỉ.', 'The photo is stamped with name, time, coordinates, distance and address.'],
      ['"Làm lại" ghi đè lần vừa chấm.', '"Retake" overwrites the check-in just made.'],
      ['Chế độ ảnh: nhân viên linh động không cần GPS. Chế độ không ảnh: luôn cần GPS.', 'Photo mode: flexible staff do not need GPS. No-photo mode: GPS is always required.'],
      ['Không có nhận diện khuôn mặt, không kiểm tra thiết bị lạ.', 'There is no face recognition and no unknown-device check.']
    ]
  });

  /* =====================================================================
     2. NHÂN VIÊN CHẤM CÔNG LINH ĐỘNG
     ===================================================================== */
  HDSD.add({
    id: 'flex-staff', tier: 2, ch: ['web'], icon: '🧭',
    title: ['Nhân viên chấm công linh động', 'Flexible check-in staff'],
    sum: ['Khai báo danh sách nhân viên được miễn kiểm tra wifi/GPS khi chấm công (ví dụ nhân viên đi thị trường).', 'Maintain the list of staff exempt from the wifi/GPS check when clocking in (e.g. field staff).'],
    who: ['Admin / HR', 'Admin / HR'],
    init: { _web: K.WHO.admin, tab: 'general', list: ['binh'], modal: 0, pick: '', neu: '' },
    web: (s) => (s.tab === 'general' ? cfgPage('general', generalBody(), K.btn(t('Lưu thông tin', 'Save'), '')) : staffTab(s, 'free')),
    steps: [
      { on: 'web', h: 'tab-free', t: ['Vào <b>Chấm công → Cấu hình chấm công</b>, mở tab <b>Cấu hình chấm công linh động</b>.', 'Go to <b>Timekeeping → Timekeeping settings</b> and open the <b>Flexible check-in</b> tab.'], set: { tab: 'free' } },
      { on: 'web', h: 'list', look: true, t: ['Đây là danh sách nhân viên đang được <b>miễn kiểm tra wifi/GPS</b>.', 'This is the list of staff currently <b>exempt from the wifi/GPS check</b>.'],
        rule: ['Khi chấm công (cả vào và ra), nhân viên linh động bỏ qua toàn bộ bước kiểm tra điểm chấm công của chi nhánh.', 'When clocking in or out, flexible staff skip the whole branch check-in point verification.'] },
      { on: 'web', h: 'add', t: ['Bấm <b>Thêm nhân viên</b>.', 'Click <b>Add employee</b>.'], set: { modal: 1 } },
      { on: 'web', h: 'pick-an', t: ['Tick chọn nhân viên cần thêm (có thể chọn nhiều người).', 'Tick the employees to add (several can be selected).'], set: { pick: 'an' } },
      { on: 'web', h: 'save', t: ['Bấm <b>Thêm nhân viên vào cấu hình</b>.', 'Click <b>Add employees to the setting</b>.'], set: function (s) { s.modal = 0; s.list.push('an'); s.neu = 'an'; s.pick = ''; } },
      { on: 'web', h: 'row-an', look: true, t: ['Lê Văn An đã vào danh sách. Từ giờ An chấm công ở đâu cũng hợp lệ về vị trí.', 'Lê Văn An is now on the list. From now on An can clock in from anywhere as far as location is concerned.'],
        rule: ['Chỉ miễn kiểm tra <b>vị trí</b>. Các kiểm tra khung giờ ("Được phép checkin trước", "Tính là đi trễ…") vẫn áp dụng. Trên Lịch sử chấm công, hình thức ghi là <b>Linh động</b>.', 'Only the <b>location</b> check is waived. Time-window checks ("Check-in allowed before", "Counted as late…") still apply. In Attendance history the method is shown as <b>Flexible</b>.'],
        warn: ['Nếu tắt "Bắt buộc chấm công với ảnh", app vẫn luôn cần lấy được GPS của máy, kể cả với nhân viên linh động.', 'If "Require photo for check-in" is off, the app always needs to obtain the device GPS, even for flexible staff.'] },
      { on: 'web', h: 'del-binh', t: ['Muốn bỏ một người khỏi danh sách, bấm biểu tượng <b>thùng rác</b> ở dòng đó.', 'To remove someone from the list, click the <b>trash</b> icon on that row.'], set: function (s) { s.list = ['an']; s.neu = ''; } },
      { on: 'web', h: 'list', look: true, t: ['Phạm Thu Bình đã bị bỏ khỏi danh sách và quay về phải kiểm tra wifi/GPS như bình thường.', 'Phạm Thu Bình has been removed and is back to the normal wifi/GPS check.'] }
    ],
    done: ['Bạn đã thêm và bỏ nhân viên khỏi danh sách chấm công linh động.', 'You have added and removed staff from the flexible check-in list.'],
    rules: [
      ['Nhân viên linh động được miễn kiểm tra wifi/GPS khi chấm công vào và ra.', 'Flexible staff are exempt from the wifi/GPS check when clocking in and out.'],
      ['Các giới hạn về giờ (vào sớm, vào trễ) vẫn áp dụng.', 'Time limits (too early, too late) still apply.'],
      ['Bỏ khỏi danh sách → quay về kiểm tra vị trí theo điểm chấm công của chi nhánh làm việc.', 'Removing someone → back to the location check against the working branch\'s check-in points.']
    ]
  });

  /* =====================================================================
     3. NHÂN VIÊN KHÔNG CẦN DUYỆT LỊCH
     ===================================================================== */
  HDSD.add({
    id: 'noapprove-staff', tier: 2, ch: ['web', 'app'], icon: '⚡',
    title: ['Nhân viên không cần duyệt lịch', 'Staff without schedule approval'],
    sum: ['Nhân viên trong danh sách này gửi yêu cầu lịch trên app (đăng ký ca, thêm ca, đổi ca, xin trễ/sớm, tăng ca) sẽ được tự động duyệt.', 'Schedule requests sent from the app by staff on this list (register shift, add shift, change shift, late/early, overtime) are approved automatically.'],
    who: ['Admin / HR', 'Admin / HR'],
    init: { _web: K.WHO.admin, _app: K.WHO.an, tab: 'general', list: [], modal: 0, pick: '', neu: '', added: 0 },
    web: (s) => (s.tab === 'general' ? cfgPage('general', generalBody(), K.btn(t('Lưu thông tin', 'Save'), '')) : staffTab(s, 'approved')),
    app: (s) => K.app({ title: t('Lịch làm việc', 'Work schedule'), right: '<button>＋</button>',
      body: K.weekh() + K.sched({ h: 'c-today', day: K.dn(2) + ', ' + K.d(2), st: 'approved', shift: K.sang(), time: '08:00 -> 17:00', est: 8 }) +
        (s.added ? K.sched({ h: 'c-new', isNew: 1, day: K.dn(4) + ', ' + K.d(4), st: 'approved', shift: K.sang(), time: '08:00 -> 17:00', est: 8 }) : '') }),
    steps: [
      { on: 'web', h: 'tab-approved', t: ['Vào <b>Cấu hình chấm công</b>, mở tab <b>Danh sách nhân viên không cần duyệt lịch làm việc</b>.', 'In <b>Timekeeping settings</b>, open the <b>Staff without schedule approval</b> tab.'], set: { tab: 'approved' } },
      { on: 'web', h: 'add', t: ['Bấm <b>Thêm nhân viên</b>.', 'Click <b>Add employee</b>.'], set: { modal: 1 } },
      { on: 'web', h: 'pick-an', t: ['Tick chọn nhân viên ngay trong danh sách đang hiển thị.', 'Tick the employee directly in the list shown.'],
        warn: ['Ở popup của tab này, không nên dùng ô tìm kiếm hay chuyển trang: danh sách có thể hiển thị sai tiêu chí.', 'In this tab\'s popup, avoid the search box and paging: the list may be shown with the wrong criteria.'], set: { pick: 'an' } },
      { on: 'web', h: 'save', t: ['Bấm <b>Thêm nhân viên vào cấu hình</b>.', 'Click <b>Add employees to the setting</b>.'], set: function (s) { s.modal = 0; s.list = ['an']; s.neu = 'an'; s.pick = ''; } },
      { on: 'web', h: 'row-an', look: true, t: ['Lê Văn An đã nằm trong danh sách không cần duyệt lịch.', 'Lê Văn An is now on the no-approval list.'],
        rule: ['Mọi yêu cầu của người này trên app — đăng ký ca, thêm ca, đổi ca, xin đi trễ/về sớm, tăng ca — được <b>tự động duyệt</b>.', 'Every app request from this person — register shift, add shift, change shift, late/early request, overtime — is <b>approved automatically</b>.'],
        set: { added: 1 } },
      { on: 'app', h: 'c-new', look: true, t: ['Trên app, An vừa tự thêm ca cho Thứ 6 16/10: ca vào thẳng trạng thái <b>Đã duyệt</b>, không phải chờ quản lý.', 'In the app, An has just added a shift for Fri 16/10: it goes straight to <b>Approved</b> without waiting for the manager.'],
        rule: ['Nhân viên thường: ca tự đăng ký ở trạng thái <b>Chờ duyệt</b> và chưa chấm công được. Nhân viên không cần duyệt: <b>Đã duyệt</b> ngay.', 'Regular staff: a self-registered shift is <b>Pending approval</b> and cannot be clocked yet. No-approval staff: <b>Approved</b> immediately.'],
        warn: ['Thông báo "đang chờ phê duyệt" vẫn được gửi cho quản lý dù lịch đã được tự duyệt.', 'The "pending approval" notification is still sent to the manager even though the schedule was auto-approved.'] },
      { on: 'web', h: 'del-an', look: true, t: ['Muốn người này quay lại quy trình duyệt, bấm biểu tượng <b>thùng rác</b> để bỏ khỏi danh sách.', 'To put this person back into the approval flow, click the <b>trash</b> icon to remove them from the list.'] }
    ],
    done: ['Bạn đã đưa nhân viên vào danh sách không cần duyệt lịch và thấy yêu cầu trên app được tự duyệt.', 'You have added an employee to the no-approval list and seen an app request get auto-approved.'],
    rules: [
      ['Tự duyệt áp dụng cho: đăng ký ca, thêm ca, đổi ca, xin trễ/sớm, tăng ca.', 'Auto-approval covers: shift registration, adding a shift, shift change, late/early requests, overtime.'],
      ['Chỉ ca "Đã duyệt" mới hiện ở thẻ chấm công; tự duyệt giúp ca không bị ẩn trong lúc chờ.', 'Only "Approved" shifts appear on the check-in card; auto-approval keeps the shift from being hidden while waiting.'],
      ['Thêm/bỏ nhân viên tương tự tab chấm công linh động.', 'Adding/removing staff works the same as on the flexible check-in tab.']
    ]
  });

  /* =====================================================================
     4. THÊM NHÂN VIÊN VÀO CA (TAB THEO CA)
     ===================================================================== */
  const shiftGrid = (s) => {
    const names = (i) => {
      const l = [];
      if (s.saved && i < 5) l.push(K.P.an);
      if ((i === 1) || (s.saved && i < 5)) l.push(K.P.binh);
      return l;
    };
    return '<table class="grid-tws" data-h="grid"><thead><tr><th class="staff">' + t('Ca làm việc', 'Shift') + '</th>' + [0, 1, 2, 3, 4, 5, 6].map((i) => '<th class="' + (i === 2 ? 'today' : '') + '">' + K.dn(i) + '<br>' + (12 + i) + '/10</th>').join('') + '</tr></thead><tbody><tr><td><div class="staff-cell" style="position:relative"><div style="flex:1"><div class="nm">' + K.sang() + '</div><div class="sub">08:00 - 17:00</div><div class="sub">' + t('T2 – T6', 'Mon – Fri') + '</div></div><span class="icon-btn" data-h="sh-menu">⋮</span>' +
      (s.menu ? '<div class="dropdown lft" style="top:24px"><button data-h="m-addstaff"><span>＋</span>' + t('Thêm nhân viên', 'Add employees') + '</button></div>' : '') + '</div></td>' +
      [0, 1, 2, 3, 4, 5, 6].map((i) => { const l = names(i); return '<td>' + (l.length ? '<div class="cell' + (s.saved && !(i === 1 && l.length === 1) ? ' new' : '') + '" style="background:#eef3fb" data-h="col-' + i + '">' + l.map((n) => '<div>• ' + n + '</div>').join('') + '</div>' : '<div class="cell" style="background:#fafbfc;color:#b5b9cc" data-h="col-' + i + '">—</div>') + '</td>'; }).join('') + '</tr></tbody></table>';
  };
  HDSD.add({
    id: 'staff-to-shift', tier: 2, ch: ['web'], icon: '👥',
    title: ['Thêm nhân viên vào ca (tab Theo ca)', 'Add employees to a shift (By shift tab)'],
    sum: ['Xếp một ca cho nhiều nhân viên cùng lúc trong khoảng ngày đang xem, thay vì thêm từng ô.', 'Assign one shift to several employees at once for the date range on screen, instead of cell by cell.'],
    who: ['Admin / HR, Quản lý', 'Admin / HR, Manager'],
    init: { _web: K.WHO.admin, by: 0, menu: 0, modal: 0, pa: 0, pb: 0, br: 0, saved: 0 },
    web: (s) => {
      if (!s.by) return K.twsPage({ rows: [{ name: K.P.an, cells: [PLUS, PLUS, PLUS, PLUS, PLUS, PLUS, PLUS] }, { name: K.P.binh, cells: [PLUS, PAST('07:55 📱 - 17:01 📱'), PLUS, PLUS, PLUS, PLUS, PLUS] }] });
      const row = (k, name, on) => [K.ck('pick-' + k, on), name, K.sel('br-' + k, on && (k !== 'an' || s.br) ? K.br1() : '', { ph: t('Chọn chi nhánh', 'Select branch'), dis: !on }), K.ck('ot-' + k, 0), K.inp('coef-' + k, '1', { w: 70 })];
      const over = s.modal ? K.modal({ size: 'lg', title: t('Thêm nhân viên vào ca', 'Add employees to shift') + ' · ' + K.sang(),
        body: K.table(['', t('Nhân viên', 'Employee'), t('Chi nhánh', 'Branch'), t('Tăng ca', 'Overtime'), t('Hệ số công', 'Work coefficient')], [row('an', K.P.an, s.pa), row('binh', K.P.binh, s.pb)], 'cand'),
        foot: K.btn(t('HỦY', 'CANCEL'), '', 'btn-default') + K.btn(t('CHỌN', 'SELECT'), 'save', 'btn-primary') }) : '';
      return K.twsPage({ byShift: 1, grid: shiftGrid(s), over });
    },
    steps: [
      { on: 'web', h: 'tab-shift', t: ['Ở màn <b>Lịch làm việc</b>, chuyển sang tab <b>Theo ca</b>.', 'On the <b>Work schedule</b> screen, switch to the <b>By shift</b> tab.'], set: { by: 1 } },
      { on: 'web', h: 'grid', look: true, t: ['Mỗi hàng là một ca; mỗi ô liệt kê nhân viên làm ca đó trong ngày. Tuần này mới có Bình làm Thứ 3.', 'Each row is a shift; each cell lists the staff working it that day. This week only Bình works on Tuesday.'] },
      { on: 'web', h: 'sh-menu', t: ['Bấm menu <b>⋮</b> của ca.', 'Click the shift\'s <b>⋮</b> menu.'], set: { menu: 1 } },
      { on: 'web', h: 'm-addstaff', t: ['Chọn <b>Thêm nhân viên</b>.', 'Choose <b>Add employees</b>.'], set: { menu: 0, modal: 1 } },
      { on: 'web', h: 'pick-an', t: ['Tick nhân viên thứ nhất.', 'Tick the first employee.'], set: { pa: 1 } },
      { on: 'web', h: 'pick-binh', t: ['Tick thêm nhân viên khác — chọn được nhiều người một lúc.', 'Tick another employee — several can be selected at once.'], set: { pb: 1 } },
      { on: 'web', h: 'br-an', t: ['Với mỗi người, chọn <b>Chi nhánh</b> làm việc.', 'For each person, choose the working <b>Branch</b>.'],
        rule: ['Mỗi nhân viên chọn riêng: chi nhánh, có/không tăng ca, hệ số công. Chi nhánh làm việc quyết định điểm wifi/GPS dùng để kiểm tra khi chấm công.', 'Each employee has their own branch, overtime flag and work coefficient. The working branch decides which wifi/GPS points are used at check-in.'],
        set: { br: 1 } },
      { on: 'web', h: 'coef-an', look: true, t: ['Kiểm tra <b>Hệ số công</b> (mặc định theo ca) và ô <b>Tăng ca</b> nếu đây là ca OT.', 'Check the <b>Work coefficient</b> (defaults from the shift) and the <b>Overtime</b> box if this is an OT shift.'] },
      { on: 'web', h: 'save', t: ['Bấm <b>CHỌN</b> để áp dụng cho khoảng ngày đang xem.', 'Click <b>SELECT</b> to apply to the date range on screen.'],
        rule: ['Hệ thống tự <b>bỏ qua</b>: thứ mà ca không áp dụng, ngày nhân viên đã có ca trùng giờ, và ngày lễ.', 'The system automatically <b>skips</b>: weekdays the shift does not apply to, days where the employee already has an overlapping shift, and public holidays.'],
        set: { modal: 0, saved: 1 } },
      { on: 'web', h: 'col-1', look: true, t: ['An và Bình đã có ca từ Thứ 2 đến Thứ 6. Thứ 3 Bình đã có ca trùng giờ nên không tạo thêm; Thứ 7, Chủ nhật bị bỏ qua vì ca chỉ áp dụng T2–T6.', 'An and Bình now have the shift Monday to Friday. Bình already had an overlapping shift on Tuesday so nothing was added; Saturday and Sunday were skipped because the shift only applies Mon–Fri.'],
        rule: ['Ca do Admin/Quản lý thêm trên Web vào thẳng trạng thái <b>Đã duyệt</b>.', 'Shifts added on the Web by Admin/Manager go straight to <b>Approved</b>.'] }
    ],
    done: ['Bạn đã thêm nhiều nhân viên vào một ca cho cả tuần đang xem.', 'You have added several employees to one shift for the whole week on screen.'],
    rules: [
      ['Áp dụng cho khoảng ngày đang xem (tuần/tháng).', 'Applies to the date range on screen (week/month).'],
      ['Tự bỏ qua: thứ không áp dụng, ngày trùng giờ với ca đã có, ngày lễ.', 'Automatically skips: non-applicable weekdays, days overlapping an existing shift, public holidays.'],
      ['Xoá nhân viên khỏi ca ở màn Theo ca bị chặn nếu nhân viên đã chấm vào/ra trong khoảng ngày đó.', 'Removing an employee from a shift on the By shift screen is blocked if they have already clocked in/out in that range.']
    ]
  });

  /* =====================================================================
     5. THÊM LỊCH LÀM VIỆC TUẦN (SAO CHÉP TUẦN GẦN NHẤT)
     ===================================================================== */
  const WK43 = () => t('Tuần 43 (19/10/2026 - 25/10/2026)', 'Week 43 (19/10/2026 - 25/10/2026)');
  HDSD.add({
    id: 'app-copy-week', tier: 2, ch: ['app'], icon: '🗓',
    title: ['Thêm lịch làm việc cả tuần trên app', 'Add a whole week of shifts in the app'],
    sum: ['Khi tuần đang xem chưa có lịch, nhân viên tạo nhanh bằng cách lấy lại lịch của tuần gần nhất rồi chỉnh sửa.', 'When the week on screen has no schedule, staff create one quickly by reusing the most recent week and editing it.'],
    who: ['Nhân viên', 'Staff'],
    init: { _app: K.WHO.an, scr: 'empty' },
    app: (s) => {
      const day = (i) => K.dn(i) + ', ' + (19 + i) + '/10/2026';
      if (s.scr === 'mgr') return K.app({ raw: K.home({ name: K.P.mgr, noti: [K.noti(t('Lịch làm việc', 'Work schedule'), K.m('Đang có lịch làm việc ngày 19/10/2026 của Lê Văn An đang chờ phê duyệt.', 'A work schedule on 19/10/2026 of Lê Văn An is waiting for approval.'), 'noti', 1)] }) });
      if (s.scr === 'add') return K.app({ title: t('Thêm lịch làm việc', 'Add work schedule'),
        body: '<div data-h="rows">' + [0, 1, 2, 3, 4].map((i) => K.acard('<div style="display:flex;align-items:center;gap:6px"><div style="flex:1"><b>' + day(i) + '</b><div style="font-size:12px;color:#555">' + K.sang() + ' (08:00 -> 17:00) · ' + K.br1() + '</div></div><span data-h="edit-' + i + '">✎</span><span data-h="dup-' + i + '">⧉</span></div>')).join('') + '</div>',
        bottom: K.abtn(t('Lưu', 'Save'), 'save') });
      return K.app({ title: t('Lịch làm việc', 'Work schedule'), right: '<button>＋</button>',
        body: K.weekh(WK43()) + (s.scr === 'empty' ? K.acard('<div style="text-align:center;color:#999">' + t('Không có lịch làm việc', 'No work schedule') + '</div>' + '<div style="height:8px"></div>' + K.abtn(t('Thêm', 'Add'), 'add-week'), 'empty') :
          [0, 1, 2, 3, 4].map((i) => K.sched({ h: 'c-' + i, isNew: 1, day: day(i), st: 'waiting', shift: K.sang(), time: '08:00 -> 17:00', est: 8 })).join('')) });
    },
    steps: [
      { on: 'app', h: 'empty', look: true, t: ['Mở <b>LLV</b> và chuyển tới tuần cần đăng ký. Tuần 43 chưa có lịch nên app hiện nút <b>Thêm</b>.', 'Open <b>LLV</b> and move to the week to register. Week 43 has no schedule, so the app shows an <b>Add</b> button.'] },
      { on: 'app', h: 'add-week', t: ['Bấm <b>Thêm</b> để mở màn <b>Thêm lịch làm việc</b>.', 'Tap <b>Add</b> to open the <b>Add work schedule</b> screen.'], set: { scr: 'add' } },
      { on: 'app', h: 'rows', look: true, t: ['Hệ thống đã điền sẵn các ca dựa trên <b>tuần gần nhất đã có lịch</b>, dời sang tuần đang xem.', 'The system has pre-filled the shifts from the <b>most recent week that has a schedule</b>, moved to the week on screen.'],
        rule: ['Các ca <b>tăng ca</b> của tuần cũ không được lấy theo.', '<b>Overtime</b> shifts from the old week are not copied.'] },
      { on: 'app', h: 'edit-4', look: true, t: ['Có thể <b>sửa</b> từng dòng (ca, chi nhánh, giờ) hoặc <b>nhân bản</b> một dòng sang ngày khác trước khi lưu.', 'You can <b>edit</b> each row (shift, branch, hours) or <b>duplicate</b> a row to another day before saving.'] },
      { on: 'app', h: 'save', t: ['Bấm <b>Lưu</b> để gửi cả tuần.', 'Tap <b>Save</b> to submit the whole week.'],
        rule: ['Danh sách rỗng → "Vui lòng nhập thời gian làm việc". Trùng giờ với ca đã có → "Thời gian làm việc đã trùng với lịch khác".', 'Empty list → "Vui lòng nhập thời gian làm việc" (please enter working time). Overlap with an existing shift → "Thời gian làm việc đã trùng với lịch khác" (working time overlaps another schedule).'],
        set: { scr: 'list' } },
      { on: 'app', h: 'c-0', look: true, t: ['Các ca của tuần được tạo ở trạng thái <b>Chờ duyệt</b>.', 'The week\'s shifts are created as <b>Pending approval</b>.'],
        rule: ['Ca "Chờ duyệt" chưa chấm công được. Nếu nhân viên thuộc danh sách "không cần duyệt lịch" thì ca vào thẳng <b>Đã duyệt</b>.', 'A "Pending approval" shift cannot be clocked yet. If the employee is on the "no approval" list, the shift goes straight to <b>Approved</b>.'],
        set: { scr: 'mgr', _app: K.WHO.mgr } },
      { on: 'app', h: 'noti', look: true, t: ['Phía quản lý trực tiếp nhận thông báo có lịch đang chờ phê duyệt; bấm thông báo để mở chi tiết lịch làm việc.', 'The direct manager receives a notification that a schedule is waiting for approval; tapping it opens the schedule details.'] }
    ],
    done: ['Bạn đã đăng ký lịch cả tuần bằng cách lấy lại lịch tuần gần nhất. Tiếp theo quản lý cần duyệt.', 'You have registered a whole week by reusing the most recent week. Next, the manager needs to approve it.'],
    rules: [
      ['Chỉ dùng được khi tuần đang xem chưa có lịch.', 'Only available when the week on screen has no schedule.'],
      ['Lấy lịch của tuần gần nhất đã có, bỏ ca tăng ca.', 'Takes the most recent week with a schedule, without overtime shifts.'],
      ['Mọi ca gửi lên ở trạng thái Chờ duyệt (hoặc tự duyệt với nhân viên không cần duyệt lịch).', 'All submitted shifts are Pending approval (or auto-approved for no-approval staff).']
    ]
  });

  /* =====================================================================
     6. QUẢN LÝ THÊM CA CHO NHÂN VIÊN (APP)
     ===================================================================== */
  const roster = (s) => {
    const sh = (col, tm) => '<div class="sh" style="border-color:' + K.COL[col].c + '"><b>' + t('Sáng', 'Morn.') + '</b><br>' + tm + '</div>';
    const row = (name, cells) => '<tr><td style="min-width:58px"><b>' + name + '</b></td>' + cells.map((c) => '<td>' + c + '</td>').join('') + '</tr>';
    const add = (h) => '<div class="add"' + (h ? ' data-h="' + h + '"' : '') + '>⊕</div>';
    const d = [t('T2', 'Mo'), t('T3', 'Tu'), t('T4', 'We'), t('T5', 'Th'), t('T6', 'Fr'), t('T7', 'Sa'), t('CN', 'Su')];
    return K.weekh() + '<div style="overflow:auto;border-radius:10px"><table class="roster" data-h="roster"><thead><tr><th style="text-align:left">' + t('Nhân viên', 'Staff') + '</th>' + d.map((x, i) => '<th class="' + (i === 2 ? 'today' : '') + '">' + x + '<br>' + (12 + i) + '</th>').join('') + '</tr></thead><tbody>' +
      row('Văn An', [sh('ok', '07:58/17:03'), sh('ok', '07:55/17:00'), sh('miss', '07:57/--'), sh('future', '--/--'), s.saved ? '<div data-h="new-cell">' + sh('future', '--/--') + '</div>' : add('add-an-4'), add(''), add('')]) +
      row('Thu Bình', [sh('ok', '07:59/17:02'), sh('ok', '07:55/17:01'), sh('miss', '07:57/--'), sh('future', '--/--'), sh('future', '--/--'), add(''), add('')]) + '</tbody></table></div>';
  };
  HDSD.add({
    id: 'mgr-add', tier: 2, ch: ['app'], icon: '➕',
    title: ['Quản lý thêm ca cho nhân viên trên app', 'Manager adds a shift for staff in the app'],
    sum: ['Từ Báo cáo lịch làm việc nhân viên (theo tuần), quản lý bấm vào ô trống để thêm ca cho nhân viên vào ngày đó.', 'From the weekly staff schedule report, the manager taps an empty cell to add a shift for that employee on that day.'],
    who: ['Quản lý', 'Manager'],
    pre: ['Tài khoản có quyền TI000002 (Báo cáo chấm công dành cho quản lý).', 'The account has permission TI000002 (Attendance report for managers).'],
    init: { _app: K.WHO.mgr, scr: 'home', shift: '', saved: 0 },
    app: (s) => {
      if (s.scr === 'home') return K.app({ raw: K.home({ name: K.P.mgr, tiles: ['llv', 'pg', 'month', 'hist', 'report'] }) });
      if (s.scr === 'add') return K.app({ title: t('Thêm ca', 'Add shift'),
        body: K.acard(t('Ngày làm việc', 'Working day') + ': <b>' + K.dn(4) + ', ' + K.d(4) + '</b><br>' + t('Nhân viên', 'Employee') + ': ' + K.P.an) +
          K.field(t('Ca', 'Shift') + ' *', K.asel('sel-shift', s.shift, t('Chọn ca làm việc của bạn', 'Select your shift'))) + K.field(t('Chi nhánh', 'Branch') + ' *', K.asel('sel-br', K.br1())) +
          K.field(t('Ghi đè thời gian (Tùy chọn)', 'Override time (optional)'), '<div style="display:flex;gap:6px" data-h="override">' + K.ainp('', '', '--:--') + K.ainp('', '', '--:--') + '</div>'),
        bottom: K.abtn(t('Lưu', 'Save'), 'save') });
      return K.app({ title: t('Báo cáo lịch làm việc nhân viên', 'Staff schedule report'), body: roster(s) });
    },
    steps: [
      { on: 'app', h: 't-report', t: ['Ở Home, mở <b>Báo cáo chấm công</b>.', 'On Home, open <b>Attendance report</b>.'], set: { scr: 'report' } },
      { on: 'app', h: 'roster', look: true, t: ['Lưới <b>nhân viên × 7 ngày</b>: mỗi ô ca có vạch màu theo trạng thái báo cáo; ô trống có dấu ⊕.', 'A <b>staff × 7 days</b> grid: each shift cell has a colour bar for its report status; empty cells show ⊕.'],
        warn: ['Báo cáo này hiện mọi nhân viên có ca, không chỉ nhân viên do mình quản lý.', 'This report shows every employee with shifts, not only the ones you manage.'] },
      { on: 'app', h: 'add-an-4', t: ['Bấm ô trống của Lê Văn An ở Thứ 6 16/10 để <b>Thêm ca</b>.', 'Tap Lê Văn An\'s empty cell on Fri 16/10 to <b>Add shift</b>.'], set: { scr: 'add' } },
      { on: 'app', h: 'sel-shift', t: ['Chọn <b>Ca</b>.', 'Choose the <b>Shift</b>.'],
        rule: ['Chỉ hiện các ca áp dụng cho thứ đó. Chưa chọn ca mà lưu → "Bạn chưa chọn Ca".', 'Only shifts applicable to that weekday are listed. Saving without a shift → "Bạn chưa chọn Ca" (you have not selected a shift).'],
        set: function (s) { s.shift = t('Ca sáng', 'Morning shift'); } },
      { on: 'app', h: 'sel-br', look: true, t: ['<b>Chi nhánh</b> mặc định là chi nhánh của người quản lý; đổi nếu nhân viên làm ở nơi khác.', 'The <b>Branch</b> defaults to the manager\'s branch; change it if the employee works elsewhere.'] },
      { on: 'app', h: 'override', look: true, t: ['Có thể <b>ghi đè giờ</b> bắt đầu/kết thúc cho riêng ngày này (không bắt buộc).', 'You can <b>override</b> the start/end time for this day only (optional).'],
        rule: ['Giờ kết thúc ≤ giờ bắt đầu → "Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu".', 'End time ≤ start time → "Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu" (end must be after start).'] },
      { on: 'app', h: 'save', t: ['Bấm <b>Lưu</b>.', 'Tap <b>Save</b>.'],
        rule: ['Trùng giờ với ca đã có của nhân viên → "Thời gian làm việc đã trùng với lịch khác".', 'Overlap with the employee\'s existing shift → "Thời gian làm việc đã trùng với lịch khác" (working time overlaps another schedule).'],
        set: { scr: 'report', saved: 1 } },
      { on: 'app', h: 'new-cell', look: true, t: ['Ca mới xuất hiện trên lưới ở Thứ 6 16/10 với vạch xám "Chưa đến ca".', 'The new shift appears in the grid on Fri 16/10 with the grey "Not yet due" bar.'],
        rule: ['Quy tắc tạo ca giống nhân viên tự thêm ca trên app (chỉ ca áp dụng cho thứ đó, không trùng giờ).', 'The creation rules are the same as when staff add a shift in the app (only shifts applicable to that weekday, no overlap).'] }
    ],
    done: ['Bạn đã thêm ca cho nhân viên ngay trên app quản lý.', 'You have added a shift for an employee directly in the manager app.'],
    rules: [
      ['Mở từ Báo cáo lịch làm việc nhân viên (theo tuần): ô trống hoặc nút "+".', 'Opened from the weekly staff schedule report: an empty cell or the "+" button.'],
      ['Chi nhánh mặc định = chi nhánh của người quản lý.', 'Default branch = the manager\'s branch.'],
      ['Các kiểm tra: phải chọn ca, giờ kết thúc sau giờ bắt đầu, không trùng lịch khác.', 'Checks: a shift must be selected, end after start, no overlap with another schedule.']
    ]
  });

  /* =====================================================================
     7. QUẢN LÝ ĐỔI CA HỘ (APP)
     ===================================================================== */
  HDSD.add({
    id: 'mgr-change', tier: 2, ch: ['app'], icon: '🔁',
    title: ['Quản lý đổi ca hộ nhân viên', 'Manager changes a shift on behalf of staff'],
    sum: ['Quản lý đổi ca trực tiếp trên thẻ ca của nhân viên; thay đổi được tự duyệt và nhân viên nhận thông báo.', 'The manager changes the shift directly on the employee\'s shift card; the change is auto-approved and the employee is notified.'],
    who: ['Quản lý trực tiếp', 'Direct manager'],
    init: { _app: K.WHO.mgr, scr: 'pg', sheet: 0, to: 0, done: 0 },
    app: (s) => {
      if (s.scr === 'an') return K.app({ raw: K.home({ name: K.P.an, card: { sn: K.sang(), time: '08:00 - 17:00', btn: 'in' }, noti: [K.noti(t('Lịch làm việc', 'Work schedule'), K.m('Đã đổi ca lịch làm việc ngày 16/10/2026 của bạn thành Ca chiều', 'Your work schedule on 16/10/2026 has been changed to Afternoon shift'), 'noti', 1)] }) });
      const sheet = s.sheet ? { title: t('Đổi ca', 'Change shift'), body: K.field(t('Chi nhánh', 'Branch'), K.asel('s-br', K.br1())) + K.field(t('Ca', 'Shift'), K.asel('s-shift', s.to ? K.chieu() : K.sang())) +
        K.field(t('Ghi đè thời gian (Tùy chọn)', 'Override time (optional)'), '<div style="display:flex;gap:6px" data-h="s-time">' + K.ainp('', s.to ? '13:00' : '08:00') + K.ainp('', s.to ? '22:00' : '17:00') + '</div>') + K.abtn(t('Chấp nhận', 'Accept'), 's-ok') } : null;
      return K.app({ title: t('Lịch làm việc', 'Work schedule'), sheet,
        body: K.weekh() + K.stChips('all', { approved: 2 }) + K.acard('<div style="text-align:center">' + t('Nhân viên', 'Employee') + ': <b>' + K.P.an + '</b></div>') +
          K.sched({ h: 'c-thu', day: K.dn(3) + ', ' + K.d(3), st: 'approved', shift: K.sang(), time: '08:00 -> 17:00', est: 8, acts: [['⏲ ' + t('Đổi ca', 'Change shift'), '']] }) +
          K.sched({ h: 'c-fri', isNew: s.done, day: K.dn(4) + ', ' + K.d(4), st: 'approved', shift: s.done ? K.chieu() : K.sang(), time: s.done ? '13:00 -> 22:00' : '08:00 -> 17:00', est: s.done ? 9 : 8, acts: [['⏲ ' + t('Đổi ca', 'Change shift'), 'chg']] }) });
    },
    steps: [
      { on: 'app', h: 'c-fri', look: true, t: ['Trong <b>LLV nhân viên</b> → lịch tuần của Lê Văn An, thẻ ca Thứ 6 16/10 có nút <b>Đổi ca</b>.', 'In <b>Staff schedule</b> → Lê Văn An\'s week, the Fri 16/10 shift card has a <b>Change shift</b> button.'],
        rule: ['Nút chỉ hiện khi: ca <b>chưa ra ca</b>, đang <b>Đã duyệt</b> hoặc <b>Chờ duyệt</b>, và ngày làm ≥ hôm nay. Cũng mở được từ Báo cáo tuần.', 'The button only shows when the shift has <b>not been clocked out</b>, is <b>Approved</b> or <b>Pending approval</b>, and the working day is today or later. It can also be opened from the weekly report.'] },
      { on: 'app', h: 'chg', t: ['Bấm <b>Đổi ca</b>.', 'Tap <b>Change shift</b>.'], set: { sheet: 1 } },
      { on: 'app', h: 's-br', look: true, t: ['Chọn <b>Chi nhánh</b> làm việc của ca mới (mặc định giữ chi nhánh hiện tại).', 'Choose the working <b>Branch</b> for the new shift (the current branch is kept by default).'] },
      { on: 'app', h: 's-shift', t: ['Chọn <b>Ca</b> mới.', 'Choose the new <b>Shift</b>.'],
        rule: ['Danh sách chỉ gồm ca áp dụng cho thứ đó và thuộc chi nhánh đã chọn.', 'The list only contains shifts that apply to that weekday and belong to the chosen branch.'], set: { to: 1 } },
      { on: 'app', h: 's-time', look: true, t: ['Giờ được điền theo ca mới; có thể <b>ghi đè</b> nếu cần.', 'The hours follow the new shift; you can <b>override</b> them if needed.'],
        rule: ['Giờ ghi đè trùng với ca khác của nhân viên → "Thời gian làm việc đã trùng với lịch khác".', 'Overridden hours that overlap another shift of the employee → "Thời gian làm việc đã trùng với lịch khác" (working time overlaps another schedule).'],
        warn: ['Màn này không kiểm tra giờ kết thúc phải sau giờ bắt đầu — hãy tự kiểm tra trước khi chấp nhận.', 'This sheet does not check that the end time is after the start time — verify it yourself before accepting.'] },
      { on: 'app', h: 's-ok', t: ['Bấm <b>Chấp nhận</b>.', 'Tap <b>Accept</b>.'],
        rule: ['Vì người gửi là quản lý của nhân viên nên đổi ca được <b>tự duyệt</b>. Giờ, hệ số công, giờ làm của ca được cập nhật theo ca mới.', 'Because the sender is the employee\'s manager, the change is <b>auto-approved</b>. The shift\'s hours, work coefficient and working hours are updated from the new shift.'],
        warn: ['Nếu ca đã chấm công vào, đổi ca sẽ xoá toàn bộ dữ liệu chấm công của ca (nhân viên phải chấm lại).', 'If the shift has already been clocked in, changing it deletes all its attendance data (the employee must clock in again).'],
        set: { sheet: 0, done: 1 } },
      { on: 'app', h: 'c-fri', look: true, t: ['Thẻ ca đã đổi sang <b>Ca chiều 13:00 → 22:00</b> và vẫn ở trạng thái Đã duyệt.', 'The card now shows <b>Afternoon shift 13:00 → 22:00</b> and is still Approved.'], set: { scr: 'an', _app: K.WHO.an } },
      { on: 'app', h: 'noti', look: true, t: ['Trên app của nhân viên: nhận thông báo ca đã được đổi. Bấm thông báo để mở chi tiết lịch làm việc.', 'In the employee\'s app: a notification says the shift has been changed. Tapping it opens the schedule details.'] }
    ],
    done: ['Bạn đã đổi ca hộ nhân viên; thay đổi có hiệu lực ngay và nhân viên đã được thông báo.', 'You have changed a shift on behalf of an employee; it takes effect immediately and the employee has been notified.'],
    rules: [
      ['Điều kiện hiện nút "Đổi ca": ca chưa ra ca, Đã duyệt/Chờ duyệt, ngày ≥ hôm nay.', '"Change shift" shows when: not clocked out, Approved/Pending approval, day is today or later.'],
      ['Quản lý đổi ca hộ được tự duyệt; nhân viên nhận "Đã đổi ca lịch làm việc ngày … của bạn thành …".', 'A manager\'s change is auto-approved; the employee receives "Đã đổi ca lịch làm việc ngày … của bạn thành …".'],
      ['Ca mới mã KL → đánh dấu nghỉ không lương; mã P hoặc 1/2 → nghỉ có lương.', 'New shift with code KL → marked unpaid leave; code P or 1/2 → paid leave.'],
      ['Đổi ca sau khi đã chấm công vào sẽ xoá dữ liệu chấm công của ca.', 'Changing a shift after clock-in deletes the shift\'s attendance data.']
    ]
  });

  /* =====================================================================
     8. NGHỈ CÓ LƯƠNG / NGHỈ KHÔNG LƯƠNG
     ===================================================================== */
  HDSD.add({
    id: 'paid-leave', tier: 2, ch: ['web'], icon: '☂️',
    title: ['Đánh dấu nghỉ có lương / nghỉ không lương', 'Mark paid / unpaid leave'],
    sum: ['Đánh dấu thủ công một ca là nghỉ có lương hoặc nghỉ không lương ngay trên lưới Lịch làm việc.', 'Manually mark a shift as paid or unpaid leave directly on the Work schedule grid.'],
    who: ['Admin / HR, Quản lý', 'Admin / HR, Manager'],
    pre: ['Ca chưa chốt lương và nhân viên chưa chấm vào, chưa chấm ra.', 'The shift is not payroll-locked and the employee has not clocked in or out.'],
    init: { _web: K.WHO.admin, mark: '', menu: 0, swal: '' },
    web: (s) => {
      const keys = s.mark === 'paid' ? ['detail', 'edit', 'add', 'unpaid', 'ot', '-', 'del'] : s.mark === 'unpaid' ? ['detail', 'edit', 'add', 'paid', 'ot', '-', 'del'] : ['detail', 'edit', 'add', 'attend', 'paid', 'unpaid', 'ot', '-', 'del'];
      const an = C({ h: 'c-an', ch: 'cell-an', tm: '--:-- - --:--', col: s.mark || 'miss', menu: s.menu ? K.cmenu(keys) : '' });
      return K.twsPage({ over: s.swal ? K.swalQ(K.m('Bạn có muốn điều chỉnh không?', 'Do you want to make this adjustment?'), 'yes') : '',
        rows: [{ name: K.P.an, cells: [PAST(), PAST('07:55 📱 - 17:00 📱'), an, C({}), C({}), PLUS, PLUS] }, binhRow()] });
    },
    steps: [
      { on: 'web', h: 'c-an', t: ['Ở ô ca hôm nay của Lê Văn An (báo nghỉ, chưa chấm công), bấm <b>⋮</b>.', 'On Lê Văn An\'s shift cell for today (off sick, not clocked), click <b>⋮</b>.'], set: { menu: 1 } },
      { on: 'web', h: 'menu', look: true, t: ['Menu có 2 mục <b>Nghỉ có lương</b> và <b>Nghỉ không lương</b>.', 'The menu has <b>Paid leave</b> and <b>Unpaid leave</b>.'],
        rule: ['Hai mục này chỉ hiện khi: ca <b>chưa chốt lương</b>, nhân viên <b>chưa vào và chưa ra</b> ca, và người dùng có quyền.', 'These items only show when the shift is <b>not payroll-locked</b>, the employee has <b>neither clocked in nor out</b>, and the user has permission.'] },
      { on: 'web', h: 'm-paid', t: ['Chọn <b>Nghỉ có lương</b>.', 'Choose <b>Paid leave</b>.'], set: { menu: 0, swal: 'paid' } },
      { on: 'web', h: 'yes', t: ['Xác nhận điều chỉnh.', 'Confirm the adjustment.'], set: { swal: '', mark: 'paid' } },
      { on: 'web', h: 'cell-an', look: true, t: ['Ô ca đổi sang màu <b>Nghỉ phép có lương</b>.', 'The cell turns to the <b>Paid leave</b> colour.'],
        rule: ['Thao tác này chỉ gắn cờ nghỉ cho ca: <b>không ghi lịch sử thay đổi</b> và <b>không trừ quỹ phép</b>. Khi tính lương, ca không vào/ra được đánh dấu nghỉ có lương được tính là ngày nghỉ có lương.', 'This only flags the shift as leave: <b>no change history</b> is recorded and <b>no leave balance is deducted</b>. In payroll, a shift with no in/out marked as paid leave counts as a paid leave day.'] },
      { on: 'web', h: 'c-an', t: ['Mở lại menu <b>⋮</b> của ô vừa đánh dấu.', 'Open the <b>⋮</b> menu of the marked cell again.'], set: { menu: 1 } },
      { on: 'web', h: 'menu', look: true, t: ['Ca đã đánh dấu nghỉ <b>không còn</b> các mục Chấm công hộ / Duyệt lịch / Confirm working time. Vẫn có thể chuyển sang <b>Nghỉ không lương</b>.', 'A shift marked as leave <b>no longer</b> offers Proxy attendance / Approve schedule / Confirm working time. You can still switch it to <b>Unpaid leave</b>.'] },
      { on: 'web', h: 'm-unpaid', t: ['Chọn <b>Nghỉ không lương</b> để đổi loại nghỉ.', 'Choose <b>Unpaid leave</b> to change the leave type.'], set: { menu: 0, swal: 'unpaid' } },
      { on: 'web', h: 'yes', t: ['Xác nhận.', 'Confirm.'], set: { swal: '', mark: 'unpaid' } },
      { on: 'web', h: 'cell-an', look: true, t: ['Ô ca đổi sang màu <b>Nghỉ phép không lương</b>; ca này sẽ được tính là ngày nghỉ không lương.', 'The cell turns to the <b>Unpaid leave</b> colour; this shift will count as an unpaid leave day.'],
        rule: ['Ca đã đánh dấu nghỉ cũng không hiện ở thẻ chấm công trên app của nhân viên.', 'A shift marked as leave also does not appear on the employee\'s check-in card in the app.'] }
    ],
    done: ['Bạn đã đánh dấu và đổi loại nghỉ cho một ca ngay trên lưới lịch.', 'You have marked a shift as leave and switched its type directly on the grid.'],
    rules: [
      ['Điều kiện: chưa chốt lương, chưa vào và chưa ra ca, có quyền.', 'Conditions: not payroll-locked, no clock-in and no clock-out, has permission.'],
      ['Không ghi lịch sử thay đổi, không trừ quỹ phép.', 'No change history, no leave balance deduction.'],
      ['Sau khi đánh dấu: mất nút Chấm công hộ / Duyệt / Xác nhận.', 'After marking: Proxy attendance / Approve / Confirm are no longer available.'],
      ['Chốt lương sẽ khoá thao tác Nghỉ có/không lương.', 'Payroll closing locks the paid/unpaid leave action.']
    ]
  });

  /* =====================================================================
     9. CHỈNH SỬA NGÀY LÀM VIỆC
     ===================================================================== */
  HDSD.add({
    id: 'edit-day', tier: 2, ch: ['web'], icon: '✏️',
    title: ['Chỉnh sửa ngày làm việc', 'Edit a working day'],
    sum: ['Sửa chi nhánh, giờ bắt đầu/kết thúc và giờ tối thiểu của một ca đã xếp cho nhân viên, trước khi nhân viên vào ca.', 'Change the branch, start/end time and minimum hours of a shift already assigned to an employee, before they clock in.'],
    who: ['Admin / HR, Quản lý', 'Admin / HR, Manager'],
    pre: ['Ngày làm ≥ hôm nay, ca chưa chốt lương và nhân viên chưa vào ca.', 'The working day is today or later, the shift is not payroll-locked and the employee has not clocked in.'],
    init: { _web: K.WHO.admin, menu: 0, modal: 0, start: '16/10/2026 08:00', end: '16/10/2026 17:00', saved: 0 },
    web: (s) => {
      const fri = C({ h: 'c-fri', ch: 'cell-fri', isNew: s.saved, tm: s.saved ? '09:00 - 18:00' : '08:00 - 17:00', menu: s.menu ? K.cmenu(['detail', 'edit', 'add', 'paid', 'unpaid', 'ot', '-', 'del']) : '' });
      const over = s.modal ? K.modal({ title: t('Chỉnh sửa ngày làm việc', 'Edit working day'),
        body: K.row(t('Tên nhân viên', 'Employee'), K.inp('', K.P.an, { dis: 1 })) + K.row(t('Tên ca làm', 'Shift'), K.inp('', K.sang(), { dis: 1 })) + K.row(t('Vị trí làm', 'Work location'), K.sel('f-br', K.br1()), 1) +
          K.row(t('Hệ số công', 'Work coefficient'), K.inp('f-coef', '1', { dis: 1 }), 1) + K.row(t('Số giờ làm tối thiểu tính đủ công', 'Minimum hours for a full day'), K.inp('f-min', '8')) +
          K.row(t('Thời gian làm việc bắt đầu', 'Working time start'), K.inp('f-start', s.start), 1) + K.row(t('Thời gian làm việc kết thúc', 'Working time end'), K.inp('f-end', s.end), 1),
        foot: K.btn(t('HỦY', 'CANCEL'), '', 'btn-default') + K.btn(t('LƯU', 'SAVE'), 'save', 'btn-primary') }) : '';
      return K.twsPage({ over, rows: [{ name: K.P.an, cells: [PAST(), PAST('07:55 📱 - 17:00 📱'), C({ tm: '07:57 📱 - --:--', col: 'miss' }), C({}), fri, PLUS, PLUS] }, binhRow()] });
    },
    steps: [
      { on: 'web', h: 'c-fri', t: ['Ở ô ca Thứ 6 16/10 của Lê Văn An, bấm <b>⋮</b>.', 'On Lê Văn An\'s Fri 16/10 shift cell, click <b>⋮</b>.'], set: { menu: 1 } },
      { on: 'web', h: 'm-edit', t: ['Chọn <b>Chỉnh sửa</b>.', 'Choose <b>Edit</b>.'],
        rule: ['Mục "Chỉnh sửa" chỉ hiện khi: ngày ≥ hôm nay, ca <b>chưa chốt lương</b>, nhân viên <b>chưa vào ca</b>.', '"Edit" only shows when the day is today or later, the shift is <b>not payroll-locked</b> and the employee has <b>not clocked in</b>.'],
        set: { menu: 0, modal: 1 } },
      { on: 'web', h: 'f-br', look: true, t: ['<b>Vị trí làm</b>: đổi chi nhánh làm việc của ca nếu cần.', '<b>Work location</b>: change the shift\'s working branch if needed.'],
        rule: ['Chi nhánh làm việc quyết định điểm wifi/GPS được dùng để kiểm tra khi nhân viên chấm công.', 'The working branch decides which wifi/GPS points are checked when the employee clocks in.'] },
      { on: 'web', h: 'f-coef', look: true, t: ['<b>Hệ số công</b> đang bị khoá vì đây không phải ca tăng ca.', 'The <b>Work coefficient</b> is locked because this is not an overtime shift.'],
        rule: ['Hệ số công chỉ sửa được với <b>ca tăng ca</b>.', 'The work coefficient can only be edited for <b>overtime shifts</b>.'] },
      { on: 'web', h: 'f-start', type: '16/10/2026 09:00', k: 'start', t: ['Sửa <b>Thời gian làm việc bắt đầu</b> thành 09:00.', 'Change <b>Working time start</b> to 09:00.'] },
      { on: 'web', h: 'f-end', type: '16/10/2026 18:00', k: 'end', t: ['Sửa <b>Thời gian làm việc kết thúc</b> thành 18:00.', 'Change <b>Working time end</b> to 18:00.'],
        rule: ['Kiểm tra khi lưu: bắt đầu phải <b>trước</b> kết thúc; không trùng ca khác của nhân viên; ca có nghỉ trưa thì tổng giờ không quá 24.', 'Checks on save: start must be <b>before</b> end; no overlap with the employee\'s other shifts; for a shift with a lunch break the total must not exceed 24 hours.'] },
      { on: 'web', h: 'f-min', look: true, t: ['Điều chỉnh <b>Số giờ làm tối thiểu tính đủ công</b> nếu thời lượng ca thay đổi.', 'Adjust the <b>Minimum hours for a full day</b> if the shift length changes.'] },
      { on: 'web', h: 'save', t: ['Bấm <b>LƯU</b>.', 'Click <b>SAVE</b>.'], set: { modal: 0, saved: 1 } },
      { on: 'web', h: 'cell-fri', look: true, t: ['Ô ca Thứ 6 đã cập nhật giờ <b>09:00 – 18:00</b>. Chỉ ngày này thay đổi; mẫu ca và các ngày khác giữ nguyên.', 'The Friday cell now shows <b>09:00 – 18:00</b>. Only this day changes; the shift template and other days stay the same.'] }
    ],
    done: ['Bạn đã chỉnh giờ làm cho một ngày cụ thể của nhân viên.', 'You have adjusted the working hours for one specific day of an employee.'],
    rules: [
      ['Điều kiện: ngày ≥ hôm nay, chưa chốt lương, chưa vào ca.', 'Conditions: day is today or later, not payroll-locked, not clocked in.'],
      ['Sửa được: Vị trí làm, Hệ số công (chỉ ca tăng ca), Giờ tối thiểu, Thời gian bắt đầu, Thời gian kết thúc.', 'Editable: Work location, Work coefficient (overtime shifts only), Minimum hours, Start time, End time.'],
      ['Kiểm tra: bắt đầu trước kết thúc; không trùng ca khác; ca có nghỉ trưa tổng giờ không quá 24.', 'Checks: start before end; no overlap; for a shift with a lunch break total hours ≤ 24.']
    ]
  });

  /* =====================================================================
     10. THƯỞNG – PHẠT
     ===================================================================== */
  HDSD.add({
    id: 'recompense', tier: 2, ch: ['web'], icon: '⭐',
    title: ['Thưởng – Phạt: danh mục và gán theo ngày', 'Rewards & fines: catalogue and per-day assignment'],
    sum: ['Tạo danh mục thưởng/phạt, sau đó gán khoản thưởng hoặc phạt cho từng ngày công của nhân viên để cộng/trừ vào lương.', 'Create the reward/fine catalogue, then assign a reward or fine to an employee\'s working day so it is added to / deducted from payroll.'],
    who: ['Admin / HR', 'Admin / HR'],
    init: { _web: K.WHO.admin, scr: 'rec', modal: 0, type: 'R', name: '', saved: 0, menu: 0, tab: 'info', form: 0, ftype: 0, money: '', added: 0 },
    web: (s) => {
      if (s.scr === 'rec') {
        const rows = [
          { c: ['<span class="tag" style="background:#ede7f6;color:#5e35b1">' + t('hệ thống', 'system') + '</span>', t('Thưởng', 'Reward'), t('Thưởng chuyên cần', 'Attendance bonus'), K.P.admin, '01/09/2026', K.sw('', 1)] }
        ];
        if (s.saved) rows.unshift({ h: 'row-new', cls: 'new', c: ['<span class="icon-btn">✎</span><span class="icon-btn">🗑</span>', t('Phạt', 'Fine'), s.name, K.P.admin, '14/10/2026', K.sw('sw-new', 1)] });
        const over = s.modal ? K.modal({ size: 'sm', title: t('Thêm thưởng phạt', 'Add reward / fine'),
          body: '<div style="margin-bottom:12px">' + K.rd('rd-r', s.type === 'R', t('Thưởng', 'Reward')) + K.rd('rd-p', s.type === 'P', t('Phạt', 'Fine')) + '</div><label>' + t('Tên nội dung', 'Content name') + ' <span class="req">*</span></label>' + K.inp('rec-name', s.name),
          foot: K.btn(t('HỦY', 'CANCEL'), '', 'btn-default') + K.btn(t('LƯU', 'SAVE'), 'rec-save', 'btn-primary') }) : '';
        return K.web({ nav: 'rec', over, body: K.portlet(t('Danh sách thưởng phạt', 'Rewards & fines'), K.btn('+ ' + t('Thêm thưởng phạt', 'Add reward / fine'), 'rec-add'),
          K.filter(['<input class="fc" readonly placeholder="' + t('Nhập thông tin tìm kiếm', 'Search') + '">', K.btn(t('TÌM KIẾM', 'SEARCH'), '', 'btn-primary')]) + K.table(['', t('Loại', 'Type'), t('Nội dung', 'Content'), t('Người tạo', 'Created by'), t('Ngày tạo', 'Created at'), t('Trạng thái', 'Status')], rows, 'list')) });
      }
      const tue = Object.assign(PAST('08:40 📱 - 17:00 📱'), { h: 'c-tue', col: 'late', menu: s.menu ? K.cmenu(['detail', 'add', 'ot', '-', 'del']) : '' });
      let over = '';
      if (s.modal) {
        const fine = (s.added ? K.table(['#', t('Hình thức phạt', 'Fine type'), t('Mức áp dụng', 'Amount'), ''], [{ h: 'fine-row', cls: 'new', c: ['1', s.name, '50,000', '<span class="icon-btn">🗑</span>'] }]) : '<div style="color:#999;margin-bottom:8px">' + t('Chưa có khoản phạt', 'No fines yet') + '</div>') +
          (s.form ? '<div style="display:flex;gap:8px;margin:10px 0;align-items:center">' + K.sel('fine-type', s.ftype ? s.name : '', { ph: t('Hãy chọn loại', 'Select a type'), w: 240 }) + K.inp('fine-money', s.money, { ph: t('Mức áp dụng', 'Amount'), w: 150 }) + K.btn(t('Lưu', 'Save'), 'fine-save', 'btn-primary') + '</div>' : '') +
          '<div style="margin-top:8px">' + K.btn('+ ' + t('Thêm hình thức phạt', 'Add a fine'), 'fine-add', 'btn-default') + '</div>';
        const info = '<div class="kvg">' + K.kv(t('Tên nhân viên', 'Employee'), K.P.an) + K.kv(t('Tên ca làm', 'Shift'), K.sang()) + K.kv(t('Giờ làm', 'Hours'), '8 ' + t('giờ', 'h')) + K.kv(t('Hệ số công', 'Work coefficient'), '1') + K.kv(t('Ngày làm', 'Working day'), K.d(1)) + K.kv(t('Vị trí làm', 'Work location'), K.br1()) + '</div>';
        over = K.modal({ size: 'lg', title: t('Chi tiết ngày làm việc', 'Working day details'),
          body: info + '<div style="height:10px"></div>' + K.tabs([[t('Danh sách công việc', 'Tasks'), 'dt-task', s.tab === 'info'], [t('Thưởng', 'Rewards'), 'dt-reward', 0], [t('Phạt vi phạm', 'Fines'), 'dt-fine', s.tab === 'fine'], [t('Lịch sử chấm công', 'Attendance history'), 'dt-hist', 0]]) +
            (s.tab === 'fine' ? fine : '<div style="color:#999">' + t('Chưa có công việc', 'No tasks') + '</div>'),
          foot: K.btn(t('HỦY', 'CANCEL'), 'dt-close', 'btn-default') });
      }
      return K.twsPage({ over, rows: [{ name: K.P.an, cells: [PAST(), tue, C({ tm: '07:57 📱 - --:--', col: 'miss' }), C({}), C({}), PLUS, PLUS] }, binhRow()] });
    },
    steps: [
      { on: 'web', h: 'rec-add', t: ['Vào <b>Chấm công → Thưởng phạt</b>, bấm <b>Thêm thưởng phạt</b>.', 'Go to <b>Timekeeping → Rewards & fines</b> and click <b>Add reward / fine</b>.'], set: { modal: 1 } },
      { on: 'web', h: 'rd-p', t: ['Chọn <b>Loại</b>: Thưởng hoặc Phạt. Ở đây chọn <b>Phạt</b>.', 'Choose the <b>Type</b>: Reward or Fine. Here choose <b>Fine</b>.'], set: { type: 'P' } },
      { on: 'web', h: 'rec-name', type: ['Đi trễ không phép', 'Late without permission'], k: 'name', t: ['Nhập <b>Tên nội dung</b>.', 'Enter the <b>Content name</b>.'],
        rule: ['Bắt buộc, tối đa 190 ký tự, <b>không trùng</b> với mục khác — kể cả giữa Thưởng và Phạt.', 'Required, at most 190 characters, <b>must be unique</b> — even across Rewards and Fines.'] },
      { on: 'web', h: 'rec-save', t: ['Bấm <b>LƯU</b>.', 'Click <b>SAVE</b>.'], set: { modal: 0, saved: 1 } },
      { on: 'web', h: 'row-new', look: true, t: ['Mục mới xuất hiện trong danh mục, trạng thái đang bật.', 'The new item appears in the catalogue with its status on.'],
        rule: ['Mục "hệ thống" không sửa/xoá được trên giao diện. Chỉ mục đang bật mới dùng để gán cho ngày công.', '"System" items cannot be edited or deleted in the UI. Only active items can be assigned to a working day.'] },
      { on: 'web', h: 'nav-tws', t: ['Mở <b>Lịch làm việc</b> để gán khoản phạt cho một ngày công.', 'Open <b>Work schedule</b> to assign the fine to a working day.'], set: { scr: 'tws' } },
      { on: 'web', h: 'c-tue', t: ['Ở ô ca Thứ 3 13/10 (An vào trễ), bấm <b>⋮</b>.', 'On the Tue 13/10 cell (An came late), click <b>⋮</b>.'], set: { menu: 1 } },
      { on: 'web', h: 'm-detail', t: ['Chọn <b>Chi tiết</b>.', 'Choose <b>Details</b>.'], set: { menu: 0, modal: 1 } },
      { on: 'web', h: 'dt-fine', t: ['Trong popup <b>Chi tiết ngày làm việc</b>, mở tab <b>Phạt vi phạm</b> (thưởng thì dùng tab <b>Thưởng</b>).', 'In the <b>Working day details</b> popup, open the <b>Fines</b> tab (use the <b>Rewards</b> tab for rewards).'], set: { tab: 'fine' } },
      { on: 'web', h: 'fine-add', t: ['Bấm <b>Thêm hình thức phạt</b>.', 'Click <b>Add a fine</b>.'], set: { form: 1 } },
      { on: 'web', h: 'fine-type', t: ['Chọn loại phạt từ danh mục vừa tạo.', 'Choose the fine type from the catalogue you just created.'], set: { ftype: 1 } },
      { on: 'web', h: 'fine-money', type: '50,000', k: 'money', t: ['Nhập <b>Mức áp dụng</b> (số tiền).', 'Enter the <b>Amount</b>.'] },
      { on: 'web', h: 'fine-save', t: ['Lưu khoản phạt.', 'Save the fine.'],
        rule: ['Các khoản này được <b>cộng (thưởng) / trừ (phạt)</b> vào lương của kỳ đó: Tổng thực lĩnh = Lương chính + Phụ cấp + Thưởng + Tăng ca − Phạt.', 'These amounts are <b>added (rewards) / deducted (fines)</b> in that period\'s payroll: Net pay = Base pay + Allowances + Rewards + Overtime − Fines.'],
        warn: ['Tắt hoặc xoá một mục trong danh mục không loại bỏ các khoản đã gán. Chốt lương cũng không khoá thao tác thưởng/phạt.', 'Disabling or deleting a catalogue item does not remove amounts already assigned. Payroll closing does not lock rewards/fines either.'],
        set: { form: 0, added: 1 } },
      { on: 'web', h: 'fine-row', look: true, t: ['Khoản phạt 50,000 đã gắn với ngày công 13/10 của Lê Văn An; có thể xoá bằng biểu tượng thùng rác.', 'The 50,000 fine is now attached to Lê Văn An\'s working day 13/10; it can be removed with the trash icon.'] }
    ],
    done: ['Bạn đã tạo một mục phạt trong danh mục và gán cho một ngày công của nhân viên.', 'You have created a fine in the catalogue and assigned it to an employee\'s working day.'],
    rules: [
      ['Danh mục: Loại (Thưởng/Phạt), Tên nội dung (bắt buộc, ≤ 190 ký tự, không trùng), Trạng thái bật/tắt.', 'Catalogue: Type (Reward/Fine), Content name (required, ≤ 190 chars, unique), Status on/off.'],
      ['Gán theo ngày trong popup Chi tiết ngày làm việc → tab Thưởng / Phạt vi phạm: chọn loại + Mức áp dụng.', 'Assign per day in Working day details → Rewards / Fines tab: choose type + Amount.'],
      ['Thưởng cộng vào lương, phạt trừ khỏi lương của kỳ.', 'Rewards are added to and fines deducted from the period\'s payroll.']
    ]
  });

  /* =====================================================================
     11. LỊCH SỬ CHẤM CÔNG (WEB) + DUYỆT ĐI TRỄ / VỀ SỚM
     ===================================================================== */
  HDSD.add({
    id: 'history-web', tier: 2, ch: ['web'], icon: '⏱',
    title: ['Lịch sử chấm công và duyệt đi trễ / về sớm', 'Attendance history and late / early approval'],
    sum: ['Xem từng lần chấm công (giờ vào/ra, hình thức, lý do) và duyệt đi trễ, về sớm cho các ca đã phát sinh.', 'Review every check-in (in/out times, method, reason) and approve lateness or early leave for shifts that already happened.'],
    who: ['Admin / HR, Quản lý', 'Admin / HR, Manager'],
    init: { _web: K.WHO.admin, menu: 0, swal: 0, a1: 0, a2: 0 },
    web: (s) => {
      const link = (x) => '<a href="#">' + x + '</a>';
      const dots = (n, label, h) => '<div style="position:relative;display:inline-block"><span class="icon-btn" data-h="dots-' + n + '">…</span>' + (s.menu === n ? '<div class="dropdown"><button data-h="' + h + '"><span>✔</span>' + label + '</button></div>' : '') + '</div>';
      const by = K.P.admin;
      const rows = [
        [1, K.P.an, K.br1(), t('Bán hàng', 'Sales'), K.sang() + '<br><small>(08:00 - 17:00)</small>', K.d(2), { h: 'ty-1', v: '08:10<br><small>' + link('WIFI') + '</small>' }, '',
          { h: 'rs-1', v: s.a1 ? by + ' ' + t('Đã duyệt đi trễ', 'approved the lateness') : t('Nhân viên đi trễ', 'Employee was late') + '<br>' + t('Chưa ra ca', 'Not clocked out yet') }, s.a1 ? '' : dots(1, t('Duyệt đi trễ', 'Approve lateness'), 'a-late')],
        [2, K.P.binh, K.br1(), t('Bán hàng', 'Sales'), K.sang() + '<br><small>(08:00 - 17:00)</small>', K.d(1), '07:58<br><small>' + link('GPS') + '</small>', '16:30<br><small>' + link('GPS') + '</small>',
          { h: 'rs-2', v: s.a2 ? by + ' ' + t('Đã duyệt về sớm', 'approved the early leave') : t('Nhân viên về sớm', 'Employee left early') }, s.a2 ? '' : dots(2, t('Duyệt về sớm', 'Approve early leave'), 'a-soon')],
        [3, K.P.an, K.br1(), t('Bán hàng', 'Sales'), K.sang() + '<br><small>(08:00 - 17:00)</small>', K.d(0), '08:00<br><small>' + t('Chấm công hộ', 'Proxy attendance') + '</small>', '17:00<br><small>' + t('Chấm công hộ', 'Proxy attendance') + '</small>', K.P.mgr + ' ' + t('Chấm công hộ', 'proxy attendance'), ''],
        [4, 'Đỗ Minh Châu', K.br1(), t('Giao hàng', 'Delivery'), K.sang() + '<br><small>(08:00 - 17:00)</small>', K.d(0), '07:55<br><small>' + link(t('Linh động', 'Flexible')) + '</small>', '17:02<br><small>' + link(t('Linh động', 'Flexible')) + '</small>', '', '']
      ];
      const sw = s.swal ? K.swal({ type: 'question', title: t('Duyệt checkin / checkout', 'Approve check-in / check-out'), text: s.swal === 1 ? K.m('Bạn có muốn duyệt đi trễ không?', 'Do you want to approve the lateness?') : K.m('Bạn có muốn duyệt về sớm không?', 'Do you want to approve the early leave?'), btns: [[t('Huỷ', 'Cancel'), '', 0], [t('Đồng ý', 'Yes'), 'yes', 1]] }) : '';
      return K.web({ nav: 'att', over: sw, body: K.portlet(t('Lịch sử chấm công', 'Attendance history'), '',
        '<div data-h="filter">' + K.filter(['<input class="fc" readonly style="width:150px" placeholder="' + t('Nhập tên nhân viên', 'Employee name') + '">', t('Chọn phòng ban', 'Department'), t('Chọn chi nhánh', 'Branch'), t('Hình thức chấm công', 'Check-in method'), '2026', t('Tháng 10', 'October')]) + '</div>' +
        K.table(['#', t('Tên nhân viên', 'Employee'), t('Vị trí', 'Location'), t('Phòng ban', 'Department'), t('Ca', 'Shift'), t('Ngày', 'Date'), t('Giờ vào', 'In'), t('Giờ ra', 'Out'), t('Lý do', 'Reason'), ''], rows, 'tbl')) });
    },
    steps: [
      { on: 'web', h: 'tbl', look: true, t: ['Vào <b>Chấm công → Lịch sử chấm công</b>. Mỗi dòng là <b>một lần chấm công vào</b>.', 'Go to <b>Timekeeping → Attendance history</b>. Each row is <b>one clock-in</b>.'],
        rule: ['Ca chưa chấm công vào sẽ <b>không xuất hiện</b> ở màn này.', 'Shifts with no clock-in <b>do not appear</b> on this screen.'] },
      { on: 'web', h: 'filter', look: true, t: ['Lọc theo Tên nhân viên, Phòng ban, Chi nhánh, Hình thức (Wifi / GPS), Năm, Tháng hoặc khoảng ngày.', 'Filter by Employee name, Department, Branch, Method (Wifi / GPS), Year, Month or a date range.'] },
      { on: 'web', h: 'ty-1', look: true, t: ['Dưới giờ vào/ra là <b>hình thức</b> chấm công.', 'Below each in/out time is the check-in <b>method</b>.'],
        rule: ['Hình thức: <b>WIFI</b>, <b>GPS</b> (có link bản đồ), <b>Chấm công hộ</b>, hoặc <b>Linh động</b> (nhân viên được miễn kiểm tra vị trí).', 'Methods: <b>WIFI</b>, <b>GPS</b> (with a map link), <b>Proxy attendance</b>, or <b>Flexible</b> (staff exempt from the location check).'] },
      { on: 'web', h: 'rs-1', look: true, t: ['Cột <b>Lý do</b> do hệ thống tự sinh.', 'The <b>Reason</b> column is generated by the system.'],
        rule: ['Các giá trị: "[Người duyệt] Đã duyệt đi trễ", "Nhân viên đi trễ", "Hệ thống duyệt nghỉ không lương" (trễ vượt ngưỡng tính nghỉ); tương tự cho ra sớm; "Chưa ra ca"; "[Người] Chấm công hộ".', 'Values: "[Approver] Đã duyệt đi trễ" (lateness approved), "Nhân viên đi trễ" (employee was late), "Hệ thống duyệt nghỉ không lương" (late beyond the unpaid-leave threshold); the same for early leave; "Chưa ra ca" (not clocked out); "[Person] Chấm công hộ" (proxy attendance).'] },
      { on: 'web', h: 'dots-1', t: ['Dòng có trễ chưa duyệt sẽ có menu <b>…</b>. Bấm vào đó.', 'Rows with unapproved lateness have a <b>…</b> menu. Click it.'], set: { menu: 1 } },
      { on: 'web', h: 'a-late', t: ['Chọn <b>Duyệt đi trễ</b>.', 'Choose <b>Approve lateness</b>.'], set: { menu: 0, swal: 1 } },
      { on: 'web', h: 'yes', t: ['Xác nhận duyệt.', 'Confirm the approval.'], set: { swal: 0, a1: 1 } },
      { on: 'web', h: 'rs-1', look: true, t: ['Lý do đổi thành "<b>[Người duyệt] Đã duyệt đi trễ</b>" và menu duyệt biến mất.', 'The reason becomes "<b>[Approver] lateness approved</b>" and the approval menu disappears.'],
        rule: ['Tác dụng của duyệt: <b>Tính lương</b> — ca được duyệt không bị tính vào số lần/số phút đi trễ, về sớm. <b>Chấm công vào trên app</b> — không bị chặn "Quá thời gian checkin.".', 'Effect of approval: <b>Payroll</b> — an approved shift is not counted in the number/minutes of lateness or early leave. <b>App clock-in</b> — not blocked by "Quá thời gian checkin." (check-in time exceeded).'],
        warn: ['Màn tô màu, Bảng chấm công, file Excel và báo cáo trên app vẫn tính ca này là trễ/sớm dù đã duyệt.', 'The colour grid, the Timesheet, the Excel file and the app reports still count this shift as late/early even after approval.'] },
      { on: 'web', h: 'dots-2', t: ['Tương tự với ca <b>về sớm</b>: bấm <b>…</b> ở dòng của Phạm Thu Bình.', 'Same for an <b>early leave</b>: click <b>…</b> on Phạm Thu Bình\'s row.'], set: { menu: 2 } },
      { on: 'web', h: 'a-soon', t: ['Chọn <b>Duyệt về sớm</b>.', 'Choose <b>Approve early leave</b>.'], set: { menu: 0, swal: 2 } },
      { on: 'web', h: 'yes', t: ['Xác nhận duyệt.', 'Confirm the approval.'], set: { swal: 0, a2: 1 } },
      { on: 'web', h: 'rs-2', look: true, t: ['Ca về sớm đã được duyệt và ghi tên người duyệt ở cột Lý do.', 'The early leave is approved and the approver\'s name is recorded in the Reason column.'] }
    ],
    done: ['Bạn đã đọc được lịch sử chấm công và duyệt đi trễ, về sớm cho ca đã phát sinh.', 'You can now read the attendance history and approve lateness / early leave for past shifts.'],
    rules: [
      ['Mỗi dòng = 1 lần chấm vào; ca chưa chấm vào không hiển thị.', 'Each row = one clock-in; shifts without a clock-in are not shown.'],
      ['"Duyệt đi trễ" / "Duyệt về sớm" chỉ có ở ca có trễ/sớm chưa duyệt.', '"Approve lateness" / "Approve early leave" only appear on shifts with unapproved lateness/early leave.'],
      ['Duyệt có tác dụng với tính lương và việc chặn check-in; không làm giảm số lần trễ/sớm trên Bảng chấm công và Excel.', 'Approval affects payroll and the check-in block; it does not reduce the late/early counts on the Timesheet and Excel.'],
      ['Số phút trễ lưu lại = giờ vào − giờ bắt đầu ca; số phút sớm = giờ kết thúc ca − giờ ra (không trừ ân hạn).', 'Stored late minutes = clock-in − shift start; early minutes = shift end − clock-out (no grace period deducted).']
    ]
  });
})();
