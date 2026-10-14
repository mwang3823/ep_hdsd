/* ===== Kho dữ liệu giả lập + tiện ích thời gian ===== */
(function () {
  const pad = (n) => String(n).padStart(2, '0');
  const T = {
    pad,
    ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    dt(day, time) { return new Date(day + 'T' + (time || '00:00').slice(0, 5) + ':00'); },
    addDays(day, n) { const d = T.dt(day); d.setDate(d.getDate() + n); return T.ymd(d); },
    addMin(date, m) { return new Date(date.getTime() + m * 60000); },
    diffMin(a, b) { return Math.round((a.getTime() - b.getTime()) / 60000); },
    dmy(day) { if (!day) return ''; const [y, m, d] = day.split('-'); return d + '/' + m + '/' + y; },
    dm(day) { const [, m, d] = day.split('-'); return d + '/' + m; },
    toMin(hm) { const [h, m] = hm.split(':').map(Number); return h * 60 + m; },
    weekday(day) { return T.dt(day).getDay(); }, // 0=CN
    dayKeys: ['is_sunday', 'is_monday', 'is_tuesday', 'is_wednesday', 'is_thursday', 'is_friday', 'is_saturday'],
    dayNames: ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'],
    monday(day) { const w = T.weekday(day); return T.addDays(day, w === 0 ? -6 : 1 - w); },
    isoWeek(day) {
      const d = T.dt(day); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
      const w1 = new Date(d.getFullYear(), 0, 4);
      return 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
    },
    hours(min) { return Math.round(min / 60 * 100) / 100; },
    fmtH(h) { if (h == null || h === '') return '--'; const v = Math.round(Number(h) * 100) / 100; return String(v).replace('.', ','); },
    distance(lat1, lng1, lat2, lng2) {
      const R = 6371000, toR = (x) => x * Math.PI / 180;
      const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
      return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }
  };

  const KEY = 'matthews-timekeeping-sim-v1';

  function seed(nowDate) {
    const today = T.ymd(nowDate);
    const mon = T.monday(today);
    const d = (i) => T.addDays(mon, i);
    const S = {
      now: nowDate.getTime(),
      seq: 1000,
      portalUser: 2,
      appUser: 3,
      branches: [
        { branch_id: 1, branch_name: 'Chi nhánh Quận 1', latitude: 10.776889, longitude: 106.700806 },
        { branch_id: 2, branch_name: 'Chi nhánh Thủ Đức', latitude: 10.850166, longitude: 106.771889 }
      ],
      departments: [{ id: 1, name: 'Kinh doanh' }, { id: 2, name: 'Vận hành' }],
      staffs: [
        { staff_id: 1, full_name: 'Quản trị hệ thống', user_name: 'admin', is_admin: 1, branch_id: 1, department_id: 2, staff_manager_id: null, check_in_limit: 1, check_approved_time_working: 1, title: 'Admin', is_actived: 1 },
        { staff_id: 2, full_name: 'Trần Minh Quân', user_name: 'quan.tm', is_admin: 0, branch_id: 1, department_id: 1, staff_manager_id: 1, check_in_limit: 1, check_approved_time_working: 1, title: 'Quản lý cửa hàng', is_actived: 1 },
        { staff_id: 3, full_name: 'Nguyễn Thị Lan', user_name: 'lan.nt', is_admin: 0, branch_id: 1, department_id: 1, staff_manager_id: 2, check_in_limit: 1, check_approved_time_working: 1, title: 'Nhân viên bán hàng', is_actived: 1 },
        { staff_id: 4, full_name: 'Lê Hoàng Phúc', user_name: 'phuc.lh', is_admin: 0, branch_id: 2, department_id: 1, staff_manager_id: 2, check_in_limit: 0, check_approved_time_working: 0, title: 'Nhân viên bán hàng', is_actived: 1 },
        { staff_id: 5, full_name: 'Phạm Thu Hà', user_name: 'ha.pt', is_admin: 0, branch_id: 2, department_id: 2, staff_manager_id: 2, check_in_limit: 1, check_approved_time_working: 1, title: 'Thu ngân', is_actived: 1 }
      ],
      shifts: [
        { shift_id: 1, shift_name: 'Ca hành chính', start_work_time: '08:00', end_work_time: '17:00', start_lunch_break: '12:00', end_lunch_break: '13:00', min_time_work: 8, time_work: 8, timekeeping_coefficient: 1, checking_type: 1, shift_code: '1', is_monday: 1, is_tuesday: 1, is_wednesday: 1, is_thursday: 1, is_friday: 1, is_saturday: 0, is_sunday: 0, branches: [1, 2], is_actived: 1, is_deleted: 0, is_system: 0, note: 'Ca văn phòng' },
        { shift_id: 2, shift_name: 'Ca sáng', start_work_time: '06:00', end_work_time: '14:00', start_lunch_break: '', end_lunch_break: '', min_time_work: 8, time_work: 8, timekeeping_coefficient: 1, checking_type: 1, shift_code: '1', is_monday: 1, is_tuesday: 1, is_wednesday: 1, is_thursday: 1, is_friday: 1, is_saturday: 1, is_sunday: 1, branches: [1, 2], is_actived: 1, is_deleted: 0, is_system: 0, note: '' },
        { shift_id: 3, shift_name: 'Ca chiều', start_work_time: '14:00', end_work_time: '22:00', start_lunch_break: '', end_lunch_break: '', min_time_work: 8, time_work: 8, timekeeping_coefficient: 1, checking_type: 1, shift_code: '1', is_monday: 1, is_tuesday: 1, is_wednesday: 1, is_thursday: 1, is_friday: 1, is_saturday: 1, is_sunday: 1, branches: [1, 2], is_actived: 1, is_deleted: 0, is_system: 0, note: '' },
        { shift_id: 4, shift_name: 'Ca đêm', start_work_time: '22:00', end_work_time: '06:00', start_lunch_break: '', end_lunch_break: '', min_time_work: 8, time_work: 8, timekeeping_coefficient: 1.5, checking_type: 1, shift_code: '1', is_monday: 1, is_tuesday: 1, is_wednesday: 1, is_thursday: 1, is_friday: 1, is_saturday: 1, is_sunday: 0, branches: [2], is_actived: 1, is_deleted: 0, is_system: 0, note: 'Ca qua đêm (giờ kết thúc < giờ bắt đầu)' },
        { shift_id: 5, shift_name: 'Ca gãy (2 lượt)', start_work_time: '09:00', end_work_time: '21:00', start_lunch_break: '13:00', end_lunch_break: '17:00', min_time_work: 8, time_work: 8, timekeeping_coefficient: 1, checking_type: 2, shift_code: '1', is_monday: 1, is_tuesday: 1, is_wednesday: 1, is_thursday: 1, is_friday: 1, is_saturday: 1, is_sunday: 1, branches: [1], is_actived: 1, is_deleted: 0, is_system: 0, note: 'Chấm 2 lượt vào/ra' },
        { shift_id: 6, shift_name: 'Tăng ca (OT)', start_work_time: '17:01', end_work_time: '21:00', start_lunch_break: '', end_lunch_break: '', min_time_work: 1, time_work: 4, timekeeping_coefficient: 1.5, checking_type: 1, shift_code: 'OT', is_monday: 1, is_tuesday: 1, is_wednesday: 1, is_thursday: 1, is_friday: 1, is_saturday: 1, is_sunday: 1, branches: [1, 2], is_actived: 1, is_deleted: 0, is_system: 1, note: 'Ca hệ thống dùng cho làm thêm giờ' }
      ],
      shiftCodes: [
        { shift_code: '1', timekeeping_coefficient: 1 }, { shift_code: '1/2', timekeeping_coefficient: 0.5 },
        { shift_code: 'P', timekeeping_coefficient: 1 }, { shift_code: 'P/2', timekeeping_coefficient: 0.5 },
        { shift_code: 'KL', timekeeping_coefficient: 0 }, { shift_code: 'OFF', timekeeping_coefficient: 0 },
        { shift_code: 'OT', timekeeping_coefficient: 1.5 }
      ],
      config: [
        { code: 'late_check_in', label: 'Tính là đi trễ khi thời gian chấm công vào sau', value: 15, unit: 'minute', is_actived: 1, suffix: 'so với thời gian làm việc bắt đầu' },
        { code: 'off_check_in', label: 'Tính là nghỉ không lương khi thời gian chấm công vào sau', value: 60, unit: 'minute', is_actived: 1, suffix: 'so với thời gian làm việc bắt đầu' },
        { code: 'back_soon_check_out', label: 'Tính là về sớm khi thời gian chấm công ra trước', value: 15, unit: 'minute', is_actived: 1, suffix: 'so với thời gian làm việc kết thúc' },
        { code: 'off_check_out', label: 'Tính là nghỉ không lương khi thời gian chấm công ra trước', value: 60, unit: 'minute', is_actived: 1, suffix: 'so với thời gian làm việc kết thúc' },
        { code: 'checkin_time_before', label: 'Được phép checkin trước', value: 30, unit: 'minute', is_actived: 1, suffix: '' },
        { code: 'close_time_working_start', label: 'Thời gian chốt công hàng tháng', value: 26, unit: 'day', is_actived: 1, suffix: '' },
        { code: 'close_time_working_end', label: '', value: 25, unit: 'day', is_actived: 0, suffix: '' },
        { code: 'remind_checkin_checkout', label: 'Nhắc nhở chấm công trước và sau', value: 15, unit: 'minute', is_actived: 0, suffix: '' },
        { code: 'checkin_with_image', label: 'Bắt buộc chấm công với ảnh', value: 1, unit: 'flag', is_actived: 1, suffix: '' },
        { code: 'admin_confirm_work_schedule', label: 'Cho phép Admin xác nhận ca làm việc', value: 1, unit: 'flag', is_actived: 0, suffix: '' }
      ],
      tkConfigs: [
        { id: 1, branch_id: 1, timekeeping_type: 'wifi', wifi_name: 'Matthews_Q1', wifi_ip: '42.114.204.250', latitude: null, longitude: null, allowable_radius: null, note: 'Wifi quầy', is_actived: 1, is_deleted: 0 },
        { id: 2, branch_id: 1, timekeeping_type: 'gps', wifi_name: '', wifi_ip: '', latitude: 10.776889, longitude: 106.700806, allowable_radius: 100, note: 'Toạ độ cửa hàng Q1', is_actived: 1, is_deleted: 0 },
        { id: 3, branch_id: 2, timekeeping_type: 'gps', wifi_name: '', wifi_ip: '', latitude: 10.850166, longitude: 106.771889, allowable_radius: 150, note: 'Toạ độ cửa hàng Thủ Đức', is_actived: 1, is_deleted: 0 }
      ],
      recompense: [
        { recompense_id: 1, recompense_name: 'Thưởng doanh số ngày', type: 'R', is_system: 0, is_actived: 1, is_deleted: 0, created_by: 1, created_at: today + ' 09:00' },
        { recompense_id: 2, recompense_name: 'Thưởng chuyên cần', type: 'R', is_system: 1, is_actived: 1, is_deleted: 0, created_by: 1, created_at: today + ' 09:00' },
        { recompense_id: 3, recompense_name: 'Phạt quên đồng phục', type: 'P', is_system: 0, is_actived: 1, is_deleted: 0, created_by: 1, created_at: today + ' 09:00' }
      ],
      holidays: [],
      leaveDays: [
        { staff_id: 3, total_leave_day: 12, total_using_leave_day: 2, total_using_remaining_day: 10, year: Number(today.slice(0, 4)) },
        { staff_id: 5, total_leave_day: 12, total_using_leave_day: 0, total_using_remaining_day: 12, year: Number(today.slice(0, 4)) }
      ],
      schedules: [],
      tws: [],
      noti: [],
      log: []
    };

    let id = 1;
    const sh = (sid) => S.shifts.find((x) => x.shift_id === sid);
    const mk = (staff_id, shift_id, day, branch_id, extra) => {
      const s = sh(shift_id);
      const over = s.end_work_time <= s.start_work_time;
      const rec = {
        id: id++, staff_id, shift_id, branch_id, work_schedule_id: 0,
        working_day: day, working_time: s.start_work_time,
        working_end_day: over ? T.addDays(day, 1) : day, working_end_time: s.end_work_time,
        time_working_staff_status: 'approved', checking_type: s.checking_type, checking_curent_step: 1,
        ins: [], outs: [], is_deducted: null, is_ot: 0, overtime_type: null,
        timekeeping_coefficient: s.timekeeping_coefficient, time_work: s.time_work, min_time_work: s.min_time_work,
        actual_time_work: null, actual_time_work_confirmed: null, shift_code_approved: null,
        is_approve_late: 0, is_approve_soon: 0, time_late_apply_work_late: 0, time_late_apply_work_late_note: '',
        time_late_apply_work_soon: 0, time_late_apply_work_soon_note: '', approve_late_by: null, approve_soon_by: null,
        old_shift_id: null, old_shift_note: '', is_approved_next_shift: 0, approve_next_shift_by: null,
        number_late_time: 0, number_time_back_soon: 0, is_close: 0, is_deleted: 0,
        approved_manual_time_by: null, approved_actual_time_by: null, recompense: [], time_off_days_id: null
      };
      return Object.assign(rec, extra || {});
    };
    const io = (day, inT, outT, type, created) => {
      const r = { ins: [], outs: [] };
      if (inT) r.ins.push({ step: 1, day, time: inT, created_type: created || 'staff', timekeeping_type: type || 'wifi' });
      if (outT) r.outs.push({ step: 1, day, time: outT, created_type: created || 'staff', timekeeping_type: type || 'wifi' });
      return r;
    };
    const push = (r) => { S.tws.push(r); return r; };
    const todayIdx = Math.round((T.dt(today) - T.dt(mon)) / 86400000);

    // Nguyễn Thị Lan (NV cần duyệt, phải kiểm wifi/GPS) - Ca hành chính T2..T6
    for (let i = 0; i < 5; i++) {
      const day = d(i);
      const r = mk(3, 1, day, 1);
      if (i < todayIdx) {
        if (i === 0) Object.assign(r, io(day, '07:55', '17:05'), { time_working_staff_status: 'confirmed', actual_time_work: 8.17, actual_time_work_confirmed: 8, shift_code_approved: '1' });
        else if (i === 1) Object.assign(r, io(day, '08:25', '17:02'), { number_late_time: 25, time_working_staff_status: 'not-confirm', actual_time_work: 7.62 });
        else if (i === 2) Object.assign(r, io(day, '08:03', null), { time_working_staff_status: 'approved' });
        else if (i === 3) Object.assign(r, { is_deducted: 0 });
        else Object.assign(r, io(day, '09:20', '17:00'), { number_late_time: 80, time_working_staff_status: 'not-confirm', actual_time_work: 6.67 });
      } else if (i === todayIdx) {
        // ca hôm nay: chưa chấm
      } else if (i === todayIdx + 1) {
        Object.assign(r, { time_working_staff_status: 'waiting', time_late_apply_work_late: 30, time_late_apply_work_late_note: 'Đưa con đi khám bệnh' });
      } else {
        Object.assign(r, { time_working_staff_status: 'waiting' });
      }
      push(r);
    }
    // Lan: ca gãy Chủ nhật (2 lượt)
    push(mk(3, 5, d(6), 1, { time_working_staff_status: 'waiting', old_shift_id: 2, old_shift_note: 'Xin đổi sang ca gãy để đi học buổi chiều' }));

    // Lê Hoàng Phúc (linh động, không cần duyệt) - Ca sáng
    for (let i = 0; i < 7; i++) {
      const day = d(i);
      const r = mk(4, i === 6 ? 3 : 2, day, 2);
      if (i < todayIdx) {
        if (i % 3 === 0) Object.assign(r, io(day, '05:58', '14:01', 'free'), { time_working_staff_status: 'confirmed', actual_time_work: 8.05, actual_time_work_confirmed: 8, shift_code_approved: '1' });
        else if (i % 3 === 1) Object.assign(r, io(day, '06:05', '13:30', 'free'), { number_time_back_soon: 30, time_working_staff_status: 'not-confirm', actual_time_work: 7.42 });
        else Object.assign(r, { });
      }
      push(r);
    }
    // Phúc: OT hôm qua
    if (todayIdx > 0) push(mk(4, 6, d(todayIdx - 1), 2, Object.assign(io(d(todayIdx - 1), '17:01', '19:30', 'free', 'admin'), { is_ot: 1, overtime_type: 'H', checking_type: 0, time_work: 2.48, min_time_work: 2.48, actual_time_work: 2.48, actual_time_work_confirmed: 2.48, time_working_staff_status: 'confirmed', working_time: '17:01', working_end_time: '19:30' })));

    // Phạm Thu Hà - Ca chiều + Ca đêm
    for (let i = 0; i < 6; i++) {
      const day = d(i);
      const r = mk(5, i === 4 ? 4 : 3, day, 2);
      if (i < todayIdx) {
        if (i === 0) Object.assign(r, io(day, '13:50', '22:00', 'gps'), { time_working_staff_status: 'confirmed', actual_time_work: 8.17, actual_time_work_confirmed: 8, shift_code_approved: '1' });
        else if (i === 1) Object.assign(r, { is_deducted: 1 });
        else if (i === 2) Object.assign(r, io(day, '14:10', '21:40', 'gps'), { time_working_staff_status: 'not-confirm', number_late_time: 10, number_time_back_soon: 20, actual_time_work: 7.5 });
        else Object.assign(r, io(day, '14:00', '22:00', 'time-attendance', 'admin'), { time_working_staff_status: 'confirmed', actual_time_work: 8, actual_time_work_confirmed: 8, approved_manual_time_by: 2, approved_actual_time_by: 2 });
      } else if (i > todayIdx) {
        r.time_working_staff_status = 'waiting';
      }
      push(r);
    }
    // Trần Minh Quân (quản lý) - ca hành chính hôm nay
    push(mk(2, 1, today, 1));

    S.holidays.push({ name: 'Ngày lễ mẫu', start: d(6), end: d(6) });
    S.seq = id + 100;
    return S;
  }

  function defaultNow() {
    const n = new Date();
    n.setHours(7, 50, 0, 0);
    return n;
  }

  const Store = {
    T,
    S: null,
    load() {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
      Store.S = saved && saved.tws ? saved : seed(defaultNow());
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(Store.S)); } catch (e) { /* bỏ qua */ } },
    reset(nowDate) { Store.S = seed(nowDate || defaultNow()); Store.save(); },
    now() { return new Date(Store.S.now); },
    today() { return T.ymd(Store.now()); },
    nextId() { return ++Store.S.seq; },
    staff(id) { return Store.S.staffs.find((s) => s.staff_id === Number(id)); },
    shift(id) { return Store.S.shifts.find((s) => s.shift_id === Number(id)); },
    branch(id) { return Store.S.branches.find((b) => b.branch_id === Number(id)); },
    tw(id) { return Store.S.tws.find((t) => t.id === Number(id)); },
    cfg(code) { return Store.S.config.find((c) => c.code === code); },
    /* giá trị cấu hình theo cách staff-api đọc: bỏ dòng tắt, hour×60, thiếu → 0 */
    cfgMin(code) {
      const c = Store.cfg(code);
      if (!c || !c.is_actived) return 0;
      const v = parseInt(c.value, 10) || 0;
      return c.unit === 'hour' ? v * 60 : v;
    },
    isHoliday(day) { return Store.S.holidays.some((h) => h.start <= day && day <= h.end); }
  };

  window.Store = Store;
})();
