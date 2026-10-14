/* ===== TRANG RULE & LUỒNG ===== */
(function () {
  const T = Store.T, A = UI.ACT, N = UI.N;

  const flow = [
    ['1', 'Cấu hình nền', 'Ngưỡng trễ/sớm, check-in trước, kỳ công, bắt ảnh; wifi/GPS theo chi nhánh; NV linh động / không cần duyệt', 'web', 'cfg'],
    ['2', 'Tạo ca', 'Giờ ca, nghỉ trưa, thứ áp dụng, hệ số công, số lần chấm công, chi nhánh', 'web', 'shift'],
    ['3', 'Phân ca', 'Sinh sf_time_working_staffs (NV × ngày × ca). Admin tạo → approved; NV tự đăng ký → waiting', 'web', 'tws'],
    ['4', 'Duyệt lịch', 'Quản lý duyệt waiting → approved (web hoặc app)', 'app', 'pg'],
    ['5', 'Chấm công', 'App: selfie + GPS + IP → server kiểm khung giờ + wifi/GPS → log, phút trễ', 'app', 'home'],
    ['6', 'Điều chỉnh', 'Đổi ca, xin trễ/sớm, OT, nghỉ có/không lương, chấm hộ, thưởng/phạt', 'app', 'tws'],
    ['7', 'Xác nhận giờ', 'Check-out lượt cuối → not-confirm → quản lý xác nhận → confirmed', 'app', 'pg'],
    ['8', 'Báo cáo & lương', 'Tổng công = Σ hệ số ca đủ vào+ra; Rate 1–4; lương đọc giờ đã duyệt + thưởng/phạt', 'web', 'tk']
  ];

  function flowHtml() {
    return '<div class="flow">' + flow.map(([n, t, s, w, go]) => '<div class="st" data-act="rgo" data-k="' + go + '" data-w="' + w + '" style="border-top-color:' + (w === 'web' ? '#2e7d32' : '#1565c0') + '"><div class="n">Bước ' + n + '</div><b>' + t + '</b><small>' + s + '</small><div class="where"><span class="tag ' + w + '">' + (w === 'web' ? 'Portal' : 'App + API') + '</span> → mở màn</div></div>').join('') + '</div>';
  }
  A.rgo = (d) => {
    if (d.w === 'web') { window.Main.mode('portal'); Portal.go(d.k); }
    else { window.Main.mode('app'); }
  };

  function smHtml() {
    const S = Engine.STATUS;
    const node = (k, sub) => '<div class="node" style="background:' + S[k].color + '">' + S[k].label + '<small>' + k + (sub ? ' · ' + sub : '') + '</small></div>';
    const arr = (t) => '<div class="arr"><b>→</b>' + t + '</div>';
    return '<div class="rcard"><h3>Vòng đời trạng thái 1 ca (time_working_staff_status)</h3><div class="sm">' + node('waiting', 'NV tự tạo/đổi ca/xin trễ') + arr('Quản lý duyệt<br>(hoặc NV không cần duyệt)') + node('approved', 'hiện ở thẻ chấm công') + arr('Check-out lượt cuối') + node('not-confirm', 'chờ xác nhận giờ') + arr('Quản lý xác nhận giờ<br>(accept-actual-time)') + node('confirmed', 'khoá cập nhật') + '</div>' +
      '<table class="simple"><tr><th>Đường tắt</th><th>Kết quả</th></tr><tr><td>Admin thêm ca trên Portal / phân ca</td><td>Tạo thẳng <b>approved</b></td></tr><tr><td>Chấm công hộ trên Portal có giờ ra</td><td>approved → <b>confirmed</b> luôn</td></tr><tr><td>Duyệt tất cả / duyệt trễ-sớm / duyệt đổi ca trên app với ca checking_type = 0</td><td>→ <b>not-confirm</b> (bỏ qua bước chấm)</td></tr><tr><td>Quản lý từ chối</td><td>→ <b>not-approved</b></td></tr><tr><td>NV gửi xin trễ/sớm khi ca đang approved</td><td>approved → <b>waiting</b> (biến khỏi thẻ chấm công!)</td></tr><tr><td>Quên check-out</td><td>Kẹt ở <b>approved</b> (không có cron tự đóng) cho tới khi quản lý chấm hộ / xác nhận</td></tr></table></div>';
  }

  /* ---------- bộ thử check-in ---------- */
  function checkinTester() {
    return '<div class="rcard"><h3>🧪 Thử rule CHECK-IN (server)' + N('app-flow') + '</h3>' +
      row('Giờ vào ca', '<input type="time" id="ciStart" value="08:00">') + row('Giờ bấm check-in', '<input type="time" id="ciNow" value="08:20">') +
      row('checkin_time_before (phút, 0 = tắt)', '<input type="number" id="ciBefore" value="30" style="width:80px">') + row('late_check_in (phút, 0 = tắt)', '<input type="number" id="ciLate" value="15" style="width:80px">') +
      row('Ca đã được duyệt đi trễ?', '<input type="checkbox" id="ciAppr">') + row('NV linh động (check_in_limit = 0)?', '<input type="checkbox" id="ciFree">') +
      row('IP wifi khớp cấu hình?', '<input type="checkbox" id="ciWifi">') + row('Khoảng cách / bán kính (m)', '<input type="number" id="ciDist" value="350" style="width:80px"> / <input type="number" id="ciRad" value="100" style="width:80px">') +
      '<button class="btn btn-primary" data-act="ciRun" style="margin-top:8px">Chạy kiểm tra</button><div id="ciOut"></div></div>';
  }
  const row = (l, i) => '<div class="row"><label>' + l + '</label>' + i + '</div>';
  A.ciRun = () => {
    const g = (id) => document.getElementById(id);
    const st = T.toMin(g('ciStart').value), now = T.toMin(g('ciNow').value);
    const before = Number(g('ciBefore').value) || 0, late = Number(g('ciLate').value) || 0;
    const steps = []; let stop = null;
    if (before > 0) { if (now < st - before) { steps.push(['stop', 'checkin_time_before: ' + fm(now) + ' sớm hơn ' + fm(st - before) + ' → "Chưa đến thời gian được checkin cho phép."']); stop = 1; } else steps.push(['pass', 'checkin_time_before: ' + fm(now) + ' ≥ ' + fm(st - before) + ' ✓']); }
    else steps.push(['skip', 'checkin_time_before = 0 → không giới hạn sớm']);
    if (!stop) {
      if (late > 0) {
        if (g('ciAppr').checked) steps.push(['pass', 'late_check_in: ca đã được duyệt đi trễ → không chặn']);
        else if (now > st + late) { steps.push(['stop', 'late_check_in: ' + fm(now) + ' > ' + fm(st + late) + ' và chưa duyệt trễ → "Quá thời gian checkin."']); stop = 1; }
        else steps.push(['pass', 'late_check_in: ' + fm(now) + ' ≤ ' + fm(st + late) + ' ✓']);
      } else steps.push(['skip', 'late_check_in = 0 → không chặn trễ']);
    }
    if (!stop) {
      if (g('ciFree').checked) steps.push(['skip', 'NV linh động → bỏ qua wifi/GPS (timekeeping_type = free)']);
      else if (g('ciWifi').checked) steps.push(['pass', 'IP wifi khớp wifi_ip → hợp lệ (timekeeping_type = wifi)']);
      else {
        const d = Number(g('ciDist').value), r = Number(g('ciRad').value) || 100;
        if (d <= r) steps.push(['pass', 'Wifi không khớp → GPS: ' + d + 'm ≤ ' + r + 'm ✓ (timekeeping_type = gps)']);
        else { steps.push(['stop', 'Wifi không khớp, GPS ' + d + 'm > ' + r + 'm → "Vui lòng kết nối với wifi … hoặc đến gần văn phòng để check-in/checkout"']); stop = 1; }
      }
    }
    if (!stop) steps.push(['pass', 'Ghi log, number_late_time = ' + Math.max(0, now - st) + ' phút (tính thô, KHÔNG trừ ân hạn) · noti cho quản lý']);
    g('ciOut').innerHTML = verdict(!stop, stop ? 'BỊ CHẶN' : 'CHECK-IN THÀNH CÔNG', steps);
  };
  const fm = (m) => T.pad(Math.floor(((m % 1440) + 1440) % 1440 / 60)) + ':' + T.pad(((m % 60) + 60) % 60);
  const verdict = (ok, title, steps) => '<div class="verdict ' + (ok ? 'ok' : 'bad') + '"><b>' + title + '</b><ol>' + steps.map(([k, t]) => '<li class="' + k + '">' + esc(t) + '</li>').join('') + '</ol></div>';

  /* ---------- bộ thử tô màu / trạng thái ---------- */
  function colorTester() {
    return '<div class="rcard"><h3>🎨 Thử rule TÔ MÀU / TRẠNG THÁI ca' + N('tws-color') + '</h3>' +
      row('Ngày của ca', '<select id="coDay"><option value="past">Quá khứ</option><option value="today" selected>Hôm nay</option><option value="future">Tương lai</option></select>') +
      row('Giờ ca', '<input type="time" id="coS" value="08:00"> → <input type="time" id="coE" value="17:00">') +
      row('Giờ vào / ra thực tế (để trống = chưa chấm)', '<input type="time" id="coI" value="08:20"> / <input type="time" id="coO" value="">') +
      row('is_deducted', '<select id="coDed"><option value="">null</option><option value="0">0 (có lương)</option><option value="1">1 (không lương)</option></select>') +
      row('late / off_check_in', '<input type="number" id="coL" value="15" style="width:70px"> / <input type="number" id="coOI" value="60" style="width:70px">') +
      row('back_soon / off_check_out', '<input type="number" id="coB" value="15" style="width:70px"> / <input type="number" id="coOO" value="60" style="width:70px">') +
      '<button class="btn btn-primary" data-act="coRun" style="margin-top:8px">Tính</button><div id="coOut"></div></div>';
  }
  A.coRun = () => {
    const g = (id) => document.getElementById(id).value;
    const day = g('coDay'), st = T.toMin(g('coS')); let en = T.toMin(g('coE')); if (en <= st) en += 1440;
    const ci = g('coI') ? T.toMin(g('coI')) : null; let co = g('coO') ? T.toMin(g('coO')) : null; if (co != null && co < st) co += 1440;
    const ded = g('coDed') === '' ? null : Number(g('coDed'));
    const late = +g('coL'), oi = +g('coOI'), bs = +g('coB'), oo = +g('coOO');
    const C = { future: ['#D3D3D3', 'Chưa đến ca'], paid: ['#8E9FE6', 'Nghỉ phép có lương'], unpaid: ['#E5E0FF', 'Nghỉ phép không lương'], ok: ['#3FAE8F', 'Đúng giờ'], miss: ['#F08A5D', 'Chưa vào/ra ca'], late: ['#F2B84B', 'Vào trễ/ra sớm'] };
    const steps = []; let k;
    if (day === 'future') {
      k = 'future'; steps.push(['pass', 'Ngày tương lai → mặc định Chưa đến ca']);
      if (ded === 0) { k = 'paid'; steps.push(['pass', 'is_deducted = 0 → Nghỉ có lương']); }
      if (ded === 1) { k = 'unpaid'; steps.push(['pass', 'is_deducted = 1 → Nghỉ không lương']); }
    } else {
      let stopped = false;
      if (day === 'today') {
        k = 'ok'; steps.push(['pass', 'Hôm nay → mặc định Đúng giờ']);
        if (ci == null || co == null) { k = 'miss'; steps.push(['pass', 'Thiếu vào hoặc ra → Chưa vào/ra ca']); }
        if (ded === 0) { k = 'paid'; steps.push(['pass', 'is_deducted = 0']); }
        if (ded === 1) { k = 'unpaid'; steps.push(['pass', 'is_deducted = 1']); }
      } else {
        if (ded === 0 || ded === 1) { k = ded ? 'unpaid' : 'paid'; steps.push(['stop', 'Quá khứ & is_deducted = ' + ded + ' → dừng']); stopped = true; }
        else if (ci == null && co == null) { k = 'unpaid'; steps.push(['pass', 'Quá khứ, không vào không ra → coi như Nghỉ không lương']); }
        else if (ci == null || co == null) { k = 'miss'; steps.push(['pass', 'Thiếu 1 trong 2 → Chưa vào/ra ca']); }
        else { k = 'ok'; steps.push(['pass', 'Đủ vào/ra → Đúng giờ']); }
      }
      if (!stopped) {
        if (ci != null && ci > st + late) { k = 'late'; steps.push(['pass', 'Vào ' + fm(ci) + ' > ' + fm(st) + ' + ' + late + 'p → Vào trễ']); } else if (ci != null) steps.push(['skip', 'Vào ' + fm(ci) + ' trong ân hạn ' + late + 'p']);
        if (co != null && co < en - bs) { k = 'late'; steps.push(['pass', 'Ra ' + fm(co) + ' < ' + fm(en) + ' − ' + bs + 'p → Ra sớm']); } else if (co != null) steps.push(['skip', 'Ra ' + fm(co) + ' không sớm']);
        if (oi > 0 && ci != null && ci > st + oi) { k = 'unpaid'; steps.push(['pass', 'Vào trễ quá off_check_in ' + oi + 'p → Nghỉ không lương']); }
        if (oo > 0 && co != null && co < en - oo) { k = 'unpaid'; steps.push(['pass', 'Ra sớm quá off_check_out ' + oo + 'p → Nghỉ không lương']); }
      }
    }
    const [c, l] = C[k];
    document.getElementById('coOut').innerHTML = '<div class="verdict ok" style="background:#f7f8fa;color:#333"><div style="display:flex;align-items:center;gap:10px"><span style="width:46px;height:30px;border-radius:6px;background:' + c + ';display:inline-block"></span><b>' + l + ' (' + c + ')</b></div><ol>' + steps.map(([s, t]) => '<li class="' + s + '">' + esc(t) + '</li>').join('') + '</ol><div style="font-size:12px;color:#888">Điều kiện sau ghi đè điều kiện trước. Phút trễ ' + (ci != null ? Math.max(0, ci - st) : 0) + ' · phút sớm ' + (co != null ? Math.max(0, en - co) : 0) + '.</div></div>';
  };

  /* ---------- bộ thử giờ công ---------- */
  function hourTester() {
    return '<div class="rcard"><h3>⏱ Thử rule TÍNH GIỜ CÔNG' + N('shift-lunch') + '</h3>' +
      row('Nghỉ trưa của ca', '<input type="time" id="hL1" value="12:00"> → <input type="time" id="hL2" value="13:00">') +
      row('Giờ vào / ra (app)', '<input type="time" id="hI" value="07:55"> / <input type="time" id="hO" value="17:10">') +
      '<button class="btn btn-primary" data-act="hRun" style="margin-top:8px">Tính</button><div id="hOut"></div></div>';
  }
  A.hRun = () => {
    const g = (id) => document.getElementById(id).value;
    const i = T.toMin(g('hI')); let o = T.toMin(g('hO')); if (o < i) o += 1440;
    let ov = 0; if (g('hL1') && g('hL2')) { const a = T.toMin(g('hL1')); let b = T.toMin(g('hL2')); if (b < a) b += 1440; ov = Math.max(0, Math.min(o, b) - Math.max(i, a)); }
    const app = Math.round((o - i - ov) / 60 * 100) / 100, att = Math.round((o - i) / 60 * 100) / 100;
    document.getElementById('hOut').innerHTML = verdict(true, 'Kết quả', [
      ['pass', 'Check-out từ app: actual_time_work = (' + fm(o) + ' − ' + fm(i) + ') − trùng nghỉ trưa ' + ov + 'p = ' + app + ' giờ'],
      ['pass', 'Chấm công hộ trên Portal: (ra − vào) = ' + att + ' giờ (KHÔNG trừ nghỉ trưa)'],
      ['skip', 'Không cắt trần theo giờ ca, không làm tròn theo hệ số. Lương dùng giờ quản lý xác nhận (actual_time_work_confirmed).']
    ]);
  };

  function cfgTable() {
    const rowsC = [
      ['late_check_in', 'Ngưỡng "vào trễ" khi tô màu/báo cáo', 'CHẶN check-in nếu trễ quá N phút và chưa duyệt trễ', '0 = không chặn'],
      ['off_check_in', 'Trễ quá N phút → nghỉ không lương', '—', '0 = tắt'],
      ['back_soon_check_out', 'Ngưỡng "ra sớm"', 'Không chặn check-out', '0'],
      ['off_check_out', 'Sớm quá N phút → nghỉ không lương', '—', '0 = tắt'],
      ['checkin_time_before', '—', 'CHẶN check-in sớm hơn N phút', '0 = không giới hạn'],
      ['checkin_with_image', '—', 'App bắt chụp selfie (server không bắt buộc)', '0'],
      ['close_time_working_start/end', 'Kỳ công (TimeSheet)', 'Bảng công tháng trên app', '26 / 25'],
      ['admin_confirm_work_schedule', 'Admin được Confirm working time', '—', 'tắt'],
      ['staffs.check_in_limit = 0', '—', 'Bỏ qua wifi/GPS', '1'],
      ['staffs.check_approved_time_working = 0', '—', 'Mọi yêu cầu tự approved', '1'],
      ['sf_timekeeping_config', '—', 'wifi_ip khớp HOẶC GPS ≤ allowable_radius', 'radius 100m']
    ];
    return '<div class="rcard"><h3>⚙ Cấu hình nào ảnh hưởng ở đâu</h3><table class="simple"><tr><th>Cấu hình</th><th>Ảnh hưởng Portal / báo cáo</th><th>Ảnh hưởng App / API</th><th>Khi tắt / thiếu</th></tr>' + rowsC.map((r) => '<tr>' + r.map((c, i) => '<td>' + (i === 0 ? '<code>' + c + '</code>' : esc(c)) + '</td>').join('') + '</tr>').join('') + '</table></div>';
  }

  function whoTable() {
    const r = [
      ['Tạo/sửa ca', '✔', '', 'Portal › Ca làm việc'], ['Phân ca hàng loạt', '✔', '', 'Portal › Phân ca'], ['Thêm ca 1 ngày', '✔ (approved)', '✔ (waiting nếu cần duyệt)', ''],
      ['Đăng ký lịch tuần', '', '✔ sao chép tuần trước', ''], ['Duyệt lịch', '✔ quản lý trực tiếp', '✔ LLV nhân viên', 'Backend không kiểm quyền'],
      ['Check-in/out', '', '✔', 'Chỉ app NV'], ['Chấm công hộ', '✔ (ghi đè log)', '✔ Chấm công thủ công', ''], ['Xác nhận giờ', '✔ Confirm working time', '✔ Xác nhận thời gian làm việc', 'Portal có kiểm quyền'],
      ['Đổi ca', '', '✔ NV xin / QL đổi hộ', ''], ['Xin đi trễ/về sớm', '', '✔ NV xin', ''], ['Duyệt trễ/sớm', '✔ Lịch sử chấm công', '✔ PGLate', ''],
      ['OT', '✔ Làm thêm giờ', '✔ Làm thêm giờ', 'Ca hệ thống OT'], ['Nghỉ có/không lương', '✔', '', 'Chỉ đổi is_deducted'], ['Thưởng/phạt', '✔', '', 'Vào lương']
    ];
    return '<div class="rcard"><h3>👥 Thao tác nào làm ở đâu</h3><table class="simple"><tr><th>Thao tác</th><th><span class="tag web">Portal</span></th><th><span class="tag app">App</span></th><th>Ghi chú</th></tr>' + r.map((x) => '<tr>' + x.map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</table></div>';
  }

  function bugs() {
    const b = [
      'Backend Portal & Staff API <b>không kiểm quyền</b> (trừ Confirm working time); API không kiểm ca có thuộc user đăng nhập.',
      'Có 2 luồng check-in: cũ <code>/timekeeping/check-in</code> (IP server, có ân hạn) và mới <code>/time-working-staff/check-in</code> (app đang dùng).',
      'App không chặn bán kính GPS, không kiểm mock location; server tin dữ liệu client (IP, giờ vào lượt, số lượt, status).',
      'Rule trễ ở lượt 2–5 vẫn so với giờ bắt đầu ca → có thể chặn lượt sau.',
      'Thẻ chấm công luôn lấy ca sớm nhất trong ngày → nhiều ca/ngày không chuyển sang ca kế tiếp.',
      'App kiểm "ngày ca = ngày máy" cả khi check-out → <b>ca qua đêm không check-out được</b> vào ngày hôm sau.',
      'Xin trễ/sớm làm ca về waiting → ca biến khỏi thẻ chấm công đến khi được duyệt lại.',
      'Không có cron tự đóng ca khi quên check-out.',
      '<code>close_time_working_end</code> luôn lưu tắt → API dùng mặc định 25.',
      'Màu chú giải dưới lưới Portal không khớp màu thực tế; app hiện "waiting-confirm" thành "Chờ duyệt".',
      'Màn chi tiết app tráo người/ngày duyệt giữa đơn đi muộn và về sớm.',
      '<code>storeOvertime</code> (Portal) mất cột status do $fillable; <code>ShiftTable::getInfo</code> không lấy shift_code → trừ phép theo mã ca không chạy.',
      'Duyệt phép trên staff-api không cập nhật ca; <code>TimeOffDaysController:488</code> dùng "=" thay "==".',
      'TimeSheet, report-time-working-staff, report-time thiếu view/method → không chạy.'
    ];
    return '<div class="rcard"><h3>⚠ Lỗi / rủi ro phát hiện trong code</h3><ol class="bugs">' + b.map((x) => '<li>' + x + '</li>').join('') + '</ol></div>';
  }

  const Rules = {
    render() {
      document.getElementById('main').innerHTML = '<div class="rule-page"><h1>Rule & luồng chấm công</h1><div class="lead">Trang tóm tắt dễ hiểu. Bấm vào một bước để mở màn hình mô phỏng tương ứng. Dùng các bộ thử bên dưới để xem một tình huống bị chặn / tô màu / tính giờ ra sao, kèm lý do từng bước.</div>' +
        flowHtml() + smHtml() + '<div class="rgrid"><div>' + checkinTester() + hourTester() + '</div><div>' + colorTester() + '</div></div>' + cfgTable() + whoTable() + bugs() + '</div>';
      A.ciRun(); A.coRun(); A.hRun();
    }
  };
  window.Rules = Rules;
})();
