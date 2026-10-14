/* ===== Bộ máy rule: mô phỏng logic Staff API + Portal (theo code đã phân tích) ===== */
(function () {
  const T = Store.T;
  const S = () => Store.S;

  const STATUS = {
    waiting: { label: 'Chờ duyệt', color: '#E91D62' },
    approved: { label: 'Đã duyệt', color: '#3398dc' },
    'not-approved': { label: 'Không được duyệt', color: '#000000' },
    'not-confirm': { label: 'Chờ xác nhận', color: '#FF9800' },
    confirmed: { label: 'Đã xác nhận', color: '#2AA27E' },
    'waiting-confirm': { label: 'Chấm công hộ', color: '#9C27B0' }
  };

  const REPORT = {
    not_yet: { label: 'Chưa đến ca', color: '#B0B5BD' },
    on_time: { label: 'Chấm công đúng giờ', color: '#3FAE8F' },
    missing_check: { label: 'Chưa vào/ra ca', color: '#F08A5D' },
    late_or_early: { label: 'Vào trễ/ra sớm', color: '#F2B84B' },
    paid_leave: { label: 'Nghỉ phép có lương', color: '#8E9FE6' },
    unpaid_leave: { label: 'Nghỉ phép không lương', color: '#E5E0FF' },
    overtime: { label: 'Tăng ca', color: '#E04F5F' }
  };

  /* ---------- tiện ích bản ghi ca ---------- */
  const E = {
    STATUS, REPORT,
    shiftOf: (tw) => Store.shift(tw.shift_id) || { shift_name: '(ca đã xoá)' },
    start: (tw) => T.dt(tw.working_day, tw.working_time),
    end: (tw) => T.dt(tw.working_end_day || tw.working_day, tw.working_end_time),
    inOf: (tw, step) => tw.ins.find((x) => x.step === step),
    outOf: (tw, step) => tw.outs.find((x) => x.step === step),
    isIn: (tw) => (tw.ins.some((x) => x.step === 1) ? 1 : 0),
    isOut: (tw) => (tw.outs.some((x) => x.step === 1) ? 1 : 0),
    firstIn: (tw) => tw.ins.slice().sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time))[0],
    lastOut: (tw) => tw.outs.slice().sort((a, b) => (b.day + b.time).localeCompare(a.day + a.time))[0],
    inDT: (x) => (x ? T.dt(x.day, x.time) : null),
    staffName: (id) => (Store.staff(id) || {}).full_name || '?',
    active: () => S().tws.filter((t) => !t.is_deleted)
  };

  /* ---------- nhật ký + thông báo ---------- */
  const listeners = [];
  E.onLog = (fn) => listeners.push(fn);
  E.log = (entry) => {
    entry.at = T.dmy(Store.today()) + ' ' + T.hm(Store.now());
    S().log.unshift(entry);
    if (S().log.length > 200) S().log.length = 200;
    Store.save();
    listeners.forEach((fn) => fn(entry));
  };
  E.notify = (to, title, message) => {
    if (!to) return;
    S().noti.unshift({ to, title, message, at: T.dmy(Store.today()) + ' ' + T.hm(Store.now()) });
  };
  const ok = (api, message, db, extra) => { E.log({ api, ok: true, message, db: db || [] }); return Object.assign({ ok: true, message }, extra || {}); };
  const fail = (api, message, why) => { E.log({ api, ok: false, message, why }); return { ok: false, message, why }; };

  /* ---------- tính giờ ---------- */
  E.lunchOverlapMin = (tw, a, b) => {
    const s = E.shiftOf(tw);
    if (!s.start_lunch_break || !s.end_lunch_break) return 0;
    let ls = T.dt(tw.working_day, s.start_lunch_break);
    let le = T.dt(tw.working_day, s.end_lunch_break);
    if (s.start_lunch_break < tw.working_time) { ls = T.addMin(ls, 1440); le = T.addMin(le, 1440); }
    if (le <= ls) le = T.addMin(le, 1440);
    const st = Math.max(a.getTime(), ls.getTime()), en = Math.min(b.getTime(), le.getTime());
    return en > st ? Math.round((en - st) / 60000) : 0;
  };
  E.shiftHourWork = (start, end, ls, le) => {
    const sm = T.toMin(start); let em = T.toMin(end);
    if (em <= sm) em += 1440;
    let lunch = 0;
    if (ls && le) { const a = T.toMin(ls); let b = T.toMin(le); if (b <= a) b += 1440; lunch = b - a; }
    return Math.max(0, Math.round(((em - sm) - lunch) / 60 * 100) / 100);
  };

  /* ---------- kiểm tra vị trí (checkWithWifi / checkWithGPS) ---------- */
  E.checkLocation = (branchId, ip, lat, lng) => {
    const cfgs = S().tkConfigs.filter((c) => c.branch_id === Number(branchId) && c.is_actived && !c.is_deleted);
    if (!cfgs.length) return { ok: false, code: 'BRANCH_NOT_CONFIGURED_FOR_CHECK_IN', message: 'Chi nhánh chưa cấu hình chấm công.' };
    const wifis = cfgs.filter((c) => c.timekeeping_type === 'wifi');
    const gpss = cfgs.filter((c) => c.timekeeping_type === 'gps');
    const hit = wifis.find((c) => c.wifi_ip && c.wifi_ip === ip);
    if (hit) return { ok: true, type: 'wifi', distance: 0, detail: 'IP ' + ip + ' khớp wifi "' + hit.wifi_name + '"' };
    let best = null;
    for (const g of gpss) {
      if (lat == null || lng == null) continue;
      const dist = T.distance(Number(g.latitude), Number(g.longitude), lat, lng);
      const r = g.allowable_radius == null ? 100 : Number(g.allowable_radius);
      if (!best || dist < best.dist) best = { dist, r };
      if (r >= dist) return { ok: true, type: 'gps', distance: dist, detail: 'Cách điểm GPS ' + dist + 'm ≤ bán kính ' + r + 'm' };
    }
    const names = wifis.map((w) => w.wifi_name).join(', ');
    let message;
    if (wifis.length && gpss.length) message = 'Vui lòng kết nối với wifi ' + names + ' hoặc đến gần văn phòng để check-in/checkout';
    else if (gpss.length) message = 'Vui lòng đến gần văn phòng để check-in/checkout';
    else message = 'Vui lòng kết nối với wifi ' + names + ' để check-in/checkout';
    return { ok: false, message, detail: best ? 'Khoảng cách gần nhất ' + best.dist + 'm > bán kính ' + best.r + 'm' : 'Không khớp IP wifi, không có toạ độ GPS hợp lệ' };
  };

  /* ================= STAFF API ================= */
  E.api = {};

  /* POST /timekeeping/shift */
  E.api.currentShift = (staffId) => {
    const today = Store.today();
    const list = E.active().filter((t) => t.staff_id === Number(staffId) && t.time_working_staff_status === 'approved' && t.is_deducted === null && t.working_day <= today && today <= (t.working_end_day || t.working_day))
      .sort((a, b) => a.working_time.localeCompare(b.working_time));
    if (!list.length) return { ok: false, errorCode: 1, message: 'Hôm nay không có lịch làm việc' };
    return { ok: true, data: list[0], others: list.length - 1 };
  };

  /* POST /time-working-staff/check-in */
  E.api.checkIn = (staffId, twId, p) => {
    const api = 'POST time-working-staff/check-in';
    const tw = Store.tw(twId); const staff = Store.staff(staffId);
    const now = Store.now(); const start = E.start(tw);
    const before = Store.cfgMin('checkin_time_before');
    if (before > 0 && now < T.addMin(start, -before)) return fail(api, 'Chưa đến thời gian được checkin cho phép.', 'Bây giờ ' + T.hm(now) + ' sớm hơn ' + T.hm(T.addMin(start, -before)) + ' (giờ vào ca ' + tw.working_time + ' − checkin_time_before ' + before + ' phút)');
    const late = Store.cfgMin('late_check_in');
    if (late > 0 && Number(tw.is_approve_late) !== 1 && now > T.addMin(start, late)) return fail(api, 'Quá thời gian checkin.', 'Bây giờ ' + T.hm(now) + ' trễ hơn ' + T.hm(T.addMin(start, late)) + ' (giờ vào ca + late_check_in ' + late + ' phút) và ca chưa được duyệt đi trễ');
    let loc = { ok: true, type: 'free', distance: 0, detail: 'Nhân viên chấm công linh động (check_in_limit = 0) → bỏ qua wifi/GPS' };
    if (staff.check_in_limit !== 0) {
      loc = E.checkLocation(tw.branch_id, p.ip, p.lat, p.lng);
      if (!loc.ok) return fail(api, loc.message, loc.detail);
    }
    const step = tw.checking_curent_step || 1;
    const db = [];
    if (tw.time_working_staff_status === 'confirmed') {
      db.push('Ca đã "confirmed" → chỉ ghi log, KHÔNG cập nhật sf_time_working_staffs');
    } else {
      tw.ins = tw.ins.filter((x) => x.step !== step);
      tw.ins.push({ step, day: Store.today(), time: T.hm(now), created_type: 'staff', timekeeping_type: loc.type, ip: p.ip, lat: p.lat, lng: p.lng, image: p.image || null, radius: p.radius });
      tw.number_late_time = Math.max(0, T.diffMin(now, start));
      db.push('sf_check_in_log: thêm log lượt ' + step + ' (timekeeping_type=' + loc.type + ')');
      db.push('sf_time_working_staffs: ' + (step === 1 ? 'is_check_in' : 'is_check_in_' + (step - 1)) + '=1, number_late_time=' + tw.number_late_time + ' phút (tính thô, không trừ ân hạn)');
    }
    const m = staff.staff_manager_id;
    E.notify(m, staff.full_name + ' chấm công', staff.full_name + ' đã checkin vào lúc ' + T.hm(now) + ' của ca ' + E.shiftOf(tw).shift_name);
    db.push('Push noti → quản lý ' + E.staffName(m));
    Store.save();
    return ok(api, 'Chấm công vào thành công', db, { loc, time: T.hm(now) });
  };

  /* POST /time-working-staff/check-out */
  E.api.checkOut = (staffId, twId, p) => {
    const api = 'POST time-working-staff/check-out';
    const tw = Store.tw(twId); const staff = Store.staff(staffId);
    const now = Store.now(); const end = E.end(tw);
    let loc = { ok: true, type: 'free', detail: 'check_in_limit = 0 → bỏ qua wifi/GPS' };
    if (staff.check_in_limit !== 0) {
      loc = E.checkLocation(tw.branch_id, p.ip, p.lat, p.lng);
      if (!loc.ok) return fail(api, loc.message, loc.detail);
    }
    const step = tw.checking_curent_step || 1;
    const db = [];
    if (tw.time_working_staff_status === 'confirmed') {
      db.push('Ca đã "confirmed" → không cập nhật ca');
    } else {
      tw.outs = tw.outs.filter((x) => x.step !== step);
      tw.outs.push({ step, day: Store.today(), time: T.hm(now), created_type: 'staff', timekeeping_type: loc.type, ip: p.ip, lat: p.lat, lng: p.lng, image: p.image || null });
      const inn = E.inOf(tw, step);
      let hrs = 0;
      if (inn) {
        const a = E.inDT(inn);
        hrs = Math.max(0, (T.diffMin(now, a) - E.lunchOverlapMin(tw, a, now)) / 60);
      }
      tw['actual_time_work_' + (step - 1)] = Math.round(hrs * 100) / 100;
      let sum = 0; for (let i = 0; i < 5; i++) sum += Number(tw['actual_time_work_' + i] || 0);
      tw.actual_time_work = Math.round(sum * 100) / 100;
      tw.number_time_back_soon = Math.max(0, T.diffMin(end, now));
      db.push('sf_check_out_log: thêm log lượt ' + step);
      db.push('actual_time_work_' + (step - 1) + ' = ' + T.fmtH(tw['actual_time_work_' + (step - 1)]) + 'h (ra − vào − phần trùng nghỉ trưa); tổng actual_time_work = ' + T.fmtH(tw.actual_time_work) + 'h');
      db.push('number_time_back_soon = ' + tw.number_time_back_soon + ' phút');
      if (step < (tw.checking_type || 1)) {
        tw.checking_curent_step = step + 1;
        db.push('Còn lượt → checking_curent_step = ' + tw.checking_curent_step);
      } else {
        tw.time_working_staff_status = 'not-confirm';
        db.push('Lượt cuối → time_working_staff_status = "not-confirm" (app gửi lên)');
        E.notify(staff.staff_manager_id, 'Xác nhận lịch làm việc', 'Đang có lịch làm việc ngày ' + T.dmy(tw.working_day) + ' của ' + staff.full_name + ' đang chờ xác nhận.');
        db.push('Push noti → quản lý: chờ xác nhận');
      }
    }
    Store.save();
    return ok(api, 'Chấm công ra thành công', db, { loc, time: T.hm(now) });
  };

  const autoApprove = (staff, actorId) => staff.check_approved_time_working === 0 || (actorId != null && Number(actorId) === staff.staff_manager_id);

  E.overlap = (staffId, day, start, end, exceptId) => E.active().some((t) => t.staff_id === Number(staffId) && t.id !== exceptId && t.time_working_staff_status !== 'not-approved' &&
    E.start(t) < end && E.end(t) > T.addMin(start, 1));

  /* POST /time-working-staff/change-shift */
  E.api.changeShift = (actorId, twId, p) => {
    const api = 'POST time-working-staff/change-shift';
    const tw = Store.tw(twId); const staff = Store.staff(tw.staff_id); const ns = Store.shift(p.shift_id);
    if (!ns) return fail(api, 'Vui lòng chọn ca làm việc', 'Validate phía app');
    const db = [];
    const auto = autoApprove(staff, actorId);
    if (tw.ins.length) { tw.ins = []; tw.outs = []; tw.checking_curent_step = 1; db.push('Ca đã check-in → reset chấm công, XOÁ log vào'); }
    const old = tw.shift_id;
    tw.shift_id = ns.shift_id; tw.branch_id = Number(p.branch_id || tw.branch_id);
    tw.working_time = p.working_time || ns.start_work_time; tw.working_end_time = p.working_end_time || ns.end_work_time;
    tw.working_end_day = tw.working_end_time <= tw.working_time ? T.addDays(tw.working_day, 1) : tw.working_day;
    tw.checking_type = ns.checking_type; tw.timekeeping_coefficient = ns.timekeeping_coefficient;
    tw.old_shift_id = old; tw.old_shift_note = p.note || ''; tw.is_approved_next_shift = auto ? 1 : 0; tw.approve_next_shift_by = auto ? Number(actorId) : null;
    tw.time_working_staff_status = auto ? 'approved' : 'waiting';
    db.push('shift_id: ' + E.shiftOf({ shift_id: old }).shift_name + ' → ' + ns.shift_name + ', old_shift_id lưu ca cũ');
    db.push('time_working_staff_status = ' + tw.time_working_staff_status + (auto ? ' (tự duyệt: NV không cần duyệt hoặc người đổi là quản lý)' : ' (chờ quản lý duyệt)'));
    if (auto && Number(actorId) === staff.staff_manager_id) E.notify(staff.staff_id, 'Quản lí đổi ca lịch làm việc', 'Đã đổi ca lịch làm việc ngày ' + T.dmy(tw.working_day) + ' của bạn thành ' + ns.shift_name + '.');
    else if (!auto) E.notify(staff.staff_manager_id, 'Phê duyệt lịch làm việc', 'Đang có lịch làm việc ngày ' + T.dmy(tw.working_day) + ' của ' + staff.full_name + ' đang chờ phê duyệt.');
    Store.save();
    return ok(api, 'Đổi ca thành công', db);
  };

  /* POST /time-working-staff/submit-time-late-soon */
  E.api.submitLateSoon = (actorId, twId, p) => {
    const api = 'POST time-working-staff/submit-time-late-soon';
    const tw = Store.tw(twId); const staff = Store.staff(tw.staff_id);
    const auto = autoApprove(staff, null);
    tw.time_late_apply_work_late = Number(p.late || 0); tw.time_late_apply_work_late_note = p.lateNote || '';
    tw.time_late_apply_work_soon = Number(p.soon || 0); tw.time_late_apply_work_soon_note = p.soonNote || '';
    if (auto) { tw.is_approve_late = tw.time_late_apply_work_late ? 1 : 0; tw.is_approve_soon = tw.time_late_apply_work_soon ? 1 : 0; }
    else { tw.is_approve_late = 0; tw.is_approve_soon = 0; tw.time_working_staff_status = 'waiting'; }
    if (!auto) E.notify(staff.staff_manager_id, 'Phê duyệt đi sớm / về trễ', 'Đang có yêu cầu xin đi trễ / về sớm ngày ' + T.dmy(tw.working_day) + ' của ' + staff.full_name + ' đang chờ phê duyệt.');
    Store.save();
    return ok(api, 'Gửi yêu cầu thành công', ['time_late_apply_work_late=' + tw.time_late_apply_work_late + ', soon=' + tw.time_late_apply_work_soon,
      auto ? 'NV không cần duyệt → is_approve_late/soon = 1 ngay' : 'status → "waiting" (ca phải được duyệt lại mới hiện ở thẻ chấm công)']);
  };

  /* POST /time-working-staff/create-overtime */
  E.api.createOvertime = (actorId, p) => {
    const api = 'POST time-working-staff/create-overtime';
    const staff = Store.staff(p.staff_id);
    const ot = S().shifts.find((s) => s.shift_code === 'OT' && s.is_system);
    const st = T.dt(p.working_day, p.working_time), en = T.dt(p.working_end_day, p.working_end_time);
    if (!(en > st)) return fail(api, 'Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu', 'Validate phía app');
    if (!ot || !ot[T.dayKeys[T.weekday(p.working_day)]]) return fail(api, 'Ca làm thêm giờ không áp dụng cho ngày này', 'Ca hệ thống OT phải bật thứ trong tuần (message nguyên văn: chưa xác định)');
    if (E.overlap(p.staff_id, p.working_day, st, en)) return fail(api, 'Thời gian làm việc đã trùng với lịch khác', 'Trùng giờ với ca khác của nhân viên');
    const auto = autoApprove(staff, actorId);
    const hrs = T.hours(T.diffMin(en, st));
    const rec = E.newTw(staff.staff_id, ot.shift_id, p.working_day, p.branch_id, {
      working_time: p.working_time, working_end_day: p.working_end_day, working_end_time: p.working_end_time,
      is_ot: 1, overtime_type: 'H', time_work: hrs, min_time_work: hrs,
      time_working_staff_status: auto ? 'approved' : 'waiting', checking_type: p.is_not_check_in ? 0 : 1
    });
    const db = ['Tạo ca OT: is_ot=1, overtime_type="H", ' + T.fmtH(hrs) + 'h, status=' + rec.time_working_staff_status];
    if (p.is_not_check_in) {
      rec.ins.push({ step: 1, day: p.working_day, time: p.working_time, created_type: 'admin', timekeeping_type: 'time-attendance' });
      rec.outs.push({ step: 1, day: p.working_end_day, time: p.working_end_time, created_type: 'admin', timekeeping_type: 'time-attendance' });
      rec.actual_time_work = hrs; rec.actual_time_work_confirmed = hrs;
      db.push('"Không cần chấm công" → checking_type=0, tự đánh dấu đã vào/ra, có giờ xác nhận');
    } else db.push('NV phải tự check-in/out 1 lượt');
    if (!auto) E.notify(staff.staff_manager_id, 'Phê duyệt lịch làm việc', 'Đang có lịch làm việc thêm giờ ngày ' + T.dmy(p.working_day) + ' của ' + staff.full_name + ' đang chờ phê duyệt.');
    Store.save();
    return ok(api, 'Tạo làm thêm giờ thành công', db);
  };

  E.newTw = (staffId, shiftId, day, branchId, extra) => {
    const s = Store.shift(shiftId);
    const over = s.end_work_time <= s.start_work_time;
    const rec = {
      id: Store.nextId(), staff_id: Number(staffId), shift_id: s.shift_id, branch_id: Number(branchId), work_schedule_id: 0,
      working_day: day, working_time: s.start_work_time, working_end_day: over ? T.addDays(day, 1) : day, working_end_time: s.end_work_time,
      time_working_staff_status: 'approved', checking_type: s.checking_type, checking_curent_step: 1, ins: [], outs: [],
      is_deducted: null, is_ot: 0, overtime_type: null, timekeeping_coefficient: s.timekeeping_coefficient, time_work: s.time_work, min_time_work: s.min_time_work,
      actual_time_work: null, actual_time_work_confirmed: null, shift_code_approved: null, is_approve_late: 0, is_approve_soon: 0,
      time_late_apply_work_late: 0, time_late_apply_work_late_note: '', time_late_apply_work_soon: 0, time_late_apply_work_soon_note: '',
      approve_late_by: null, approve_soon_by: null, old_shift_id: null, old_shift_note: '', is_approved_next_shift: 0, approve_next_shift_by: null,
      number_late_time: 0, number_time_back_soon: 0, is_close: 0, is_deleted: 0, approved_manual_time_by: null, approved_actual_time_by: null, recompense: [], time_off_days_id: null
    };
    Object.assign(rec, extra || {});
    S().tws.push(rec);
    return rec;
  };

  /* POST /time-working-staff/add-shift-staff (app: Thêm ca) */
  E.api.addShiftStaff = (actorId, p) => {
    const api = 'POST time-working-staff/add-shift-staff';
    const staff = Store.staff(p.staff_id); const s = Store.shift(p.shift_id);
    if (!s) return fail(api, 'Bạn chưa chọn Ca', 'Validate phía app');
    const wt = p.working_time || s.start_work_time, we = p.working_end_time || s.end_work_time;
    const endDay = we <= wt ? T.addDays(p.working_day, 1) : p.working_day;
    if (E.overlap(p.staff_id, p.working_day, T.dt(p.working_day, wt), T.dt(endDay, we))) return fail(api, 'Thời gian làm việc đã trùng với lịch khác', 'Trùng giờ với ca khác');
    const auto = autoApprove(staff, null);
    const rec = E.newTw(staff.staff_id, s.shift_id, p.working_day, p.branch_id, { working_time: wt, working_end_time: we, working_end_day: endDay, time_working_staff_status: auto ? 'approved' : 'waiting', time_work: E.shiftHourWork(wt, we, s.start_lunch_break, s.end_lunch_break) });
    if (!auto) E.notify(staff.staff_manager_id, 'Phê duyệt lịch làm việc', 'Đang có lịch làm việc ngày ' + T.dmy(p.working_day) + ' của ' + staff.full_name + ' đang chờ phê duyệt.');
    Store.save();
    return ok(api, 'Thêm ca thành công', ['Tạo ca ' + s.shift_name + ' ngày ' + T.dmy(p.working_day) + ', status=' + rec.time_working_staff_status + (auto ? ' (NV không cần duyệt)' : '')]);
  };

  /* POST /time-working-staff/create (sao chép tuần trước) */
  E.api.createWeek = (staffId, items) => {
    const api = 'POST time-working-staff/create';
    const staff = Store.staff(staffId); const auto = autoApprove(staff, null);
    if (!items.length) return fail(api, 'Vui lòng nhập thời gian làm việc', 'Validate phía app');
    items.forEach((it) => E.newTw(staffId, it.shift_id, it.working_day, it.branch_id, { time_working_staff_status: auto ? 'approved' : 'waiting' }));
    Store.save();
    return ok(api, 'Thêm lịch làm việc thành công', [items.length + ' ca mới, status=' + (auto ? 'approved' : 'waiting')]);
  };

  /* ===== API phía quản lý (app pg_module) ===== */
  E.api.approveOne = (actorId, twId) => {
    const tw = Store.tw(twId);
    tw.time_working_staff_status = 'approved';
    E.notify(tw.staff_id, 'Phê duyệt lịch làm việc', 'Lịch làm việc ngày ' + T.dmy(tw.working_day) + ' của bạn đã được phê duyệt.');
    Store.save();
    return ok('POST time-working-staff/approved-time-working-staff', 'Duyệt thành công', ['status = "approved" (duyệt đơn lẻ luôn approved, bất kể checking_type)']);
  };
  E.api.approveAllV2 = (actorId, list) => {
    const db = [];
    list.forEach((tw) => {
      const ct = tw.checking_type;
      const st = (ct == null || ct === 0) ? 'not-confirm' : 'approved';
      if (tw.old_shift_id) { tw.is_approved_next_shift = 1; tw.approve_next_shift_by = actorId; }
      if (tw.time_late_apply_work_late) { tw.is_approve_late = 1; tw.approve_late_by = actorId; }
      if (tw.time_late_apply_work_soon) { tw.is_approve_soon = 1; tw.approve_soon_by = actorId; }
      tw.time_working_staff_status = st;
      db.push(T.dmy(tw.working_day) + ' ' + E.shiftOf(tw).shift_name + ' → ' + st);
    });
    if (list.length) E.notify(list[list.length - 1].staff_id, 'Phê duyệt lịch làm việc', 'Lịch làm việc tuần ' + T.isoWeek(list[0].working_day) + ' của bạn đã được phê duyệt.');
    Store.save();
    return ok('POST time-working-staff/approved-all-v2', 'Duyệt thành công', db);
  };
  E.api.approveLateSoon = (actorId, twId, p) => {
    const tw = Store.tw(twId);
    tw.time_late_apply_work_late = Number(p.late || 0); tw.time_late_apply_work_soon = Number(p.soon || 0);
    tw.is_approve_late = tw.time_late_apply_work_late ? 1 : 0; tw.is_approve_soon = tw.time_late_apply_work_soon ? 1 : 0;
    if (tw.is_approve_late) tw.approve_late_by = actorId; if (tw.is_approve_soon) tw.approve_soon_by = actorId;
    tw.time_working_staff_status = (tw.checking_type == null || tw.checking_type === 0) ? 'not-confirm' : 'approved';
    E.notify(tw.staff_id, 'Phê duyệt đi sớm / về trễ', 'Lịch làm việc ngày ' + T.dmy(tw.working_day) + ' của bạn đã được phê duyệt đi sớm / về trễ.');
    Store.save();
    return ok('POST time-working-staff/approved-time-soon-late-staff', 'Duyệt thành công', ['is_approve_late=' + tw.is_approve_late + ', is_approve_soon=' + tw.is_approve_soon, 'status = ' + tw.time_working_staff_status]);
  };
  E.api.approveChangeShift = (actorId, twId, p) => {
    const tw = Store.tw(twId); const s = Store.shift(p.shift_id);
    tw.shift_id = s.shift_id; tw.working_time = s.start_work_time; tw.working_end_time = s.end_work_time;
    tw.working_end_day = s.end_work_time <= s.start_work_time ? T.addDays(tw.working_day, 1) : tw.working_day; tw.checking_type = s.checking_type;
    tw.is_approved_next_shift = 1; tw.approve_next_shift_by = actorId;
    if (p.status) tw.time_working_staff_status = p.status;
    E.notify(tw.staff_id, 'Phê duyệt đổi ca lịch làm việc', 'Lịch làm việc ngày ' + T.dmy(tw.working_day) + ' của bạn đã được phê duyệt đổi ca.');
    Store.save();
    return ok('POST time-working-staff/approved-change-shift', p.status ? 'Đã duyệt thời gian làm việc' : 'Đơn phép đã được duyệt', ['is_approved_next_shift=1', p.status ? 'status = ' + p.status : 'status giữ nguyên (còn đơn đi muộn + về sớm chờ duyệt)']);
  };
  E.api.acceptActualTime = (actorId, twId, p) => {
    const tw = Store.tw(twId); const db = [];
    if (Number(p.is_attend) === 1) {
      tw.ins = [{ step: 1, day: tw.working_day, time: tw.working_time, created_type: 'admin', timekeeping_type: 'time-attendance' }];
      tw.outs = [{ step: 1, day: tw.working_end_day, time: tw.working_end_time, created_type: 'admin', timekeeping_type: 'time-attendance' }];
      tw.approved_manual_time_by = actorId;
      db.push('Chấm công hộ: ghi log vào/ra = giờ của ca, created_type=admin, timekeeping_type=time-attendance');
      E.notify(tw.staff_id, 'Chấm công hộ', 'Lịch làm việc ngày ' + T.dmy(tw.working_day) + ' của bạn đã được chấm công hộ.');
    } else {
      E.notify(tw.staff_id, 'Xác nhận giờ làm việc', 'Lịch làm việc ngày ' + T.dmy(tw.working_day) + ' của bạn đã được xác nhận giờ làm.');
    }
    if (p.actual_time_work != null && p.actual_time_work !== '') tw.actual_time_work_confirmed = Number(p.actual_time_work);
    if (p.shift_code_approved) tw.shift_code_approved = p.shift_code_approved;
    if (p.timekeeping_coefficient != null) tw.timekeeping_coefficient = Number(p.timekeeping_coefficient);
    tw.approved_actual_time_by = actorId; tw.time_working_staff_status = 'confirmed';
    db.push('actual_time_work_confirmed=' + T.fmtH(tw.actual_time_work_confirmed) + 'h, shift_code_approved=' + tw.shift_code_approved + ', hệ số=' + tw.timekeeping_coefficient, 'status = "confirmed"');
    Store.save();
    return ok('POST time-working-staff/accept-actual-time', 'Xác nhận thành công', db);
  };

  /* ================= PORTAL ================= */
  E.portal = {};

  E.portal.addShift = (actorId, staffId, day, rows) => {
    const api = 'POST shift/time-working-staff/add-shift';
    if (!rows.length) return fail(api, 'Hãy chọn ca làm việc');
    if (rows.some((r) => !(Number(r.coef) > 0))) return fail(api, 'Hệ số công của ca thường phải lớn hơn 0');
    if (rows.some((r) => !r.branch_id)) return fail(api, 'Chi nhánh làm việc không được để trống');
    for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
      const a = Store.shift(rows[i].shift_id), b = Store.shift(rows[j].shift_id);
      if (a.start_work_time <= b.end_work_time && b.start_work_time <= a.end_work_time) return fail(api, 'Ca làm việc có thời gian trùng', a.shift_name + ' và ' + b.shift_name + ' giao nhau (so chuỗi giờ, tính cả chạm biên)');
    }
    for (const r of rows) {
      const s = Store.shift(r.shift_id);
      const endDay = s.end_work_time <= s.start_work_time ? T.addDays(day, 1) : day;
      if (E.overlap(staffId, day, T.dt(day, s.start_work_time), T.dt(endDay, s.end_work_time))) return fail(api, 'Thời gian làm việc đã trùng với lịch khác');
    }
    const db = [];
    rows.forEach((r) => {
      const rec = E.newTw(staffId, r.shift_id, day, r.branch_id, { is_ot: r.is_ot ? 1 : 0, overtime_type: r.is_ot ? r.overtime_type : null, timekeeping_coefficient: Number(r.coef), time_working_staff_status: 'approved' });
      db.push('Tạo ' + E.shiftOf(rec).shift_name + ' ngày ' + T.dmy(day) + ' → status "approved" (admin tạo)');
    });
    Store.save();
    return ok(api, 'Thêm ca thành công', db);
  };

  E.portal.paidLeave = (twId, type) => {
    const tw = Store.tw(twId);
    tw.is_deducted = type === 'paid' ? 0 : 1;
    Store.save();
    return ok('POST shift/time-working-staff/paid-or-unpaid-leave', 'Điều chỉnh thành công', ['is_deducted = ' + tw.is_deducted + ' (' + (tw.is_deducted ? 'nghỉ không lương' : 'nghỉ có lương') + ')', 'Không ghi log, không đụng quỹ phép']);
  };

  E.portal.removeShift = (twId) => {
    const tw = Store.tw(twId); tw.is_deleted = 1; Store.save();
    return ok('POST shift/time-working-staff/remove-shift', 'Xoá thành công', ['Xoá mềm is_deleted=1 (không kiểm tra đã check-in, không kiểm tra chốt lương)']);
  };

  E.portal.timeAttendance = (actorId, twId, inTime, outTime) => {
    const api = 'POST shift/time-working-staff/submit-time-attendance';
    const tw = Store.tw(twId);
    if (tw.time_working_staff_status !== 'approved') return fail(api, 'Ca làm việc chưa được phê duyệt, vui lòng phê duyệt ca làm việc trước', 'status hiện tại: ' + tw.time_working_staff_status);
    const db = [];
    const ct = tw.checking_type || 0;
    tw.ins = []; for (let i = 1; i <= ct; i++) tw.ins.push({ step: i, day: tw.working_day, time: inTime, created_type: 'admin', timekeeping_type: 'time-attendance' });
    db.push('sf_check_in_log: ghi/ghi đè giờ vào ' + inTime + ' (created_type=admin) — ghi đè cả log NV tự chấm, lưu bản cũ vào sf_check_in_change_log');
    tw.approved_manual_time_by = actorId;
    if (outTime) {
      tw.outs = []; for (let i = 1; i <= ct; i++) tw.outs.push({ step: i, day: tw.working_end_day, time: outTime, created_type: 'admin', timekeeping_type: 'time-attendance' });
      const hrs = T.hours(T.diffMin(T.dt(tw.working_end_day, outTime), T.dt(tw.working_day, inTime)));
      tw.actual_time_work = hrs; tw.actual_time_work_confirmed = hrs; tw.approved_actual_time_by = actorId; tw.time_working_staff_status = 'confirmed';
      db.push('Có giờ ra → status "confirmed", actual_time_work = actual_time_work_confirmed = ' + T.fmtH(hrs) + 'h (KHÔNG trừ nghỉ trưa)');
    }
    if (ct === 0) db.push('checking_type = 0 → vòng lặp không chạy, không set is_check_in (biên)');
    E.notify(tw.staff_id, 'Chấm công hộ', 'Lịch làm việc ngày ' + T.dmy(tw.working_day) + ' của bạn đã được chấm công hộ.');
    Store.save();
    return ok(api, 'Chấm công hộ thành công', db);
  };

  E.portal.approve = (actorId, twId) => {
    const api = 'POST shift/time-working-staff/approve-work-schedule';
    const tw = Store.tw(twId);
    if (tw.time_working_staff_status !== 'waiting') return fail(api, 'Ca làm việc không ở trạng thái chờ duyệt');
    tw.time_working_staff_status = 'approved';
    E.notify(tw.staff_id, 'Phê duyệt lịch làm việc', 'Lịch làm việc ngày ' + T.dmy(tw.working_day) + ' của bạn đã được phê duyệt.');
    Store.save();
    return ok(api, 'Duyệt lịch làm việc thành công.', ['status = "approved"', 'Ghi sf_time_working_staffs_action_log', 'Backend KHÔNG kiểm tra người duyệt có phải quản lý']);
  };

  E.canConfirm = (actorId, tw) => {
    const staff = Store.staff(tw.staff_id); const actor = Store.staff(actorId);
    return Number(actorId) === staff.staff_manager_id || (actor && actor.is_admin === 1 && Store.cfg('admin_confirm_work_schedule').is_actived === 1);
  };
  E.portal.confirm = (actorId, twId, hours) => {
    const api = 'POST shift/time-working-staff/confirm-work-schedule';
    const tw = Store.tw(twId);
    if (!E.canConfirm(actorId, tw)) return fail(api, 'Bạn không có quyền xác nhận ca làm việc này');
    if (tw.time_working_staff_status !== 'not-confirm') return fail(api, 'Ca làm việc không ở trạng thái chờ xác nhận');
    tw.actual_time_work_confirmed = Number(hours); tw.approved_actual_time_by = actorId; tw.time_working_staff_status = 'confirmed';
    E.notify(tw.staff_id, 'Xác nhận lịch làm việc', 'Lịch làm việc ngày ' + T.dmy(tw.working_day) + ' của bạn đã được xác nhận.');
    Store.save();
    return ok(api, 'Xác nhận lịch làm việc thành công.', ['actual_time_work_confirmed = ' + T.fmtH(hours) + 'h', 'status = "confirmed"']);
  };

  E.portal.updateTime = (twId, p) => {
    const api = 'POST shift/time-working-staff/update-time-working';
    const tw = Store.tw(twId); const s = E.shiftOf(tw);
    if (!p.branch_id) return fail(api, 'Hãy chọn chi nhánh');
    if (!(p.start < p.end)) return fail(api, 'Ngày bắt đầu phải lớn hơn ngày kết thúc', 'Message trong code bị ngược nghĩa (thực chất: bắt đầu phải nhỏ hơn kết thúc)');
    if (!(Number(p.coef) > 0)) return fail(api, 'Hệ số công phải lớn 0');
    let hrs = T.diffMin(p.end, p.start) / 60;
    if (s.start_lunch_break && s.end_lunch_break) {
      let lm = T.toMin(s.end_lunch_break) - T.toMin(s.start_lunch_break); if (lm < 0) lm += 1440;
      hrs -= lm / 60;
      if (hrs > 24) return fail(api, 'Thời gian làm việc đã vượt quá 24 giờ');
    }
    if (E.overlap(tw.staff_id, T.ymd(p.start), p.start, p.end, tw.id)) return fail(api, 'Thời gian làm việc đã trùng với lịch khác');
    Object.assign(tw, { branch_id: Number(p.branch_id), min_time_work: Number(p.min), timekeeping_coefficient: Number(p.coef), working_day: T.ymd(p.start), working_time: T.hm(p.start), working_end_day: T.ymd(p.end), working_end_time: T.hm(p.end), time_work: Math.round(hrs * 100) / 100 });
    Store.save();
    return ok(api, 'Chỉnh sửa thành công', ['Cập nhật chi nhánh, hệ số, giờ, time_work=' + T.fmtH(tw.time_work) + 'h', 'Không cập nhật toạ độ chấm công theo chi nhánh mới, không ghi log']);
  };

  E.portal.storeOvertime = (actorId, twId, p) => {
    const api = 'POST shift/time-working-staff/store-overtime';
    const tw = Store.tw(twId);
    if (!p.branch_id) return fail(api, 'Hãy chọn chi nhánh');
    if (!(Number(p.coef) >= 1)) return fail(api, 'Hệ số công tối thiểu 1', 'Validate JS');
    if (!(p.start < p.end)) return fail(api, 'Ngày bắt đầu phải lớn hơn ngày kết thúc', 'Message bị ngược nghĩa');
    if (p.start < E.end(tw)) return fail(api, 'Ngày bắt đầu ca làm thêm phải nhở hơn ngày kết thúc của ca cũ', 'Thực chất: giờ bắt đầu OT phải ≥ giờ kết thúc ca gốc (message sai chính tả/sai nghĩa trong code)');
    if (E.overlap(tw.staff_id, T.ymd(p.start), p.start, p.end, tw.id)) return fail(api, 'Thời gian làm việc đã trùng với lịch khác');
    const ot = S().shifts.find((s) => s.shift_code === 'OT' && s.is_system);
    const hrs = T.hours(T.diffMin(p.end, p.start));
    const rec = E.newTw(tw.staff_id, ot.shift_id, T.ymd(p.start), p.branch_id, { working_time: T.hm(p.start), working_end_day: T.ymd(p.end), working_end_time: T.hm(p.end), is_ot: 1, overtime_type: 'H', time_work: hrs, min_time_work: hrs, actual_time_work: hrs, timekeeping_coefficient: Number(p.coef), checking_type: p.is_not_check_in ? 0 : 1, time_working_staff_status: p.is_not_check_in ? 'confirmed' : 'approved' });
    const db = ['Tạo ca OT ' + T.fmtH(hrs) + 'h, overtime_type="H"'];
    if (p.is_not_check_in) {
      rec.ins.push({ step: 1, day: rec.working_day, time: rec.working_time, created_type: 'admin', timekeeping_type: 'time-attendance' });
      rec.outs.push({ step: 1, day: rec.working_end_day, time: rec.working_end_time, created_type: 'admin', timekeeping_type: 'time-attendance' });
      rec.actual_time_work_confirmed = hrs;
      db.push('"Không cần chấm công" → đã vào/ra, checking_type=0, status dự định "confirmed"');
    } else db.push('NV phải tự chấm công (checking_type=1, status dự định "approved")');
    db.push('⚠ Code thật dùng create() + $fillable → cột time_working_staff_status KHÔNG được lưu (lấy mặc định DB)');
    Store.save();
    return ok(api, 'Thêm thành công', db);
  };

  E.portal.addRecompense = (twId, rid, money) => {
    const api = 'POST shift/time-working-staff/submit-create-recompense';
    if (!rid) return fail(api, 'Hãy chọn loại');
    if (money === '' || money == null) return fail(api, 'Hãy nhập mức áp dụng');
    const tw = Store.tw(twId); tw.recompense.push({ id: Store.nextId(), recompense_id: Number(rid), money: Number(money) });
    Store.save();
    return ok(api, 'Thêm thành công', ['sf_time_working_staff_recompense: thêm dòng (không validate backend)']);
  };

  /* ---- Ca làm việc ---- */
  E.portal.saveShift = (data, id) => {
    const api = id ? 'POST shift/shift/update' : 'POST shift/shift/store';
    const errs = [];
    const name = (data.shift_name || '').trim();
    if (!name) errs.push('Hãy nhập tên ca');
    else if (name.length > 50) errs.push('Tên ca tối đa 50 kí tự');
    else if (S().shifts.some((s) => !s.is_deleted && s.shift_name === name && s.shift_id !== id)) errs.push('Tên ca đã tồn tại');
    if (!data.start_work_time) errs.push('Hãy nhập thời gian bắt đầu làm việc');
    if (!data.end_work_time) errs.push('Hãy nhập thời gian kết thúc làm việc');
    if (data.min_time_work === '' || data.min_time_work == null) errs.push('Hãy nhập số giờ làm');
    else if (Number(data.min_time_work) < 1) errs.push('Số giờ làm tối thiểu 1');
    if (data.timekeeping_coefficient === '') errs.push('Hãy nhập hệ số công');
    if (!data.branches.length) errs.push('Hãy chọn chi nhánh');
    if (data.checking_type === '' || data.checking_type == null) errs.push('Hãy nhập số lần chấm công');
    if (errs.length) return fail(api, (id ? 'Chỉnh sửa thất bại' : 'Thêm mới thất bại') + ': ' + errs.join(' · '), 'Lỗi validate (jQuery validate + FormRequest)');
    if (!T.dayKeys.some((k) => data[k])) return fail(api, 'Hãy chọn ngày làm việc');
    const c = Number(data.timekeeping_coefficient);
    if (!(c > 0 && c <= 999)) return fail(api, 'Hệ số công tối thiểu 0,1 và tối đa 999');
    if (!!data.start_lunch_break !== !!data.end_lunch_break) return fail(api, 'Thời gian nghỉ không hợp lệ', 'Phải nhập đủ cặp giờ nghỉ');
    const hw = E.shiftHourWork(data.start_work_time, data.end_work_time, data.start_lunch_break, data.end_lunch_break);
    if (Number(data.min_time_work) > hw) return fail(api, 'Số giờ tối thiểu làm việc không hợp lệ', 'min_time_work ' + data.min_time_work + ' > số giờ làm thực của ca ' + hw);
    const rec = id ? Store.shift(id) : { shift_id: Store.nextId(), is_actived: 1, is_deleted: 0, is_system: 0, shift_code: '1' };
    Object.assign(rec, data, { min_time_work: Number(data.min_time_work), timekeeping_coefficient: c, checking_type: Number(data.checking_type), time_work: hw });
    if (!id) S().shifts.push(rec);
    Store.save();
    return ok(api, id ? 'Chỉnh sửa thành công' : 'Tạo thành công', ['sf_shifts: time_work = ' + hw + 'h (tổng − nghỉ trưa)', 'sf_map_shift_branch: ' + data.branches.length + ' chi nhánh', id ? '⚠ Sửa ca KHÔNG cập nhật các ca đã sinh trong sf_time_working_staffs' : '']);
  };
  E.portal.deleteShift = (id) => {
    const api = 'POST shift/shift/destroy';
    const today = Store.today();
    const used = E.active().some((t) => t.shift_id === id && t.working_day >= today && ['waiting', 'approved', 'not-confirm'].includes(t.time_working_staff_status));
    if (used) return fail(api, 'Ca làm việc đã được sử dụng, bạn không thể xoá', 'Có ca từ hôm nay trở đi ở trạng thái waiting/approved/not-confirm');
    Store.shift(id).is_deleted = 1; Store.save();
    return ok(api, 'Xóa thành công', ['sf_shifts.is_deleted = 1']);
  };

  /* ---- Cấu hình chung ---- */
  E.portal.saveConfig = (rows) => {
    const api = 'POST shift/config-general/update';
    const g = (c) => rows.find((r) => r.code === c);
    const L = g('late_check_in'), OI = g('off_check_in'), B = g('back_soon_check_out'), OO = g('off_check_out');
    if (L.is_actived && OI.is_actived && Number(L.value) > Number(OI.value)) return fail(api, 'Số phút đi trễ phải nhỏ hơn số phút đi trễ tính nghỉ', 'Chỉ chặn khi lớn hơn; bằng nhau vẫn qua');
    if (B.is_actived && OO.is_actived && Number(B.value) > Number(OO.value)) return fail(api, 'Số phút về sớm phải nhỏ hơn số phút về sớm tính nghỉ');
    rows.forEach((r) => { const c = Store.cfg(r.code); c.value = Number(r.value) || 0; c.is_actived = r.code === 'close_time_working_end' ? 0 : (r.is_actived ? 1 : 0); });
    Store.save();
    return ok(api, 'Chỉnh sửa thành công', ['Cập nhật sf_config_general', '⚠ close_time_working_end không có checkbox → luôn lưu is_actived=0 → API dùng mặc định 25']);
  };

  E.portal.saveTkConfig = (d, id) => {
    const api = id ? 'POST shift/timekeeping-config/update' : 'POST shift/timekeeping-config/store';
    const errs = [];
    if (!d.branch_id) errs.push('Hãy chọn chi nhánh');
    if (d.timekeeping_type === 'wifi') {
      if (!d.wifi_name) errs.push('Hãy nhập tên wifi');
      if (!d.wifi_ip) errs.push('Hãy nhập địa chỉ ip');
      if (d.wifi_name && S().tkConfigs.some((c) => !c.is_deleted && c.timekeeping_type === 'wifi' && c.wifi_name === d.wifi_name && c.id !== id)) errs.push('Tên wifi đã tồn tại');
    } else {
      if (d.latitude === '' || d.latitude == null) errs.push('Hãy nhập kinh độ');
      if (d.longitude === '' || d.longitude == null) errs.push('Hãy nhập vĩ độ');
    }
    if (errs.length) return fail(api, (id ? 'Chỉnh sửa thất bại' : 'Thêm mới thất bại') + ': ' + errs.join(' · '));
    const rec = id ? S().tkConfigs.find((c) => c.id === id) : { id: Store.nextId(), is_actived: 1, is_deleted: 0 };
    Object.assign(rec, {
      branch_id: Number(d.branch_id), timekeeping_type: d.timekeeping_type, note: d.note || '',
      wifi_name: d.timekeeping_type === 'wifi' ? d.wifi_name : '', wifi_ip: d.timekeeping_type === 'wifi' ? d.wifi_ip : '',
      latitude: d.timekeeping_type === 'gps' ? Number(d.latitude) : null, longitude: d.timekeeping_type === 'gps' ? Number(d.longitude) : null,
      allowable_radius: d.timekeeping_type === 'gps' ? (d.allowable_radius === '' ? 100 : Number(d.allowable_radius)) : null
    });
    if (!id) S().tkConfigs.push(rec);
    Store.save();
    return ok(api, id ? 'Chỉnh sửa thành công' : 'Tạo thành công', [d.timekeeping_type === 'gps' && d.allowable_radius === '' ? 'allowable_radius để trống → mặc định 100m' : 'Lưu sf_timekeeping_config']);
  };

  /* ---- Attendances ---- */
  E.portal.approveLateSoonWeb = (actorId, twId, type) => {
    const tw = Store.tw(twId);
    if (type === 1) { tw.is_approve_late = 1; tw.approve_late_by = actorId; } else { tw.is_approve_soon = 1; tw.approve_soon_by = actorId; }
    Store.save();
    return ok('POST shift/attendances/approve', 'Phê duyệt thành công', [type === 1 ? 'is_approve_late = 1' : 'is_approve_soon = 1', 'Ảnh hưởng: lương (StaffSalary) không tính lần/phút trễ-sớm đã duyệt; màn tổng hợp vẫn đếm']);
  };

  /* ---- Phân ca (Work schedule) ---- */
  E.portal.storeSchedule = (d) => {
    const api = 'POST shift/work-schedule/store';
    const errs = [];
    if (!d.name) errs.push('Hãy nhập tên lịch làm việc');
    if (!d.start) errs.push('Hãy chọn ngày bắt đầu');
    if (!d.end) errs.push('Hãy chọn ngày kết thúc');
    if (errs.length) return fail(api, 'Phân ca thất bại: ' + errs.join(' · '));
    if (S().schedules.some((s) => s.name === d.name)) return fail(api, 'Tên lịch làm việc đã tồn tại');
    if (!d.rows.length) return fail(api, 'Vui lòng chọn ca làm việc');
    if (d.rows.some((r) => !r.shift_id)) return fail(api, 'Hãy chọn ca làm việc');
    if (d.rows.some((r) => !r.branch_id)) return fail(api, 'Hãy chọn vị trí làm việc');
    if (!d.staffs.length) return fail(api, 'Hãy chọn nhân viên');
    if (d.start >= d.end) return fail(api, 'Ngày bắt đầu phải nhỏ hơn ngày kết thúc');
    for (let i = 0; i < d.rows.length; i++) for (let j = i + 1; j < d.rows.length; j++) {
      const a = Store.shift(d.rows[i].shift_id), b = Store.shift(d.rows[j].shift_id);
      const sameDay = T.dayKeys.some((k) => a[k] && b[k]);
      if (sameDay && a.start_work_time <= b.end_work_time && b.start_work_time <= a.end_work_time) return fail(api, 'Ca làm việc không hợp lệ', 'Hai dòng ca trùng giờ và cùng có ít nhất 1 thứ');
    }
    const gen = [];
    for (let day = d.start; day <= d.end; day = T.addDays(day, 1)) {
      for (const r of d.rows) {
        const s = Store.shift(r.shift_id);
        if (!s[T.dayKeys[T.weekday(day)]]) continue;
        for (const st of d.staffs) gen.push({ staff: st, shift: s, day, branch: r.branch_id, is_ot: r.is_ot });
      }
    }
    for (const g of gen) {
      const endDay = g.shift.end_work_time <= g.shift.start_work_time ? T.addDays(g.day, 1) : g.day;
      if (E.overlap(g.staff, g.day, T.dt(g.day, g.shift.start_work_time), T.dt(endDay, g.shift.end_work_time))) return fail(api, 'Thời gian làm việc đã trùng với lịch khác', E.staffName(g.staff) + ' ngày ' + T.dmy(g.day));
    }
    const sid = Store.nextId();
    S().schedules.push({ id: sid, name: d.name, start: d.start, end: d.end, repeat: 'hard', note: d.note, rows: d.rows, staffs: d.staffs });
    gen.forEach((g) => E.newTw(g.staff, g.shift.shift_id, g.day, g.branch, { work_schedule_id: sid, is_ot: g.is_ot ? 1 : 0, time_working_staff_status: 'approved' }));
    Store.save();
    return ok(api, 'Phân ca thành công', ['Sinh ' + gen.length + ' bản ghi sf_time_working_staffs (mỗi NV × ngày × ca, bỏ thứ ca không áp dụng)', '⚠ Code thật không ghi hệ số công/time_work/checking_type/status → lấy mặc định DB (mô phỏng dùng giá trị của ca, status approved)']);
  };

  /* ================= PHÂN LOẠI / TÔ MÀU ================= */

  /* Màu ô lưới Lịch làm việc NV (Portal, màn theo NV) — V/week/list:98-207 */
  E.portalColor = (tw, light) => {
    const P = light
      ? { future: '#D3D3D3', paid: '#D9DCF0', unpaid: '#EBD4EF', ok: '#DBEFDC', miss: '#FDD9D7', late: '#FFEACC' }
      : { future: '#D3D3D3', paid: '#8E9FE6', unpaid: '#E5E0FF', ok: '#3FAE8F', miss: '#F08A5D', late: '#F2B84B' };
    const today = Store.today(); const now = Store.now();
    const late = Store.cfgMin('late_check_in'), soon = Store.cfgMin('back_soon_check_out'), offIn = Store.cfgMin('off_check_in'), offOut = Store.cfgMin('off_check_out');
    const ci = E.firstIn(tw), co = E.lastOut(tw);
    const ciT = E.inDT(ci), coT = E.inDT(co);
    const st = E.start(tw), en = E.end(tw);
    const steps = [];
    let c, why;
    if (tw.working_day > today) {
      c = P.future; why = 'Ngày tương lai → chưa đến ca';
      if (tw.is_deducted === 0) { c = P.paid; why = 'is_deducted = 0 → nghỉ có lương'; }
      if (tw.is_deducted === 1) { c = P.unpaid; why = 'is_deducted = 1 → nghỉ không lương'; }
      return { color: c, why, key: c === P.future ? 'future' : (tw.is_deducted ? 'unpaid' : 'paid') };
    }
    let key;
    if (tw.working_day === today) {
      c = P.ok; key = 'ok'; why = 'Mặc định đúng giờ';
      if (!ci || !co) { c = P.miss; key = 'miss'; why = 'Chưa vào hoặc chưa ra ca'; }
      if (tw.is_deducted === 0) { c = P.paid; key = 'paid'; why = 'is_deducted = 0'; }
      if (tw.is_deducted === 1) { c = P.unpaid; key = 'unpaid'; why = 'is_deducted = 1'; }
    } else {
      if (tw.is_deducted === 0) return { color: P.paid, key: 'paid', why: 'is_deducted = 0 → nghỉ có lương' };
      if (tw.is_deducted === 1) return { color: P.unpaid, key: 'unpaid', why: 'is_deducted = 1 → nghỉ không lương' };
      if (!ci && !co) { c = P.unpaid; key = 'unpaid'; why = 'Ngày đã qua, không vào cũng không ra → coi như nghỉ không lương'; }
      else if (!ci || !co) { c = P.miss; key = 'miss'; why = 'Thiếu giờ vào hoặc giờ ra'; }
      else { c = P.ok; key = 'ok'; why = 'Đúng giờ'; }
    }
    if (ciT && ciT > T.addMin(st, late)) { c = P.late; key = 'late'; why = 'Vào ' + T.hm(ciT) + ' > ' + tw.working_time + ' + late_check_in ' + late + 'p → vào trễ'; }
    if (coT && coT < T.addMin(en, -soon)) { c = P.late; key = 'late'; why = 'Ra ' + T.hm(coT) + ' < ' + tw.working_end_time + ' − back_soon_check_out ' + soon + 'p → ra sớm'; }
    if (offIn > 0 && ciT && ciT > T.addMin(st, offIn)) { c = P.unpaid; key = 'unpaid'; why = 'Vào trễ quá off_check_in ' + offIn + 'p → tính nghỉ không lương'; }
    if (offOut > 0 && coT && coT < T.addMin(en, -offOut)) { c = P.unpaid; key = 'unpaid'; why = 'Ra sớm quá off_check_out ' + offOut + 'p → tính nghỉ không lương'; }
    void steps; void now;
    return { color: c, key, why };
  };

  /* Status báo cáo (Staff API report) */
  E.reportStatus = (tw) => {
    const today = Store.today();
    const late = Store.cfgMin('late_check_in'), soon = Store.cfgMin('back_soon_check_out'), offIn = Store.cfgMin('off_check_in'), offOut = Store.cfgMin('off_check_out');
    const ciT = E.inDT(E.firstIn(tw)), coT = E.inDT(E.lastOut(tw)); const st = E.start(tw), en = E.end(tw);
    if (tw.is_deducted === 0) return 'paid_leave';
    if (tw.is_deducted === 1) return 'unpaid_leave';
    if (tw.working_day > today) return 'not_yet';
    let s = 'on_time';
    if (tw.working_day === today) { if (!ciT || !coT) s = 'missing_check'; }
    else { if (!ciT && !coT) s = 'unpaid_leave'; else if (!ciT || !coT) s = 'missing_check'; }
    if ((ciT && ciT > T.addMin(st, late)) || (coT && coT < T.addMin(en, -soon))) s = 'late_or_early';
    if ((offIn > 0 && ciT && ciT > T.addMin(st, offIn)) || (offOut > 0 && coT && coT < T.addMin(en, -offOut))) s = 'unpaid_leave';
    return s;
  };

  /* Cột "Lý do" màn Lịch sử chấm công */
  E.attendanceReason = (tw) => {
    const r = [];
    const late = Store.cfgMin('late_check_in'), offIn = Store.cfgMin('off_check_in'), soon = Store.cfgMin('back_soon_check_out'), offOut = Store.cfgMin('off_check_out');
    const n = tw.number_late_time;
    if (n > 0) {
      if (tw.is_approve_late == 1) r.push(E.staffName(tw.approve_late_by) + ' Đã duyệt đi trễ');
      else if ((n > late && offIn <= 0) || n < offIn) r.push('Nhân viên đi trễ');
      else if (n > offIn && offIn > 0) r.push('Hệ thống duyệt nghỉ không lương');
    }
    const s = tw.number_time_back_soon;
    if (s > 0) {
      if (tw.is_approve_soon == 1) r.push(E.staffName(tw.approve_soon_by) + ' Đã duyệt ra ca sớm');
      else if ((s > soon && offOut <= 0) || s < offOut) r.push('Nhân viên ra ca sớm');
      else if (s > offOut && offOut > 0) r.push('Hệ thống duyệt nghỉ không lương');
    }
    if (tw.working_day !== Store.today() && !E.lastOut(tw)) r.push('Chưa ra ca');
    if (tw.approved_manual_time_by) r.push(E.staffName(tw.approved_manual_time_by) + ' Chấm công hộ');
    return r;
  };

  /* Tổng hợp chấm công 1 NV trong khoảng ngày (màn Chấm công tổng hợp) */
  E.summary = (staffId, from, to) => {
    const list = E.active().filter((t) => t.staff_id === staffId && t.working_day >= from && t.working_day <= to);
    const today = Store.today();
    const offIn = Store.cfgMin('off_check_in'), offOut = Store.cfgMin('off_check_out');
    const r = { total: list.length, ot: 0, cong: 0, min: 0, hours: 0, otHours: 0, late: 0, soon: 0, unpaid: 0, paid: 0 };
    list.forEach((t) => {
      const ci = E.isIn(t), co = E.isOut(t);
      if (t.is_ot) { r.ot++; r.otHours += Number(t.actual_time_work_confirmed || 0); }
      if (ci && co) r.cong += Number(t.timekeeping_coefficient || 0);
      r.min += Number(t.min_time_work || 0);
      r.hours += Number(t.actual_time_work_confirmed || 0);
      if (ci && t.number_late_time > 0) r.late++;
      if (co && t.number_time_back_soon > 0) r.soon++;
      if (t.working_day < today && !ci && !co) { if (t.is_deducted === 1) r.unpaid++; if (t.is_deducted === 0) r.paid++; }
      if (offIn > 0 && t.number_late_time > offIn) r.unpaid++;
      else if (offOut > 0 && t.number_time_back_soon > offOut) r.unpaid++;
    });
    ['cong', 'min', 'hours', 'otHours'].forEach((k) => { r[k] = Math.round(r[k] * 100) / 100; });
    return r;
  };

  /* ===== Rule phía app (ultility.dart) ===== */
  E.app = {
    canChangeShift: (tw) => !E.isOut(tw) && ['approved', 'waiting'].includes(tw.time_working_staff_status) && tw.working_day >= Store.today(),
    showApp: (tw) => {
      const st = tw.time_working_staff_status || 'waiting';
      if (!['approved', 'waiting'].includes(st) || tw.working_day < Store.today()) return null;
      return { showOvertime: true, showShift: !tw.approve_next_shift_by, showLate: !tw.approve_soon_by && !tw.approve_late_by };
    },
    canProxy: (tw) => !E.isOut(tw) && tw.time_working_staff_status === 'approved' && Store.now() > E.end(tw),
    isSupportConfirm: (tw) => tw.time_working_staff_status === 'approved' && tw.working_day < Store.today()
  };

  window.Engine = E;
})();
