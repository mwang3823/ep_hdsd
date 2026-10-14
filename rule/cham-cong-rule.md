# TÀI LIỆU RULE MODULE CHẤM CÔNG (Timekeeping) — Matthews

> Tổng hợp từ 4 nguồn (chỉ đọc code, ngày 2026-10-08):
> - **Portal** `matthews-portal-new` — `Modules/Shift` (+ StaffSalary, TimeOffDays, Admin), nhóm menu "Timekeeping" trên `/admin/menu-all`
> - **Staff API** `matthews-staff-api` — `Modules/TimeKeeping`, `Modules/TimeWorkingStaff`, `Modules/TimeOffDays`
> - **App nhân viên** `Matthews_staff` — `check_in_out_module`, `schedule_module`, `timekeeping_module` (phía nhân viên) và `pg_module` (phía quản lý)
>
> Chỗ ghi **"chưa xác định"** là phần code không đủ căn cứ (DB không truy cập được nên giá trị cấu hình thật chưa kiểm chứng).

## Cấu trúc tài liệu
- **PHẦN I — Tổng hợp rule** (đọc trước): kiến trúc, luồng, trạng thái, cấu hình, rule check-in/out, tính công, phân quyền, danh sách màn hình, lỗi/rủi ro.
- **PHẦN II — Portal chi tiết theo màn hình** (từng filter, cột, nút, popup, field, validate, backend).
- **PHẦN III — Staff API chi tiết** (từng API, params, message lỗi, rule).
- **PHẦN IV — App: chấm công cá nhân** (check-in/out, lịch của tôi, đổi ca, xin trễ/sớm, OT…).
- **PHẦN V — App: pg_module** (quản lý duyệt lịch/chấm công, báo cáo).

---

# PHẦN I — TỔNG HỢP RULE

## I.1. Kiến trúc & vai trò

| Thành phần | Vai trò trong chấm công |
|---|---|
| Portal (web admin) | Cấu hình chung, cấu hình wifi/GPS theo chi nhánh, tạo ca, phân lịch, duyệt/xác nhận, chấm công hộ, OT, nghỉ có/không lương, thưởng/phạt, báo cáo, xuất Excel, liên kết lương |
| Staff API | Phục vụ app: lấy ca hiện tại, check-in/out (kiểm wifi/GPS, khung giờ), đăng ký/đổi ca, xin trễ/sớm, OT, duyệt (quản lý), báo cáo, push noti |
| App nhân viên | Thẻ chấm công ở Home, chụp selfie + watermark, gửi vị trí/thiết bị; lịch cá nhân; màn quản lý duyệt (pg_module) |

Bảng trung tâm: **`sf_time_working_staffs`** — 1 bản ghi = 1 nhân viên × 1 ngày × 1 ca. Log vào/ra: `sf_shift_checkin_log` / `sf_shift_checkout_log` (staff-api gọi `sf_check_in_log` / `sf_check_out_log`), lịch sử sửa log: `sf_check_in_change_log` / `sf_check_out_change_log`.

## I.2. Menu nhóm "Chấm công" (`/admin/menu-all`, `admin_menu_category` id=20)

| # | Route name | URL | Màn hình | Chi tiết |
|---|---|---|---|---|
| 1 | `shift` | /shift/shift | Ca làm việc | II – A.1 |
| 2 | `shift.time-working-staff` | /shift/time-working-staff | Lịch làm việc nhân viên (tuần/tháng/theo ca) | II – B |
| 3 | `timekeeping` | /shift/timekeeping | Chấm công tổng hợp + chi tiết NV | II – C.1, C.2 |
| 4 | `timekeeping-config` | /shift/timekeeping-config | Cấu hình chấm công (tab: chung / wifi-GPS / linh động / không cần duyệt / ngày phép) | II – D.1, D.3 |
| 5 | `timekeeping.payroll-timekeeping-report` | /shift/timekeeping/payroll-timekeeping-report | Báo cáo chấm công Rate 1–4 | II – C.3 |
| 6 | `attendances.index` | /shift/attendances | Lịch sử chấm công / duyệt trễ-sớm / vào-ra hộ | II – C.5 |
| 7 | `shift.recompense` | /shift/recompense | Danh mục thưởng – phạt | II – D.4 |
| 8 | `report-studio-1` | iframe report studio | Báo cáo chấm công (report studio) | II – E.1 |

Có route nhưng không thấy trong menu: `shift.work-schedule` (Lịch làm việc mẫu – A.2), `shift.config-general` (D.1, truy cập qua tab), `config-noti` (D.2), `time-sheet` (C.4 – đang hỏng).

## I.3. Luồng hoạt động tổng thể

```
[1] Cấu hình nền (Portal)
    ├─ Cấu hình chung sf_config_general (ngưỡng trễ/sớm, check-in trước, kỳ chốt công, bắt ảnh…)
    ├─ Cấu hình wifi/GPS theo chi nhánh sf_timekeeping_config
    ├─ NV linh động (staffs.check_in_limit = 0 → bỏ kiểm wifi/GPS)
    ├─ NV không cần duyệt lịch (staffs.check_approved_time_working = 0 → tự approved)
    ├─ Ngày phép năm sf_leave_day, ngày lễ staff_holiday, danh mục thưởng/phạt sf_recompense
[2] Tạo ca sf_shifts (giờ, nghỉ trưa, thứ áp dụng, hệ số công, số lượt chấm checking_type, chi nhánh)
[3] Phân ca → sinh sf_time_working_staffs
    ├─ Portal: Lịch làm việc mẫu (work-schedule) / thêm ca trên lưới / OT
    └─ App: NV đăng ký lịch tuần, thêm ca, sao chép tuần trước; QL thêm ca hộ
        → status = waiting (hoặc approved nếu NV không cần duyệt / QL tạo)
[4] Duyệt lịch (Portal hoặc App pg_module) → approved
[5] NV chấm công (App → Staff API)
    /timekeeping/shift → (selfie nếu bật) → /time-working-staff/check-in → … → /check-out
    ├─ kiểm khung giờ (checkin_time_before, late_check_in), wifi IP / GPS bán kính
    ├─ ca nhiều lượt: lặp 1..checking_type
    └─ check-out lượt cuối → status = not-confirm, noti quản lý
[6] Điều chỉnh: đổi ca, xin đi trễ/về sớm, nghỉ phép (TimeOffDays), nghỉ có/không lương,
    chấm công hộ, vào/ra hộ, thưởng/phạt ngày, OT
[7] QL xác nhận giờ thực tế (accept-actual-time / Confirm working time) → confirmed
[8] Báo cáo: Chấm công tổng hợp, chi tiết NV, Rate 1–4, lịch sử chấm công, báo cáo app
[9] Lương (StaffSalary.calculaWorking) đọc sf_time_working_staffs
```

## I.4. Vòng đời trạng thái ca (`time_working_staff_status`)

| Trạng thái | Ý nghĩa | Chuyển sang khi | Màu app |
|---|---|---|---|
| `waiting` | Chờ duyệt lịch | Tạo lịch / đổi ca / xin trễ-sớm / OT khi NV cần duyệt | Hồng `#E91D62` "Chờ duyệt" |
| `approved` | Đã duyệt → mới hiện ở thẻ chấm công | QL duyệt; hoặc tự duyệt | Xanh `#3398dc` "Đã duyệt" |
| `not-approved` | QL từ chối | QL từ chối | Đen "Không được duyệt" |
| `not-confirm` | NV đã check-out lượt cuối, chờ xác nhận giờ | Check-out lượt cuối (app gửi) / duyệt khi `checking_type = 0` | Cam `#FF9800` "Chờ xác nhận" |
| `confirmed` | QL đã xác nhận giờ công | `accept-actual-time` | Xanh lá `#2AA27E` "Đã xác nhận" |
| `waiting-confirm` (hiển thị) | Đếm ca có `approved_manual_time_by` (chấm công hộ) | — | Tím "Chấm công hộ" |

Rule phụ:
- Sau `confirmed`, check-in/out không cập nhật ca nữa.
- Ca quên check-out sẽ đứng ở `approved` cho tới khi QL xác nhận/chấm hộ (không có cron tự đóng ca).
- Khi duyệt tất cả / duyệt trễ-sớm / duyệt đổi ca trên app: status mới = `not-confirm` nếu `checking_type = 0`, ngược lại `approved`.

Cột cờ khác trên `sf_time_working_staffs`:

| Cột | Giá trị |
|---|---|
| `is_deducted` | `NULL` ca làm bình thường · `0` nghỉ có lương · `1` nghỉ không lương |
| `shift_code_approved` | `1`, `1/2`, `P`, `P/2`, `OFF`, `KL`, `OT` |
| `checking_type` | 0..5 số lượt vào/ra (0 = không cần chấm) |
| `checking_curent_step` | 1..5 lượt hiện tại |
| `is_check_in[_1..4]`, `is_check_out[_1..4]` | 0/1 theo lượt |
| `is_ot`, `overtime_type` | Ca tăng ca; `H` theo giờ / `S` (portal) |
| `is_approve_late`, `is_approve_soon` | 1 = đã duyệt xin trễ / sớm |
| `working_place_type` | `store` / `branch` / `customer` |

## I.5. Cấu hình (field khi cấu hình)

### I.5.1. Cấu hình chung — `sf_config_general` (Portal: tab "Cấu hình chung")

| Code | Nhãn trên portal | Đơn vị | Tác dụng thực tế | Mặc định khi tắt/thiếu |
|---|---|---|---|---|
| `late_check_in` | Tính là đi trễ khi thời gian chấm công vào sau … so với giờ bắt đầu | phút/giờ | (1) Ngưỡng tô màu/báo cáo "vào trễ"; (2) Staff API luồng mới: **chặn check-in** nếu trễ quá N phút mà chưa được duyệt trễ ("Quá thời gian checkin.") | 0 = không chặn, trễ ≥1 phút |
| `off_check_in` | Tính là nghỉ không lương khi chấm công vào sau … | phút/giờ | Báo cáo: vào sau ngưỡng → nghỉ không lương | 0 = tắt |
| `back_soon_check_out` | Tính là về sớm khi chấm công ra trước … so với giờ kết thúc | phút/giờ | Ngưỡng tô màu/báo cáo "ra sớm" (không chặn check-out) | 0 |
| `off_check_out` | Tính là nghỉ không lương khi chấm công ra trước … | phút/giờ | Báo cáo: ra trước ngưỡng → nghỉ không lương | 0 = tắt |
| `checkin_time_before` | Được phép checkin trước | phút/giờ | Staff API: **chặn check-in** sớm hơn N phút ("Chưa đến thời gian được checkin cho phép."); `/timekeeping/shift` dùng để quyết định trả ca | 0 = không giới hạn |
| `close_time_working_start` | Thời gian chốt công hàng tháng: Từ ngày … tháng trước | ngày | Kỳ công | API 26 / portal 25 |
| `close_time_working_end` | Đến ngày … tháng này | ngày | Kỳ công (**lỗi: luôn lưu is_actived=0 → API dùng mặc định 25**) | 25 |
| `remind_checkin_checkout` | Nhắc nhở chấm công trước và sau | phút/giờ | Không tìm thấy nơi dùng — chưa xác định | — |
| `checkin_with_image` | Bắt buộc chấm công với ảnh | cờ | App bắt chụp selfie khi `is_actived=1` **và** `value=1`; server không bắt buộc ảnh | 0 |
| `admin_confirm_work_schedule` | Cho phép Admin xác nhận ca làm việc | cờ | Admin (`is_admin=1`) được xác nhận lịch thay quản lý | tắt |
| `round_timekeeping_coefficient` | (không hiển thị) | — | API đọc nhưng không dùng | 0 |

Validate khi lưu: chỉ số nguyên ≥ 0; nếu bật cả 2 thì `late_check_in ≤ off_check_in` ("Số phút đi trễ phải nhỏ hơn số phút đi trễ tính nghỉ") và `back_soon_check_out ≤ off_check_out` ("Số phút về sớm phải nhỏ hơn số phút về sớm tính nghỉ"). Đơn vị (`config_general_unit`) không sửa được trên UI; `hour` → ×60.

### I.5.2. Cấu hình chấm công wifi/GPS — `sf_timekeeping_config` (theo chi nhánh)
Field: chi nhánh `branch_id`, `timekeeping_type` (`wifi`/`gps`), `wifi_name`, `wifi_ip`, `latitude`, `longitude`, `allowable_radius` (mét, mặc định 100), `note`, `is_actived`. Chi tiết popup: PHẦN II – D.3.

### I.5.3. Cấu hình theo nhân viên
- **Chấm công linh động**: `staffs.check_in_limit = 0` → bỏ kiểm wifi/GPS (log ghi `timekeeping_type = free`); app không đòi GPS ở luồng có ảnh.
- **Không cần duyệt lịch**: `staffs.check_approved_time_working = 0` → tạo lịch, đổi ca, xin trễ/sớm, OT, thêm ca đều tự `approved`.
- **Quản lý trực tiếp**: `staffs.staff_manager_id` → người nhận noti, người được tự duyệt đổi ca.
- **Ngày phép còn lại**: `sf_leave_day`.

### I.5.4. Ca làm việc — `sf_shifts`
Giờ bắt đầu/kết thúc, nghỉ trưa, thứ áp dụng (`is_monday..is_sunday`), hệ số công `timekeeping_coefficient`, `time_work` = tổng giờ − nghỉ trưa, `min_time_work`, `checking_type` (số lượt chấm), `shift_code`, chi nhánh (`sf_map_shift_branch`). Các cột `start/end_timekeeping_on/out` **không** được server dùng để kiểm tra. Chi tiết popup: PHẦN II – A.1.

## I.6. Rule chấm công (kết hợp App + Staff API)

### I.6.1. Hiển thị thẻ chấm công (App Home)
- Cần quyền `TI000001`. Ca lấy từ `POST /timekeeping/shift`: ca `approved`, `is_deducted IS NULL`, ngày hôm nay nằm giữa `working_day` và `working_end_day` (ca qua đêm thuộc cả 2 ngày), lấy ca có giờ bắt đầu **sớm nhất** trong ngày.
- Không có ca (errorCode=1) → ẩn thẻ.
- Nút: chưa vào → **"Giờ vào"** (cam); đã vào → **"Giờ ra"** (đỏ); vào & ra đủ → ẩn nút. Hiện "Lần n: HH:mm – HH:mm" theo `history`.

### I.6.2. Trình tự check-in / check-out
| Bước | App (client) | Staff API (server) |
|---|---|---|
| 1 | Kiểm tra ngày ca = ngày thiết bị, sai → "Ngày làm việc không hợp lệ" | — |
| 2 | `checkin_with_image ≠ 0` → màn chụp selfie (camera trước, không chọn ảnh có sẵn, watermark tên/giờ/tọa độ/khoảng cách/địa chỉ), upload S3. Ngược lại chấm ngay tại Home | Không bắt buộc ảnh |
| 3 | Lấy GPS (luồng ảnh chỉ khi `check_in_limit ≠ 0`; luồng không ảnh luôn lấy). Không lấy được → "Không thể lấy vị trí hiện tại. Vui lòng thử lại." | — |
| 4 | Tính khoảng cách, gửi `radius` — **không chặn** theo bán kính ở client | — |
| 5 | Gửi `time-working-staff/check-in` (model ca + `checkin_log`: selfie, lat/long, imei, device_name, platform, IP, number_retry, step) | Sớm hơn `checkin_time_before` → chặn; trễ hơn `late_check_in` và chưa duyệt trễ → chặn (mốc luôn là giờ bắt đầu ca, kể cả lượt 2–5) |
| 6 | — | Vị trí: khớp `wifi_ip` của chi nhánh **hoặc** trong `allowable_radius` GPS; NV `check_in_limit = 0` bỏ qua. Không kiểm thiết bị, mock GPS, ngày lễ, đã check-in chưa |
| 7 | — | Ghi log, cập nhật cờ lượt, `number_late_time` = phút trễ thô (không trừ ân hạn), push noti QL "`:staff_name` chấm công" |
| 8 | Check-out: gửi `check_in_date_n`, `checking_type`, status `not-confirm` nếu lượt cuối, `staff_manager_id` | Chỉ kiểm vị trí (không khung giờ). Giờ công lượt = ra − vào − phần giao nghỉ trưa. Còn lượt → tăng step; lượt cuối → `not-confirm` + noti QL |

Ghi chú: còn **luồng cũ** `/timekeeping/check-in|check-out` (so IP server, có trừ ân hạn, cắt trần `time_work`, không noti) — app hiện không gọi.

### I.6.3. Đi trễ / về sớm / nghỉ không lương (báo cáo & tô màu)
- Trễ: `giờ vào > giờ bắt đầu + late_check_in`.
- Sớm: `giờ ra < giờ kết thúc − back_soon_check_out`.
- Nghỉ không lương: vào sau `bắt đầu + off_check_in` hoặc ra trước `kết thúc − off_check_out` (khi ngưỡng > 0); hoặc ca quá khứ không vào/ra; hoặc `is_deducted = 1`.
- Duyệt trễ (`is_approve_late=1`) chỉ có tác dụng: không bị chặn check-in trễ. Không trừ phút trễ trong báo cáo.

Trạng thái báo cáo (Staff API / app):

| value | Nhãn | Màu |
|---|---|---|
| `not_yet` | Chưa đến ca | #B0B5BD |
| `on_time` | Chấm công đúng giờ | #3FAE8F |
| `missing_check` | Chưa vào/ra ca | #F08A5D |
| `late_or_early` | Vào trễ/ra sớm | #F2B84B |
| `paid_leave` | Nghỉ phép có lương | #8E9FE6 |
| `unpaid_leave` | Nghỉ phép không lương | #E5E0FF |
| `overtime` | Tăng ca | #E04F5F (không có logic gán) |

### I.6.4. Tính công
- Giờ công thực tế `actual_time_work` = Σ các lượt (ra − vào − nghỉ trưa), không cắt trần, không làm tròn.
- QL xác nhận `actual_time_work_confirmed` + `shift_code_approved` + `timekeeping_coefficient` → `confirmed`.
- Portal "Chấm công tổng hợp": tổng công = Σ hệ số công các ca có đủ vào + ra.
- Loại công: `1` = 1 công, `1/2` = 0.5, `P` = phép, `P/2` = 0.5 phép + 0.5 công, `KL` = không lương, `OFF`, `OT`.
- Lương: ca không vào/ra = nghỉ (có lương nếu `is_deducted = 0`); tách ngày thường/T7/CN/lễ; OT = `actual_time_work_confirmed × timekeeping_coefficient`; thưởng (R) cộng, phạt (P) trừ.

### I.6.5. Đổi ca / Xin trễ-sớm / OT / Nghỉ
- **Đổi ca** (NV `change-shift`): tự duyệt nếu NV không cần duyệt hoặc người gửi là QL. Đổi ca khi đã check-in → reset chấm công, xóa log vào. Ca cũ là P/1/2 đã duyệt → hoàn phép.
- App: nút "Đổi ca" (QL) hiện khi chưa check-out, status `approved`/`waiting`, ngày ≥ hôm nay; "Chấm công thủ công" khi chưa check-out, `approved`, đã qua giờ kết thúc ca; "Chấm công hộ" khi `approved` và ngày đã qua.
- **Xin trễ/sớm** (`submit-time-late-soon`): ca → `waiting` (trừ khi tự duyệt) → QL duyệt set `is_approve_late/soon`.
- **OT** (`create-overtime`): ca hệ thống `OT` phải bật thứ trong tuần, không trùng giờ; `is_not_check_in = 1` → tự coi là đã chấm, `0` → NV phải vào/ra 1 lượt.
- **Nghỉ phép** (TimeOffDays): gán `time_off_days_id`, khi duyệt set `is_deducted` theo loại nghỉ (portal). Staff-api duyệt phép **không** cập nhật ca (dead code).
- **Nghỉ có/không lương** do admin đánh dấu trên lưới portal.

## I.7. Phân quyền
- Portal: backend **không kiểm quyền** (route chỉ `web,auth`); quyền chỉ ẩn/hiện nút trên Blade theo `session('routeList')`. Menu cache vĩnh viễn — đổi quyền không tự cập nhật menu.
- App: `TI000000` (Lịch sử/Quản lý chấm công), `TI000001` (thẻ chấm công, LLV cá nhân, "LLV nhân viên" quản lý), `TI000002` (Báo cáo chấm công quản lý). Không kiểm vai trò leader (đã comment).
- Staff API: không kiểm ca thuộc user đăng nhập, không kiểm quyền quản lý ở các API duyệt/chấm hộ.

## I.8. Danh sách màn hình

### Portal
| Màn hình | URL | Chi tiết |
|---|---|---|
| Ca làm việc (list + popup tạo/sửa) | /shift/shift | II – A.1 |
| Lịch làm việc mẫu / Phân ca | /shift/work-schedule | II – A.2 |
| Lịch làm việc NV — theo NV (tuần/tháng), theo ca + popup: thêm ca, thêm NV vào ca, ca của tôi, chi tiết ngày, chỉnh sửa ngày, chấm công hộ, OT, nghỉ có/không lương, thưởng-phạt, duyệt, xác nhận giờ | /shift/time-working-staff | II – B |
| Chấm công tổng hợp / chi tiết NV | /shift/timekeeping | II – C.1–C.2 |
| Báo cáo Rate 1–4 | /shift/timekeeping/payroll-timekeeping-report | II – C.3 |
| TimeSheet (hỏng) | /shift/time-sheet | II – C.4 |
| Lịch sử chấm công + vào/ra hộ + duyệt trễ/sớm | /shift/attendances | II – C.5 |
| Cấu hình chung + tab linh động / không cần duyệt / ngày phép | /shift/config-general… | II – D.1 |
| Cấu hình thông báo | /shift/config-noti | II – D.2 |
| Cấu hình wifi/GPS | /shift/timekeeping-config | II – D.3 |
| Thưởng – phạt | /shift/recompense | II – D.4 |

### App
| Màn hình | Chi tiết |
|---|---|
| Home — thẻ chấm công | IV – 1 |
| Check-in/out chụp selfie | IV – 2 |
| Lịch làm việc của tôi / Đổi ca / Đi muộn-Về sớm / Làm thêm giờ / Chi tiết / Chấm công tháng / Thêm ca / Thêm lịch tuần | IV – 3…10 |
| Lịch sử chấm công cá nhân / Quản lý chấm công | IV – 11, 12 |
| (QL) Danh sách LLV nhân viên / Lịch tuần 1 NV / Chi tiết / Xác nhận giờ / Duyệt trễ-sớm / Duyệt đổi ca / Đổi ca hộ | V – 1…7 |
| (QL) Báo cáo lịch làm việc theo tuần / theo giờ | V – 8, 9 |

## I.9. Lỗi / rủi ro phát hiện (tổng hợp)
1. Không kiểm quyền backend ở cả Portal và Staff API.
2. Hai luồng check-in/out cùng tồn tại với rule khác nhau.
3. Staff API tin dữ liệu client: IP wifi, giờ vào từng lượt, số lượt, trạng thái mới, người nhận noti.
4. Bán kính GPS không chặn ở client; mock location không kiểm.
5. Rule trễ ở lượt 2–5 vẫn so với giờ bắt đầu ca → có thể chặn các lượt sau.
6. `/timekeeping/shift` luôn trả ca sớm nhất trong ngày → nhiều ca/ngày không chuyển ca.
7. Không có cron tự đóng ca khi quên check-out.
8. `close_time_working_end` luôn bị lưu `is_actived = 0` → API dùng mặc định 25.
9. `checkin_time_before` dùng đơn vị khác nhau giữa `/timekeeping/shift` (thô) và check-in (×60 nếu giờ).
10. Duyệt phép trên staff-api không cập nhật ca; `TimeOffDaysController:488` dùng `=` thay `==` → ca bị cập nhật khi mới duyệt 1 cấp.
11. `ShiftTable::getInfo` không select `shift_code` → trừ phép theo mã ca P, 1/2 không chạy.
12. `storeOvertime` dùng `create()` → mất cột ngoài `$fillable`.
13. Ca qua đêm chưa đúng ở kiểm tra nghỉ trưa/trùng ca/trùng lịch (portal).
14. TimeSheet, `report-time-working-staff`, `report-time` thiếu view/method.
15. Màu chú thích dưới lưới portal không khớp màu thực tế; app hiển thị `waiting-confirm` thành "Chờ duyệt".
16. App: màn chi tiết tráo người/ngày duyệt giữa đơn đi muộn và về sớm; "Duyệt tất cả" mặc định `checking_type` không thống nhất (1 vs 0); có thể 2 dialog lỗi liên tiếp; nút "+" ở lịch tháng có thể crash.


---

# PHẦN II — PORTAL (matthews-portal-new) CHI TIẾT THEO MÀN HÌNH

## PHÂN TÍCH MODULE CHẤM CÔNG (Timekeeping) — matthews-portal-new

Repo: `/Users/mwang/WAO/BE/Matthew - BE/matthews-portal-new`. Code chính: `Modules/Shift` (routes `Modules/Shift/routes/web.php`, prefix `/shift`, middleware `web,auth`). JS: `public/static/backend/js/shift/<màn>/*.js`.
Nguồn: chỉ đọc code, không sửa repo. DB MySQL local (127.0.0.1:3307) không kết nối được nên giá trị dữ liệu thật (giá trị cấu hình, rate rules...) ghi "chưa xác định"; danh sách menu lấy từ file cache Laravel còn trong `storage/framework/cache` (xem Phần E.1).

### Mục lục
- Phần 0 — Tổng quan: menu nhóm Chấm công, phân quyền, luồng hoạt động tổng thể
- Phần E — Menu, phân quyền, liên kết Lương / Nghỉ phép / Ngày lễ / Hồ sơ NV, cron, API, danh sách bảng DB
- Phần A — Ca làm việc (`/shift/shift`) & Lịch làm việc (`/shift/work-schedule`)
- Phần B — Lịch làm việc nhân viên theo tuần/tháng/ca (`/shift/time-working-staff`) + toàn bộ popup (thêm ca, chấm công hộ, OT, nghỉ có/không lương, thưởng phạt, duyệt/xác nhận…)
- Phần C — Chấm công tổng hợp (`/shift/timekeeping`), chi tiết NV, Báo cáo Rate 1–4 (payroll-timekeeping-report), TimeSheet (`/shift/time-sheet`), Lịch sử chấm công & duyệt trễ/sớm (`/shift/attendances`)
- Phần D — Cấu hình chung (`/shift/config-general`), Cấu hình thông báo (`/shift/config-noti`), Cấu hình chấm công wifi/GPS (`/shift/timekeeping-config`), Thưởng phạt (`/shift/recompense`)

---

### Phần 0. Tổng quan

#### 0.1. Nhóm menu "Chấm công" trên `/admin/menu-all`
`MenuAllController@index` (`Modules/Admin/Http/Controllers/MenuAllController.php:24-33`) gọi `MenuAllRepo::getMenuByGroup()` → render `admin::menu-all.index`. Nhóm `admin_menu_category` id=20 "Timekeeping" (lấy từ cache `data_menu_{tenant}_309`, chi tiết Phần E.1) gồm 8 mục:

| # | Route name | URL | Màn hình | Phân tích ở |
|---|---|---|---|---|
| 1 | `shift` | /shift/shift | Ca làm việc | A.1 |
| 2 | `shift.time-working-staff` | /shift/time-working-staff | Lịch làm việc nhân viên (tuần/tháng/ca) | B |
| 3 | `timekeeping` | /shift/timekeeping | Chấm công tổng hợp | C.1–C.2 |
| 4 | `timekeeping-config` | /shift/timekeeping-config | Cấu hình chấm công (wifi/GPS) | D.3 |
| 5 | `timekeeping.payroll-timekeeping-report` | /shift/timekeeping/payroll-timekeeping-report | Báo cáo chấm công Rate 1–4 | C.3 |
| 6 | `attendances.index` | /shift/attendances | Lịch sử chấm công / duyệt trễ-sớm | C.5 |
| 7 | `shift.recompense` | /shift/recompense | Thưởng – phạt | D.4 |
| 8 | `report-studio-1` | (iframe report_studio) | Báo cáo chấm công (report studio) | E.1 |

Các màn có route nhưng KHÔNG thấy trong menu/routeList của user mẫu: `shift.work-schedule` (A.2), `shift.config-general` (D.1), `config-noti` (D.2), `time-sheet` (C.4 — đang hỏng, thiếu view/method). Menu này chỉ phản ánh user 309; `admin_menu` có thể còn mục khác (chưa xác định).

#### 0.2. Phân quyền (tóm tắt)
- Route chỉ có `web,auth`; middleware `Account` đã bị comment → backend KHÔNG chặn quyền ở bất kỳ action nào.
- `session('routeList')` dựng lúc login (LoginController:110-178) từ pages/actions/role_pages/role_actions/feature_code; chỉ dùng trong Blade để ẩn/hiện nút (`in_array('route.name', session('routeList'))`). Gọi thẳng URL/AJAX vẫn chạy nếu đã đăng nhập.
- Menu-all cache bằng `Cache::forever` → đổi quyền không tự cập nhật menu.

#### 0.3. Luồng hoạt động tổng thể
1. **Cấu hình nền**
   - Cấu hình chung `sf_config_general` (D.1): ngưỡng đi trễ / trễ tính nghỉ (`late_check_in`, `off_check_in`), về sớm / sớm tính nghỉ (`back_soon_check_out`, `off_check_out`), cho check-in trước bao lâu (`checkin_time_before`), kỳ chốt công (`close_time_working_start/end`, mặc định 25), bắt chụp ảnh (`checkin_with_image`), admin xác nhận lịch (`admin_confirm_work_schedule`)… Các ngưỡng được nạp vào session để tô màu lưới.
   - Danh sách NV "linh động" (`staffs.check_in_limit=0` → bỏ qua wifi/GPS), NV "không cần duyệt" (`check_approved_time_working=0` → lịch tự duyệt), ngày phép năm (`sf_leave_day`).
   - Cấu hình chấm công wifi/GPS `sf_timekeeping_config` (D.3): theo chi nhánh, `wifi_ip`, `wifi_name`, lat/long, `allowable_radius` (mặc định 100m).
   - Danh mục thưởng/phạt `sf_recompense` (D.4, type R/P). Cấu hình thông báo `sf_timekeeping_notification` (D.2, chưa thấy code gửi đọc bảng này).
2. **Tạo ca** `sf_shifts` (A.1): giờ bắt đầu/kết thúc, nghỉ trưa, thứ áp dụng, hệ số công (`timekeeping_coefficient`), `time_work` = tổng giờ − nghỉ, `min_time_work`, chi nhánh (`sf_map_shift_branch`).
3. **Phân ca** → sinh bản ghi `sf_time_working_staffs` (mỗi NV × ngày × ca):
   - Qua Lịch làm việc `sf_work_schedules` (A.2): lặp từng ngày × ca × NV, bỏ thứ không áp dụng; sửa lịch xoá cứng & sinh lại các ngày sau hôm nay; xoá lịch bị chặn nếu đã có check-in.
   - Hoặc thêm trực tiếp trên lưới Lịch làm việc NV (B.4–B.6, ca linh động B.17), bỏ qua ngày lễ khi sinh hàng loạt.
   - Trạng thái `time_working_staff_status`: waiting → approved (duyệt, B.13; NV "không cần duyệt" tự approved) → not-confirm → confirmed (xác nhận giờ thực tế, B.14).
4. **Nhân viên chấm công**: app mobile (staff-api, KHÔNG nằm trong repo này) ghi `sf_shift_checkin_log` / `sf_shift_checkout_log`, kiểm wifi IP hoặc GPS trong bán kính, ảnh selfie nếu bật. Trên web: chấm công hộ (B.12, C.5) — không kiểm wifi/GPS, ghi đè check-in.
5. **Điều chỉnh**: đơn nghỉ phép (TimeOffDays, E.3) gán `time_off_days_id`, khi duyệt set `is_deducted` theo loại nghỉ (0 có lương / 1 không lương), loại 017/018 set `is_approve_late/soon`; admin đánh dấu nghỉ có/không lương (B.10); duyệt trễ/sớm (C.5); OT (B.15, `overtime_type` S/H); thưởng/phạt theo ngày `sf_time_working_staff_recompense` (B.16).
6. **Tính công & báo cáo**: Chấm công tổng hợp (C.1: tổng công = Σ hệ số công các ca đủ check-in+check-out; trễ/sớm vượt ngưỡng `off_*` tính nghỉ không lương), chi tiết NV (C.2), báo cáo Rate 1–4 theo `sf_attendance_rate_rules` (C.3), lịch sử chấm công (C.5), xuất Excel.
7. **Lương** (StaffSalary, E.2): `calculaWorking` đọc `sf_time_working_staffs` — ca không chấm vào/ra là nghỉ (có lương nếu `is_deducted===0`), tách ngày thường/T7/CN/lễ, OT = `actual_time_work_confirmed × timekeeping_coefficient`; thưởng (R) cộng, phạt (P) trừ; bỏ trễ/sớm đã duyệt. `sf_time_working_pay_slip*` chỉ là import Excel phiếu lương (C.4).

#### 0.4. Rủi ro / lỗi nổi bật (chi tiết ở cuối từng phần)
- Không kiểm quyền backend (mọi phần).
- TimeSheet hỏng: thiếu view và nhiều method model (C.4); hai báo cáo `report-time-working-staff`, `report-time` thiếu view/method (B.18).
- `ShiftTable::getInfo` không select `shift_code` → logic trừ phép theo mã ca P, 1/2 không chạy (B.20).
- `close_time_working_end` luôn bị lưu `is_actived=0` → staff-api dùng mặc định 25 (D.1).
- `TimeOffDaysController:488` dùng `=` thay `==` → ca bị cập nhật khi mới duyệt 1 cấp (E.3).
- `storeOvertime` dùng `create()` mất các cột ngoài `$fillable` (B.15).
- Ca qua đêm xử lý chưa đúng ở kiểm tra nghỉ trưa/trùng ca/trùng lịch (A.4).
- Màu chú thích dưới lưới không khớp màu thực tế (B, C.2).

---


## Phần E — Menu, phân quyền, liên kết Lương / Nghỉ phép / Ngày lễ, cron, API, danh sách bảng DB

> Phạm vi: repo Laravel `matthews-portal-new` (chỉ đọc code). DB MySQL không truy cập được → dữ liệu menu/quyền được suy ra từ code **và từ file cache/session còn sót lại trong `storage/framework`** (CACHE_DRIVER=file, SESSION_DRIVER=file theo `.env:38-39`). Mọi đường dẫn tính từ gốc repo.
>
> Quy ước: "chưa xác định" = không tìm thấy bằng chứng trong repo.

---

### 1. Menu nhóm "Chấm công" (Timekeeping) và cơ chế phân quyền

#### 1.1. Cấu trúc bảng menu

| Bảng | Model | Cột chính | Ghi chú |
|---|---|---|---|
| `admin_menu_category` | `Modules/Admin/Models/AdminMenuCategoryTable.php:11-15` | `menu_category_id` (PK), `menu_category_name`, `menu_category_icon` | Nhóm menu |
| `admin_menu` | `Modules/Admin/Models/AdminMenuTable.php:12-17` | `admin_menu_id` (PK), `admin_menu_name_vi`, `admin_menu_name_en` (chọn theo locale: `admin_menu_name_$lang`, dòng 29), `admin_menu_category_id`, `admin_menu_route` (= tên route Laravel), `admin_menu_icon`, `admin_menu_img`, `admin_menu_position`, `is_active` (thấy trong seed `Modules/ManagerWork/Database/sop_menu_seed.sql:22-27`) | Mục menu |
| `admin_menu_function` | `Modules/Admin/Models/AdminMenuFunctionTable.php:13-18`, `Modules/User/Models/AdminMenuFunctionTable.php:23-64` | `admin_menu_function_id`, `admin_menu_category_id`, `admin_menu_id`, `position`, `type` (`horizontal` = menu ngang/thanh điều hướng, `vertical` = truy cập nhanh), `is_actived` | Đặt menu vào thanh ngang / truy cập nhanh |
| `pages` | `Modules/Admin/Models/PageTable.php` | `id`, `name`, `route`, `is_actived`, `action_group_id` | Catalogue quyền trang |
| `actions` | `Modules/Admin/Models/ActionTable.php` | `id`, `name` (= route), `is_actived`, `action_group_id` | Catalogue quyền thao tác |
| `action_group` | — | `action_group_id`, `is_actived`, `platform` (`portal`) | `PageTable.php:21` `const PORTAL = "portal"` |
| `role_group`, `role_pages`, `role_actions`, `map_role_group_staff` | `Modules/Admin/Models/MapRoleGroupStaffTable.php:81-146` | | Nhóm quyền ↔ trang/thao tác ↔ nhân viên |
| `admin_service_brand`, `admin_service_brand_feature`, `admin_service_brand_feature_child` | `Modules/User/Models/AdminServiceBrandFeatureChildTable.php:16,26-38` | `feature_code` (= chuỗi route) | Gói dịch vụ brand được bật |
| `rule_menu` | `Modules/Admin/Models/RuleMenuTable.php:18-22` | `id, name, is_actived, position` | Không liên quan trực tiếp chấm công |

Không có migration/seed nào tạo các bảng trên trong repo: `database/migrations` chỉ có 4 file users/password_resets; file `*.sql` duy nhất liên quan menu là `Modules/ManagerWork/Database/sop_menu_seed.sql` (mẫu thêm menu SOP – minh hoạ đủ 4 lớp: `pages` → `admin_menu`(+`admin_menu_function`) → `role_pages` → `admin_service_brand_feature_child`, dòng 1-12). `database/users.sql` không chứa chấm công. `change_route.patch` chỉ chứa Ward/District/Province/dropzone – không liên quan.

#### 1.2. Trang `/admin/menu-all`

- Route: `Modules/Admin/Routes/web.php:2093-2095` → `admin.menu-all` (GET), `admin.menu-all.search` (POST).
- Controller: `Modules/Admin/Http/Controllers/MenuAllController.php:24-33` gọi `MenuAllRepo::getMenuByGroup()`.
- Logic `Modules/Admin/Repositories/MenuAll/MenuAllRepo.php:24-88`:
  - Cache key `data_menu_{idTenant}_{userId}` (dòng 29), lưu `Cache::forever` (dòng 84) → **menu không tự refresh khi đổi quyền** cho tới khi xoá cache.
  - Lấy tất cả category (`AdminMenuCategoryTable::getAll`), với mỗi category lấy menu bằng `AdminMenuTable::getListMenuByMenuCatId` (`AdminMenuTable.php:20-58`): JOIN `pages` (theo `pages.route = admin_menu_route`) → `action_group` (is_actived=1) → `admin_service_brand_feature` (is_actived=1) → `admin_service_brand` (is_actived=1); sắp theo `admin_menu_position`.
  - Lọc tiếp: bỏ menu có `admin_menu_route` không nằm trong `session('routeList')` (dòng 43, 67).
- View: `Modules/Admin/Resources/views/menu-all/list.blade.php:20` → link `route($item['admin_menu_route'])`.

#### 1.3. Nhóm menu "Timekeeping" (menu_category_id = 20) — dữ liệu thật lấy từ cache

File cache `storage/framework/cache/data/91/7f/917f61085cf3f4d01d3c7c485c42e0835c482dbd` = `sha1("data_menu_2d31780a0108715b3fa530aaaaa99bda_309")` (tenant `2d31780a…`, user 309; file `3a/66/3a66…` có nội dung giống hệt). Giải tuần tự hoá (unserialize, không load class) cho category 20 **"Timekeeping"**, theo thứ tự `admin_menu_position`:

| admin_menu_id | Tên VI | Tên EN | route name | URL | Controller | Icon |
|---|---|---|---|---|---|---|
| 191 | Ca làm việc | Shift | `shift` | `/shift/shift` | `ShiftController@index` (`Modules/Shift/routes/web.php:150`) | `static/backend/images/menu/svg/general-management-shift` |
| 267 | Báo cáo chấm công | Timekeeping report | `report-studio-1` | `/report-sale/studio/studio-1` | `Modules/ReportSale/Http/Controllers/ReportStudioController.php:29-33` (iframe tới URL lưu ở `report_studio.report_studio_column_1`, view `report-studio/index1.blade.php:141`) | `.../manage-work/project` |
| 197 | Lịch làm việc theo nhân viên | Schedule | `shift.time-working-staff` | `/shift/time-working-staff` | `TimeWorkingStaffController@index` (web.php:6) | `.../svg/activity-appointment` |
| 193 | Bảng chấm công | Timekeeping | `timekeeping` | `/shift/timekeeping` | `TimekeepingController@index` (web.php:178) | `.../manage-work/type-work` |
| 195 | Cấu hình wifi chấm công | Config timekeeping wifi | `timekeeping-config` | `/shift/timekeeping-config` | `TimekeepingConfigController@index` (web.php:163) | `.../svg/config-general` |
| 274 | Bảng chấm công | Payroll Timekeeping Report | `timekeeping.payroll-timekeeping-report` | `/shift/timekeeping/payroll-timekeeping-report` | `TimekeepingController@viewPayrollTimekeepingReport` (web.php:184) | `.../manage-work/type-work` |
| 194 | Lịch sử chấm công | Timekeeping history | `attendances.index` | `/shift/attendances` | `AttendancesController@index` (web.php:111) | `.../svg/call-history` |
| 229 | Thưởng phạt | Recompense | `shift.recompense` | `/shift/recompense` | `RecompenseController@index` (web.php:219) | `.../svg/recompense` |

Lưu ý:
- Đây là menu **đã lọc theo quyền của user 309** → có thể còn mục khác trong `admin_menu` cat 20 mà user này không thấy (chưa xác định). Các trang GET khác của module Shift không thấy trong menu này: `shift.time-working-staff.index-shift`, `shift.work-schedule`, `config-noti`, `shift.config-general*`, `time-sheet`, `shift.report.time-working-staff`, `shift.report-time.time-working-staff`, `timekeeping.detail-staff` → hoặc truy cập qua tab/nút trong trang, hoặc menu chưa được khai báo (chưa xác định).
- Menu cũ `admin_menu_id=44` route `admin.shift` "Ca làm việc" nằm ở category 8 "Config general" (cache cùng file) — là trang ca cũ của module Admin, khác `shift`.
- Thanh menu ngang (session `menuHorizontal`, file session `storage/framework/sessions/J566jiQiFg2EFsdvCY5wdbFk5h2PIQ81l4yb3bbB`, user 309) cho category 20 gồm: 191 `shift`, 197 `shift.time-working-staff`, 193 `timekeeping`, 267 `report-studio-1`, 274 `timekeeping.payroll-timekeeping-report`. Có category `[18] Salary` (rỗng với user này). Menu truy cập nhanh (`menuVertical`) có `shift.time-working-staff`.
- Điều hướng nội bộ trong trang (không phải admin_menu):
  - `shift/index.blade.php:45-62`: nút "BẢNG CHẤM CÔNG" → `timekeeping`, "Lịch làm việc của nhân viên" → `shift.time-working-staff` (đều kiểm tra quyền `timekeeping`).
  - `config-general/index.blade.php:39-71`: các tab `shift.config-general` (Cấu hình chung), `timekeeping-config` (Danh sách cấu hình chấm công), `shift.config-general-free` (Cấu hình chấm công linh động), `shift.config-general-approved` (NV không cần duyệt lịch làm việc), `shift.config-general-time-keeping` (Cấu hình ngày phép còn lại).
  - Cấu hình thông báo chấm công `config-noti` là tab "Chấm công" trong trang cấu hình thông báo `config` (Notification) — `Modules/Shift/Resources/views/config-shift/edit.blade.php:51-61` (tab: `config`, `manager-work.manage-config.notification`, Chấm công, `config` tab contract).

#### 1.4. Cơ chế phân quyền

1. **Lúc đăng nhập** `Modules/User/Http/Controllers/LoginController.php:110-178`:
   - `$arrService` = mọi `admin_service_brand_feature_child.feature_code` đang active (dòng 120-127) — đây là "cổng" gói dịch vụ: route nào không có trong feature_code thì không bao giờ có quyền.
   - Nếu không phải admin (`is_admin != 1`): `routeList` = `getRolePageByStaff` (pages qua role_pages/role_group/map_role_group_staff, lọc `action_group.platform='portal'`, `pages.route IN $arrService`; `MapRoleGroupStaffTable.php:81-109`) ∪ `getRoleActionByStaff` (actions qua role_actions; dòng 118-146) ∪ `'admin.menu-all'` (dòng 132-142).
   - Nếu admin: `routeList` = mọi `pages.route` + `actions.name` thuộc `$arrService` (`PageTable.php:53-72`, `ActionTable.php:73-93`) (dòng 143-152).
   - Lưu session `menuVertical`, `menuHorizontal` (dòng 154-178). **Lỗi tiềm ẩn**: vòng lọc menu ngang `foreach ($getHorizontalMenu as $item)` duyệt theo giá trị → `unset($item['menu'][$k])` không ảnh hưởng mảng gốc (dòng 172-178), nên menu ngang không thực sự bị lọc theo quyền (vẫn có thể bị chặn khi vào trang nếu có kiểm tra).
2. **Middleware kiểm tra route**: `App\Http\Middleware\Account` (alias `account`, `app/Http/Kernel.php:77`) — toàn bộ logic so `Route::currentRouteName()` với `routeList` đã bị **comment out** (`app/Http/Middleware/Account.php:26-48`), chỉ `return $next($request)`. Ngoài ra routes Shift chỉ dùng `['web','auth']` (`Modules/Shift/routes/web.php:2`), không gắn `account`. ⇒ **Không có chặn quyền phía server cho các route `shift.*`, `timekeeping*`, `attendances.*`, `time-sheet*`, `config-noti*`, `shift.recompense*`**; ai đăng nhập đều gọi được nếu biết URL. Tương tự `timeoffdays` (`Modules/TimeOffDays/Routes/web.php:15-19`), `staff-salary` (`Modules/StaffSalary/routes/web.php:2`).
3. **Phân quyền chỉ ở tầng view** (ẩn/hiện nút) bằng `in_array('<route>', session('routeList'))`. Các mã quyền được kiểm tra trong `Modules/Shift/Resources/views` (đếm số lần xuất hiện):
   - `shift.time-working-staff.paid-or-unpaid-leave` (24), `shift.time-working-staff.show-pop-shift` (17), `shift.time-working-staff.show-pop-time-attendance` (12), `shift.time-working-staff.show-time-working-detail` (12), `manager-work.detail.show-popup-work-child` (12), `shift.time-working-staff.show-pop-overtime` (5), `shift.time-working-staff.remove-shift` (5), `shift.config-general` (5), `timekeeping-config` (5), `shift.time-working-staff.remove-staff-by-shift` (2), `shift.time-working-staff.show-pop-staff` (2), `timekeeping` (2), `shift.edit` (1, `shift/list.blade.php:48`), `shift.destroy` (1, `shift/list.blade.php:56`), `shift.recompense.show-pop-edit`, `shift.recompense.destroy`, `shift.time-working-staff.show-pop-edit`, `timekeeping.export-payroll-timekeeping-report`, `staff-salary.template.create`, `customer-lead.create` (1 mỗi cái); `shift.create` bị comment (`shift/index.blade.php:34`).
   - Ví dụ: `time-working-staff/week/list.blade.php:85,223,246,252,261,267,274,280,286`; `pop/list-my-shift.blade.php:134-218`.
   - Mã quyền "giả route" cho tab hồ sơ nhân viên: `work-schedule-staff` (tab Lịch làm việc) và `salary-staff` (tab Bảng lương) — `Modules/Admin/Resources/views/staffs/detail.blade.php:95,102`, `profile.blade.php:84,92`.
4. **Snapshot routeList thật** (session user 309, 613 mục) – các mục liên quan chấm công: `shift, shift.create, shift.edit, shift.destroy, attendances.index, timekeeping, timekeeping.detail-staff, timekeeping-config(.create/.edit/.destroy/.show), shift.time-working-staff, shift.time-working-staff.index-shift, …show-pop-shift, …show-time-working-detail, …show-pop-time-attendance, …paid-or-unpaid-leave, …show-pop-staff, …remove-staff-by-shift, …remove-shift, …show-pop-overtime, work-schedule-staff, salary-staff, shift.config-general, shift.recompense(.show-pop-create/.show-pop-edit/.destroy), report-studio-1, timekeeping.payroll-timekeeping-report, timekeeping.export-payroll-timekeeping-report`. **Không có**: `time-sheet*`, `config-noti*`, `shift.work-schedule*`, `timeoffdays*`, `holiday*`, `staff-salary*` → các trang này không được khai báo trong `pages/actions` hoặc không nằm trong gói dịch vụ/nhóm quyền của tenant này (chưa xác định nguyên nhân cụ thể).

---

### 2. Liên kết Lương (Modules/StaffSalary, Modules/Salary)

#### 2.1. Modules/StaffSalary – tính lương từ ca làm việc

Màn hình (`Modules/StaffSalary/routes/web.php`):
- `staff-salary.index` GET `/staff-salary/salary` (dòng 36) – danh sách bảng lương; `staff-salary.detail` `/salary/detail/{id}` (37); `staff-salary.detail-update` POST (41) – **tính lại**; `staff-salary.detail-close` (42) – chốt lương; `staff-salary.detail-staff` (46) – phiếu lương 1 NV (link từ tab Bảng lương hồ sơ NV, `staffs/detail.blade.php:572-576`); `holiday.index` `/staff-salary/holiday` (14) – ngày lễ.
- Cron: `GET /cron-job-get-salary` **không cần auth** (dòng 86-88) → `StaffSalaryController@cronJobGetSalary`; `staff-salary.job-salary` `/salary/job?w=..|m=..` (44) chạy thủ công theo tuần/tháng (`StaffSalaryController.php:72-98`).

Luồng `StaffSalaryController.php`:
1. `cronJobGetSalary` (103-109) → `jobGetSalaryMonth` (517-532: chỉ chạy ngày 01, kỳ = tháng trước) + `jobGetSalaryWeek` (495-512: `$weekday = 1` bị hard-code ⇒ luôn chạy, kỳ = tuần ISO của hôm qua). Bỏ qua nếu đã có `staff_salary` cùng start/end (`getDetailByDate`).
2. `jobSalary` (542-624): lấy NV theo kỳ trả lương `staff_salary_config.staff_salary_pay_period_code` (`pay_week`/`pay_month`, const dòng 36-37; `StaffSalaryConfigTable.php:132`), tạo `staff_salary`, rồi cho từng NV:
   - `calculaWorking` (633-860) → ghi `sf_timekeeping_staffs` qua `StaffSalaryRepo::addTimeKeepingStaff` (`Repositories/StaffSalary/StaffSalaryRepo.php:93-152`, model `Models/TimekeepingStaffsTable.php:19-20`).
   - `calculaSalary` (867-975), thưởng/phạt từ chấm công (575-597), phụ cấp (982-992), OT (999-1026).
   - Ghi `staff_salary_detail`: `staff_salary_received = main + allowance + bonus + overtime − minus` (608-620).
3. `salaryDetailSubmitAction` (182-255): xoá `sf_timekeeping_staffs` + `staff_salary_detail` của bảng lương rồi tính lại y như trên, **nhưng thưởng/phạt lấy từ `staff_salary_bonus_minus` (cấu hình cố định theo NV) chứ không lấy từ `sf_time_working_staff_recompense`** (dòng 211-224) — khác với cron (dòng 575). Không nhất quán.

Nguồn dữ liệu chấm công:
- `Modules/StaffSalary/Models/TimeWorkingStaffsTable.php:69-121` `getList($start,$end,$staffId)`: `sf_time_working_staffs` JOIN `sf_shifts`, `working_day` trong kỳ, `is_deleted=0` (cả ca & dòng công). Lấy `is_check_in, is_check_out, is_deducted, is_ot, number_late_time, number_time_back_soon, is_approve_late/soon, time_work, timekeeping_coefficient, actual_time_work_confirmed`. **Không lọc `is_close` hay `time_working_staff_status`.**
- `getTotalLate`/`getTotalSoon` (123-165) – tổng phút trễ/sớm chưa được duyệt (hiện không gọi trong luồng chính).
- Ngày lễ: `StaffHolidayRepo::getHolidayByDate` (`Models/StaffHolidayTable.php:123-139`): `staff_holiday_start_date <= ngày <= staff_holiday_end_date`.
- Thưởng/phạt: `Models/TimeWorkingStaffRecompenseTable.php:22-38` `getRecompenseByStaff` JOIN `sf_time_working_staffs` + `sf_recompense`, `type='R'` = thưởng, khác = phạt (`StaffSalaryController.php:589-595`).

Công thức `calculaWorking` (`StaffSalaryController.php:684-807`), với mỗi dòng ca:
- Nếu `is_check_in === 0 && is_check_out === 0` (không chấm công) → coi là **nghỉ**:
  - `is_deducted === 0` → nghỉ **có lương**: cộng `*_paid_leave` +1, giờ `time_work` (riêng thứ 7 dùng `actual_time_work_confirmed`, dòng 707), và cộng `timekeeping_coefficient` vào hệ số công tương ứng (ngày thường/T7/CN/lễ).
  - ngược lại (1 hoặc NULL) → nghỉ **không lương**: `*_unpaid_leave` +1.
  - Phân loại ngày: lễ (có bản ghi `staff_holiday`) > thứ 7 (`dayOfWeek=6`) > CN (0) > ngày thường.
- Ngược lại (có ít nhất check-in hoặc check-out):
  - Trễ: `number_late_time > 0` và chưa duyệt (`is_approve_late` null/0) → `total_day_late`+1, cộng phút (754-757). Sớm tương tự với `number_time_back_soon`/`is_approve_soon` (758-761).
  - `is_ot === 1` → OT: số ca OT +1, giờ OT += `actual_time_work_confirmed × timekeeping_coefficient`, cộng hệ số OT.
  - Không OT → ngày công +1, giờ += `actual_time_work_confirmed`, hệ số công += `timekeeping_coefficient`.
- `total_shift_off`, `total_day_not_check_in/out` luôn 0 (khởi tạo không cập nhật; 829, 849-850).

Công thức `calculaSalary` (867-975) theo `staff_salary_type_code`, đơn giá lấy từ `staff_salary_attribute` của NV (`salary_monthly`, `salary_weekday`, `salary_sarturday`, `salary_sunday`, `salary_holiday`; type `money` hoặc `%` so với `salary_weekday`):
- `monthly`: `main = salary_monthly`; nếu có ngày nghỉ không lương ngày thường (`total_day_unpaid_leave>0`): `lương 1 ngày = salary_monthly / (tổng ngày công + tổng nghỉ có lương + tổng nghỉ không lương)`; `main −= lương 1 ngày × tổng nghỉ không lương` (884-897).
- `hourly`: `main = salary_weekday × (giờ công thường + giờ nghỉ có lương)` + T7/CN/lễ (theo `money` = đơn giá×giờ, hoặc `%` = salary_weekday×%/100×giờ) (898-930).
- còn lại (theo ca): `main = salary_weekday × total_timekeeping_coefficient` + T7/CN/lễ × hệ số công tương ứng (931-972).
- OT `calculaSalaryOvertime` (999-1026): `staff_salary_overtime` (đơn giá/giờ ngày thường) × `total_working_ot_time` + T7/CN/lễ (money hoặc %).

Hồ sơ NV: tab Bảng lương lấy `StaffSalaryDetailRepo::getListSalaryByStaff` (`Modules/Admin/Http/Controllers/StaffsController.php:506,544`).

#### 2.2. Bảng lương import Excel (Shift – `sf_time_working_pay_slip*`)

- Route `time-sheet.import-pay-slip` POST `/shift/time-sheet/import-pay-slip` (`Modules/Shift/routes/web.php:239`) → `TimeSheetController@importPaySlipExcelAction` (`Modules/Shift/Http/Controllers/TimeSheetController.php:1594-1693`):
  - Tạo 1 `sf_time_working_pay_slip` "Bảng lương tháng mm/YYYY" cho **tháng hiện tại** (1605-1609).
  - Dòng 1 Excel = header → mỗi cột ghi vào `sf_time_working_pay_slip_template` (`object_key` = str_slug(header), `object_value`, `object_position`) (1621-1638); nhận diện cột `ho-ten`, `ma-nhan-vien`.
  - Các dòng sau → `sf_time_working_pay_slip_detail` với `column_{i}` = giá trị ô, `staff_code_custom`, `staff_full_name`, `staff_id` tìm theo **tên** (`StaffTable::getDetailByName`) (1640-1663).
  - Không tính toán gì, không đọc `sf_time_working_staffs`. Nơi hiển thị phiếu lương này (ví dụ app nhân viên, cờ `is_send_noti`) — chưa xác định trong repo.

#### 2.3. Modules/Salary

- Là module **lương hoa hồng** (routes `Modules/Salary/routes/web.php:2-26`: `salary`, `salary.salary_commission_config`…). Không truy vấn `sf_time_working_staffs`/timekeeping (grep không có).
- Có model `PaySlipConfigTable` → bảng `sf_pay_slip_config` (`Modules/Salary/Models/PaySlipConfigTable.php:16-29`: `column_title, column_key_sys, column_name_sys, column_key_custom, column_name_custom`) — không thấy nơi sử dụng (chưa xác định; có thể dùng để map cột phiếu lương import).

#### 2.4. Báo cáo chấm công phục vụ lương trong Shift

- `timekeeping.payroll-timekeeping-report` (`TimekeepingController.php:~1200-1300`): dùng bảng `sf_attendance_rate_rules` (`day_of_week` 1=T2..7=CN, `start_time`, `end_time`, `rate` 1..4, `is_active`) để chia `actual_time_work_confirmed` của mỗi ca thành 4 mức rate theo phần giao giữa [giờ vào, giờ vào + giờ công xác nhận] và khung giờ rule (`calculateShiftRates`, dòng 1308-~1370); ngày không có rule → toàn bộ vào rate 1. Bảng chú giải rate ở `timekeeping/report.blade.php:372-393`. Chi tiết thuộc phần khác.

---

### 3. Nghỉ phép (Modules/TimeOffDays) → `sf_time_working_staffs`

Routes `Modules/TimeOffDays/Routes/web.php:15-69` (prefix `/timeoffdays`, middleware `web,auth`): tạo/sửa/xoá đơn, `timeoffdays.approve`, `timeoffdays.un-approve`, `timeoffdays.sfshifts.list` (chọn ca để xin nghỉ), `timeofftype.*` (cấu hình loại phép), `timeoffdays.generate` (khởi tạo số ngày phép).

Bảng liên quan: `time_off_days` (đơn), `time_off_days_shift` (ca xin nghỉ: `time_off_days_id, time_working_staff_id, is_approve, day_coefficient, date_type_select, created_days/months/years, time_off_type_id, staff_id, is_deleted` — `Modules/TimeOffDays/Http/Controllers/TimeOffDaysController.php:219-235`, `Models/TimeOffDaysShiftsTable.php:83-101`), `time_off_type` (`time_off_type_code` '001'..'020', `is_deducted`, `month_reset`, `total_number`, `direct_management_approve`, `staff_id_approve_level2/3` JSON, `time_off_type_parent_id`, `is_status`), `time_off_days_total` (số ngày phép còn lại theo NV × loại; `-1` = không giới hạn), `time_off_days_log`, `time_off_days_files`.

Model `sf_time_working_staffs` của module này: `Modules/TimeOffDays/Models/TimeWorkingStaffsTable.php:14-56` (fillable thêm `time_off_days_id`, `date_type_off`, `approve_late_time`, `approve_soon_time` so với Shift).

Luồng:
1. **Tạo đơn** `store` (`TimeOffDaysController.php:139-301`):
   - Hệ số ngày: `select_type_date` = `morning`/`afternoon` → `day_coefficient = 0.5`, ngược lại 1 (dòng 152-157).
   - Kiểm tra ca đã có đơn cùng loại (`checkExist`), kiểm tra hạn mức (`time_off_days_total.time_off_days_number` ≠ -1, so với tổng `day_coefficient` đã dùng trong tháng/năm tuỳ `month_reset`) (171-191).
   - Loại `017` (xin đi trễ) / `018` (xin về sớm) bắt buộc `time_off_days_time` (195-199).
   - **Gắn đơn vào ca**: `sf_time_working_staffs.time_off_days_id = id đơn` cho từng ca chọn (dòng 217). Thêm dòng `time_off_days_shift` `is_approve = null` (219-235).
   - Trừ `time_off_days_total` theo **số ca** (không theo hệ số) (249-254). Gửi noti người duyệt (`time_off_days_waiting`) (256-293).
2. **Duyệt** `approve` (361-503): duyệt 3 cấp — cấp 1 = quản lý trực tiếp (`direct_management_approve=1`, `staff_manager_id`), cấp 2/3 = danh sách staff JSON. Đủ cấp → `is_approve = 1` (397-404). Sau đó gọi `updateTimeWorkingStaff` (dòng 488-489) — **lưu ý lỗi: `if($dataUpdate['is_approve'] = 1)` là phép gán ⇒ luôn chạy, kể cả khi mới duyệt 1 cấp.**
   - `updateTimeWorkingStaff` (1060-1090), với từng ca trong `time_off_days_shift` (JOIN `time_off_type`, `time_off_days`; `TimeOffDaysShiftsTable.php:66-81`):
     - set `time_off_days_shift.is_approve = 1`;
     - `017` Xin đi trễ → `sf_time_working_staffs`: `is_approve_late = 1`, `approve_late_time = time_off_days_time`, `approve_late_by` (1068-1072);
     - `018` Xin về sớm → `is_approve_soon = 1`, `approve_soon_time`, `approve_soon_by` (1074-1078);
     - loại khác → `is_deducted = time_off_type.is_deducted`, `date_type_off = date_type_select` (one-day/morning/afternoon) (1080-1084).
   - **Không** cập nhật `is_off`, `is_paid_leave` (cột `is_paid_leave` không tồn tại trong code). Tính chất "có lương / không lương" do `time_off_type.is_deducted` quyết định (0 = có lương, 1 = trừ lương/không lương — nhất quán với `TimeWorkingStaffRepo::paidLeave`, `Modules/Shift/Repositories/TimeWorkingStaff/TimeWorkingStaffRepo.php:998-1002`: `paid` → `is_deducted=0`, `unpaid` → `is_deducted=1`). Danh sách loại cụ thể (tên, is_deducted từng code) nằm trong DB → chưa xác định; chỉ biết từ comment: `017` = xin đi trễ, `018` = xin về sớm; view cấu hình có 19 loại `popup-edit-001..020` (thiếu 005) (`Resources/views/timeofftype/`).
3. **Từ chối** `unApprove` (512-605): `is_approve = 0`; với từng ca: `017` → `is_approve_late=0`; `018` → `is_approve_soon=0`; loại khác → **`is_deducted = 1`** (nghỉ không lương) (565-585); cộng lại 1 ngày phép (`updateTotalDaysOff … 'bonus'`, 588). Không gỡ `time_off_days_id` khỏi ca.
4. **Sửa đơn** `update` (~640-720): gỡ `time_off_days_id` cũ (`removeTimeOffDay` → set 0, `Models/TimeWorkingStaffsTable.php:98-101`, gọi ở dòng 661) rồi gắn lại (dòng ~719).
5. **Xoá đơn** `remove` (331-354): `is_deleted=1`, xoá files/shift, cộng lại 1 ngày phép; **không** reset `time_off_days_id` trên `sf_time_working_staffs`.
6. **Hệ quả lên lương**: ca có `is_check_in=0 && is_check_out=0` được tính nghỉ có lương nếu `is_deducted===0`, ngược lại không lương (mục 2.1). Đơn trễ/sớm được duyệt làm ca không bị tính `total_day_late/back_soon` (`StaffSalaryController.php:754-761`).

Liên quan trong Shift:
- `sf_leave_day` (phép năm theo NV, `shift_code='P'`): khởi tạo bởi `ConfigGeneralController@generateTimeKeeping` (`Modules/Shift/Http/Controllers/ConfigGeneralController.php:218-239`: tổng = 12 hoặc số tháng từ `offical_working_day`); khi xoá ca có `shift_code_approved` = `P` (1 ngày) hoặc `1/2` (0.5 ngày) thì trả lại phép (`TimeWorkingStaffRepo.php:1060-1075`).
- Model Shift `TimeOffDaysShiftsTable`, `TimeOffDaysTotalTable`, `TimeOffTypeTable` được dùng trong `TimekeepingRepo` và `TimeSheetRepo` để hiển thị bảng công.
- Nút "Nghỉ có lương/không lương" thủ công trên lịch làm việc: route `shift.time-working-staff.paid-or-unpaid-leave` (`web.php:30`) → `paidLeave` (`TimeWorkingStaffRepo.php:990-1018`). "Có đi làm" `shift.time-working-staff.is-work` → `is_off=0, is_deducted=0` (`TimeWorkingStaffRepo.php:1084-1091`).

---

### 4. Modules/Admin – hồ sơ/chi tiết nhân viên

- Routes `Modules/Admin/Routes/web.php:506-509`: `admin.staff.profile` `/…/profile/{id}`, `admin.staff.show` `/…/detail/{id}`, `admin.timekeeping.list_detail` POST `/…/time-keeping-list`.
- Tab (`staffs/detail.blade.php:88-109`, `profile.blade.php:80-100`):
  1. "Thông tin nhân viên".
  2. **"Lịch làm việc"** (quyền `work-schedule-staff`): bộ lọc tháng 1-12 (năm hiện tại) + `@include('shift::timekeeping.list_detail')` (`detail.blade.php:524-552`, `profile.blade.php:399-425`); JS `static/backend/js/shift/time-working-staff/list.js` + PioTable gọi `admin.timekeeping.list_detail` (`detail.blade.php:622-632`). Có `#my-modal-my-shift` để mở popup ca của tôi.
  3. **"Bảng lương"** (quyền `salary-staff`): danh sách `staff_salary_detail` của NV, link `staff-salary.detail-staff`, trạng thái Đã/Chưa chốt (`detail.blade.php:553-600`).
- Controller `Modules/Admin/Http/Controllers/StaffsController.php`:
  - `profileAction` (488-518) & `show` (536-547): `getListTimekeepingStaff($id, date('m'))` + `staffSalaryDetail->getListSalaryByStaff`.
  - `listTimekeepingAction` (569-578) → `getListTimekeepingStaff` (580-~700): đọc cấu hình `sf_config_general` vào session (late_check_in, off_check_in, back_soon_check_out, off_check_out), dựng lịch tháng theo tuần T2..CN; mỗi ngày gọi `TimekeepingRepo::detailStaffByWorkingDay` (`Modules/Shift/Repositories/Timekeeping/TimekeepingRepo.php:302-308` → `TimeWorkingStaffTable::getTimeWorkingStaffByWorkingDay`).
  - `checkShift` (~703-800): tô màu ca: tương lai `#D3D3D3`; nghỉ có lương (`is_deducted===0`) `#8E9FE6`; nghỉ không lương (`===1`) `#E5E0FF`; hôm nay đúng giờ `#3FAE8F`; thiếu vào/ra ca `#F08A5D`; trễ (`check_in > working_time + late_check_in`) hoặc sớm (`check_out < working_end_time − back_soon_check_out`) `#F2B84B`; vượt ngưỡng `off_check_in/off_check_out` → `#E5E0FF` (nghỉ không lương).
- `staffs` có cột chấm công: `check_in_limit`, `check_approved_time_working` (fillable `Modules/Shift/Models/StaffTable.php:24`), `offical_working_day` (dùng tính phép), `staff_manager_id` (duyệt phép cấp 1).

---

### 5. Ngày lễ (`staff_holiday`)

- Quản lý: `Modules/StaffSalary` — `HolidayController` (CRUD, `routes/web.php:13-21`, URL `/staff-salary/holiday`), model `Modules/StaffSalary/Models/StaffHolidayTable.php:19-31` (cột `staff_holiday_id, staff_holiday_title, staff_holiday_start_date, staff_holiday_end_date, staff_holiday_number, created_by, updated_by, created_at, updated_at`).
- Shift dùng model read-only `Modules/Shift/Models/StaffHolidayTable.php:16-56` (`getHoliday`, `checkDayInHoliday($day)`: start ≤ day ≤ end).
- Ảnh hưởng:
  1. **Hiển thị**: đánh dấu `is_holiday` cho từng ngày trên lịch tuần/tháng (`TimeWorkingStaffRepo.php:165-209`, `312-355`, `3201-3240`), tiêu đề cột màu đỏ (`week/list.blade.php:10`, `shift/list.blade.php:10`…), popup ca của tôi (`1117-1185`).
  2. **Cảnh báo khi thêm ca thủ công vào ngày lễ**: JS confirm "Ca làm việc rơi vào ngày lễ bạn có muốn thêm ca làm việc cho nhân viên?" (`public/static/backend/js/shift/time-working-staff/list.js:34-38`).
  3. **Bỏ qua ngày lễ khi sinh ca hàng loạt**: `addStaff` (`TimeWorkingStaffRepo.php:1552-1553`), `addShiftByStaff` (2544-2548), `addShiftFlexibleByStaff` (2952-2954) chỉ insert khi `count($validateHoliday) == 0`.
  4. **Tính lương**: ngày lễ được tách nhóm riêng (`total_day_holiday`, `total_time_holiday`, OT lễ, nghỉ lễ có/không lương) và nhân đơn giá `salary_holiday`/`staff_salary_overtime_holiday` (`StaffSalaryController.php:687-705, 763-774, 913-918, 966-971, 1018-1022`).
  5. **Bảng công/Time sheet**: `TimeSheetRepo::calculateWorkingDays` tính ngày công chuẩn = số ngày không phải T7/CN, tham số `$holidays` luôn truyền `[]` (`Modules/Shift/Repositories/TimeSheet/TimeSheetRepo.php:118, 303-319`) ⇒ ngày lễ **không** trừ khỏi công chuẩn.

---

### 6. Console / cron

- `Modules/Shift/Console`, `Modules/StaffSalary/Console`, `Modules/TimeOffDays/Console`, `Modules/Salary/Console`: chỉ có `.gitkeep` — **không có command chấm công nào**.
- `app/Console/Kernel.php` schedule: `epoint:run-url` mỗi 5 phút, `epoint:run-url 1` ngày 1 hàng tháng, `epoint:run-daily-url` 08:00, `telescope:prune` hàng giờ. Các command này chỉ gọi HTTP tới `DOMAIN_BRAND` các URL sms/email/sync/rank/notification nợ (`app/Console/Commands/RunUrlCmd.php:57-86`, `RunDailyUrlCmd.php:48-50`) — không có URL chấm công.
- `epoint:run-url-every-day` (`app/Console/Commands/RunUrlEveryDay.php:24,53`) gọi `GET {DOMAIN_BRAND}/cron-job-get-salary` → tính lương tuần/tháng (mục 2.1). **Không được đăng ký trong `schedule()`**; được load qua `$this->load(__DIR__.'/Commands')` → phải có cron ngoài/ thủ công (chưa xác định).
- Không tìm thấy trong repo: job tự sinh ca theo lịch làm việc, tự check-out, tự chốt công (`is_close`), gửi noti nhắc chấm công. Cấu hình liên quan tồn tại nhưng nơi tiêu thụ nằm ngoài repo (chưa xác định): `sf_config_general` codes `remind_checkin_checkout` (Nhắc nhở chấm công trước và sau), `checkin_with_image` (Bắt buộc chấm công với ảnh), `close_time_working_start/end` (Thời gian chốt công hàng tháng: từ ngày X tháng trước đến ngày Y tháng này), `admin_confirm_work_schedule`, `checkin_time_before` (`Modules/Shift/Resources/views/config-general/index.blade.php:76-280`); bảng `sf_timekeeping_notification` (`is_email`, `is_noti`, `type`, `type_send`, `time_send`, title/content) chỉ được CRUD qua `config-noti` (`Modules/Shift/Repositories/ConfigNoti/ConfigNotiRepository.php:18-82`).
- Khởi tạo dữ liệu thủ công qua URL (không phải cron): `timeoffdays.generate` (`TimeOffDaysController.php:70-72, 1029-1058` – tạo `time_off_days_total` cho mọi NV × loại phép), `shift.config-general.generate-time-keeping` (tạo `sf_leave_day`).

---

### 7. API mobile chấm công

- **Không có trong repo này.** `Modules/Api/routes/api.php` chỉ có `service-brand/store|delete`; `routes/api.php` không có check-in. Grep `check-in|checkin|timekeeping|sf_time_working` trong `Modules/Api`, `app/Http`, `routes` không ra endpoint chấm công. Portal gọi một backend khác qua `STAFF_API_URL` (`config/constant.php:53`; ví dụ `Modules/Admin/Http/Api/StaffApi.php` – chat/refresh-token/kho), không có endpoint chấm công.
- Dấu vết dữ liệu do app mobile ghi (suy luận từ cột được đọc): `sf_check_in_log/sf_check_out_log` có `timekeeping_type`, `latitude`, `longitude`, `image_selfie`, `working_place_type`, `working_place_id` (`Modules/Shift/Models/ShiftCheckInLogTable.php:50-75`); `sf_time_working_staffs` có `wifi_name`, `bssid` (`TimeWorkingStaffsTable.php:362`). Cấu hình hợp lệ: `sf_timekeeping_config` theo chi nhánh, `timekeeping_type` = `wifi` (`wifi_name`, `wifi_ip`) hoặc `gps` (`latitude`, `longitude`, `allowable_radius` mặc định 100 m — `Modules/Shift/Repositories/TimekeepingConfig/TimekeepingConfigRepo.php:18, 171-182`). Logic kiểm tra wifi/GPS/bán kính/ảnh khi check-in **không có trong repo** (chưa xác định).
- Chấm công trên web portal (tham khảo):
  - `attendances.checkin` (`Modules/Shift/Http/Controllers/AttendancesController.php:145-195`): ghi `sf_check_in_log` thời điểm hiện tại, `number_late_time = phút(now − working_time)` nếu trễ (không trừ dung sai `late_check_in`), `is_check_in=1`. Không kiểm tra wifi/GPS.
  - `attendances.checkout` (198-243): `check_out_time` lấy từ request, `number_time_back_soon = phút(working_end_time − checkout_time)` nếu về sớm, `is_check_out=1`.
  - `attendances.approve` (261-299): duyệt trễ (`is_approve_late=1`) / sớm (`is_approve_soon=1`).
  - Chấm công hộ `shift.time-working-staff.submit-time-attendance` → `TimeWorkingStaffRepo::submitTimeAttendance` (1834-…): chỉ khi `time_working_staff_status='approved'`; ghi log với `created_type='admin'`, `reason='Chấm công hộ'`, có log thay đổi `sf_check_in_change_log/sf_check_out_change_log`. Lưu ý: các key `working_place_type`, `timekeeping_type`, `checking_curent_step` truyền vào `ShiftCheckInLogTable::add` (dùng `create()`, dòng 45-48) không nằm trong `$fillable` (dòng 22) ⇒ bị bỏ qua khi lưu. Các hàm `_validateCheckInTime/_validateCheckOutTime` (2080-2165: chặn vào ca sớm ≥3h, vào sau giờ tan ca, ra trước giờ vào, ra trễ ≥3h) **không được gọi ở đâu** (dead code).
  - Quy tắc trễ/sớm theo cấu hình (`sf_config_general`): `late_check_in` (tính đi trễ khi vào sau X phút/giờ so với giờ bắt đầu), `off_check_in` (tính nghỉ không lương khi vào sau X), `back_soon_check_out`, `off_check_out` (so với giờ kết thúc); đơn vị `minute`/`hour` (×60) — `AttendancesController.php:66-111`.

---

### 8. Danh sách bảng DB của module Shift (33 model trong `Modules/Shift/Models`)

Không có migration/SQL nào định nghĩa bảng `sf_*` trong repo (đã kiểm tra `database/migrations`, `Modules/*/Database`, mọi `*.sql`). Thông tin dưới đây suy từ `$table`, `$fillable`, `select/insert` trong code. "PK" mặc định `id` nếu model không khai báo.

| # | Model (file) | Bảng | PK | Cột ($fillable / thấy trong query) | Const / enum / ghi chú |
|---|---|---|---|---|---|
| 1 | `AttendanceRateRulesTable.php:9` | `sf_attendance_rate_rules` | (id, mặc định) | Thấy dùng: `day_of_week` (1=T2..7=CN), `start_time`, `end_time`, `rate` (1-4), `is_active` (`TimekeepingController.php:1209-1217`, `report.blade.php:375-385`) | `IS_ACTIVE=1` (dòng 10). Quy tắc hệ số giờ cho báo cáo payroll |
| 2 | `BranchTable.php:16-17` | `branches` | `branch_id` | — | `IS_ACTIVE=1`, `NOT_DELETED=0` (19-20) |
| 3 | `CheckInChangeLogTable.php:16-18` | `sf_check_in_change_log` | `check_in_change_log_id` | `check_in_log_id, time_working_staff_id, staff_id, branch_id, shift_id, check_in_day_old, check_in_time_old, status_old, reason_old, created_type_old, created_by_old, check_in_day_new, check_in_time_new, status_new, reason_new, created_type_new, created_by_new, created_at, updated_at` | Log sửa giờ vào ca (chấm công hộ/chỉnh sửa) |
| 4 | `CheckInLogChangeTable.php:12-15` | — | — | Class rỗng, không extends Model | Không dùng |
| 5 | `CheckOutChangeLogTable.php:16-18` | `sf_check_out_change_log` | `check_out_change_log_id` | Tương tự #3 với `check_out_*` | Log sửa giờ ra ca |
| 6 | `ConfigGeneralTable.php:16-29` | `sf_config_general` | `config_general_id` | `config_general_code, config_general_value, config_general_unit (minute/hour), is_actived, updated_by, created_at, updated_at` | `IS_ACTIVE=1`. Codes: `late_check_in, off_check_in, back_soon_check_out, off_check_out, checkin_time_before, close_time_working_start, close_time_working_end, remind_checkin_checkout, checkin_with_image, admin_confirm_work_schedule` (`config-general/index.blade.php`) |
| 7 | `DepartmentTable.php:16-20` | `departments` | `department_id` | — | `IS_ACTIVE=1`, `NOT_DELETED=0` |
| 8 | `EstimateBranchTimeTable.php:18-35` | `estimate_branch_time` | `estimate_branch_time_id` | `branch_id, estimate_time, estimate_money, months, days, years, weeks, created_by, updated_by, created_at, updated_at` | Ngân sách giờ/tiền theo chi nhánh; không thấy dùng trong Shift Http/Repositories (dùng ở StaffSalary ReportBudgetBranch – chưa xác định chi tiết) |
| 9 | `LeaveDayTable.php:17-30` | `sf_leave_day` | `sf_leave_day_id` | `shift_id, shift_code ('P'), staff_id, total_leave_day, total_using_leave_day, staff_leave_day_year, total_using_remaining_day` | `IS_ACTIVE=1`. Quỹ phép năm |
| 10 | `ManagerWorkTable.php:22-65` | `manage_work` | `manage_work_id` | (công việc – module ManagerWork) | `STARTED=3, FINISH=6, CANCEL=7`. Dùng để hiện công việc trong ca |
| 11 | `MapShiftBranchTable.php:16-27` | `sf_map_shift_branch` | `map_shift_branch_id` | `branch_id, shift_id, created_at, updated_at` | `IS_ACTIVED=1`, `NOT_DELETED=0`. Ca áp dụng cho chi nhánh |
| 12 | `MapWorkScheduleShiftTable.php:16-17` | `sf_map_work_schedule_shifts` | `map_work_schedule_shift_id` | (không fillable; insert) `work_schedule_id, branch_id, shift_id, is_monday..is_sunday, is_ot, created_at, updated_at` (`WorkScheduleRepo.php:499-512`) | Lịch làm việc ↔ ca |
| 13 | `MapWorkScheduleStaffTable.php:16-17` | `sf_map_work_schedule_staffs` | `map_work_schedule_staff_id` | `work_schedule_id, staff_id, created_at, updated_at` (`WorkScheduleRepo.php:524-527`) | Lịch làm việc ↔ NV |
| 14 | `RecompenseTable.php:18-34` | `sf_recompense` | `recompense_id` | `recompense_name, type, is_system, is_actived, is_deleted, created_by, updated_by, created_at, updated_at` | `type`: `R`=Thưởng, `P`=Phạt (`recompense/edit.blade.php:16-20`); `IS_ACTIVE=1`, `NOT_DELETED=0` |
| 15 | `SfTimekeepingNotificationTable.php:20-44` | `sf_timekeeping_notification` | `sf_timekeeping_notification_id` | `..._title_show, ..._desc, ..._title, ..._content, is_email, is_noti, avatar, type, type_send, time_send, is_active, is_deleted, created_at/by, updated_at/by` | `IS_ACTIVE=1`, `IS_DELETED=0` (=giá trị "chưa xoá"). Giá trị `type/type_send` chưa xác định |
| 16 | `ShiftCheckInLogTable.php:20-38` | `sf_check_in_log` | `check_in_log_id` | fillable: `time_working_staff_id, staff_id, branch_id, shift_id, check_in_day, check_in_time, status ('ok'), reason, created_type ('admin'…), created_by, created_at, updated_at`; thấy thêm khi đọc: `timekeeping_type`, `latitude`, `longitude`, `image_selfie` | `IS_ACTIVE=1`, `NOT_DELETED=0` |
| 17 | `ShiftCheckOutLogTable.php:17-35` | `sf_check_out_log` | `check_out_log_id` | như #16 với `check_out_*` | idem |
| 18 | `ShiftTable.php:20-55` | `sf_shifts` | `shift_id` | `shift_name, shift_type, start_work_time, end_work_time, start_lunch_break, end_lunch_break, start_timekeeping_on, end_timekeeping_on, start_timekeeping_out, end_timekeeping_out, timekeeping_coefficient, min_time_work, note, is_monday..is_sunday, is_actived, is_deleted, created_by, updated_by, created_at, updated_at, time_work, checking_type`; thấy thêm `is_system`, `shift_code` (`TimeOffDays/Models/SFShiftsTable.php:96-99`) | `IS_ACTIVE=1`, `NOT_DELETED=0`. `checking_type` = "Số lần chấm công" (0 ⇒ ca tạo ra ở trạng thái `confirmed`, khác ⇒ `approved`; `TimeWorkingStaffRepo.php:809, 2596`). Giá trị `shift_type` chưa xác định |
| 19 | `StaffHolidayTable.php:16-17` | `staff_holiday` | `staff_holiday_id` | `staff_holiday_title, staff_holiday_start_date, staff_holiday_end_date, staff_holiday_number` | Ngày lễ |
| 20 | `StaffTable.php:19-24` | `staffs` | `staff_id` | fillable khai báo: `fullname, code, staff_department_id, staff_title_id, staff_account_id, phone, staff_avatar, is_active, is_delete, …, check_in_limit, check_approved_time_working` (một số tên khác thực tế `full_name/is_actived/is_deleted`) | `IS_ACTIVE=1`, `NOT_DELETED=0` |
| 21 | `TimeOffDaysShiftsTable.php:14-29` | `time_off_days_shift` | `time_off_days_shift_id` | `time_off_days_id, time_working_staff_id, is_approve, created_at/by, updated_at/by, created_days, created_months, created_years, time_off_type_id, staff_id` (+`day_coefficient`, `date_type_select`, `is_deleted`) | Ca xin nghỉ |
| 22 | `TimeOffDaysTotalTable.php:16-25` | `time_off_days_total` | `time_off_days_total_id` | `time_off_type_id, time_off_days_number, created_at/by, updated_at/by` (+`staff_id`) | `-1` = không giới hạn |
| 23 | `TimeOffTypeTable.php:14-32` | `time_off_type` | `time_off_type_id` | `time_off_type_name, total_number, month_reset, month_start_reset, created/updated, direct_management_approve, staff_id_approve_level2, staff_id_approve_level3` (+`time_off_type_code`, `is_deducted`, `time_off_type_parent_id`, `is_status`) | `IS_ACTIVE=1`, `NOT_DELETE=0` |
| 24 | `TimeWorkingPaySlipDetailTable.php:16-22` | `sf_time_working_pay_slip_detail` | `sf_time_working_pay_slip_detail_id` | `sf_time_working_pay_slip_id, staff_id, staff_code_custom, staff_full_name, total_pay_slip, …_detail_month, …_detail_years, column_0..column_50, is_send_noti` | Dòng phiếu lương import |
| 25 | `TimeWorkingPaySlipTable.php:17-23` | `sf_time_working_pay_slip` | `sf_time_working_pay_slip_id` | `…_name, …_month, …_years, …_status, updated_by, created_by, …_type` | Đợt import phiếu lương; giá trị status/type chưa xác định |
| 26 | `TimeWorkingPaySlipTemplateTable.php:16-22` | `sf_time_working_pay_slip_template` | `id` | `sf_time_working_pay_slip_id, object_key, object_value, object_position, month, years` | Header cột Excel |
| 27 | `TimeWorkingStaffActionLogTable.php:10-25` | `sf_time_working_staffs_action_log` | `action_log_id` | `time_working_staff_id, action_type ('update-status'), action_name ('Duyệt/Xác nhận lịch làm việc'), action_data, created_by, created_at` | `TimeWorkingStaffRepo.php:3356, 3410, 3470` |
| 28 | `TimeWorkingStaffChangeLogTable.php:17-19` | `sf_time_working_staff_change_log` | `time_working_staff_change_log_id` | `time_working_staff_id, is_deducted_old, is_ot_old, is_off_old, note_old, is_deducted_new, is_ot_new, is_off_new, note_new, created_by, created_at, updated_at` | Log sửa ngày công |
| 29 | `TimeWorkingStaffRecompenseTable.php:18-20` | `sf_time_working_staff_recompense` | `time_working_staff_recompense_id` | `time_working_staff_id, recompense_id, money, created_by, updated_by, created_at, updated_at` | Thưởng/phạt gắn vào ca (dùng tính lương) |
| 30 | `TimeWorkingStaffTable.php:20-66` | **`sf_time_working_staffs`** | `time_working_staff_id` | Xem chi tiết bên dưới | `IS_ACTIVE=1, NOT_DELETED=0, IS_CHECK_IN=1, IS_CHECK_OUT=1` |
| 31 | `TimeWorkingStaffsTable.php:20-58` | `sf_time_working_staffs` (model thứ 2, dùng cho báo cáo tổng hợp trong `TimekeepingRepo.php:62`) | `time_working_staff_id` | như #30 (bớt vài cột) | `IS_OT=1` |
| 32 | `TimekeepingConfigTable.php:19-39` | `sf_timekeeping_config` | `timekeeping_config_id` | `branch_id, wifi_name, wifi_ip, timekeeping_type ('wifi'/'gps'), latitude, longitude, allowable_radius (m, mặc định 100), note, is_actived, created_by, updated_by, created_at, updated_at` (+`is_deleted`) | `IS_ACTIVE=1`, `NOT_DELETED=0` |
| 33 | `WorkScheduleTable.php:18-36` | `sf_work_schedules` | `work_schedule_id` | `work_schedule_name, start_day_shift, end_day_shift, repeat ('hard' = Cố định; 'monthly' bị comment), note, is_actived, is_deleted, created_by, updated_by, created_at, updated_at` | `IS_ACTIVE=1`, `NOT_DELETED=0` (`work-schedule/create.blade.php:45-49`) |

Bảng ngoài Shift có liên quan: `sf_timekeeping_staffs` (tổng hợp công theo kỳ lương, PK `timekeeping_staff_id`, `Modules/StaffSalary/Models/TimekeepingStaffsTable.php:19-…`, cột `total_*` liệt kê ở `StaffSalaryRepo.php:96-151`), `sf_pay_slip_config` (Modules/Salary), `time_off_days`, `time_off_days_log`, `time_off_days_files`, `staff_salary*`, `report_studio`.

#### 8.1. Chi tiết `sf_time_working_staffs` (1 dòng = 1 ca của 1 NV trong 1 ngày)

Hợp nhất từ `Modules/Shift/Models/TimeWorkingStaffTable.php:22-60`, `TimeWorkingStaffsTable.php:22-57`, `Modules/TimeOffDays/Models/TimeWorkingStaffsTable.php:16-56`, các `select`/`update` trong code:

| Cột | Ý nghĩa / giá trị |
|---|---|
| `time_working_staff_id` | PK |
| `work_schedule_id` | Lịch làm việc sinh ra ca (0 = thêm tay) |
| `shift_id`, `branch_id`, `staff_id` | Ca / chi nhánh / NV |
| `working_day`, `working_time` | Ngày & giờ bắt đầu ca |
| `working_end_day`, `working_end_time` | Ngày & giờ kết thúc (ca qua đêm → ngày +1) |
| `start_working_format_day/week/month/year` | Tách ngày/tuần ISO/tháng/năm để lọc |
| `timekeeping_coefficient` | Hệ số công của ca (dùng tính lương theo ca) |
| `time_work`, `min_time_work` | Giờ công chuẩn / tối thiểu của ca |
| `actual_time_work` | Giờ làm thực tế; `actual_time_work_confirmed` = giờ công được xác nhận (dùng tính lương/payroll) |
| `is_check_in`, `is_check_out` | 0/1 đã vào/ra ca |
| `check_in_by`, `check_out_by` | Người chấm (chấm hộ) |
| `number_late_time`, `number_time_back_soon` | Phút đi trễ / về sớm |
| `is_approve_late`, `approve_late_by`, `approve_late_time` | Duyệt đi trễ (từ đơn 017 hoặc duyệt tay) |
| `is_approve_soon`, `approve_soon_by`, `approve_soon_time` | Duyệt về sớm (đơn 018) |
| `is_deducted` | NULL = chưa xác định; **0 = nghỉ có lương**; **1 = nghỉ không lương / bị trừ** |
| `is_off` | 1 = nghỉ (không đi làm), 0 = đi làm (`TimeWorkingStaffRepo.php:57-58, 1089`) |
| `is_ot`, `overtime_type` | Ca tăng ca; `S` = tính theo Ca, `H` = theo Giờ (`pop/list-shift.blade.php:58-60`) |
| `is_close` | 1 = đã chốt công (không cho chấm hộ, `list-my-shift.blade.php:146`) |
| `is_deleted` | Xoá mềm |
| `note` | Ghi chú |
| `time_working_staff_status` | `waiting` → `approved` (duyệt lịch) → `confirmed` (xác nhận) (`TimeWorkingStaffRepo.php:3394, 3455`) |
| `checking_type` | Số lần chấm công (copy từ ca) |
| `approved_manual_time_by` | Người duyệt giờ thủ công |
| `time_off_days_id` | Đơn nghỉ phép gắn vào (0 = không) |
| `date_type_off` | `one-day` / `morning` / `afternoon` (từ đơn phép) |
| `shift_code_approved` | Mã ca khi tạo (`shift_code` của ca, ghi ở `TimeWorkingStaffRepo.php:810`); giá trị `P` / `1/2` = ca phép năm, khi xoá ca thì hoàn lại phép (`TimeWorkingStaffRepo.php:~1060`) |
| `wifi_name`, `bssid` | Wifi lúc chấm công (do app ghi, `TimeWorkingStaffsTable.php:362`) |
| `created_at`, `updated_at`, `updated_by` | Audit |

---


## PHẦN A — CA LÀM VIỆC & LỊCH LÀM VIỆC (Modules/Shift)

> Quy ước viết tắt đường dẫn trong phần này:
> - `M/` = `Modules/Shift/`
> - `JS/` = `public/static/backend/js/`
> - Mọi route nằm trong group `Route::group(['middleware' => ['web','auth'], 'prefix' => 'shift', 'namespace' => 'Modules\Shift\Http\Controllers'])` (`M/routes/web.php:2`).
> - Hằng số phân trang `PAGING_ITEM_PER_PAGE = 10` (`config/constant.php:4`).
> - Lang module rỗng: `M/Resources/lang/` chỉ có `.gitkeep` → toàn bộ text dùng `__()`/`@lang()` với chuỗi tiếng Việt gốc; JS lấy text dịch qua `laroute.route('translate')` hoặc `localStorage.translate`.

### A.0. Cơ chế phân quyền áp dụng cho 2 màn hình

- Route chỉ có middleware `web` + `auth` (`M/routes/web.php:2`). **Không** có middleware kiểm tra quyền theo route: middleware `account` (`app/Http/Kernel.php:77`) không được gắn, và ngay cả nội dung kiểm tra `routeList` trong `app/Http/Middleware/Account.php:40-48` cũng đã bị comment hết.
- Quyền chỉ được kiểm tra ở **giao diện (blade)** bằng `in_array('<route.name>', session('routeList'))`. `session('routeList')` được nạp lúc đăng nhập (`Modules/User/Http/Controllers/LoginController.php:142,152`).
- Hệ quả: gọi trực tiếp URL/AJAX vẫn chạy nếu đã đăng nhập (không có chặn ở backend).

---

### A.1. MÀN HÌNH "DANH SÁCH CA LÀM VIỆC"

#### A.1.1. Thông tin chung

| Mục | Giá trị |
|---|---|
| Tên màn hình | DANH SÁCH CA LÀM VIỆC (title header "QUẢN LÝ NHÂN VIÊN") — `M/Resources/views/shift/index.blade.php:3,29` |
| URL | `GET /shift/shift` |
| Route name | `shift` (`M/routes/web.php:150`) |
| Controller | `ShiftController@index` (`M/Http/Controllers/ShiftController.php:34-43`) |
| View | `shift::shift.index` → include `shift::shift.list` (`index.blade.php:106`) |
| JS | `JS/shift/shift/script.js` (logic chính), `JS/shift/shift/work.js` (code thừa, copy từ module công việc — gọi route `customer-lead.*`, `manager-work.*`, không liên quan ca, `work.js:1-138`), `JS/huniel.js`, `JS/admin/service/autoNumeric.min.js` (`index.blade.php:121-132`) |
| Truy cập từ | Dropdown "ca làm" → "Danh sách ca làm" trong `M/Resources/views/timekeeping/navigation.blade.php:16`. Menu chính: chưa xác định (menu có thể nạp từ DB). |
| Quyền | Xem mục A.1.4 (chỉ check trên blade) |

Toàn bộ route của màn hình (`M/routes/web.php:149-160`):

| Route name | Method + URL | Controller@method | Mục đích |
|---|---|---|---|
| `shift` | GET `/shift/shift` | `index` | Trang danh sách |
| `shift.list` | POST `/shift/shift/list` | `listAction` | AJAX lọc/phân trang |
| `shift.create` | POST `/shift/shift/create` | `create` | Trả HTML popup tạo |
| `shift.store` | POST `/shift/shift/store` | `store` (StoreRequest) | Lưu ca mới |
| `shift.edit` | POST `/shift/shift/edit` | `edit` | Trả HTML popup sửa |
| `shift.update` | POST `/shift/shift/update` | `update` (UpdateRequest) | Lưu sửa |
| `shift.destroy` | POST `/shift/shift/destroy` | `destroy` | Xoá mềm |
| `shift.shift.update-status` | POST `/shift/shift/update-status` | `updateStatusAction` | Bật/tắt hoạt động |
| `shift.shift.calculate-min-work` | POST `/shift/shift/calculate-min-work` | `calculateMinWorkAction` | Tính số giờ làm của ca |

#### A.1.2. Bộ lọc (`index.blade.php:67-104`, `ShiftController.php:50-62, 70-86`)

| Field | name | Kiểu | Option | Mặc định | Xử lý backend |
|---|---|---|---|---|---|
| Tên ca | `search` | text, placeholder "Nhập tên ca" (`index.blade.php:72-73`) | — | rỗng | `shift_name LIKE %search%` (`M/Models/ShiftTable.php:107-112`) |
| Trạng thái | `is_actived` | select (select2 `.m_selectpicker`) | `''` = "Chọn trạng thái", `'1'` = "Đang hoạt động", `'0'` = "Đã tạm ngừng" (`ShiftController.php:54-59`) | `''` (không lọc) | `sf_shifts.is_actived = ?` (`ShiftTable.php:120-122`) |
| Nút | — | button "TÌM KIẾM" `.btn-search` (`index.blade.php:96-98`) | — | — | Plugin `PioTable` gửi form `.frmFilter` lên `shift.list` (`script.js:71-73`) |

- `listAction` còn nhận `shift_type`, `page`, `display` (`ShiftController.php:72-78`) nhưng **UI không có ô lọc `shift_type`**.
- Script `script.js:9-69` còn khởi tạo daterangepicker cho `#created_at`, gán `#search_filter`, `#journey_code_filter` — các phần tử này **không tồn tại** trong view (code thừa).
- Sắp xếp: `shift_id DESC`; chỉ lấy `is_deleted = 0` (`ShiftTable.php:98-99`). Phân trang 10 dòng/trang (`ListTableTrait::getList`, `lib/mycore/src/MyCore/Models/Traits/ListTableTrait.php:17-41`).

#### A.1.3. Bảng danh sách (`M/Resources/views/shift/list.blade.php`)

| Cột | Nguồn dữ liệu / cách hiển thị | Dòng |
|---|---|---|
| # | STT = `(page-1)*10 + k + 1` | 20-22 |
| TÊN CA | `shift_name` | 23 |
| THỜI GIAN | `start_work_time` – `end_work_time` định dạng `H:i` | 24-25 |
| GIỜ LÀM | `round(time_work, 2)` + " giờ" (time_work được tính và lưu khi tạo/sửa) | 26-28 |
| GIỜ NGHỈ TRƯA | Chỉ hiển thị khi có cả `start_lunch_break` và `end_lunch_break`: `round(hour_lunch,2)` giờ. `hour_lunch` được tính runtime trong `ShiftRepo::list` (qua đêm nếu start > end) | 30-34; `M/Repositories/Shift/ShiftRepo.php:48-78` |
| GIỜ LÀM TỐI THIỂU | `floatval(min_time_work)` giờ | 35 |
| TRẠNG THÁI | Switch xanh (m-switch--success), checked khi `is_actived == 1`; click → `listShift.changeStatus` | 36-45 |
| GHI CHÚ | `str_limit(note, 100, '...')` (render `{!! !!}` — không escape HTML) | 46 |
| HÀNH ĐỘNG | Icon sửa / xoá theo quyền | 47-65 |

#### A.1.4. Các nút / link / icon

| Nút | Vị trí | Điều kiện hiển thị (quyền) | Hành động | Backend / DB |
|---|---|---|---|---|
| **THÊM CA LÀM VIỆC** | header (`index.blade.php:35-41`) | Check quyền `shift.create` **đã bị comment** (`index.blade.php:34,43`) → luôn hiển thị | `create.popupCreate(false)` → POST `shift.create` `{load:false}` → render popup vào `#my-modal`, show `#modal-create`; init timepicker (minuteStep 1, 24h), AutoNumeric 2 số lẻ cho `#min_time_work, #timekeeping_coefficient`, select2 cho `#branch_id` (`script.js:171-207`) | `ShiftRepo::dataViewCreate` lấy option chi nhánh `branches` (`is_actived=1`, `is_deleted=0`) (`ShiftRepo.php:93-110`, `M/Models/BranchTable.php:27-40`) |
| **BẢNG CHẤM CÔNG** | header (`index.blade.php:45-53`) | `in_array('timekeeping', routeList)` | Mở `route('timekeeping')` tab mới | — (thuộc màn hình khác) |
| **LỊCH LÀM VIỆC CỦA NHÂN VIÊN** | header (`index.blade.php:54-62`) | cũng check quyền `timekeeping` (không phải route riêng) | Mở `route('shift.time-working-staff')` tab mới | — |
| **TÌM KIẾM** | filter | — | Reload bảng AJAX `shift.list` | `ShiftController@listAction` |
| **Switch trạng thái** | cột TRẠNG THÁI (`list.blade.php:39-41`) | **Không check quyền** | `listShift.changeStatus(obj, shiftId)`: POST `shift.shift.update-status` `{shift_id, is_actived: checked?1:0}`; thành công → swal success + refresh bảng (`script.js:110-134`) | `ShiftRepo::updateStatus` → `UPDATE sf_shifts SET is_actived=? WHERE shift_id=?` (`ShiftRepo.php:537-555`). Không có kiểm tra ca đang dùng. Message "Thay đổi trạng thái thành công/thất bại". |
| **Icon Sửa (la-edit)** | `list.blade.php:48-54` | `in_array('shift.edit', routeList)` | `edit.popupEdit(id,false)`: POST `shift.edit` `{shift_id, load, view:'edit'}` → render `#modal-edit` (`script.js:359-398`) | `ShiftRepo::dataViewEdit`: lấy option chi nhánh, `ShiftTable::getInfo`, chi nhánh đã map (`MapShiftBranchTable::getInfoByShift`) (`ShiftRepo.php:289-318`) |
| **Icon Xoá (la-trash)** | `list.blade.php:56-63` | `in_array('shift.destroy', routeList)` | `listShift.remove(id)`: swal confirm "Bạn có muốn xóa không?" → POST `shift.destroy` `{shift_id}` (`script.js:79-109`) | Xem A.1.7 |

#### A.1.5. Popup TẠO CA LÀM VIỆC (`M/Resources/views/shift/popup-create.blade.php`)

Form `#form-register`. Nút **HỦY** (đóng modal) và **LƯU THÔNG TIN** → `create.save(load)` (`popup-create.blade.php:156-169`).

| # | Label | name / id | Kiểu | Mặc định | Validate FE (jQuery validate, `script.js:212-265`) | Validate BE (`M/Http/Requests/Shift/StoreRequest.php:31-57` + `ShiftRepo::store`) | Ý nghĩa nghiệp vụ |
|---|---|---|---|---|---|---|---|
| 1 | Tên ca làm * | `shift_name` | text | rỗng | required ("Hãy nhập tên ca"), maxlength 50 ("Tên ca tối đa 50 kí tự") | `required|max:50|unique:sf_shifts,shift_name,,shift_id,is_deleted,0` — msg "Hãy nhập tên ca", "Tên ca tối đa 50 kí tự", "Tên ca đã tồn tại" (unique chỉ so với ca chưa xoá) | Tên hiển thị của ca |
| 2 | Thời gian làm việc bắt đầu * | `start_work_time` | timepicker (24h, bước 1 phút) | `08:00` | required | required — "Hãy nhập thời gian bắt đầu làm việc" | Giờ vào ca |
| 3 | Thời gian làm việc kết thúc * | `end_work_time` | timepicker | `17:00` | required | required — "Hãy nhập thời gian kết thúc làm việc" | Giờ ra ca; nếu ≤ giờ bắt đầu ⇒ hiểu là **ca qua đêm** khi tính giờ |
| 4 | Thời gian nghỉ trưa bắt đầu | `start_lunch_break` | timepicker | rỗng | — | Phải nhập cặp: có start mà không có end (hoặc ngược lại) → "Thời gian nghỉ không hợp lệ" (`ShiftRepo.php:160-172`); phải nằm trong khung giờ làm (`ShiftRepo.php:146-158, 175-185`) | Khoảng nghỉ không tính công |
| 5 | Thời gian nghỉ trưa kết thúc | `end_lunch_break` | timepicker | rỗng | — | như trên | |
| 6 | Số giờ làm tối thiểu tính đủ công * | `min_time_work` | text + AutoNumeric (2 số lẻ, ≥0), dấu `,` bị bỏ khi gửi | rỗng — tự điền khi đổi giờ (xem A.1.6) | required ("Hãy nhập số giờ làm"), min 1 ("Số giờ làm tối thiểu 1") | required — "Hãy nhập số giờ làm"; và phải `≤ số giờ làm thực của ca` → "Số giờ tối thiểu làm việc không hợp lệ" (`ShiftRepo.php:216-221`) | Ngưỡng giờ làm để được tính đủ công |
| 7 | Hệ số công * | `timekeeping_coefficient` | text + AutoNumeric | `1` | required ("Hãy nhập hệ số công") | `required`; `0 < x ≤ 999` → "Hệ số công tối thiểu 0,1 và tối đa 999" (`ShiftRepo.php:139-144`) | Hệ số nhân công của ca |
| 8 | Chi nhánh làm việc * | `branch_id[]` | select multiple + select2 (placeholder "Chọn chi nhánh"), option = chi nhánh đang hoạt động | không chọn | required ("Hãy chọn chi nhánh") | required — "Hãy chọn chi nhánh" | Các chi nhánh được dùng ca này → bảng `sf_map_shift_branch` |
| 9 | Thời gian hoạt động của ca * | checkbox `.is_monday` … `.is_sunday` (không có name; JS tự đọc) | 7 checkbox Thứ 2 → Chủ nhật | T2–T6 checked, T7 & CN không (`popup-create.blade.php:104-131`) | — | Ít nhất 1 ngày = 1, nếu không → "Hãy chọn ngày làm việc" (`ShiftRepo.php:125-137`) | Các thứ trong tuần mà ca được áp dụng (dùng khi sinh lịch) |
| 10 | Số lần chấm công * | `checking_type` | number | `1` | required ("Hãy nhập số lần chấm công") | StoreRequest **không** validate (chỉ UpdateRequest có `required`) | Số bước chấm công trong ca. Ở module chấm công: `checking_type == 0` → bản ghi công được tạo với trạng thái `confirmed` (không cần chấm), khác → `approved` (`M/Repositories/TimeWorkingStaff/TimeWorkingStaffRepo.php:808-809`); vòng lặp xử lý các bước check-in theo `checking_type` (`TimeWorkingStaffRepo.php:1958`) |
| 11 | Ghi chú | `note` | textarea 5 dòng | rỗng | — | — | Ghi chú tự do |

- Dữ liệu JS gửi lên còn có `shift_type: $('#shift_type').val()` (`script.js:313`) nhưng popup **không có** `#shift_type` → luôn undefined/không lưu (store cũng không ghi cột `shift_type`, `ShiftRepo.php:224-244`).
- Kết quả: thành công → swal "Tạo thành công", đóng modal, refresh bảng; lỗi validate 422 → swal "Thêm mới thất bại" + liệt kê lỗi (`script.js:331-353`).

#### A.1.6. Tự tính "Số giờ làm tối thiểu" (calculateMinWork)

Có **2 cơ chế song song**:

1. **AJAX backend** — chỉ trong popup tạo: các input giờ có `onchange="view.calculateMinWork()"` (`popup-create.blade.php:26,37,50,60`). Hàm POST `shift.shift.calculate-min-work` với 4 giá trị giờ, nhận `hourWork`, render lại input `#min_time_work` từ template `#input-min-time-work-tpl` (`index.blade.php:142-145`) với `decimal_number` cấu hình, gắn AutoNumeric (`script.js:137-168`).
   Backend `ShiftRepo::calculateMinWork` (`ShiftRepo.php:563-601`):
   - Nếu `start < end` → `rangeMinutes = end - start` trong ngày; ngược lại (≥) → qua đêm: `(ngày mai + end) - (hôm nay + start)`.
   - Nghỉ trưa (nếu có đủ 2 mốc): tương tự, cho phép nghỉ qua đêm.
   - `hourWork = rangeMinutes/60 - lunchMinutes/60`; âm → 0.
2. **Script inline** trong `index.blade.php:146-209`: lắng nghe `change` trên `#start_work_time, #end_work_time, #start_lunch_break, #end_lunch_break`; **chỉ chạy khi cả 4 ô có giá trị**; tính giờ ca (qua đêm nếu `end <= start`), trừ **phần giao** giữa nghỉ trưa và ca (overlap), làm tròn 2 số lẻ, gán vào `#min_time_work`. Áp dụng cho cả popup sửa (popup sửa không có `onchange` AJAX).
   - Trong popup tạo, cả 2 cơ chế cùng chạy; giá trị AJAX trả về sau sẽ thay thế input (thứ tự phụ thuộc thời gian phản hồi — chưa xác định giá trị nào thắng trong mọi trường hợp).

#### A.1.7. Rule nghiệp vụ backend khi Tạo / Sửa / Xoá ca

**Tạo — `ShiftRepo::store` (`ShiftRepo.php:120-279`), transaction:**
1. Bắt buộc ≥1 ngày trong tuần (125-137).
2. Hệ số công `0 < x ≤ 999` (139-144).
3. Sinh mảng `rangeTime` gồm mọi phút từ `start_work_time` đến `start + |end - start|` (147-158). Lưu ý: `diffInMinutes` lấy trị tuyệt đối trong cùng ngày nên với **ca qua đêm** khung `rangeTime` không đúng thực tế (ví dụ 22:00–06:00 → khung 22:00 + 960 phút) → validate nghỉ trưa cho ca qua đêm có thể sai.
4. Nghỉ trưa: phải có đủ cặp (160-172) và cả 2 mốc nằm trong `rangeTime` (175-185).
5. Tính `hourWork` như calculateMinWork (187-214); nếu `hourWork < min_time_work` → lỗi "Số giờ tối thiểu làm việc không hợp lệ" (216-221).
6. INSERT `sf_shifts`: `shift_name, start_work_time, end_work_time, start_lunch_break, end_lunch_break, min_time_work, is_monday..is_sunday, note, created_by, updated_by, time_work = hourWork, timekeeping_coefficient, checking_type` (224-244). Không set `is_actived`, `shift_type`, `start/end_timekeeping_on/out` → lấy default DB (chưa xác định giá trị default).
7. INSERT nhiều dòng `sf_map_shift_branch (shift_id, branch_id, created_at, updated_at)` (246-262).
8. Trả `{"error":false,"message":"Tạo thành công"}`; exception → rollback, "Tạo thất bại".

**Sửa — `ShiftRepo::update` (`ShiftRepo.php:328-488`):** cùng các bước validate 1-5; UPDATE `sf_shifts` (không đổi `created_by`) (431-450); **xoá cứng toàn bộ** `sf_map_shift_branch` của ca rồi insert lại (467-470). UpdateRequest thêm `checking_type` required, unique tên loại trừ chính `shift_id` (`M/Http/Requests/Shift/UpdateRequest.php:31-43`). Lưu ý: sửa ca **không cập nhật** các bản ghi `sf_time_working_staffs` đã sinh trước đó.

**Xoá — `ShiftRepo::destroy` (`ShiftRepo.php:498-529`):**
- Chặn xoá nếu ca đang được dùng: `TimeWorkingStaffTable::getUsingByShift` tìm `sf_time_working_staffs` có `shift_id = ?`, `is_deleted = 0`, `working_day >= hôm nay`, `time_working_staff_status IN ('waiting','approved','not-confirm')` (`M/Models/TimeWorkingStaffTable.php:762-787`) → "Ca làm việc đã được sử dụng, bạn không thể xoá".
- Ngược lại xoá mềm: `UPDATE sf_shifts SET is_deleted=1, updated_by=? ` → "Xóa thành công". Không xoá `sf_map_shift_branch`. Ca chỉ dùng trong quá khứ vẫn xoá được.

#### A.1.8. Popup CHỈNH SỬA CA (`M/Resources/views/shift/popup-edit.blade.php`)

Giống popup tạo, khác biệt:
- Form id `#form-edit`, tiêu đề "CHỈNH SỬA CA LÀM VIỆC" (6).
- Prefill từ `$item` (`start_work_time` mặc định `08:00`/`17:00` nếu null — 30, 39); chi nhánh đã map được `selected` (93-94); checkbox ngày theo `is_*` (106-137); `checking_type` mặc định 1 (148).
- Có hidden `shift_id` (159).
- Các input giờ **không** có `onchange="view.calculateMinWork()"` → chỉ script inline (A.1.6) tự điền khi đủ 4 mốc.
- Select2 chi nhánh `closeOnSelect:false` (`script.js:390-394`).
- Nút LƯU → `edit.save(shift_id)` POST `shift.update` (`script.js:399-548`); thành công "Chỉnh sửa thành công", lỗi 422 → "Chỉnh sửa thất bại".

#### A.1.9. Bảng DB liên quan

**`sf_shifts`** — Model `M/Models/ShiftTable.php` (PK `shift_id`, fillable 22-52):

| Cột | Ý nghĩa |
|---|---|
| `shift_name` | Tên ca (unique trong các ca `is_deleted=0`) |
| `shift_type` | Loại ca — có trong fillable & filter (`ShiftTable.php:115-117`) nhưng UI không nhập; giá trị enum chưa xác định |
| `start_work_time`, `end_work_time` | Giờ bắt đầu/kết thúc (TIME). `start > end` ⇒ ca qua đêm |
| `start_lunch_break`, `end_lunch_break` | Giờ nghỉ (nullable) |
| `start_timekeeping_on`, `end_timekeeping_on`, `start_timekeeping_out`, `end_timekeeping_out` | Khung giờ cho phép chấm vào/ra — không được nhập trên màn hình này (chưa xác định nơi ghi) |
| `timekeeping_coefficient` | Hệ số công (0 < x ≤ 999) |
| `min_time_work` | Số giờ tối thiểu tính đủ công |
| `time_work` | Số giờ làm thực của ca (= tổng – nghỉ), tính khi lưu |
| `is_monday` … `is_sunday` | 1 = ca áp dụng ngày đó |
| `checking_type` | Số lần chấm công (0 = không cần chấm/tự xác nhận — theo `TimeWorkingStaffRepo.php:809`) |
| `is_actived` | 1 = Đang hoạt động, 0 = Đã tạm ngừng. `getOption` chỉ lấy ca `is_actived=1, is_deleted=0` (`ShiftTable.php:234-244`) → ca tạm ngừng không xuất hiện khi phân ca |
| `is_deleted` | 0 = chưa xoá, 1 = đã xoá mềm |
| `is_system` | Được select trong list (`ShiftTable.php:96`) nhưng không dùng ở view; ý nghĩa chưa xác định |
| `note`, `created_by`, `updated_by`, timestamps | — |

**`sf_map_shift_branch`** — `M/Models/MapShiftBranchTable.php` (PK `map_shift_branch_id`; `shift_id`, `branch_id`). `getInfoByShift` join `branches` chỉ lấy chi nhánh `is_actived=1, is_deleted=0`, group by `branch_id` (35-53). `removeBranchByShift` xoá cứng (61-64).

**`branches`** — `M/Models/BranchTable.php` (`branch_id`, `branch_name`, `is_actived`, `is_deleted`).

**`sf_time_working_staffs`** — chỉ đọc khi xoá ca (xem A.1.7).

---

### A.2. MÀN HÌNH "LỊCH LÀM VIỆC" (Work Schedule)

#### A.2.1. Thông tin chung

| Mục | Giá trị |
|---|---|
| Tên màn hình | LỊCH LÀM VIỆC (`M/Resources/views/work-schedule/index.blade.php:26`) |
| URL | `GET /shift/work-schedule` |
| Route name | `shift.work-schedule` (`M/routes/web.php:122`) |
| Controller | `WorkScheduleController@index` (`M/Http/Controllers/WorkScheduleController.php:32-41`) |
| View | `shift::work-schedule.index` + `shift::work-schedule.list` |
| JS | `JS/shift/work-schedule/list.js` (danh sách), `JS/shift/work-schedule/script.js` (tạo/sửa) |
| Quyền | **Không có kiểm tra quyền nào** trên view: các `@if(in_array('promotion.edit'/'promotion.destroy'...))` đều bị comment (`list.blade.php:37,43,44,50`); nút "PHÂN CA LÀM" không check (`index.blade.php:31-37`) |
| Truy cập | Tab "Lịch làm việc" trên chính trang này; các link tới `shift.work-schedule` trong `time-working-staff/week/index.blade.php:100` và `time-working-staff/shift/index.blade.php:83` **đã bị comment** → màn hình có thể không còn được dẫn tới từ UI (menu DB: chưa xác định) |

Route (`M/routes/web.php:121-147`):

| Route name | Method + URL | Controller@method |
|---|---|---|
| `shift.work-schedule` | GET `/shift/work-schedule` | `index` |
| `shift.work-schedule.list` | POST `.../list` | `listAction` |
| `shift.work-schedule.create` | GET `.../create` | `create` |
| `shift.work-schedule.show-pop-staff` | POST `.../show-pop-staff` | `showPopupStaffAction` |
| `shift.work-schedule.list-staff-pop` | POST `.../list-staff-pop` | `listStaffPopAction` |
| `shift.work-schedule.choose-staff` | POST `.../choose-staff` | `chooseStaffAction` |
| `shift.work-schedule.un-choose-staff` | POST `.../un-choose-staff` | `unChooseStaffAction` |
| `shift.work-schedule.submit-choose-staff` | POST `.../submit-choose-staff` | `submitChooseStaffAction` |
| `shift.work-schedule.list-staff` | POST `.../list-staff` | `listStaffAction` |
| `shift.work-schedule.remove-staff` | POST `.../remove-staff-tr` | `removeStaffAction` |
| `shift.work-schedule.store` | POST `.../store` | `store` (StoreRequest) |
| `shift.work-schedule.edit` | GET `.../edit/{id}` | `edit` |
| `shift.work-schedule.update` | POST `.../update` | `update` (UpdateRequest) |
| `shift.work-schedule.destroy` | POST `.../destroy` | `destroy` |
| `shift.work-schedule.choose-shift` | POST `.../choose-shift` | `chooseShiftAction` |

#### A.2.2. Bộ lọc (`index.blade.php:64-98`, `WorkScheduleController.php:48-90`)

| Field | name | Kiểu | Option | Mặc định | Backend |
|---|---|---|---|---|---|
| Tên lịch | `search` | text "Nhập tên lịch làm việc" | — | rỗng | `work_schedule_name LIKE %…%` (`M/Models/WorkScheduleTable.php:59-67`) |
| Trạng thái | `sf_work_schedules$is_actived` | select | `''` "Chọn trạng thái", `'1'` "Hoạt động", `'0'` "Không hoạt động" (`WorkScheduleController.php:51-57`) | `''` | `ListTableTrait` đổi `$`→`.`: `where sf_work_schedules.is_actived = ?` (`ListTableTrait.php:31-38`) |
| Hình thức lặp lại | `sf_work_schedules$repeat` | select | `''` "Chọn hình thức lặp lại", `hard` "Cố định", `monthly` "Hàng tháng" (58-64) | `''` | `where sf_work_schedules.repeat = ?` |
| Nút TÌM KIẾM | `.btn-search` | — | — | — | PioTable → `shift.work-schedule.list` (`list.js:1-3`) |

Chỉ lấy `is_deleted = 0`, sắp xếp `work_schedule_id DESC` (`WorkScheduleTable.php:56-57`).

Tab điều hướng (`index.blade.php:43-59`): "Lịch làm việc" (active), "Theo ca" → `shift.time-working-staff.index-shift`, "Theo nhân viên" → `shift.time-working-staff`.

#### A.2.3. Bảng danh sách (`M/Resources/views/work-schedule/list.blade.php`)

| Cột | Hiển thị | Dòng |
|---|---|---|
| # | STT | 19-21 |
| Tên lịch làm việc | `work_schedule_name` | 22 |
| Hình thức lặp lại | `repeat == 'hard'` → "Cố định", **mọi giá trị khác** → "Hàng tháng" | 23 |
| Ngày bắt đầu phân ca | `start_day_shift` d/m/Y | 24 |
| Ngày kết thúc phân ca | `end_day_shift` d/m/Y | 25 |
| Trạng thái | Switch checked nếu `is_actived == 1`, **`onchange=""` — không có xử lý**, chỉ hiển thị | 26-34 |
| Ghi chú | `note` | 35 |
| Hành động | Icon Sửa (link `shift.work-schedule.edit/{id}`), Icon Xoá (`index.remove(id)`) | 36-51 |

#### A.2.4. Các nút / link

| Nút | Hành động | Backend / DB |
|---|---|---|
| **PHÂN CA LÀM** (`index.blade.php:31-37`) | Mở trang `GET shift.work-schedule.create` | Xem A.2.5 |
| **Icon Sửa** | Mở trang `GET shift.work-schedule.edit/{id}` | Xem A.2.7 |
| **Icon Xoá** | `index.remove(id)` → swal confirm → POST `shift.work-schedule.destroy {work_schedule_id}`; thành công swal + refresh (`list.js:5-37`) | Xem A.2.9 |
| Switch trạng thái | Không làm gì | — |

#### A.2.5. Trang PHÂN CA LÀM VIỆC (tạo lịch) — `GET /shift/work-schedule/create`

View `M/Resources/views/work-schedule/create.blade.php`; init `view._init('create')` (`create.blade.php:267-269`).
Khi vào trang, backend `getDataViewCreate` **xoá session** `staff_temp`, `staff_choose`; lấy option chi nhánh, option ca (`ShiftTable::getOption`: chỉ ca đang hoạt động & chưa xoá) và filter nhân viên (`M/Repositories/WorkSchedule/WorkScheduleRepo.php:58-76`).

**Khối 1 — Thông tin lịch (form `#form-register`)**

| Label | name/id | Kiểu | Mặc định | Validate FE (`script.js:263-292`) | Validate BE | Ý nghĩa |
|---|---|---|---|---|---|---|
| Tên lịch làm việc * | `work_schedule_name` | text, placeholder "Ca cho dân hành chính" | rỗng | required ("Hãy nhập tên lịch làm việc"), maxlength 190 ("Tên lịch làm việc tối đa 190 kí tự") | `required|max:190|unique:sf_work_schedules,work_schedule_name,,work_schedule_id,is_deleted,0` + msg "Tên lịch làm việc đã tồn tại" (`M/Http/Requests/WorkSchedule/StoreRequest.php:30-52`) | Tên lịch |
| Hình thức lặp lại * | `repeat` | radio | `hard` (Cố định) checked; radio "Hàng tháng" (`monthly`) **đã bị comment** (`create.blade.php:43-52`) | — | — | Chỉ lưu giá trị; backend **không** dùng `repeat` để sinh lịch khác nhau |
| Ngày bắt đầu phân ca * | `start_day_shift` | datepicker readonly, `dd/mm/yyyy` (`script.js:7-11`) | rỗng | required ("Hãy chọn ngày bắt đầu") | required ("Hãy chọn ngày bắt đầu"); `start < end` bắt buộc → "Ngày bắt đầu phải nhỏ hơn ngày kết thúc" (`WorkScheduleRepo.php:367-373`) | |
| Ngày kết thúc phân ca * | `end_day_shift` | datepicker readonly | rỗng | required ("Hãy chọn ngày kết thúc") | required | |
| Ghi chú | `note` | textarea | rỗng | — | — | |

Không có ràng buộc ngày bắt đầu ≥ hôm nay (được phép phân ca vào quá khứ khi tạo).

**Khối 2 — Danh sách ca (`.list_shift` > nhiều `.object_shift`)** (`create.blade.php:94-184`)

Mỗi dòng ca gồm:

| Field | class | Kiểu | Hành vi |
|---|---|---|---|
| Chọn ca làm việc * | `.shift_id` | select2 (placeholder "Chọn ca làm"), option = ca hoạt động | `onchange="view.changeShift(this)"` → POST `shift.work-schedule.choose-shift {shift_id}` → backend trả `info` ca + `branchMap` (chi nhánh của ca) (`WorkScheduleRepo.php:1085-1099`); JS tick 7 checkbox ngày theo `is_*` của ca và nạp lại option chi nhánh (`script.js:196-255`) |
| Chi nhánh làm việc * | `.branch_id` | select2 (placeholder "Chọn vị trí làm việc"); chỉ chứa chi nhánh map với ca đã chọn | |
| Thứ 2 … Chủ nhật | `.is_monday` … `.is_sunday` | checkbox **disabled** — chỉ hiển thị, giá trị lấy theo ca | Người dùng không chỉnh được |
| Tăng ca | `.is_ot` | checkbox (chỉnh được) | 1 = ca tăng ca; ghi vào `sf_map_work_schedule_shifts.is_ot` và `sf_time_working_staffs.is_ot` |
| Icon xoá dòng | (chỉ có ở dòng thêm từ template `#shift-tpl`, `create.blade.php:341-346`) | — | `view.removeObjectShift` xoá DOM |

Nút **"Thêm lịch làm"** → `view.addObjectShift()`: kiểm tra mọi dòng hiện có đã chọn ca & chi nhánh (lỗi "Hãy chọn ca làm việc", "Hãy chọn vị trí làm việc"), hợp lệ mới append dòng mới từ `#shift-tpl` (`script.js:31-70`).

**Khối 3 — Nhân viên áp dụng (`#autotable-staff`)** (`create.blade.php:187-232`)

- Filter (dùng chung `staffFilters`, `WorkScheduleRepo.php:119-151`):

  | name | Option |
  |---|---|
  | `staffs$branch_id` | "Chọn chi nhánh" + chi nhánh đang hoạt động |
  | `staffs$department_id` | "Chọn phòng ban" + `departments` (`is_inactive = 1`, `is_deleted = 0` — `M/Models/DepartmentTable.php:27-37`) |
  | `staffs$staff_id` | "Chọn nhân viên" + `staffs` `is_actived=1, is_deleted=0` (`M/Models/StaffTable.php:92-103`) |

- Nút **TÌM KIẾM** → PioTable `shift.work-schedule.list-staff` (`script.js:26-28`) → view `work-schedule/list-staff.blade.php`: cột #, TÊN NHÂN VIÊN, CHI NHÁNH, PHÒNG BAN, HÀNH ĐỘNG (icon xoá → `view.removeStaffTr(obj, staffId)` → POST `shift.work-schedule.remove-staff` → loại `staff_id` khỏi session `staff_choose` rồi refresh (`script.js:181-195`, `WorkScheduleRepo.php:322-338`)).
  - **Lưu ý (theo code hiện tại):** `listStaff` truyền `list_staff = session('staff_choose')` (`WorkScheduleRepo.php:294-314`) nhưng điều kiện `whereIn staff_id IN list_staff` trong `StaffTable::_getList` **đã bị comment** (`StaffTable.php:59-61`) và key bị `unset` (82) → bảng "nhân viên đã chọn" thực tế hiển thị **toàn bộ nhân viên chưa xoá**, không phản ánh đúng danh sách được chọn. Dữ liệu lưu thực tế vẫn lấy từ session `staff_choose`.
  - Trên trang tạo, bảng ban đầu trống (`.table-content` rỗng) cho đến khi bấm Tìm kiếm / chọn nhân viên.
- Nút **"Thêm nhân viên"** → `view.showModalStaff()` (A.2.6).

**Nút cuối trang:** HỦY → về `shift.work-schedule`; **LƯU THÔNG TIN** → `create.save()` (`script.js:258-413`):
- Validate form; gom `listShift` (mỗi dòng: `branch_id, shift_id, is_monday..is_sunday, is_ot`); báo lỗi dòng thiếu ca/chi nhánh; nếu không có dòng → "Vui lòng chọn ca làm việc".
- POST `shift.work-schedule.store {work_schedule_name, start_day_shift, end_day_shift, repeat, note, listShift}`; thành công swal "Phân ca thành công" → chuyển về danh sách; lỗi 422 → "Phân ca thất bại".

#### A.2.6. Popup CHỌN NHÂN VIÊN (`work-schedule/pop/pop-staff.blade.php`, `pop/list-staff.blade.php`)

- Mở: POST `shift.work-schedule.show-pop-staff` → `showPopupStaff` **xoá session tạm** `staff_temp`, lấy danh sách nhân viên (trang 1) + đánh dấu những người đã nằm trong `staff_choose` (`WorkScheduleRepo.php:85-110`).
- Filter giống A.2.5 (chi nhánh/phòng ban/nhân viên), TÌM KIẾM → `shift.work-schedule.list-staff-pop` (`listStaffPop`, `WorkScheduleRepo.php:161-190`): checkbox được tick nếu staff ∈ `staff_choose ∪ staff_temp`.
- Bảng: #, checkbox chọn tất cả `.check_all`, TÊN NHÂN VIÊN, CHI NHÁNH, PHÒNG BAN (`pop/list-staff.blade.php:4-36`). Danh sách lấy từ `staffs` join `branches`, `departments`, `is_deleted=0`, không lọc `is_actived` (trừ khi truyền), `staff_id DESC` (`StaffTable.php:32-85`).
- Tick 1 nhân viên → POST `choose-staff {arrCheck:[{staff_id}]}` → thêm vào session `staff_temp`; bỏ tick → `un-choose-staff` → loại khỏi `staff_temp` (`script.js:94-127`, `WorkScheduleRepo.php:198-253`). Chọn tất cả / bỏ tất cả áp dụng cho các dòng trên trang hiện tại (`script.js:128-168`).
- Nút **CHỌN** → POST `submit-choose-staff`: `staff_choose = unique(staff_temp ∪ staff_choose)`, xoá `staff_temp`, đóng modal và trigger `.btn-search` (`script.js:169-180`, `WorkScheduleRepo.php:260-284`).
- Lưu ý: `unChooseStaff` chỉ xoá khỏi `staff_temp`; nếu nhân viên đã nằm trong `staff_choose` (đã chọn trước) thì bỏ tick trong popup **không** loại được họ — phải xoá ở bảng ngoài.
- Nút **HỦY** đóng modal (dữ liệu `staff_temp` còn đến lần mở popup sau thì bị xoá).

#### A.2.7. Trang CHỈNH SỬA LỊCH LÀM VIỆC — `GET /shift/work-schedule/edit/{id}`

View `work-schedule/edit.blade.php`; backend `getDataViewEdit` (`WorkScheduleRepo.php:727-775`): xoá session, lấy info lịch, map nhân viên (`sf_map_work_schedule_staffs`), map ca (`sf_map_work_schedule_shifts`) kèm danh sách chi nhánh của từng ca, rồi **nạp `staff_choose` = nhân viên của lịch**.

Khác biệt so với trang tạo:
- Form id `#form-edit`, prefill các giá trị (`edit.blade.php:37-88`).
- **Ngày bắt đầu bị `disabled`** nếu `start_day_shift ≤ hôm nay` (`edit.blade.php:64`). Ngày kết thúc luôn sửa được.
- Radio `monthly` cũng bị comment (50-53).
- Các dòng ca có sẵn: select ca **không có `onchange`** (111-112) → đổi ca ở dòng cũ sẽ không cập nhật ngày/chi nhánh; dòng đầu tiên không có nút xoá (`@if ($keyShift > 0)`, 183-189). Label chi nhánh là "Vị trí làm việc".
- Nếu lịch có nhân viên, JS tự khởi tạo PioTable và trigger Tìm kiếm để hiện bảng (`edit.blade.php:297-303`).
- Nút LƯU → `edit.save(id)` POST `shift.work-schedule.update` kèm `work_schedule_id` (`script.js:415-571`); thành công "Chỉnh sửa thành công".
- UpdateRequest: như StoreRequest, unique tên loại trừ chính `work_schedule_id` (`M/Http/Requests/WorkSchedule/UpdateRequest.php:30-53`).

#### A.2.8. Rule nghiệp vụ backend — sinh dữ liệu `sf_time_working_staffs`

**Lưu mới — `WorkScheduleRepo::store` (`WorkScheduleRepo.php:348-565`), transaction:**
1. `staff_choose` rỗng → "Hãy chọn nhân viên" (354-364).
2. `start_day_shift >= end_day_shift` → "Ngày bắt đầu phải nhỏ hơn ngày kết thúc" (367-373). (Do vậy lịch phải dài ≥ 2 ngày; nhánh `if ($diffDate > 0)` ở 398 luôn đúng.)
3. **`validateShift`** (575-681): lấy thông tin từng ca; với mỗi cặp dòng ca khác nhau, coi là trùng nếu khoảng giờ giao nhau (so sánh chuỗi giờ, **bao gồm biên**: ca kết thúc 12:00 và ca bắt đầu 12:00 bị coi là trùng; không xử lý ca qua đêm) **và** cùng có ít nhất một thứ trong tuần → "Ca làm việc không hợp lệ". Cũng áp dụng khi chọn cùng 1 ca 2 lần (khác chi nhánh).
4. Sinh bản ghi: lặp từng ngày `i = 0..diffDate` (bao gồm ngày kết thúc) × từng ca (398-467):
   - Bỏ qua ngày nếu thứ của ngày đó có `is_<thứ> = 0` của ca (419-445). Giá trị `is_<thứ>` lấy từ dữ liệu FE gửi (= của ca, vì checkbox disabled).
   - `working_day` = ngày; `working_time` = `start_work_time`; `working_end_time` = `end_work_time`.
   - `working_end_day` = `working_day + start_work_time + rangeMinutes`, trong đó `rangeMinutes = |end - start|` (cùng ngày, 406-415). Với ca qua đêm thông thường (vd 22:00–06:00 → +16h) kết quả vẫn rơi vào ngày hôm sau; nhưng với ca qua đêm có `2*start - end < 24h` (vd 08:00–02:00) `working_end_day` sẽ bị tính **cùng ngày** (sai) — rủi ro theo code.
   - Mỗi nhân viên trong `staff_choose` → 1 dòng: `staff_id, shift_id, branch_id, working_day, working_time, start_working_format_day (d), start_working_format_week (isoWeek), start_working_format_month (m), start_working_format_year (Y), working_end_day, working_end_time, work_schedule_id, is_ot` (447-463).
   - **Không** ghi `timekeeping_coefficient`, `time_work`, `min_time_work`, `checking_type`, `time_working_staff_status` → lấy default DB (chưa xác định). (So sánh: luồng phân ca ở TimeWorkingStaffRepo có ghi các cột này, `TimeWorkingStaffRepo.php:798-821`.)
5. **`validateWorkScheduleDiff`** (691-717): với từng dòng sinh ra gọi `TimeWorkingStaffTable::checkTimeWorkingStaff` (`TimeWorkingStaffTable.php:359-388`): tìm bản ghi cùng `staff_id`, cùng `working_day`, `working_time < end` AND `working_end_time > start+1 phút`, ca join `sf_shifts` đang hoạt động & chưa xoá, `is_deleted=0`, khác `work_schedule_id` (khi update). Có → "Thời gian làm việc đã trùng với lịch khác". (Không xử lý chính xác ca qua đêm.)
6. INSERT `sf_work_schedules (work_schedule_name, start_day_shift, end_day_shift [Y-m-d], repeat, note, created_by, updated_by)` (480-488). Không set `is_actived` → default DB.
7. INSERT `sf_map_work_schedule_shifts` mỗi dòng ca (`work_schedule_id, branch_id, shift_id, is_monday..is_sunday, is_ot, timestamps`) (494-517).
8. INSERT `sf_map_work_schedule_staffs` (`work_schedule_id, staff_id, timestamps`) (519-533).
9. INSERT hàng loạt `sf_time_working_staffs` với `work_schedule_id` thật (535-549).
10. "Phân ca thành công" / lỗi "Phân ca thất bại" + rollback.

**Cập nhật — `WorkScheduleRepo::update` (`WorkScheduleRepo.php:785-1027`):**
- Validate 1-3 như store.
- Khi sinh dữ liệu: **bỏ qua mọi ngày `working_day ≤ hôm nay`** (846-849) — dữ liệu quá khứ & hôm nay được giữ nguyên ("khoá dữ liệu cũ"). Các ngày tương lai được đưa vào `rangeTimeInValid` (851) (kể cả ngày mà ca không áp dụng).
- `validateWorkScheduleDiff` loại trừ chính lịch này.
- UPDATE `sf_work_schedules` (ghi đè cả `created_by` bằng user hiện tại, 929-937).
- Xoá cứng & insert lại `sf_map_work_schedule_shifts` (946-970) và `sf_map_work_schedule_staffs` (973-989).
- Nếu có ngày tương lai: **xoá cứng** `sf_time_working_staffs` của lịch có `working_day BETWEEN ngày tương lai đầu tiên AND ngày cuối của khoảng mới` (991-994, `TimeWorkingStaffTable.php:398-401`) rồi insert bản ghi mới (996-1010).
  - Hệ quả theo code: nếu rút ngắn `end_day_shift`, các bản ghi sau ngày kết thúc mới **không bị xoá**; các bản ghi tương lai trong khoảng sẽ bị xoá cứng kể cả đã có chỉnh sửa/duyệt (không kiểm tra trạng thái).
- "Chỉnh sửa thành công"/"Chỉnh sửa thất bại".

#### A.2.9. Xoá lịch — `WorkScheduleRepo::destroy` (`WorkScheduleRepo.php:1037-1075`)

1. `getUsingBySchedule` (`TimeWorkingStaffTable.php:459-482`): nếu có bất kỳ bản ghi của lịch `is_check_in = 1`, `is_deleted = 0` → "Lịch làm việc này đã được sử dụng, bạn không thể xoá".
2. `UPDATE sf_work_schedules SET is_deleted = 1`.
3. **Xoá cứng toàn bộ** `sf_time_working_staffs` có `work_schedule_id` này (`TimeWorkingStaffTable.php:409-412`) — kể cả ngày quá khứ chưa check-in.
4. Bảng map (`sf_map_work_schedule_shifts`, `sf_map_work_schedule_staffs`) **không** bị xoá.
5. "Xóa thành công" / "Xóa thất bại".

#### A.2.10. Bảng DB liên quan

**`sf_work_schedules`** — `M/Models/WorkScheduleTable.php` (PK `work_schedule_id`, fillable 20-33):

| Cột | Ý nghĩa |
|---|---|
| `work_schedule_name` | Tên lịch (unique trong các lịch chưa xoá) |
| `start_day_shift`, `end_day_shift` | Khoảng ngày áp dụng (Y-m-d) |
| `repeat` | `hard` = Cố định; `monthly` = Hàng tháng (UI đã ẩn, logic không phân biệt) |
| `note` | Ghi chú |
| `is_actived` | 1 = Hoạt động, 0 = Không hoạt động (không có chức năng đổi trên UI) |
| `is_deleted` | 0/1 xoá mềm |
| `created_by`, `updated_by`, timestamps | — |

**`sf_map_work_schedule_shifts`** — `M/Models/MapWorkScheduleShiftTable.php` (PK `map_work_schedule_shift_id`): `work_schedule_id, branch_id, shift_id, is_monday..is_sunday, is_ot, timestamps` (cột suy ra từ insert `WorkScheduleRepo.php:498-512`).

**`sf_map_work_schedule_staffs`** — `M/Models/MapWorkScheduleStaffTable.php` (PK `map_work_schedule_staff_id`): `work_schedule_id, staff_id, timestamps`.

**`sf_time_working_staffs`** — `M/Models/TimeWorkingStaffTable.php` (fillable 22-61). Cột do Lịch làm việc ghi: `work_schedule_id` (0 = phân ca lẻ không thuộc lịch, xem `TimeWorkingStaffRepo.php:796`), `shift_id`, `branch_id`, `staff_id`, `working_day`, `working_time`, `working_end_day`, `working_end_time`, `start_working_format_day/week/month/year` (phục vụ lọc theo ngày/tuần ISO/tháng/năm), `is_ot`. Cột trạng thái dùng để chặn xoá: `is_check_in` (1 = đã check in), `is_deleted`, `time_working_staff_status` (giá trị thấy trong code: `waiting`, `approved`, `not-confirm`, `confirmed` — `TimeWorkingStaffTable.php:785`, `TimeWorkingStaffRepo.php:809`).

**`staffs`**, **`departments`**, **`branches`** — đọc để lọc/hiển thị nhân viên.

**Session** (không phải DB): `staff_temp` (lựa chọn tạm trong popup), `staff_choose` (danh sách nhân viên chính thức của lịch đang tạo/sửa).

---

### A.3. Các file khác trong phạm vi

#### A.3.1. `M/Resources/views/config-shift/*` — KHÔNG thuộc màn hình Ca làm việc

Được dùng bởi `ConfigNotiController` (`M/Http/Controllers/ConfigNotiController.php:31-54`) cho màn hình **Cấu hình thông báo tự động — tab Chấm công**:
- `GET /shift/config-noti` (`config-noti`) → `shift::config-shift.index` (`M/routes/web.php:188-189`).
- `GET /shift/config-noti/edit` (`config-noti.edit`) → `shift::config-shift.edit` (190).
- `POST config-noti.show-popup` → `ConfigNotiRepository` render `shift::config-shift.popup.edit-message` (`M/Repositories/ConfigNoti/ConfigNotiRepository.php:34`); `config-noti.update-message`, `config-noti.update-noti` (191-193).
- Bảng hiển thị: #, Thông báo cho hạng mục, Mô tả, Hình thức (email `is_email` / app `is_noti`), Tiêu đề, Nội dung, Trạng thái `is_active` (`config-shift/index.blade.php:66-117`); JS `JS/manager-work/manage-config/script-noti.js` (131). Dữ liệu từ bảng `sf_timekeeping_notification` (theo tên cột `sf_timekeeping_notification_id`; model `M/Models/SfTimekeepingNotificationTable.php`). Chi tiết thuộc phần cấu hình — không phân tích sâu ở đây.

#### A.3.2. `JS/admin/shift/list.js` — thuộc module **Admin** (ca làm việc kiểu cũ), không phải Modules/Shift

- Được nạp bởi `Modules/Admin/Resources/views/shift/index.blade.php:118`; route `admin.shift*` prefix `/admin/shift` (`Modules/Admin/routes/web.php:386-394`); menu "Ca làm việc" trong `resources/views/components/left-sidebar.blade.php:281-289`.
- Bảng DB riêng: **`shifts`** (`shift_id, shift_code, start_time, end_time, is_actived, is_deleted, created_by, updated_by`) — `Modules/Admin/Models/ShiftTable.php:17-21`. Không liên quan `sf_shifts`.
- Chức năng: danh sách (MÃ CA, THỜI GIAN BẮT ĐẦU, THỜI GIAN KẾT THÚC, TRẠNG THÁI, NGÀY TẠO), filter `is_actived` (1 Hoạt động / 0 Tạm ngưng) + tìm theo `shift_code` (`Modules/Admin/Http/Controllers/ShiftController.php:40-62`); thêm ca (mã tự sinh `CA…`, chặn trùng `start_time+end_time`, nếu trùng với ca đã xoá thì khôi phục `is_deleted=0`) (64-93); sửa (status 0 trùng, 2 trùng ca đã xoá → hỏi kích hoạt lại, 3 kích hoạt lại) (114-147); xoá mềm (149-156); đổi trạng thái (`action == 'unPublish'` → `is_actived=1`, ngược lại 0) (159-167). FE: timepicker bước 15 phút, `testTime` bắt buộc `start < end` (không cho ca qua đêm) (`list.js:325-362`). Quyền: `admin.shift.add`, `admin.shift.change-status`, `admin.shift.submit-edit`, `admin.shift.remove` (index/list blade).

---

### A.4. Tóm tắt điểm cần lưu ý / rủi ro (theo code)

1. Không có phân quyền backend; màn Ca chỉ ẩn icon Sửa/Xoá theo `shift.edit`/`shift.destroy`; nút Thêm & switch trạng thái không check quyền. Màn Lịch làm việc không check quyền nào.
2. Ca qua đêm: tính giờ làm (calculateMinWork/time_work) xử lý đúng; nhưng validate nghỉ trưa (`rangeTime`), validate trùng ca (`validateShift`), check trùng lịch (`checkTimeWorkingStaff`) và `working_end_day` khi sinh lịch không xử lý đầy đủ ca qua đêm.
3. Hai cơ chế tự tính "Số giờ làm tối thiểu" (AJAX + inline JS) cho kết quả có thể khác nhau (inline trừ phần giao nghỉ trưa; backend trừ toàn bộ nghỉ trưa).
4. Bảng "nhân viên đã chọn" ở trang phân ca hiển thị toàn bộ nhân viên do điều kiện `list_staff` bị comment (`StaffTable.php:59-61`).
5. Lịch làm việc: `repeat=monthly` đã ẩn; switch `is_actived` không hoạt động; sinh `sf_time_working_staffs` không ghi hệ số công/giờ làm/số lần chấm công/trạng thái.
6. Sửa lịch chỉ sinh lại ngày > hôm nay; rút ngắn ngày kết thúc không xoá bản ghi thừa. Xoá lịch xoá cứng toàn bộ bản ghi công của lịch nếu chưa ai check-in.
7. Sửa ca không cập nhật các bản ghi công đã sinh; tắt ca (`is_actived=0`) không kiểm tra đang sử dụng, và ca tắt không còn trong dropdown phân ca.

---


## PHẦN B — LỊCH LÀM VIỆC NHÂN VIÊN (TimeWorkingStaff)

> Phạm vi: `TimeWorkingStaffController` + `TimeWorkingStaffRepo` + views `time-working-staff/*` + các Model liên quan.
> Nguồn: chỉ đọc code, không truy vấn được DB (ý nghĩa enum suy ra từ code).

**Viết tắt đường dẫn dùng trong tài liệu**

| Viết tắt | File |
|---|---|
| `W` | `Modules/Shift/routes/web.php` |
| `C` | `Modules/Shift/Http/Controllers/TimeWorkingStaffController.php` (1791 dòng) |
| `R` | `Modules/Shift/Repositories/TimeWorkingStaff/TimeWorkingStaffRepo.php` (3520 dòng) |
| `M` | `Modules/Shift/Models/TimeWorkingStaffTable.php` |
| `JS` | `public/static/backend/js/shift/time-working-staff/list.js` (`script.js` cùng thư mục **rỗng, 0 byte**) |
| `V/` | `Modules/Shift/Resources/views/time-working-staff/` |
| `ReqOT` | `Modules/Shift/Http/Requests/TimeWorkingStaff/CreateOvertimeRequest.php` |
| `ReqUpd` | `Modules/Shift/Http/Requests/TimeWorkingStaff/UpdateTimeWorkingRequest.php` |

---

### 0. Tổng quan và cơ chế chung

#### 0.1 Route, middleware, phân quyền
- Toàn bộ route nằm trong group `middleware ['web','auth']`, prefix `shift/time-working-staff`, namespace `Modules\Shift\Http\Controllers` (W:2-4). **Không có middleware kiểm tra quyền** ở route lẫn controller (C:26-30 constructor chỉ inject repo). Bất kỳ user đã đăng nhập đều gọi được mọi action bằng ajax trực tiếp.
- Quyền chỉ được áp ở **Blade** để ẩn/hiện menu: `@if (in_array('<route name>', session('routeList')))`. Các chuỗi quyền dùng trong màn này:
  - `shift.time-working-staff.show-pop-shift` (nút "+" ô trống, "Thêm ca làm việc")
  - `shift.time-working-staff.show-time-working-detail` ("Chi tiết")
  - `shift.time-working-staff.show-pop-time-attendance` ("Chấm công hộ")
  - `shift.time-working-staff.paid-or-unpaid-leave` ("Nghỉ có lương"/"Nghỉ không lương")
  - `shift.time-working-staff.show-pop-overtime` ("Làm thêm giờ")
  - `shift.time-working-staff.remove-shift` ("Xoá")
  - `shift.time-working-staff.show-pop-staff` ("Thêm nhân viên" ở màn theo ca)
  - `shift.time-working-staff.remove-staff-by-shift` ("Xoá" nhân viên khỏi ca)
  - `manager-work.detail.show-popup-work-child` ("Thêm công việc" — thuộc module ManagerWork)
- Một số menu **không** check quyền theo routeList mà theo điều kiện nghiệp vụ: "Chỉnh sửa", "Thêm ca" (menu cạnh tên NV), "Duyệt lịch làm việc" (chỉ quản lý trực tiếp), "Confirm working time" (quản lý trực tiếp hoặc admin có cấu hình).
- Trang index (`shift.time-working-staff`, `shift.time-working-staff.index-shift`) không tự check quyền; việc vào được hay không phụ thuộc menu (không nằm trong phạm vi file này — chưa xác định).

#### 0.2 Bảng route đầy đủ (W:4-105)

| # | Method | URL (sau `/shift/time-working-staff`) | Route name | Controller@method | Có UI gọi? |
|---|---|---|---|---|---|
| 1 | GET | `/` | `shift.time-working-staff` | `index` (C:37) | Có — màn "Theo nhân viên" |
| 2 | POST | `list` | `.list` | `listAction` (C:162) | Có (PioTable) |
| 3 | GET | `shift` | `.index-shift` | `indexShift` (C:200) | Có — màn "Theo ca" |
| 4 | POST | `list-shift-index` | `.list-shift-index` | `listShiftIndexAction` (C:274) | Có |
| 5 | POST | `show-pop-shift` | `.show-pop-shift` | `showPopupShiftAction` (C:314) | Có |
| 6 | POST | `show-pop-shift-staff` | `.show-pop-shift-staff` | `showPopupShiftStaffAction` (C:327) | Có |
| 7 | POST | `list-shift` | `.list-shift` | `listShiftAction` (C:341) | Có |
| 8 | POST | `list-shift-staff` | `.list-shift-staff` | `listShiftStaffAction` (C:365) | Có |
| 9 | POST | `choose-shift` | `.choose-shift` | `chooseShiftAction` (C:388) | **Không** (ajax bị comment JS:102-113) |
| 10 | POST | `un-choose-shift` | `.un-choose-shift` | `unChooseShiftAction` (C:399) | **Không** (JS:122-129 comment) |
| 11 | POST | `update-object-shift` | `.update-object-shift` | `updateObjectShiftAction` (C:410) | **Không** (JS:152-163 comment) |
| 12 | POST | `add-shift` | `.add-shift` | `addShiftAction` (C:421) | Có |
| 13 | POST | `add-shift-staff` | `.add-shift-staff` | `addShiftByStaffAction` (C:433) | Có |
| 14 | POST | `paid-or-unpaid-leave` | `.paid-or-unpaid-leave` | `paidOrUnPaidLeaveAction` (C:445) | Có |
| 15 | POST | `remove-shift` | `.remove-shift` | `removeShiftAction` (C:456) | Có |
| 16 | POST | `is-work` | `.is-work` | `isWorkAction` (C:467) | **Không** — JS có `index.isWork` (JS:490) nhưng không view nào gọi |
| 17 | POST | `show-pop-my-shift` | `.show-pop-my-shift` | `showPopupMyShiftAction` (C:478) | Có |
| 18 | POST | `list-my-shift` | `.list-my-shift` | `listMyShiftAction` (C:491) | Có |
| 19 | POST | `remove-staff-by-shift` | `.remove-staff-by-shift` | `removeStaffByShiftAction` (C:504) | Có |
| 20 | POST | `show-pop-staff` | `.show-pop-staff` | `showPopupStaffAction` (C:515) | Có |
| 21 | POST | `list-staff` | `.list-staff` | `listStaffAction` (C:528) | Có |
| 22-24 | POST | `choose-staff`, `un-choose-staff`, `update-object-staff` | `.choose-staff`... | C:552/563/574 | **Không** (JS:635-681 comment) |
| 25 | POST | `add-staff` | `.add-staff` | `addStaffAction` (C:585) | Có |
| 26 | POST | `show-time-working-detail` | `.show-time-working-detail` | `showTimeWorkingDetailAction` (C:596) | Có |
| 27 | POST | `show-pop-time-attendance` | `.show-pop-time-attendance` | `showPopTimeAttendanceAction` (C:618) | Có |
| 28 | POST | `submit-time-attendance` | `.submit-time-attendance` | `submitTimeAttendanceAction` (C:631) | Có |
| 29 | POST | `approve-work-schedule` | `.approve-work-schedule` | `approveWorkScheduleAction` (C:642) | Có |
| 30 | POST | `confirm-work-schedule` | `.confirm-work-schedule` | `confirmWorkScheduleAction` (C:653) | Có |
| 31 | POST | `show-pop-edit` | `.show-pop-edit` | `showPopupEditAction` (C:664) | Có |
| 32 | POST | `update-time-working` | `.update-time-working` | `updateTimeWorkingAction` (C:607, FormRequest `ReqUpd`) | Có |
| 33 | POST | `show-pop-overtime` | `.show-pop-overtime` | `showPopupOvertimeAction` (C:681) | Có |
| 34 | POST | `store-overtime` | `.store-overtime` | `storeOvertimeAction` (C:698, FormRequest `ReqOT`) | Có |
| 35 | POST | `list-recompense` | `.list-recompense` | `listRecompenseAction` (C:709) | Có |
| 36 | POST | `show-pop-create-recompense` | `.show-pop-create-recompense` | C:734 | Có |
| 37 | POST | `submit-create-recompense` | `.submit-create-recompense` | C:752 | Có |
| 38 | POST | `remove-recompense` | `.remove-recompense` | C:765 | Có |
| 39 | POST | `get-select-week` | `.get-select-week` | `getSelectWeekAction` (C:778) | Có |
| 40 | POST | `export-excel-time-working-staff` | `.export-excel` | `ExportTimeSheetAction` → method thật `exportTimeSheetAction` (C:801) | **Không** (form bị comment V/week/index.blade.php:62-72) |
| 41 | POST | `show-pop-shift-flexible` | `.show-pop-shift-flexible` | C:1060 | **Không** (nút bị comment V/week/index:73-78, V/week/list:66-68) |
| 42 | POST | `search-staff-flexible` | `.search-staff-flexible` | C:1086 | chỉ trong popup linh động |
| 43 | POST | `get-list-shift-flexible` | `.get-list-shift-flexible` | C:1117 | chỉ trong popup linh động |
| 44 | POST | `add-row-shift-flexible` | `.add-row-shift-flexible` | C:1098 | chỉ trong popup linh động |
| 45 | POST | `add-shift-flexible` | `.add-shift-flexible` | C:1130 | chỉ trong popup linh động |
| 46 | GET | `export-time-working-staff-action` | `.export-time-working-staff-action` | C:1785 | **Không** có UI trong repo |
| 47 | GET | `report-time-working-staff` | `shift.report.time-working-staff` | `indexTimeWorkingStaff` (C:1135) | **View không tồn tại** |
| 48 | POST | `report-list-time-working-staff` | `shift.report.list-time-working-staff` | `listTimeWorkingStaff` (C:1145) | View không tồn tại |
| 49 | POST | `export-list-time-working-staff` | `shift.export.list-time-working-staff` | `exportTimeWorkingStaff` (C:1188) | — |
| 50 | GET | `report-time` | `shift.report-time.time-working-staff` | `indexActualTimeWorking` (C:1477) | View không tồn tại |
| 51 | POST | `report-time-list` | `shift.report-time.list.time-working-staff` | `listActualTimeWorking` (C:1487) | View không tồn tại |
| 52 | POST | `export-time-list` | `shift.export.report-time.list.time-working-staff` | `exportActualTimeWorking` (C:1496) | — |

JS gọi route bằng `laroute.route(...)` (vd JS:6, 46, 185...). Popup chèn vào các div `#my-modal`, `#my-modal-my-shift`, `#my-modal-recompense`, `#my-modal-my-shift-flexible` (V/week/index.blade.php:212-215).

#### 0.3 Cấu hình chung lưu session (ảnh hưởng tô màu)
`index()` và `indexShift()` đọc `sf_config_general` (R:2816-2822 → `ConfigGeneralTable::getConfig`) rồi `_setSessionConfigGeneral` (C:68-113):
- Bỏ qua bản ghi `is_actived = 0` (C:81-83). Đơn vị `config_general_unit = 'hour'` → nhân 60, ngược lại tính phút (C:85-89).
- Ghi session (đơn vị phút): `late_check_in` (tính **đi trễ** khi vào sau X phút), `off_check_in` (tính **nghỉ không lương** khi vào sau X phút), `back_soon_check_out` (tính **về sớm** khi ra trước X phút), `off_check_out` (tính **nghỉ không lương** khi ra trước X phút) (C:91-112). Mặc định 0 nếu không có cấu hình.
- Các ngưỡng này **chỉ dùng để tô màu ô trong Blade**, không ghi vào DB ở màn này.

---

### 1. Màn "LỊCH LÀM VIỆC — Theo nhân viên" (tuần/tháng)

- **URL**: `GET /shift/time-working-staff` — route `shift.time-working-staff` — `C@index` (C:37-61).
- **View**: `V/week/index.blade.php`; danh sách ajax: `V/week/list.blade.php` (tuần) hoặc `V/week/list-month.blade.php` (tháng) do `C@listAction` (C:162-193) chọn: `number_day > 6` → bản tháng (C:182-184).
- Tiêu đề header "QUẢN LÝ NHÂN VIÊN", portlet "LỊCH LÀM VIỆC" (V/week/index:5, 57).
- Tab điều hướng: "Theo ca" → `shift.time-working-staff.index-shift`; "Theo nhân viên" (active) (V/week/index:98-114).
- Khi load trang **không render dữ liệu** (`LIST => null`, C:54-60; include bị comment V/week/index:185-189); JS tự bấm `.btn-search` để gọi `list` (V/week/index:258).

#### 1.1 Nút trên header
| Nút | Hành vi |
|---|---|
| **TẠO CA LÀM VIỆC** | `onclick="create.popupCreate(false)"` (V/week/index:79-84) — hàm thuộc `public/static/backend/js/shift/shift/script.js` (được include V/week/index:236), tức popup **tạo định nghĩa ca** (`sf_shifts`) của ShiftController — ngoài phạm vi phần B. |
| "Xuất dữ liệu" | Bị comment (V/week/index:62-72). |
| "THÊM CA LINH ĐỘNG" | Bị comment (V/week/index:73-78). |
| "BẢNG CHẤM CÔNG" | Bị comment (V/week/index:85-91). |

#### 1.2 Bộ lọc (form `.frmFilter`, V/week/index:119-182)
| Field | name | Kiểu | Option | Mặc định | Ghi chú |
|---|---|---|---|---|---|
| Năm | `years` | select2 | Năm hiện tại −1, hiện tại, +1 (V/week/index:125-133) | năm hiện tại | `onchange="list.changeDateType(this)"` → gọi `get-select-week` dựng lại option `date_object` rồi tự tìm kiếm (JS:4-18). |
| Kiểu thời gian | `date_type` | select2 | `by_week` "Theo tuần", `by_month` "Theo tháng" (V/week/index:137-140) | `by_week` | onchange như trên. |
| Tuần/Tháng | `date_object` | select2 | Tuần: `Tuần i (dd/mm/YYYY - dd/mm/YYYY)` với i = 1..`weeksInYear` (V/week/index:143-153); Tháng: "Tháng 1..12" (V/append/select_month.blade.php) | Tuần ISO hiện tại | Chọn xong tự trigger tìm kiếm (V/week/index:245-249). |
| Ca làm | `shift_id` | select2 | `'' => Chọn ca làm` + ca `sf_shifts` `is_actived=1, is_deleted=0` (C:126; `ShiftTable::getOption` ShiftTable.php:234-244) | rỗng | Lọc các ô ca theo ca. |
| Chi nhánh | `branch_id` | select2 | `'' => Chọn chi nhánh nhân viên` + branches active (C:128; BranchTable.php:27-39) | rỗng | Lọc **chi nhánh trực thuộc của NV** (`staffs.branch_id`, StaffTable.php:79-81). |
| Phòng ban | `department_id` | select2 | `'' => Chọn phòng ban` + departments `is_inactive=1,is_deleted=0` (DepartmentTable.php:27-37) | rỗng | `staffs.department_id`. |
| Nhân viên | `staff_id` | select2 | `'' => Chọn nhân viên` + staffs active (StaffTable.php:92-103) | rỗng | |
| Trạng thái | `is_actived` | select2 | `''` Chọn trạng thái, `1` Hoạt động, `0` Không hoạt động (R:119-123) | `1` (C:149-152) | Lọc `staffs.is_actived` (StaffTable.php:50-52). |
| TÌM KIẾM | — | button | | | Mọi select `.m_selectpicker` chọn xong cũng tự tìm (V/week/index:253-257). |

Hàm `get-select-week` (C:778-799): `by_week` → render `V/append/select_week.blade.php` (số tuần = `Carbon::parse(year-01-01)->weeksInYear`, selected tuần ISO hiện tại nếu đúng năm); ngược lại → `V/append/select_month.blade.php` (selected tháng hiện tại nếu đúng năm).

#### 1.3 Logic lấy dữ liệu (`R@getList`, R:135-273)
1. Tính khoảng ngày: `by_week` → `setISODate(years, date_object)` từ thứ Hai đến Chủ nhật (R:142-148); `by_month` → ngày 1 đến cuối tháng (R:149-156).
2. `listDay`: mỗi ngày gồm `day_name` (dịch), `day_format` (d/m với tuần, d với tháng), `day_full_format`, `is_holiday` = 1 nếu ngày nằm trong `staff_holiday` (`staff_holiday_start_date <= day <= staff_holiday_end_date`, StaffHolidayTable.php:43-56) (R:167-212).
3. Danh sách NV: `StaffTable::getList` phân trang 10 dòng (`PAGING_ITEM_PER_PAGE=10`, config/constant.php:4), `is_deleted=0`, sắp xếp `staff_id desc` (StaffTable.php:32-89).
4. Với **mỗi NV × mỗi ngày** gọi `M@getTimeWorkingByStaffOnList` (M:151-218): join `sf_shifts`, `staffs`, `branches` (theo `sf_time_working_staffs.branch_id`), leftjoin `sf_check_in_log`, `sf_check_out_log`, `time_off_days`; điều kiện NV active, ca `is_deleted=0` (không lọc `is_actived` của ca), bản ghi `is_deleted=0`, `working_day = ngày`, lọc thêm `shift_id` nếu có. Sau đó với từng bản ghi lấy check-in đầu tiên (`ShiftCheckInLogTable::getFirstCheckIn`, ShiftCheckInLogTable.php:295-308) và check-out cuối (`ShiftCheckOutLogTable::getLastCheckOut`, ShiftCheckOutLogTable.php:85-99) để ghi đè `check_in_day/time`, `check_out_day/time`, `created_type_ci/co`; ép `is_approve_time_off = 0` (R:249-259).
   - **Lưu ý (bug)**: `getFirstCheckIn`/`getLastCheckOut` **không select cột `created_type`** → `created_type_ci/co` luôn `null` → icon 📱/👤 nguồn chấm công **không bao giờ hiện** ở màn này. Đồng thời `is_approve_time_off` bị ép 0 (R:258) → icon đơn phép luôn hiện "không được chấp nhận" (đỏ) nếu có `time_off_days_id` (xem 1.5). Truy vấn N×7 (hoặc N×31) lần + 2 query log/bản ghi.

#### 1.4 Bảng lưới (V/week/list.blade.php)
- **Cột đầu "Nhân viên"** (V/week/list:5, 25-78): avatar (`staff_avatar`, hoặc chữ cái đầu với màu ngẫu nhiên), tên NV (link `admin.staff.show` mở tab mới), phòng ban, chi nhánh trực thuộc (bản tuần; bản tháng không hiện chi nhánh). Menu ⋮:
  - **Thêm ca** → `index.showModalShiftStaff(staff_id, '0', 'list', null, '0')` (V/week/list:63-65) → popup "Thêm ca cho nhân viên theo tuần/tháng" (mục 5). Không check quyền.
  - "Thêm ca linh động" bị comment (V/week/list:66-68).
- **Các cột ngày**: header `day_name` + `day_format`; **chữ đỏ** nếu ngày lễ (V/week/list:9-12).
- **Ô ngày, theo số ca của ngày** (`@switch(count($v1))`, V/week/list:82-467):
  - **0 ca**: ô trống, nếu có quyền `show-pop-shift` hiện nút "+" → `index.showModalShift(staff_id, ngày, 'list', null, is_holiday)` (V/week/list:84-94).
  - **1 ca**: ô tô màu nền (mục 1.5), viền đỏ 2px nếu `is_ot=1` (V/week/list:209-210). Nội dung: tên ca + menu ⋮; dòng giờ: nếu `working_day <= hôm nay` hiện `(giờ check-in – giờ check-out)` lấy từ log, `--:--` nếu chưa chấm, kèm icon `la-mobile` (NV tự chấm, `created_type='staff'`) hoặc `la-user-plus` (admin chấm hộ, `created_type='admin'`); nếu ngày tương lai hiện `(giờ bắt đầu – giờ kết thúc ca)` (V/week/list:296-316). Dòng cuối: tên chi nhánh làm việc (in đậm) + icon đơn phép (mục 1.5).
  - **≥2 ca**: hiện link "**n Ca**" → `index.showModalMyShift(staff_id, ngày)` (popup "Ca của tôi", mục 7) và một chuỗi chấm tròn `.line_note` mỗi ca một chấm theo màu, viền đỏ nếu OT (V/week/list:343-466).
- Bản **tháng** (V/week/list-month.blade.php): table-layout fixed, header `day_format` (số ngày) trên `day_name`; ô 1 ca chỉ hiện **icon đơn phép + menu ⋮ + 1 chấm màu** (không có tên ca/giờ) (V/week/list-month:197-303); ô trống luôn hiện nút "+" **không kiểm tra quyền** và truyền `$v['shift_id']` (không tồn tại trên dòng NV) (V/week/list-month:77-81).
- Phân trang `helpers.paging` (V/week/list:477).

#### 1.5 Quy tắc tô màu ô (màn theo NV — V/week/list:98-207, giống ở ô ≥2 ca V/week/list:352-461)
So sánh `working_day` với ngày hiện tại:

**A. Ngày tương lai** (V/week/list:102-110)
- Mặc định `#D3D3D3` (xám — chưa đến ca).
- `is_deducted === 0` → `#8E9FE6` (nghỉ phép **có lương**).
- `is_deducted === 1` → `#E5E0FF` (nghỉ phép **không lương**).

**B. Hôm nay** (V/week/list:112-150) — kiểm tra lần lượt, điều sau ghi đè điều trước:
1. `#3FAE8F` (xanh — đúng giờ) mặc định.
2. `is_check_in === 0 || is_check_out === 0` → `#F08A5D` (cam — chưa vào/ra ca).
3. `is_deducted === 0` → `#8E9FE6`; `=== 1` → `#E5E0FF`.
4. Đã check-in và `working_day+working_time + late_check_in phút < thời điểm check-in` → `#F2B84B` (vàng — **vào trễ**).
5. Đã check-out và `working_end_day+working_end_time − back_soon_check_out phút > thời điểm check-out` → `#F2B84B` (**ra sớm**).
6. `off_check_in > 0` và check-in muộn hơn `giờ vào + off_check_in` → `#E5E0FF` (**tính nghỉ không lương**).
7. `off_check_out > 0` và check-out sớm hơn `giờ ra − off_check_out` → `#E5E0FF`.

**C. Ngày quá khứ** (V/week/list:152-205)
1. `is_deducted === 0` → `#8E9FE6`; `=== 1` → `#E5E0FF` (dừng).
2. Ngược lại (`is_deducted` null): nếu chưa vào **và** chưa ra → `#E5E0FF` (vắng mặt coi như nghỉ không lương — vì nhánh `is_deducted === 0` không thể xảy ra ở đây); nếu thiếu một trong hai → `#F08A5D`.
3. Vào trễ / ra sớm như B4-B5 → `#F2B84B`.
4. Ra không sớm **và** vào không trễ → `#3FAE8F`.
5. B6/B7 → `#E5E0FF`.

**Viền** đỏ 2px khi `is_ot == 1` (tăng ca).

**Icon đơn nghỉ phép** (khi `time_off_days_id` khác null/0, V/week/list:322-336): `time_off_days.is_approve === 1` → `la-check-circle` xanh "Đơn phép được chấp nhận"; `=== 0` → `la-times-circle-o` đỏ "Đơn phép không được chấp nhận"; còn lại → `la-clock-o` vàng "Đơn phép đang chờ duyệt". (Như nói ở 1.3, `getList` ép giá trị = 0.)

**Chú thích màu dưới bảng** (V/week/index:193-208): `#ECECEC` Chưa đến ca, `#3FAE8F` Chấm công đúng giờ, `#F08A5D` Chưa vào/ra ca, `#FFD553` Vào trễ/ra sớm, `#8E9FE6` Nghỉ phép có lương, `#E5E0FF` Nghỉ phép không lương, `#FF5D56` Tăng ca. **Lệch với code**: ô chưa đến ca thực tế là `#D3D3D3`, trễ/sớm là `#F2B84B`, tăng ca là viền đỏ chứ không phải màu nền.

#### 1.6 Menu ⋮ trên ô ca (bản tuần V/week/list:221-293; bản tháng V/week/list-month:223-289)
| Mục | Điều kiện hiện | Gọi |
|---|---|---|
| **Chi tiết** | quyền `show-time-working-detail` | `index.showTimeWorkingDetail(id,'list')` → popup Chi tiết (mục 9) |
| **Chỉnh sửa** | `working_day >= hôm nay` **và** `is_close == 0` **và** `is_check_in == 0` (không check quyền) | `index.showModalEdit(id,'list')` → popup Chỉnh sửa (mục 11) |
| **Duyệt lịch làm việc** | (chỉ bản tuần) `Auth::id() == staffs.staff_manager_id` của NV **và** `is_deducted === null` **và** `time_working_staff_status == 'waiting'` | `index.approveWorkSchedule(id,'list')` (mục 13) |
| **Confirm working time** | (`Auth::id() == staff_manager_id` **hoặc** `$isAdminConfirm`) **và** `is_deducted === null` **và** status `'not-confirm'` | `index.confirmWorkSchedule(id,'list', actual_time_work)` (mục 14). Nhãn "Confirm working time" không có key trong `resources/lang/vi.json` → hiển thị tiếng Anh ở cả 2 ngôn ngữ. |
| **Thêm ca làm việc** | quyền `show-pop-shift` | `index.showModalShift(staff_id, ngày, 'list', null, is_holiday)` (mục 4) |
| **Chấm công hộ** | quyền `show-pop-time-attendance` **và** `working_day <= hôm nay` **và** `is_close == 0` **và** (`is_check_in == 0` hoặc `is_check_out == 0`) **và** `is_deducted === null` **và** status `'approved'` | `index.showModalTimeAttendance(id,'list')` (mục 12) |
| **Nghỉ có lương** | (bản tuần) `is_close` 0/null **và** chưa check-in **và** chưa check-out **và** quyền `paid-or-unpaid-leave` **và** `is_deducted` null hoặc 1 | `index.paidOrUnPaidLeave(id,'paid','list')` (mục 10) |
| **Nghỉ không lương** | như trên, `is_deducted` null hoặc 0 | `index.paidOrUnPaidLeave(id,'unpaid','list')` |
| **Thêm công việc** | quyền `manager-work.detail.show-popup-work-child` | `WorkChild.showPopup(null, staff_id, '5', working_day, working_time, working_end_day, working_end_time, 'shift')` (JS:1335-1498) → ajax `manager-work.detail.show-popup-work-child`, lưu bằng `manager-work.detail.save-child-work` (JS:1576) — module ManagerWork, loại công việc id `5` cố định. |
| **Làm thêm giờ** | quyền `show-pop-overtime` | `index.showModalOvertime(id,'list')` (mục 15) |
| **Xoá** | quyền `remove-shift` | `index.remove(id,'list')` (mục 8) |

`$isAdminConfirm` = `R@isAdminConfirmWorkSchedule` (R:3494-3504): user `is_admin == 1` **và** `sf_config_general` code `admin_confirm_work_schedule` có `is_actived = 1` (C:191).

---

### 2. Màn "LỊCH LÀM VIỆC — Theo ca"

- **URL**: `GET /shift/time-working-staff/shift` — route `shift.time-working-staff.index-shift` — `C@indexShift` (C:200-225).
- **View**: `V/shift/index.blade.php`; ajax `list-shift-index` → `V/shift/list.blade.php` (tuần) / `V/shift/list-month.blade.php` (tháng khi `number_day > 6`, C:294-296).
- Nút header: **THÊM CA LÀM VIỆC** → `create.popupCreate(false)` (popup tạo ca của ShiftController, ngoài phạm vi). Tab "Theo ca" active.
- Lần đầu controller render sẵn dữ liệu tuần hiện tại (C:209-213) nhưng truyền `years => Carbon::now()->format('y')` (**năm 2 chữ số**, vd `26`) → `setISODate(26, tuần)` ra năm 0026 (R:293). Trang này **không** auto bấm tìm kiếm khi load (khác màn theo NV); dữ liệu lần đầu nhiều khả năng sai năm — cần kiểm chứng trên UI.
- **Bộ lọc**: giống màn theo NV (`years`, `date_type`, `date_object`, `shift_id`, `branch_id` với placeholder "Chọn chi nhánh làm việc", `department_id`, `staff_id`, `is_actived` mặc định 1) (C:232-266). Controller nhận thêm key `sf_shifts$shift__type` (C:282) nhưng không có trên form. **`is_actived` bị bỏ qua** ở `getListShift` (R:365-369 chỉ truyền shift_id/page/display).
- **Logic** `R@getListShift` (R:283-419): phân trang **danh sách ca** `sf_shifts` (`is_deleted=0`, sort `shift_id desc`, lọc `shift_id`) (ShiftTable.php:63-160). Mỗi ca: lấy NV có lịch trong khoảng ngày (`M@getListStaffByShift` M:610-652: NV active, lọc staff/department theo `staffs`, lọc branch theo `sf_time_working_staffs.branch_id`, group theo staff); mỗi NV × ngày gọi `M@getTimeWorkingByShift` (M:288-347, lấy `first()`).
- **Bảng** (V/shift/list.blade.php):
  - Cột **CA LÀM** (rowspan): tên ca, `(giờ bắt đầu - giờ kết thúc)`; menu ⋮ "Thêm nhân viên" (quyền `show-pop-staff`) → `index.showModalStaff('', shift_id, start_time, end_time)` (mục 6) (V/shift/list:21-49).
  - Cột **NHÂN VIÊN**: avatar, tên (link `admin.staff.show`), phòng ban, chi nhánh trực thuộc; menu ⋮ "Xoá" (quyền `remove-staff-by-shift`) → `index.removeStaffByShift(staff_id, shift_id, start_time, end_time)` (mục 6.4) (V/shift/list:59-126). Lưu ý điều kiện avatar dùng nhầm `$v['staff_avatar']` (của ca) thay vì `$v1` (V/shift/list:63).
  - Cột ngày: ô có ca → tô màu theo cùng thuật toán mục 1.5 nhưng **bảng màu nhạt khác**: chưa đến ca `#D3D3D3`, có lương `#D9DCF0`, không lương `#EBD4EF`, đúng giờ `#DBEFDC`, chưa vào/ra `#FDD9D7`, trễ/sớm `#FFEACC` (V/shift/list:129-239). Giờ check-in/out chỉ hiện khi `working_day + working_time <= now` (theo phút) (V/shift/list:319). Chú thích màu khớp (V/shift/index:178-183).
  - Menu ⋮ ô ca giống mục 1.6 **trừ**: không có "Duyệt lịch làm việc"/"Confirm working time"; "Chấm công hộ" **không** kiểm tra `time_working_staff_status` (cột này không được select trong `getTimeWorkingByShift`) (V/shift/list:273-282); nghỉ có/không lương yêu cầu `is_close == 0 && is_check_in == 0 && is_check_out == 0` (V/shift/list:283).
  - Ô trống: nút "+" (quyền `show-pop-shift`) **chỉ hiện nếu ca được phép làm vào thứ đó** (`sf_shifts.is_monday..is_sunday == 1`) → `index.showModalShift(staff_id, ngày, 'list', shift_id, is_holiday)` (truyền `focus_shift_id` = ca của dòng) (V/shift/list:363-446).
  - Ca không có NV → 1 dòng trống (V/shift/list:451-460).

---

### 3. Bảng DB và ý nghĩa cột

#### 3.1 `sf_time_working_staffs` — 1 bản ghi = 1 ca làm việc của 1 NV trong 1 ngày
Model `M` (`$table` M:20, PK `time_working_staff_id` M:21). `$fillable` (M:22-61). Model trùng bảng: `Modules/Shift/Models/TimeWorkingStaffsTable.php` (dùng bởi TimekeepingRepo, không dùng ở phần này), `Modules/StaffSalary/Models/TimeWorkingStaffsTable.php`, `Modules/TimeOffDays/Models/TimeWorkingStaffsTable.php`.

| Cột | Ý nghĩa / giá trị (suy từ code) |
|---|---|
| `staff_id`, `shift_id`, `branch_id` | NV, ca (`sf_shifts`), chi nhánh làm việc của ca này (không phải chi nhánh trực thuộc NV). |
| `work_schedule_id` | Lịch làm việc sinh ra bản ghi; tạo từ màn này luôn `0` (R:796, 1566, 2301, 2583, 2968). |
| `working_day`, `working_time` | Ngày + giờ bắt đầu ca. |
| `working_end_day`, `working_end_time` | Ngày + giờ kết thúc (ca qua đêm → ngày hôm sau, R:768-777). |
| `start_working_format_day/week/month/year` | Tách sẵn ngày (d), tuần ISO, tháng (m), năm (Y) của `working_day` để lọc nhanh. |
| `is_ot` | 1 = ca tăng ca; 0 = ca thường. |
| `overtime_type` | Khi OT: `S` = tính theo **Ca**, `H` = tính theo **Giờ** (V/pop/list-shift:58-61; V/pop/pop-detail:54-64). Null nếu không OT (R:800). |
| `timekeeping_coefficient` | Hệ số công. |
| `time_work` | Số giờ làm của ca (giờ). |
| `min_time_work` | "Số giờ làm tối thiểu tính đủ công". |
| `is_check_in`, `is_check_out` | 1 = đã vào/ra ca. Ngoài ra có `is_check_in_1..3`, `is_check_out_1..3`, `check_in_date[_n]`, `check_out_date[_n]`, `check_in_by[_n]`, `check_out_[n_]by` cho ca nhiều lượt chấm (R:1958-2027). |
| `checking_type` | Số lượt chấm công yêu cầu của ca (1..5) lấy từ `sf_shifts.checking_type`; `0` = **không cần chấm công** (R:2325). |
| `is_deducted` | `null` = bình thường; `0` = **nghỉ có lương**; `1` = **nghỉ không lương** (R:998-1002). |
| `is_off` | `0` = có đi làm (R:1089). |
| `is_close` | `1` = đã chốt lương (set ở `StaffSalaryController.php:278`); khi đã chốt ẩn Chỉnh sửa/Chấm hộ/Nghỉ. |
| `is_deleted` | Xoá mềm = 1. |
| `time_working_staff_status` | `waiting` = chờ quản lý duyệt lịch; `approved` = đã duyệt (cho phép chấm công/chấm hộ); `not-confirm` = chờ xác nhận giờ thực tế; `confirmed` = đã xác nhận giờ thực tế (R:3386, 3394, 3444, 3455, 2031; M:785). Ai chuyển `approved → not-confirm` không nằm trong phần này (chưa xác định — nhiều khả năng app NV khi check-out). |
| `actual_time_work` | Giờ làm thực tế (tính từ chấm công). |
| `actual_time_work_confirmed` | Giờ thực tế được quản lý xác nhận (dùng tính lương — suy luận). |
| `approved_manual_time_by`, `approved_actual_time_by` | Người chấm hộ / người xác nhận giờ thực tế. |
| `is_approve_late`, `is_approve_soon`, `approve_late_by`, `approve_soon_by`, `number_late_time`, `number_time_back_soon` | Duyệt đi trễ/về sớm và số phút trễ/sớm — **không được ghi ở màn này** (chức năng duyệt nằm ở `attendances.approve`). |
| `time_off_days_id` | Đơn nghỉ phép liên kết (`time_off_days`), gán bởi module TimeOffDays (TimeOffDaysController.php:217, 719). |
| `shift_code_approved` | Mã loại ca (vd `P` phép năm, `1/2` nửa ngày phép, `OT`...) — dùng cho báo cáo phép. |
| `working_place_id`, `working_place_type` | Địa điểm chấm công; màn này ghi `working_place_type='branch'`. |
| `latitude[_1..4]`, `longitude[_1..4]` | Toạ độ chấm công copy từ cấu hình chấm công của chi nhánh (`TimekeepingConfigTable::getInfo(branch_id)`, R:781, 811-820). |
| `note`, `created_at/by`, `updated_at/by` | |

**Lưu ý quan trọng về `$fillable`**: các hàm dùng `->insert()` (addShift, addStaff, addShiftByStaff, addShiftFlexible) bỏ qua fillable nên ghi đủ cột. Riêng `storeOvertime` dùng `add()` = `create()` (M:524-527) → các cột **không có trong fillable bị bỏ qua âm thầm**: `created_by`, `working_place_id`, `working_place_type`, `shift_code_approved`, `check_in_date`, `check_out_date`, `actual_time_work_0`, **`time_working_staff_status`** (R:2289-2331). Hệ quả: ca OT tạo ra có status = giá trị mặc định của DB (chưa xác định), dù code định gán `confirmed`/`approved`.

#### 3.2 Các bảng phụ
| Bảng | Model | Cột / ghi chú |
|---|---|---|
| `sf_check_in_log` | `ShiftCheckInLogTable` (fillable ShiftCheckInLogTable.php:22-36) | `time_working_staff_id, staff_id, branch_id, shift_id, check_in_day, check_in_time, status ('ok'), reason, created_type ('staff' = NV tự chấm qua app, 'admin' = chấm hộ), created_by`; còn có `timekeeping_type, latitude, longitude, image_selfie` (select ở :295-307). Fillable **thiếu** `working_place_type, working_place_id, timekeeping_type, checking_curent_step` → khi chấm hộ các giá trị này bị bỏ qua (R:1853-1870). |
| `sf_check_out_log` | `ShiftCheckOutLogTable` (fillable :19-33) | Tương tự check-in. |
| `sf_check_in_change_log` | `CheckInChangeLogTable` (:16-39) | Lưu `*_old` / `*_new` (`check_in_day, check_in_time, status, reason, created_type, created_by`) mỗi lần admin sửa check-in đã có. |
| `sf_check_out_change_log` | `CheckOutChangeLogTable` | Tương tự cho check-out. |
| `sf_time_working_staff_change_log` | `TimeWorkingStaffChangeLogTable` (:17-33) | `is_deducted_old/new, is_ot_old/new, is_off_old/new, note_old/new, created_by`. Phần này **chỉ đọc** (pop-detail), không có chỗ nào ghi. |
| `sf_time_working_staffs_action_log` | `TimeWorkingStaffActionLogTable` (:10-20) | `time_working_staff_id, action_type ('update-status'), action_name ('Duyệt lịch làm việc' / 'Xác nhận lịch làm việc'), action_data (JSON dữ liệu update), created_by, created_at` (R:3356-3371). |
| `sf_time_working_staff_recompense` | `TimeWorkingStaffRecompenseTable` (:18-29) | Thưởng/phạt gắn ca: `time_working_staff_id, recompense_id, money, created_by, updated_by`. Xoá = **xoá cứng** (:69-72). |
| `sf_recompense` | `RecompenseTable` (:18-31) | Danh mục thưởng/phạt: `recompense_name`, `type` (`R` thưởng, `P` phạt), `is_system, is_actived, is_deleted`. |
| `sf_leave_day` | `LeaveDayTable` (:17-29) | Quỹ phép năm: `staff_id, shift_code ('P'), total_leave_day, total_using_leave_day, total_using_remaining_day, staff_leave_day_year`. |
| `sf_config_general` | `ConfigGeneralTable` | Code: `late_check_in, off_check_in, back_soon_check_out, off_check_out, admin_confirm_work_schedule`. |
| `sf_map_shift_branch` | `MapShiftBranchTable` | Chi nhánh được phép của ca. |
| `staff_holiday` | `StaffHolidayTable` | Ngày lễ. |
| `time_off_days` | (join) | `is_approve`: 1 chấp nhận / 0 từ chối / null chờ. |
| `staffs` | | `staff_manager_id` = quản lý trực tiếp (người duyệt/xác nhận lịch). |
| `staff_salary_config.staff_salary_type_code` | (join StaffTable.php:105-118) | `hourly`, `monthly` → khoá "Tính tăng ca theo" (xem mục 4). |

---

### 4. Popup "DANH SÁCH CA" — thêm ca cho 1 NV vào 1 ngày

- **Mở từ**: nút "+" ô trống / "Thêm ca làm việc" trong menu ô ca / nút "+" trong popup Ca của tôi.
- **JS** `index.showModalShift(staffId, workingDay, view, focusShiftId, isHoliday)` (JS:34-91): nếu `isHoliday == 1` hỏi xác nhận "Ca làm việc rơi vào ngày lễ bạn có muốn thêm ca làm việc cho nhân viên?" trước. Gọi `POST show-pop-shift` (`staff_id, working_day, view, focus_shift_id`), chèn `#my-modal`, mở `#modal-add-shift`, khởi tạo PioTable `list-shift` và tự tìm.
- **Backend** `R@showPopupShift` (R:429-461): xoá session `shift_temp`; lấy thứ của ngày; lấy `staff_salary_type_code` của NV; render `V/pop/pop-shift.blade.php`.
- **Form lọc** (V/pop/pop-shift:12-28): `search` "Nhập tên ca" (like `shift_name`); hidden `day_name`, `focus_shift_id`, `staff_salary_type_code`, `staff_id`.
- **Danh sách** `C@listShiftAction` → `R@listShift` (R:511-577) → `V/pop/list-shift.blade.php`:
  - Chỉ ca `is_actived=1`, `is_deleted=0`, **được làm vào thứ đó** (`is_<thứ>=1`), nếu có `focus_shift_id` chỉ đúng ca đó (ShiftTable.php:118-156). Phân trang 10.
  - Chi nhánh mỗi ca = `sf_map_shift_branch` của ca **giao với** chi nhánh NV được phân quyền (`Helper::getPermissionStaffBranch(staff_id)`, app/Helpers/Helper.php:108-112) (R:515-565). NV không có quyền chi nhánh nào → dropdown rỗng.
  - `is_disable_ot_type = 1` nếu lương NV `hourly`/`monthly`, `0` nếu loại khác, `null` nếu chưa cấu hình lương (R:524-532).
- **Cột bảng** (V/pop/list-shift:5-11): `#`, **CHỌN** (checkbox `.check_shift`), **TÊN CA** (tên + giờ), **CHI NHÁNH** (select `.branch_id`, disabled đến khi chọn), **TĂNG CA** (checkbox `.check_ot`, disabled đến khi chọn), **TÍNH TĂNG CA THEO** (select `.overtime_type`: `S` "Ca", `H` "Giờ"; chỉ enable khi tick OT và `is_disable_ot_type == 0` — JS:132-166; mặc định chọn `S` nếu `is_disable_ot_type==0`, `H` nếu `==1`), **HỆ SỐ CÔNG** (input `.timekeeping_coefficient`, AutoNumeric 1 chữ số thập phân, min 0, mặc định = `sf_shifts.timekeeping_coefficient`).
  - Nếu có `focus_shift_id` → tự tick ca (V/pop/list-shift:90-93).
  - Bỏ chọn ca → disable chi nhánh/OT/loại OT và bỏ tick OT (JS:114-120).
- **Nút CHỌN** → `index.submitAddShift(staffId, workingDay, view)` (JS:167-246): gom các dòng được tick thành `arr_shift[] = {shift_id, branch_id, is_ot, overtime_type, timekeeping_coefficient}`, POST `add-shift` kèm `staff_id, working_day, date_type, date_object`. Thành công: đóng popup, refresh bảng (nếu URL chứa `shift/timekeeping/detail-staff` thì reload trang); view `my_shift` thì reload popup Ca của tôi.
- **Backend `R@addShift`** (R:722-891), trong transaction:
  1. `arr_shift` rỗng → "Hãy chọn ca làm việc" (R:731-736).
  2. Bất kỳ `timekeeping_coefficient <= 0` → "Hệ số công của ca thường phải lớn hơn 0" (R:738-745).
  3. `validateShift` (R:901-982): lấy thông tin từng ca; chi nhánh rỗng → "Chi nhánh làm việc không được để trống"; các ca được chọn **trùng giờ nhau** (so `start_work_time/end_work_time` dạng chuỗi, tính cả chạm biên) → "Ca làm việc có thời gian trùng".
  4. Với mỗi ca: `working_day` = ngày chọn; `working_time` = giờ bắt đầu ca; nếu giờ bắt đầu > giờ kết thúc (qua đêm) → `working_end_day` = ngày + khoảng phút (R:768-777); copy toạ độ từ cấu hình chấm công chi nhánh; `time_work`, `min_time_work` từ ca; `overtime_type` chỉ khi `is_ot=1`; `time_working_staff_status` = `'confirmed'` nếu `checking_type == 0` ngược lại `'approved'` (R:809 — thực tế input không gửi `checking_type` nên luôn `approved`); `checking_type` = `sf_shifts.checking_type ?? 1` (R:821, ghi đè key ở R:808); `shift_code_approved` = mã ca.
  5. Nếu mã ca là `P` (phép, trừ 1 ngày) hoặc `1/2` (trừ 0.5 ngày) → cập nhật/khởi tạo `sf_leave_day` năm đó: có bản ghi thì `total_using_leave_day += n`, `total_using_remaining_day -= n`; chưa có thì tạo `total_leave_day = 12`, đã dùng n, còn lại 12−n, năm = `date('Y')` (R:824-860). Kiểm tra "Số lượng ngày phép còn lại không đủ" **không bao giờ chạy** do viết sai tên biến `$InfoLeaveDay` (R:830). **Thêm nữa**: `ShiftTable::getInfo` không select cột `shift_code` (ShiftTable.php:179-214) → `shift_code` luôn null → `shift_code_approved` = null và toàn bộ nhánh trừ phép **không bao giờ chạy** từ màn này.
  6. `WorkScheduleRepo::validateWorkScheduleDiff($timeWorkingStaff)` — trùng giờ với lịch khác → "Thời gian làm việc đã trùng với lịch khác" (R:864-872; logic nằm ở WorkScheduleRepo, ngoài phạm vi).
  7. `insert` vào `sf_time_working_staffs`; commit → "Thêm ca thành công". Lỗi → "Thêm ca làm việc thất bại".
- Không chặn ngày quá khứ, không chặn ngày lễ (chỉ cảnh báo ở JS).

### 5. Popup "DANH SÁCH CA" — thêm ca cho NV cả tuần/tháng (menu "Thêm ca" cạnh tên NV)
- JS `index.showModalShiftStaff(staffId, '0', 'list', null, '0')` (JS:1290-1312) → POST `show-pop-shift-staff` → `R@showPopupShiftStaff` (R:471-501) render `V/pop/pop-shift-staff.blade.php` (danh sách ca được include sẵn, JS không auto search). `working_day` truyền `'0'`, `day_name` tính từ `Carbon::parse('0')` (giá trị không có nghĩa — chưa xác định).
- Danh sách `R@listShiftStaff` (R:587-633): mọi ca `is_actived=1` (lần đầu không lọc thứ), **chi nhánh = toàn bộ chi nhánh của ca** (không giao với quyền chi nhánh NV). Phân trang qua `list-shift-staff` (C:365-380) có lọc `day_name`. Cùng view `V/pop/list-shift.blade.php` (cột như mục 4).
- Nút **CHỌN** → `index.submitAddShiftByStaff` (JS:247-314) → POST `add-shift-staff` (`staff_id, working_day, date_type, date_object, arr_shift`).
- **Backend `R@addShiftByStaff`** (R:2489-2701):
  - Duyệt từng ca được chọn × từng ngày của **tuần** (`setISODate(date('Y'), date_object)` + 0..6) hoặc **tháng** (`date('Y')-date_object-01` đến cuối tháng). **Luôn dùng năm hiện tại** (`date('Y')`), bỏ qua bộ lọc Năm (R:2516-2536).
  - `checkShiftExistByStaff` (R:2703-2807): bỏ ngày ca không được làm theo thứ; bỏ ngày NV đã có ca chồng giờ (`M@checkValidateTimeWorkingStaff` M:919-931 — so khoảng `CONCAT(working_day,' ',working_time)` chứa thời điểm bắt đầu hoặc kết thúc mới); bỏ ngày lễ.
  - Ngày hợp lệ → tạo bản ghi như mục 4 (status `approved`, `checking_type` = của ca, toạ độ chi nhánh).
  - Tham chiếu `$v['shift_code']` (R:2597, 2610) trong khi input không gửi `shift_code` → PHP "Undefined index" → nhiều khả năng **luôn lỗi** và trả message lỗi PHP (R:2697) — cần kiểm chứng.
  - Kiểm tra chồng giờ giữa các bản ghi sắp thêm cùng chi nhánh/ngày → "Thời gian làm việc đã trùng với lịch khác" (R:2645-2680). Không có bản ghi nào → "Không có ca làm việc phù hợp để thêm" (R:2685). Thành công → "Thêm ca thành công".
  - Nhánh trừ phép P/1/2: cùng lỗi tên biến `$InfoLeaveDay` (R:2613, 2621, 2627) → luôn đi nhánh tạo mới `sf_leave_day` (R:2630-2638).

### 6. Popup "THÊM NHÂN VIÊN VÀO CA" (màn theo ca)
- JS `index.showModalStaff('', shiftId, start_time, end_time)` (JS:597-623) → POST `show-pop-staff` → `R@showPopupStaff` (R:1223-1263) → `V/pop/pop-staff.blade.php`. Hiển thị "Ca làm việc: {tên}", "Thời gian: dd/mm/YYYY - dd/mm/YYYY" (khoảng đang xem).
- **Bộ lọc** (R:1272-1304): `staffs$branch_id` (Chọn chi nhánh), `staffs$department_id` (Chọn phòng ban), `staffs$staff_id` (Chọn nhân viên); hidden `timekeeping_coefficient` = hệ số công của ca, `shift_id`, `staff_have_schedule[]` (NV đã có lịch trong khoảng — **không được dùng để lọc**, điều kiện bị comment StaffTable.php:62-64).
- **Danh sách** `R@listStaff` (R:1314-1333) → `V/pop/list-staff.blade.php`: cột `#`, **HÀNH ĐỘNG** (checkbox chọn), **TĂNG CA** (checkbox), **CHI NHÁNH LÀM VIỆC** (select chi nhánh của ca; mặc định chi nhánh trực thuộc NV nếu trùng), **TÊN NHÂN VIÊN**, **CHI NHÁNH TRỰC THUỘC**, **PHÒNG BAN**, **HỆ SỐ CÔNG** (input, mặc định hệ số của ca). Liệt kê cả NV không active (không truyền `is_actived`).
- Nút **CHỌN** → `index.submitAddStaff` (JS:683-730) → POST `add-staff` (`shift_id, start_time, end_time, arr_staff[]{staff_id, is_ot, branch_id, timekeeping_coefficient}`).
- **Backend `R@addStaff`** (R:1418-1618), transaction:
  - Không chọn NV → "Hãy chọn nhân viên làm việc".
  - Ca mã `P` hoặc `1/2` → "Ca làm việc không hợp lệ" (R:1441-1446; thực tế không kích hoạt vì `shift_code` không được select).
  - Chỉ chạy khi khoảng ngày > 0 ngày (`$diffDate > 0`, R:1473). Mỗi ngày × NV: bỏ thứ ca không làm, bỏ nếu NV đã có ca chồng giờ, bỏ ngày lễ; còn lại insert từng dòng: `staff_id, shift_id, branch_id, working_day/time, start_working_format_*, working_end_day/time, work_schedule_id=0, is_ot, min_time_work, time_work, timekeeping_coefficient, created_at, updated_at` (R:1554-1575). **Không** ghi `time_working_staff_status`, `checking_type`, `shift_code_approved`, toạ độ, `created_by` (khác với addShift).
  - Không validate hệ số công > 0. Thành công → "Thêm nhân viên thành công".

#### 6.4 Xoá nhân viên khỏi ca (màn theo ca)
- JS `index.removeStaffByShift` (JS:562-596): confirm "Bạn có muốn xóa không nhân viên này không?" → POST `remove-staff-by-shift` (`staff_id, shift_id, start_time, end_time`).
- `R@removeStaffByShift` (R:1187-1213): nếu NV có ca nào trong khoảng đã check-in hoặc check-out (`M@getApplyByShift` M:694-722) → "Lịch làm việc này đã được sử dụng, bạn không thể xoá nhân viên này". Ngược lại **xoá cứng** (`delete()`) mọi bản ghi của NV + ca trong khoảng ngày (M:733-739), **kể cả bản ghi `is_deleted=1`**, không trừ/hoàn phép. → "Xoá thành công".

### 7. Popup "CA LÀM" (Ca của tôi — xem nhiều ca trong 1 ngày)
- Mở từ link "n Ca" trong ô ≥2 ca. JS `index.showModalMyShift` (JS:532-547) → POST `show-pop-my-shift` → `R@showPopupMyShift` (R:1117-1143) → `V/pop/pop-my-shift.blade.php` include `V/pop/list-my-shift.blade.php`. Reload phần thân qua `list-my-shift` (`R@listMyShift` R:1153-1179, JS:548-561).
- Dữ liệu `M@getTimeWorkingByStaff` (M:227-277): như mục 1.3 nhưng **chỉ ca `is_actived=1`**.
- Mỗi ca là 1 thẻ màu (bảng màu nhạt như mục 2), viền đỏ nếu OT; tên ca, giờ chấm/giờ ca, chi nhánh (V/pop/list-my-shift:121-214).
- Menu ⋮ mỗi thẻ (V/pop/list-my-shift:133-186): Chi tiết; Chỉnh sửa (ngày ≥ hôm nay, chưa chốt, chưa check-in); Chấm công hộ (quyền, ngày ≤ hôm nay, chưa chốt, thiếu vào/ra, `is_deducted == null` — so sánh lỏng nên `0` cũng thoả; không check status); **Nghỉ có lương / Nghỉ không lương đều hiện khi `is_deducted == null || == 0`** (khác màn chính); "Nghỉ không lương" truyền `view='list'` thay vì `'my_shift'` (V/pop/list-my-shift:163); Thêm công việc (view `my_shift`); Làm thêm giờ; Xoá.
- Nút "+" cuối danh sách (quyền `show-pop-shift` **và** ngày ≥ hôm nay) → `index.showModalShift(staff_id, ngày, 'my_shift', null, is_holiday)` (V/pop/list-my-shift:217-226).
- Footer: nút HỦY.

### 8. Xoá ca làm việc
- JS `index.remove(id, view)` (JS:449-489): confirm "Bạn có muốn xóa không?" → POST `remove-shift`.
- `R@removeShift` (R:1026-1076):
  - **Xoá mềm**: `is_deleted = 1`, `updated_by` (R:1040-1043). Không kiểm tra đã check-in/out (đoạn kiểm tra bị comment R:1030-1037), không kiểm tra `is_close`.
  - Nếu `shift_code_approved` là `P`/`1/2`: cập nhật `sf_leave_day` **cộng thêm** số ngày đã dùng và **trừ** số ngày còn lại (R:1049-1062) — tức xoá ca phép lại trừ phép thêm lần nữa thay vì hoàn trả (bug logic).
  - Không xoá log check-in/out, không xoá thưởng/phạt.
  - Trả "Xoá thành công" + `info` (để reload popup Ca của tôi).

### 9. Popup "CHI TIẾT NGÀY LÀM VIỆC"
- JS `index.showTimeWorkingDetail(id, view)` (JS:731-761) → POST `show-time-working-detail` → `R@showTimeWorkingDetail` (R:1628-1682) → `V/pop/pop-detail.blade.php`. Đồng thời khởi tạo 2 PioTable cho tab Thưởng và Phạt (`list-recompense`).
- **Thông tin (readonly)** (V/pop/pop-detail:11-67): Tên nhân viên, Tên ca làm, Giờ làm (`time_work`), Hệ số công, Ngày làm (d/m/Y), Vị trí làm (chi nhánh), Số giờ làm tối thiểu tính đủ công, Tăng ca (checkbox disabled), Tính tăng ca theo (`S`→Ca, `H`→Giờ).
- **Tab "Danh sách công việc"**: công việc ManagerWork của NV có `created_at` = ngày làm (`Modules/Shift/Models/ManagerWorkTable::getListWork`, R:1651-1658). Cột: #, Tiêu đề (link `/manager-work/detail/{id}`), Loại công việc, Trạng thái (badge màu `manage_color_code`), Người thực hiện, Ngày hết hạn (V/pop/pop-detail:97-137).
- **Tab "Thưởng"** / **"Phạt vi phạm"**: nút "Thêm hình thức thưởng"/"Thêm hình thức phạt" → mục 16; danh sách `V/pop/list-reward.blade.php` / `list-punishment.blade.php` (cột #, Loại thưởng/Loại vi phạm, Mức áp dụng (format `config.decimal_number`), Hành động: xoá).
- **Tab "Lịch sử chấm công"** (V/pop/pop-detail:203-276): dòng 1 = giờ vào/ra hiện tại (d/m/Y H:i) + icon nguồn (📱 staff / 👤 admin) hoặc `--:--`; dòng 2 (gạch ngang) = giá trị **cũ** gần nhất từ `sf_check_in_change_log`/`sf_check_out_change_log` nếu có log.
- `is_to_work` được tính (đã qua giờ làm) nhưng view không dùng. Lỗi → `dd()` (R:1680).
- Nút LƯU bị comment; chỉ có HỦY.

### 10. Nghỉ có lương / Nghỉ không lương
- JS `index.paidOrUnPaidLeave(id, type, view)` (JS:315-361): confirm "Bạn có muốn điều chỉnh không?" → POST `paid-or-unpaid-leave` (`time_working_staff_id`, `type` = `paid`|`unpaid`). View `salary-detail` thì submit lại form lọc (dùng từ màn lương).
- `R@paidLeave` (R:990-1018): `paid` → `is_deducted = 0`; `unpaid` → `is_deducted = 1`; chỉ update cột này. Không ghi log, không đụng `sf_leave_day`. → "Điều chỉnh thành công".
- Ảnh hưởng: ô chuyển màu nghỉ có lương/không lương; ẩn "Chấm công hộ", "Duyệt", "Confirm" (các mục này yêu cầu `is_deducted === null`). Tác động đến tính lương nằm ở module lương (ngoài phạm vi).
- **"Có đi làm"** (`is-work`, R:1084-1107): đặt `is_off = 0`, `is_deducted = 0` — **không có nút gọi** trong view.

### 11. Popup "CHỈNH SỬA NGÀY LÀM VIỆC"
- Hiện khi `working_day >= hôm nay`, `is_close == 0`, `is_check_in == 0`. JS `index.showModalEdit` (JS:892-924) → POST `show-pop-edit` → `R@getDataViewEdit` (R:2167-2198) → `V/pop/pop-edit.blade.php`.
- **Field** (V/pop/pop-edit:11-57):

| Label | name/id | Kiểu | Mặc định | Validate JS (JS:929-967) | Validate BE |
|---|---|---|---|---|---|
| Tên nhân viên | — | text disabled | | | |
| Tên ca làm | — | text disabled | | | |
| Vị trí làm * | `branch_id` | select2 | chi nhánh hiện tại; option = chi nhánh của ca ∩ chi nhánh NV được phân quyền (nếu NV có quyền) | required "Hãy chọn chi nhánh" | `ReqUpd`: required "Hãy chọn chi nhánh" (ReqUpd:33, 47) |
| Hệ số công * | `timekeeping_coefficient` | AutoNumeric 2 số lẻ, min 0; **disabled nếu ca không OT** | giá trị hiện tại | required + `min: 1` "Hệ số công tối thiểu 1" | required "Hãy nhập hệ số công"; repo: `<= 0` → "Hệ số công phải lớn 0" (R:1713-1718) |
| Số giờ làm tối thiểu tính đủ công | `min_time_work` | AutoNumeric 2 số lẻ | hiện tại | required "Hãy nhập số giờ làm" | required (ReqUpd:34, 48) |
| Thời gian làm việc bắt đầu * | `time_start` | datetimepicker `dd/mm/yyyy hh:ii` | `working_day working_time` | required | required; format `d/m/Y H:i` |
| Thời gian làm việc kết thúc * | `time_end` | datetimepicker | `working_end_day working_end_time` | required "Hãy chọn ngày kết thúc" | required |

- Nút LƯU → `index.submitUpdateTimeWorking` (JS:926-1023) → POST `update-time-working` (bỏ dấu phẩy nghìn).
- **Backend `R@updateTimeWorking`** (R:1692-1791):
  - `time_start >= time_end` → "Ngày bắt đầu phải lớn hơn ngày kết thúc" (message ngược nghĩa, R:1704-1710).
  - Hệ số công `<= 0` → lỗi.
  - Nếu ca có giờ nghỉ trưa (`sf_shifts.start_lunch_break`, `end_lunch_break`): `time_work = (end − start)/60 − thời lượng nghỉ trưa`; `> 24` → "Thời gian làm việc đã vượt quá 24 giờ". Không có nghỉ trưa → `time_work = (end − start)/60` (không giới hạn 24h) (R:1727-1743).
  - `M@checkTimeWorkingStaff` (M:359-388): trùng với ca khác của NV cùng ngày bắt đầu (so giờ `working_time < end AND working_end_time > start+1 phút`, loại trừ chính bản ghi) → "Thời gian làm việc đã trùng với lịch khác".
  - Update: `branch_id, min_time_work, timekeeping_coefficient, working_day, working_time, start_working_format_*, working_end_day, working_end_time, time_work` (R:1764-1777). **Không** cập nhật lại toạ độ chấm công theo chi nhánh mới, không ghi log thay đổi.
  - Thành công "Chỉnh sửa thành công"; lỗi "Chỉnh sửa thất bại - {message} - {line}".

### 12. Popup "CHẤM CÔNG HỘ"
- Hiện ở màn theo NV khi: quyền `show-pop-time-attendance`, `working_day <= hôm nay`, `is_close == 0`, thiếu vào hoặc ra, `is_deducted === null`, `status == 'approved'` (V/week/list:252-259).
- JS `index.showModalTimeAttendance` (JS:818-840) → POST `show-pop-time-attendance` → `R@showPopTimeAttendance` (R:1801-1824) → `V/pop/pop-time-attendance.blade.php`.
- **Field** (V/pop/pop-time-attendance:11-72):

| Label | id/name | Kiểu | Mặc định |
|---|---|---|---|
| Nhân viên | `staff` | disabled | tên NV |
| Tên ca | `staff` (trùng id) | disabled | |
| Thời gian bắt đầu | `check_in_day` | disabled | ngày làm d/m/Y |
| Giờ vào ca * | `check_in_time` | timepicker `HH:ii`, bước 5 phút, 24h | giờ bắt đầu ca |
| Thời gian kết thúc | `check_out_day` | disabled | ngày kết thúc d/m/Y |
| Giờ ra ca (null if not check out) | `check_out_time` | timepicker | giờ kết thúc ca |
| (ẩn) | `lock_check_in`, `lock_check_out` | hidden | 1 nếu log hiện có do NV tự chấm (`created_type='staff'`) |

- Không có validate JS. JS gửi thêm `lock_check_in/out`, `check_in_day/out_day` nhưng backend **không dùng**. Hai hàm `_validateCheckInTime` (không cho vào sớm ≥3h hoặc sau giờ tan ca) và `_validateCheckOutTime` (không cho ra trước giờ vào hoặc trễ ≥3h) (R:2080-2157) là **code chết**, không được gọi.
- **Backend `R@submitTimeAttendance`** (R:1834-2071), transaction:
  1. Ghi đè tạm `working_time = check_in_time:00`, `working_end_time = check_out_time:00` (giờ lấy từ form; **ngày** vẫn là `working_day` / `working_end_day` của ca) (R:1844-1845).
  2. Chỉ cho phép khi `time_working_staff_status == 'approved'`, ngược lại "Ca làm việc chưa được phê duyệt, vui lòng phê duyệt ca làm việc trước" (R:1847, 2055-2060).
  3. **Check-in**: chưa có log → insert `sf_check_in_log` (`status='ok'`, `reason='Chấm công hộ'`, `created_type='admin'`, `created_by`); đã có → ghi `sf_check_in_change_log` (giá trị cũ/mới) rồi update log (`check_in_day/time`, `created_type='admin'`, `created_by`) (R:1849-1899). Như vậy chấm hộ **ghi đè cả check-in do NV tự chấm** (`lock_check_in` không có tác dụng).
  4. **Check-out**: chỉ khi `check_out_time` khác rỗng — insert/ghi log tương tự với `sf_check_out_log` / `sf_check_out_change_log` (R:1902-1953).
  5. Cập nhật `sf_time_working_staffs` (R:1955-2035): với i = 1..`checking_type` đặt `is_check_in[_n]=1`, `check_in_by[_n]`, `check_in_date[_n]` (= ngày làm + giờ vào); nếu có giờ ra thì `is_check_out[_n]=1`, `check_out_[n_]by`, `check_out_date[_n]`. Luôn `approved_manual_time_by = user`. Nếu có giờ ra: `approved_actual_time_by = user`, **`time_working_staff_status = 'confirmed'`**, `actual_time_work = actual_time_work_confirmed = round(phút(vào→ra)/60, 2)` (không trừ nghỉ trưa).
     - Nếu `checking_type = 0` thì vòng lặp không chạy → không set `is_check_in` (biên).
  6. Gửi thông báo cho NV (`NotificationRepositoryInterface::insertLogNoti`): title "Chấm công hộ", message "Lịch làm việc ngày {d/m/Y} của bạn đã được chấm công hộ.", action `time_working_staff_detail` (R:2037-2047).
  7. "Chấm công hộ thành công" / lỗi "Chấm công hộ thất bại".
- **Không tính số phút đi trễ/về sớm** (`number_late_time`, `number_time_back_soon`) ở đây.

### 13. Duyệt lịch làm việc
- Điều kiện hiện nút (chỉ bản tuần): người đăng nhập là `staff_manager_id` của NV, `is_deducted === null`, status `waiting`.
- JS `index.approveWorkSchedule` (JS:362-401): confirm "Bạn có muốn duyệt lịch làm việc không?" → POST `approve-work-schedule`.
- `R@approveWorkSchedule` (R:3379-3423): status ≠ `waiting` → "Ca làm việc không ở trạng thái chờ duyệt". **Backend không kiểm tra người duyệt có phải quản lý** (gọi trực tiếp vẫn duyệt được). Update `time_working_staff_status='approved'`, `updated_by`, `updated_at`; gửi notification "Phê duyệt lịch làm việc" / "Lịch làm việc ngày :date của bạn đã được phê duyệt."; ghi `sf_time_working_staffs_action_log` (`update-status`, "Duyệt lịch làm việc", JSON dữ liệu). → "Duyệt lịch làm việc thành công."
- Nguồn gốc bản ghi `waiting`: không được tạo từ màn này (màn này tạo `approved`) — chưa xác định (có thể từ app NV đăng ký ca).

### 14. Xác nhận giờ làm việc thực tế ("Confirm working time")
- Điều kiện hiện: (quản lý trực tiếp hoặc admin + cấu hình `admin_confirm_work_schedule` bật), `is_deducted === null`, status `not-confirm`.
- JS `index.confirmWorkSchedule(id, view, actualTimeWork)` (JS:402-448): SweetAlert tiêu đề "Xác nhận lịch làm việc", 1 input số **"Giờ làm việc thực tế"** (`#swal-actual-time-work`, `type=number step=0.01 min=0`, mặc định = `actual_time_work`). Không validate thêm.
- `R@confirmWorkSchedule` (R:3431-3487): **có kiểm tra quyền** — `canConfirmWorkSchedule(staff_manager_id)` (R:3512-3519: là quản lý trực tiếp hoặc `isAdminConfirmWorkSchedule`) → nếu không: "Bạn không có quyền xác nhận ca làm việc này"; status ≠ `not-confirm` → "Ca làm việc không ở trạng thái chờ xác nhận". Transaction: update `approved_actual_time_by`, `actual_time_work_confirmed = input`, `time_working_staff_status='confirmed'`; notification "Xác nhận lịch làm việc"; action log "Xác nhận lịch làm việc". → "Xác nhận lịch làm việc thành công."

### 15. Popup "LÀM THÊM GIỜ" (OT)
- JS `index.showModalOvertime` (JS:1025-1057) → POST `show-pop-overtime` → `R@getDataViewOvertime` (R:2200-2223) → `V/pop/pop-overtime.blade.php`.
- **Field** (V/pop/pop-overtime:11-56):

| Label | name | Kiểu | Mặc định | Validate JS (JS:1060-1097) | BE `ReqOT` |
|---|---|---|---|---|---|
| Tên nhân viên / Tên ca làm | — | disabled | của ca gốc | | |
| Vị trí làm * | `branch_id` | select2 | chi nhánh ca gốc; option = chi nhánh active trong `Helper::getPermissionStaffBranch(staff)` | required | required "Hãy chọn chi nhánh" |
| Hệ số công * | `timekeeping_coefficient` | AutoNumeric 2 số lẻ | hệ số ca gốc | required, min 1 | required "Hãy nhập hệ số công" |
| Thời gian làm việc bắt đầu * | `time_start` | datetimepicker d/m/Y H:i | **giờ kết thúc ca gốc + 1 phút** | required | required |
| Thời gian làm việc kết thúc * | `time_end` | datetimepicker | rỗng | required | required |
| Không cần chấm công | `is_not_check_in` | checkbox | bỏ tick | | |

- **Backend `R@storeOvertime`** (R:2233-2383), transaction:
  - Bắt đầu ≥ kết thúc → "Ngày bắt đầu phải lớn hơn ngày kết thúc".
  - Ca OT hệ thống = `sf_shifts` có `shift_code='OT'` và `is_system=1` (`SFShiftsTable::getShiftSystemInfo('OT')`, Modules/TimeOffDays/Models/SFShiftsTable.php:78-100).
  - Bắt đầu OT < kết thúc ca gốc → "Ngày bắt đầu ca làm thêm phải nhở hơn ngày kết thúc của ca cũ" (message sai nghĩa) (R:2258-2267).
  - Trùng lịch khác (`checkTimeWorkingStaff`) → "Thời gian làm việc đã trùng với lịch khác".
  - Tạo bản ghi mới: `shift_id` = ca OT hệ thống (0 nếu không có), `branch_id` chọn, `is_ot = 1`, `overtime_type = 'H'` (luôn tính theo giờ), `time_work = min_time_work = actual_time_work = round(phút/60, 2)`, hệ số công nhập.
    - **Tick "Không cần chấm công"**: `is_check_in = is_check_out = 1`, `check_in_by/out_by`, `checking_type = 0`, `actual_time_work_confirmed` = số giờ, status `confirmed`; đồng thời insert `sf_check_in_log` + `sf_check_out_log` (`status ok`, `created_type admin`, `shift_id` = **ca gốc**).
    - Không tick: `checking_type = 1`, status `approved` → NV phải tự chấm công.
    - Do dùng `create()` + `$fillable`, các cột `time_working_staff_status`, `shift_code_approved`, `working_place_*`, `created_by`, `check_in_date`, `check_out_date`, `actual_time_work_0` **không được lưu** (xem 3.1).
  - "Thêm thành công" / "Thêm thất bại".

### 16. Thưởng – phạt trong ngày (trong popup Chi tiết)
- **Danh sách**: PioTable gọi `list-recompense` với `time_working_staff_id`, `type` (`R`/`P`) → `C@listRecompenseAction` (C:709-726) → `TimeWorkingStaffRecompenseTable::getList` (join `sf_recompense`, lọc `r.type`, sort mới nhất) → view thưởng nếu `type == 'R'`, ngược lại view phạt.
- **Popup "THÊM HÌNH THỨC THƯỞNG/PHẠT"**: JS `index.showPopRecompense(id, type)` (JS:1154-1184) → POST `show-pop-create-recompense` → `R@getDataCreateRecompense` (R:2413-2425) → `V/pop/pop-create-recompense.blade.php`:
  - **Loại thưởng/Loại phạt** * — `recompense_id`, select2 placeholder "Hãy chọn loại", option `sf_recompense` theo `type`, `is_actived=1`, `is_deleted=0` (RecompenseTable.php:75-86). JS required "Hãy chọn loại".
  - **Mức áp dụng** * — `money`, AutoNumeric 2 số lẻ, min 0. JS required "Hãy nhập mức áp dụng".
  - LƯU → `index.submitCreateRecompense` (JS:1186-1252) → POST `submit-create-recompense` → `R@submitCreateRecompense` (R:2435-2459): insert `sf_time_working_staff_recompense` (`time_working_staff_id, recompense_id, money, created_by, updated_by`). **Không có validate backend**. → "Thêm thành công", reload tab tương ứng.
- **Xoá**: icon thùng rác → `index.removeRecompense` (JS:1254-1289) confirm → POST `remove-recompense` → xoá cứng (R:2469-2487). Không kiểm tra `is_close`.

### 17. Popup "Ca linh động" (Flexible) — đang ẩn khỏi UI
- Nút mở bị comment ở header và menu NV (V/week/index:73-78; V/week/list:66-68). Route vẫn hoạt động.
- `C@showPopupShiftFlexible` (C:1060-1078) → `V/pop/pop-shift-flexible.blade.php`: lọc **Chi nhánh** (`branch_flexible`), **Phòng ban** (`department_flexible`), **Nhân viên** (`staff_flexible`, select2 ajax `search-staff-flexible` tìm theo tên/email/SĐT, NV active, lọc chi nhánh/phòng ban — StaffTable.php:243-268, R:2851-2863), **Tuần làm việc** (`week_flexible`; số option = `date_object` nếu đang xem theo tuần — C:1063-1066, tức chỉ hiện tuần 1..tuần đang chọn).
- Bảng "Danh sách phân ca" với nút **THÊM PHÂN CA** → `add-row-shift-flexible` render `V/pop/pop-list-shift-flexible.blade.php`: cột **NGÀY LÀM VIỆC** (7 ngày của tuần, `d-m-Y`), **CA LÀM VIỆC** (sau khi chọn ngày, ajax `get-list-shift-flexible` lấy mọi ca active — R:2873-2903), **ĐỊA ĐIỂM LÀM VIỆC** (chi nhánh của ca), **THỜI GIAN BẮT ĐẦU/KẾT THÚC CA** (timepicker, mặc định theo ca), **THỜI GIAN LÀM VIỆC TỐI THIỂU**, **HỆ SỐ CÔNG** (mặc định 1), nút xoá dòng.
- Validate JS (V/pop/pop-shift-flexible:183-218): phải chọn NV ("Chưa nhân viên"), ngày, thời gian tối thiểu, hệ số công > 0 (lưu ý `return` trong `.each` chỉ bỏ qua dòng, không chặn submit). Biến `stt` khai báo trong `$(document).ready` nhưng dùng ở hàm global `addRowShift` → nhiều khả năng lỗi `ReferenceError` (cần kiểm chứng).
- `R@addShiftFlexibleByStaff` (R:2905-2996): giờ kết thúc < bắt đầu → "Thời gian kết thúc phải lớn hơn thời gian bắt đầu" (không hỗ trợ qua đêm); `số giờ < min_work` → "Thời gian làm việc tối thiểu phải nhỏ hơn thời gian làm thực tế"; bỏ qua nếu ca không làm thứ đó / trùng giờ / ngày lễ; insert với giờ tuỳ chỉnh, `is_ot=0`, `time_work` = số giờ thực, `working_end_day = working_day`. Không set status/checking_type/toạ độ.

### 18. Báo cáo & xuất Excel

#### 18.1 Báo cáo phép theo năm — `report-time-working-staff` (C:1135-1475)
- `indexTimeWorkingStaff` render `shift::time-working-staff.report.index`, `listTimeWorkingStaff` render `...report.list` — **thư mục `report/` không tồn tại** trong `Modules/Shift/Resources/views/time-working-staff/` → lỗi "View not found". Repo gọi `StaffTable::getListStaff`, `exportListStaff` và `TimeWorkingStaffTable::getTotalGroupShiftType` — **các method này không tồn tại** trong model module Shift → màn báo cáo **không chạy được**.
- Thiết kế dự kiến (đọc từ code export C:1188-1475): file `report_working_staff_{năm}.xlsx`, trả JSON `{error, file_name, file: base64}`. Tiêu đề "BẢNG CHẤM CÔNG"; cột: STT, Mã NV, Tên nhân viên, Chi nhánh, Phòng ban, Tình trạng (để trống), Quản lý trực tiếp, Năm, Tổng số ngày phép năm, Tổng số ngày phép năm đã nghĩ, Tổng số ngày phép năm còn lại (từ `sf_leave_day` năm đó, R:3009-3013); sau đó 12 nhóm "Tháng 1..12", mỗi nhóm 8 cột theo mã loại nghỉ (`shift_code_approved`) (C:1155-1186): `P` Phép năm, `KL` Nghỉ không hưởng lương, `CD` Nghỉ hiếu hỉ, `S` Nghỉ ốm hưởng chế độ BHXH, `TNLD` Nghỉ tai nạn lao động, `TS` Nghỉ thai sản hưởng chế độ BHXH, `CT` Đi công tác (7 mã; giá trị = `total` nhóm theo tháng, mặc định 0).

#### 18.2 Báo cáo thời gian thực tế — `report-time` (C:1477-1784)
- Cùng tình trạng: view `report.report-time.*` không tồn tại; `getTotalActualGroupMonth` không tồn tại → không chạy.
- Thiết kế export: `report_actual_working_staff_{năm}.xlsx`; cột STT, Mã NV, Tên NV, Chi nhánh, Phòng ban, Tình trạng (trống), Quản lý trực tiếp, Năm, **Tổng thời gian**, **Tổng thời gian làm thêm**, rồi 12 tháng × 2 cột "Tổng thời gian làm việc" / "Tổng thời gian làm thêm" (R:3093-3169). Lỗi → `dd()` (C:1782).

#### 18.3 Xuất lịch làm việc theo tuần/tháng — `export-time-working-staff-action` (GET, C:1785-1789)
- Không có nút trong repo. `R@exportTimeWorkingStaffAction` (R:3302-3355) dùng `getDataTimeWorkingStaff` (R:3170-3297) gọi `StaffTable::getListExportTimeWorkingStaff` và `TimeWorkingStaffTable::getTimeWorkingByArrStaff` — **không tồn tại** → không chạy.
- Thiết kế: file `time-working-staff.xlsx` (Maatwebsite, class `app/Exports/ExportTimeWorkingStaff.php`); dòng heading 1: `_` + tên thứ; heading 2: STT, Chi nhánh, Quản lý, Mã nhân viên, Tên nhân viên, Tình trạng ("Đang làm việc"/"Đã nghỉ việc" theo `is_actived`) + `day_format` từng ngày; ô ngày = danh sách tên ca cách nhau dấu phẩy (chỉ NV đang làm).

#### 18.4 Bảng chấm công tháng — `export-excel-time-working-staff` (C:801-1024)
- Form gọi bị comment. **Tháng/năm cứng `07/2023`** cho phần header (C:804-805) trong khi dữ liệu lấy **tháng trước của năm hiện tại** (`date('m') - 1`, R:2832). Cột: STT, Mã NV (**ghi nhầm số thứ tự**, C:941), HỌ TÊN, D = nhãn "Giờ làm việc"/"Giờ OT", E..AI = ngày 1..31 (dòng 3 = thứ T2..CN, CN màu đỏ), AJ = "Công" = tổng `timekeeping_coefficient`. Ô ngày = tổng `time_work` các ca đã check-in (`M@getExportTimeSheerByMonth` M:933-947); dòng "Giờ OT" để trống. Tên file `cusdebt_monthly.xlsx`. Header luôn vẽ đủ 31 ngày kể cả tháng ngắn (`Carbon::parse` ngày 31/06 sẽ tràn sang tháng sau).

---

### 19. Tổng hợp rule nghiệp vụ chính
1. **Sinh `sf_time_working_staffs`** từ màn này qua 4 đường: thêm ca 1 ngày (`add-shift`), thêm ca cả tuần/tháng cho NV (`add-shift-staff`), thêm NV vào ca theo khoảng (`add-staff`), ca linh động (`add-shift-flexible`), và ca OT (`store-overtime`). Tất cả `work_schedule_id = 0`. Ngày lễ bị bỏ qua ở 3 đường hàng loạt, còn thêm 1 ngày chỉ cảnh báo.
2. **Trạng thái**: tạo từ admin → `approved` (hoặc `confirmed` nếu không cần chấm công). Vòng đời: `waiting` →(quản lý duyệt) `approved` →(chấm công, ngoài phạm vi) `not-confirm` →(quản lý/admin xác nhận giờ thực tế) `confirmed`. Chấm công hộ có giờ ra nhảy thẳng `confirmed`.
3. **Đi trễ / về sớm / nghỉ không lương do trễ-sớm**: chỉ tính khi hiển thị (Blade) dựa trên 4 ngưỡng `sf_config_general`; không lưu số phút, không có thao tác duyệt trễ/sớm ở màn này.
4. **Nghỉ có lương/không lương**: cờ `is_deducted` 0/1 trên từng ca; chỉ đổi được khi ca chưa check-in/out và chưa chốt.
5. **Chốt lương** (`is_close = 1`) khoá Chỉnh sửa, Chấm hộ, Nghỉ có/không lương — nhưng **không** khoá Xoá, Làm thêm giờ, Thưởng/phạt.
6. **Phép năm** (`sf_leave_day`): có code trừ phép khi thêm ca mã `P`/`1/2` (mặc định quỹ 12 ngày) nhưng thực tế không chạy vì không lấy được `shift_code`; xoá ca phép lại trừ thêm thay vì hoàn.
7. **Log**: thay đổi check-in/out bởi chấm hộ → `sf_check_in_change_log`/`sf_check_out_change_log`; duyệt/xác nhận → `sf_time_working_staffs_action_log`. Chỉnh sửa ca, nghỉ có/không lương, xoá, thưởng/phạt **không ghi log**.
8. **Thông báo** cho NV khi: chấm công hộ, duyệt lịch, xác nhận giờ thực tế.

### 20. Các điểm bất thường / rủi ro ghi nhận
- Không có kiểm tra quyền phía backend cho mọi action (chỉ ẩn nút trong Blade); `approve-work-schedule` không kiểm tra người duyệt là quản lý (R:3379-3423).
- `created_type_ci/co` luôn null ở màn theo NV (R:250-257 + ShiftCheckInLogTable.php:295-308, ShiftCheckOutLogTable.php:85-99) → không hiện icon nguồn chấm; `is_approve_time_off` bị ép 0 (R:258).
- `ShiftTable::getInfo` không select `shift_code` → mọi logic theo mã ca (`P`, `1/2`) trong addShift/addStaff/removeShift không có hiệu lực từ dữ liệu mới.
- `addShiftByStaff` tham chiếu `$v['shift_code']` không tồn tại trong input (R:2597) → có thể luôn lỗi.
- `storeOvertime` mất các cột không có trong `$fillable` (status, shift_code_approved...).
- `indexShift` truyền năm 2 chữ số (C:212, 223).
- Báo cáo `report-time-working-staff`, `report-time`, export `export-time-working-staff-action`: thiếu view và method model → không dùng được.
- Message sai nghĩa: "Ngày bắt đầu phải lớn hơn ngày kết thúc" (R:1708, 2248), "Ngày bắt đầu ca làm thêm phải nhở hơn ngày kết thúc của ca cũ" (R:2265).
- Chú thích màu trên màn theo NV không khớp màu thực tế (V/week/index:194-207 vs V/week/list:104-203).
- Nhiều truy vấn trong vòng lặp (N NV × số ngày × 3 query) ở `getList`/`getListShift`.

---


## Phần C. Bảng chấm công (Timekeeping), Bảng công tháng/Phiếu lương (TimeSheet), Lịch sử chấm công và duyệt đi trễ/về sớm (Attendances)

> Phạm vi: `Modules/Shift`, routes trong `Modules/Shift/routes/web.php` (group `prefix=shift`, `middleware=['web','auth']`, `routes/web.php:2`).
> Quy ước viết tắt đường dẫn khi dẫn chiếu:
> - `TKC` = `Modules/Shift/Http/Controllers/TimekeepingController.php`
> - `TKR` = `Modules/Shift/Repositories/Timekeeping/TimekeepingRepo.php`
> - `TSC` = `Modules/Shift/Http/Controllers/TimeSheetController.php`
> - `TSR` = `Modules/Shift/Repositories/TimeSheet/TimeSheetRepo.php`
> - `ATC` = `Modules/Shift/Http/Controllers/AttendancesController.php`
> - `ATR` = `Modules/Shift/Repositories/Attendances/AttendancesRepo.php`
> - `TWS` = `Modules/Shift/Models/TimeWorkingStaffTable.php` (bảng `sf_time_working_staffs`)
> - `CIL` = `Modules/Shift/Models/ShiftCheckInLogTable.php` (bảng `sf_check_in_log`)
> - `COL` = `Modules/Shift/Models/ShiftCheckOutLogTable.php` (bảng `sf_check_out_log`)
> - `STF` = `Modules/Shift/Models/StaffTable.php` (bảng `staffs`)
> - View: `V/...` = `Modules/Shift/Resources/views/...`
> - JS: `public/static/backend/js/shift/...`
>
> Thư mục lang `Modules/Shift/Resources/lang` chỉ có `.gitkeep`; mọi chuỗi dùng `__()`/`@lang` lấy từ `resources/lang/*.json` chung.

---

### 0. Tổng quan và cảnh báo chung

#### 0.1 Danh sách route thuộc phạm vi

| Route name | Method + URL | Controller@method | Ghi chú |
|---|---|---|---|
| `timekeeping` | GET `/shift/timekeeping` | `TKC@index` | Màn "CHẤM CÔNG" tổng hợp theo tuần/tháng (`routes/web.php:178`) |
| `timekeeping.list` | POST `/shift/timekeeping/list` | `TKC@listAction` | Ajax lọc/phân trang (`:179`) |
| `timekeeping.export` | GET `/shift/timekeeping/export` | `TKC@exportAction` | Xuất Excel tổng hợp (`:180`) |
| `timekeeping.detail-staff` | GET `/shift/timekeeping/detail-staff?id=&m=&y=` | `TKC@detailStaff` | Lịch công tháng của 1 NV (`:181`) |
| `timekeeping.list_detail` | POST `/shift/timekeeping/list-detail-staff` | `TKC@listDetailAction` | Ajax đổi tháng ở màn chi tiết (`:182`) |
| `timekeeping.export-payroll-timekeeping-report` | GET `/shift/timekeeping/export-payroll-timekeeping-report` | `TKC@exportActionPayrollTimekeepingReport` | Xuất Excel báo cáo bảng lương chấm công (`:183`) |
| `timekeeping.payroll-timekeeping-report` | GET `/shift/timekeeping/payroll-timekeeping-report` | `TKC@viewPayrollTimekeepingReport` | Màn "Báo cáo chấm công" (Rate 1–4) (`:184`) |
| `timekeeping.ajax-payroll-timekeeping-report` | POST `/shift/timekeeping/ajax-payroll-timekeeping-report` | `TKC@ajaxPayrollTimekeepingReport` | Ajax bảng báo cáo (`:185`) |
| `time-sheet` | GET `/shift/time-sheet` | `TSC@index` | Bảng chấm công dự án (`:235`) |
| `time-sheet.list` | POST `/shift/time-sheet/list` | `TSC@listAction` | (`:236`) |
| `time-sheet.export` | GET `/shift/time-sheet/export` | `TSC@exportAction` | (`:237`) |
| `time-sheet.export-checkin-out` | POST `/shift/time-sheet/export-checkin-out` | `TSC@exportHistoryAction` | CSV lịch sử check-in/out (`:238`) |
| `time-sheet.import-pay-slip` | POST `/shift/time-sheet/import-pay-slip` | `TSC@importPaySlipExcelAction` | Import phiếu lương (`:239`) |
| `attendances.index` | GET `/shift/attendances` | `ATC@index` | Màn "Lịch sử chấm công" (`:111`) |
| `attendances.modal-checkin` | POST `/shift/attendances/show-check-in` | `ATC@showModalCheckInAction` | Popup vào/ra ca (`:112`) |
| `attendances.checkin` | POST `/shift/attendances/check-in` | `ATC@checkInAction` | (`:113`) |
| `attendances.checkout` | POST `/shift/attendances/check-out` | `ATC@checkOutAction` | (`:114`) |
| `attendances.list` | POST `/shift/attendances/list` | `ATC@listAction` | (`:115`) |
| `attendances.load-department` | POST `/shift/attendances/list-department` | `ATC@getDepartmentAction` | Trả JSON option phòng ban (`:116`) — không thấy JS nào gọi |
| `attendances.approve` | POST `/shift/attendances/approve` | `ATC@approveLateSoonAction` | Duyệt đi trễ / về sớm (`:117`) |
| `attendances.export` | GET `/shift/attendances/export` | `ATC@exportAction` | Xuất Excel lịch sử vào ra (`:118`) |

#### 0.2 Phân quyền
- Không có middleware phân quyền ngoài `web`, `auth` (`routes/web.php:2`). Base controller `Modules/Shift/Http/Controllers/Controller.php` → `Modules/User/Http/Controllers/Controller.php` không đăng ký middleware nào. Không action nào trong 3 controller tự kiểm tra `session('routeList')` → **backend không chặn quyền**; mọi user đăng nhập gọi được mọi route ở trên nếu biết URL.
- Ẩn/hiện ở Blade:
  - Nút "Xuất Excel" của báo cáo bảng lương chỉ hiện khi `in_array('timekeeping.export-payroll-timekeeping-report', session('routeList'))` (`V/timekeeping/report.blade.php:313`).
  - Các mục menu "…" từng ca ở màn chi tiết NV kiểm tra các quyền `shift.time-working-staff.*` và `manager-work.detail.show-popup-work-child` (xem mục 2.4).
  - Link vào màn chấm công: nút "BẢNG CHẤM CÔNG" ở màn Danh sách ca (`V/shift/index.blade.php:45-53`) hiện khi có quyền `timekeeping`. Menu sidebar lấy từ DB — chưa xác định.
- Màn `timekeeping` (index) không kiểm tra quyền nút Export (`V/timekeeping/index.blade.php:103`). Màn `attendances` không kiểm tra quyền nút Duyệt (`V/attendances/list.blade.php:140-173`).

#### 0.3 Cấu hình chung ảnh hưởng tính toán (lưu session)
`TKC::index`, `TKC::detailStaff` và `ATC::index` đọc `sf_config_general` (qua `TimeWorkingStaffRepo::getConfigGeneral()` → `ConfigGeneralTable::getConfig()`, `Repositories/TimeWorkingStaff/TimeWorkingStaffRepo.php:2816-2822`) rồi gọi `_setSessionConfigGeneral` (`TKC:238-283`, `ATC:66-111`):

| config_general_code | Session key | Ý nghĩa (comment code) | Đơn vị |
|---|---|---|---|
| `late_check_in` | `late_check_in` | Số phút ân hạn: vào sau giờ bắt đầu ca quá số phút này mới tính "đi trễ" | phút; nếu `config_general_unit='hour'` thì ×60 |
| `off_check_in` | `off_check_in` | Vào trễ quá số phút này → tính "nghỉ không lương" | như trên |
| `back_soon_check_out` | `back_soon_check_out` | Ra trước giờ kết thúc ca quá số phút này mới tính "về sớm" | như trên |
| `off_check_out` | `off_check_out` | Ra sớm quá số phút này → "nghỉ không lương" | như trên |

- Config có `is_actived = 0` bị bỏ qua (giá trị = 0) (`TKC:253-255`).
- Lưu ý: chỉ action GET (index/detail) mới set session; các action ajax (`listAction`, `listDetailAction`) dùng session đã lưu từ lần trước.

#### 0.4 Những phần đang hỏng/không dùng (phát hiện khi đọc code)
1. **TimeSheet gần như không chạy được**:
   - Không tồn tại view `shift::time-sheet.index` / `shift::time-sheet.list` (thư mục `Modules/Shift/Resources/views/time-sheet` không có; tìm toàn repo không có file nào) → `TSC@index` (`TSC:56`) và `TSC@listAction` (`TSC:98`) lỗi "View not found".
   - Các method được gọi nhưng **không tồn tại** trong code: `StaffTable::getListTimeSheet` (`TSR:88`), `ConfigGeneralTable::getConfigByCode` (`TSR:91-92`; model chỉ có `getConfig`, `getInfoByCode` — `Models/ConfigGeneralTable.php:36,55`), `TimeWorkingStaffTable::getTimeWorkingStaffByMonthV2` (`TSR:126`), `TimeWorkingStaffTable::exportExcelHistory` (`TSR:300`), `StaffTable::getDetailByName` (`TSC:1655`). Class `Modules\Shift\Models\RegionTable` được `use` (`TSC:20`) nhưng không tồn tại (không gây lỗi vì không dùng).
   - Không có view/JS nào trong repo gọi các route `time-sheet.*` (grep toàn bộ `Modules`, `resources`, `public/static`).
   → Mục 4 mô tả **logic dự kiến** theo code, kèm cảnh báo.
2. `public/static/backend/js/shift/timekeeping/script.js` và `work.js` **không được view nào include** (grep không thấy). Nội dung là code copy từ module CustomerLead/ManagerWork (gọi `timekeeping.create/store/edit/update` – route không tồn tại, `customer-lead.*`, `manager-work.*`) → code chết.
3. `V/timekeeping/export.blade.php` và `V/attendances/export.blade.php` không được controller nào render (export dùng PhpSpreadsheet/PHPExcel trực tiếp; `ATC:322-332` export cũ đã comment).
4. `V/timekeeping/navigation.blade.php` bị comment khi include (`V/timekeeping/index.blade.php:99`, `detail.blade.php:55`).
5. Nút "EXPORT" ở màn Attendances bị comment (`V/attendances/index.blade.php:103-105`) → không có cách gọi `attendances.export` từ UI.

---

### 1. Màn "CHẤM CÔNG" tổng hợp (Timekeeping index)

#### 1.1 Thông tin chung
- Tên hiển thị: tiêu đề "CHẤM CÔNG" (`V/timekeeping/index.blade.php:96`), title header "QUẢN LÝ NHÂN VIÊN" (`:3`).
- URL: GET `/shift/timekeeping`; route `timekeeping`; `TKC@index` (`TKC:61-89`); view `shift::timekeeping.index` (bảng include `shift::timekeeping.list`).
- Quyền: không kiểm tra (xem 0.2).
- Khi load: lấy cấu hình chung → session (0.3); ép `date_type='by_week'`, `date_object = Carbon::now()->weekOfYear` (`TKC:73-74`); gọi `TKR::list()`.
  - Lưu ý: lần load đầu **không** gửi `is_actived`, nên danh sách gồm cả nhân viên không hoạt động (`STF:50-52` chỉ lọc khi có `is_actived`), dù dropdown Trạng thái hiển thị mặc định "Hoạt động". Sau khi bấm Tìm kiếm thì mới lọc `is_actived=1`.
- Thư viện bảng: `$('#autotable').PioTable({baseUrl: laroute.route('timekeeping.list')})` (`index.blade.php:231-233`). Mỗi select dùng select2, chọn xong tự trigger `.btn-search` (`:225-229`).

#### 1.2 Bộ lọc (`V/timekeeping/index.blade.php:115-209`)

| # | Label/placeholder | name | Kiểu | Option | Mặc định | Backend xử lý |
|---|---|---|---|---|---|---|
| 1 | "Chọn chi nhánh" | `branch_object` | select2 | "" + các chi nhánh `branches` `is_actived=1, is_deleted=0` (`Models/BranchTable.php:27-40`, lấy qua `TKR:240-241`) | rỗng | `TKR:93` → `branch_id` → `STF::_getList` lọc `staffs.branch_id` (chi nhánh **gốc của NV**, không phải chi nhánh ca) (`STF:79-81`) |
| 2 | "Chọn phòng ban" | `department_id` | select2 (Form::select) | "" + phòng ban từ `Modules\CustomerLead\Models\DepartmentTable::getOption()` (chỉ `is_deleted=0`) (`TKR:39,260-275`; `Modules/CustomerLead/Models/DepartmentTable.php:16-20`) | rỗng | `staffs.department_id = ?` (`STF:74-76`) |
| 3 | "Chọn nhân viên" | `staff_id` | select2 | "" + NV `is_actived=1,is_deleted=0` order staff_id desc (`STF:92-103`) | rỗng | `staffs.staff_id = ?` (`STF:69-71`) |
| 4 | (Năm) | `years` | select2 | năm hiện tại -1, hiện tại, +1 | năm hiện tại (`:156-167`) | `start_working_format_year` |
| 5 | (Loại kỳ) | `date_type` | select thường | `by_week` "Theo tuần", `by_month` "Theo tháng" | `by_week` | Chọn query theo tuần hay tháng (`TKR:105-109`). Khi đổi → ajax `shift.time-working-staff.get-select-week` (`TimeWorkingStaffController@getSelectWeekAction`, `Http/Controllers/TimeWorkingStaffController.php:778-799`) trả lại option cho `date_object` rồi tự tìm kiếm (`index.blade.php:250-265`) |
| 6 | (Kỳ) | `date_object` | select thường | Tuần: 1..`weeksInYear`, label "Tuần N (dd/mm/YYYY - dd/mm/YYYY)" (`:176-186`, `V/time-working-staff/append/select_week.blade.php`); Tháng: "Tháng 1..12" (`select_month.blade.php`) | tuần ISO hiện tại | `start_working_format_week` hoặc `start_working_format_month` |
| 7 | "Trạng thái" | `is_actived` | select2 | "" (Trạng thái), `1` Hoạt động, `0` Không hoạt động | `1` (chỉ trên giao diện) | `staffs.is_actived = ?` khi khác null (`STF:50-52`) |
| 8 | Nút "TÌM KIẾM" | — | button `.btn-search` | — | — | PioTable POST `timekeeping.list` |

- Lưu ý: khi đổi `years` **không** reload danh sách tuần (chỉ đổi `date_type` mới reload). Option tuần ở lần đầu được tính theo năm hiện tại.
- `TKC@listAction` chỉ nhận các key `page, display, department_id, staff_id, date_type, date_object, branch_object, years, is_actived` (`TKC:318-329`).

#### 1.3 Bảng (`V/timekeeping/list.blade.php`)
Mỗi dòng = 1 nhân viên (`staffs`, `is_deleted=0`, order `staff_id desc`, phân trang 10/trang theo `PAGING_ITEM_PER_PAGE` — `config/constant.php:4`, `lib/mycore/src/MyCore/Models/Traits/ListTableTrait.php` getList). Với mỗi NV, lấy tất cả ca `sf_time_working_staffs` của NV trong kỳ: `getTimeWorkingStaffByWeek` (lọc `start_working_format_week`, `start_working_format_year`, `is_deleted=0`, `sf_shifts.is_deleted=0`, join `branches`, left join `sf_check_in_log`, `sf_check_out_log`) (`TWS:1059-1110`) hoặc `getTimeWorkingStaffByMonth` (`TWS:797-850`). Vòng lặp tính ở `TKR:135-223`.

| Cột | Nguồn / cách tính | Dẫn chiếu |
|---|---|---|
| Nhân viên | `full_name` (link `/shift/timekeeping/detail-staff?id={staff_id}&m={date_object}&y={year}`, mở tab mới) + icon ngân hàng + `branch_name` (chi nhánh gốc NV) | `list.blade.php:28-34` |
| Tổng ca làm | `count()` số bản ghi ca trong kỳ (mọi trạng thái, kể cả ca tương lai) | `TKR:111` |
| Tổng ca tăng ca | số ca `is_ot = 1` | `TKR:136-139` |
| Tổng số công | Σ `timekeeping_coefficient` của các ca có **cả** `is_check_in=1` và `is_check_out=1` | `TKR:142-144` |
| Số giờ làm yêu cầu tối thiểu | Σ `min_time_work`. Theo tuần lấy `sf_shifts.min_time_work` (`TWS:1083`), theo tháng lấy `sf_time_working_staffs.min_time_work` (`TWS:823`) — hai nguồn khác nhau | `TKR:140` |
| Tổng giờ làm | Σ `actual_time_work_confirmed` (giờ đã duyệt) | `TKR:141` |
| tổng giờ tăng ca | Σ `actual_time_work_confirmed` của ca `is_ot=1` | `TKR:138` |
| Số lần đi trễ | số ca `is_check_in=1` và `number_late_time > 0` (không xét ân hạn `late_check_in`, không xét đã duyệt hay chưa) | `TKR:155-162` |
| Số lần về sớm | số ca `is_check_out=1` và `number_time_back_soon > 0` (không xét ân hạn/duyệt) | `TKR:164-171` |
| Số ca nghỉ không lương | (a) ca ngày < hôm nay, `is_check_in=0`, `is_check_out=0`, `is_deducted === 1`; **cộng** (b) ca có `number_late_time > off_check_in` (khi `off_check_in>0`); **hoặc** (c) nếu (b) không xảy ra: `number_time_back_soon > off_check_out` (khi `off_check_out>0`). (b)/(c) không xét `is_approve_late/soon`, không xét `is_check_in` và không ghi DB | `TKR:173-201` |
| Số ca nghỉ có lương | ca ngày < hôm nay, không check-in, không check-out, `is_deducted === 0` | `TKR:173-181` |
| (ẩn) Số ca không chấm công vào / ra | `totalNotCheckIn`: ca quá khứ `is_check_in=0`; `totalNotCheckOut`: điều kiện `is_check_in==1 && is_check_in==0` → **luôn 0 (bug)**. Hai cột đã comment trong view | `TKR:209-220`, `list.blade.php:17-21,65-70` |

Ghi chú:
- So sánh `is_deducted === 0/1` là so sánh chặt; nếu driver PDO trả số dạng chuỗi thì điều kiện không khớp — phụ thuộc phiên bản PHP/PDO, chưa xác định.
- Ý nghĩa `is_deducted`: `null` = chưa xác định; `0` = nghỉ có lương; `1` = nghỉ không lương (gán qua `TimeWorkingStaffRepo::paidLeave`, `Repositories/TimeWorkingStaff/TimeWorkingStaffRepo.php:990-1018`).
- Không có cột ngày lễ, thưởng/phạt trong màn này.

#### 1.4 Nút "Export" (`V/timekeeping/index.blade.php:103-108, 238-247`)
- JS lấy `branch_object, department_id, staff_id, years, date_object, date_type` và `window.location.href = laroute.route("timekeeping.export", {...})` → GET `TKC@exportAction` (`TKC:347-703`). (`is_actived` không gửi.)
- Backend: `TKR::exportTimeKeeping()` (`TKR:326-401`):
  - Danh sách NV: `STF::getAllStaff()` — chỉ NV `is_actived=1, is_deleted=0`, lọc `staff_id`, `department_id`, `branch_id` (chi nhánh gốc NV) (`STF:201-241`).
  - Ca theo tuần `exportTimeWorkingStaffByWeek` (`TWS:1111-1171`) hoặc tháng `exportTimeWorkingStaffByMonth` (`TWS:1005-1058`). Mặc định nếu thiếu: `date_type='by_month'`, `date_object` = tháng hiện tại (`TKR:329-332`).
- File: `timekeeping_week_{date_object}{years}.xlsx` hoặc `timekeeping_month_...` (`TKC:688-693`). Dòng 1–2 là header (merge), dữ liệu từ dòng 3, border toàn vùng.
- Cột Excel:

| Cột | Header (dòng 1 / dòng 2) | Giá trị | Cách tính |
|---|---|---|---|
| A | Mã nhân viên | `staff_code` | |
| B | Họ và tên | `full_name` | |
| C | Email | `email` | |
| D | Ngày công chuẩn | `totalShift` | = **số ca được xếp** trong kỳ (`TKR:350`) |
| E | THEO DÕI CHECKIN / "Tống số ngày đi làm có checkin" | `totalCheckIn` | số ca `is_check_in=1` (`TKR:367-368`) |
| F | (THEO DÕI CHECKIN) / Quên checkin | `totalNotCheckIn` | ca ngày < hôm nay, không check-in **và** không check-out (`TKR:377-381`) — trùng với ca nghỉ phép |
| G | Nghỉ phép có lương | `totalLeavePaid` | ca quá khứ không in/out, `is_deducted===0` (`TKR:357-365`) |
| H | Nghỉ phép không lương | `totalLeaveUnPaid` | ca quá khứ không in/out, `is_deducted===1` (không cộng thêm rule `off_check_in/out` như màn danh sách) |
| I | ĐI LÀM SỚM/TRỄ / Số ngày đi làm sớm, hoặc đúng giờ | `totalOnTime` | **luôn = 0** (biến khởi tạo, không bao giờ tăng — `TKR:348,391`) |
| J | (ĐI LÀM SỚM/TRỄ) / Số ngày đi làm trễ | `totalWorkLate` | ca có check-in và `number_late_time>0` (`TKR:370-372`) |
| K | (ĐI LÀM SỚM/TRỄ) / Số ngày đi làm về sớm | `totalBackSoon` | ca có check-in và `number_time_back_soon>0` (`TKR:374-376`) |
| L | Tổng thời gian làm việc thực tế | `totalActualTimeWork` | Σ `floatval(actual_time_work_confirmed)` (`TKR:384`) |

- Lỗi xử lý: `catch` in `var_dump($ex->getMessage()); die;` (`TKC:700-702`).

---

### 2. Màn chi tiết chấm công 1 nhân viên (Timekeeping detail-staff)

#### 2.1 Thông tin chung
- URL: GET `/shift/timekeeping/detail-staff?id={staff_id}&m={tháng}&y={năm}`; route `timekeeping.detail-staff`; `TKC@detailStaff` (`TKC:99-231`); view `shift::timekeeping.detail` + include `shift::timekeeping.list_detail`.
- Mở từ link tên NV ở màn 1 (`V/timekeeping/list.blade.php:30`). Lưu ý: link truyền `m={{ $month }}` = `date_object`; khi màn 1 đang lọc **theo tuần** thì `m` là **số tuần** (ví dụ 41) → `Carbon::parse("Y-41-01")` lỗi/không đúng tháng (`TKC:105`) — chỉ đúng khi lọc theo tháng. Chưa xác định Carbon xử lý ngày tháng không hợp lệ thế nào (nhiều khả năng ném exception).
- Ajax đổi tháng: `PioTable` với `timekeeping.list_detail` → `TKC@listDetailAction` (`TKC:704-831`) render lại `list_detail`.
- View `list_detail` còn được tái sử dụng ở màn hồ sơ nhân viên module Admin (`Modules/Admin/Resources/views/staffs/detail.blade.php:551`, `profile.blade.php:423`, `Modules/Admin/Http/Controllers/StaffsController.php:569-578`, route `admin.timekeeping.list_detail`).
- JS dùng: `public/static/backend/js/shift/time-working-staff/list.js` (object `index`, `WorkChild`) (`V/timekeeping/detail.blade.php:112`).

#### 2.2 Bộ lọc (`V/timekeeping/detail.blade.php:61-92`)
| Field | name | Kiểu | Option | Mặc định | Ghi chú |
|---|---|---|---|---|---|
| Nhân viên | `staff_object` | select2, **disabled** | NV active (`TKR::getAllStaff`, `TKR:317-324`) | NV đang xem | chỉ hiển thị |
| (ẩn) | `staff_id` | hidden | | `objStaff.staff_id` | gửi lên `listDetailAction` |
| (ẩn) | `date_year` | hidden | | năm `y` | không đổi được năm trên UI |
| Tháng | `date_object` | select2 | "Tháng 1".."Tháng 12" | tháng `m` | `change` → submit form (`detail.blade.php:116-119`) |

#### 2.3 Lưới lịch tháng (`V/timekeeping/list_detail.blade.php`)
- Cột: Thứ hai … Chủ nhật (`:5-27`). Mỗi tuần 2 dòng: dòng ngày `d/m` (`:32-68`) và dòng nội dung ca.
- Dữ liệu từng ngày: `TKR::detailStaffByWorkingDay` → `TWS::getTimeWorkingStaffByWorkingDay` (`TWS:852-917`): ca của NV theo `start_working_format_day/month/year`, `is_deleted=0`, shift chưa xoá; join `sf_check_in_log`, `sf_check_out_log`, left join `time_off_days` lấy `is_approve as is_approve_time_off`. Mỗi ngày gọi 1 query (N+1 theo ngày).
- Nếu ngày có **1 ca** (`:72-171`): ô tô màu `background` (2.5), viền đỏ nếu `is_ot=1`; hiển thị:
  - Tên ca (link → `index.showTimeWorkingDetail(time_working_staff_id,'list')`).
  - "(HH:MM 📱 - HH:MM 📱)": giờ check-in/check-out nếu `is_check_in/out = 1`, ngược lại `--:--` (`:126-146`).
  - Tên chi nhánh ca.
  - Icon đơn phép nếu `time_off_days_id` ≠ null/0: `is_approve_time_off===1` → check xanh #00a650 "Đơn phép được chấp nhận"; `===0` → X đỏ #ed2e24 "không được chấp nhận"; khác → đồng hồ vàng #ffb927 "đang chờ duyệt" (`:153-169`).
- Nếu ngày có **≥2 ca** (`:172-183`): ô nền `#a0d4d4`, text "N Ca" (link → `index.showModalMyShift(staff_id, working_day)`), kèm các chấm màu mỗi ca (màu `background`, viền đỏ nếu OT).
- Ngày không có ca: ô trống.
- Chú thích màu (`:889-900`): Chưa đến ca `#ECECEC`; Chấm công đúng giờ `#DBEFDC`; Chưa vào/ra ca `#FDD9D7`; Vào trễ/ra sớm `#FFEACC`; Nghỉ phép có lương `#8E9FE6`; Nghỉ phép không lương `#E5E0FF`; Tăng ca `#F6695E`. **Lưu ý**: màu chú thích không khớp màu thực tế do controller tính (chưa đến ca thực tế `#D3D3D3`, có lương `#D9DCF0`, không lương `#EBD4EF`, OT thể hiện bằng viền đỏ).

#### 2.4 Menu "⋮" trên ô 1 ca (`list_detail.blade.php:80-124`, lặp lại cho 7 thứ)
| Mục | Điều kiện hiện | Hành động JS | Route backend | Ảnh hưởng DB |
|---|---|---|---|---|
| Chi tiết | quyền `shift.time-working-staff.show-time-working-detail` | `index.showTimeWorkingDetail(id,'list')` (`time-working-staff/list.js:731`) | POST `shift.time-working-staff.show-time-working-detail` (`TimeWorkingStaffController@showTimeWorkingDetailAction`, `routes/web.php:54`) | đọc (thuộc phần TimeWorkingStaff) |
| Thêm ca làm việc | quyền `shift.time-working-staff.show-pop-shift` | `index.showModalShift(staff_id, working_day,'list')` (`list.js:34`) | `shift.time-working-staff.show-pop-shift` → `add-shift` | thêm `sf_time_working_staffs` (phần TimeWorkingStaff). Sau khi lưu trên URL `detail-staff` thì `window.location.reload()` (`list.js:203-207`) |
| Thêm công việc | quyền `manager-work.detail.show-popup-work-child` | `WorkChild.showPopup(null, staff_id, '5', working_day, working_time, working_end_day, working_end_time, 'shift')` (`list.js:1334+`) | `manager-work.detail.show-popup-work-child` | tạo công việc module ManagerWork |
| Chấm công hộ | quyền `shift.time-working-staff.show-pop-time-attendance` **và** `working_day <= hôm nay` **và** `is_close == 0` **và** (`is_check_in==0` hoặc `is_check_out==0`) **và** `is_deducted === null` (`:101-107`) | `index.showModalTimeAttendance(id,'list')` (`list.js:818`) | `show-pop-time-attendance` → `submit-time-attendance` | ghi check-in/out log (phần TimeWorkingStaff) |
| Nghỉ có lương | ca chưa chốt (`is_close` 0/null), chưa check-in, chưa check-out; quyền `shift.time-working-staff.paid-or-unpaid-leave`; `is_deducted === null` hoặc `=== 1` (`:108-113`) | `index.paidOrUnPaidLeave(id,'paid','salary-detail')` (`list.js:315-361`): confirm "Bạn có muốn điều chỉnh không?" | POST `shift.time-working-staff.paid-or-unpaid-leave` → `TimeWorkingStaffRepo::paidLeave` | `UPDATE sf_time_working_staffs SET is_deducted=0` (`TimeWorkingStaffRepo.php:998-1005`); thành công → submit `.frmFilter` để reload |
| Nghỉ không lương | như trên, `is_deducted === null` hoặc `0` | `index.paidOrUnPaidLeave(id,'unpaid',...)` | như trên | `is_deducted=1` |

Không có kiểm tra quyền ở backend cho các action trên (thuộc controller TimeWorkingStaff).

#### 2.5 Quy tắc tô màu ô ca — `TKC::checkShift()` (`TKC:833-972`)
Dùng session `late_check_in`, `back_soon_check_out`, `off_check_in`, `off_check_out` (phút).
- **Ngày tương lai** (`working_day > hôm nay`): `#D3D3D3`; nếu `is_deducted===0` → `#D9DCF0`; `===1` → `#EBD4EF` (`:841-849`).
- **Hôm nay** (`:850-891`), xét lần lượt (điều kiện sau ghi đè trước):
  1. mặc định `#DBEFDC`; nếu chưa check-in hoặc chưa check-out → `#FDD9D7`;
  2. `is_deducted===0` → `#D9DCF0`; `===1` → `#EBD4EF`;
  3. Vào trễ: `is_check_in===1` và `check_in > working_day+working_time + late_check_in phút` → `#FFEACC`;
  4. Ra sớm: `is_check_out===1` và `check_out < working_end_day+working_end_time − back_soon_check_out phút` → `#FFEACC`;
  5. Cả vào lẫn ra đúng (trong ân hạn) → `#DBEFDC`;
  6. Vào trễ quá `off_check_in` (khi >0) → `#EBD4EF` (nghỉ không lương);
  7. Ra sớm quá `off_check_out` (khi >0) → `#EBD4EF`.
- **Quá khứ** (`:892-940`): nếu `is_deducted===0` → `#D9DCF0`; `===1` → `#EBD4EF`; ngược lại: không in & không out → (`is_deducted` null nên rơi vào nhánh else) `#EBD4EF`; thiếu in hoặc out → `#FDD9D7`; sau đó áp dụng các bước 3–7 như trên.
- Các so sánh dùng `===` với `is_check_in/out`, `is_deducted` (cảnh báo kiểu dữ liệu như 1.3).

---

### 3. Màn "Báo cáo chấm công" — Payroll timekeeping report (Rate 1–4)

#### 3.1 Thông tin chung
- URL: GET `/shift/timekeeping/payroll-timekeeping-report`; route `timekeeping.payroll-timekeeping-report`; `TKC@viewPayrollTimekeepingReport` (`TKC:1094-1131`); view `shift::timekeeping.report` (include `report_table`).
- Ajax: POST `timekeeping.ajax-payroll-timekeeping-report` → `TKC@ajaxPayrollTimekeepingReport` (`TKC:1136-1169`) trả `report_table`.
- Excel: GET `timekeeping.export-payroll-timekeeping-report` → `TKC@exportActionPayrollTimekeepingReport` (`TKC:1393-1928`).
- Quyền: nút Xuất Excel chỉ hiện khi có `timekeeping.export-payroll-timekeeping-report` trong `routeList` (`report.blade.php:313`). Không có link nào trong repo trỏ tới màn này (menu DB — chưa xác định).
- Kỳ báo cáo luôn **theo tuần ISO** (`date_type='by_week'` cố định — `TKC:1104,1146,1400`).

#### 3.2 Bộ lọc (`TKC::filterTimekeepingReport`, `TKC:1004-1092`; render `report.blade.php:324-367`)
| Field | name / id | Kiểu | Option | Mặc định | Backend |
|---|---|---|---|---|---|
| Nhân viên | `staff_id[]` / `#rpt-staff` | multipleSelect (có ô tìm, "Tất cả") | NV active (`STF::getOption`) | không chọn | Ajax: `whereIn staffs.staff_id` (`STF:213-219`). **Trang load đầu và Excel không nhận `staff_id`** (`TKC:1096-1098`, `1394-1398`) → Excel luôn xuất mọi NV dù đã lọc NV |
| Chi nhánh | `branch_object[]` / `#rpt-branch` | multipleSelect | chi nhánh active (`BranchTable::getOption`) | không chọn | Lọc **chi nhánh của ca** `sf_time_working_staffs.branch_id IN (...)` (`TKR:406-420`, `TWS:1163-1165`) |
| Tuần | `date_object` / `#rpt-week` | select | "" (Tuần) + 1..`weeksInYear` của **năm hiện tại**, label "Tuần N (dd/mm/YYYY - dd/mm/YYYY)" tính theo năm filter | tuần ISO hiện tại | `start_working_format_week` |
| Năm | `years` / `#rpt-years` | select | "" (Năm) + năm hiện tại −1..+1 | năm hiện tại | `start_working_format_year`. JS đổi năm → dựng lại option tuần bằng moment, label tiếng Anh "Week N (...)" (`report.blade.php:519-534`) — không tự tải lại |
| Nút tìm | `#btn-search-report` | button | | | `loadReport()` POST ajax với `years, date_object, branch_object, staff_id` (+`page`) (`:466-502`) |

Lỗi ajax → hiển thị "Lỗi khi tải dữ liệu. Vui lòng thử lại." (`:491-495`).

#### 3.3 Dữ liệu và công thức (`TKC::buildReportData`, `TKC:1174-1295`; `TKR::exportTimeKeepingNew`, `TKR:402-441`)
1. Ngày trong kỳ: 7 ngày từ thứ Hai của tuần ISO (`setISODate`) (`TKC:1181-1189`). `monthValue` = tháng của thứ Hai.
2. Rule: `sf_attendance_rate_rules` với `is_active=1` (`Models/AttendanceRateRulesTable.php:9-14`), nhóm theo `day_of_week` (1=Thứ Hai … 7=Chủ nhật) (`TKC:1206-1218`). Cột dùng: `day_of_week`, `start_time`, `end_time`, `rate`.
3. NV: `STF::getAllStaff` (active, chưa xoá; join `staffs as manager_staff` lấy `staff_manager_name`) (`STF:201-241`). Với mỗi NV lấy ca tuần (`exportTimeWorkingStaffByWeek`), **bỏ NV không có ca** (`TKR:421-423`, `TKC:1228-1230`).
4. Theo NV:
   - **Giờ làm việc** (`totalTimeWork`) = Σ `actual_time_work` (giờ thực tế hệ thống tính), làm tròn 2 số (`TKR:427-428`, `TKC:1253`).
   - **Tổng** (`totalActualTimeWork`) = Σ `actual_time_work_confirmed` (giờ đã duyệt) (`TKR:424-425`).
   - **Rate 1..4** = Σ theo ca của `calculateShiftRates()` (`TKC:1308-1382`), làm tròn 2 số:
     - Mốc bắt đầu = `working_time` (giờ **bắt đầu ca chuẩn**, không phải giờ check-in thực tế — dòng dùng check_in đã comment `TKC:1312-1313`).
     - Mốc kết thúc = bắt đầu + `actual_time_work_confirmed` giờ (tính bằng giây); nếu vượt 23:59:59 thì cắt ở 86399 (ca qua đêm bị cắt) (`TKC:1327-1333`).
     - Nếu `working_time` và `check_out_time` đều rỗng (fallback `working_end_time` khi `time_working_staff_status='confirmed'`) → 0 cho mọi rate (`TKC:1314-1320`).
     - Lấy rule của thứ trong tuần của `working_day`; **không có rule** → toàn bộ giờ duyệt vào Rate 1 (`TKC:1339-1345`).
     - Tính giao [bắt đầu, kết thúc] với từng [start_time, end_time] của rule; phân bổ **giờ duyệt** theo tỷ lệ phần giao: `rate_n += round(confirmed × overlap_n / tổng overlap, 2)`; nếu không giao rule nào → toàn bộ vào Rate 1 (`TKC:1351-1379`).
     - Chỉ Rate 1..4 được hiển thị; nếu DB có `rate` khác 1–4 thì cộng vào key không khởi tạo → có thể phát sinh lỗi "Undefined index" (`TKC:1310,1374`) — rủi ro.
   - Tooltip header gắn cứng (`report_table.blade.php:19-22`): Rate 1 "Mon-Fri 00:00-17:59", Rate 2 "Mon-Fri 18:00-23:59", Rate 3 "Saturday", Rate 4 "Sunday" — chỉ là mô tả, giá trị thực theo bảng rule.
   - `maxShiftsPerDay` = số ca nhiều nhất trong 1 ngày → số dòng con của NV (`TKC:1247-1250`).
5. Phân trang **trong bộ nhớ** sau khi tính toàn bộ: `page` (mặc định 1), `per_page` (mặc định 10) (`TKC:1112-1125`, `1153-1166`).

#### 3.4 Bảng (`V/timekeeping/report_table.blade.php`)
| Cột | Giá trị |
|---|---|
| STT | thứ tự toàn cục (`empStartIndex + idx + 1`) |
| Mã NV | `staff_code` |
| Họ tên NV | `full_name` |
| Người quản lý | `staff_manager_name` (staffs.staff_manager_id) |
| Tổng thời gian: Giờ làm việc | `totalTimeWork` (ẩn nếu 0) |
| Tổng thời gian: Tổng | `totalActualTimeWork` |
| Rate 1 … Rate 4 | `rate1..rate4` (ẩn nếu 0) |
| Mỗi ngày (thứ + dd/mm) × 3 cột | **Ca làm**: tên ca (đậm), "Chi nhánh làm việc: {branch_name}" (nghiêng), "Actual: in HH:MM - out HH:MM" (check-in/out log, `--` nếu trống), "Standard: in {working_time} - out {working_end_time}"; **Giờ làm việc**: `actual_time_work` (nếu >0); **Giờ duyệt**: `actual_time_work_confirmed` (nếu >0) |

- 10 cột đầu sticky; NV nhiều ca/ngày → rowspan; ngày không ca → ô trống gộp dòng (`:70-116`).
- Footer "Tổng" = tổng **của trang hiện tại** (không phải toàn bộ) (`:128-162`).
- Không có dữ liệu → "Không có dữ liệu".
- Phân trang tự vẽ: Trang đầu/trước/số trang/sau/cuối, "Hiển thị a - b của N"; click `.pagination-btn` → `loadReport(page)` (`report.blade.php:513-516`).

#### 3.5 Nút "Xuất Excel" (`report.blade.php:505-510`; `TKC:1393-1928`)
- JS: `window.location.href = route + '?' + $.param({years, date_object, branch_object, staff_id})`. Backend bỏ qua `staff_id`; xuất **tất cả** NV có ca, không phân trang.
- Bố cục file (PhpSpreadsheet, font Times New Roman 11, freeze tại `K8`):
  - Dòng 1: A "Năm", B {năm}; E "Bảng lương trong {MonthName} - {năm}" (cỡ 18).
  - Dòng 2: A "Tháng", B {tháng của thứ Hai}; E "Thời gian làm việc: Từ dd/mm/YYYY Đến dd/mm/YYYY" (nghiêng).
  - Dòng 3: A "Tuần", B {số tuần}; E "Chấm công" (cỡ 18).
  - Dòng 5: A "Ngày xuất báo cáo: dd/mm/YYYY".
  - Dòng 6–7 header: A STT, B Mã NV, C Họ tên NV, D Người quản lý (merge 2 dòng); E–J "Tổng thời gian" với dòng 7: Giờ làm việc, Tổng, Rate 1, Rate 2, Rate 3, Rate 4; mỗi ngày 3 cột ("{Monday} dd/mm"): Ca làm, Giờ làm việc, Giờ duyệt. Nền header `FFF2CC`.
  - Dữ liệu từ dòng 8: mỗi ca một dòng con, gộp dọc cột A–J khi NV nhiều dòng; ô "Ca làm" là RichText giống bảng web; chiều cao dòng 80.
  - Dòng tổng cuối: D "Tổng", E–J = tổng toàn bộ.
- Tên file: `timekeeping_week_{tuần}_{năm}.xlsx` (`TKC:1913-1918`). Lỗi → `var_dump; die`.

---

### 4. TimeSheet — Bảng chấm công dự án, export lịch sử check-in/out, import phiếu lương

> **Trạng thái**: Không có giao diện (view `shift::time-sheet.*` không tồn tại) và nhiều method model không tồn tại (mục 0.4). Không tìm thấy view nào gọi route `time-sheet.*`. Phần dưới mô tả **ý đồ nghiệp vụ theo code**, chưa thể chạy trên repo hiện tại.

#### 4.1 `TSC@index` (`TSC:47-63`)
Chuẩn bị dữ liệu filter cho view (không tồn tại): `branch` (`BranchTable::getOption`), `department` (`Modules\Shift\Models\DepartmentTable::getOption`: `is_inactive=1, is_deleted=0`), `region` = `[]`, `province` (`Modules\Admin\Models\ProvinceTable::getOptionProvince`). Filter dự kiến (từ `listAction`, `TSC:72-83`): `search, region_id, province_id, department_id, branch_id, month, year, page, display`.

#### 4.2 Logic bảng công tháng — `TSR::list()` (`TSR:80-292`)
1. **Kỳ công**: đọc `sf_config_general` code `close_time_working_start` và `close_time_working_end` (mặc định 25) (`TSR:91-92`). `calculateFromTo()` (`TSR:39-71`): nếu ngày bắt đầu < ngày cuối tháng trước → từ ngày (start+1) của **tháng trước**, ngược lại từ ngày 1 tháng hiện tại; đến ngày `min(end, cuối tháng)` của tháng được lọc. Ví dụ cấu hình 25/25, lọc tháng 10 → kỳ 26/09 → 25/10.
2. **Ngày công chuẩn** (`standardWorkingDay`) = số ngày trong kỳ **không phải Thứ 7/Chủ nhật** (`calculateWorkingDays`, `TSR:303-320`); tham số ngày lễ truyền mảng rỗng → **không trừ ngày lễ**. (Comment "số ngày - số thứ 2" ở `TSR:117,134` đã lỗi thời.)
3. Lấy ca của danh sách NV trong khoảng ngày (`getTimeWorkingStaffByMonthV2` – không tồn tại), gom theo `staff_id` (`TSR:126`); lấy quỹ phép năm `sf_leave_day` với `shift_code='P'` (`LeaveDayTable::getInfoLeaveDayArrStaff`, `Models/LeaveDayTable.php:55-71`) (`TSR:128`).
4. Mỗi NV khởi tạo key cho từng ngày trong kỳ dạng `dd-mm` = 0 (`TSR:163-176`). Với mỗi ca (`TSR:178-243`):
   - Ô ngày = `shift_code_approved` (ký hiệu công đã duyệt); nếu `time_working_staff_status='not-confirm'` hoặc không có mã → `❌`.
   - `totalTimekeepingCoefficient` += `timekeeping_coefficient` (mọi trạng thái) → cột "Tổng công tính lương".
   - `totalManagerNotConfirm` += 1 nếu status `not-confirm` → cột "Quản lý chưa xác nhận".
   - Chỉ khi status `confirmed`:
     - mã `"1"` hoặc `"1/2"` → `actualWorkingDay += timekeeping_coefficient`;
     - `P` → P+1; `P/2` → P+0.5 **và** actualWorkingDay+0.5; `CD`, `H`, `CT`, `ME`, `OFF`, `KL`, `TS`, `S`, `TNLD` → +1 vào biến tương ứng.
   - Ý nghĩa mã (comment `TSR:137-157`): P = phép năm; CD = nghỉ hiếu hỉ; H = nghỉ lễ; CT = đi công tác; ME = họp/meeting; OFF = ngày nghỉ hằng tuần; KL = nghỉ không lương; TS = nghỉ thai sản; S = nghỉ bệnh; TNLD = tai nạn lao động; `1` = 1 công; `1/2` = nửa công. `WFH` có cột Excel nhưng **không bao giờ được tính** (luôn 0).
5. Quỹ phép (`TSR:258-276`):
   - `timeOfNow` ("Quỹ phép còn lại tính đến …") = `sf_leave_day.total_leave_day` của bản ghi **đầu tiên** của NV (không lọc năm).
   - `totalTimeOf` ("Phép phát sinh trong kì lương") = P.
   - `timeOffRemaining` ("Số ngày phép còn lại") = max(`timeOfNow − P`, 0).
   - `notFullShiftPerMonth` ("Nhân viên không có lịch làm việc full tháng") = `❌` nếu `actualWorkingDay < standardWorkingDay`, ngược lại rỗng.

#### 4.3 Export bảng công — GET `time-sheet.export` (`TSC@exportAction`, `TSC:1006-1463`)
- Tham số: `search, region_id, province_id, department_id, branch_id, month, year`; gọi `TSR::list` với `action='export'` (lấy tất cả, không phân trang).
- Header: B1 "Tháng"/C1 {MM}; B2 "Năm"/C2 {năm}; B3 "Công chuẩn"/C3 {standardWorkingDay}; G1:J1 "PAY ROLL IN {MonthEn} - {năm} / BẢNG LƯƠNG THÁNG {MM} - {năm}"; G2:J2 "Working time: From 01/MM/YYYY To {cuối tháng}/MM/YYYY" (không khớp kỳ 26→25); G3:J3 "BẢNG CHẤM CÔNG NHÂN VIÊN DỰ ÁN"; A6:B6 "EXPORT DATE: dd/mm/YYYY".
- Cột dòng 7 (tiếng Việt) / dòng 8 (tiếng Anh): A No; B Mã nhân viên/Employee Code; C Tên nhân viên/Employee Name; D Vùng/Region Name; E Tỉnh/Province Name; F Chuỗi/Channel Name; G Quản lí trực tiếp/SUP; H Code cửa hàng/Shop Code; I Tên cửa hàng/Shop Name; J Số điện thoại/Phone Number; K Vị trí/Position; L Ngày vào làm/Joining Date; M Ngày nghỉ việc/Resigned Date.
- Từ cột N: mỗi ngày trong kỳ 1 cột (dòng 7 tên thứ tiếng Anh, Chủ nhật màu "#00FFCC"; dòng 8 "d/m"); giá trị ô = ký hiệu công/❌/0, in đậm nếu ≠ 0 (`TSC:1157-1207`, `1323-1355`).
- Sau cột ngày: "Ngày công chuẩn"; nhóm "Quy ra ngày công" (7 cột): Ngày công thực tế, P, CĐ, H, CT, ME, WFH; tiếp: OFF, KL, TS, S, TNLĐ, "Tổng công tính lương", "Nhân viên không có lịch làm việc full tháng"; nhóm "Quản lý phép năm" (3 cột): "Quỹ phép còn lại tính đến dd/MM/YYYY", "Phép phát sinh trong kì lương", "Số ngày phép còn lại"; cuối: "Quản lý chưa xác nhận" (`TSC:1208-1277`, `1356-1431`).
- Dữ liệu NV dùng key `staff_code, staff_name, region_name, province_name, channel, manager_name, store_code, store_name, staff_phone, staff_title_name, joining_date, resigned_date` — phụ thuộc `getListTimeSheet` (không tồn tại).
- Ghi file tạm `lich_su_cham_cong_{MM}{YYYY}.xlsx` vào thư mục làm việc rồi `readfile` + `unlink` (`TSC:1444-1457`). Hàm `setCellValueAndStyle` khai báo lồng trong method (`TSC:1071`). `exportAction1` (`TSC:126-1004`) là bản cũ, không có route.

#### 4.4 Export lịch sử check-in/out — POST `time-sheet.export-checkin-out` (`TSC:1465-1593`)
- Input: `export-month` (mặc định tháng hiện tại), `export-year` (mặc định năm hiện tại).
- Trả `StreamedResponse` CSV (UTF-8 BOM), tên `time-working-staff-{month}-{year}.csv`; đọc theo trang 1000 dòng qua `TSR::exportDetailHistory` → `TWS::exportExcelHistory` (**không tồn tại**) và `PagingTrait::toPagingData`.
- Cột CSV (`TSC:1524-1545`): Dealer, Date, PG User, PG Full Name, Shop code, Shop Name, PGL in-charge, Working shift, Working day, Check-in 1, Checkin Status, Check out 1, Check in 2, Check out 2, Check in 3, Check out 3, Checkout Status, PGL Confirmation, PGL Time, PGL Note Comment.

#### 4.5 Import phiếu lương — POST `time-sheet.import-pay-slip` (`TSC:1595-1688`)
- Input: file `file` (multipart). Không validate loại/kích thước file; không có view gọi tới.
- Xử lý (trong transaction):
  1. Luôn tạo 1 bản ghi `sf_time_working_pay_slip`: `sf_time_working_pay_slip_name = "Bảng lương tháng {m/Y hiện tại}"`, `_month`, `_years` = **tháng/năm hiện tại** (không lấy từ file) (`TSC:1605-1609`).
  2. Chỉ xử lý khi đuôi `xlsx` (Box\Spout); đuôi khác vẫn commit và báo "Import thành công" với phiếu rỗng (`TSC:1611-1678`).
  3. **Dòng 1 (header)**: mỗi ô tạo 1 bản ghi `sf_time_working_pay_slip_template` {`sf_time_working_pay_slip_id`, `object_key = str_slug(header)`, `object_value = header`, `object_position = index cột`, `month`, `years`}. Xác định cột "Họ tên" (slug `ho-ten`) và "Mã nhân viên" (slug `ma-nhan-vien`); không thấy thì mặc định cột 0 (`TSC:1621-1640`).
  4. **Các dòng sau**: bỏ qua dòng có ô index 1 rỗng (`TSC:1642`). Mỗi ô → `column_{index}` (null → 0); cột mã NV → `staff_code_custom`; cột họ tên → `staff_full_name`; tìm NV theo **tên** (`getDetailByName` – không tồn tại) để gán `staff_id`; thêm `sf_time_working_pay_slip_id`, `sf_time_working_pay_slip_detail_month/years` (hiện tại) rồi insert `sf_time_working_pay_slip_detail` (`TSC:1643-1663`).
  5. `$fillable` của detail chỉ có `column_0`…`column_50` (`Models/TimeWorkingPaySlipDetailTable.php:22-85`) → cột thứ 52 trở đi bị bỏ qua im lặng.
- Response: `{success:1, message:'Import thành công'}` hoặc `{success:0, message:'Có lỗi xảy ra, vui lòng thử lại sau', _message}`; không có file → không trả gì (null).
- Liên kết lương: các model có sẵn hàm đọc (`TimeWorkingPaySlipTable::getDataList` lọc `salary_period` "m/Y", `getInfo`, `getDetail`; `TimeWorkingPaySlipDetailTable::salaryStaffList`, `getDetail`; `TimeWorkingPaySlipTemplateTable::getColumns`) nhưng **không được dùng ở đâu trong repo này**; có thể dùng bởi `matthews-staff-api` (DB dùng chung) — chưa xác định. Cột `is_send_noti`, `sf_time_working_pay_slip_status`, `_type` không được set khi import.

---

### 5. Màn "Lịch sử chấm công" và duyệt đi trễ/về sớm (Attendances)

#### 5.1 Thông tin chung
- URL: GET `/shift/attendances`; route `attendances.index`; `ATC@index` (`ATC:27-49`); view `shift::attendances.index` (include `attendances.list`); JS `public/static/backend/js/shift/attendances/list.js`.
- Tiêu đề "Lịch sử chấm công" (`index.blade.php:16`).
- Load đầu: set session cấu hình chung (0.3); filter `month`/`year` = hiện tại; danh sách qua `ATR::getListHistoryCheckIn` → `CIL::_getList` (`CIL:49-205`).
- Ajax: `PioTable({baseUrl: laroute.route('attendances.list')})` (`list.js:145-147`) → `ATC@listAction` (`ATC:51-59`).
- Quyền: không có kiểm tra ở Blade lẫn backend.

#### 5.2 Nguồn dữ liệu (`CIL::_getList`)
- Mỗi dòng = **một bản ghi `sf_check_in_log`**, join (`CIL:85-94`): `sf_time_working_staffs` (inner), `sf_shifts` (inner, `is_deleted=0`), `sf_check_out_log` (left, theo `time_working_staff_id`), `staffs` (left), `branches` (inner theo `branch_id` của log check-in), `departments` (inner theo `staffs.department_id` → NV không có phòng ban bị loại), `staffs` st1..st4 cho tên người duyệt trễ/sớm, người chấm công hộ vào/ra.
- Ca **chưa check-in thì không xuất hiện**. Nếu 1 ca có nhiều log in/out → nhân bản dòng.
- Sắp xếp: `check_in_day DESC, check_in_time DESC, check_out_time DESC`. Phân trang 10 (`PAGING_ITEM_PER_PAGE`).

#### 5.3 Bộ lọc (`V/attendances/index.blade.php:24-108`)
Laravel bật `ConvertEmptyStringsToNull` (`app/Http/Kernel.php:20`) nên giá trị rỗng = không lọc.

| Field | name | Kiểu | Option | Mặc định | Backend (`CIL:95-191`) |
|---|---|---|---|---|---|
| "Nhập tên nhân viên" | `search` | text | | rỗng | `st.full_name LIKE %x% OR st.user_name LIKE OR st.email LIKE` (điều kiện `st.is_deleted=0` chỉ gắn vào nhánh email do thứ tự where) |
| "Chọn phòng ban" | `department_id` | select2 | phòng ban `is_inactive=1, is_deleted=0` (`Models/DepartmentTable.php:27-37`) | rỗng | `st.department_id = ?` |
| "Vui lòng chọn chi nhánh." | `branch_id` | select2 | chi nhánh active | rỗng | `sf_check_in_log.branch_id = ?` |
| Trạng thái | `status` | select2 | `0` "Vui lòng chọn trạng thái", `1` Đi đúng giờ, `2` Đi trễ, `3` Về sớm, `4` Chưa checkout | `0` | xem bảng dưới |
| "Chọn hình thức chấm công" | `timekeeping_type` | select2 | "", `wifi` Wifi, `gps` Gps | rỗng | `sf_check_in_log.timekeeping_type = ? OR co.timekeeping_type = ?` |
| "Chọn năm" | `year` | select2 | "", năm hiện tại → hiện tại−10 | năm hiện tại | `YEAR(check_in_day)=? OR YEAR(co.check_out_day)=?` |
| "Chọn tháng" | `month` | select2 | "", Tháng 1..12 | tháng hiện tại | `MONTH(check_in_day)=? OR MONTH(co.check_out_day)=?` |
| "Ngày làm việc" | `created_at` | daterangepicker (readonly), định dạng `DD/MM/YYYY - DD/MM/YYYY`, preset: Hôm nay, Hôm qua, 7 ngày trước, 30 ngày trước, Trong tháng, Tháng trước; maxDate hôm nay (`list.js:149-199`) | rỗng | `DATE(check_in_day)` trong khoảng |
| (ẩn) | `isValid` | hidden | | `0` | Không dùng ở backend (`listAction` chỉ truyền sang view, view không dùng) |
| Nút "SEARCH" | | | | | submit PioTable |

Logic lọc `status` (`CIL:143-191`):
- `1` Đi đúng giờ: (`number_late_time = 0` OR (`is_approve_late=1` AND `number_late_time>0`)) AND (`number_time_back_soon = 0` OR (`is_approve_soon=1` AND `>0`)) **OR** (`working_day = hôm nay` AND `check_out_time IS NULL`). → Đi trễ/về sớm **đã duyệt** được coi như đúng giờ.
- `2` Đi trễ: `number_late_time > 0` AND (`is_approve_late` = 0 hoặc NULL) — chỉ các ca trễ **chưa duyệt**.
- `3` Về sớm: `orWhere(number_time_back_soon > 0)` ở cấp ngoài cùng.
- `4` Chưa checkout: `orWhere(working_day < hôm nay AND check_out_time IS NULL)` ở cấp ngoài cùng.
- Cảnh báo: các nhánh `orWhere` cấp ngoài (status 1, 3, 4) làm phá điều kiện các filter khác (tháng/năm/chi nhánh…) và cả `sh.is_deleted=0` thêm sau → kết quả rộng hơn mong đợi. Ngày hôm nay so sánh bằng format `'y-m-d'` (năm 2 chữ số, `CIL:166,188`) — MySQL thường vẫn hiểu là ngày, chưa xác định chắc.

#### 5.4 Bảng (`V/attendances/list.blade.php`)
| Cột | Nội dung |
|---|---|
| # | STT theo trang |
| Tên nhân viên | `staff_name`, link `admin.staff.show` (tab mới) |
| Vị trí làm việc | `branch_name` (chi nhánh của log check-in) |
| Phòng ban | `department_name` |
| Tên ca | `shift_name` + "(giờ bắt đầu - giờ kết thúc)" của ca đã xếp |
| Ngày làm việc | `working_day` dd/mm/YYYY |
| Giờ vào | `check_in_time` + hình thức `check_in_type` (`sf_check_in_log.timekeeping_type`): `wifi` → link "WIFI", `gps` → "GPS" (link Google Maps `lat,lng`), `time-attendance` → "Chấm công hộ" (không link), khác → "Linh động" (link Maps) |
| Giờ ra | tương tự cho `check_out_time`, `check_out_type` |
| Lý do | văn bản tính tại Blade (5.5) |
| (thao tác) | menu "…" (5.6) |

#### 5.5 Cột "Lý do" — quy tắc hiển thị (`list.blade.php:107-138`)
Dùng session `late_check_in`, `off_check_in`, `back_soon_check_out`, `off_check_out` (phút).
- Nếu `number_late_time > 0`:
  - `is_approve_late == 1` → "{approve_late_name} Đã duyệt đi trễ";
  - else nếu (`late > late_check_in` AND `off_check_in <= 0`) OR `late < off_check_in` → "Nhân viên đi trễ";
  - else nếu `late > off_check_in` AND `off_check_in > 0` → "Hệ thống duyệt nghỉ không lương".
  - (Trễ ≤ `late_check_in` khi `off_check_in<=0` → không ghi gì; trễ đúng bằng `off_check_in` → không ghi gì.)
- Nếu `number_time_back_soon > 0`: tương tự với `is_approve_soon`, `approve_soon_name`, `back_soon_check_out`, `off_check_out` → "Đã duyệt ra ca sớm" / "Nhân viên ra ca sớm" / "Hệ thống duyệt nghỉ không lương".
- Nếu `working_day` ≠ hôm nay và chưa có `check_out_time` → "Chưa ra ca".
- Nếu `check_in_by > 0` và `check_out_by > 0` → "{check_in_name} Chấm công hộ".

#### 5.6 Menu thao tác "…" (`list.blade.php:139-174`)
Hiện khi: (trễ > 0 và chưa duyệt) hoặc (về sớm > 0 và chưa duyệt) hoặc (không phải hôm nay và chưa check-out).

| Mục | Điều kiện | JS | Backend | DB |
|---|---|---|---|---|
| Duyệt đi trễ | `number_late_time>0` và `is_approve_late != 1` | `attendances.approve(id, 1)` (`list.js:96-139`): SweetAlert "Duyệt checkin / checkout" – "Bạn có muốn duyệt đi trễ không?" (Đồng ý/Hủy) → POST `attendances.approve` {`time_working_staff_id`, `type`} | `ATC@approveLateSoonAction` (`ATC:261-299`): `type=="1"` → update `is_approve_late=1, approve_late_by=Auth id, updated_by, updated_at` | `UPDATE sf_time_working_staffs` (`ATR:113-116` → `TWS::updateCheckin`) |
| Duyệt về sớm | `number_time_back_soon>0` và `is_approve_soon != 1` | `attendances.approve(id, 2)` ("Bạn có muốn duyệt về sớm không?") | type khác "1" → `is_approve_soon=1, approve_soon_by, updated_by, updated_at` | như trên |
| Check out | `working_day` ≠ hôm nay và chưa có `check_out_time` | `attendances.showModalCheckin(id, 2)` | POST `attendances.modal-checkin` (5.7) | — |

- Kết quả duyệt: `status=1` "Thao tác thành công" khi số dòng update > 0, ngược lại `status=0` "Thao tác thất bại"; JS báo "Phê duyệt thành công/thất bại" và submit lại form. Backend không kiểm tra quyền, không kiểm tra ca có thật sự trễ/sớm, không kiểm tra `is_close`.
- **Ảnh hưởng nghiệp vụ của duyệt**: trong module Shift, các màn tổng hợp (mục 1, 3) **không** xét `is_approve_late/soon` (vẫn đếm trễ/sớm). Ở module tính lương `StaffSalary`, ca đã duyệt **không** bị tính vào số lần/số phút đi trễ, về sớm (`Modules/StaffSalary/Http/Controllers/StaffSalaryController.php:742-749`). Ở màn này, ca đã duyệt được coi như "Đi đúng giờ" khi lọc status 1.

#### 5.7 Popup vào/ra ca (check-in hộ / check-out hộ)
- `attendances.showModalCheckin(time_working_staff_id, staff_name, branch_id, branch_name, working_end_time, type)` (`list.js:3-31`) POST `/shift/attendances/show-check-in`. Blade gọi với 2 tham số `(id, 2)` → `type` thực tế `undefined`.
- `ATC@showModalCheckInAction` (`ATC:118-138`): chỉ chạy khi request ajax; `getInfo(id)` (`TWS:547-597`); nếu `$data['type'] == 1` → view `attendances.checkin`, ngược lại `attendances.checkout`. Bản ghi ca không có cột `type` → **luôn render popup Ra ca**.
- JS chèn HTML vào `#show-modal-checkin` rồi `$('#modalChecking').modal('show')`; nhưng trang Attendances **không có** phần tử `#show-modal-checkin` (chỉ có `#my-modal`, `#popup-work-edit`, `#vund_popup` — `index.blade.php:116-118`) → popup **không hiện** (bug). Nếu hiển thị được:

**Popup "RA CA"** (`V/attendances/checkout.blade.php`):
| Label | id/name | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|---|
| Nhân viên | `#staff` | text readonly | `full_name` | |
| Vị trí làm việc | `#branch` | text readonly | `branch_name` | |
| (ẩn) | `#checkin_branch_id`, `#time_working_staff_id`, `#shift_id`, `#working_day`, `#working_end_time` | hidden | từ ca | |
| Ca | `#shift` | text readonly | `shift_name` | |
| Giờ ra ca | `#checkout_time` | timepicker `HH:ii`, bước 5 phút, 24h | `working_end_time` (H:i) | không validate JS/backend |
| Nút HỦY / ĐỒNG Ý | | | | ĐỒNG Ý → `attendances.checkout()` |

`attendances.checkout()` (`list.js:67-95`) POST `attendances.checkout` {`branch_id, time_working_staff_id, shift_id, working_end_time, working_day, checkout_time`} → `ATC@checkOutAction` (`ATC:198-244`):
1. Insert `sf_check_out_log` {`time_working_staff_id`, `staff_id = Auth()->id()` (**ID người thao tác**, không phải NV của ca), `branch_id`, `shift_id`, `check_out_day = working_day` (không dùng `working_end_day` → sai với ca qua đêm), `check_out_time = checkout_time`, `status='ok'`, `reason=''`, timestamps} (`ATR:79-95`). Không set `created_type`, `timekeeping_type`.
2. `number_time_back_soon` = số phút giữa `checkout_time` và `working_end_time` nếu ra trước giờ kết thúc, ngược lại 0 (so sánh chỉ phần giờ, cùng ngày hôm nay).
3. Update `sf_time_working_staffs`: `is_check_out=1`, `number_time_back_soon`, `check_out_by = Auth id`. **Không** tính lại `actual_time_work`/`actual_time_work_confirmed`.
4. Trả `status=1` "Checkout thành công" / `0` "Checkout thất bại"; JS thành công → đóng modal, submit lại filter.

**Popup "VÀO CA"** (`V/attendances/checkin.blade.php`) — chỉ render khi `type==1` (không xảy ra từ UI hiện tại):
- Vị trí làm việc (readonly `#branch`), hidden `#time_working_staff_id`, `#checkin_branch_id`; khối "Kết nối internet" hiển thị cứng "Tên: FPT Telecom", "BSSID: {{$ip}}" (biến `$ip` không được truyền → rỗng); radio `shift` (ca của bản ghi, checked) + "(giờ bắt đầu - giờ kết thúc)", hidden `#working_time`.
- ĐỒNG Ý → `attendances.checkin()` (`list.js:33-66`): nếu chưa chọn radio → "Chưa chọn ca làm việc"; POST `attendances.checkin` {`branch_id, time_working_staff_id, shift_id, working_time`}.
- `ATC@checkInAction` (`ATC:145-191`): insert `sf_check_in_log` {`staff_id = Auth()->id()`, `check_in_day = hôm nay`, `check_in_time = giờ hiện tại`, `status='ok'`, `reason=''`, …} (`ATR:61-77`); `number_late_time` = số phút từ `working_time` tới giờ hiện tại nếu muộn hơn, ngược lại 0; update `is_check_in=1`, `number_late_time`. Không set `check_in_by`.

#### 5.8 Export lịch sử vào ra — GET `attendances.export` (`ATC:334-659`)
- Không có nút trên UI (đã comment). JS handler `.btn-export` vẫn còn: serialize form → `laroute.route("attendances.export") + '?' + formData` (`index.blade.php:140-145`). Backend chỉ dùng `month`, `year`.
- Dữ liệu (`ATR::exportHistoryCheckIn`, `ATR:128-147`): tất cả NV active (`STF::getAllStaff()` không filter); mỗi NV lấy log check-in trong tháng/năm (`CIL::getListByStaff`, `CIL:230-277`: YEAR/MONTH theo `check_in_day` hoặc `check_out_day`), gom theo `shift_name`.
- Bố cục (PHPExcel):
  - A1:BN1 "BẢNG LỊCH SỬ VÀO RA - ĐI MUỘN VỀ SỚM" (cỡ 20); B2 "Tháng: {m}"; B3 "Năm: {y}".
  - Dòng 4–6: A "Mã NV" (giá trị thực tế là `staff_id`, không phải `staff_code`), B "Tên NV", C "Phòng Ban", D "Ca làm việc".
  - Ngày 1..31, mỗi ngày 2 cột (E/F … BM/BN): dòng 4 số ngày; dòng 5 thứ (Thứ Hai…Chủ Nhật, màu `bf9002`, Chủ nhật `ff0000`); dòng 6 "IN"/"OUT". Tháng < 31 ngày vẫn in đủ 31 cột (ngày tràn sang tháng sau theo Carbon) — chưa xác định hiển thị chính xác.
  - BO "SỐ PHÚT ĐI MUỘN", BP "SỐ PHÚT VỀ SỚM".
  - Dữ liệu: mỗi NV ≥1 dòng (mỗi tên ca 1 dòng, gộp A–C, BO, BP theo NV); ô IN = `check_in_time` HH:MM (xanh `00B050`, cam `F79646` nếu `number_late_time>0`), ô OUT = `check_out_time` (cam nếu `number_time_back_soon>0`); cột ngày theo `start_working_format_day`. BO/BP = tổng phút trễ/sớm (kể cả đã duyệt).
- Tên file `lich_su_cham_cong_{m}{y}.xlsx`. `catch (Exception $ex)` thiếu namespace (`ATC:656`) → không bắt được exception thật.

---

### 6. Bảng DB và cột quan trọng

#### 6.1 `sf_time_working_staffs` (ca làm việc của NV) — `TWS`, fillable `TWS:22-59`
| Cột | Ý nghĩa / giá trị |
|---|---|
| `time_working_staff_id` | PK |
| `work_schedule_id`, `shift_id`, `branch_id`, `staff_id` | lịch, ca, chi nhánh làm việc của ca, NV |
| `working_day`, `working_time` | ngày + giờ bắt đầu ca |
| `working_end_day`, `working_end_time` | ngày + giờ kết thúc ca |
| `start_working_format_day/week/month/year` | ngày/tuần/tháng/năm của ngày bắt đầu (dùng để lọc kỳ) |
| `timekeeping_coefficient` | hệ số công của ca (cộng vào "Tổng số công") |
| `is_check_in`, `is_check_out` | 0/1 đã vào/ra ca |
| `number_late_time` | số phút đi trễ |
| `number_time_back_soon` | số phút về sớm |
| `is_deducted` | null = chưa xác định; 0 = nghỉ có lương; 1 = nghỉ không lương |
| `is_close` | 0/1 ca đã chốt (chặn chấm công hộ / đổi nghỉ phép) |
| `is_ot` | 1 = ca tăng ca |
| `overtime_type` | loại tăng ca (phần khác) |
| `is_approve_late`, `approve_late_by` | đã duyệt đi trễ (1) và người duyệt |
| `is_approve_soon`, `approve_soon_by` | đã duyệt về sớm (1) và người duyệt |
| `check_in_by`, `check_out_by` | người chấm công hộ vào/ra |
| `time_work`, `min_time_work` | số giờ chuẩn / tối thiểu của ca |
| `actual_time_work` | giờ làm thực tế hệ thống tính |
| `actual_time_work_confirmed` | giờ làm đã duyệt (dùng cho tổng giờ, rate) |
| `time_working_staff_status` | thấy các giá trị `waiting`, `approved`, `not-confirm`, `confirmed` (`TWS:792`, `TSR:185,200`, `TKC:1314`) |
| `shift_code_approved` | ký hiệu công đã duyệt (1, 1/2, P, P/2, CD, H, CT, ME, OFF, KL, TS, S, TNLD) — dùng ở TimeSheet |
| `time_off_days_id` | đơn nghỉ phép liên kết (`time_off_days.is_approve`) |
| `check_in_date`, `check_out_date`, `checking_type`, `approved_manual_time_by` | được select ở export tuần; ý nghĩa chi tiết chưa xác định |
| `is_deleted` | 0/1 |

#### 6.2 `sf_check_in_log` / `sf_check_out_log` — `CIL:20-36`, `COL:17-33`
`check_in_log_id`/`check_out_log_id`, `time_working_staff_id`, `staff_id`, `branch_id`, `shift_id`, `check_in_day`+`check_in_time` / `check_out_day`+`check_out_time`, `status` (portal ghi `'ok'`), `reason`, `created_type`, `created_by`, `timekeeping_type` (`wifi`, `gps`, `time-attendance` = chấm công hộ, khác = linh động), `latitude`, `longitude`, `image_selfie`.

#### 6.3 `sf_config_general` — `Models/ConfigGeneralTable.php`
`config_general_code` (`late_check_in`, `off_check_in`, `back_soon_check_out`, `off_check_out`, `close_time_working_start`, `close_time_working_end`, …), `config_general_value`, `config_general_unit` (`hour` → ×60, còn lại phút), `is_actived`.

#### 6.4 `sf_attendance_rate_rules` — `Models/AttendanceRateRulesTable.php`
`day_of_week` (1=Thứ Hai … 7=Chủ nhật), `start_time`, `end_time`, `rate` (1–4), `is_active`. Dữ liệu thực tế không kiểm tra được (DB local không kết nối được).

#### 6.5 Phiếu lương
- `sf_time_working_pay_slip` (`Models/TimeWorkingPaySlipTable.php`): `sf_time_working_pay_slip_id`, `_name`, `_month`, `_years`, `_status`, `_type`, `created_by`, `updated_by`.
- `sf_time_working_pay_slip_template` (`Models/TimeWorkingPaySlipTemplateTable.php`): `id`, `sf_time_working_pay_slip_id`, `object_key` (slug header), `object_value` (header gốc), `object_position` (index cột), `month`, `years`.
- `sf_time_working_pay_slip_detail` (`Models/TimeWorkingPaySlipDetailTable.php`): `sf_time_working_pay_slip_detail_id`, `sf_time_working_pay_slip_id`, `staff_id`, `staff_code_custom`, `staff_full_name`, `total_pay_slip`, `_detail_month`, `_detail_years`, `column_0..column_50` (giá trị từng cột Excel theo `object_position`), `is_send_noti`.

#### 6.6 Các bảng liên quan khác
- `sf_leave_day` (`Models/LeaveDayTable.php`): quỹ phép theo NV/`shift_code` ('P')/năm: `total_leave_day`, `total_using_leave_day`, `total_using_remaining_day`, `staff_leave_day_year`.
- `time_off_days` (`is_approve`: 1 chấp nhận, 0 từ chối, null chờ duyệt — theo icon ở list_detail), `time_off_days_shift`, `time_off_type`, `time_off_days_total`: model có trong `Modules/Shift/Models` nhưng các màn trong phạm vi chỉ dùng `time_off_days.is_approve`; các model `TimeOffDaysShiftsTable`, `TimeOffTypeTable`, `TimeOffDaysTotalTable` chỉ được `use` trong `TKR`/`TSR` (không gọi; dòng gọi `getTotalDaysOff` đã comment `TSR:272`).
- `staff_holiday` (`StaffHolidayTable`): ngày lễ — **không** được dùng trong Timekeeping/TimeSheet/Attendances (dùng ở `TimeWorkingStaffRepo` và module StaffSalary). TimeSheet không trừ ngày lễ khỏi công chuẩn.
- `estimate_branch_time` (`EstimateBranchTimeTable`): dùng ở `StaffSalary/ReportBudgetBranch`, không thuộc màn trong phạm vi.
- `sf_timekeeping_notification` (`SfTimekeepingNotificationTable`): dùng ở `ConfigNotiRepository`, không thuộc màn trong phạm vi.

---

### 7. Tóm tắt rule nghiệp vụ quan trọng
1. **Đi trễ / về sớm** được lưu thành số phút trên ca (`number_late_time`, `number_time_back_soon`) lúc check-in/check-out; ngưỡng ân hạn (`late_check_in`, `back_soon_check_out`) chỉ dùng để **tô màu** và **hiển thị lý do**; các bộ đếm tổng hợp ở màn 1 và Excel đếm mọi giá trị > 0.
2. **Nghỉ không lương tự động**: trễ > `off_check_in` hoặc sớm > `off_check_out` (khi cấu hình > 0) → đếm vào "Số ca nghỉ không lương" ở màn 1 (`TKR:191-201`), tô màu tím `#EBD4EF` ở lịch chi tiết, lý do "Hệ thống duyệt nghỉ không lương" ở Attendances. Không ghi DB (`is_deducted` không đổi).
3. **Nghỉ có lương / không lương thủ công**: chỉ cho ca chưa chốt, chưa vào, chưa ra; set `is_deducted` 0/1.
4. **Tổng số công** = Σ hệ số công các ca có đủ cả check-in và check-out (màn 1). TimeSheet: công thực tế chỉ tính ca `confirmed` mã `1`/`1/2` theo hệ số, cộng 0.5 cho `P/2`.
5. **Giờ** dùng `actual_time_work_confirmed` (giờ duyệt) cho tổng giờ và Rate; `actual_time_work` chỉ hiển thị "Giờ làm việc" ở báo cáo Rate.
6. **Rate 1–4**: phân bổ giờ duyệt theo khung giờ/ngày trong `sf_attendance_rate_rules`, tính từ **giờ bắt đầu ca chuẩn**, cắt tại 23:59:59; không có rule/không giao → Rate 1; làm tròn 2 chữ số từng phần.
7. **Duyệt đi trễ/về sớm** chỉ set cờ và người duyệt; tác động ở module lương StaffSalary (loại khỏi số lần/số phút trễ sớm) và bộ lọc "Đi đúng giờ".
8. Ngày lễ không được xử lý trong 3 nhóm màn này.

---


## Phần D — Cấu hình chung, Cấu hình thông báo, Cấu hình chấm công (wifi/GPS), Thưởng phạt

> Phạm vi: `Modules/Shift` của repo `matthews-portal-new`. Đường dẫn file ghi tương đối theo gốc repo trừ khi ghi rõ repo khác (`matthews-staff-api` là API mobile dùng chung DB).
> Tất cả route nằm trong group `['middleware' => ['web','auth'], 'prefix' => 'shift']` (`Modules/Shift/routes/web.php:2`).

### 0. Ghi chú chung về phân quyền

- Không controller nào trong phạm vi này khai báo middleware riêng; `Modules/Shift/Http/Controllers/Controller.php` chỉ dùng trait `ValidatesRequests`, `Modules/User/Http/Controllers/Controller.php` không có middleware. Theo `CLAUDE.md` của repo, middleware `account` đã bị comment nên **mọi action chỉ cần đăng nhập** là gọi được (kể cả các action ghi dữ liệu).
- Phân quyền chỉ ở mức ẩn/hiện trên Blade bằng `in_array('<route name>', session('routeList'))`:
  - Tab "Cấu hình chung" ⇔ quyền `shift.config-general`; tab "Danh sách cấu hình chấm công" ⇔ quyền `timekeeping-config` (vd `config-general/index.blade.php:40,47`). Ba tab còn lại (linh động, không cần duyệt, ngày phép) **không** kiểm quyền (`index.blade.php:56-70`).
  - Thưởng phạt: nút sửa cần `shift.recompense.show-pop-edit`, nút xoá cần `shift.recompense.destroy`, thêm vào đó chỉ hiện với bản ghi `is_system == 0` (`recompense/list.blade.php:18,27`). Nút "THÊM THƯỞNG PHẠT" có điều kiện quyền đã bị comment (`recompense/index.blade.php:21,29`).
  - Nút "THÊM CẤU HÌNH CHẤM CÔNG" có điều kiện quyền đã bị comment (`timekeeping-config/index.blade.php:36,44`).
- Thư mục lang `Modules/Shift/Resources/lang` chỉ có `.gitkeep`; chuỗi dịch nằm ở `resources/lang/*.json` (chuỗi `__('...')` / `@lang`).

---

### 1. Cấu hình chung (`sf_config_general`)

#### 1.1 Màn hình "Cấu hình chung"

| Mục | Giá trị |
|---|---|
| URL | `GET /shift/config-general` |
| Route name | `shift.config-general` (`routes/web.php:197`) |
| Controller | `ConfigGeneralController@index` (`ConfigGeneralController.php:32-37`) → `ConfigGeneralRepo::getDataGeneral()` (`ConfigGeneralRepo.php:31-39`) → `ConfigGeneralTable::getConfig()` lấy **tất cả** dòng (`Models/ConfigGeneralTable.php:36-47`) |
| View | `shift::config-general.index` (`Resources/views/config-general/index.blade.php`) |
| JS | `public/static/backend/js/shift/config-general/script.js` (object `view`), `autoNumeric.min.js` (`index.blade.php:307-315`) |
| Tiêu đề | "CẤU HÌNH CHẤM CÔNG" (`index.blade.php:14`) |

**Thanh tab** (dùng chung cho 5 màn: index, timekeeping-config, free, approved, time_keeping):
1. "Cấu hình chung" → `shift.config-general` (hiện nếu có quyền `shift.config-general`)
2. "Danh sách cấu hình chấm công" → `timekeeping-config` (hiện nếu có quyền `timekeeping-config`)
3. "Cấu hình chấm công linh động" → `shift.config-general-free`
4. "Danh sách nhân viên không cần duyệt lịch làm việc" → `shift.config-general-approved`
5. "Cấu hình ngày phép còn lại" → `shift.config-general-time-keeping`
(`index.blade.php:39-71`)

**Nội dung**: lặp từng dòng `sf_config_general`, `@switch(config_general_code)`; chỉ những code dưới đây được render (dòng có code khác — ví dụ `round_timekeeping_coefficient` mà API đọc — **không hiển thị** và không được gửi khi lưu) (`index.blade.php:74-294`). Mỗi dòng là một `div.div_child` chứa hidden `config_general_id`, hidden `config_general_code`, checkbox `.is_actived` (nếu có) và input `.config_general_value`.

| code | Nhãn hiển thị (checkbox) | Input giá trị | Đơn vị hiển thị | Chữ phía sau | Dòng blade |
|---|---|---|---|---|---|
| `late_check_in` | "Tính là đi trễ khi thời gian chấm công vào sau" | text số | theo `config_general_unit`: `minute`→"Phút", `hour`→"Giờ" | "so với thời gian làm việc bắt đầu" | 77-145 |
| `off_check_in` | "Tính là nghỉ không lương khi thời gian chấm công vào sau" | text số | như trên | "so với thời gian làm việc bắt đầu" | 77-145 |
| `back_soon_check_out` | "Tính là về sớm khi thời gian chấm công ra trước" | text số | như trên | "so với thời gian làm việc kết thúc" | 77-145 |
| `off_check_out` | "Tính là nghỉ không lương khi thời gian chấm công ra trước" | text số | như trên | "so với thời gian làm việc kết thúc" | 77-145 |
| `checkin_time_before` | "Được phép checkin trước" | text số | như trên | (không có) | 81-145 |
| `close_time_working_start` | "Thời gian chốt công hàng tháng" | text, nhãn trước "Từ ngày", sau "Tháng trước" (là **ngày trong tháng**) | – | – | 147-188 |
| `close_time_working_end` | **không có checkbox** (cột trái trống) | text, nhãn "Đến ngày" … "Tháng này" | – | – | 189-214 |
| `remind_checkin_checkout` | "Nhắc nhở chấm công trước và sau" | text số | Phút/Giờ theo unit | – | 215-248 |
| `checkin_with_image` | "Bắt buộc chấm công với ảnh" | input **hidden** (người dùng không sửa được giá trị) | – | – | 249-269 |
| `admin_confirm_work_schedule` | "Cho phép Admin xác nhận ca làm việc" | input **hidden** | – | – | 270-290 |

- Giá trị đơn vị (`config_general_unit`) **không sửa được** trên UI, chỉ hiển thị.
- Danh sách/giá trị mặc định thực tế các dòng nằm trong DB; repo không có migration/seed → giá trị mặc định: **chưa xác định** (không truy vấn được DB).

**Định dạng input** (`script.js:4-13`): `AutoNumeric.multiple('.config_general_value', {decimalPlaces:0, digitGroupSeparator:',', minimumValue:0})` → chỉ nhận số nguyên ≥ 0, áp cho cả input hidden.

**Nút "LƯU THÔNG TIN"** (`index.blade.php:19-25`) → `view.submitEdit()` (`script.js:14-59`):
- Duyệt mọi `.div_child`, tạo mảng `arrayData[] = {config_general_id, config_general_code, is_actived (1 nếu checkbox checked, ngược lại 0), config_general_value (bỏ dấu ',')}`.
- Dòng `close_time_working_end` không có checkbox ⇒ **luôn gửi `is_actived = 0`**.
- AJAX `POST shift.config-general.update` (`/shift/config-general/update`, `routes/web.php:198`) → `ConfigGeneralController@update` (`:45-50`) → `ConfigGeneralRepo::update` (`ConfigGeneralRepo.php:47-118`).
- Không có jQuery-validate, không có FormRequest.

**Rule backend** (`ConfigGeneralRepo.php:50-105`):
1. Lấy is_actived/value của 4 code `late_check_in`, `off_check_in`, `back_soon_check_out`, `off_check_out`.
2. Nếu cả `late_check_in` và `off_check_in` đều bật và `late > off` → lỗi "Số phút đi trễ phải nhỏ hơn số phút đi trễ tính nghỉ" (`:83-88`). (Chỉ chặn khi lớn hơn, **bằng nhau vẫn qua** dù message nói "nhỏ hơn". So sánh giá trị thô, không quy đổi unit.)
3. Tương tự `back_soon_check_out > off_check_out` → "Số phút về sớm phải nhỏ hơn số phút về sớm tính nghỉ" (`:91-96`).
4. Cập nhật từng dòng theo `config_general_id` gửi từ client: `is_actived`, `config_general_value`, `updated_by = Auth()->id()` (`:98-105`). Không whitelist id/code — client có thể gửi id bất kỳ.
5. Thành công: "Chỉnh sửa thành công"; exception: "Chỉnh sửa thất bại".
- JS: thành công `swal(success)`, lỗi `swal(error)`, không reload.

**Nút "Tạo dữ liệu chấm công"** (chỉ cho `Auth()->id() == 1`, gọi `view.generateTimeKeeping()`) đã bị **comment** (`index.blade.php:27-35`); hàm JS `view.generateTimeKeeping` cũng **không tồn tại** trong `script.js`. Xem mục 1.5.

#### 1.2 Bảng `sf_config_general`

Model `Modules/Shift/Models/ConfigGeneralTable.php:16-27`; PK `config_general_id`.

| Cột | Ý nghĩa |
|---|---|
| `config_general_id` | PK |
| `config_general_code` | Mã cấu hình (bảng mục 1.1) |
| `config_general_value` | Giá trị số (phút/giờ hoặc ngày trong tháng; với `checkin_with_image` là cờ 0/1) |
| `config_general_unit` | `minute` / `hour` (API nhân 60 nếu `hour`) |
| `is_actived` | 1 bật / 0 tắt |
| `updated_by`, `created_at`, `updated_at` | audit |

#### 1.3 Các key được SỬ DỤNG ở đâu

| Key | Nơi dùng | Cách dùng |
|---|---|---|
| `late_check_in`, `off_check_in`, `back_soon_check_out`, `off_check_out` | Portal: `TimeWorkingStaffController::_setSessionConfigGeneral` (`Modules/Shift/Http/Controllers/TimeWorkingStaffController.php:68-113`, gọi ở `:40`, `:203`); bản sao ở `TimekeepingController.php:67,219,238`, `AttendancesController.php:32,66`, `Modules/Admin/Http/Controllers/StaffsController.php:588-592` | Bỏ qua dòng `is_actived = 0`; quy đổi `hour`×60; lưu vào session `late_check_in`, `off_check_in`, `back_soon_check_out`, `off_check_out` (phút). Blade dùng session để tô màu đi trễ/về sớm/nghỉ không lương: `time-working-staff/pop/list-my-shift.blade.php:31-114`, `time-working-staff/week/list-month.blade.php:112-402` |
| cùng 4 key + `checkin_time_before`, `close_time_working_*`, `round_timekeeping_coefficient` | staff-api: `TimeWorkingStaffRepo::_setConfigGeneral` (`matthews-staff-api/Modules/TimeWorkingStaff/Repositories/TimeWorkingStaff/TimeWorkingStaffRepo.php:1980-2034`) | Bỏ dòng tắt, quy đổi giờ→phút |
| `checkin_time_before` | staff-api `checkinLog` (`TimeWorkingStaffRepo.php:1225-1238`) | Nếu > 0 và check-in sớm hơn N phút so với giờ bắt đầu ca → ném `CHECKIN_TIME_BEFORE_OVERTIME` (chặn check-in) |
| `checkin_time_before` | staff-api `TimeKeepingRepository::getShiftV2` (`matthews-staff-api/Modules/TimeKeeping/Repositories/TimeKeepingRepository.php:925-936`) | Dùng để quyết định trả ca hiện tại cho app (ca bắt đầu trong N phút tới) |
| `late_check_in` | staff-api `checkinLog` (`TimeWorkingStaffRepo.php:1240-1250`) | Nếu ca không có `is_approve_late` và trễ quá N phút → ném `CHECKIN_OVERTIME` (chặn check-in) |
| 4 key trễ/sớm | staff-api `getReportTimeWorkingStaff` (`TimeWorkingStaffRepo.php:2561-2569`) và đoạn tương tự `:2947-2953` | Báo cáo chấm công trên app |
| `close_time_working_start`, `close_time_working_end` | staff-api `TimeWorkingStaffRepo.php:169-173, 275-276, 1870-1871`; portal `Modules/Shift/Repositories/TimeSheet/TimeSheetRepo.php:91-92` | Kỳ chốt công: từ ngày `start` tháng trước đến ngày `end` tháng này. Mặc định nếu không có/không bật: staff-api 26 & 25, portal 25 & 25 |
| `checkin_with_image` | staff-api `getShiftV2` (`TimeKeepingRepository.php:921-922, 934, 963`) | `getConfigByCode` (chỉ lấy dòng `is_actived = 1`, `matthews-staff-api/Modules/TimeKeeping/Models/ConfigGeneralTable.php:60-73`) rồi lấy **`config_general_value`** ép int → trả `config.checkin_with_image` cho app |
| `admin_confirm_work_schedule` | portal `TimeWorkingStaffRepo::isAdminConfirmWorkSchedule` (`Modules/Shift/Repositories/TimeWorkingStaff/TimeWorkingStaffRepo.php:3494-3504`), dùng trong `canConfirmWorkSchedule` (`:3512-3519`) | Chỉ admin (`is_admin = 1`) và dòng này `is_actived = 1` mới được xác nhận lịch làm việc thay quản lý |
| `remind_checkin_checkout` | Không tìm thấy nơi dùng trong `matthews-portal-new`, `matthews-staff-api`, `api-loyalty-new` | **chưa xác định** (có thể do service/cron khác) |
| `round_timekeeping_coefficient` | staff-api `_setConfigGeneral` (`:2017-2018`) | Không hiển thị trên portal → chỉ sửa được trực tiếp DB |

**Điểm bất thường cần lưu ý**
- `close_time_working_end` không có checkbox nên mỗi lần bấm Lưu bị ghi `is_actived = 0`. Staff-api đọc qua `getConfigByCode` có lọc `is_actived = 1` (`matthews-staff-api/Modules/TimeWorkingStaff/Models/ConfigGeneralTable.php:68-82`) ⇒ trả null ⇒ luôn dùng mặc định **25** → giá trị "Đến ngày" nhập trên portal **không có tác dụng** trên API sau lần lưu đầu tiên (suy luận từ code; cần kiểm chứng dữ liệu).
- Portal `TimeSheetRepo.php:91-92` gọi `getConfigByCode` trên `Modules\Shift\Models\ConfigGeneralTable` (import ở `TimeSheetRepo.php:25`) nhưng model này chỉ có `getConfig`, `getInfoByCode`, `edit` ⇒ có khả năng ném `BadMethodCallException` (chưa kiểm chứng khi chạy).
- `checkin_with_image`: UI chỉ bật/tắt `is_actived`, còn `config_general_value` bị ẩn. API cần **cả** `is_actived = 1` **và** `value = 1` thì mới bắt buộc chụp ảnh.

#### 1.4 Tab "Cấu hình chấm công linh động" (nhân viên miễn kiểm tra wifi/GPS)

| Mục | Giá trị |
|---|---|
| URL | `GET /shift/config-general/free` — `shift.config-general-free` (`routes/web.php:199`) |
| Controller | `ConfigGeneralController@free` (`:59-67`) → `ConfigGeneralRepo::getListStaffFree` → `StaffTable::getListStaffFree` (`Modules/Shift/Models/StaffTable.php:120-152`) |
| View | `config-general/free.blade.php` + include `config-general/list_staff.blade.php` |
| Ajax list | `POST shift.get-staff-free` (`routes/web.php:200`) → `listStaffFree` (`:106-114`) render `list_staff` (PioTable `free.blade.php:94-96`) |

- **Ý nghĩa nghiệp vụ**: nhân viên có `staffs.check_in_limit = 0` được check-in/out **không bị kiểm tra wifi/GPS**. Staff-api: `if ($checkInLimit !== 0) checkWithWifi(...)` khi check-in (`TimeWorkingStaffRepo.php:1254-1257`) và check-out (`:1442-1445`).
- **Bộ lọc**: `search` (text, placeholder "Nhập tên nhân viên") — LIKE trên `full_name`, `user_name`, `phone1` (`StaffTable.php:142-148`). Nút "SEARCH".
- **Điều kiện list**: `staffs.is_actived = 1`, `is_deleted = 0`, `check_in_limit = 0`, sắp xếp `full_name ASC`, phân trang `PAGING_ITEM_PER_PAGE`.
- **Cột** (`list_staff.blade.php:4-11, 20-76`): # (STT theo trang); avatar + họ tên (link `admin.staff.show`) + phòng ban; "Tài khoản" (`user_name`); "Chức vụ" (`staff_title_name`); "Chi nhánh" (`branch_name`); icon thùng rác.
- **Icon thùng rác** → `configStaff.remove(staff_id)` (`script.js:136-178`): swal xác nhận "Are you sure you want to remove this staff from the configuration?" → `POST shift.config-general.remove-config-staff` (`routes/web.php:204`) → `removeConfigStaff` (`:186-190`) → repo `:157-167`: `UPDATE staffs SET check_in_limit = 1 WHERE staff_id = ?` → reload trang.
- **Nút "Thêm nhân viên"** (`free.blade.php:19-25`) → `configStaff.showModalAddStaff()` (`script.js:67-77`) → `POST shift.get-modal-staff-free` (`routes/web.php:201`) → `showModalAddStaff` (`:127-140`) render `modal_add_staff` với `type = 'free'` và list `getListStaffNotFree` (`StaffTable.php:154-189`: nhân viên đang hoạt động có `check_in_limit != 0 OR NULL`).
  - Popup "Cấu hình nhân viên" (`modal_add_staff.blade.php`): ô tìm kiếm `search-modal` (LIKE `full_name`/`user_name`/`phone1`), bảng `list_staff_modal` có checkbox "chọn tất cả" (`#selectAll`) và checkbox từng dòng + hidden `modal_staff_id` (`list_staff_modal.blade.php:6-11, 32-38, 92-98`). PioTable của popup gọi `POST shift.get-list-staff-not-free` (`modal_add_staff.blade.php:61-64`, `routes/web.php:202`, controller `:171-179`).
  - Nút "HỦY" đóng popup; nút "Thêm nhân viên vào cấu hình" → `configStaff.save()` (`script.js:90-135`): gom staff có checkbox checked (chỉ ở trang đang xem); nếu rỗng → swal "Please select staff!"; `POST shift.config-general.add-config-staff` (`routes/web.php:203`) `{arr_staff}` → `addConfigStaff` (`:181-185`) → repo `editStaffFree` (`:142-155`): `UPDATE staffs SET check_in_limit = 0` cho từng id → swal + reload.
- Bảng ảnh hưởng: `staffs.check_in_limit` (0 = linh động/miễn kiểm tra; 1 hoặc NULL = phải kiểm tra wifi/GPS).

#### 1.5 Tab "Danh sách nhân viên không cần duyệt lịch làm việc"

| Mục | Giá trị |
|---|---|
| URL | `GET /shift/config-general/approved` — `shift.config-general-approved` (`routes/web.php:206`) |
| Controller | `ConfigGeneralController@approved` (`:75-84`), set `need_approve = 0` → `StaffTable::getListStaffApproved` (`StaffTable.php:270-308`) |
| View | `config-general/approved.blade.php` + `list_approved.blade.php` |
| Ajax list | `POST shift.get-staff-approved` (`routes/web.php:207`) → `listStaffApproved` (`:116-125`) |

- **Ý nghĩa nghiệp vụ**: `staffs.check_approved_time_working = 0` ⇒ lịch làm việc nhân viên tự tạo/đổi ca/đăng ký tăng ca trên app được duyệt luôn (`time_working_staff_status = 'approved'`), ngược lại `waiting` chờ quản lý duyệt. Staff-api: `timeLateSoonStaff` (`TimeWorkingStaffRepo.php:709-716`), `changeShift` (`:901-907`, thêm điều kiện người thao tác là quản lý; `:1003` bỏ gửi noti), `createTimeWorkingStaff` (`:1658`), `storeOvertime` (`:2106`), `addShiftStaff` (`:2278`).
- **Bộ lọc**: `search` như mục 1.4.
- **Điều kiện list**: nhân viên hoạt động, `check_approved_time_working = 0` (`StaffTable.php:298-300`).
- **Cột**: giống `list_staff` (`list_approved.blade.php:4-76`).
- **Icon thùng rác** → `configStaffNotNeedApproved.remove(staff_id)` (`script.js:228-270`): swal "Are you sure you want to remove this staff from the configuration without approval?" → `POST shift.config-general.remove-config-staff-not-need-approved` (`routes/web.php:215`) → repo `:208-218`: `UPDATE staffs SET check_approved_time_working = 1`.
- **Nút "Thêm nhân viên"** → `configStaff.showModalAddStaffApproved()` (`script.js:78-88`) → `POST shift.get-modal-staff-approved` (`routes/web.php:210`) → `showModalAddStaffApproved` (`:142-156`), `need_approve = 1`, `type = 'approved'` → `getListStaffNotApproved` thực chất gọi `getListStaffApproved` (`ConfigGeneralRepo.php:189-194`) với điều kiện `check_approved_time_working = 1 OR NULL`.
  - Nút "Thêm nhân viên vào cấu hình" → `configStaffNotNeedApproved.save()` (`script.js:182-227`) → `POST shift.config-general.add-config-staff-not-need-approved` (`routes/web.php:214`) → repo `editStaffNotNeedApproved` (`:195-207`): `UPDATE staffs SET check_approved_time_working = 0`.
- **Lỗi/bất thường**:
  - `StaffTable.php:302-303`: `->where(check_approved_time_working, 1)->orWhereNull(...)` không bọc trong closure ⇒ `OR` phá các điều kiện `is_actived`/`is_deleted` ⇒ popup có thể hiện cả nhân viên đã nghỉ/xoá có cột NULL.
  - PioTable trong popup luôn dùng `shift.get-list-staff-not-free` (`modal_add_staff.blade.php:62-64`) ⇒ khi tìm kiếm/chuyển trang trong popup của tab "không cần duyệt" sẽ trả danh sách theo tiêu chí `check_in_limit` (sai danh sách).
  - Model `getListStaffNotApproved` (`StaffTable.php:309-341`) có nhưng không được dùng.

#### 1.6 Tab "Cấu hình ngày phép còn lại" (leave-day)

| Mục | Giá trị |
|---|---|
| URL | `GET /shift/config-general/time-keeping` — `shift.config-general-time-keeping` (`routes/web.php:208`) |
| Controller | `ConfigGeneralController@timeKeeping` (`:86-94`) → `ConfigGeneralRepo::getListStaffTimeKeeping` (`:173-188`) |
| View | `config-general/time_keeping.blade.php` + `list_staff_time_keeping.blade.php` |
| Ajax list | `POST shift.get-staff-time-keeping` (`routes/web.php:209`) → `getStaffTimeKeeping` (`:95-103`) |

- Nút "Thêm nhân viên" bị comment (`time_keeping.blade.php:18-26`).
- **Bộ lọc**: `search` như trên. List: mọi nhân viên hoạt động (`StaffTable.php:343-368`); với mỗi dòng gọi `LeaveDayTable::getInfoLeaveDay(staff_id, 'P')` (query trong vòng lặp, lấy bản ghi đầu tiên **không lọc theo năm**) (`ConfigGeneralRepo.php:178-185`).
- **Cột** (`list_staff_time_keeping.blade.php:4-14, 71-77`): #, nhân viên, Tài khoản, Chức vụ, Chi nhánh, "Tổng số ngày phép năm" (`total_leave_day`), "Số ngày phép năm đã nghỉ" (`total_using_leave_day`), "Số ngày phép năm còn lại" (`total_using_remaining_day`), "Năm" (`staff_leave_day_year`); mặc định 0 nếu chưa có bản ghi.
- **Icon sửa** (`la-edit`, title "Delete") → `configStaff.showModalEditLeaveDay(staff_id)` (`:79-83`) — **hàm không tồn tại** trong `script.js` ⇒ bấm không có tác dụng (lỗi JS). Route đi kèm `POST shift.get-modal-staff-time-keeping` (`routes/web.php:211`) → `showModalAddStaffTimeKeeping` (`:158-170`) render view `shift::config-general.modal_edit_staff_time_keeping` — **file view không tồn tại** trong `Resources/views/config-general/`. Route lưu `POST shift.config-general.add-config-staff-leave-day` (`routes/web.php:213`) → `addConfigStaffLeaveDay` (`:192-217`): nếu có `sf_leave_day_id` thì update, không thì insert `sf_leave_day` (`shift_code='P'`, `staff_id`, `total_leave_day`, `total_using_leave_day`, `total_using_remaining_day`, `staff_leave_day_year = date('Y')`); không validate. ⇒ Chức năng sửa ngày phép **chưa hoàn thiện trên UI**, chỉ backend có.

**`generateTimeKeeping`** (`POST shift.config-general.generate-time-keeping`, `routes/web.php:212`; `ConfigGeneralController.php:218-239`):
- Lấy tất cả nhân viên hoạt động (`StaffTable::getAllStaff`, `StaffTable.php:201-240`); với mỗi người: `total = 12`; nếu có `offical_working_day` khác `0000-00-00` thì `total = round(số ngày từ ngày chính thức tới hôm nay / 30)`; rồi **insert** `sf_leave_day` (`shift_code='P'`, `total_leave_day = total`, `total_using_leave_day = 0`, `total_using_remaining_day = total`, `staff_leave_day_year = năm hiện tại`).
- Vấn đề: `getAllStaff` không select `offical_working_day` ⇒ thực tế luôn là **12**; không kiểm tra trùng ⇒ gọi lại sẽ nhân đôi bản ghi; không trả response; không kiểm quyền; nút gọi đã bị comment (chỉ gọi được bằng POST thủ công).

**Bảng `sf_leave_day`** (`Models/LeaveDayTable.php:17-28`): `sf_leave_day_id` PK, `shift_id`, `shift_code` (luôn `'P'` = nghỉ phép năm), `staff_id`, `total_leave_day` (tổng phép năm), `total_using_leave_day` (đã dùng), `total_using_remaining_day` (còn lại), `staff_leave_day_year`.
Nơi dùng khác: `TimeSheetRepo.php:128` (bảng công), `TimeWorkingStaffRepo.php:758` (`addShift`), `:1048-1062` (`removeShift`: khi xoá ca `P`/`1/2` thì **cộng** vào `total_using_leave_day` và **trừ** `total_using_remaining_day` — chiều cập nhật có vẻ ngược, cần xác nhận nghiệp vụ), `:2513`, `:3006-3013`, `:3053-3060` (báo cáo/xuất theo năm); staff-api `TimeWorkingStaffRepo.php:803, 1656, 1857, 2238`.

---

### 2. Cấu hình thông báo chấm công (`sf_timekeeping_notification`)

#### 2.1 View nào được dùng — `config/` hay `config-shift/`?
- Controller render `shift::config-shift.index` (`ConfigNotiController.php:36`), `shift::config-shift.edit` (`:51`), popup `shift::config-shift.popup.edit-message` (`Repositories/ConfigNoti/ConfigNotiRepository.php:34`).
- Thư mục `Resources/views/config/` (index, edit, popup/edit-message) **giống hệt** `config-shift/` (`diff -r` không khác) và **không được tham chiếu ở đâu** (grep `shift::config.` không có kết quả) ⇒ `views/config/` là code thừa; `views/config-shift/` **đang dùng**.
- Màn hình được mở từ tab "Chấm công" trong cấu hình thông báo của ManagerWork: `Modules/ManagerWork/Resources/views/config-noti/index.blade.php:59`, `edit.blade.php:53`.

#### 2.2 Màn xem "Cấu hình thông báo tự động" — tab Chấm công

| Mục | Giá trị |
|---|---|
| URL | `GET /shift/config-noti` — `config-noti` (`routes/web.php:189`) |
| Controller | `ConfigNotiController@index` (`:31-42`; khi exception gọi `dd()`) → `ConfigNotiRepository::getListNoti` (`:16-20`) → `SfTimekeepingNotificationTable::getAll` (`is_deleted = 0`, `Models/SfTimekeepingNotificationTable.php:46-50`) |
| View | `config-shift/index.blade.php` |
| JS | `static/backend/js/manager-work/manage-config/script-noti.js` (của ManagerWork; màn này không có hành động JS nào) |

- Tab trên cùng (`index.blade.php:51-64`): "Cấu hình chung" (`route('config')`), "Công việc" (`manager-work.manage-config.notification`), "Chấm công" (active), "Hợp đồng" (`route('config', ['tab'=>'contract'])`). Không kiểm quyền.
- Nút "Chỉnh sửa cấu hình" → link `config-noti.edit` (`:42-47`).
- **Bảng** (`:68-116`), tất cả checkbox `disabled`:

| Cột | Nguồn |
|---|---|
| # | STT |
| THÔNG BÁO CÁC HẠNG MỤC BÊN DƯỚI CHO | `sf_timekeeping_notification_title_show` |
| MÔ TẢ | `sf_timekeeping_notification_desc` |
| HÌNH THỨC THÔNG BÁO (2 cột) | checkbox `is_email` + icon phong bì; checkbox `is_noti` + icon chuông |
| TIÊU ĐỀ THÔNG BÁO | `sf_timekeeping_notification_title` |
| NỘI DUNG THÔNG BÁO | `sf_timekeeping_notification_content` |
| TRẠNG THÁI | checkbox `is_active` |

#### 2.3 Màn chỉnh sửa

| Mục | Giá trị |
|---|---|
| URL | `GET /shift/config-noti/edit` — `config-noti.edit` (`routes/web.php:190`) |
| Controller | `ConfigNotiController@edit` (`:48-54`) |
| View | `config-shift/edit.blade.php` |
| JS | `autoNumeric.min.js` + `static/backend/js/shift/config-noti/script.js` (object `Config`) |

- Bảng giống màn xem nhưng checkbox **được bật**, thêm cột icon bút (`edit.blade.php:83-122`). Form `#form-config-noti`, field name dạng mảng:
  - `noti[{id}][sf_timekeeping_notification_id]` (hidden)
  - `noti[{id}][is_email]` (checkbox, value="0" nhưng backend chỉ dùng `isset`)
  - `noti[{id}][is_noti]` (checkbox)
  - `noti[{id}][is_active]` (checkbox)
- **Nút "Chỉnh sửa cấu hình"** (`managerwork::managerwork.edit_config`, `edit.blade.php:42-48`) → `Config.updateConfigNoti()` (`script.js:57-73`) → `POST config-noti.update-noti` (`routes/web.php:193`), data `$('#form-config-noti').serialize()` → `ConfigNotiRepository::updateNoti` (`:79-105`): với mỗi phần tử `noti[]` cập nhật `is_noti`, `is_email`, `is_active` = 1 nếu có trong request, ngược lại 0. Thành công "Cập nhật cấu hình thành công" → chuyển về `config-noti`.
- **Icon bút** → `Config.editMessage(id)` (`script.js:2-37`) → `POST config-noti.show-popup` (`routes/web.php:191`) → `ConfigNotiRepository::showPopup` (`:27-46`) render popup `config-shift/popup/edit-message.blade.php`, gắn vào `.append-popup`, mở `#edit_message`.

**Popup "Cập nhật thông báo"** (`popup/edit-message.blade.php`), form `#form-update`:

| Nhãn | name | Kiểu | Ghi chú |
|---|---|---|---|
| `managerwork::managerwork.notice_items` | `sf_timekeeping_notification_title` | text | Tiêu đề |
| `managerwork::managerwork.content_notification` | `sf_timekeeping_notification_content` | textarea 10 dòng | in raw `{!! !!}` |
| "Thời gian gửi" | `type_send` | select: `0` → "=", `1` → "<", `2` → ">" | (`:21-25`) |
| (cạnh select) | `time_send` | text, AutoNumeric số nguyên ≥ 0 (`script.js:14-21`) | `disabled` khi `type_send = 0`; đổi select về 0 thì set 0 và disable (`script.js:23-30`) |
| hidden | `sf_timekeeping_notification_id` | | |

- Nút "Lưu" → `Config.changeMessage()` (`script.js:39-55`) → `POST config-noti.update-message` (`routes/web.php:192`), data serialize form → `ConfigNotiRepository::updateMessage` (`:53-72`): bỏ dấu `,` của `time_send` (không gửi thì = 0), update mọi field còn lại trong request vào bảng. Thành công "Cập nhật thông báo thành công" → reload.
- **Không có validate** JS hay backend. Repository bắt `Modules\Admin\Libs\SmsFpt\TechAPI\src\TechAPI\Exception` (`ConfigNotiRepository.php:7`) chứ không phải `\Exception` ⇒ lỗi DB thông thường sẽ không được bắt.
- Ngữ nghĩa `type_send` (=/</>) và đơn vị `time_send` (phút?) **chưa xác định** — không tìm thấy code gửi thông báo nào đọc bảng này trong `matthews-portal-new`, `matthews-staff-api`, `api-loyalty-new` (grep `sf_timekeeping_notification` chỉ ra model/view/repo của màn này). Danh sách loại thông báo và **biến template** cũng chỉ nằm trong DB ⇒ **chưa xác định**.

#### 2.4 Bảng `sf_timekeeping_notification` (`Models/SfTimekeepingNotificationTable.php:20-41`)
`sf_timekeeping_notification_id` PK; `sf_timekeeping_notification_title_show` (tên hạng mục); `sf_timekeeping_notification_desc`; `sf_timekeeping_notification_title`; `sf_timekeeping_notification_content`; `is_email` (0/1); `is_noti` (0/1); `avatar`; `type` (loại – giá trị chưa xác định); `type_send` (0 '=', 1 '<', 2 '>'); `time_send` (số); `is_active` (0/1); `is_deleted` (0/1); audit.

---

### 3. Cấu hình chấm công wifi/GPS (`sf_timekeeping_config`)

#### 3.1 Màn hình danh sách

| Mục | Giá trị |
|---|---|
| URL | `GET /shift/timekeeping-config` — `timekeeping-config` (`routes/web.php:163`) |
| Controller | `TimekeepingConfigController@index` (`:34-43`) → `TimekeepingConfigRepo::list` → `TimekeepingConfigTable::getList` (ListTableTrait) |
| View | `timekeeping-config/index.blade.php` + `list.blade.php` |
| JS | `js/shift/timekeeping-config/script.js`, `work.js`, `js/huniel.js`, `autoNumeric.min.js` (`index.blade.php:129-135`) |
| Ajax list | `POST timekeeping-config.list` (`routes/web.php:164`) → `listAction` (`:71-86`) |

- `work.js` là code chép từ màn khác (gọi route `customer-lead.search-work-lead`, `manager-work.*`) — **không liên quan**, không được gọi ở màn này.
- `index.blade.php:141-143`: nếu URL có `?id=` gọi `listTimekeepingConfig.detail(id)` — **hàm không tồn tại** trong `script.js` (lỗi JS). Route `timekeeping-config.show` (`routes/web.php:170`) trỏ tới `TimekeepingConfigController@show` — **method không tồn tại**.

**Bộ lọc** (`TimekeepingConfigController::filters`, `:50-63`; render `index.blade.php:86-107`):
- `sf_timekeeping_config$branch_id` — select2 chi nhánh, option đầu "Chọn chi nhánh" (rỗng) + các chi nhánh `branches.is_actived = 1, is_deleted = 0` (`Models/BranchTable.php:27-40`). Chọn là tự submit (`index.blade.php:149-153`). ListTableTrait đổi `$` → `.` thành `WHERE sf_timekeeping_config.branch_id = ?` (`lib/mycore/src/MyCore/Models/Traits/ListTableTrait.php:31-38`).
- Nút "TÌM KIẾM". Model có xử lý `search` theo cột `shift_name` (`TimekeepingConfigTable.php:67-72`) — bảng không có cột này, nhưng UI không có ô search nên không phát sinh.
- Điều kiện cố định: `is_deleted = 0`, sắp xếp `timekeeping_config_id DESC` (`TimekeepingConfigTable.php:47-81`).

**Cột bảng** (`list.blade.php:4-53`):

| Cột | Hiển thị |
|---|---|
| # | STT theo trang |
| Loại chấm công | `wifi` → "Wifi", khác → "GPS" |
| Tọa độ | rỗng nếu wifi; GPS: `latitude,longitude` |
| Tên wifi | `wifi_name` |
| Địa chỉ IP | `wifi_ip` |
| CHI NHÁNH | `branch_name` |
| Trạng thái | switch `m-switch--success` (checked khi `is_actived = 1`) |
| Ghi chú | `str_limit(note,100)` in raw `{!! !!}` (không escape) |
| Hành động | icon sửa, icon xoá |

**Switch trạng thái** → `listTimekeepingConfig.changeStatus(this, id)` (`script.js:43-67`) → `POST timekeeping-config.change-status` (`routes/web.php:171`) → repo `changeStatus` (`TimekeepingConfigRepo.php:247-265`): `UPDATE sf_timekeeping_config SET is_actived = ?`. Thông báo "Thay đổi trạng thái thành công/thất bại", refresh bảng.

**Icon xoá** → `listTimekeepingConfig.remove(id)` (`script.js:12-42`): swal "Bạn có muốn xóa không?" → `POST timekeeping-config.destroy` (`routes/web.php:169`) → repo `destroy` (`:207-225`): xoá mềm `is_deleted = 1`. "Xóa thành công/thất bại".

**Nút "THÊM CẤU HÌNH CHẤM CÔNG"** → `create.popupCreate()` (`script.js:85-102`) → `POST timekeeping-config.create` (`routes/web.php:165`) → repo `dataViewCreate` (`:80-95`) render `popup-create`; gắn vào `#my-modal`, select2 cho `#branch_id`.

**Icon sửa** → `edit.popupEdit(id)` (`script.js:198-217`) → `POST timekeeping-config.edit` (`routes/web.php:167`) → repo `dataViewEdit` (`:140-158`) render `popup-edit` với dữ liệu `getInfo` (`TimekeepingConfigTable.php:100-117`).

#### 3.2 Popup Thêm / Sửa

Form `#form-register` (thêm, `popup-create.blade.php`) / `#form-edit` (sửa, `popup-edit.blade.php`).

| Nhãn | name | Kiểu | Hiện khi | Mặc định |
|---|---|---|---|---|
| "Chi nhánh làm việc" * | `branch_id` | select2 chi nhánh hoạt động | luôn | trống (thêm) / chi nhánh hiện tại (sửa) |
| "Chấm công bằng WIFI" / "Chấm công bằng GPS" | `timekeeping_type` | radio `wifi` / `gps` | luôn | `wifi` (thêm) |
| "Tên wifi" * | `wifi_name` | text | `wifi` | |
| "Địa chỉ IP" * | `wifi_ip` | text, placeholder "Vd: 42.114.204.250" | `wifi` | |
| "Ghi chú" | `note` | textarea | `wifi` | |
| Nút "Lấy địa chỉ IP từ wifi hiện tại" | – | link mở `https://whatismyipaddress.com/` tab mới | `wifi` | |
| "Vĩ độ" * | `latitude` | text | `gps` | `' '` |
| "Kinh độ" * | `longitude` | text | `gps` | `' '` |
| "Bán kính cho phép (m)" | `allowable_radius` | number | `gps` | trống; backend mặc định **100** (`TimekeepingConfigRepo.php:18,111,182`) |
| "Ghi chú" | `note_gps` | textarea | `gps` | |

- Đổi radio → `onTimeKeepingTypeChange` (`index.blade.php:156-181`): ẩn/hiện `.group-wifi`/`.group-gps`, xoá thông báo lỗi; trong `#form-register` gán `' '` cho field của nhóm bị ẩn và rỗng cho nhóm được chọn (mẹo để vượt `required`). Selector chỉ áp cho `#form-register` ⇒ ở popup sửa không xoá/điền giá trị.
- **Lấy IP hiện tại**: JS `view.getCurrentIp()` (`script.js:70-82`) gọi `POST timekeeping-config.get-current-ip` (`routes/web.php:174`) → `TimekeepingConfigRepo::currentIp` (`:232-239`) chạy `shell_exec("dig +short myip.opendns.com @resolver1.opendns.com")` ⇒ trả **IP public của server portal**, không phải của người dùng. Hàm JS này **không được gọi** từ view nào; nút trên popup chỉ là link ngoài whatismyipaddress.com.

**Validate JS** (jQuery validate, `script.js:103-154` thêm có `ignore: []`; `:218-269` sửa dùng ignore mặc định nên bỏ qua field ẩn):

| Field | Rule | Message (key `translate`) |
|---|---|---|
| `wifi_name` | required, maxlength 190 | "Hãy nhập tên wifi" / "Tên wifi tối đa 190 kí tự" |
| `wifi_ip` | required, maxlength 190 | "Hãy nhập địa chỉ ip" / "Địa chỉ ip tối đa 190 kí tự" |
| `latitude` | required, maxlength 50 | "Hãy nhập kinh độ" (gán nhầm, latitude là vĩ độ) / "Kinh độ tối đa 50 kí tự" |
| `longitude` | required, maxlength 50 | "Hãy nhập vĩ độ" / "Kinh độ tối đa 50 kí tự" |
| `branch_id` | required | "Hãy chọn chi nhánh" |

Việc giá trị `' '` có vượt được `required` hay không phụ thuộc phiên bản jquery-validate (có trim hay không) — **chưa xác định**.

**Validate backend** — `Http/Requests/TimekeepingConfig/StoreRequest.php:32-68` và `UpdateRequest.php:32-69`:

| Field | Rule | Message |
|---|---|---|
| `wifi_name` | `required_if:timekeeping_type,wifi`, `max:190`, `unique:sf_timekeeping_config,wifi_name,{id},timekeeping_config_id,is_deleted,0,timekeeping_type,wifi` (duy nhất trong các cấu hình wifi chưa xoá, trên mọi chi nhánh) | "Hãy nhập tên wifi", "Tên wifi tối đa 190 kí tự", "Tên wifi đã tồn tại" |
| `wifi_ip` | `required_if:timekeeping_type,wifi`, `max:190` | "Hãy nhập địa chỉ ip", "Địa chỉ ip tối đa 190 kí tự" |
| `branch_id` | required | "Hãy chọn chi nhánh" |
| `timekeeping_type` | required, in `wifi,gps` | "Hình thức chấm công không hợp lệ" |
| `latitude` | `required_if:timekeeping_type,gps` | "Hãy nhập kinh độ" (gán nhầm) |
| `longitude` | `required_if:list_type,gps` — **sai tên field** (`list_type` không tồn tại) ⇒ thực tế không bắt buộc | "Hãy nhập vĩ độ" |

- UpdateRequest khai báo message theo key `wifi_name.required`/`wifi_ip.required` trong khi rule là `required_if` ⇒ dùng message mặc định của Laravel.
- Hàm `filters()` (strip_tags|trim) trong 2 request: không thấy package sanitizer trong `composer.json` ⇒ nhiều khả năng **không có tác dụng**.
- Không kiểm tra định dạng IP/toạ độ, không kiểm tra `allowable_radius > 0`.
- Lỗi 422: JS gộp `responseJSON.errors` hiển thị swal "Thêm mới thất bại"/"Chỉnh sửa thất bại".

**Lưu — backend**
- Thêm (`POST timekeeping-config.store`, `routes/web.php:166`; repo `store` `:103-130`): insert `timekeeping_type`, `latitude`, `longitude`, `allowable_radius` (mặc định 100), `wifi_name`, `wifi_ip`, `branch_id`, `note` (= `note_gps` nếu gps, ngược lại `note`), `is_actived = 1`. Không xoá các field của loại không chọn (dựa vào JS gửi `' '`).
- Sửa (`POST timekeeping-config.update`, `routes/web.php:168`; repo `update` `:166-198`): wifi → set `wifi_name`, `wifi_ip`, xoá `latitude/longitude/allowable_radius` = null; gps → ngược lại; `allowable_radius` mặc định 100; `note` theo loại.
- Store/update trả `response()->json` ngay trong repo; message "Tạo thành công/thất bại", "Chỉnh sửa thành công/thất bại".

#### 3.3 Bảng `sf_timekeeping_config` (`Models/TimekeepingConfigTable.php:19-36`)

| Cột | Ý nghĩa |
|---|---|
| `timekeeping_config_id` | PK |
| `branch_id` | Chi nhánh áp dụng |
| `timekeeping_type` | `wifi` / `gps` (staff-api enum còn có `time-attendance`, `free` — `matthews-staff-api/Modules/TimeKeeping/Enum/TimeKeepingTypeEnum.php:9-12`, portal không tạo) |
| `wifi_name` | Tên wifi (chỉ để hiển thị trong thông báo lỗi trên app) |
| `wifi_ip` | IP public của wifi văn phòng — giá trị dùng để so khớp |
| `latitude`, `longitude` | Toạ độ văn phòng |
| `allowable_radius` | Bán kính cho phép (mét) |
| `note` | Ghi chú |
| `is_actived` | 1 hoạt động / 0 tắt |
| `is_deleted` | 0 / 1 (xoá mềm) |

Không có cột BSSID; không có cấu hình ảnh ở bảng này (ảnh check-in nằm ở key `checkin_with_image` của `sf_config_general`).

#### 3.4 Cấu hình này được dùng ở đâu (API check-in mobile)

`matthews-staff-api`:
- Lấy cấu hình theo chi nhánh của ca: `TimeKeepingConfigTable::getConfig($branchId)` — chỉ `is_actived = 1`, `is_deleted = 0` (`Modules/TimeKeeping/Models/TimeKeepingConfigTable.php:12-18`).
- Check-in `checkinLog` (`Modules/TimeWorkingStaff/Repositories/TimeWorkingStaff/TimeWorkingStaffRepo.php:1213-1220, 1254-1257`) và check-out `checkOutLog` (`:1437-1445`): nếu `Auth::user()->check_in_limit !== 0` thì gọi `checkWithWifi($configs, access_point_ip, latitude, longitude)`.
- `checkWithWifi` (`:2856-2900`):
  1. Chi nhánh không có cấu hình nào → lỗi `BRANCH_NOT_CONFIGURED_FOR_CHECK_IN` "Chi nhánh chưa cấu hình chấm công.".
  2. Lọc cấu hình wifi; `getCurrentConfig` so `wifi_ip == access_point_ip` do app gửi lên (`:2921-2929`). Khớp → hợp lệ (`distance = 0`). `wifi_name` **không** được so khớp.
  3. Không khớp wifi → lọc cấu hình GPS; `checkWithGPS` (`:2902-2920`) tính khoảng cách bằng `Helpers::distance` (công thức Vincenty, bán kính trái đất 6.371.000 m, kết quả mét — `Modules/TimeKeeping/Helpers/Helpers.php:15-31`); hợp lệ nếu `allowable_radius >= distance`.
  4. Lỗi: có wifi + GPS mà đều không khớp → "Vui lòng kết nối với wifi :wifi_name hoặc đến gần văn phòng để check-in/checkout"; chỉ có GPS → "Vui lòng đến gần văn phòng để check-in/checkout"; chỉ có wifi → "Vui lòng kết nối với wifi :wifi_name để check-in/checkout" (`:2876-2893`; `:wifi_name` ghép từ tất cả wifi của chi nhánh, `:2930-2937`).
- Log check-in/out lưu thêm `wifi_ip`, `wifi_name` từ dữ liệu app (`:1355-1356`, `:1590-1591`).

---

### 4. Thưởng phạt (`sf_recompense`)

#### 4.1 Màn hình danh sách

| Mục | Giá trị |
|---|---|
| URL | `GET /shift/recompense` — `shift.recompense` (`routes/web.php:219`) |
| Controller | `RecompenseController@index` (`:32-41`; `filters()` trả mảng rỗng) → `RecompenseRepo::getList` → `RecompenseTable::getList` |
| View | `recompense/index.blade.php` + `recompense/list.blade.php` |
| JS | `js/shift/recompense/script.js` (object `listRecompense`) |
| Ajax list | `POST shift.recompense.list` (`routes/web.php:220`) → `listAction` (`:60-75`; truyền **toàn bộ** `$request->all()` vào getList) |
| Tiêu đề | "DANH SÁCH THƯỞNG PHẠT" |

- **Bộ lọc**: `search` (text, "Nhập thông tin tìm kiếm") — LIKE `recompense_name` (`RecompenseTable.php:59-64`). Nút "TÌM KIẾM".
- Điều kiện: `is_deleted = 0`, join `staffs` theo `created_by`, sắp xếp `recompense_id DESC` (`RecompenseTable.php:42-67`).
- **Cột** (`list.blade.php:4-58`):

| Cột | Hiển thị |
|---|---|
| (thao tác) | icon sửa (quyền `shift.recompense.show-pop-edit` và `is_system = 0`), icon xoá (quyền `shift.recompense.destroy` và `is_system = 0`) |
| LOẠI | `R` → "Thưởng", `P` → "Phạt" |
| NỘI DUNG | `recompense_name` |
| NGƯỜI TẠO | `staffs.full_name` của `created_by` |
| NGÀY TẠO | `created_at` dạng `d/m/Y H:i` |
| TRẠNG THÁI | switch success, checked khi `is_actived = 1` |

- **Switch trạng thái** (hiện cả với bản ghi hệ thống) → `listRecompense.changeStatus` (`script.js:11-35`) → `POST shift.recompense.change-status` (`routes/web.php:232`) → repo `changeStatus` (`RecompenseRepo.php:149-167`): `UPDATE sf_recompense SET is_actived`. "Thay đổi trạng thái thành công/thất bại".
- **Icon xoá** → `listRecompense.remove` (`script.js:36-64`), swal "Bạn có muốn xóa không?" → `POST shift.recompense.destroy` (`routes/web.php:230`) → repo `destroy` (`:123-141`): xoá mềm `is_deleted = 1`. "Xoá thành công/thất bại". Backend **không chặn** bản ghi `is_system = 1` và không kiểm tra bản ghi đang được dùng ở `sf_time_working_staff_recompense`.
- **Nút "THÊM THƯỞNG PHẠT"** → `listRecompense.showPopCreate` (`script.js:65-78`) → `POST shift.recompense.show-pop-create` (`routes/web.php:222`) → `showPopCreateAction` (`:82-89`) render `recompense/create.blade.php`.
- **Icon sửa** → `listRecompense.showPopEdit(id)` (`script.js:136-149`) → `POST shift.recompense.show-pop-edit` (`routes/web.php:226`) → `showPopEditAction` (`:110-120`) → repo `getDataEdit` (`:76-86`) → render `recompense/edit.blade.php`.

#### 4.2 Popup Thêm / Sửa

| Nhãn | name | Kiểu | Option / mặc định | Có ở |
|---|---|---|---|---|
| (loại) | `type` | radio | `R` "Thưởng" (mặc định khi thêm), `P` "Phạt" | thêm, sửa |
| "Tên nội dung" * | `recompense_name` | text | | thêm, sửa |
| "Trạng thái" | `is_actived` | switch | theo bản ghi | chỉ sửa |

- **Validate JS** (`script.js:82-99` và `:153-170`): `recompense_name` required ("Hãy nhập tên nội dung"), maxlength 190 ("Tên nội dung tối đa 190 kí tự").
- **Validate backend** (`Http/Requests/Recompense/StoreRequest.php:30-48`, `UpdateRequest.php:30-50`): `recompense_name` `required|max:190|unique:sf_recompense,recompense_name,{id},recompense_id,is_deleted,0` — tên duy nhất trong các bản ghi chưa xoá, **không phân biệt loại** (Thưởng và Phạt không được trùng tên). Message: "Hãy nhập tên nội dung", "Tên nội dung tối đa 190 kí tự", "Tên nội dung đã tồn tại". `type` **không được validate** backend.
- **Lưu thêm** → `POST shift.recompense.store` (`routes/web.php:224`) → repo `store` (`RecompenseRepo.php:45-66`): insert `type`, `recompense_name`, `created_by`, `updated_by` (`is_actived`/`is_system` lấy mặc định DB — chưa xác định). "Thêm thành công/thất bại".
- **Lưu sửa** → `POST shift.recompense.update` (`routes/web.php:228`) → repo `update` (`:94-115`): cập nhật `type`, `recompense_name`, `is_actived`, `updated_by`. Không chặn `is_system = 1`.
- Sau khi lưu: swal, đóng popup, refresh PioTable; lỗi 422 hiển thị "Thêm thất bại"/"Chỉnh sửa thất bại" kèm danh sách lỗi.

#### 4.3 Bảng và nơi sử dụng

**`sf_recompense`** (`Models/RecompenseTable.php:18-31`): `recompense_id` PK; `recompense_name`; `type` (`R` = Thưởng, `P` = Phạt); `is_system` (1 = bản ghi hệ thống, ẩn nút sửa/xoá trên UI); `is_actived`; `is_deleted`; audit.

**Sử dụng**:
- Danh mục cho popup thêm thưởng/phạt vào một ngày làm việc ở màn lịch làm việc: `TimeWorkingStaffRepo::getDataCreateRecompense` dùng `RecompenseTable::getRecompense($type)` (chỉ `is_actived = 1`, `is_deleted = 0`) (`Modules/Shift/Repositories/TimeWorkingStaff/TimeWorkingStaffRepo.php:2413-2425`; `RecompenseTable.php:75-86`). Route: `shift.time-working-staff.show-pop-create-recompense`, `submit-create-recompense`, `remove-recompense`, `list-recompense` (`routes/web.php:72-81`).
- Bảng chi tiết **`sf_time_working_staff_recompense`** (`Modules/Shift/Models/TimeWorkingStaffRecompenseTable.php:18-29`): `time_working_staff_recompense_id`, `time_working_staff_id`, `recompense_id`, `money`, audit. Thêm ở `submitCreateRecompense` (`TimeWorkingStaffRepo.php:2435-2459`), xoá cứng ở `removeRecompense` (`:2469-2487`).
- Tính lương: `StaffSalaryController` (`Modules/StaffSalary/Http/Controllers/StaffSalaryController.php:563-595`) lấy `getRecompenseByStaff(staff_id, từ ngày, đến ngày)` (`Modules/StaffSalary/Models/TimeWorkingStaffRecompenseTable.php:22-38`, join `sf_time_working_staffs` chưa xoá, theo `working_day`) — `type = 'R'` cộng vào `staff_salary_bonus`, còn lại cộng vào `staff_salary_minus`. Việc tắt/xoá mềm danh mục **không** loại các khoản đã gán khỏi lương (query không lọc `r.is_actived`/`r.is_deleted`).

---

### 5. `views/config-shift` có được dùng không?

**Có.** `views/config-shift/index.blade.php`, `edit.blade.php`, `popup/edit-message.blade.php` được `ConfigNotiController` (`:36`, `:51`) và `ConfigNotiRepository` (`:34`) render. Thư mục **`views/config/`** mới là bản sao giống hệt và **không được dùng** ở đâu.

---

### 6. Tóm tắt lỗi / rủi ro

1. Không có kiểm quyền backend cho mọi action ghi (cấu hình chung, danh sách nhân viên, wifi/GPS, thưởng phạt, thông báo).
2. `close_time_working_end` luôn bị lưu `is_actived = 0` ⇒ API luôn dùng mặc định ngày 25.
3. `TimeSheetRepo.php:91-92` gọi method `getConfigByCode` không có trên model Shift.
4. Tab ngày phép: hàm JS `showModalEditLeaveDay` và view `modal_edit_staff_time_keeping` không tồn tại.
5. `generateTimeKeeping`: luôn 12 ngày, insert trùng, không kiểm quyền.
6. `getListStaffApproved` có `orWhereNull` không bọc closure; popup "không cần duyệt" phân trang/tìm kiếm sai route.
7. `TimekeepingConfig`: rule `longitude` dùng sai field `list_type`; message vĩ độ/kinh độ bị đảo; ghi chú in raw (XSS); route `show` không có method; `listTimekeepingConfig.detail` không tồn tại; `getCurrentIp` trả IP server; `work.js` là code thừa.
8. `ConfigNotiRepository` bắt sai lớp Exception; `index` dùng `dd()`; không có validate; không tìm thấy nơi gửi thông báo dùng bảng này.
9. Thưởng phạt: tên duy nhất không phân biệt loại; backend không chặn sửa/xoá bản ghi hệ thống.

---

---

# PHẦN III — STAFF API (matthews-staff-api) CHI TIẾT

## Phân tích CHẤM CÔNG – matthews-staff-api (API app nhân viên)

Repo: `/Users/mwang/WAO/BE/Matthew - BE/matthews-staff-api` (Laravel + nwidart modules). Chỉ đọc code, không sửa.
Đường dẫn file bên dưới viết tương đối từ gốc repo. `file:line` theo code hiện tại.

> Quy ước: "chưa xác định" = code không đủ để khẳng định. "(bug?)" = hành vi theo code có vẻ sai/không nhất quán, ghi lại để đối chiếu khi port.

---

### 0. Bối cảnh chung

#### 0.1 Prefix URL, middleware, format response
- Route các module được map qua `Route::middleware('api')->namespace(...)->group(Routes/api.php)` **không có prefix `/api`** (`Modules/TimeKeeping/Providers/RouteServiceProvider.php:64-66`, `Modules/TimeWorkingStaff/Providers/RouteServiceProvider.php:62-67`). URL thực tế: `/timekeeping/...`, `/time-working-staff/...`, `/timeoffdays/...`. (Prefix `/api` chỉ áp dụng cho `routes/api.php` gốc – `app/Providers/RouteServiceProvider.php:66-71`.)
- Nhóm middleware `api`: `SwitchDatabaseTenant` (multi-tenant, set DB theo tenant và **set timezone PHP theo bảng `config` key `timezone` của tenant** – `app/Http/Middleware/SwitchDatabaseTenant.php:159-165`), `bindings`, `DetectLanguage`, `S3UploadsRedirect` (`app/Http/Kernel.php:59-65`). Timezone mặc định app: `Australia/Melbourne` (`config/app.php:68`) nhưng bị override theo tenant. Mọi `Carbon::now()` trong chấm công dùng timezone này.
- Middleware `auth` = `Tymon\JWTAuth\Http\Middleware\AuthenticateAndRenew` (JWT, tự renew) (`app/Http/Kernel.php:82`). `Auth::id()` = `staffs.staff_id`.
- Format response (`lib/mycore/src/MyCore/Http/Response/ResponseFormatTrait.php:26-37`):
  ```json
  { "Data": <data|null khi lỗi>, "ErrorCode": 0|1, "ErrorDescription": "<message|'Xử lý thành công.'>", "ErrorData": <chỉ khi lỗi và có data> }
  ```
  `CODE_SUCCESS = 0`, `CODE_ERROR = 1`, `PAGING_ITEM_PER_PAGE = 30` (`config/constant.php:3-6`). HTTP status luôn 200 trừ 401 (UnauthorizedHttpException → `CODE_UNAUTHORIZED`, `app/Exceptions/Handler.php:94-97`).
- Lỗi validate FormRequest → `app/Exceptions/Handler.php:74-87`: trả `ErrorCode=1`, `ErrorDescription` = message lỗi đầu tiên, `ErrorData` = toàn bộ errors.
- Exception khác không bắt trong controller → `ErrorCode=1`, `ErrorDescription = $exception->getMessage()` (`Handler.php:99-104`).

#### 0.2 Hai "thế hệ" API chấm công song song
| | Luồng CŨ (module `TimeKeeping`) | Luồng MỚI (module `TimeWorkingStaff`) |
|---|---|---|
| URL | `/timekeeping/check-in`, `/timekeeping/check-out` | `/time-working-staff/check-in`, `/time-working-staff/check-out` |
| So khớp wifi | IP server nhìn thấy (`$request->ip()`) | `access_point_ip` do client gửi |
| Giới hạn giờ check-in | Không có | Có (`checkin_time_before`, `late_check_in`) |
| Nhiều lượt vào/ra/ca | Không | Có (`checking_type` 1..5, `checking_curent_step`) |
| Ảnh selfie, thiết bị | Không | Có (lưu `image_selfie`, `imei`, `device_name`, `platform`) |
| Bỏ qua kiểm tra vị trí | Không | `staffs.check_in_limit === 0` |
| Trạng thái ca sau checkout | Không đổi | Bước cuối → `not-confirm` |

Riêng `/timekeeping/shift` (lấy ca hiện tại) đã chuyển sang `getShiftV2` có trả `checking_curent_step`, `history` theo bước, `config.checkin_with_image` → nhiều khả năng app hiện tại dùng: **`/timekeeping/shift` + `/time-working-staff/check-in|check-out`** (chưa xác định 100% phía app).

#### 0.3 Bảng dữ liệu liên quan
| Bảng | Vai trò | Model |
|---|---|---|
| `sf_time_working_staffs` | 1 dòng = 1 ca làm việc của 1 nhân viên trong 1 ngày (lịch làm việc + kết quả chấm công) | `Modules/TimeKeeping/Models/TimeWorkingStaffTable.php`, `Modules/TimeWorkingStaff/Models/TimeWorkingStaffTable.php`, `Modules/TimeOffDays/Models/TimeWorkingStaffsTable.php` |
| `sf_shifts` | Định nghĩa ca (giờ bắt đầu/kết thúc, nghỉ trưa, `checking_type`, `shift_code`, hệ số…) | `Modules/TimeWorkingStaff/Models/ShiftsTable.php`, `Modules/TimeOffDays/Models/SFShiftsTable.php` |
| `sf_check_in_log` / `sf_check_out_log` | Log từng lượt vào/ra (có `checking_curent_step`, ảnh, GPS, wifi, thiết bị) | `TimeKeeping/Models/CheckInLogTable.php`, `CheckOutLogTable.php`; `TimeWorkingStaff/Models/CheckInLogTable.php`, `CheckOutLogTable.php`, `ShiftCheckInLogTable.php`, `ShiftCheckOutLogTable.php` |
| `sf_check_in_change_log` / `sf_check_out_change_log` | Log thay đổi giờ vào/ra khi quản lý chấm công hộ | `TimeWorkingStaff/Models/CheckInChangeLogTable.php`, `CheckOutChangeLogTable.php` |
| `sf_timekeeping_config` | Cấu hình điểm chấm công theo chi nhánh (wifi/gps) | `TimeKeeping/Models/TimeKeepingConfigTable.php` |
| `sf_config_general` | Cấu hình chung (ngưỡng trễ/sớm, kỳ công…) | `TimeKeeping/Models/ConfigGeneralTable.php`, `TimeWorkingStaff/Models/ConfigGeneralTable.php` |
| `sf_time_working_staffs_action_log` | Log thao tác trên ca | `TimeWorkingStaff/Models/TimeWorkingStaffActionLogTable.php` |
| `sf_leave_day` | Quỹ phép năm (P) | `TimeWorkingStaff/Models/LeaveDayTable.php` |
| `sf_shift_type` | Danh mục loại công (1, 1/2, P, P/2, …) | `TimeWorkingStaff/Models/ShiftTypeTable.php` |
| `staff_holiday` | Ngày lễ | `TimeKeeping/Models/StaffHolidayTable.php`, `TimeWorkingStaff/Models/StaffHolidayTable.php` |
| `staffs` | Cột dùng: `staff_manager_id`, `check_in_limit`, `check_approved_time_working`, `salt`… | `TimeWorkingStaff/Models/StaffTable.php` |
| `sf_map_shift_branch` | Ca áp dụng cho chi nhánh | dùng trong `ShiftsTable::downloadShifts` |
| `sf_recompense`, bảng work schedule | **Không tìm thấy** tham chiếu nào trong repo này (grep toàn repo). `work_schedule_id` chỉ là cột trên `sf_time_working_staffs`. |

Các module khác: `Modules/Chat/Repositories/ChatRepository.php:15-17` chỉ `use` các model TimeKeeping, không thấy gọi logic chấm công. Không có module nào khác dùng các bảng trên.

---

### 1. Danh sách API

#### 1A. Module TimeKeeping – `Modules/TimeKeeping/Routes/api.php:16-24` (middleware `auth`, prefix `timekeeping`)
Controller: `Modules/TimeKeeping/Http/Controllers/TimeKeepingController.php`. Mọi action bắt `Exception|QueryException` → `ErrorCode=1`, `ErrorDescription = message`.

##### 1A.1 `POST /timekeeping/shift` → `TimeKeepingController@getShiftAction` (Controller.php:31-42) → `TimeKeepingRepository::getShiftV2` (TimeKeepingRepository.php:915-966)
- Request: không có tham số (`GetCurrentShiftRequest` rules rỗng).
- Logic:
  1. `getCurrentShiftV2(Auth::id())` (TimeKeeping/Models/TimeWorkingStaffTable.php:362-420): lấy **1 ca đầu tiên** (order `working_time ASC`) của nhân viên thỏa: ngày hiện tại nằm trong `[working_day, working_end_day]` (hỗ trợ ca qua đêm), `time_working_staff_status = 'approved'`, `is_deducted IS NULL` (không phải ca nghỉ phép), `is_deleted = 0`, ca `sf_shifts` active & chưa xóa. **Không lọc theo is_check_in/is_check_out** → với nhiều ca/ngày luôn trả ca sớm nhất đã approved (kể cả đã check-out xong) (bug? / chưa xác định ý đồ).
  2. Đọc config `checkin_with_image` (giá trị int, mặc định 0) (Repository.php:921-922).
  3. Nếu có ca và tồn tại config `checkin_time_before` (active): nếu `now - (working_day + working_time) > -checkin_time_before` (phút, **dùng giá trị thô, không nhân đơn vị hour**) → trả ngay ca (kèm `config`), **không kèm history** (Repository.php:925-936).
  4. Nếu không có ca → fallback `getBeforeShift` (TimeWorkingStaffTable.php:102-146: ca hôm nay đã `is_check_in=1` và `is_check_out=1`, order `working_time DESC`).
  5. Nếu `checking_curent_step != 0`: build `history[]` với mỗi bước i = 1..checking_curent_step: `{checking_curent_step, actual_time_work_<i>, checkin_info, checkout_info}` lấy từ `sf_check_in_log`/`sf_check_out_log` theo `checking_curent_step = i` **và có `image_selfie` khác rỗng** (CheckInLogTable.php:60-77, CheckOutLogTable.php:62-79). Lưu ý key `actual_time_work_$i` lệch 1 so với cột (bước 1 ↔ cột `actual_time_work_1`, trong khi checkout bước 1 ghi vào `actual_time_work_0`) (bug?).
  6. Không có ca → throw `STAFF_NOT_HAVE_TIME_WORKING`.
- Response `Data`: toàn bộ cột `sf_time_working_staffs.*` + `is_approve_next_shift`, `approve_next_shift_date`, `approve_next_shift_by`, `staff_id`, `staff_code`, `staff_name`, `staff_manager_id`, `check_in_limit`, `customer_id/code/name/avatar`, `customer_adress`, `customer_adress_full`, `shift_name`, `old_shift_name`, `approve_late_by_name`, `approve_soon_by_name`, `approved_next_shift_by_name`, `latitude`, `longitude`, `allowable_radius` (lấy từ `customers` nếu `working_place_type='customer'`, từ `branches` nếu `'branch'`, ngược lại rỗng) + `config: {checkin_with_image}` + `history` (tùy) + `carbon_now` ("Y-m-d H:i:s", Controller.php:36). Nếu rơi vào `getBeforeShift` thì bộ cột khác (branch_name, check_in_log_id, check_in_day, check_in_time "H:i", number_late_time, check_out_*, number_time_back_soon, is_ot).
- Lỗi:
  - `"Hôm nay không có lịch làm việc, hoặc trong thời gian nghĩ lễ."` – không tìm thấy ca (code 1, TimeKeepingRepoException.php:31-32). Lưu ý: **không có kiểm tra ngày lễ thực sự** trong code.

##### 1A.2 `POST /timekeeping/check-in` → `@checkInAction` (Controller.php:50-63) → `TimeKeepingRepository::checkIn` (Repository.php:60-171) — LUỒNG CŨ
- Request (`CheckInRequest.php:30-68`):
  | Param | Kiểu | Bắt buộc | Ghi chú |
  |---|---|---|---|
  | `time_working_staff_id` | int | **required** – msg `"Ca làm việc là thông tin bắt buộc."` | strip_tags/trim |
  | `access_point_ip` | string | không (rule bị comment) | chỉ lưu log `wifi_ip` |
  | `wifi_name` | string | không | lưu log |
  | `latitude`, `longitude` | float | không | dùng khi kiểm tra GPS |
  | `device_id`, `check_sum` | string | không | không dùng (checksum đã comment) |
  | Header `access-point-check-sum` | | không | không dùng (comment) |
  Server tự lấy `request_ip = $request->ip()`.
- Logic:
  1. `getTimeWorking(Auth::id(), id)` (TimeWorkingStaffTable.php:154-188) – ca của chính user, `is_deleted=0`, kèm `configs` = `sf_timekeeping_config` active, chưa xóa, cùng `branch_id` (TimeWorkingStaffTable.php:23-42).
  2. Không có → `"Không tìm thấy ca làm việc."`; `is_check_in == 1` → `"Ca đã được check in."`.
  3. Không có config → `"Wifi chưa được cấu hình."`.
  4. `checkWithWifi` (Repository.php:181-223): ưu tiên wifi (so `config.wifi_ip == request_ip` server thấy), sau đó GPS (khoảng cách Vincenty ≤ `allowable_radius` mét, `Helpers.php:15-31`).
  5. Ghi `sf_check_in_log` status `ok`, `created_type='staff'`, `timekeeping_type` = loại config khớp, `radius` = khoảng cách (Repository.php:98-120).
  6. Đọc config chung → `number_late_time = max(0, now - (working_day working_time + late_check_in))` phút (Repository.php:129-140). Tức `late_check_in` là **thời gian ân hạn**.
  7. Update `is_check_in=1`, `number_late_time`.
  8. Trả `getShift()` (ca hiện tại theo logic cũ: `getCurrentShift` – ca hôm nay còn thiếu in hoặc out, order working_time ASC; nếu không có thì `getBeforeShift`).
  9. Lỗi trong khi xử lý → ghi thêm 1 dòng `sf_check_in_log` status `not_ok`, `time_working_staff_id=0`, `reason = "<id>:<message>"` (Repository.php:143-170). Lưu ý `catch (Exception | TimeKeepingRepoException)` dùng `Exception` được import là `Modules\User\Libs\SmsFpt\TechAPI\src\TechAPI\Exception` (Repository.php:16) → lỗi PHP thông thường không được log not_ok.
- Không kiểm tra: khung giờ được check-in, trạng thái ca (approved…), ngày lễ, ảnh.
- Lỗi (nguyên văn):
  - `"Ca làm việc là thông tin bắt buộc."` – thiếu `time_working_staff_id`.
  - `"Không tìm thấy ca làm việc."` – không thấy ca của user.
  - `"Ca đã được check in."`
  - `"Wifi chưa được cấu hình."` – chi nhánh chưa có `sf_timekeeping_config`.
  - `"Vui lòng kết nối với wifi :wifi_name hoặc đến gần văn phòng để check-in"` – có config GPS và wifi nhưng không khớp cả hai (`:wifi_name` = danh sách wifi_name nối bằng ", ").
  - `"Vui lòng đến gần văn phòng để check-in"` – chỉ có config GPS, ngoài bán kính.
  - `"Vui lòng kết nối với wifi :wifi_name để check-in"` – chỉ có config wifi, IP không khớp.
- Response: object ca (như `getShift`).

##### 1A.3 `POST /timekeeping/check-out` → `@checkOutAction` (Controller.php:71-83) → `TimeKeepingRepository::checkOut` (Repository.php:251-370) — LUỒNG CŨ
- Request (`CheckOutRequest.php:30-68`): như check-in nhưng **`access_point_ip` required** – msg `"Địa chỉ IP wifi là thông tin bắt buộc."`.
- Logic:
  1. Không có ca → `"Không tìm thấy ca làm việc."`; `is_check_out == 1` → `"Ca đã được check out."`. **Không bắt buộc đã check-in.**
  2. Kiểm tra config + wifi/GPS như check-in (message vẫn là "...để check-in").
  3. Ghi `sf_check_out_log` status ok.
  4. `number_time_back_soon = max(0, (working_end_day working_end_time - back_soon_check_out) - now)` phút (Repository.php:316-338). `back_soon_check_out` là ân hạn về sớm.
  5. `actual_time_work` (giờ) = `(now - check_in)` phút / 60, **cắt tối đa `time_work` của ca**; = 0 nếu chưa check-in (Repository.php:320-330). Không trừ nghỉ trưa.
  6. Update `is_check_out=1`, `number_time_back_soon`, `actual_time_work`.
  7. Lỗi `TimeKeepingRepoException` → log `not_ok` vào `sf_check_out_log`.
- Lỗi: như check-in + `"Ca đã được check out."`, `"Địa chỉ IP wifi là thông tin bắt buộc."`.

##### 1A.4 `POST /timekeeping/histories` → `@getHistoryAction` (Controller.php:91-100) → `getHistories` (Repository.php:378-425)
- Request (không validate): `page`, `from_date`, `to_date` (Y-m-d, cả hai mới có hiệu lực; mặc định 30 ngày gần nhất), `branch_id`, `department_id`, `search` (tên NV, LIKE).
- **Không lọc theo user** → trả lịch sử của tất cả nhân viên (màn quản lý).
- Phân trang theo **ngày** (`countTimeKeepingHistories` group by `working_day`, 30 ngày/trang, TimeWorkingStaffTable.php:326-361), sau đó lấy chi tiết ca trong khoảng ngày đó.
- Response: paging (`toPagingData`) với `Items[]` = `{timekeeping_date, check_in_total, check_out_total (= số ca), check_in_count, check_out_count, timekeeping_logs[] (mỗi ca + back_ground), back_ground}`. Trường của mỗi ca: xem `timeKeepingHistories` (TimeWorkingStaffTable.php:252-324): branch, shift, working_*, is_check_in/out, check_in_day/time (H:i), `type_check_in`, check_out_*, `type_check_out`, created_type, number_late_time, number_time_back_soon, staff info, `is_deducted`, `is_ot`.
- Màu `back_ground` – xem mục 3.6.

##### 1A.5 `POST /timekeeping/personal-history` → `@getPersonalHistoryAction` (Controller.php:108-118) → `getPersonalHistories` (Repository.php:499-544)
- Request: `from_date`, `to_date`, `branch_id`, `department_id`, `search` – lọc `staff_id = Auth::id()`, không phân trang.
- Response: mảng items cùng format 1A.4 (không bọc paging).
- Lỗi: catch → `dd(...)` (dump & die, trả HTML/text debug, không theo format JSON) (Repository.php:541-543).

##### 1A.6 `POST /timekeeping/get-day-holiday` → `@getDayHoliday` (Controller.php:126-135) → `getDayHoliday` (Repository.php:870-914)
- Request (`GetDayHolidayRequest.php:30-62`): `start_date` required (`"Hãy nhập ngày bắt đầu."`), `end_date` required (`"Hãy nhập giờ kết thúc."`).
- Logic: duyệt từng ngày, tìm `staff_holiday` có `start_date <= ngày <= end_date`.
- Response: `[{holiday_date: "Y-m-d", holiday_name: "tên1, tên2"}]`.
- Lỗi: `"Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc"`; exception khác → message gốc (code `GET_DAY_HOLIDAY_FAILED`, mặc định `"Lấy ngày lễ thất bại."`).

##### Bảng mã lỗi TimeKeepingRepoException (`Modules/TimeKeeping/Repositories/TimeKeepingRepoException.php:11-55`)
| Code | Hằng | Message mặc định |
|---|---|---|
| 1 | STAFF_NOT_HAVE_TIME_WORKING | Hôm nay không có lịch làm việc, hoặc trong thời gian nghĩ lễ. |
| 2 | EMPTY_TIME_WORKING | Không tìm thấy ca làm việc. |
| 3 | HAVE_BEEN_CHECK_IN | Ca đã được check in. |
| 4 | HAVE_BEEN_CHECK_OUT | Ca đã được check out. |
| 5 | PAYLOAD_HAVE_BEEN_CHANGED | Dữ liệu đã bị thay đổi. (không còn dùng – checksum comment) |
| 6 | WIFI_IP_HAVE_BEEN_CHANGED | Địa chỉ IP wifi đã bị thay đổi. (không còn dùng) |
| 7 | WIFI_IP_NOT_CONFIG | Wifi chưa được cấu hình. |
| 8 | WIFI_CHECK_IN_NOT_CORRECT | Địa điểm check in không đúng. (thực tế luôn truyền message custom) |
| 9 | WIFI_CHECK_OUT_NOT_CORRECT | Địa điểm check out không đúng. (không dùng) |
| 10 | GET_DAY_HOLIDAY_FAILED | Lấy ngày lễ thất bại. |
| 11 | BRANCH_NOT_CONFIGURED_FOR_CHECK_IN | Chi nhánh chưa cấu hình chấm công. |

---

#### 1B. Module TimeWorkingStaff – `Modules/TimeWorkingStaff/Routes/api.php:16-55` (middleware `auth`, prefix `time-working-staff`)
Controller: `Modules/TimeWorkingStaff/Http/Controllers/TimeWorkingStaffController.php` (mọi action nhận `Illuminate\Http\Request`, **không có FormRequest/validate**; catch `Exception` → `ErrorCode=1` với message). Repo: `Modules/TimeWorkingStaff/Repositories/TimeWorkingStaff/TimeWorkingStaffRepo.php` (viết tắt `Repo`).

**Lưu ý quan trọng về message lỗi**: đa số hàm repo bọc lại `throw new TimeWorkingStaffRepoException($exception->getCode())` (không truyền message) → message cuối cùng được map **theo code** ở bảng dưới, message gốc bị mất. Chỉ `checkinLog`, `checkOutLog`, `getShiftsOvertime`, payslip, `getStaffManager`, report, `getBranchRightByStaff` giữ message gốc.

##### Bảng mã lỗi TimeWorkingStaffRepoException (`.../TimeWorkingStaffRepoException.php:17-51`)
| Code | Hằng | Message |
|---|---|---|
| 0 | PROCCESS_FAIL | Có lỗi vui lòng thử lại. |
| 1 | DATA_FAIL | Dữ liệu không hợp lệ. |
| 2 | DATA_SHIFT_NOT_EXIST | Ca làm việc không tồn tại. |
| 3 | CHECKIN_OVERTIME | Quá thời gian checkin. |
| 4 | LEAVEDAY_NOT_VALID | Số lượng ngày phép còn lại không đủ |
| 5 | CHECKIN_TIME_BEFORE_OVERTIME | Chưa đến thời gian được checkin cho phép. |
| 6 | TIME_WORKING_STAFF_EXIST | Thời gian làm việc đã trùng với lịch khác |
| khác | default | Có lỗi vui lòng thử lại. |

Hệ quả: lỗi PHP/SQL bất kỳ (code 0 hoặc code lạ) qua các hàm bọc theo code → `"Có lỗi vui lòng thử lại."`. Lỗi `TimeKeepingRepoException` code 8 (wifi) đi qua hàm bọc-theo-code sẽ ra "Có lỗi vui lòng thử lại."; nhưng check-in/out mới giữ message nên ra đúng câu wifi. Constructor nhận `int $code`; `QueryException` có code dạng chuỗi SQLSTATE (vd "42S22") → có thể sinh TypeError (chưa xác định, phụ thuộc strict_types – file không khai báo strict nên chuỗi không phải số sẽ TypeError).

---

##### 1B.1 `POST /time-working-staff/check-in` → `@checkinLog` (Controller.php:191-199) → `Repo::checkinLog` (Repo.php:1204-1416) — LUỒNG MỚI
- Request (không validate):
  | Param | Kiểu | Bắt buộc (theo code) | Ghi chú |
  |---|---|---|---|
  | `time_working_staff_id` | int | **bắt buộc** (thiếu → code 2) | |
  | `access_point_ip` | string | bắt buộc nếu `staffs.check_in_limit !== 0` (thiếu → lỗi PHP "Undefined index") | IP wifi **client gửi**, so với `sf_timekeeping_config.wifi_ip` |
  | `latitude`, `longitude` | float | không | dùng kiểm tra GPS |
  | `checkin_log` | object | thực tế bắt buộc (thiếu → API trả success với `Data=null`, không ghi gì) | |
  | `checkin_log.checking_curent_step` | int 1..5 | bắt buộc (thiếu/ null → lỗi code 1, message `"An error occurred"`) | bước vào ca |
  | `checkin_log.check_in_log_id` | int | không | có → UPDATE log cũ (retry), không → INSERT |
  | `checkin_log.request_ip`, `access_point_ip`, `wifi_name`, `reason`, `created_type`, `created_by`, `latitude`, `longitude`, `image_selfie`, `radius`, `imei`, `device_name`, `platform`, `checkin_type`, `number_retry` | | không | chỉ lưu log (Repo.php:1345-1374) |
  | `updated_by` | int | không | |
  | `actual_time_work_0..4` | float | không | ghi vào cột tương ứng bước |
- Logic chi tiết:
  1. `getInfo(id)` (TimeWorkingStaff/Models/TimeWorkingStaffTable.php:457-504): ca chưa xóa, staff active, ca `sf_shifts` active. **Không kiểm tra ca thuộc user đăng nhập, không kiểm tra `time_working_staff_status`** (approved…), không kiểm tra đã check-in bước này chưa (gửi lại sẽ ghi đè).
  2. Lấy `sf_timekeeping_config` theo `branch_id` của ca (TimeKeepingConfigTable.php:12-18).
  3. Config chung qua `_setConfigGeneral` (Repo.php:1965-2034, đơn vị `hour` ×60, inactive bỏ qua, không có → 0).
  4. `interval = now − (working_day + working_time)` (phút, có dấu) (Repo.php:1229-1230). **Luôn so với giờ bắt đầu ca, kể cả bước 2..5.**
  5. **Check-in quá sớm**: nếu `checkin_time_before > 0` và `interval < −checkin_time_before` → `"Chưa đến thời gian được checkin cho phép."` (code 5) (Repo.php:1232-1238).
  6. **Check-in quá trễ**: nếu `interval > 0`, `is_approve_late` của ca = 0/null, `late_check_in > 0` và `interval > late_check_in` → `"Quá thời gian checkin."` (code 3) (Repo.php:1240-1250). Có `is_approve_late = 1` → không chặn. Giá trị `time_late_apply_work_late` (số phút được duyệt) **không được dùng** ở đây.
  7. Nếu `Auth::user()->check_in_limit !== 0` → `checkWithWifi` (Repo.php:2856-2900):
     - Không có config → `"Chi nhánh chưa cấu hình chấm công."` (TimeKeepingRepoException code 11).
     - Ưu tiên wifi: khớp `wifi_ip == access_point_ip`.
     - Không khớp → nếu có config GPS: tìm config đầu tiên có `allowable_radius >= distance` (mét). Không có → `"Vui lòng kết nối với wifi :wifi_name hoặc đến gần văn phòng để check-in/checkout"` (nếu có wifi config) hoặc `"Vui lòng đến gần văn phòng để check-in/checkout"`.
     - Không có GPS config → `"Vui lòng kết nối với wifi :wifi_name để check-in/checkout"`.
     - Lưu ý: chỉ kiểm tra theo config chi nhánh (`branch_id`), **không kiểm tra vị trí khách hàng** dù ca `working_place_type='customer'` (app có lat/long/allowable_radius khách hàng từ `/timekeeping/shift` – nhiều khả năng app tự kiểm tra GPS, chưa xác định).
     - `check_in_limit === 0` (so sánh strict) → bỏ qua mọi kiểm tra vị trí, `timekeeping_type='free'`.
  8. Ghi action log `check_in_log` (data = `checkin_log`) (Repo.php:1259).
  9. `number_late_time = now − bắt đầu ca` (phút, **không trừ ân hạn**), chỉ set nếu > 0 (Repo.php:1261-1269).
  10. Map bước → cột (Repo.php:1270-1308):
      | step | is_check_in | by | date | actual_time_work |
      |---|---|---|---|---|
      | 1 (và default) | `is_check_in` | `check_in_by` | `check_in_date` | `actual_time_work_0` |
      | 2 | `is_check_in_1` | `check_in_by_1` | `check_in_date_1` | `actual_time_work_1` |
      | 3 | `is_check_in_2` | `check_in_by_2` | `check_in_date_2` | `actual_time_work_2` |
      | 4 | `is_check_in_3` | `check_in_by_3` | `check_in_date_3` | `actual_time_work_3` |
      | 5 | `is_check_in_4` | `check_in_by_4` | `check_in_date_4` | `actual_time_work_4` |
      `check_in_date = Carbon::now()`.
  11. Chỉ update `sf_time_working_staffs` nếu `time_working_staff_status != 'confirmed'` (Repo.php:1315-1318). Nếu ca đã `confirmed` → biến `$idReturn` không được gán, dòng gửi noti dùng `$idReturn` → khả năng lỗi PHP "Undefined variable: idReturn" → API trả lỗi với message đó (bug?).
  12. Push noti tới `staff_manager_id` của user: title `":staff_name chấm công"`, message `":staff_name đã checkin vào lúc :time của ca :shift_name"` (time H:i), action `time_working_staff_detail`, `action_params.time_working_staff_id = $idReturn` (= số dòng update, không phải id – bug?) (Repo.php:1377-1386).
  13. Ghi `sf_check_in_log` (status `ok`, `check_in_day/time` = now, `timekeeping_type` = loại config khớp hoặc `free`, `checking_curent_step` = step…). Có `check_in_log_id` → update, không → insert.
  14. **Không cập nhật `checking_curent_step` của ca** (chỉ checkout mới tăng bước).
- Response `Data`: `{check_in_log_id, check_in_day: "Y-m-d", check_in_time: "H:i:s"}`.
- Lỗi nguyên văn: `"Ca làm việc không tồn tại."` (thiếu id/không tìm thấy), `"Chưa đến thời gian được checkin cho phép."`, `"Quá thời gian checkin."`, `"Chi nhánh chưa cấu hình chấm công."`, 3 câu wifi/GPS ở trên, `"An error occurred"` (thiếu step), message lỗi PHP gốc (vd "Undefined index: access_point_ip").

##### 1B.2 `POST /time-working-staff/check-out` → `@checkOutLog` (Controller.php:181-189) → `Repo::checkOutLog` (Repo.php:1418-1641) — LUỒNG MỚI
- Request:
  | Param | Bắt buộc | Ghi chú |
  |---|---|---|
  | `time_working_staff_id` | có (thiếu → `"Ca làm việc không tồn tại."`) | |
  | `access_point_ip`, `latitude`, `longitude` | như check-in | kiểm tra vị trí nếu `check_in_limit !== 0` |
  | `checkout_log` | có (thiếu → `"Dữ liệu không hợp lệ."`) | |
  | `checkout_log.checking_curent_step` | nên có | thiếu → không set cột bước nào nhưng vẫn ghi log |
  | `checking_type` | **có** (client gửi số bước của ca) | quyết định có sang bước kế tiếp hay kết thúc |
  | `check_in_date`, `check_in_date_1..4` | **có** theo bước | giờ vào của bước, client gửi lại (không lấy từ DB) |
  | `time_working_staff_status` | có | client gửi trạng thái mới (để quyết định gửi noti) |
  | `staff_manager_id` | có (khi cần noti) | người nhận noti |
  | `updated_by` | không | |
  | `checkout_log.check_out_log_id`, `client_id`, `staff_id`, `branch_id`, `working_place_type`, `customer_id`, `shift_id`, `request_ip`, `access_point_ip`, `wifi_name`, `reason`, `created_type`, `created_by`, `latitude`, `longitude`, `image_selfie`, `radius`, `imei`, `device_name`, `platform`, `checkin_type`, `number_retry` | không | lưu log (Repo.php:1579-1609). Lưu ý `staff_id`, `branch_id`, `shift_id` của log check-out lấy **từ client**, khác check-in lấy từ server. |
- Logic:
  1. `getInfo`, lấy config chi nhánh, kiểm tra vị trí như check-in (cùng message).
  2. **Không có kiểm tra khung giờ check-out**, không kiểm tra đã check-in, không kiểm tra đã check-out.
  3. `number_time_back_soon = (working_end_day working_end_time) − now` (phút), set nếu > 0 (về sớm). **Không áp dụng ân hạn `back_soon_check_out`**.
  4. Theo `checking_curent_step` (Repo.php:1460-1549):
     | step | set cột | bước kế |
     |---|---|---|
     | 1/default | `is_check_out`, `check_out_by`, `check_out_date`, `actual_time_work_0` | nếu `checking_type > 1` → `checking_curent_step = 2`, ngược lại `time_working_staff_status = 'not-confirm'` |
     | 2 | `is_check_out_1`, `check_out_1_by`, `check_out_date_1`, `actual_time_work_1` | `checking_type > 2` → step 3, else `not-confirm` |
     | 3 | `is_check_out_2`, `check_out_2_by`, `check_out_date_2`, `actual_time_work_2` | `> 3` → step 4, else `not-confirm` |
     | 4 | `is_check_out_3`, `check_out_3_by`, `check_out_date_3`, `actual_time_work_3` | `> 4` → step 5, else `not-confirm` |
     | 5 | `is_check_out_4`, `check_out_4_by`, `check_out_date_4`, `actual_time_work_4` | luôn `not-confirm` |
  5. **Giờ công thực tế của bước** (`actual_time_work_n`):
     - Ca có `start_lunch_break` và `end_lunch_break` → `calcActualWorkHours(check_in_date_n, now, lunch_start, lunch_end)` (Repo.php:3098-3146): tổng phút (checkout − checkin) trừ phần giao với giờ nghỉ trưa (giờ nghỉ tính theo ngày check-in; nếu checkout sang ngày hôm sau và giờ nghỉ đã qua trước check-in thì dời nghỉ trưa sang ngày hôm sau – xử lý ca qua đêm), kết quả giờ (float), ≥ 0.
     - Không có nghỉ trưa → `|now − check_in_date_n|` phút / 60.
     - Không cắt trần theo `time_work` (khác luồng cũ). Không làm tròn.
  6. Chỉ update ca nếu status hiện tại `!= 'confirmed'`. Nếu `time_working_staff_status` (DB) khác giá trị client gửi và client gửi `'not-confirm'` → push noti cho `staff_manager_id` (client gửi): title `"Xác nhận lịch làm việc"`, message `"Đang có lịch làm việc ngày :date của :name đang chờ xác nhận."` (date d/m/Y) (Repo.php:1556-1575).
  7. Tính lại `actual_time_work = actual_time_work_0 + _1 + _2 + _3 + _4` và update (Repo.php:1610-1615) – chạy cả khi ca đã confirmed.
  8. Insert/update `sf_check_out_log` (status ok, `timekeeping_type` khớp hoặc `free`).
- Response `Data`: `{check_out_log_id, check_out_day, check_out_time}`.
- Lỗi: `"Ca làm việc không tồn tại."`, `"Dữ liệu không hợp lệ."`, `"Chi nhánh chưa cấu hình chấm công."`, câu wifi/GPS, lỗi PHP gốc.

##### 1B.3 `POST /time-working-staff/get-list-group-status` → `@getTotalGroupStatus` (Controller.php:21-29) → `Repo::getTotalGroupStatus` (Repo.php:93-152) — màn QUẢN LÝ
- Request: `week` (ISO week, required theo code), `year` (required), `search` (**key phải tồn tại**, có thể null – thiếu key → lỗi "Undefined index"), `branch_id[]`, `page`, `per_page`, `status[]` (lọc NV có số lượng > 0 ở 1 trong các status: `waiting`, `approved`, `not-approved`, `not-confirm`, `confirmed`, `waiting-confirm`).
- Logic: lấy NV có `staff_manager_id = Auth::id()` (StaffTable.php:97-118, paging), mỗi NV đếm số ca theo status trong tuần (`getTotalGroupStatus`, TimeWorkingStaffTable.php:308-330) và tổng giờ (`getSumTimeActual`, 361-384).
- Response: paginator `{data: [{staff_id, full_name, branch_name, staff_avatar, waiting, approved, not-approved, not-confirm, confirmed, actual_time_work, actual_time_work_confirmed, estimated_time_work, waiting-confirm}], ..., total_estimate_hours, total_actual_hours, total_by_status{...}}`. `waiting-confirm` = COUNT(`approved_manual_time_by`) (số ca được chấm công hộ). `estimated_time_work` = SUM(`min_time_work`).
- Lỗi: `"Có lỗi vui lòng thử lại."` (bọc theo code).

##### 1B.4 `POST /time-working-staff/get-list-group-status-staff` → `@getTotalGroupStatusStaff` (Controller.php:31-39) → Repo.php:157-198 — tổng hợp của CHÍNH NV
- Request: `type` (`day` = theo kỳ công tháng; khác = theo tuần), `month`, `year` (khi type=day), `week`, `year` (khi theo tuần).
- Kỳ công: từ ngày `close_time_working_start` (mặc định 26) **tháng trước** đến `close_time_working_end` (mặc định 25) tháng `month` (Repo.php:164-175). Ghép chuỗi trực tiếp → tháng 1 sinh `YYYY-00-26` (bug?).
- Response: `{staff_id, full_name, waiting, approved, not-approved, not-confirm, confirmed, actual_time_work, actual_time_work_confirmed, estimated_time_work, waiting-confirm}`.

##### 1B.5 `POST /time-working-staff/get-list-by-staff` → `@getListByStaff` (Controller.php:51-59) → Repo.php:263-309
- Request: `staff_id` (required – thiếu → `"Dữ liệu không hợp lệ."`), `type` (`day` → `month`,`year` theo kỳ công; else `week`,`year`).
- Response: mảng ca (TimeWorkingStaffTable::getByStaff 184-250: `sf_time_working_staffs.*` + staff/customer/branch/shift/approver names + lat/long/allowable_radius) + `images[]` (mọi `image_selfie` của log vào+ra). Chỉ lấy status ∈ {waiting, approved, not-approved, not-confirm, confirmed}.

##### 1B.6 `POST /time-working-staff/get-list-by-pg` → `@getListPg` (Controller.php:41-49) → Repo.php:200-233 — "danh sách ca của tôi" (PG = nhân viên PG, chưa xác định nghĩa chính xác)
- Request: `type` (`day` → lọc theo `month`+`year` theo tháng dương lịch qua `start_working_format_month/year`, **không theo kỳ công**; khác → `week`+`year`), `year` mặc định năm hiện tại.
- Lọc `staff_id = Auth::id()` (getByStaffPgV2 774-835 / getByStaffPg 115-176).
- Response: mảng ca + `images[]`.

##### 1B.7 `POST /time-working-staff/get-list-today` → `@getListToDay` (Controller.php:61-69) → Repo.php:235-261
- Không tham số. Ca của user có `start_working_format_day/month/year` = hôm nay (getByTime 541-592) + `images[]`.

##### 1B.8 `POST /time-working-staff/get-list-last-week` → `@getLastWeekTime` (Controller.php:71-79) → Repo.php:360-390
- Không tham số. Lấy ca có `working_day` lớn nhất của user (getLastDetail 594-606), trả toàn bộ ca của tuần đó (theo `start_working_format_week/year`). Không có → `[]`.

##### 1B.9 `POST /time-working-staff/get-detail` → `@getDetail` (Controller.php:81-89) → Repo.php:311-358
- Request: `time_working_staff_id` (thiếu/không thấy → `"Dữ liệu không hợp lệ."`).
- Response: chi tiết ca (TimeWorkingStaffTable::getDetail 258-306, có `customers.latitude/longitude/allowable_radius`, `branch_name`) + `history[]` theo bước 1..`checking_curent_step` (`{checking_curent_step, actual_time_work_<i>, checkin_info{check_in_log_id, checkin_type, checking_curent_step, check_in_day, check_in_time, image_selfie}, checkout_info{...}}`, chỉ log có ảnh selfie).

##### 1B.10 `POST /time-working-staff/accept-actual-time` → `@acceptActualTimeWork` (Controller.php:91-99) → Repo.php:395-617 — QUẢN LÝ XÁC NHẬN GIỜ CÔNG / CHẤM CÔNG HỘ
- Request: `time_working_staff_id` (bắt buộc), `actual_time_work` (giờ), `is_attend` (1 = chấm công hộ), `note`, `shift_code_approved`, `timekeeping_coefficient`.
- Logic:
  - Nếu có `actual_time_work`:
    - `is_attend == 1` (chấm công hộ): dùng `ShiftCheckInLogTable/ShiftCheckOutLogTable` (`sf_check_in_log`/`sf_check_out_log`):
      - Chưa có log vào → insert log: giờ = `working_day working_time` của ca, `status='ok'`, `reason='Chấm công hộ'`, `created_type='admin'`, `timekeeping_type='time-attendance'`, `checking_curent_step = checking_type` (Repo.php:406-427). Đã có → ghi `sf_check_in_change_log` (old/new) rồi sửa log thành giờ bắt đầu ca, `created_type='admin'` (429-455). Tương tự check-out với giờ kết thúc ca (457-507). Chỉ xử lý **1 log** (bản ghi đầu tiên theo ca).
      - Set `is_check_in*/is_check_out*=1`, `*_by = Auth::id()`, `*_date` = giờ bắt đầu/kết thúc ca cho các bước 1..`checking_type` (Repo.php:509-566; `checking_type = 0` → không set bước nào).
      - `actual_time_work = input`, `approved_manual_time_by = Auth::id()`.
    - Luôn: `approved_actual_time_by = Auth::id()`, `actual_time_work_confirmed = input`.
  - `note`, `shift_code_approved`, `timekeeping_coefficient` nếu có.
  - **Luôn set `time_working_staff_status = 'confirmed'`**.
  - Noti cho NV: không chấm công hộ → title `"Xác nhận giờ làm việc"`, message `"Lịch làm việc ngày :date của bạn đã được xác nhận giờ làm."`; chấm công hộ → title `"Chấm công hộ"`, message `"Lịch làm việc ngày :date của bạn đã được chấm công hộ."`.
  - Action log `approved-actual-time`.
- Không kiểm tra quyền quản lý. Response: thông tin ca (`getInfo`, trước khi update).
- Lỗi: `"Có lỗi vui lòng thử lại."`.

##### 1B.11 `POST /time-working-staff/approved-time-working-staff` → Repo.php:622-649 — duyệt/không duyệt lịch
- Request: `time_working_staff_id`, `time_working_staff_status` (vd `approved`/`not-approved`).
- Update status; noti NV title `"Phê duyệt lịch làm việc"`, message `"Lịch làm việc ngày :date của bạn đã được phê duyệt."` (gửi cả khi `not-approved`). Action log `update-status`.

##### 1B.12 `POST /time-working-staff/approved-time-late` → Repo.php:654-676 — duyệt đi trễ
- Request: `time_working_staff_id`, `is_approve_late`, `time_late_apply_work_late` (**key bắt buộc**; > 0 thì ghi `approve_late_by`, `approve_late_date`), `time_working_staff_status` (tùy).
- Không noti. Action log `approved-late`. Response `getInfo`.

##### 1B.13 `POST /time-working-staff/approved-time-soon` → Repo.php:681-703 — duyệt về sớm
- Request: `time_working_staff_id`, `is_approve_soon`, `time_late_apply_work_soon` (key bắt buộc), `time_working_staff_status`. Không noti. Log `approved-soon`.

##### 1B.14 `POST /time-working-staff/approved-time-soon-late-staff` → Repo.php:751-794 — duyệt cả trễ/sớm
- Request: `time_working_staff_id`, `time_late_apply_work_late`, `is_approve_late`, `time_late_apply_work_soon`, `is_approve_soon` (đều là key bắt buộc), `time_working_staff_status`.
- Noti NV: title `"Phê duyệt đi sớm / về trễ"`, message `"Lịch làm việc ngày :date của bạn đã được phê duyệt đi sớm / về trễ."`. Log `approved-late-soon`.

##### 1B.15 `POST /time-working-staff/submit-time-late-soon` → `@timeLateSoonStaff` → Repo.php:705-749 — NV XIN ĐI TRỄ / VỀ SỚM
- Request: `time_working_staff_id`, `time_late_apply_work_late` + `time_late_apply_work_late_note` (nếu xin trễ), `time_late_apply_work_soon` + `time_late_apply_work_soon_note` (nếu xin sớm). Số phút (đơn vị: chưa xác định, theo tên trường là thời gian).
- Status ca → `approved` nếu `user.check_approved_time_working === 0`, ngược lại `waiting` (ca phải được duyệt lại → **trong lúc `waiting`, `/timekeeping/shift` sẽ không trả ca này** vì chỉ lấy `approved`).
- Noti tới `staff_manager_id`: title `"Phê duyệt đi sớm / về trễ"`, message `"Đang có yêu cầu xin đi trễ / về sớm ngày :date của :name đang chờ phê duyệt."`. Log `waitting-late-soon`.
- Response: `getDetail`. Lưu ý: chỉ khi quản lý duyệt (`is_approve_late = 1`) thì check-in trễ mới không bị chặn.

##### 1B.16 `POST /time-working-staff/change-shift` → `@changeShift` → Repo.php:799-1028 — ĐỔI CA
- Request: `time_working_staff_id` (bắt buộc), `shift_id` (ca mới, bắt buộc), `branch_id` (tùy), `working_time`, `working_end_time` (tùy, giờ custom), `old_shift_note` (**key bắt buộc**), `image_next_shift` (**key bắt buộc**), `old_shift_id`.
- Logic:
  1. Không thấy ca → trả **thành công** với `Data = {message: "Ca làm việc của nhân viên không tồn tại!"}` (Repo.php:807-811).
  2. Nếu ca cũ có `shift_code_approved` ∈ {P, 1/2} và status `approved` → hoàn lại quỹ phép năm hiện tại (`sf_leave_day`: `total_using_leave_day −= 1|0.5`, `total_using_remaining_day += 1|0.5`) (Repo.php:817-830).
  3. Ca mới: `checking_type` (trừ ca OT), `working_time/working_end_time` = input hoặc giờ ca mới (nếu đổi ca) hoặc giữ cũ; `timekeeping_coefficient`, `time_work`, `min_time_work` theo ca mới.
  4. Nếu truyền cả `working_time` & `working_end_time`: kiểm tra trùng (`checkTimeWorkingStaff`, TimeWorkingStaffTable.php:663-693: cùng NV, cùng `working_day`, `working_time < end AND working_end_time > start+1 phút`, trừ chính ca) → `"Thời gian làm việc đã trùng với lịch khác"`; tính `time_work = min_time_work = round(max(0, (end−start) − giao nghỉ trưa), 2)` giờ (ca qua đêm tính sai vì parse cùng ngày – bug?).
  5. `shift_code_approved`, `shift_id`, `old_shift_note`, `image_next_shift`; `old_shift_id` chỉ set lần đầu.
  6. Status: `approved` nếu `user.check_approved_time_working === 0` **hoặc user là quản lý của NV**; ngược lại `waiting`.
  7. `is_deducted`: KL → 1; P hoặc 1/2 → 0; khác → null.
  8. Nếu ca đã `is_check_in == 1` → reset toàn bộ `is_check_in*`, `is_check_out*`, `check_in_by*`, `check_in_date*`, `check_out_by`, `actual_time_work*` về 0/null và **xóa toàn bộ `sf_check_in_log`** của ca (không xóa check-out log) (Repo.php:952-990).
  9. Noti: nếu chờ duyệt → tới quản lý: title `"Phê duyệt lịch làm việc"`, message `"Đang có lịch làm việc ngày :date của :name đang chờ phê duyệt."`; nếu tự duyệt và NV có `check_approved_time_working !== 0` → tới NV: title `"Quản lí đổi ca lịch làm việc"`, message `"Đã đổi ca lịch làm việc ngày :date của bạn thành :shift_name."`.
  10. Log `approved-change-shift`. Response `getDetail`.
- Lỗi: `"Thời gian làm việc đã trùng với lịch khác"` (code 6), còn lại `"Có lỗi vui lòng thử lại."`.

##### 1B.17 `POST /time-working-staff/approved-change-shift` → Repo.php:1033-1083 — duyệt đổi ca
- Request: `time_working_staff_id`, `shift_id`, `is_approved_next_shift`, `old_shift_id` (tùy, ≠0), `time_working_staff_status` (tùy).
- Nếu `shift_id` khác ca hiện tại: cập nhật `checking_type`, `working_time/end_time` (giờ ca), `timekeeping_coefficient`, `min_time_work`, `time_work`, `shift_code_approved` theo ca mới.
- Noti NV: title `"Phê duyệt đổi ca lịch làm việc"`, message `"Lịch làm việc ngày :date của bạn đã được phê duyệt đổi ca."`.

##### 1B.18 `POST /time-working-staff/approved-all` → Repo.php:1088-1146
- Request: `time_working_staff_id`, `shift_id`?, `is_approved_next_shift`? (≠0), `checking_type`? (≠0), `time_late_apply_work_late` (key bắt buộc) + `is_approve_late`?, `time_late_apply_work_soon` (key bắt buộc) + `is_approve_soon`? (≠0), `time_working_staff_status`?.
- Noti NV `"Phê duyệt lịch làm việc"` / `"Lịch làm việc ngày :date của bạn đã được phê duyệt."`. Log `approved`.

##### 1B.19 `POST /time-working-staff/approved-all-v2` → `@approvedAllV2` (Controller.php:381-390) → Repo.php:3148-3220
- Request: `requests[]` – mảng object cùng cấu trúc 1B.18. Chạy trong transaction. Lưu ý `$dataUpdate` dùng chung giữa các phần tử (giá trị phần tử trước "dính" sang phần tử sau nếu phần tử sau không có key – bug?).
- 1 noti duy nhất tới NV của phần tử cuối: `"Lịch làm việc tuần :week của bạn đã được phê duyệt."`.
- Response: `{success: true, message: "Phê duyệt lịch làm việc thành công"}`.

##### 1B.20 `POST /time-working-staff/create` → `@createTimeWorkingStaff` → Repo.php:1649-1790 — NV/QL tạo lịch làm việc
- Request: `array_time_working_staff[]` (thiếu → `"Dữ liệu không hợp lệ."`), mỗi phần tử: `client_id`, `staff_id` (bắt buộc), `shift_id` (bắt buộc), `working_day` (bắt buộc), `working_end_day`, `working_time`?, `working_end_time`? (mặc định giờ ca), `branch_id` (mặc định 1), `working_place_type` (mặc định `store`), `customer_id` (→ `working_place_id`), `start_working_format_day/week/month/year`, `note`, `work_schedule_id`, `staff_manager_id`, `created_by`, `updated_by`, `created_at`, `updated_at`.
- Kiểm tra trùng giờ theo **giờ mặc định của ca** (`checkShiftExistByStaff` 1793-1820 → `checkValidateTimeWorkingStaff` 608-628) → trùng thì `"Ca làm việc không tồn tại."` (code 2 – message gây hiểu nhầm). Ca không tồn tại → cùng message.
- Status: `approved` nếu `user.check_approved_time_working === 0`, else `waiting`. `is_deducted`: KL → 1, P → 0. `checking_type` lấy từ ca. `timekeeping_coefficient`, `time_work`, `min_time_work`, `shift_code_approved` từ ca.
- P/1/2: điều kiện `$status = 'approved'` (gán, luôn true – bug) và dùng `$input['working_day']`/`$input['staff_id']` (không tồn tại ở cấp ngoài) → khả năng cao lỗi → rollback → `"Có lỗi vui lòng thử lại."` (chưa xác định thực tế).
- Noti tới quản lý: `"Phê duyệt lịch làm việc"` / `"Đang có lịch làm việc ngày :date của :name đang chờ phê duyệt."` (gửi cả khi auto-approved).
- Response: `[{client_id, time_working_staff_id}]`.

##### 1B.21 `POST /time-working-staff/add-shift-staff` → `@addShiftStaff` → Repo.php:2230-2393 — thêm ca cho NV (QL)
- Request: `staff_id`, `shift_id`, `branch_id`, `working_day` (Y-m-d), `working_time` (H:i), `working_end_time` (H:i, **cùng ngày** `working_day`), `working_place_id`.
- Lỗi/thông báo (controller trả `ErrorCode=1` với `message` nếu `error=true`):
  - `"Ngày bắt đầu phải lớn hơn ngày kết thúc"` – khi start >= end (câu chữ ngược nghĩa).
  - `"Thời gian làm việc đã trùng với lịch khác"`.
  - `"Ca làm việc không tồn tại"` / `"Thêm thất bại"` – trả về `JsonResponse` thay vì mảng → controller truy cập `$data['error']` trên object → lỗi PHP "Cannot use object of type ... as array" (bug?) → `ErrorCode=1` với message lỗi PHP.
- `time_work = min_time_work = calculateMinWork(...)` (Repo.php:2422-2458: (end−start) − nghỉ trưa, ca qua đêm nếu end < start), `is_ot=0`, `working_place_type='branch'`, `actual_time_work=0`, `checking_type` từ ca, status waiting/approved như trên, `is_deducted` KL→1/P→0. P/1/2 + approved → trừ quỹ phép (biến `$InfoLeaveDay` sai chữ hoa → luôn nhánh `add` bản ghi quỹ phép mới 12 ngày – bug?).
- Noti quản lý nếu chưa approved. Thành công: `ErrorCode=0`, `Data=null`.

##### 1B.22 `POST /time-working-staff/create-overtime` → `@storeOvertime` → Repo.php:2044-2220 — TẠO CA TĂNG CA (OT)
- Request: `staff_id`, `branch_id`, `working_day`, `working_time` (H:i), `working_end_day`, `working_end_time` (H:i), `is_not_check_in` (1 = nhập tay, không cần chấm), `working_place_id`, `shift_id` (chỉ dùng ghi log).
- Kiểm tra:
  - start >= end → `"Thời gian kết thúc phải lớn hơn thời gian bắt đầu"`.
  - Ca hệ thống `shift_code='OT'`, `is_system=1` (`getShiftSystemInfo`).
  - Trùng giờ → `"Thời gian làm việc đã trùng với lịch khác"`.
  - Ngày trong tuần không được bật trên ca OT (`is_monday`…`is_sunday`) → `"Ngày làm việc không hợp lệ"`.
- Dữ liệu: `is_ot=1`, `overtime_type='H'`, `time_work = min_time_work = round((end−start)/60, 2)` giờ (không trừ nghỉ trưa), `timekeeping_coefficient=1`, `working_place_type='branch'`, `work_schedule_id=0`, `shift_code_approved='OT'`, status waiting/approved theo `check_approved_time_working`.
- `is_not_check_in == 1`: set `is_check_in=is_check_out=1`, `check_in_date/check_out_date` = giờ OT, `actual_time_work_0 = actual_time_work = actual_time_work_confirmed` = số giờ, `checking_type=0`; insert log vào/ra `created_type='admin'`, step 1. Ngược lại `checking_type=1` (NV phải tự check-in/out 1 lượt).
- Noti quản lý nếu waiting: `"Đang có lịch làm việc thêm giờ ngày :date của :name đang chờ phê duyệt."`.
- Thành công: `Data=null`. Exception → trả `JsonResponse` (bug như 1B.21) – message thực tế là lỗi PHP. (Nếu không tìm thấy ca OT, `$data`/`$status` không tồn tại → lỗi PHP.)

##### 1B.23 `POST /time-working-staff/get-shift-overtime` → Repo.php:2403-2413
- Trả bản ghi `sf_shifts` hệ thống `shift_code='OT'` (đủ cột).

##### 1B.24 `POST /time-working-staff/get-list-shift` → Repo.php:1845-1853 → `ShiftsTable::downloadShifts` (ShiftsTable.php:59-107)
- Request: `branch_id` (tùy). Trả ca `is_system=1` hoặc ca map vào chi nhánh qua `sf_map_shift_branch`, active, chưa xóa. Cột: giờ làm, nghỉ trưa, `start/end_timekeeping_on/out`, hệ số, các ngày trong tuần, `min_time_work`, `time_work`, `checking_type`, `shift_code`…

##### 1B.25 `POST /time-working-staff/get-list-shift-code` → Repo.php:1148-1151 → `ShiftsTable::getShifCode` (ShiftsTable.php:158-177)
- Trả `[{shift_code, timekeeping_coefficient}]` với code ∈ {1, 1/2, P, P/2, OFF, KL}.

##### 1B.26 `POST /time-working-staff/get-total-time-shift` → Repo.php:1153-1199
- Không tham số. Đếm số ca của user (năm hiện tại) theo ngày/tuần (`weekOfYear`)/tháng: `check_in` (is_check_in=1) và `approved` (status approved). Lỗi → trả toàn 0.
- Response: `{day:{check_in, approved}, week:{...}, month:{...}}`.

##### 1B.27 `POST /time-working-staff/get-total-time-keeping` → `@getTotalTimeKeepingShift` → Repo.php:1855-1938 — BẢNG CÔNG THÁNG CỦA NV
- Request: `month`, `year`.
- Kỳ công: ngày `min(close_time_working_start (mặc định 26), số ngày tháng trước)` của tháng trước → `min(close_time_working_end (mặc định 25), số ngày tháng)` tháng hiện tại.
- Với mỗi `sf_shift_type`: đếm ca có `shift_code_approved = code`, status ∈ {confirmed, not-confirm} trong kỳ (getTotalGroupShiftCode 630-651). `P` cộng phép 1; `P/2` cộng phép 0.5 và ngày công 0.5; `1` cộng ngày công 1; `1/2` cộng 0.5 (biến `actualWorkingDay` tính nhưng **không trả về**).
- Response: `{month, year, start_date (d-m-Y), end_date, standard_working_day (= SUM(min_time_work) giờ), time_actual (= SUM(actual_time_work_confirmed)), time_keeping: [{shift_type_code, shift_type_name, total}], time_off_day: {time_off_now (= sf_leave_day.total_leave_day P), time_off_using (P dùng trong kỳ), time_off_remaining}}`. Lỗi → `Data=null`, ErrorCode 0.

##### 1B.28 `POST /time-working-staff/report-time-working-staff` → `@reportTimeWorkingStaff` (Controller.php:334-353, **không try/catch**) → Repo.php:2561-2814 — BÁO CÁO CHẤM CÔNG TUẦN/THÁNG
- Request (`only`): `page`, `per_page`, `date_type` (`by_week`|`by_month`), `date_object` (số tuần ISO | số tháng), `years`, `shift_id[]`, `branch_id[]` (lọc ca, không lọc NV), `department_id` (không dùng), `staff_id` (không dùng), `search`, `status[]` (lọc ca theo status báo cáo), `day`.
- NV: **toàn bộ** NV có ca trong kỳ (`getByStaffByManagerPagingTimeWorkingReport(null, ...)`, StaffTable – không giới hạn quản lý).
- Mỗi NV × mỗi ngày: các ca (`getTimeWorkingByStaffOnList` 695-773) + giờ vào = **log vào đầu tiên** (`getFirstCheckIn`, ShiftCheckInLogTable.php:286-300), giờ ra = **log ra cuối cùng** (`getLastCheckOut`, ShiftCheckOutLogTable.php:77-91) + `status` tính như mục 3.5.
- Response: `{list: paginator(staff + shift[{day, time_working[]}]), listDay: [{day, day_name, day_format, day_full_format, is_holiday}], number_day, week_in_year}`.

##### 1B.29 `POST /time-working-staff/report-time-working-staff-detail` → Repo.php:2939-3086 — BÁO CÁO THEO NGÀY
- Request: `day` (Y-m-d), `branch_id[]` (lọc NV), `search`.
- Response: `{selected_date, branch_option (chi nhánh user có quyền – staff_branch_right), status_option (= 1B.30), staff_list: [staff + shift_list[ca + check_in_*, check_out_*, created_type_ci/co, status]]}`. NV: tất cả (manager = null).

##### 1B.30 `POST /time-working-staff/status-time-working-staff` → Repo.php:2815-2855
- Trả danh mục status báo cáo (mục 3.5).

##### 1B.31 Khác (liên quan gián tiếp)
| Method/URL | Controller@method | Repo | Mô tả |
|---|---|---|---|
| POST `/time-working-staff/get-staff-manager` | `@getStaffManager` (325-333) | 2551-2559 | NV do user quản lý (paging; params `branch_id[]`, `search` – key bắt buộc, `page`, `per_page`) |
| POST `/time-working-staff/get-branch-right-by-staff` | `@getBranchRightByStaff` (372-380) | 3087-3097 | Chi nhánh NV `staff_id` có quyền |
| POST `/time-working-staff/get-pay-slip-staff` | `@getPaySlipByStaff` | 2460-2494 | Phiếu lương theo `month`, `years` |
| POST `/time-working-staff/get-list-pay-slip-staff` | `@getListPaySlipByStaff` | 2496-2511 | DS phiếu lương của user |
| POST `/time-working-staff/get-detail-pay-slip` | `@getPaySlipByStaffDetail` | 2513-2550 | Chi tiết theo `sf_time_working_pay_slip_id` (catch có `dd()`) |

---

#### 1C. Module TimeOffDays (phần ảnh hưởng chấm công) – `Modules/TimeOffDays/Routes/api.php:24-65` (middleware `auth`, prefix `timeoffdays`)
| Method/URL | Controller@method | Liên quan chấm công |
|---|---|---|
| POST `/timeoffdays/sf-shifts/list` | `SFShiftsController@list` | Params `working_day_start`, `working_day_end` (Y-m-d) → ca của user trong khoảng (`SFShiftsTable::getLists`, `Modules/TimeOffDays/Models/SFShiftsTable.php:45-76`) trả `[{time_working_staff_id, shift_name: "Ca nghỉ ... - d/m"}]` để chọn ca xin nghỉ. Thiếu key ngày → lỗi PHP. |
| POST `/timeoffdays/time-working-staffs/list` | `TimeWorkingStaffsController@list` | Trả **tất cả** ca (không lọc NV) `{time_working_staff_id, working_day, shift_name}` (`TimeWorkingStaffsTable.php:33-45`). |
| POST `/timeoffdays/create` | `TimeOffDaysController@create` (128-202) | `TimeOffDaysRequest`: `time_off_type_id` req (`"Loại đơn nghỉ phép không được trống."`), `time_off_days_start` req (`"Ngày bắt đầu không được trống."`), `time_off_days_end` req (`"Ngày kết thúc không được trống."`), `time_off_note` req (`"Lý do không được trống."`), `time_off_days_time` nullable, `time_off_days_shift` required|array (`"Ca làm việc không được trống."`, `"Ca làm việc kiểu dữ liệu là mảng."`), `time_off_days_files[]`. Lưu danh sách `time_working_staff_id` vào bảng ca nghỉ (`timeOffDaysShifts`). Người duyệt cấp 1-3 lấy từ cấu hình duyệt. Success message `"Tạo đơn nghỉ phép thành công"`. |
| POST `/timeoffdays/edit` | `@edit` (413-466) | `TimeOffDaysEditRequest` (thêm `time_off_days_id` req `"Id đơn nghỉ phép không được trống."`, `time_off_note` req `"Ghi chú không được trống."`). Xóa & ghi lại ca nghỉ. `"Chỉnh sửa đơn phép thành công"`. |
| POST `/timeoffdays/activity` | `@activity` (208-255) | `time_off_days_id` req (`"ID nghỉ phép không được trống."`), `is_approvce` req (`"Trạng thái không được trống."`). Duyệt theo cấp; đủ cấp → `is_approve=1`; từ chối → `is_approve=0`. `"Phê duyệt đơn phép thành công"`. **Không cập nhật `sf_time_working_staffs`.** |
| POST `/timeoffdays/time/list` | `TimeController@list` | Danh mục thời gian (dùng cho đơn xin đi trễ/về sớm – `time_off_days_time_value`). |
| Khác: `list`, `search`, `cancel`, `detail`, `remove`, `total`, `count`, `time-off-type/list`, `staffs/list`, `time-off-days-log/list`, `time-off-days-total/create`, `time-off-days-config-approve/create` | | Quản lý đơn phép, không đụng chấm công. |

**Điểm quan trọng**: `TimeOffDaysController::updateTimeWorkingStaff` (779-809) – logic map đơn phép vào ca: loại `017` (xin đi trễ) → `time_late_apply_work_late = time_off_days_time_value`; `018` (xin về sớm) → `time_late_apply_work_soon`; `010` (nghỉ không lương) → `is_time_off_days=1, is_deducted=1`; loại khác (nghỉ có lương) → `is_time_off_days=1, is_deducted=0`. Hàm này chỉ được gọi từ `approveAction` (679-721) và **`approveAction` không được gọi ở đâu** (grep) → **dead code**: duyệt đơn phép trên staff-api **không** đánh dấu ca nghỉ / không set phút xin trễ-sớm. (Có thể portal/backend khác xử lý – chưa xác định.)

---

### 2. Rule nghiệp vụ chi tiết

#### 2.1 Xác định ca hiện tại (`/timekeeping/shift`)
- Ca "hôm nay" = `CURDATE (timezone tenant) BETWEEN working_day AND working_end_day` → ca qua đêm được coi là "hôm nay" ở cả 2 ngày (TimeKeeping/Models/TimeWorkingStaffTable.php:412).
- Điều kiện: `status='approved'`, `is_deducted IS NULL` (loại ca P/KL/1/2 do changeShift/create gán), chưa xóa, ca active.
- Nhiều ca/ngày: luôn lấy ca có `working_time` sớm nhất (`first()`); không có cơ chế chuyển sang ca kế tiếp sau khi hoàn thành ca đầu (luồng cũ `getCurrentShift` có lọc "còn thiếu in/out", luồng V2 thì không). Chưa xác định app xử lý thế nào (có thể dùng `get-list-today`).
- Ca qua đêm: check-in so với `working_day + working_time`; check-out so với `working_end_day + working_end_time`; `calcActualWorkHours` xử lý nghỉ trưa qua ngày.

#### 2.2 Điều kiện check-in (luồng mới `/time-working-staff/check-in`)
| Rule | Điều kiện chặn | Config | Mặc định |
|---|---|---|---|
| Sớm | `now < start − checkin_time_before` | `checkin_time_before` (minute/hour) | 0 = không giới hạn |
| Trễ | `now > start + late_check_in` và `is_approve_late` ≠ 1 | `late_check_in` | 0 = không giới hạn |
| Vị trí | wifi IP client ≠ mọi `wifi_ip` và (không có GPS config hoặc ngoài mọi `allowable_radius`) | `sf_timekeeping_config` theo `branch_id` | bắt buộc có config (trừ `check_in_limit=0`) |
| Bỏ qua vị trí | `staffs.check_in_limit === 0` | cột staff | — |
| Ảnh selfie | **Server không bắt buộc** – chỉ trả `config.checkin_with_image` cho app, lưu `image_selfie` client gửi | `checkin_with_image` (0/1) | 0 |
| Thiết bị | Không kiểm tra; chỉ lưu `imei`, `device_name`, `platform` | — | — |
| Đã check-in | Không kiểm tra (có thể gửi lại, kèm `check_in_log_id` để cập nhật) | — | — |
| Trạng thái ca | Không kiểm tra ở API check-in (chỉ `/timekeeping/shift` lọc `approved`); nếu `confirmed` thì không update ca | — | — |
| Ngày lễ | Không kiểm tra | — | — |
| `sf_shifts.start_timekeeping_on/end_timekeeping_on/start_timekeeping_out/end_timekeeping_out` | **Không dùng** để kiểm tra ở server (chỉ trả về trong list/report) | — | — |

Luồng cũ `/timekeeping/check-in`: chỉ kiểm tra tồn tại ca, `is_check_in`, có config, vị trí (IP server).

#### 2.3 Điều kiện check-out
- Luồng mới: chỉ kiểm tra vị trí (như check-in). Không có khung giờ, không cần đã check-in.
- Luồng cũ: kiểm tra tồn tại, chưa check-out, có config, vị trí; `access_point_ip` bắt buộc.

#### 2.4 Đi trễ / về sớm – cách tính
| | Luồng cũ (TimeKeeping) | Luồng mới (TimeWorkingStaff) | Báo cáo/màu |
|---|---|---|---|
| `number_late_time` (phút) | `max(0, now − (start + late_check_in))` (Repository.php:129-137) | `now − start` nếu > 0, không ân hạn (Repo.php:1261-1269); bị ghi đè ở mỗi bước | Trễ nếu `check_in > start + late_check_in` |
| `number_time_back_soon` (phút) | `max(0, (end − back_soon_check_out) − now)` (Repository.php:316-338) | `end − now` nếu > 0 (Repo.php:1447-1458) | Sớm nếu `check_out < end − back_soon_check_out` |
| Nghỉ không lương | — | — | `check_in > start + off_check_in` (khi `off_check_in > 0`) hoặc `check_out < end − off_check_out` (khi `off_check_out > 0`) |
Phút tính bằng `Carbon::diffInMinutes` (làm tròn xuống phút nguyên).

#### 2.5 Giờ công / công
- Luồng cũ: `actual_time_work = min((checkout − checkin)/60, time_work)`.
- Luồng mới: mỗi bước `actual_time_work_n` = giờ (float) từ `check_in_date_n` (client gửi) đến lúc checkout, trừ phần giao nghỉ trưa của ca nếu ca có nghỉ trưa; tổng `actual_time_work` = Σ 5 bước. Không cắt trần, không làm tròn.
- Quản lý xác nhận: `actual_time_work_confirmed` (giờ) qua `accept-actual-time` → status `confirmed`. Báo cáo tháng dùng `actual_time_work_confirmed` (`time_actual`) và `min_time_work` (`standard_working_day`).
- "Công" theo loại: `shift_code_approved` (1 = 1 công, 1/2 = 0.5, P = phép, P/2 = 0.5 phép + 0.5 công, KL = không lương, OFF, OT). `timekeeping_coefficient` (hệ số công) lưu theo ca; quản lý có thể sửa khi xác nhận. Config `round_timekeeping_coefficient` được parse nhưng **không dùng**.
- `time_work`/`min_time_work` của ca: lấy từ `sf_shifts` hoặc tính `(end − start) − nghỉ trưa` (changeShift khi có giờ custom, addShiftStaff qua `calculateMinWork`), OT = `(end − start)` không trừ nghỉ trưa.

#### 2.6 OT (tăng ca)
- Tạo qua `create-overtime`: ca hệ thống `OT` phải bật ngày trong tuần; không trùng giờ; `is_ot=1`, `overtime_type='H'`. `is_not_check_in=1` → tự đánh dấu đã chấm (checking_type 0, có giờ confirmed); `0` → NV phải check-in/out 1 lượt.
- Đổi sang ca OT qua changeShift thì không đổi `checking_type`.
- Báo cáo có status `overtime` trong danh mục nhưng **không có logic gán** (Repo.php:2848-2852).

#### 2.7 Quên check-out
- **Không có job/cron hay logic tự động đóng ca** trong repo này (không tìm thấy). Ca thiếu vào/ra hiển thị `missing_check` (báo cáo) / màu `#FDD9D7`. Xử lý: quản lý dùng `accept-actual-time` với `is_attend=1` (chấm công hộ: ghi log vào/ra = giờ ca, `created_type='admin'`, `timekeeping_type='time-attendance'`) hoặc chỉ nhập `actual_time_work` để xác nhận giờ.
- Do status chỉ sang `not-confirm` khi checkout bước cuối, ca quên checkout sẽ ở `approved` mãi tới khi quản lý xác nhận.

#### 2.8 Chấm công hộ / xác nhận (quản lý)
- `accept-actual-time` (1B.10). Không kiểm tra quyền (bất kỳ user nào gọi được). Mọi thay đổi log vào/ra cũ lưu vào `sf_check_in_change_log` / `sf_check_out_change_log`.

#### 2.9 Đổi ca
- NV gửi `change-shift` (tự duyệt nếu `check_approved_time_working === 0` hoặc người gửi là quản lý của NV) → quản lý duyệt bằng `approved-change-shift`/`approved-all`. Đổi ca khi đã check-in sẽ **reset chấm công và xóa log vào**. Có hoàn phép nếu ca cũ là P/1/2 đã approved (không trừ phép cho ca mới – đoạn trừ phép đã comment).

#### 2.10 Xin đi trễ / về sớm
- NV: `submit-time-late-soon` (status → `waiting` trừ khi auto-approve) → QL: `approved-time-late`, `approved-time-soon`, `approved-time-soon-late-staff`, hoặc `approved-all(-v2)` set `is_approve_late`/`is_approve_soon` (+ `status` thường là `approved`).
- Hiệu lực: `is_approve_late = 1` → check-in trễ quá `late_check_in` không bị chặn. `is_approve_soon` và `time_late_apply_work_*` **không được dùng** trong tính toán server (không trừ `number_late_time`/`number_time_back_soon`, báo cáo vẫn tính trễ/sớm). Có thể app/portal dùng để hiển thị (chưa xác định).
- Đơn phép loại 017/018 (TimeOffDays) đáng lẽ set phút xin trễ/sớm nhưng là dead code (mục 1C).

#### 2.11 Danh sách ca PG / ca hôm nay
- `get-list-by-pg`: ca của chính user theo tuần/tháng; `get-list-today`: ca hôm nay của user; `get-list-by-staff`: ca của `staff_id` bất kỳ; đều kèm `images[]` (selfie). Chỉ status ∈ {waiting, approved, not-approved, not-confirm, confirmed}.

#### 2.12 Báo cáo
- Lịch sử cũ (`histories`, `personal-history`): màu `back_ground` (3.6).
- Báo cáo mới (`report-time-working-staff` tuần/tháng, `report-time-working-staff-detail` theo ngày): status (3.5), giờ vào = log vào đầu tiên, giờ ra = log ra cuối.
- Tổng hợp: `get-list-group-status(-staff)`, `get-total-time-keeping`, `get-total-time-shift`.

#### 2.13 Thông báo (push)
`NotificationRepo::insertLogNoti` (`Modules/Notification/Repositories/Notification/NotificationRepo.php:2157-2192`): insert `StaffNotificationDetail` (`content`, `action_name`, `action`, `action_params`) rồi `POST {NAE_SERVICE_URL}/notification/push` body `{tenant_id (session idTenant), staff_id, title, message, detail_id, avatar}`; lỗi chỉ log. Mọi noti dưới đây có `action='time_working_staff_detail'`, `action_name='Chi tiết lịch làm việc'`, `action_params={"time_working_staff_id":..,"action":"time_working_staff_detail"}`.

| Sự kiện | Người nhận | Title | Message | Nguồn |
|---|---|---|---|---|
| NV check-in (mới) | quản lý NV | `:staff_name chấm công` | `:staff_name đã checkin vào lúc :time của ca :shift_name` | Repo.php:1377-1386 |
| NV checkout bước cuối (client gửi status not-confirm) | `staff_manager_id` client gửi | Xác nhận lịch làm việc | Đang có lịch làm việc ngày :date của :name đang chờ xác nhận. | 1556-1575 |
| Xin trễ/sớm | quản lý | Phê duyệt đi sớm / về trễ | Đang có yêu cầu xin đi trễ / về sớm ngày :date của :name đang chờ phê duyệt. | 731-740 |
| Duyệt trễ/sớm | NV | Phê duyệt đi sớm / về trễ | Lịch làm việc ngày :date của bạn đã được phê duyệt đi sớm / về trễ. | 776-785 |
| Đổi ca chờ duyệt | quản lý | Phê duyệt lịch làm việc | Đang có lịch làm việc ngày :date của :name đang chờ phê duyệt. | 992-1001 |
| Đổi ca tự duyệt bởi QL | NV | Quản lí đổi ca lịch làm việc | Đã đổi ca lịch làm việc ngày :date của bạn thành :shift_name. | 1003-1014 |
| Duyệt đổi ca | NV | Phê duyệt đổi ca lịch làm việc | Lịch làm việc ngày :date của bạn đã được phê duyệt đổi ca. | 1066-1075 |
| Duyệt lịch / approved-all | NV | Phê duyệt lịch làm việc | Lịch làm việc ngày :date của bạn đã được phê duyệt. | 632-641, 1129-1138 |
| approved-all-v2 | NV (phần tử cuối) | Phê duyệt lịch làm việc | Lịch làm việc tuần :week của bạn đã được phê duyệt. | 3200-3209 |
| Xác nhận giờ | NV | Xác nhận giờ làm việc | Lịch làm việc ngày :date của bạn đã được xác nhận giờ làm. | 587-596 |
| Chấm công hộ | NV | Chấm công hộ | Lịch làm việc ngày :date của bạn đã được chấm công hộ. | 598-607 |
| Tạo lịch / thêm ca | quản lý | Phê duyệt lịch làm việc | Đang có lịch làm việc ngày :date của :name đang chờ phê duyệt. | 1769-1778, 2362-2371 |
| Tạo OT chờ duyệt | quản lý | Phê duyệt lịch làm việc | Đang có lịch làm việc thêm giờ ngày :date của :name đang chờ phê duyệt. | 2196-2205 |
Luồng cũ `/timekeeping/check-in|check-out` không gửi noti.

#### 2.14 Cấu hình (`sf_config_general`, key `config_general_code`)
Đọc qua `_setConfigGeneral` (TimeKeepingRepository.php:552-598 – 4 key; Repo.php:1965-2034 – 8 key): bỏ qua `is_actived=0`; `config_general_unit='hour'` → ×60, ngược lại coi là phút; `intval`. Không có bản ghi → 0.

| Key | Ảnh hưởng | Mặc định khi thiếu |
|---|---|---|
| `late_check_in` | Cũ: ân hạn khi tính `number_late_time`. Mới: số phút trễ tối đa được check-in (chặn nếu chưa duyệt trễ). Báo cáo/màu: ngưỡng "vào trễ". | 0 (cũ: không ân hạn; mới: không chặn; báo cáo: trễ ≥1 phút) |
| `back_soon_check_out` | Cũ: ân hạn về sớm. Báo cáo/màu: ngưỡng "ra sớm". Mới: không dùng. | 0 |
| `off_check_in` | Báo cáo/màu: vào sau `start + off_check_in` → nghỉ không lương (`unpaid_leave`/`#EBD4EF`) | 0 = tắt |
| `off_check_out` | Báo cáo/màu: ra trước `end − off_check_out` → nghỉ không lương | 0 = tắt |
| `checkin_time_before` | Mới: số phút được check-in sớm tối đa. `/timekeeping/shift`: ngưỡng quyết định trả kèm history (dùng giá trị thô, không đổi đơn vị) | 0 = không giới hạn; shift: không có config → luôn kèm history |
| `checkin_with_image` | Trả về app `config.checkin_with_image` (0/1) – app quyết định bắt chụp selfie | 0 |
| `close_time_working_start` / `close_time_working_end` | Kỳ công tháng (ngày bắt đầu ở tháng trước / ngày kết thúc tháng hiện tại) | 26 / 25 |
| `round_timekeeping_coefficient` | Parse nhưng không dùng | 0 |

Cột cấu hình khác:
- `staffs.check_in_limit`: `0` → bỏ qua kiểm tra wifi/GPS (luồng mới).
- `staffs.check_approved_time_working`: `0` → các yêu cầu (tạo lịch, đổi ca, xin trễ/sớm, OT, thêm ca) tự `approved`.
- `staffs.staff_manager_id`: người nhận noti / người được tự duyệt đổi ca.
- `sf_timekeeping_config` (theo `branch_id`, `is_actived=1`, `is_deleted=0`): `wifi_name`, `wifi_ip`, `timekeeping_type` (`wifi`/`gps`), `latitude`, `longitude`, `allowable_radius` (mét), `note`.
- `sf_shifts`: `start_work_time`, `end_work_time`, `start_lunch_break`, `end_lunch_break`, `checking_type`, `shift_code`, `timekeeping_coefficient`, `time_work`, `min_time_work`, `is_monday..is_sunday` (chỉ kiểm tra với OT), `is_system`, `start/end_timekeeping_on/out` (không dùng ở server).
- `branches/customers.latitude/longitude/allowable_radius`: chỉ trả về cho app trong `/timekeeping/shift` và list ca.

---

### 3. Trạng thái / enum

#### 3.1 `sf_time_working_staffs`
| Cột | Giá trị | Ý nghĩa |
|---|---|---|
| `time_working_staff_status` | `waiting` | Chờ quản lý duyệt lịch (tạo mới/đổi ca/xin trễ-sớm/OT khi không auto-approve) |
| | `approved` | Lịch đã duyệt → mới hiện ở `/timekeeping/shift` để chấm công |
| | `not-approved` | Quản lý từ chối |
| | `not-confirm` | NV đã checkout bước cuối, chờ quản lý xác nhận giờ |
| | `confirmed` | Quản lý đã xác nhận giờ công (`accept-actual-time`); check-in/out sau đó không update ca |
| `is_check_in`, `is_check_in_1..4` | 0/1 | Đã vào ca bước 1..5 |
| `is_check_out`, `is_check_out_1..4` | 0/1 | Đã ra ca bước 1..5 |
| `checking_type` | 0..5 | Số lượt vào/ra yêu cầu của ca (từ `sf_shifts`); 0 = không cần chấm (OT nhập tay) |
| `checking_curent_step` | 1..5 (giá trị khởi tạo: chưa xác định, có thể 0/1 theo DB default) | Bước hiện tại; checkout tăng lên bước kế |
| `is_deducted` | `NULL` | Ca làm việc bình thường |
| | `0` | Nghỉ có lương (P, 1/2 khi đổi ca; P khi tạo) |
| | `1` | Nghỉ không lương (KL) |
| `is_time_off_days` | 1 | Ca gắn đơn nghỉ phép (chỉ set ở dead code TimeOffDays) |
| `is_ot` | 0/1 | Ca tăng ca |
| `overtime_type` | `H` | OT theo giờ (chỉ thấy giá trị này) |
| `is_approve_late` / `is_approve_soon` | 1 = duyệt (giá trị khác do client gửi, thường 0) | Duyệt xin trễ/sớm |
| `is_approved_next_shift` | ≠0 = duyệt | Duyệt đổi ca |
| `working_place_type` | `store` (mặc định), `branch`, `customer` | Nơi làm; quyết định lat/long trả về |
| `shift_code_approved` | `1`, `1/2`, `P`, `P/2`, `OFF`, `KL`, `OT` | Loại công được duyệt |
| `is_close`, `is_off` | chưa xác định (không có logic dùng trong repo này) | |
| `approved_actual_time_by` | staff_id | Người xác nhận giờ |
| `approved_manual_time_by` | staff_id | Người chấm công hộ (đếm thành `waiting-confirm`) |

#### 3.2 `sf_check_in_log` / `sf_check_out_log`
| Cột | Giá trị | Ý nghĩa |
|---|---|---|
| `status` | `ok` / `not_ok` | Hợp lệ / thất bại (chỉ luồng cũ ghi `not_ok`, kèm `reason="<id>:<lỗi>"`, `time_working_staff_id=0`) |
| `created_type` | `staff` / `admin` | NV tự chấm / quản lý (chấm hộ, OT nhập tay). Luồng mới lấy từ client. |
| `timekeeping_type` | `wifi`, `gps`, `time-attendance`, `free` | Chấm bằng wifi / GPS / chấm hộ / không kiểm tra vị trí (`check_in_limit=0`) (`Modules/TimeKeeping/Enum/TimeKeepingTypeEnum.php:9-12`) |
| `checking_curent_step` | 1..5 | Bước |
| `checkin_type` | do client gửi | chưa xác định giá trị |
| `image_selfie`, `imei`, `device_name`, `platform`, `number_retry`, `radius`, `latitude`, `longitude`, `wifi_ip`, `wifi_name`, `request_ip` | | Thông tin thiết bị/vị trí |

#### 3.3 `sf_config_general.config_general_unit`: `hour` (×60) hoặc khác (phút). `is_actived` 0/1.

#### 3.4 Action log `sf_time_working_staffs_action_log.action_type`
`check_in_log`, `approved-actual-time`, `update-status`, `approved-late`, `approved-soon`, `waitting-late-soon`, `approved-late-soon`, `approved-change-shift`, `approved`, `sync-create-time-working` (Repo.php:1828-1843).

#### 3.5 Status báo cáo (Repo.php:2683-2788, danh mục 2815-2855)
| value | label | color | Điều kiện |
|---|---|---|---|
| `not_yet` | Chưa đến ca | #B0B5BD | Ngày ca > hôm nay (trừ khi is_deducted 0/1) |
| `on_time` | Chấm công đúng giờ | #3FAE8F | Mặc định / vào ≤ start+late_check_in và ra ≥ end−back_soon_check_out |
| `missing_check` | Chưa vào/ra ca | #F08A5D | Thiếu in hoặc out (hôm nay: thiếu 1 trong 2; quá khứ: có 1 nhưng thiếu 1) |
| `late_or_early` | Vào trễ/ra sớm | #F2B84B | Vào > start + late_check_in hoặc ra < end − back_soon_check_out |
| `paid_leave` | Nghỉ phép có lương | #8E9FE6 | `is_deducted = 0` |
| `unpaid_leave` | Nghỉ phép không lương | #E5E0FF | `is_deducted = 1`; quá khứ không vào không ra (is_deducted ≠ 0); vượt `off_check_in`/`off_check_out` |
| `overtime` | Tăng ca | #E04F5F | Không có logic gán |
Ưu tiên (ghi đè theo thứ tự trong code): ngày hôm nay: missing_check → paid/unpaid (is_deducted) → late_or_early → unpaid (off_*). Quá khứ: is_deducted quyết định nếu khác null, ngược lại missing/unpaid → late_or_early → on_time → unpaid (off_*). (Lưu ý: ngày hôm nay không có nhánh trả lại `on_time` khi đúng giờ – mặc định on_time chỉ bị ghi đè.)

#### 3.6 Màu `back_ground` lịch sử cũ (TimeKeepingRepository.php:600-861)
| Màu | Ý nghĩa |
|---|---|
| `#D3D3D3` | Mặc định / ngày tương lai |
| `#D9DCF0` | Nghỉ có lương (`is_deducted = 0`) |
| `#EBD4EF` | Nghỉ không lương (`is_deducted = 1`, hoặc quá khứ không vào/ra, hoặc vượt off_check_in/out) |
| `#DBEFDC` | Đúng giờ |
| `#FDD9D7` | Thiếu vào hoặc ra |
| `#FFEACC` | Vào trễ / ra sớm |
`back_ground` của ngày = màu của ca cuối trong ngày (biến bị ghi đè trong vòng lặp, Repository.php:402-410).

---

### 4. Luồng end-to-end phía app (suy ra từ API)

#### 4.1 Nhân viên – chấm công hằng ngày (luồng mới, khả năng cao app đang dùng)
1. Đăng nhập (JWT) – ngoài phạm vi.
2. `POST /timekeeping/shift` → lấy ca hiện tại (`time_working_staff_id`, `working_day/time`, `working_end_*`, `checking_type`, `checking_curent_step`, `is_check_in*`, `is_check_out*`, `check_in_date*`, `check_in_limit`, lat/long/allowable_radius điểm làm việc, `config.checkin_with_image`, `history`, `carbon_now` để đồng bộ giờ server). Lỗi → hiển thị "Hôm nay không có lịch làm việc...".
3. (Tùy `checkin_with_image`) app chụp selfie, upload ảnh (API upload nằm ngoài phạm vi – chưa xác định), lấy wifi IP/tên, GPS, thông tin thiết bị.
4. `POST /time-working-staff/check-in` với `time_working_staff_id`, `access_point_ip`, `latitude`, `longitude`, `checkin_log{checking_curent_step = bước hiện tại, image_selfie, wifi_name, access_point_ip, request_ip, imei, device_name, platform, checkin_type, created_type='staff', created_by, number_retry, check_in_log_id (khi retry)}` → nhận `check_in_log_id`. Server push noti tới quản lý.
5. Hết giờ: `POST /time-working-staff/check-out` với `time_working_staff_id`, vị trí, `checking_type`, `check_in_date[_n]` (giờ vào của bước – lấy từ `/timekeeping/shift`), `time_working_staff_status` (app gửi `not-confirm` nếu là bước cuối), `staff_manager_id`, `checkout_log{checking_curent_step, ...}`.
   - Còn bước (checking_type > step) → server tăng `checking_curent_step`; app quay lại bước 2–4 cho lượt kế tiếp.
   - Bước cuối → status `not-confirm`, noti quản lý.
6. Xem lại: `/time-working-staff/get-detail`, `get-list-today`, `get-list-by-pg` (tuần/tháng), `get-list-last-week`, `get-total-time-keeping` (bảng công tháng), `get-list-group-status-staff`, `get-total-time-shift`, `/timekeeping/personal-history`, `/timekeeping/get-day-holiday`.

#### 4.2 Luồng cũ (nếu app cũ còn dùng)
`/timekeeping/shift` → `/timekeeping/check-in` (`time_working_staff_id`, `wifi_name`, `access_point_ip`, lat/long) → `/timekeeping/check-out` (`access_point_ip` bắt buộc) → `/timekeeping/personal-history`.

#### 4.3 Nhân viên – lịch làm việc, đổi ca, xin trễ/sớm, OT
- Đăng ký lịch: `get-list-shift` (theo `branch_id`) → `create` (`array_time_working_staff[]`) → status `waiting` (hoặc `approved`).
- Đổi ca: `get-list-shift` → `change-shift` → chờ `approved-change-shift`.
- Xin trễ/sớm: `submit-time-late-soon` → chờ duyệt (`approved-time-late|soon|soon-late-staff`). Sau khi duyệt trễ, check-in trễ không bị chặn. (Ca chuyển `waiting` khi gửi → cần được duyệt lại thành `approved` để hiện ở `/timekeeping/shift`.)
- Tăng ca: `get-shift-overtime` → `create-overtime`.
- Nghỉ phép: `/timeoffdays/sf-shifts/list` (chọn ca) → `/timeoffdays/create` → duyệt `/timeoffdays/activity` (không tác động ca – xem 1C). Đổi ca sang P/KL qua `change-shift` mới set `is_deducted`.

#### 4.4 Quản lý
1. `get-staff-manager` / `get-list-group-status` (tuần) → chọn NV → `get-list-by-staff`.
2. Duyệt lịch: `approved-time-working-staff`, `approved-all`, `approved-all-v2` (cả tuần), `approved-change-shift`, `approved-time-late`, `approved-time-soon`, `approved-time-soon-late-staff`.
3. Thêm ca cho NV: `add-shift-staff`, `create-overtime`.
4. Sau ca: NV ở `not-confirm` → `get-detail` (xem history + ảnh) → `accept-actual-time` (`actual_time_work`, `shift_code_approved`, `timekeeping_coefficient`, `note`; `is_attend=1` để chấm công hộ khi NV quên) → `confirmed`.
5. Báo cáo: `report-time-working-staff` (tuần/tháng), `report-time-working-staff-detail` (ngày), `status-time-working-staff`, `get-branch-right-by-staff`, `/timekeeping/histories`.

---

### 5. Các điểm cần lưu ý / nghi vấn (tổng hợp)
1. Hai luồng check-in/out cùng tồn tại với rule khác nhau (wifi IP server vs client, có/không khung giờ, cách tính trễ/sớm khác nhau).
2. Luồng mới tin dữ liệu client: `access_point_ip`, `check_in_date_n`, `checking_type`, `time_working_staff_status`, `staff_manager_id`, `staff_id/branch_id/shift_id` của log check-out.
3. Không kiểm tra quyền sở hữu ca (check-in mới) hay quyền quản lý (các API duyệt/chấm hộ).
4. Rule trễ ở bước 2..5 vẫn so với giờ bắt đầu ca → có thể chặn check-in các lượt sau nếu `late_check_in > 0` và chưa duyệt trễ.
5. `/timekeeping/shift` luôn trả ca sớm nhất đã approved trong ngày (không chuyển ca khi nhiều ca/ngày).
6. `checkin_time_before` dùng 2 cách đơn vị khác nhau (shift: giá trị thô; check-in: có ×60 nếu `hour`).
7. Đơn phép duyệt không cập nhật ca (dead code `updateTimeWorkingStaff`).
8. Không có cơ chế auto checkout/quên checkout; không có job tính công.
9. Nhiều lỗi PHP tiềm ẩn (undefined index/variable, `JsonResponse` dùng như mảng, `dd()` trong catch, kỳ công tháng 1 ra `YYYY-00-26`).
10. `sf_recompense` và module work schedule riêng không tồn tại trong repo này.

---

# PHẦN IV — APP NHÂN VIÊN: CHẤM CÔNG CÁ NHÂN

## Phân tích module Check-in/Check-out và chấm công cá nhân — App nhân viên (Matthews_staff)

Gốc mã nguồn: `/Users/mwang/WAO/Mobile/Matthews/Matthews_staff/lib` (các đường dẫn bên dưới tính từ `lib/`).
Viết tắt:
- `CIO` = `presentation/modules/main_module/modules/home_module/modules/check_in_out_module/src`
- `SCH` = `presentation/modules/main_module/modules/home_module/modules/schedule_module/src`
- `TKM` = `presentation/modules/main_module/modules/account_module/modules/timekeeping_module/src`
- `MB` = `presentation/modules/main_module/src/bloc/main_bloc.dart`
- `UT` = `presentation/utils/ultility.dart`
- `TWM` = `data/models/request/time_working_model.dart`

Mọi text hiển thị đã tra trong `assets/json/vi.json` (qua `common/lang_key.dart`). Tất cả API là `POST` (lớp `Interaction(...).post()`).

---

### 0. Tổng quan và cơ chế chung

#### 0.1 Quyền (permission) hiển thị chức năng
- Quyền là danh sách widget lấy từ API `v2/user/permission` (`data/network/api/api.dart:16`), lưu ở `Globals.permissionModels` (`presentation/modules/login_module/src/bloc/login_bloc.dart:64-77`), kiểm tra bằng `checkVisibilityKey(widgetId)` (`ultilites/visibility_api_widget_name.dart:97-109`).
- Mã liên quan (`ultilites/visibility_api_widget_name.dart:67-68,94`):
  - `TI000000` — comment "Chấm công": menu "Lịch sử chấm công / Quản lý chấm công" (danh sách chấm công nhiều nhân viên).
  - `TI000001` — comment "Lịch sử chấm công": thực tế điều khiển thẻ Check-in/out trên Home + 3 menu LLV + mục "Lịch sử chấm công" trong Tài khoản.
  - `TI000002` — "Báo cáo chấm công dành cho quản lý" (ngoài phạm vi cá nhân).
- Phía client KHÔNG có kiểm tra vai trò leader/nhân viên cho các màn hình lịch cá nhân (đoạn `if (Globals.model!.isLeader)` bị comment ở `home_screen.dart:331-342`).

#### 0.2 Xử lý lỗi/mạng chung
- Trước mỗi request: kiểm tra mạng bằng `connectivity_plus` (`data/network/http/http_connection.dart:134-149`, `data/network/network_connectivity.dart:3-6`). Mất mạng → trả lỗi "Kiểm tra kết nối mạng!" (`connection_error`).
- Response HTTP 2xx nhưng body rỗng → "Lỗi máy chủ!"; parse lỗi → "Lỗi dữ liệu!"; HTTP khác 2xx → "Lỗi máy chủ!" (`data/network/api/interaction.dart:112-137`).
- `success=false` → nếu `showError=true` (mặc định) hiện dialog tiêu đề "Thông báo", nội dung = `errorDescription` của server (`interaction.dart:103-107`). 401 → tự refresh token; thất bại → dialog "Lỗi" / "Hết phiên sử dụng!" rồi logout (`interaction.dart:83-102`).
- `API.successCode = 0`, `API.noDataCode = 1` (`api.dart:5-6`).
- **Offline**: không có cơ chế lưu tạm/đồng bộ lại (không queue, không local DB cho chấm công). Mất mạng = báo lỗi và dừng. Trường `number_retry` chỉ đếm số lần bấm "Làm lại" trong cùng màn hình (xem 2.6), không phải retry offline.

#### 0.3 Upload ảnh
- `repository.upload` → `AWSInteraction.upload()` dùng `aws_s3_upload_lite` upload thẳng lên S3 (`data/network/http/aws_connection.dart:19-44`, `domain/resources/aws_resource.dart:7-11`). Không qua API backend. URL trả về được gửi kèm vào API chấm công. URL rỗng → "Lỗi máy chủ!".

#### 0.4 Hằng số liên quan (`common/constant.dart`)
- `TimeWorkingStatus` (393-400): `not-confirm`, `confirmed`, `not-approved`, `approved`, `waiting`, `waiting-confirm`.
- `TimeWorkingStatusName` (402-413) / `TimeWorkingStatusColor` (442-449):

| status | Text (vi) | Màu |
|---|---|---|
| `confirmed` | Đã xác nhận | darkGreen `#2AA27E` |
| `not-confirm` | Chờ xác nhận | orange500 `#FF9800` |
| `not-approved` | Không được duyệt | black `#000000` |
| `approved` | Đã duyệt | primary `#3398dc` |
| `waiting` | Chờ duyệt | pinkSale `#E91D62` |
| `waiting-confirm` | Chấm công hộ | `Colors.purple` |

  Lưu ý: `parseTimeWorkingStatus` (`UT:1557-1589`) chỉ map 4 trạng thái đầu; mọi giá trị khác (kể cả `waiting-confirm`, null) rơi vào default "Chờ duyệt"/pinkSale. Màu tím "Chấm công hộ" chỉ xuất hiện ở khối tổng hợp (CustomPGList).
- `CheckingType` (415-422): 0..5 — số lượt vào/ra trong ca (`checking_type`) và bước hiện tại (`checking_curent_step`).
- `initPosition = LatLng(10.8231, 106.6297)` (TP.HCM), `mapZoom = 16.0` (`constant.dart:21-22`).
- Format ngày (`common/theme.dart:464-468`): `formatFullTime "HH:mm:ss"`, `formatDateTime "dd/MM/yyyy HH:mm"`, `formatDateCreate "yyyy-MM-dd"`, `formatDateResponse "yyyy-MM-dd HH:mm:ss"`.

---

### 1. Màn hình Home — Thẻ chấm công (Check-in/Check-out)

#### 1.1 Nơi mở + điều kiện
- Thẻ nằm đầu danh sách Home nếu `checkVisibilityKey(TI000001)` (`presentation/modules/main_module/modules/home_module/src/ui/home_screen.dart:992-994`).
- Dữ liệu tải khi refresh Home nếu có `TI000001` (`home_screen.dart:420-421`) và trong `MainBloc.onRefresh` nếu có `TI000000` (`MB:1146-1147`) — 2 mã khác nhau cho cùng hàm.
- Khi có lỗi (stream error): hiện text lỗi màu darkRed bold, căn giữa (`home_screen.dart:590-595`).
- Nếu server trả `errorCode == 1` (noData, ví dụ không có ca hôm nay) → model có `message` → **ẩn hẳn thẻ** (`home_screen.dart:598-600`, `MB:392-394`).

#### 1.2 API tải ca hiện tại
- `timekeeping/shift` (`api.dart:227`), không params, `showError: false` (`domain/resources/timekeeping_resource.dart:12-16`).
- Response `data` parse thành `TimeWorkingModel` (`MB:348-351`). Field dùng: `time_working_staff_id`, `customer_name`, `customer_adress_full`, `customer_avatar`, `latitude`, `longitude`, `allowable_radius`, `shift_id`, `shift_name`, `is_check_in`, `is_check_out`, `checking_type`, `checking_curent_step`, `check_in_limit`, `customer_info`, `config.checkin_with_image`, `working_time`, `working_day`, `working_end_day`, `working_end_time`, `history[]` (`checkin_info.check_in_time`, `checkout_info.check_out_time`), `start_working_format_day/month/year` (dùng để kiểm tra ngày khi chấm công) và toàn bộ field khác (vì model được gửi ngược lên khi check-in/out).

#### 1.3 Quy tắc xác định nút (`MB:353-389`)
- `is_check_in==0 && is_check_out==0` → nút **Check-in** (`isCheckIn=1`).
- `is_check_in==1` → nút **Check-out** (`isCheckIn=0`).
- `is_check_in==1 && is_check_out==1` → không có nút (`isCheckIn=null`).
- `isLast = (checking_curent_step == checking_type) ? 1 : 0` (không thấy dùng ở UI).
- `checkLocation = (check_in_limit != 0)` → bật luồng lấy GPS khi chụp ảnh.
- Với ca nhiều lượt (checking_type > 1): client chỉ dựa vào `is_check_in`/`is_check_out` (lượt 1) để chọn nút; việc server cập nhật 2 cờ này cho các lượt sau thế nào → **chưa xác định**.

#### 1.4 Bố cục UI (`presentation/widgets/custom_timekeeping.dart:44-125`)
- Loading: shimmer skeleton (46-58).
- Dòng tiêu đề: `shift_name` (style15PrimaryBold, căn giữa) + icon lịch bên phải (nếu `TI000001`) → mở `ScheduleScreen` (65-90).
- "Thời gian: {working_time} - [{working_end_day dd/MM/yyyy} nếu khác working_day] {working_end_time}" (100-102).
- Với mỗi phần tử `history`: "Lần {i+1}: {HH:mm vào} - {HH:mm ra}" (103-110).
- Nút (111-120) — hiện khi `isCheckIn != null` và có callback:
  - `isCheckIn==1`: text **"Giờ vào"** (key `checkin`), nền orange500 `#FF9800`.
  - `isCheckIn==0`: text **"Giờ ra"** (key `checkout`), nền red500 `#F44336`.
  - Không có điều kiện enable/disable nào khác (điều kiện `isDeviceCheckIn` bị comment ở `home_screen.dart:610-612`).

#### 1.5 Hành vi khi bấm (`MB:1158-1168`, `_checkConfig` `MB:400-464`)
- Nếu `model.model == null` → mở `CheckInOutScreen` (trường hợp này bloc sẽ lỗi vì dùng `model.model!` — **có thể crash**).
- Ngược lại đọc `config.checkin_with_image` (`TWM:530-541`):
  - `!= 0` → mở **màn hình CheckInOutScreen (chụp selfie)** (mục 2). Khi trả về `true` → gọi lại `timekeepingShift(false)` (`MB:1170-1175`).
  - `== 0` (hoặc null) → **chấm công không ảnh** ngay tại Home:
    1. Hiện progress dialog, gọi `getLocation` (mục 2.4) — **luôn yêu cầu GPS** bất kể `check_in_limit`.
    2. Không lấy được vị trí → dialog "Thông báo" / "Không thể lấy vị trí hiện tại. Vui lòng thử lại." (`MB:410-418`).
    3. Gọi `CheckInOutHelper.checkInWithoutImage` hoặc `checkOutWithoutImage` (`CIO/bloc/check_in_out_helper.dart:17-131`, `134-275`) — logic giống mục 2.6/2.7 nhưng `image_selfie = null`, `number_retry = 0`, khoảng cách tính từ `latitude/longitude` của TimeWorkingModel.
    4. Thành công → dialog "Thông báo" / "Chấm công vào thành công" hoặc "Chấm công ra thành công", rồi refresh ca + Home (`MB:441-454`).
    5. Thất bại → dialog "Thông báo" / `errorDescription` hoặc "Có lỗi xảy ra" (hard-code) (`MB:455-461`). Lưu ý: lỗi từ server đã được `Interaction` hiện 1 lần (showError mặc định true) → người dùng có thể thấy **2 dialog lỗi liên tiếp**. Lỗi sai ngày (helper trả `success:false`) chỉ hiện 1 dialog "Ngày làm việc không hợp lệ".

---

### 2. Màn hình Check-in / Check-out (chụp selfie) — `CheckInOutScreen`

File: `CIO/ui/check_in_out_screen.dart` (269 dòng), `CIO/bloc/check_in_out_bloc.dart` (758 dòng).

#### 2.1 Nơi mở + điều kiện
- Chỉ mở từ thẻ Home (mục 1.5) khi `config.checkin_with_image != 0` (`MB:404-405`, `MB:1162-1163`). Không có đường mở khác.

#### 2.2 Bố cục UI
- AppBar: "Giờ vào" nếu `isCheckIn==1`, ngược lại "Giờ ra" (`check_in_out_screen.dart:262-264`). Back = pop trả về `hasUpdate` (266).
- Pull-to-refresh: gọi lại `getCurrentPosition()` (45-48).
- Ô ảnh (rộng = màn hình, cao = 1/2, viền primary, bo 8) (174-209):
  - Chưa có ảnh: icon camera + text **"Chụp ảnh"** (màu primary, 13px) (211-235); bấm → `onImage()`.
  - Có ảnh (sau khi chấm công thành công): hiển thị ảnh URL; bấm → xem ảnh full với tiêu đề "Giờ vào"/"Giờ ra".
- Bản đồ Google Map (rộng = màn hình, cao = 1/2) (116-172): `myLocationEnabled`, nút vị trí, la bàn, zoom; camera khởi đầu tại vị trí đã lưu trong SharedPrefs (`latitude/longitude`) hoặc `initPosition` TP.HCM; marker "1" tại `latitude/longitude` của địa điểm (khách hàng/chi nhánh) từ API ca (`check_in_out_bloc.dart:50-72`).
- Dòng thông tin: tiêu đề **"Thời gian checkin"** / **"Thời gian checkout"**, nội dung = thời điểm server trả về (dd/MM/yyyy HH:mm), rỗng khi chưa chấm (100-111).
- Khối "Cách cửa hàng" + màu xanh/đỏ theo bán kính **đã bị comment** (77-99) → UI hiện tại không hiển thị khoảng cách, không so sánh bán kính.
- Bottom (237-248): nút chính **"Làm lại"** → xóa ảnh/ngày và gọi lại `onImage()`; nút phụ **"Thoát"** → pop trả `hasUpdate`.

#### 2.3 Khởi tạo (onReady) — lấy vị trí (`check_in_out_bloc.dart:97-179`)
1. Dịch vụ định vị tắt → dialog "Thông báo" / "Vui lòng bật Dịch vụ Định vị để ứng dụng hiển thị chính xác thông tin mạng", nút "Xác nhận" → mở cài đặt vị trí.
2. Quyền `deniedForever` → dialog "Vui lòng cho phép quyền vị trí để sử dụng chức năng này", có nút hủy, nút "Mở cài đặt" → `openAppSettings()`.
3. Quyền `denied` → hiện **dialog công bố vị trí** (một lần, lưu `location_disclosure_status`) (`UT:1641-1678`): tiêu đề "Quyền truy cập Vị trí", nội dung nêu mục đích Chấm công + Theo dõi lộ trình giao hàng; nút "Từ chối"/"Chấp nhận". Chấp nhận → xin quyền hệ thống; vẫn bị từ chối → dialog "Vui lòng cho phép quyền vị trí để sử dụng chức năng này".
4. Có quyền → `getLocation` (2.4), lưu lat/long vào SharedPrefs, di chuyển camera bản đồ.

#### 2.4 Lấy vị trí GPS (`getLocation` `UT:945-1037`, `getLocationPosition` `UT:1039-1120`)
- Kiểm tra service/permission (các dialog: "Vui lòng bật Dịch vụ Định vị..."; tiêu đề "Cho phép quyền truy cập" + "Vui lòng cho phép quyền vị trí để sử dụng chức năng này" với nút "Cho phép" → mở cài đặt).
- Thứ tự lấy vị trí:
  0. `getLastKnownPosition` nếu **mới hơn 2 phút** → dùng luôn.
  1. `LocationAccuracy.high`, distanceFilter 10, timeout 15s.
  2. `medium`, timeout 10s.
  3. `lowest`, timeout 8s.
  4. Cuối cùng dùng lastKnown cũ (bất kể tuổi) nếu có; không có → `null`.
- Exception → dialog "Thông báo" / `'Unable to get location: $e'` (hard-code tiếng Anh).
- **Mock location / fake GPS: không kiểm tra** (không dùng `position.isMocked`, không có package chống giả lập; grep `isMocked|mock` không có kết quả).

#### 2.5 Bấm "Chụp ảnh" — `onImage()` (`check_in_out_bloc.dart:189-263`)
- Hiện loading.
- Nếu `checkLocation` (`check_in_limit != 0`):
  - Kiểm tra `Permission.location`; denied/permanentlyDenied → dialog công bố; từ chối → dừng. Xin quyền: denied → "Vui lòng cấp quyền vị trí để sử dụng tính năng này"; permanentlyDenied → "Quyền truy cập vị trí đã bị từ chối vĩnh viễn. Vui lòng bật trong Cài đặt".
  - `getLocation`; null → "Không thể lấy vị trí hiện tại. Vui lòng thử lại.".
  - Tính `radius = Geolocator.distanceBetween(lat/long địa điểm, lat/long hiện tại)` (mét) nếu địa điểm có toạ độ; ngược lại `radius = 0` (246-254).
  - **Không so sánh với `allowable_radius`, không chặn khi ngoài bán kính** — chỉ gửi `radius` lên server.
- Nếu không `checkLocation`: bỏ qua GPS, `position = null`, `radius = null`.
- Tiếp `_handleCheckInOut` (265-327):
  1. Mở camera (`pickImageFromCamera` 405-425): xin quyền camera qua `CustomPermissionRequest` (bị chặn vĩnh viễn → dialog "Cho phép quyền truy cập Camera" / "Chọn Cài đặt vào Thông tin ứng dụng, chọn vào Quyền (Permissions), bật truy cập và vào lại màn hình này để sử dụng quyền Camera", nút "Cho phép"); `ImageSource.camera` **chỉ camera, không chọn từ thư viện**, ưu tiên **camera trước** (selfie), max 800x800, quality 50. Hủy chụp → dừng im lặng.
  2. Nếu `checkLocation` và lat/long == 0 → "Không thể lấy vị trí hiện tại. Vui lòng thử lại.".
  3. Reverse geocode qua `https://nominatim.openstreetmap.org/reverse?lat=..&lon=..&format=json` (timeout 5s, lỗi → rỗng) lấy `display_name` (427-459).
  4. **Đóng watermark lên ảnh** (329-403), chữ trắng 16 bold, bóng đen, góc trên-trái:
     - `Check-in: {fullName}` hoặc `Check-out: {fullName}`
     - `Time: dd/MM/yyyy HH:mm` (giờ thiết bị)
     - `Location: lat, long` (6 chữ số) nếu có
     - `Distance: {radius} m` nếu radius > 0
     - `Address: {địa chỉ}` nếu có
     Xuất PNG; lỗi → dùng ảnh gốc.
  5. Upload S3 (mục 0.3). Lỗi upload → dialog "Thông báo" / thông báo lỗi.
  6. Thành công → `checkIn(url, position, radius)` hoặc `checkOut(...)` theo `isCheckIn`.

#### 2.6 API Check-in — `checkIn()` (`check_in_out_bloc.dart:472-602`)
- **Rule ngày**: nếu `start_working_format_day/month/year` của ca ≠ ngày hiện tại của thiết bị → dialog "Thông báo" / **"Ngày làm việc không hợp lệ"**, dừng (476-485). Đây là kiểm tra thời gian duy nhất phía client (không kiểm tra giờ vào ca sớm/muộn, không dùng `start_timekeeping_on/end_timekeeping_on`).
- Dựng `CheckInLogModel` (lần đầu) (488-517): `time_working_staff_id`, `staff_id`, `staff_code`, `staff_name` (từ user đăng nhập), `checkin_type = checking_type`, `customer_id/code/name/adress_full`, `customer_latitude/customer_longitude` = **vị trí hiện tại của máy** (không phải toạ độ địa điểm), `allowable_radius`, `shift_id`, `shift_name`, `checking_curent_step`, `created_at`, `created_by`, `imei` (`DeviceId.imei`), `device_name` (`DeviceMarketingNames`), `platform` ("android"/"ios") (`UT:224-236`), `number_retry = 0`.
  - Lần "Làm lại" sau khi đã thành công: dùng lại log cũ (có `check_in_log_id` server trả), `updated_at = now`, `number_retry += 1` (518-523).
- Bổ sung: `check_in_day` (yyyy-MM-dd), `check_in_time` (HH:mm:ss) theo giờ thiết bị, `image_selfie = url`, `latitude/longitude` = vị trí hiện tại (null nếu không checkLocation), `radius`.
- Cập nhật TimeWorkingModel: `latitude/longitude` = vị trí hiện tại; theo `checking_curent_step`: 1 → `is_check_in=1, check_in_by, check_in_date`; 2 → `is_check_in_1...`; 3 → `_2`; 4 → `_3`; 5 → `_4` (537-570); `updated_at`, `updated_by`; `checkin_log` = log; `access_point_ip = Ipify.ipv4()` (IP public, 575).
- Gọi `time-working-staff/check-in` (`api.dart:415`, `domain/resources/time_working_staff_resource.dart:196-201`), body = **toàn bộ `TimeWorkingModel.toJson()`** (`TWM:397-528`, gồm `checkin_log` ~`TWM:513`, `config` ~`TWM:524`; key log ở `TWM:~1295-1336`).
- Thành công (579-601): `hasUpdate=true`; đọc từ `response.data`: `check_in_log_id`, `check_in_day`, `check_in_time`; hiển thị ảnh + thời gian; `Globals.bloc.onRefresh()`; dialog "Thông báo" / **"Chấm công vào thành công"**.
- Thất bại: dialog lỗi do `Interaction` (nội dung = `errorDescription` server).

#### 2.7 API Check-out — `checkOut()` (`check_in_out_bloc.dart:604-757`)
- Rule ngày giống check-in → "Ngày làm việc không hợp lệ".
- `CheckOutLogModel` tương tự (621-648); khi "Làm lại": `number_retry += 1` và **`checking_curent_step -= 1`** (để ghi đè lượt vừa ra) (649-656).
- `check_out_day`, `check_out_time`, `image_selfie`, `latitude/longitude`, `radius`.
- Theo step: 1 → `is_check_out=1, check_out_by, check_out_date, actual_time_work_0 = (check_out_date - check_in_date) giờ`; 2 → `_1` / `actual_time_work_1`; … 5 → `_4` (671-714). `getDifferenceHour` = phút/60 (`UT:1591-1599`).
- Bước tiếp: nếu `checking_curent_step < checking_type` → `checking_curent_step += 1`; ngược lại `time_working_staff_status = "not-confirm"` (715-721).
- `actual_time_work = tổng actual_time_work_0..4` (723-727). `access_point_ip = Ipify.ipv4()`.
- Gọi `time-working-staff/check-out` (`api.dart:414`, resource 189-194), body = toàn bộ TimeWorkingModel + `checkout_log`.
- Thành công: đọc `check_out_log_id`, `check_out_day`, `check_out_time`; dialog **"Chấm công ra thành công"**. (Khác check-in: không gọi `Globals.bloc.onRefresh()`; Home refresh khi thoát màn hình nhờ `hasUpdate`.)

#### 2.8 Tổng hợp rule phía client (Check-in/out)

| Rule | Có/không | Chi tiết |
|---|---|---|
| Quyền vị trí / bật GPS | Có | Bắt buộc khi `check_in_limit != 0` (luồng ảnh) và luôn bắt buộc ở luồng không ảnh |
| Tính khoảng cách | Có | `Geolocator.distanceBetween` → gửi `radius` (mét) |
| Chặn theo bán kính `allowable_radius` | **Không** | UI so sánh bán kính bị comment; client không chặn — server phải tự kiểm tra (chưa xác định server có kiểm tra) |
| Wifi SSID/BSSID | **Không** trong luồng hiện tại | Chỉ có ở code cũ `timekeepingCheckIn/Out` (mục 7) — không được gọi |
| IP | Có | `access_point_ip` = IP public (api.ipify.org qua `dart_ipify`) |
| Camera/selfie | Có khi `checkin_with_image != 0` | Chỉ camera, ưu tiên camera trước, watermark tên/giờ/toạ độ/khoảng cách/địa chỉ |
| Nhận diện khuôn mặt | Không | — |
| QR | Không | `mobile_scanner` chỉ dùng cho kho (`custom_scan_screen.dart`, `export_detail_barcode_scan_popup.dart`) |
| Thiết bị | Chỉ gửi thông tin | `imei`, `device_name`, `platform` trong log; không chặn thiết bị lạ (`isDeviceCheckIn` bị comment) |
| Mock location | **Không** kiểm tra | — |
| Thời gian cho phép | Chỉ kiểm tra **đúng ngày** của ca | Không kiểm tra khung giờ; giờ check-in/out lấy từ đồng hồ thiết bị |
| Chọn ca | Không | Ca do server trả ở `timekeeping/shift` |
| Offline | Không hỗ trợ | Báo "Kiểm tra kết nối mạng!" |

---

### 3. Màn hình "Lịch làm việc" (LLV — lịch của tôi) — `ScheduleScreen`

Files: `SCH/ui/schedule_screen.dart`, `SCH/bloc/schedule_bloc.dart`, widget `presentation/widgets/custom_schedule.dart`, `presentation/widgets/custom_pg_list.dart`.

#### 3.1 Nơi mở + điều kiện
- Menu Home **"LLV"** (key `my_schedule`) khi có `TI000001` (`home_screen.dart:326-330`).
- Icon lịch trên thẻ chấm công Home (`custom_timekeeping.dart:78-88`).
- Từ màn "Chấm công" (mục 8) với tham số `date` → chế độ theo tháng (`isTimekeeping=true`).

#### 3.2 Bố cục
- AppBar **"Lịch làm việc"**, nút "+" (`schedule_screen.dart:177-185`).
- Header:
  - Chế độ tuần (mặc định): `CustomHeaderWeek` (số tuần, ngày đầu/cuối tuần, chọn ngày) kèm khối tổng hợp `CustomPGList` (65-77).
  - Chế độ tháng: `CustomHeaderMonth` (54-63), không có khối tổng hợp.
- Khối tổng hợp (`custom_pg_list.dart:54-138`): tên nhân viên (bold), chi nhánh, và các dòng có màu theo trạng thái: "Chờ duyệt" (#E91D62), "Đã duyệt" (#3398dc), "Chờ xác nhận" (#FF9800), "Đã xác nhận" (#2AA27E), "Chấm công hộ" (purple), "Thời gian làm việc dự kiến", "Thời gian làm việc thực tế", "Thời gian làm việc được xác nhận" (định dạng giờ `formatHoursAU`).
- Danh sách thẻ ca (`custom_schedule.dart:25-269`):
  - Ngày (CustomHeaderDay) + chip trạng thái (text/màu theo bảng 0.4).
  - Chi nhánh (icon nhà) nếu có.
  - "{shift_name} ({working_time} -> {working_end_time})".
  - Nếu có check_in_date/check_out_date: "HH:mm -> HH:mm" bold + thời lượng "{h} Giờ {m} Phút" màu orange500.
  - Nếu đã xin đổi ca (`old_shift_id != null`): "Ghi chú" (old_shift_note), "Hình ảnh: Xem ảnh" (gạch chân, mở ảnh), "Ngày duyệt", "Người duyệt".
  - Nếu xin về sớm: "Về sớm: {n} Phút", "Ghi chú", "Ngày duyệt", "Người duyệt". Tương tự "Đi muộn".
  - Nếu `confirmed`: "Hệ số công: {timekeeping_coefficient}" (xanh đậm bold).
  - "Thời gian ước lượng: {time_work} Giờ" (orange500).
  - Danh sách ảnh `images`.
  - Rỗng: "Không có lịch làm việc" + nút **"Thêm"** (chế độ tuần) (90-101).

#### 3.3 Nút và điều kiện
`ApplicationModel` = `checkShowApplication(model, now)` (`UT:1520-1555`):
- Chỉ khi status ∈ {`approved`, `waiting`} (null coi như `waiting`) **và** `working_day >= hôm nay` → `showOvertime=true`; `showShift = (approve_next_shift_by` null/0); `showLate = (approve_soon_by` và `approve_late_by` đều null/0).
- `canChangeShift` (`UT:1446-1469`): `is_check_out != 1`, status ∈ {approved, waiting} (null → false), `working_day >= hôm nay`.

| Nút | Điều kiện hiện | Hành động |
|---|---|---|
| **"Đổi ca làm"** | (showShift **hoặc** showLate) **và** canChangeShift (`custom_schedule.dart:197-214`) — lưu ý không kiểm tra riêng showShift | Mở mục 4 |
| **"Đi muộn / Về sớm"** | showLate (215-221) | Mở mục 5 |
| **"Làm thêm giờ"** (nền orange500) | showOvertime (224-229) | Mở mục 6 |
| Bấm vào thẻ | luôn | Mở mục 7 (Chi tiết) |
| "Đổi ca"/"Chấm công thủ công" | Không hiện ở màn này (không truyền callback) | — |
| AppBar "+" | luôn | DatePicker giới hạn trong tuần đang xem → mở "Thêm ca" (mục 9) (`schedule_bloc.dart:128-145`). Ở chế độ tháng `startDate/endDate` chưa khởi tạo → **có thể lỗi** (LateInitializationError) |
| "Thêm" (khi rỗng, chế độ tuần) | danh sách rỗng | Mở "Thêm lịch làm việc" (mục 10) |

Sau khi các màn con trả `true` → reload danh sách + `Globals.bloc.onRefresh()`.

#### 3.4 API
- `time-working-staff/get-list-by-pg` (`api.dart:405`): tuần `{week, year}`; tháng `{month, type:"day"}` (`schedule_bloc.dart:168-201`; key `staff_id,type,week,month,year` — `data/models/request/list_by_pg_request_model.dart:20-24`). Response `datas[]` → TimeWorkingModel (dùng `time_working_staff_status`, `images`, `working_day`, `working_time`, `working_end_time`, `branch_name`, `shift_name`, `check_in_date`, `check_out_date`, `old_shift_*`, `image_next_shift`, `approve_*`, `time_late_apply_work_*`, `timekeeping_coefficient`, `time_work`, `is_check_out`).
- `time-working-staff/get-list-group-status-staff` (`api.dart:406`): tuần `{week, year}`; tháng `{month, type:"day"}` (`schedule_bloc.dart:203-224`; request model `staff_group_status_request_model.dart:38-49`). Response `data`: `staff_id`, `full_name`, `waiting`, `approved`, `not-approved`, `not-confirm`, `confirmed`, `waiting-confirm`, `actual_time_work`, `branch_name`, `estimated_time_work`, `actual_time_work_confirmed` (`data/models/response/staff_group_status_response_model.dart:154-168`).
- Cách tính tuần: `getWeekOfYear` = (số ngày từ 1/1 đến Chủ nhật của tuần) / 7 + 1 (`UT:1434-1441`); tuần bắt đầu Thứ 2.

---

### 4. Màn hình "Đổi ca làm" (đổi ca của bản thân) — `ScheduleShiftScreen`

Files: `SCH/ui/schedule_shift_screen.dart`, `SCH/bloc/schedule_shift_bloc.dart`.

- Nơi mở: nút "Đổi ca làm" ở thẻ LLV (mục 3) hoặc nút phụ ở Chi tiết (mục 7).
- AppBar **"Đổi ca làm"** (`schedule_shift_screen.dart:366`).
- Bố cục:
  - Ngày làm việc (CustomHeaderDay).
  - "Ca hiện tại: {shift_name}" (78-80).
  - "Chi nhánh": ô chọn (placeholder "Chọn chi nhánh") → bottom sheet chọn 1 (91-151, 245-261). Mặc định chi nhánh hiện tại của ca.
  - "Đổi ca" (bắt buộc *): ô chọn ca (placeholder "Chọn ca làm việc của bạn"), bottom sheet tiêu đề "Đổi ca" (152-212, 263-287). Mặc định ca hiện tại. Lưu ý: khi chưa có ca chọn thì hiển thị shimmer (166-177).
  - "Ghi chú": textarea 4 dòng, hint "Nhập ghi chú" (213-225).
  - "Ghi đè thời gian (Tùy chọn)": 2 dropdown giờ/phút "Giờ bắt đầu" – "Giờ kết thúc" (289-338). Chọn ca → tự điền giờ theo `start_work_time`/`end_work_time` của ca.
  - "Hình ảnh": thêm 1 ảnh (upload S3) (227-240).
  - Bottom: **"Lưu"**.
- Rule:
  - Danh sách ca lọc theo thứ trong tuần của ngày làm việc (`filterByDate` → `is_monday..is_sunday == 1`) (`UT:1605-1610`, `data/models/base/time_working_shift_model.dart:134-147`).
  - Đổi chi nhánh → xóa ca đã chọn, tải lại ca theo chi nhánh.
  - Lưu: chưa chọn ca → "Thông báo" / **"Vui lòng chọn ca làm việc"** (`schedule_shift_bloc.dart:123-129`). Kiểm tra ngày hợp lệ đã bị comment (116-122). Không kiểm tra giờ kết thúc > giờ bắt đầu.
- API:
  - `time-working-staff/get-branch-right-by-staff` `{staff_id}` → `datas` branch (`branch_id`, `branch_name`) (`schedule_shift_bloc.dart:190-211`).
  - `time-working-staff/get-list-shift` `{branch_id}` → `datas[]`: `shift_id`, `shift_name`, `start_work_time`, `end_work_time`, `is_monday..is_sunday`, `checking_type`... (`schedule_shift_bloc.dart:155-176`).
  - `time-working-staff/change-shift` (`api.dart:392`) body: `time_working_staff_id`, `shift_id` (mới), `old_shift_id`, `old_shift_note`, `image_next_shift`, `working_time` (HH:mm:00, chỉ gửi nếu có), `working_end_time` (chỉ gửi nếu có), `branch_id` (`data/models/request/change_shift_request_model.dart:32-46`; `schedule_shift_bloc.dart:131-153`).
  - Thành công → dialog "Thông báo" / **message từ server** (`errorDescription`), pop `true`. Lỗi → dialog lỗi server.

---

### 5. Màn hình "Đi muộn / Về sớm" — `ScheduleLateScreen`

Files: `SCH/ui/schedule_late_screen.dart`, `SCH/bloc/schedule_late_bloc.dart`.

- Nơi mở: nút "Đi muộn / Về sớm" ở thẻ LLV hoặc nút chính ở Chi tiết.
- AppBar **"Đi muộn / Về sớm"** (`schedule_late_screen.dart:200-203`).
- Bố cục: ngày; "Ca hiện tại: {shift_name}"; 2 nhóm:
  - "Số phút đi muộn": nút "-" | ô số (hint "Nhập số phút", chỉ chữ số) | nút "+"; "Ghi chú đi muộn" (textarea, hint "Nhập ghi chú").
  - "Số phút về sớm": tương tự; "Ghi chú về sớm".
  - Bottom **"Lưu"**.
- Rule (`schedule_late_bloc.dart:50-89`): "-" giảm 1 (≤1 thì xóa trống); "+" tăng 5. Lưu: cả 2 số phút đều 0/trống → **"Vui lòng nhập phút hợp lệ"**. Kiểm tra ngày đã comment (65-71). Không giới hạn số phút tối đa. (Ô nhập có formatter phân cách nghìn; `int.tryParse` trên chuỗi có dấu phân cách có thể ra null → chưa xác định với giá trị ≥1000.)
- API `time-working-staff/submit-time-late-soon` (`api.dart:408`) body: `time_working_staff_id`, `time_late_apply_work_late`, `time_late_apply_work_late_note`, `time_late_apply_work_soon`, `time_late_apply_work_soon_note` (`data/models/request/time_late_soon_request_model.dart:23-30`).
- Thành công → dialog "Thông báo" / message server, pop `true`.

---

### 6. Màn hình "Làm thêm giờ" (đăng ký OT) — `ScheduleOvertimeScreen`

Files: `SCH/ui/schedule_overtime_screen.dart`, `SCH/bloc/schedule_overtime_bloc.dart`.

- Nơi mở: nút "Làm thêm giờ" ở thẻ LLV (khi `showOvertime`).
- AppBar **"Làm thêm giờ"**.
- Bố cục (`schedule_overtime_screen.dart:52-153`):
  - "Ngày làm việc: {Thứ}, dd/MM/yyyy".
  - "Ca: {shift_name}".
  - "Địa điểm làm việc" * (mặc định chi nhánh của ca) → mở `BranchScreen` (API `branch/get-list`, `api.dart:135`).
  - "Thời gian bắt đầu" * (mặc định = `working_end_day working_end_time` của ca) – DateTimePicker, max = hôm nay + 365 ngày.
  - "Giờ kết thúc" * – DateTimePicker.
  - Checkbox **"Không cần chấm công"**.
  - Bottom "Lưu".
- Rule (`schedule_overtime_bloc.dart:112-155`): thiếu địa điểm → "Bạn chưa chọn Địa điểm làm việc"; thiếu bắt đầu → "Bạn chưa chọn Thời gian bắt đầu"; thiếu kết thúc → "Bạn chưa chọn Thời gian kết thúc"; kết thúc ≤ bắt đầu → **"Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu"**.
- API `time-working-staff/create-overtime` (`api.dart:409`) body: `staff_id` (user), `branch_id`, `shift_id` (ca gốc), `working_day`, `working_time` (HH:mm — format `AppFormat.formatTime`), `working_end_day`, `working_end_time`, `is_not_check_in` (1 nếu tick "Không cần chấm công") (`data/models/request/create_overtime_request_model.dart:32-42`).
- Thành công → dialog message server, pop `true`.

---

### 7. Màn hình "Chi tiết lịch làm việc" — `ScheduleDetailScreen`

Files: `SCH/ui/schedule_detail_screen.dart`, `SCH/bloc/schedule_detail_bloc.dart`, widget `presentation/widgets/custom_schedule_detail.dart`.

- Nơi mở: bấm vào thẻ ca ở LLV.
- AppBar **"Chi tiết lịch làm việc"**; back trả `hasUpdate`.
- API `time-working-staff/get-detail` `{time_working_staff_id}` (`api.dart:398`, `schedule_detail_bloc.dart:76-107`, `data/models/request/staff_detail_request_model.dart:12`). Response `data` → TimeWorkingModel, đặc biệt `history[]` (`checkin_info`: `check_in_log_id, checkin_type, checking_curent_step, check_in_day, check_in_time, image_selfie`; `checkout_info`: tương ứng) (`TWM:546-656`).
- Bố cục (`custom_schedule_detail.dart`):
  - Ngày + chip trạng thái (21-31).
  - Chi nhánh; "{shift_name} ({giờ bắt đầu} -> {giờ kết thúc})"; "Thời gian làm việc được xác nhận: {actual_time_work_confirmed}" (33-56).
  - "Tổng thời gian: {actual_time_work} Giờ" (null → "Chưa xác định" màu orange500, có → primary); "Thời gian ước lượng: {time_work} Giờ" (cùng quy tắc màu); "Hệ số công" nếu `confirmed` (xanh); tiêu đề "Lịch sử vào ra" nếu có history; nút **"Bản đồ"** nếu có lat/long → mở Google Maps (163-222).
  - Mỗi lượt: "Thời gian {i+1}: {số giờ} Giờ"; cột "Giờ vào" HH:mm và "Giờ ra" HH:mm; ảnh selfie vào/ra (bấm xem) (113-161).
  - Các đơn: "Đơn phép: Đổi ca" + "Ca cũ", "Lý do", "Hình ảnh", "Ngày duyệt", "Người duyệt"; "Đơn phép: Đi muộn" + "Đi muộn: n Phút", "Lý do"…; "Đơn phép: Về sớm"… (243-~390).
- Bottom (`schedule_detail_screen.dart:58-71`): ẩn nếu `!showShift && !showLate`; nút chính "Đi muộn / Về sớm" (khi showLate) → mục 5; nút phụ "Đổi ca làm" (khi showShift) → mục 4. Ở đây **không** áp `canChangeShift` (khác với thẻ LLV).

---

### 8. Màn hình "Chấm công" (tổng hợp công tháng) — `ScheduleTimekeepingScreen`

Files: `SCH/ui/schedule_timekeeping_screen.dart`, `SCH/bloc/schedule_timekeeping_bloc.dart`.

- Nơi mở: menu Home **"Chấm công"** khi có `TI000001` (`home_screen.dart:337-341`).
- AppBar "Chấm công"; header chọn tháng (`CustomHeaderMonth`).
- API `time-working-staff/get-total-time-keeping` `{month, year}` (`api.dart:410`, `total_time_keeping_request_model.dart:14-15`). Response `data` (`data/models/response/total_time_keeping_response_model.dart:22-89`): `month`, `year`, `start_date`, `end_date`, `standard_working_day`, `time_actual`, `time_keeping[]` (`shift_type_code`, `shift_type_name`, `total`), `time_off_day` (`time_off_now`, `time_off_using`, `time_off_remaining`).
- Bố cục (107-181): "Từ ngày {start_date}" | "Đến ngày {end_date}"; "Giờ công chuẩn" (bold); "Giờ công thực tế" (primary bold); từng loại ca `shift_type_name: total`; "Tổng số ngày nghỉ" (bold); "Tổng số ngày nghỉ đã sử dụng" (darkRed bold); "Tổng số ngày nghỉ còn lại" (darkGreen bold).
- Bottom **"Danh sách lịch làm việc"** → mở `ScheduleScreen(date)` chế độ tháng (mục 3).

---

### 9. Màn hình "Thêm ca" (đăng ký 1 ca cho 1 ngày) — `ScheduleDateScreen`

Files: `SCH/ui/schedule_date_screen.dart`, `SCH/bloc/schedule_date_bloc.dart`.

- Nơi mở: nút "+" LLV sau khi chọn ngày (trong tuần đang xem); hoặc từ "Thêm lịch làm việc" ở chế độ sửa (`isEditMode`).
- AppBar **"Thêm ca"**. Trường: "Ngày làm việc: {Thứ}, dd/MM/yyyy"; "Ca" * (hint "Chọn ca làm việc của bạn"); "Chi nhánh" * (hint "Chọn chi nhánh"; mặc định chi nhánh user `Globals.model.branchId` hoặc phần tử đầu); "Ghi đè thời gian (Tùy chọn)" giờ/phút bắt đầu – kết thúc; "Lưu".
- Rule (`schedule_date_bloc.dart:151-205`): chưa chọn ca → "Bạn chưa chọn Ca"; có nhập giờ và kết thúc ≤ bắt đầu → "Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu". Ca lọc theo thứ trong tuần. Chọn ca tự điền giờ.
- API: `get-branch-right-by-staff {staff_id}`; `get-list-shift {branch_id}`; tạo: `time-working-staff/add-shift-staff` (`api.dart:407`) body `staff_id`, `branch_id`, `shift_id`, `working_day`, `working_time` (HH:mm), `working_end_time` (HH:mm) (`add_shift_staff_request_model.dart:26-34`). Thành công → message server, pop `true`.
- Chế độ sửa: không gọi API, trả `TimeWorkingModel` mới về màn "Thêm lịch làm việc".

---

### 10. Màn hình "Thêm lịch làm việc" (sao chép tuần trước) — `ScheduleAddScreen`

Files: `SCH/ui/schedule_add_screen.dart`, `SCH/bloc/schedule_add_bloc.dart`.

- Nơi mở: nút "Thêm" khi LLV tuần rỗng.
- AppBar **"Thêm lịch làm việc"**; header tuần; danh sách ca dự kiến (ngày + icon copy, "Ca", "Chi nhánh"); bấm 1 dòng → mở "Thêm ca" chế độ sửa; icon copy → chọn ngày trong tuần để nhân bản ca; rỗng → "Chưa có dữ liệu"; "Lưu".
- API tải: `time-working-staff/get-list-last-week` (không params) (`api.dart:403`). Client loại bỏ ca có `shift_code_approved == "OT"`, rồi dời `working_day`/`working_end_day` +7 ngày cho tới khi ≥ ngày đầu tuần đang xem (`schedule_add_bloc.dart:127-185`).
- Lưu: rỗng → **"Vui lòng nhập thời gian làm việc"**; gọi `time-working-staff/create` (`api.dart:404`) body `{array_time_working_staff: [TimeWorkingModel...]}` với mỗi phần tử: thông tin khách hàng/toạ độ/bán kính/nhân viên/quản lý/team/ca/ngày giờ, `start_working_format_day/week/month/year`, hệ số, `time_work`, nghỉ trưa, `overtime_type`, `created_at/by/by_name`, `time_working_staff_status="waiting"`, `checking_type`, `branch_id/name`, `checking_curent_step=1` (`schedule_add_bloc.dart:187-254`). Thành công → message server, pop `true`.

---

### 11. Màn hình "Lịch sử chấm công" cá nhân (lịch tháng) — `TimekeepingCalendarScreen`

Files: `TKM/ui/timekeeping_calendar_screen.dart`, `TKM/bloc/timekeeping_calendar_bloc.dart`.

- Nơi mở: Tab Tài khoản → "Lịch sử chấm công" khi có `TI000001` (`presentation/modules/main_module/modules/account_module/src/ui/account_screen.dart:208-213`).
- API (tháng đang xem, từ ngày 1 đến cuối tháng) (`timekeeping_calendar_screen.dart:49-70`):
  - `timekeeping/personal-history` `{from_date, to_date}` (`api.dart:231`) → `datas.data[]`: `timekeeping_date`, `check_in_total/out_total/in_count/out_count`, `back_ground`, `timekeeping_logs[]` (`shift_id`, `shift_name`, `working_day/time`, `working_end_day/time`, `check_in_day/time`, `check_out_day/time`, `number_late_time`, `number_time_back_soon`, `created_type`, `is_check_in/out`, `type_check_in/out`, `back_ground`, `is_ot`) (`data/models/response/timekeeping_history_response_model.dart:53-160`).
  - `timekeeping/get-day-holiday` `{start_date, end_date}` (`api.dart:232`) → `holiday_date`, `holiday_name`.
- UI: Lịch tháng; mỗi ngày tô nền theo `back_ground` (màu hex do **server** quyết định), viền đỏ `#F44336` nếu có log `is_ot==1`, viền primary nếu đang chọn; icon ngày lễ màu orange300 ở chân ô (95-163). Dưới lịch: tên ngày lễ (bold) và danh sách log của ngày chọn (`CustomTimekeepingLog`): nền `back_ground`, viền đỏ nếu OT, `shift_name`, "dd/MM/yyyy HH:mm - [ngày kết thúc] HH:mm", "Vào ca ({check_in_time} hoặc --:--)", "Ra ca (…)" (`custom_timekeeping.dart:128-217`). Rỗng: "Chưa có lịch sử chấm công".

### 12. Màn hình "Lịch sử chấm công / Quản lý chấm công" (danh sách theo ngày) — `TimekeepingHistoryScreen`

- Nơi mở: menu Home có `TI000000` (tên menu = `widgetName` từ server) (`home_screen.dart:205-210`); màn Chức năng nhóm HRM "Quản lý chấm công" (enable khi `TI000000`) (`function_module/src/ui/function_screen.dart:171-178`).
- API `timekeeping/histories` (`api.dart:230`) params `page`, `branch_id`, `department_id`, `search`, `from_date`, `to_date` (`timekeeping_history_request_model.dart:28-33`); phân trang `PageInfo`/`Items`.
- UI: AppBar "Lịch sử chấm công" + nút lọc (Tìm kiếm, Chi nhánh, Phòng ban, Thời gian; "Áp dụng"/"Xóa"; API `workListBranch`, `workListDepartment`); mỗi ngày: "Vào ca: count/total", "Ra ca: count/total", mở rộng thấy log từng nhân viên (avatar, tên) — dạng xem nhiều nhân viên, không chỉ cá nhân (`isPersonal: false`). Rỗng: "Chưa có lịch sử chấm công".

---

### 13. Code cũ / không dùng (ghi nhận)
- `MainBloc.timekeepingCheckIn/timekeepingCheckOut` (`MB:466-500`) gọi `timekeeping/check-in`, `timekeeping/check-out` (`api.dart:228-229`) với: `deviceId=imei`, `accessPointIp` (api.ipify.org), `latitude`, `longitude`, `wifiName = NetworkInfo().getWifiName()` (SSID; **không lấy BSSID**), `checkSum = MD5(lat+long+time_working_staff_id+deviceId+accessPointIp+MD5(accessPointIp+salt)+salt)` (`MB:502-504`) và header `access-point-check-sum = MD5(accessPointIp + salt)` (`timekeeping_resource.dart:18-34`, `UT:741-743`). **Không có nơi nào gọi 2 hàm này** (grep chỉ thấy định nghĩa) → luồng wifi/checksum hiện không hoạt động.
- `onResumeTimekeeping` (`main_screen.dart:174` → `MB:506-526`) chỉ cập nhật `wifiName` vào stream cũ `_streamTimekeepingModel` — không ảnh hưởng thẻ chấm công hiện tại.
- Module `pg_module` (`PGListScreen` "LLV nhân viên", `PGShiftScreen`, `PGLateScreen`, `PGConfirmScreen`, `ChangeShiftScreen`) là phía **quản lý duyệt** (API `approved-change-shift`, `approved-time-soon-late-staff`, `approved-time-working-staff`, `accept-actual-time`, `approved-all(-v2)`...) — ngoài phạm vi chấm công cá nhân, không phân tích chi tiết.
- `canProxyAttendance` (`UT:1476-1518`) và nút "Chấm công thủ công" chỉ dùng ở màn quản lý (không truyền ở LLV cá nhân).

---

### 14. Danh sách endpoint (phạm vi cá nhân)

| Endpoint | Gọi từ | Params gửi | Field response dùng |
|---|---|---|---|
| `v2/user/permission` | Login/Splash | — | `permission[].widget_id` (TI000000/1/2) |
| `timekeeping/shift` | Home (`MB:344`) | — | TimeWorkingModel đầy đủ (mục 1.2); `errorCode==1` → ẩn thẻ |
| `time-working-staff/check-in` | CheckInOutBloc, CheckInOutHelper | Toàn bộ TimeWorkingModel (đã set `is_check_in*`, `check_in_by*`, `check_in_date*`, `latitude/longitude` hiện tại, `updated_at/by`, `access_point_ip`) + `checkin_log` {`time_working_staff_id, staff_id/code/name, checkin_type, customer_id/code/name/adress_full, customer_latitude/longitude (vị trí máy), allowable_radius, shift_id/name, checking_curent_step, check_in_day, check_in_time, image_selfie, latitude, longitude, radius, imei, device_name, platform, number_retry, created_at/by, updated_at`} | `data.check_in_log_id`, `check_in_day`, `check_in_time` |
| `time-working-staff/check-out` | như trên | Như trên + `is_check_out*`, `check_out*_by`, `check_out_date*`, `actual_time_work_0..4`, `actual_time_work`, `checking_curent_step` (+1) hoặc `time_working_staff_status="not-confirm"`, `checkout_log` (`check_out_day`, `check_out_time`...) | `data.check_out_log_id`, `check_out_day`, `check_out_time` |
| S3 (aws_s3_upload_lite) | Selfie, ảnh đổi ca | file | URL |
| `nominatim.openstreetmap.org/reverse` | Watermark | `lat, lon, format=json` | `display_name` |
| `api.ipify.org` (dart_ipify) | Check-in/out | — | IPv4 |
| `time-working-staff/get-list-by-pg` | LLV | `{week, year}` hoặc `{month, type:"day"}` | `datas[]` TimeWorkingModel |
| `time-working-staff/get-list-group-status-staff` | LLV | như trên | `full_name, branch_name, waiting, approved, not-approved, not-confirm, confirmed, waiting-confirm, estimated_time_work, actual_time_work, actual_time_work_confirmed` |
| `time-working-staff/get-detail` | Chi tiết | `time_working_staff_id` | TimeWorkingModel + `history[].checkin_info/checkout_info` |
| `time-working-staff/get-branch-right-by-staff` | Đổi ca, Thêm ca | `staff_id` | `branch_id, branch_name` |
| `time-working-staff/get-list-shift` | Đổi ca, Thêm ca | `branch_id` | `shift_id, shift_name, start_work_time, end_work_time, is_monday..is_sunday, checking_type` |
| `time-working-staff/change-shift` | Đổi ca | `time_working_staff_id, shift_id, old_shift_id, old_shift_note, image_next_shift, [working_time], [working_end_time], branch_id` | message |
| `time-working-staff/submit-time-late-soon` | Đi muộn/Về sớm | `time_working_staff_id, time_late_apply_work_late, time_late_apply_work_late_note, time_late_apply_work_soon, time_late_apply_work_soon_note` | message |
| `time-working-staff/create-overtime` | Làm thêm giờ | `staff_id, branch_id, shift_id, working_day, working_time, working_end_day, working_end_time, is_not_check_in` | message |
| `branch/get-list` | Chọn địa điểm OT | — | danh sách chi nhánh |
| `time-working-staff/add-shift-staff` | Thêm ca | `staff_id, branch_id, shift_id, working_day, working_time, working_end_time` | message |
| `time-working-staff/get-list-last-week` | Thêm lịch làm việc | — | `datas[]` TimeWorkingModel |
| `time-working-staff/create` | Thêm lịch làm việc | `array_time_working_staff[]` | message |
| `time-working-staff/get-total-time-keeping` | Chấm công (tháng) | `month, year` | `start_date, end_date, standard_working_day, time_actual, time_keeping[], time_off_day` |
| `timekeeping/personal-history` | Lịch sử chấm công cá nhân | `from_date, to_date` | `data[]` (timekeeping_date, back_ground, timekeeping_logs…) |
| `timekeeping/get-day-holiday` | Lịch sử chấm công cá nhân | `start_date, end_date` | `holiday_date, holiday_name` |
| `timekeeping/histories` | Lịch sử/Quản lý chấm công | `page, branch_id, department_id, search, from_date, to_date` | `PageInfo`, `Items[]` |
| `timekeeping/check-in`, `timekeeping/check-out` | (không có nơi gọi) | `deviceId, accessPointIp, latitude, longitude, checkSum, wifiName` + header `access-point-check-sum` | — |

---

### 15. Điểm cần lưu ý / chưa xác định
1. Client **không chặn** theo bán kính, mock GPS, wifi, thiết bị, khung giờ — mọi ràng buộc này (nếu có) phải nằm ở server; server có kiểm tra hay không → chưa xác định (cần xem BE).
2. Giờ chấm công (`check_in_time/check_out_time`, `*_date`) lấy từ **đồng hồ thiết bị**; server có ghi đè bằng giờ server hay không → chưa xác định (client hiển thị `check_in_day/time` server trả về).
3. Client tự tính `actual_time_work*`, `checking_curent_step`, `time_working_staff_status="not-confirm"` và gửi lên → server có tin dữ liệu này hay tự tính → chưa xác định.
4. `customer_latitude/customer_longitude` trong log và `latitude/longitude` của TimeWorkingModel bị ghi đè bằng vị trí thiết bị khi gửi (comment trong code nói "bằng với customer location" nhưng thực tế là vị trí hiện tại).
5. Luồng không ảnh luôn đòi GPS kể cả `check_in_limit == 0`; luồng có ảnh chỉ đòi GPS khi `check_in_limit != 0`.
6. Có thể hiện 2 dialog lỗi liên tiếp ở luồng không ảnh (mục 1.5).
7. `ScheduleScreen` chế độ tháng vẫn có nút "+" nhưng `startDate/endDate` chưa khởi tạo → có thể crash.
8. Trạng thái `waiting-confirm` hiển thị là "Chờ duyệt" trên chip (do default của `parseTimeWorkingStatus`).

---

# PHẦN V — APP NHÂN VIÊN: pg_module (QUẢN LÝ DUYỆT LỊCH / CHẤM CÔNG)

## Phân tích module `pg_module` – App Flutter nhân viên (Matthews_staff)

Gốc app: `/Users/mwang/WAO/Mobile/Matthews/Matthews_staff`
Viết tắt dùng trong tài liệu:
- `PG/` = `lib/presentation/modules/main_module/modules/home_module/modules/pg_module/`
- `W/` = `lib/presentation/widgets/`
- `API` = `lib/data/network/api/api.dart`, `RES` = `lib/domain/resources/time_working_staff_resource.dart`
- Text hiển thị: lấy từ `assets/json/vi.json` / `en.json` qua `LangKey` (`lib/common/lang_key.dart`). Ngôn ngữ mặc định `vi`.

### 0. Tổng quan quan trọng

- **`pg_module` KHÔNG phải màn hình check-in/check-out của nhân viên.** Đây là cụm màn hình **quản lý/duyệt chấm công & lịch làm việc của nhân viên khác** (vai trò quản lý/leader): duyệt lịch, duyệt đổi ca, duyệt đi muộn/về sớm, xác nhận giờ công thực tế (chọn mã công/hệ số), chấm công hộ (thủ công), đổi ca hộ, thêm ca, báo cáo lịch làm việc theo tuần/theo giờ.
- Trong module **không có** bất kỳ kiểm tra GPS/vị trí, wifi, camera/ảnh selfie, thiết bị. Các rule đó nằm ở module check-in/out riêng: `lib/presentation/modules/main_module/modules/home_module/modules/check_in_out_module/src/bloc/check_in_out_bloc.dart:577,734` và `check_in_out_helper.dart:128,272` (gọi `time-working-staff/check-in`, `time-working-staff/check-out`) – **ngoài phạm vi, chưa phân tích**.
- Tất cả API đều `POST` (`Interaction(...).post()`, RES:27-202), URL = `Globals.config.server` + path (API:4). Response chuẩn: `{ErrorCode, ErrorDescription, Data}`; `success = ErrorCode == 0`; `Data` là Map → `response.data`, là List → `response.datas` (`lib/data/models/base/response_model.dart:18-29`).
- **Xử lý lỗi chung**: khi `ErrorCode != 0` hoặc HTTP lỗi, `Interaction.handleError` tự hiện dialog "Thông báo" với nội dung `ErrorDescription` của server (hoặc `server_error`/`data_error`); lỗi 401 → tự refresh token, thất bại thì báo "token_expired" và logout (`lib/data/network/api/interaction.dart:81-108,117-136`). Các bloc trong module chỉ xử lý nhánh success, không tự hiện message lỗi.

#### Trạng thái chấm công (`time_working_staff_status`) – `lib/common/constant.dart:393-449`, `lib/presentation/utils/ultility.dart:1557-1590`

| Code | Tên hiển thị (vi / en) | Màu |
|---|---|---|
| `waiting` | "Chờ duyệt" / "Waiting approved" | `AppColors.pinkSale` |
| `approved` | "Đã duyệt" / "Approved" | `AppColors.primaryColor` |
| `not-confirm` | "Chờ xác nhận" / "Waiting confirm" | `AppColors.orange500` |
| `confirmed` | "Đã xác nhận" / "Confirmed" | `AppColors.darkGreenColor` |
| `not-approved` | "Không được duyệt" / "Not approved" | `AppColors.blackColor` |
| `waiting-confirm` | "Chấm công hộ" / "Timekeeping support" | `AppColors.purple` |

`parseTimeWorkingStatus`: status rỗng/không khớp (kể cả `waiting-confirm`) → mặc định hiển thị "Chờ duyệt" (ultility.dart:1583-1587).

`CheckingType`: hằng số 0..5 (constant.dart:415-422). Trong module chỉ phân biệt `checking_type == 0` vs khác 0 (xem các rule duyệt bên dưới). Ý nghĩa từng giá trị: chưa xác định (không có comment trong code).

#### Rule dùng chung (ultility.dart)
- **`canChangeShift`** (ultility.dart:1446-1469) – cho phép hiện nút "Đổi ca" khi: `is_check_out != 1` VÀ status ∈ {`approved`,`waiting`} VÀ `working_day` parse được VÀ `working_day >= hôm nay` (theo ngày).
- **`canProxyAttendance`** (ultility.dart:1476-1515) – cho phép hiện nút "Chấm công thủ công" khi: `is_check_out != 1` VÀ status == `approved` VÀ (nếu có `working_end_time` dạng HH:mm: `working_day + working_end_time` < now; nếu không có: `working_day` < hôm nay). Tham số `checkingType` được truyền nhưng không dùng.
- **`isSupportConfirm`** (cờ "Chấm công hộ", tính ở client trong `TimeWorkingModel.fromJson`, `lib/data/models/request/time_working_model.dart:372-382`): `true` khi status == `approved` VÀ `working_day` < hôm nay.
- **`filterByDate`** (ultility.dart:1605-1610) + `TimeWorkingShiftModel.isWorkingOnDate` (`lib/data/models/base/time_working_shift_model.dart:134-146`): lọc danh sách ca theo thứ trong tuần (`is_monday`…`is_sunday` == 1) của ngày làm việc.

---

### A. Điểm vào (mở từ đâu, điều kiện quyền)

File: `lib/presentation/modules/main_module/modules/home_module/src/ui/home_screen.dart`

- Menu Home được dựng từ `Globals.permissionModels` (lấy từ API `v2/user/permission` khi login/splash: `login_bloc.dart:51,73`, `spash_bloc.dart:101,121`; cache trong SharedPrefs). Chỉ các quyền có `isHotFunction != 0` mới thành item menu (home_screen.dart:80-81).
- Quyền **`TI000001`** ("Lịch sử chấm công", `lib/ultilites/visibility_api_widget_name.dart:68`) → thêm 3 item (home_screen.dart:326-342):
  1. "LLV" (`my_schedule`) → `ScheduleScreen` (ngoài pg_module).
  2. **"LLV nhân viên"** (`employee_work_schedule`) → **`PGListScreen()`** (home_screen.dart:332-335). Điều kiện `Globals.model!.isLeader` **đã bị comment** → mọi user có quyền TI000001 (isHotFunction≠0) đều thấy.
  3. "Chấm công" (`timekeeping`) → `ScheduleTimekeepingScreen` (ngoài pg_module).
- Quyền **`TI000002`** ("Báo cáo chấm công dành cho quản lý", visibility_api_widget_name.dart:94) → item tên = `widgetName` từ server → **`ReportTimekeepingScreen()`** (home_screen.dart:343-348).
- `ReportTimekeepingHourScreen` mở từ việc bấm tiêu đề cột ngày trong lưới báo cáo tuần (`W/roster_data_grid.dart:274-288`).
- Không tìm thấy nơi nào khác mở các màn hình này (grep toàn `lib/`).

Sơ đồ điều hướng:
```
Home ─(TI000001)→ PGListScreen ─tap NV→ PGScreen ─tap thẻ→ PGDetailScreen ─┬→ PGShiftScreen ─(nếu còn đơn muộn+sớm)→ PGLateScreen
                                         │                                  ├→ PGLateScreen
                                         │                                  └→ PGConfirmScreen (isAttend 0/1)
                                         ├─"Đổi ca"→ BottomSheet ChangeShiftScreen
                                         └─"Chấm công thủ công"→ BottomSheet PGConfirmContent
Home ─(TI000002)→ ReportTimekeepingScreen ─tap NV→ PGScreen
                                          ─tap ô trống/“+”→ BottomSheet AddShiftBottomSheet
                                          ─tap ô có ca→ ShiftDetailBottomSheet → ChangeShiftScreen / PGConfirmScreen(isAttend 1)
                                          ─tap header ngày→ ReportTimekeepingHourScreen ─tap NV→ PGScreen
```

---

### 1. PGListScreen – "Danh sách lịch làm việc"

Files: `PG/src/ui/pg_list_screen.dart`, `PG/src/bloc/pg_list_bloc.dart`, item `W/custom_pg_list.dart`, header `W/container_header.dart` (CustomHeaderWeek).

#### 1.1 Mở từ / tham số
- Home menu "LLV nhân viên". Không có tham số (pg_list_screen.dart:12-13).
- Khởi tạo: ngày = hôm nay (00:00), tính tuần ISO (`getWeekOfYear`), `startDate` = thứ 2, `endDate` = CN (pg_list_bloc.dart:89-93,139-147). `onReady` → `onRefresh(isRefresh:false)` gọi song song `staffGroupStatus` + `getBranch` (pg_list_bloc.dart:95-117).

#### 1.2 Bố cục (trên → dưới)
- AppBar: tiêu đề **"Danh sách lịch làm việc"** (`pg_work_schedule_list`) (pg_list_screen.dart:259). Bên phải: icon filter (trắng) có badge = số chi nhánh đang chọn (pg_list_screen.dart:228-254).
- Header tuần (`CustomHeaderWeek`, pg_list_screen.dart:152-166; container_header.dart:243-336):
  - Dòng: icon lịch + text **"Tuần {week} ({dd/MM/yyyy} - {dd/MM/yyyy})"** (`week`), bấm được (vì có `onDate`) → bottom sheet **"Chọn tuần"** với `SfDateRangePicker` (tuần bắt đầu thứ 2, hiện số tuần), chọn ngày bất kỳ sẽ tự bôi cả tuần, nút **"Xác nhận"** (container_header.dart:135-188).
  - Nút mũi tên thu gọn/mở rộng phần dưới (mặc định mở).
  - Phần mở rộng: hàng chip trạng thái cuộn ngang (`_buildFilter`, pg_list_screen.dart:120-150): "Tất cả" (mặc định chọn), "Chờ duyệt", "Đã duyệt", "Chờ xác nhận", "Đã xác nhận", "Chấm công hộ"; mỗi chip có badge = `e.data` (số lượng từ `total_by_status`), màu khi chọn = màu trạng thái.
- Đường kẻ dày 2.
- Ô tìm kiếm debounce, hint **"Tìm tên nhân viên"** (`search_staff_name`), icon search (pg_list_screen.dart:51-66).
- Danh sách nhân viên (`CustomPGList`, `W/custom_pg_list.dart:27-144`), pull-to-refresh, load-more. Mỗi thẻ:
  - Dòng 1: `full_name` (đậm).
  - Nếu `branch_name != null`: icon chi nhánh + `branch_name`.
  - "Chờ duyệt": `waiting` (màu pinkSale)
  - "Đã duyệt": `approved` (màu primary)
  - "Chờ xác nhận": `not-confirm` (orange500)
  - "Đã xác nhận": `confirmed` (darkGreen)
  - "Chấm công hộ": `waiting-confirm` (purple)
  - "Thời gian làm việc dự kiến": `formatHoursAU(estimated_time_work)`
  - "Thời gian làm việc thực tế": `formatHoursAU(actual_time_work ?? 0)`
  - "Thời gian làm việc được xác nhận": `formatHoursAU(actual_time_work_confirmed ?? 0)`
  - Đang tải: skeleton shimmer; rỗng: **"Chưa có dữ liệu"** (`data_empty`).
- Bottom bar cố định (pg_list_screen.dart:68-118): **"Tổng giờ ước tính"** = `total_estimate_hours`; **"Tổng giờ thực tế"** = `total_actual_hours` (số nguyên nếu chẵn, ngược lại 1 chữ số thập phân; màu primary).

#### 1.3 Thao tác
| Thao tác | Xử lý |
|---|---|
| Chọn tuần | `onDate` → `refreshDate` → `onRefresh(isRefresh:false)` → **reset filter** (status về "Tất cả", bỏ chọn chi nhánh, xoá ô search, page=1) rồi gọi lại API (pg_list_bloc.dart:272-275,119-137). |
| Bấm chip trạng thái | `onSelectStatus` (pg_list_bloc.dart:149-176): multi-select. Chọn "Tất cả" → bỏ các chip khác; chọn chip cụ thể → bỏ "Tất cả". Bấm vào chip đang chọn chỉ bỏ chọn được nếu còn chip khác đang chọn (không thể bỏ hết). Sau đó gọi lại `staffGroupStatus(false)` (reset list, page 1). |
| Gõ tìm kiếm | `onChanged` (debounce) → `staffGroupStatus(true)` (pg_list_screen.dart:63): gửi `search` lên server và đồng thời lọc client theo `full_name` chứa chuỗi (không phân biệt hoa thường) (pg_list_bloc.dart:261-267). |
| Icon filter (AppBar) | `onSelectBranch` (pg_list_bloc.dart:384-424): bottom sheet tiêu đề **"Chi nhánh"**, danh sách chi nhánh (multi-select, toggle `selected`), có nút xoá (bỏ chọn tất cả, badge=0) và nút xác nhận. Đóng sheet (bằng bất kỳ cách nào) → cập nhật badge = số chi nhánh chọn và gọi `staffGroupStatus(false)`. |
| Kéo xuống | `onRefresh` (reset filter + reload). |
| Cuộn cuối danh sách | `loadMore` nếu `hasMorePages` (`current_page < last_page`) → page+1, nối danh sách (pg_list_bloc.dart:353-358). |
| Bấm thẻ nhân viên | `onDetail` → push `PGScreen(model, date, employeeList: models, initialIndex)` (pg_list_bloc.dart:277-291). Khi quay lại với `true` → reload giữ nguyên filter (`resetFilters:false`). |

#### 1.4 Field nhập liệu
- Ô tìm kiếm (text tự do, không validate).
- Bộ chọn tuần (DateRangePicker).
- Multi-select trạng thái, multi-select chi nhánh.

#### 1.5 Rule client
- Lọc client sau khi nhận dữ liệu (pg_list_bloc.dart:182-270): nếu không chọn "Tất cả", giữ nhân viên có số đếm > 0 ở ít nhất 1 trạng thái được chọn (`waiting`, `approved`, `not-confirm`, `confirmed`, `waiting-confirm`). (Song song đã gửi `status` lên server.)
- Badge chip trạng thái chỉ cập nhật từ `total_by_status` khi tải trang 1 (pg_list_bloc.dart:337-342,360-382).

#### 1.6 API
| API | Params | Response dùng |
|---|---|---|
| `time-working-staff/get-list-group-status` (API:402) | `week`, `year`, `month`(null), `type`(null), `search`, `page`, `per_page`=20, `branch_id`: [int] (chỉ gửi nếu có chọn), `status`: [string] (chỉ gửi nếu không chọn "Tất cả") (`staff_group_status_request_model.dart:36-52`; bloc:315-325) | `Data` (Map, phân trang Laravel): `current_page`, `last_page`, `data[]` {`staff_id`, `full_name`, `waiting`, `approved`, `not-approved`, `not-confirm`, `confirmed`, `waiting-confirm`, `actual_time_work`, `branch_name`, `estimated_time_work`, `actual_time_work_confirmed`}, `total_estimate_hours`, `total_actual_hours`, `total_by_status` {`waiting`,`approved`,`not-approved`,`not-confirm`,`confirmed`,`waiting-confirm`} (`staff_group_status_response_model.dart:18-27,72-97,150-200`) |
| `time-working-staff/get-branch-right-by-staff` (API:413) | `staff_id` = **user đăng nhập** (`Globals.model.staffId`) (bloc:426-428) | `Data` (List): `branch_id`, `branch_name` (còn `is_representative`, địa chỉ, lat/long… không dùng ở đây) (`branch_response_model.dart:50-59`) |

---

### 2. PGScreen – "Lịch làm việc" (lịch tuần của 1 nhân viên)

Files: `PG/src/ui/pg_screen.dart`, `PG/src/bloc/pg_bloc.dart`, thẻ ca `W/custom_schedule.dart`, header `W/container_header.dart`.

#### 2.1 Mở từ / tham số
- Từ PGListScreen (bấm thẻ NV): `model` (StaffGroupStatusModel), `date`, `employeeList`, `initialIndex` (pg_list_bloc.dart:280-287).
- Từ ReportTimekeepingScreen (bấm ô nhân viên): `model{staffId, fullName}`, `date` (report_timekeeping_bloc.dart:573-590) – không có `employeeList`.
- Từ ReportTimekeepingHourScreen (bấm nhân viên): `model{staffId, fullName}`, `date` = ngày đang xem (report_timekeeping_hour_bloc.dart:475-492).
- Tham số khai báo: pg_screen.dart:12-24.
- Khi back: trả `hasUpdate` (true nếu đã có thao tác/đổi nhân viên) để màn trước reload (pg_bloc.dart:161-163).
- Mỗi lần app resume → reload giữ filter (pg_bloc.dart:118-120).

#### 2.2 Bố cục
- AppBar: **"Lịch làm việc"** (`pg_work_schedule`) (pg_screen.dart:199).
- Header `CustomHeaderWeek` (pg_screen.dart:61-90):
  - Dòng tuần: **"Tuần {week} ({start} - {end})"** – **không bấm được** (không truyền `onDate`) → không đổi tuần trong màn này.
  - Nút thu gọn/mở rộng.
  - Hàng chip chi nhánh (nếu có): "Tất cả chi nhánh" (`all_branches`) + từng chi nhánh, badge = số ca thuộc chi nhánh (container_header.dart:121-165).
  - Hàng chip trạng thái: "Tất cả", "Chờ duyệt" (mặc định chọn), "Đã duyệt", "Chờ xác nhận", "Đã xác nhận" (chip "Chấm công hộ" bị comment, pg_bloc.dart:79-103). Badge chỉ hiện cho `waiting`, `not-confirm`, `waiting-confirm` (container_header.dart:78-84).
  - Dòng **"Nhân viên: {fullName}"** căn giữa + icon `swap_horiz` (đổi nhân viên) (container_header.dart:197-227).
- Danh sách thẻ ca (`CustomSchedule`), pull-to-refresh; rỗng: **"Không có lịch làm việc"** (`work_schedule_empty`); đang tải: shimmer.
- Bottom (pg_screen.dart:128-171): chỉ hiện khi chip trạng thái đang chọn là "Chờ duyệt" hoặc "Chờ xác nhận":
  - Chọn "Chờ duyệt" và có ≥1 ca `waiting` → nút **"Duyệt tất cả"** (`approve_all`).
  - Chọn "Chờ xác nhận" và có ≥1 ca `not-confirm` → nút **"Xác nhận tất cả"** (`confirm_all`).
  - (Danh sách ca dùng để tính là danh sách **đã lọc** đang hiển thị.)

##### Thẻ ca `CustomSchedule` (W/custom_schedule.dart:25-269)
Từ trên xuống:
- Header ngày (`working_day`, format yyyy-MM-dd) + chip trạng thái (tên/màu theo bảng ở mục 0).
- Nếu có `branch_name`: icon nhà + `branch_name`.
- Icon lịch + **"{shift_name} ({working_time} -> {working_end_time})"** ("--" nếu null).
- Nếu có `check_in_date` hoặc `check_out_date`: icon đồng hồ + **"{HH:mm vào} -> {HH:mm ra}"** (đậm, "--" nếu thiếu); nếu có cả 2 → bên phải hiển thị thời lượng **"{h} Giờ {m} Phút"** màu orange500.
- Nếu `old_shift_id != null` (có đơn đổi ca): "Ghi chú": `old_shift_note`; "Hình ảnh": link **"Xem ảnh"** mở `image_next_shift`; "Ngày duyệt": `approve_next_shift_date`; "Người duyệt": `approved_next_shift_by_name` (nếu `approve_next_shift_by != 0`).
- Nếu `time_late_apply_work_soon != 0`: "Về sớm": "{n} Phút"; "Ghi chú": `time_late_apply_work_soon_note`; "Ngày duyệt": `approve_soon_date`; "Người duyệt": `approve_soon_by_name`.
- Nếu `time_late_apply_work_late != 0`: "Đi muộn": "{n} Phút"; "Ghi chú": `time_late_apply_work_late_note`; "Ngày duyệt": `approve_late_date`; "Người duyệt": `approve_late_by_name`.
- Nếu status == `confirmed`: **"Hệ số công"**: `timekeeping_coefficient` (xanh đậm, bold).
- Nếu `time_work != null`: **"Thời gian ước lượng"**: "{time_work} Giờ" (orange500).
- Nếu có `images[]`: danh sách ảnh.
- Khối nút đơn (đổi ca/đi muộn/làm thêm) chỉ hiện khi `applicationModel != null` → **PGScreen không set applicationModel** (pg_bloc.dart:313-316) nên **không hiện**.
- Hàng nút cuối (custom_schedule.dart:231-263, 277-314):
  - **"Đổi ca"** (`change_shift`, icon lock_clock) – nếu `canChangeShift(...)`.
  - **"Chấm công thủ công"** (`manual_timekeeping`, icon medical_information) – nếu `canProxyAttendance(...)`.
- Bấm vào thân thẻ → `onDetail`.
- `onSupportConfirm` được PGScreen truyền vào nhưng `CustomSchedule` **không dùng** (không có nút "Chấm công hộ" trên thẻ).

#### 2.3 Thao tác
| Thao tác | Xử lý |
|---|---|
| Chip trạng thái | Single-select (pg_bloc.dart:420-426), lọc client theo `time_working_staff_status`. |
| Chip chi nhánh | Multi-select; "Tất cả chi nhánh" loại trừ các chi nhánh khác; bỏ hết thì tự chọn lại "Tất cả" (pg_bloc.dart:428-470). Lọc client theo `branch_id` của ca. |
| Tự động chuyển filter | Khi load (không giữ filter) nếu đang chọn "Chờ duyệt" mà số ca chờ duyệt = 0 → tự chuyển sang "Tất cả" (pg_bloc.dart:530-553). |
| Vuốt ngang trên danh sách | Kéo > 100px: phải→ nhân viên trước, trái→ nhân viên sau, vòng tròn trong `employeeList` (chỉ khi mở từ PGListScreen); đổi NV → `hasUpdate=true`, reload và reset filter (pg_bloc.dart:53-77,579-602). |
| Icon đổi nhân viên | Bottom sheet `EmployeeSelectBottomSheet` tiêu đề **"Nhân viên"** (W/container_bottomsheet.dart:453+): gọi `time-working-staff/get-staff-manager` với `branch_id = Globals.model.branchId` (chi nhánh của user đăng nhập), `page`, `search`; phân trang; ô tìm **"Tìm tên nhân viên"** chỉ hiện khi danh sách > 10; NV hiện tại được tô nền. Chọn → đổi `model`, `hasUpdate=true`, reload (pg_bloc.dart:555-577). |
| Bấm thẻ ca | push `PGDetailScreen(model: TimeWorkingModel)`; quay về `true` → reload giữ filter, `hasUpdate=true` (pg_bloc.dart:175-182). |
| "Đổi ca" trên thẻ | Bottom sheet tiêu đề **"Đổi ca"**, body `ChangeShiftScreen(model, isLead: true, staffId: model.staffId)` (pg_bloc.dart:343-356). Kết quả `true` → reload giữ filter. Lưu ý: code `if (result)` – nếu sheet đóng không trả giá trị (null) thì hành vi phụ thuộc kiểu trả về của `CustomDialog.showBottom` (chưa xác định, có thể lỗi runtime). |
| "Chấm công thủ công" trên thẻ | Bottom sheet tiêu đề **"Chấm công thủ công"**, body `PGConfirmContent(model)` với `isAttend` mặc định = **1** (pg_bloc.dart:358-369). Kết quả `true` → reload giữ filter. (Cùng lưu ý `if (result)`.) |
| "Duyệt tất cả" | `onApproveAllBatch` (pg_bloc.dart:233-271): dialog **"Thông báo"** / **"Đã duyệt tất cả thời gian làm việc"** (`approved_all_working_time_message`), nút **"Xác nhận"** + Huỷ. Xác nhận → loading → **1 request** `approved-all-v2` chứa mảng `requests` cho mọi ca `waiting` đang hiển thị → ẩn loading → `hasUpdate=true` → reload (reset filter). Không kiểm tra kết quả success (lỗi do Interaction tự báo). |
| "Xác nhận tất cả" | `onConfirmAll` (pg_bloc.dart:273-297): dialog "Thông báo" / **"Xác nhận tất cả thời gian làm việc?"**, nút "Xác nhận". Xác nhận → gọi **song song N request** `accept-actual-time` (mỗi ca `not-confirm`) → reload. |

Hàm `onApproveAll` (gọi `approved-all` từng ca, pg_bloc.dart:197-231) **không được UI sử dụng** (bottom dùng `onApproveAllBatch`).

#### 2.4 Rule client khi duyệt
Mỗi phần tử trong `approved-all-v2` (pg_bloc.dart:247-262):
- `time_working_staff_id`, `shift_id`, `checking_type` (null → **1**),
- `is_approved_next_shift` = `old_shift_id` khác 0 ? 1 : 0,
- `time_late_apply_work_late` = giá trị gốc; `is_approve_late` = (giá trị ≠ 0) ? 1 : 0,
- `time_late_apply_work_soon` = giá trị gốc; `is_approve_soon` = (≠0) ? 1 : 0,
- `time_working_staff_status` = (`checking_type` null hoặc 0) ? **`not-confirm`** : **`approved`**.
  (Lưu ý: điều kiện status dùng `checkingType ?? type0`, còn field `checking_type` gửi `?? 1` – hai default khác nhau.)

Xác nhận tất cả: mỗi request `time_working_staff_id`, `actual_time_work` = giá trị `actual_time_work` hiện có của ca, `is_attend` = 0 (pg_bloc.dart:286-291).

#### 2.5 API
| API | Params | Response dùng |
|---|---|---|
| `time-working-staff/get-list-by-staff` (API:393) | `staff_id` (NV đang xem), `week`, `year` (`staff_list_work_request_model.dart:16-18`; bloc:303-306) | `Data` (List) các `TimeWorkingModel`: `time_working_staff_id`, `working_day`, `working_time`, `working_end_time`, `shift_id`, `shift_name`, `branch_id`, `branch_name`, `time_working_staff_status`, `checking_type`, `check_in_date`, `check_out_date`, `is_check_out`, `old_shift_id`, `old_shift_name`, `old_shift_note`, `image_next_shift`, `is_approve_next_shift`, `approve_next_shift_by`, `approved_next_shift_by_name`, `approve_next_shift_date`, `time_late_apply_work_late(_note)`, `time_late_apply_work_soon(_note)`, `is_approve_late/soon`, `approve_late/soon_by(_name)`, `approve_late/soon_date`, `time_work`, `actual_time_work`, `timekeeping_coefficient`, `images[]`, `staff_id` (time_working_model.dart:249-404) |
| `time-working-staff/get-branch-right-by-staff` | `staff_id` = user đăng nhập (pg_bloc.dart:380-381) | `branch_id`, `branch_name` |
| `time-working-staff/approved-all-v2` (API:396) | `{ "requests": [ {…như 2.4} ] }` (`staff_approved_all_request_model.dart:35-66`) | chỉ dùng success |
| `time-working-staff/approved-all` (API:395) | 1 object như trên – **không dùng trên UI** | — |
| `time-working-staff/accept-actual-time` (API:394) | `time_working_staff_id`, `actual_time_work` (nếu ≠ null), `is_attend`=0 (`staff_accept_request_model.dart:26-43`) | success |
| `time-working-staff/get-staff-manager` (API:406) | `branch_id`, `page`, `per_page`(null), `search` (`employee_list_req_model.dart:10-17`) | danh sách `EmployeeModel` (`staff_id`, `full_name`…) |

---

### 3. PGDetailScreen – "Chi tiết lịch làm việc"

Files: `PG/src/ui/pg_detail_screen.dart`, `PG/src/bloc/pg_detail_bloc.dart`, nội dung `W/custom_schedule_detail.dart`.

#### 3.1 Mở từ / tham số
- Từ PGScreen bấm thẻ ca: `model: TimeWorkingModel` (chỉ dùng `time_working_staff_id` để gọi API) (pg_detail_screen.dart:12-15; pg_detail_bloc.dart:28-30,99-106).
- Back → trả `hasUpdate` (pg_detail_bloc.dart:47).

#### 3.2 Bố cục (CustomScheduleDetail, custom_schedule_detail.dart:419-440)
- AppBar **"Chi tiết lịch làm việc"** (`work_schedule_details`).
- Đang tải: 4 khối shimmer.
- **"Nhân viên: {staff_name}"** (showName=true).
- Header ngày `working_day` + chip trạng thái.
- Icon toà nhà + `branch_name`; icon + **"{shift_name} ({working_time} -> {working_end_time})"**; icon timer + **"Thời gian làm việc được xác nhận: {actual_time_work_confirmed}"** (custom_schedule_detail.dart:33-56).
- Khối thời gian (custom_schedule_detail.dart:163-240):
  - **"Tổng thời gian"**: `actual_time_work` + " Giờ"; null → **"Chưa xác định"** màu orange500.
  - **"Thời gian ước lượng"**: `time_work` + " Giờ"; null → "Chưa xác định" (orange500).
  - Nếu status == `confirmed`: **"Hệ số công"**: `timekeeping_coefficient`.
  - Nếu có history: tiêu đề **"Lịch sử vào ra"**.
  - Nếu có `latitude` & `longitude` (của ca/khách hàng): nút **"Bản đồ"** → mở Google Map.
  - Mỗi lượt history: **"Thời gian {i}"** + tổng giờ (check-out − check-in, nếu đủ cặp); 2 cột **"Giờ vào"** / **"Giờ ra"** (HH:mm từ `checkin_info.check_in_time` / `checkout_info.check_out_time`); ảnh selfie vào/ra (40px, bấm mở ảnh) nếu có `image_selfie`.
- Khối đơn từ (custom_schedule_detail.dart:242-417), chỉ khi có đơn:
  - Đổi ca (`old_shift_id > 0`): **"Đơn phép: Đổi ca"**, "Ca cũ": `old_shift_name` (đỏ đậm), "Lý do": `old_shift_note`, "Hình ảnh" (80px), "Ngày duyệt", "Người duyệt".
  - Đi muộn (`time_late_apply_work_late > 0`): **"Đơn phép: Đi muộn"**, "Đi muộn: {n} Phút", "Lý do", "Ngày duyệt"/"Người duyệt" — **lưu ý code đang hiển thị `approve_soon_date`/`approve_soon_by_name` cho đơn đi muộn** (custom_schedule_detail.dart:345-353).
  - Về sớm (`time_late_apply_work_soon > 0`): **"Đơn phép: Về sớm"**, "Về sớm: {n} Phút", "Lý do", "Ngày duyệt"/"Người duyệt" — **đang hiển thị `approve_late_*`** (custom_schedule_detail.dart:390-398). (Hai khối bị tráo field.)
- Nút bottom (pg_detail_screen.dart:60-101) – chọn theo thứ tự ưu tiên:
  1. status == `not-confirm` → **"Xác nhận thời gian làm việc"** → `onConfirm`.
  2. status == `waiting` (hoặc null):
     - có đổi ca (`old_shift_id > 0`) và `is_approve_next_shift == 0` → **"Duyệt lịch làm việc"** → `onApproveShift`;
     - else có về sớm (`time_late_apply_work_soon > 0`) và `is_approve_soon == 0` → "Duyệt lịch làm việc" → `onApproveLate`;
     - else có đi muộn (`time_late_apply_work_late > 0`) và `is_approve_late == 0` → "Duyệt lịch làm việc" → `onApproveLate`;
     - else → "Duyệt lịch làm việc" → `onApprove`.
  3. else nếu `isSupportConfirm` (approved & ngày < hôm nay) → **"Chấm công hộ"** (`timekeeping_support`), màu purple → `onSupport`.
  4. Khác → không có nút.

#### 3.3 Thao tác
| Nút | Xử lý |
|---|---|
| `onApprove` | Dialog "Thông báo" / **"Đã duyệt thời gian làm việc"** (`approved_working_time_message`), "Xác nhận"+Huỷ → loading → `approved-time-working-staff` {`time_working_staff_id`, `time_working_staff_status`=`approved`} → success: pop màn hình với `true` (pg_detail_bloc.dart:67-79,127-134). (Lưu ý: duyệt đơn lẻ luôn set `approved` bất kể `checking_type`, khác với duyệt tất cả.) |
| `onApproveShift` | push `PGShiftScreen(model)`; trả `true` → `hasUpdate=true`, reload chi tiết (pg_detail_bloc.dart:49-56). |
| `onApproveLate` | push `PGLateScreen(model)`; tương tự (58-65). |
| `onConfirm` | push `PGConfirmScreen(model, isAttend: 0)` (81-88). |
| `onSupport` | push `PGConfirmScreen(model, isAttend: 1)` (90-97). |

#### 3.4 API
| API | Params | Response dùng |
|---|---|---|
| `time-working-staff/get-detail` (API:398) | `time_working_staff_id` | `Data` (Map) TimeWorkingModel (các field như mục 2.5) + `staff_name`, `actual_time_work_confirmed`, `latitude`, `longitude`, `customer_name`, `history[]` {`checkin_info`{`check_in_day`,`check_in_time`,`image_selfie`…}, `checkout_info`{`check_out_day`,`check_out_time`,`image_selfie`…}} (pg_detail_bloc.dart:103-124; time_working_model.dart:375-380,559-566) |
| `time-working-staff/approved-time-working-staff` (API:399) | `time_working_staff_id`, `time_working_staff_status` (`staff_approved_request_model.dart:14-15`) | success |

---

### 4. PGConfirmScreen / PGConfirmContent – "Thời gian làm việc" (xác nhận giờ công / chấm công hộ / chấm công thủ công)

Files: `PG/src/ui/pg_confirm_screen.dart`, `PG/src/bloc/pg_confirm_bloc.dart`.

#### 4.1 Mở từ / tham số
- `PGConfirmScreen(model: TimeWorkingModel, isAttend)` – full screen, AppBar **"Thời gian làm việc"** (`working_time`) (pg_confirm_screen.dart:142-161). `isAttend`: comment "Chấm công hộ ? 1 : 0" (dòng 144).
  - PGDetail "Xác nhận thời gian làm việc" → isAttend=0.
  - PGDetail "Chấm công hộ" → isAttend=1.
  - Report tuần → "Chấm công thủ công" (ShiftDetailBottomSheet) → isAttend=1 (report_timekeeping_bloc.dart:515-524).
- `PGConfirmContent(model, isAttend=1 mặc định)` – dùng trực tiếp trong bottom sheet **"Chấm công thủ công"** từ PGScreen (pg_bloc.dart:358-369).

#### 4.2 Bố cục (pg_confirm_screen.dart:58-134)
1. **"Thời gian làm việc thực tế"** (`actual_working_time`): TextField số thập phân (`numberWithOptions(decimal:true)`, `DecimalNumberInputFormatter` dấu "."), hint = `actual_time_work` đã format; giá trị khởi tạo = `actual_time_work` nếu có, nếu không = số giờ tính từ `working_time` → `working_end_time` (pg_confirm_bloc.dart:32-48,51-105).
2. **"Chấm công"** (`timekeeping`): Dropdown hint **"Chọn"**, danh sách từ API mã công (text = `shift_code`, data = `timekeeping_coefficient`); giá trị mặc định cứng `text "1", data "1.0"` (pg_confirm_bloc.dart:21-22).
3. (Ô "Ghi chú" đã bị comment, dòng 99-110.)
4. Nút **"Xác nhận"** (nền primary, chữ trắng).

#### 4.3 Thao tác "Xác nhận" (pg_confirm_bloc.dart:129-164)
- Build request: `time_working_staff_id`, `note` = "" (controller ghi chú luôn rỗng), `is_attend` = isAttend, `actual_time_work` = (ô trống ? `model.actual_time_work` : `parseMoney(text)`), `shift_code_approved` = text mã công đang chọn, `timekeeping_coefficient` = data (hệ số) đang chọn.
- Dialog "Thông báo" / **"Xác nhận thời gian làm việc?"**, "Xác nhận" + Huỷ → loading → `accept-actual-time` → success: pop `true`.
- Không có validate (không giới hạn giờ, không bắt buộc chọn mã công vì có mặc định "1").

#### 4.4 Tính giờ mặc định (pg_confirm_bloc.dart:51-105)
- Parse `working_time`, `working_end_time` dạng "HH:mm" hoặc "HH:mm:ss"; nếu end < start (ca qua đêm) cộng 1 ngày; trả `phút/60`. Thiếu dữ liệu/lỗi → 0.

#### 4.5 API
| API | Params | Response |
|---|---|---|
| `time-working-staff/get-list-shift-code` (API:397) | không có body | `Data` (List): `shift_code`, `timekeeping_coefficient` (`staff_shift_code_response_model.dart:31-32`) |
| `time-working-staff/accept-actual-time` | `time_working_staff_id`, `actual_time_work`, `note`, `shift_code_approved`, `timekeeping_coefficient`, `is_attend` | success |

---

### 5. PGLateScreen – "Duyệt lịch làm việc" (duyệt đi muộn / về sớm)

Files: `PG/src/ui/pg_late_screen.dart`, `PG/src/bloc/pg_late_bloc.dart`.

#### 5.1 Mở từ / tham số
- PGDetail (`onApproveLate`) hoặc PGShiftScreen sau khi duyệt đổi ca mà còn đơn muộn+sớm. Tham số `model: TimeWorkingOverviewResponseModel` (pg_late_screen.dart:12-15).

#### 5.2 Bố cục (pg_late_screen.dart:52-283)
- AppBar **"Duyệt lịch làm việc"**.
- "Nhân viên: {staff_name}".
- Header ngày `working_day` + chip trạng thái.
- "Ca": `shift_name`.
- Nếu `old_shift_id > 0`: khối đổi ca: **"Đơn phép: Đổi ca làm"**, "Ca cũ": `old_shift_name` (đỏ), "Lý do", "Hình ảnh" (80px), "Ngày duyệt" (`approve_next_shift_date`), "Người duyệt".
- Khối nhập: tiêu đề **"Đơn phép: Đi muộn/Về sớm"**.
  - Nếu `time_late_apply_work_late > 0`: **"Số phút đi muộn"**: [ - ] [TextField] [ + ]; hint = số phút xin; dưới là **"Ghi chú đi muộn"**: `time_late_apply_work_late_note`.
  - Nếu `time_late_apply_work_soon > 0`: **"Số phút về sớm"**: tương tự; **"Ghi chú về sớm"**: `time_late_apply_work_soon_note`.
- Nút bottom **"Phê duyệt"** (`approve`). (Nút "Không được duyệt" bị comment, dòng 267-268; hàm `onNotApproved` tồn tại nhưng không dùng.)

#### 5.3 Field nhập
- TextField số nguyên (`digitsOnly` + format nghìn), căn giữa. Không validate tối đa (có thể nhập lớn hơn số phút xin).
- Nút "-": giảm 1; nếu ≤ 1 → xoá trống. Nút "+": **tăng 5** (pg_late_bloc.dart:35-47).

#### 5.4 "Phê duyệt" (pg_late_bloc.dart:49-90)
- Số phút gửi đi: nếu loại đơn có (>0) thì = ô nhập (trống → dùng số phút xin gốc); loại không có → 0.
- `is_approve_late` = (phút muộn ≠ 0) ? 1 : 0; `is_approve_soon` tương tự. (Nhập 0 = coi như không duyệt.)
- `time_working_staff_status` = (`checking_type` null/0) ? `not-confirm` : `approved`.
- Dialog "Thông báo" / "Đã duyệt thời gian làm việc", "Xác nhận"+Huỷ → loading → API → success pop `true`.

#### 5.5 API
| API | Params |
|---|---|
| `time-working-staff/approved-time-soon-late-staff` (API:400-401) | `time_working_staff_id`, `is_approve_soon`, `time_late_apply_work_soon`, `is_approve_late`, `time_late_apply_work_late`, `time_working_staff_status` (`staff_approved_late_soon_request_model.dart:28-33`) |

---

### 6. PGShiftScreen – "Duyệt lịch làm việc" (duyệt đơn đổi ca)

Files: `PG/src/ui/pg_shift_screen.dart`, `PG/src/bloc/pg_shift_bloc.dart`.

#### 6.1 Mở từ / tham số
- PGDetail `onApproveShift` khi có đơn đổi ca chưa duyệt. Tham số `model: TimeWorkingOverviewResponseModel`.

#### 6.2 Bố cục (pg_shift_screen.dart:51-153)
- AppBar **"Duyệt lịch làm việc"**.
- "Nhân viên: {staff_name}"; header ngày + chip trạng thái.
- **"Đổi ca"** (`shift_switch`, có dấu * bắt buộc): Dropdown hint **"Chọn ca làm việc của bạn"**; giá trị mặc định = ca hiện tại (`shift_id`, `shift_name`, data `checking_type`) (pg_shift_bloc.dart:30-37).
- **"Ca cũ"**: `old_shift_name` (đỏ).
- Nút bottom **"Xác nhận"**.

#### 6.3 Dropdown ca
- API `get-list-shift` **không truyền branch** (`ShiftReqModel()`), lọc client theo thứ của `working_day` (`filterByDate`) (pg_shift_bloc.dart:89-111).

#### 6.4 "Xác nhận" (pg_shift_bloc.dart:59-87, 113-127)
- `status` = (`checking_type` của ca được chọn null/0) ? `not-confirm` : `approved`.
- Nếu **đồng thời** còn đơn về sớm chưa duyệt (`time_late_apply_work_soon > 0 && is_approve_soon == 0`) **và** đơn đi muộn chưa duyệt (`…late > 0 && is_approve_late == 0`) → `status = null` (không đổi trạng thái), message dialog = **"Đơn phép đã được duyệt"** (`approved_application_message`); ngược lại message = "Đã duyệt thời gian làm việc".
  (Lưu ý: điều kiện dùng AND – nếu chỉ có 1 trong 2 loại đơn thì status vẫn được set và không chuyển sang màn duyệt muộn/sớm.)
- Dialog "Thông báo", "Xác nhận"+Huỷ → loading → API `approved-change-shift` {`time_working_staff_id`, `shift_id` (ca chọn), `is_approved_next_shift`=1, `time_working_staff_status` (chỉ gửi khi ≠ null)}.
- Success:
  - Nếu `status == null`: parse `Data` thành TimeWorkingModel mới → push **PGLateScreen** → sau khi quay lại pop `true`.
  - Ngược lại: pop `true`.

#### 6.5 API
| API | Params | Response |
|---|---|---|
| `time-working-staff/get-list-shift` (API:388) | `branch_id` (null ở màn này) (`shift_req_model.dart:14`) | `Data` (List): `shift_id`, `shift_name`, `checking_type`, `start_work_time`, `end_work_time`, `is_monday…is_sunday`, `shift_code`, `timekeeping_coefficient`, … (time_working_shift_model.dart:66-96) |
| `time-working-staff/approved-change-shift` (API:412) | như trên (`staff_approved_shift_request_model.dart:20-29`) | `Data` (Map) TimeWorkingModel – chỉ dùng khi status null |

---

### 7. ChangeShiftScreen – Bottom sheet "Đổi ca" (quản lý đổi ca hộ)

Files: `PG/src/ui/change_shift_screen.dart`, `PG/src/bloc/change_shift_bloc.dart`.

#### 7.1 Mở từ / tham số
- PGScreen nút "Đổi ca" trên thẻ: `model`, `isLead: true`, `staffId: model.staffId` (pg_bloc.dart:343-356).
- ReportTimekeepingScreen → ShiftDetailBottomSheet → "Đổi ca": `model` (convert từ TimeWorkingDetailModel), `staffId: detail.staffId`, `isLead` = null (report_timekeeping_bloc.dart:497-513).
- Bao trong `CustomBottomSheet` tiêu đề **"Đổi ca"**.

#### 7.2 Bố cục (change_shift_screen.dart:52-188)
1. Nhãn **"Chi nhánh"** + Dropdown đơn (icon chi nhánh, hint "Chi nhánh").
2. Nhãn **"Ca"** + Dropdown đơn (icon ca, hint "Ca").
3. **"Ghi đè thời gian (Tùy chọn)"**: 2 dropdown giờ:phút **"Giờ bắt đầu"** – **"Giờ kết thúc"** (giờ 0-23, phút 0-59; `W/custom_dropdown.dart:324-333`).
4. Nút **"Chấp nhận"** (`accept`).

#### 7.3 Load dữ liệu (change_shift_bloc.dart:68-201)
- `get-branch-right-by-staff` với `staff_id` = `widget.staffId` (nhân viên được đổi) hoặc user đăng nhập.
- Sau đó `get-list-shift` với `branch_id` = chi nhánh đang chọn (≠0) hoặc `model.branch_id` (≠0) hoặc null; lọc theo thứ của `working_day`; item mang `start_work_time`/`end_work_time`.
- Map giá trị ban đầu: chi nhánh = `model.branch_id`; ca = `model.shift_id`; giờ bắt đầu/kết thúc = `working_time`/`working_end_time` của bản ghi.
- Đổi chi nhánh → reload danh sách ca, xoá ca đã chọn (203-207).
- Đổi ca → tự set giờ bắt đầu/kết thúc theo `start_work_time`/`end_work_time` của ca (209-248).

#### 7.4 "Chấp nhận" (change_shift_bloc.dart:273-321)
- Nếu `isLead == true`: reset local `approveNextShiftBy`, `isCheckIn*` = null (không ảnh hưởng request).
- Validate duy nhất: chưa chọn ca → dialog "Thông báo" / **"Vui lòng chọn ca làm việc"**. **Không** kiểm tra giờ kết thúc > giờ bắt đầu.
- Request `change-shift`: `time_working_staff_id` (?? 0), `shift_id` (ca chọn), `old_shift_id` = `model.shift_id` (?? 0), `old_shift_note` = null, `image_next_shift` = null, `working_time` = "HH:mm" (nếu đủ giờ+phút), `working_end_time` = "HH:mm", `branch_id` = chi nhánh chọn.
- Loading → success: dialog "Thông báo" với nội dung = `ErrorDescription` server trả về (message thành công) → pop `true`.

#### 7.5 API
| API | Params |
|---|---|
| `time-working-staff/get-branch-right-by-staff` | `staff_id` |
| `time-working-staff/get-list-shift` | `branch_id` |
| `time-working-staff/change-shift` (API:392) | như 7.4 (`change_shift_request_model.dart:32-47`) |

---

### 8. ReportTimekeepingScreen – "Báo cáo lịch làm việc nhân viên" (theo tuần)

Files: `PG/module/report_timekeeping/ui/report_timekeeping_screen.dart`, `.../bloc/report_timekeeping_bloc.dart`, lưới `W/roster_data_grid.dart`, chú thích `W/status_legend_widget.dart`, sheet `W/shift_detail_bottomsheet.dart`, `W/add_shift_bottomsheet.dart`, `W/filter_multi_select_bottomsheet.dart`.

#### 8.1 Mở từ / tham số
- Home, quyền `TI000002`. Không tham số. Ngày mặc định hôm nay, tuần ISO (report_timekeeping_bloc.dart:28-35,89-95). `onReady` → song song `getBranch` (→ `downloadShift`), `onGetStatus`, `fetchRosterData` (170-172).

#### 8.2 Bố cục
- AppBar **"Báo cáo lịch làm việc nhân viên"** (`report_employee_schedule`).
- Phần trên (filter section, mặc định mở): `CustomHeaderWeek` dòng **"Tuần {w} ({start} - {end})"** (bấm → chọn tuần) + ô tìm **"Tìm nhân viên"** (`search_staff`); dải gradient bóng. Khi thu gọn: dải "Mở rộng" (icon filter) (report_timekeeping_screen.dart:87-183,292-310).
- Lưới `RosterDataGrid` (report_timekeeping_screen.dart:312-397; roster_data_grid.dart):
  - Cột 1 header **"Nhân viên"** + badge đỏ = `total`.
  - Các cột ngày: tên thứ rút gọn + số ngày; ngày hôm nay nền `red50`, số trong vòng tròn primary. **Bấm header ngày → mở `ReportTimekeepingHourScreen(initialDate: day)`** (roster_data_grid.dart:274-288).
  - Ô nhân viên: avatar (ảnh `staff_avatar` hoặc chữ viết tắt, màu theo staff), `full_name`, `branch_name`; bấm → `PGScreen` (report_timekeeping_bloc.dart:573-590).
  - Ô ngày không có ca: icon (+) **"Thêm ca"** → `onAddShift`.
  - Ô có 1 ca: vạch màu theo `status` (màu từ API status), `shift_name`, icon vị trí + `branch_name`, danh sách check-in/out; góc phải nút (+) thêm ca. Ô nhiều ca: hiển thị dạng nhiều ca (chi tiết widget chưa đọc hết).
  - Bấm ô có ca → `ShiftDetailBottomSheet` tiêu đề **"Chi tiết lịch làm việc - {day}"**: mỗi ca: tên ca (hoặc "Ca {i}"), **"Thời gian làm việc:"**, "Check in/out:" (`--:--/--:--` nếu không có; nhiều lượt: "Check in/out {i}:"), **"Chi nhánh:"**, **"Trạng thái:"** (label theo status API); nút **"Đổi ca"** (nếu `canChangeShift`) và **"Chấm công thủ công"** (nếu `canProxyAttendance`, ở đây không truyền `workingEndTime` → so theo ngày) (shift_detail_bottomsheet.dart:100-245).
  - Load more khi cuộn cuối; đang tải: 3 shimmer.
- Bottom (ẩn/hiện bằng `streamExpand`, mặc định **ẩn**; khi ẩn có FAB nhỏ icon filter để mở) (report_timekeeping_screen.dart:55-69,399-485):
  - Dải **"Thu gọn"**.
  - 2 ô chọn: Địa điểm (text mặc định **"Tất cả địa điểm làm việc"**) và Ca (**"Tất cả ca"**); nhiều lựa chọn → "{n} Đã chọn".
  - `StatusLegendWidget`: chip **"Tất cả"**, chip **"Hôm nay"**, và các chip trạng thái từ API (label + màu).

#### 8.3 Thao tác
| Thao tác | Xử lý |
|---|---|
| Chọn tuần | `onDate` → tính tuần → `downloadShift(branchId đang chọn)` → `fetchRosterData` (184-192). |
| Tìm kiếm | debounce → `fetchRosterData` (gửi `search` + lọc client theo `full_name`/`branch_name`) (329-331,442-449). |
| Chọn địa điểm | Sheet **"Địa điểm làm việc"**, single-select (option "Tất cả địa điểm làm việc" id=0) → reload danh sách ca theo chi nhánh → `fetchRosterData` (260-274; bloc 266-287). |
| Chọn ca | Sheet **"Ca"**, multi-select ("Tất cả ca" id=0 loại trừ) → `fetchRosterData` (276-290; bloc 289-299). |
| Chip trạng thái | Toggle multi-select; bỏ "Hôm nay" nếu đang bật → reload (128-144). |
| "Tất cả" | Xoá chọn trạng thái + tắt "Hôm nay" → reload (146-152). |
| "Hôm nay" | Toggle; khi bật: xoá chọn trạng thái, đặt lại tuần hiện tại, gửi `day`=yyyy-MM-dd hôm nay → reload (154-168). |
| Thêm ca | Parse ngày (ISO hoặc dd/MM/yy[yy]); lỗi → dialog **"Invalid date format: {isoDate}"** (text cứng). Mở sheet **"Thêm ca"** `AddShiftBottomSheet(date, staffId, staffName)`; `true` → reload (526-571). |
| Đổi ca (từ sheet chi tiết) | Bottom sheet "Đổi ca" `ChangeShiftScreen(model, staffId)` → `true` → reload (497-513). |
| Chấm công thủ công | push `PGConfirmScreen(model, isAttend: 1)` → `true` → reload (515-524). |
| Bấm nhân viên | push `PGScreen(model{staffId, fullName}, date)` → `true` → reload (573-590). |

##### AddShiftBottomSheet (W/add_shift_bottomsheet.dart)
- Field: **"Ngày làm việc"** (`working_day`, chỉ hiển thị), **"Nhân viên"**, **"Ca"** (dropdown hint "Chọn ca làm việc của bạn"), **"Chi nhánh"** (dropdown hint **"Chọn chi nhánh"**; mặc định chi nhánh của user đăng nhập nếu có trong list, không thì phần tử đầu), "Ghi đè thời gian (Tùy chọn)" giờ bắt đầu/kết thúc (dòng 255-360; giá trị text vi.json của `working_day` chưa tra).
- Load: `get-branch-right-by-staff` (`staff_id` = NV được thêm ca), `get-list-shift` (`branch_id` đang chọn, lọc theo thứ của ngày) (dòng 160-215).
- Validate (dòng 110-134): chưa chọn ca → **"Bạn chưa chọn Ca"**; nếu có cả giờ bắt đầu và kết thúc mà kết thúc ≤ bắt đầu → `end_time_must_be_after_start_time` (text chưa tra).
- API `time-working-staff/add-shift-staff` (API:407): `staff_id`, `branch_id`, `shift_id`, `working_day` (yyyy-MM-dd), `working_time`, `working_end_time` (`add_shift_staff_request_model.dart:26-35`). Success → dialog nội dung `ErrorDescription` → pop `true`.

#### 8.4 Rule client
- Lọc client bổ sung sau khi nhận trang (report_timekeeping_bloc.dart:442-474): theo chi nhánh (NV có ít nhất 1 ca thuộc chi nhánh chọn) và theo trạng thái (NV có ít nhất 1 ca có `status` thuộc tập chọn) – ngoài việc đã gửi các tham số này lên server.
- Phân trang: `per_page`=20; hết trang khi `currentPage >= last_page` hoặc trang rỗng (431-440).

#### 8.5 API
| API | Params | Response dùng |
|---|---|---|
| `time-working-staff/get-branch-right-by-staff` | `staff_id` = user đăng nhập | `branch_id`, `branch_name` |
| `time-working-staff/get-list-shift` | `branch_id` (null = tất cả) | như mục 6.5; lọc theo thứ của ngày đang chọn |
| `time-working-staff/status-time-working-staff` (API:389-390) | không body | `Data` (List): `value`/`key`, `label`, `color_code`/`color` (`timekeeping_status_model.dart:18-20`) |
| `time-working-staff/report-time-working-staff` (API:391) | `date_type`="by_week", `years`, `date_object`=tuần, `branch_id`[] (null nếu rỗng), `shift_id`[] (null nếu rỗng), `page`, `per_page`=20, `status`[] (null nếu rỗng), `day` (yyyy-MM-dd khi bật "Hôm nay", ngược lại null), `search` (`timekeeping_report_req_model.dart:28-37`; bloc 398-408) | `Data`: `list` {`current_page`, `last_page`, `total`, `data[]` {`staff_id`, `full_name`, `staff_avatar`, `branch_name`, `shift[]` {`day`, `time_working[]` {`time_working_staff_id`, `staff_id`, `staff_name`, `shift_id`, `shift_name`, `branch_id`, `branch_name`, `working_day`, `working_end_day`, `working_time`, `working_end_time`, `status`, `time_working_staff_status`, `checking_type`, `is_check_in(_1.._4)`, `is_check_out`, `check_in_date(_1.._4)`, `check_out_date(_1.._4)`, `check_in_day/time`, `check_out_day/time`, `is_ot`, `is_close`, `is_deducted`, `is_approve_late/soon`, `approved_actual_time_by`, `work_schedule_id`}}}}, `listDay[]` {`day`, `day_name`, `day_format`, `day_full_format`} (`roster_response_model.dart:14-260`) |
| `time-working-staff/add-shift-staff` | xem 8.3 | `ErrorDescription` |
| `time-working-staff/change-shift`, `accept-actual-time` | xem mục 7, 4 | |

---

### 9. ReportTimekeepingHourScreen – "Báo cáo lịch làm việc nhân viên" (theo giờ trong 1 ngày)

Files: `PG/module/report_timekeeping_hour/ui/report_timekeeping_hour_screen.dart`, `.../bloc/report_timekeeping_hour_bloc.dart`; widget `HourlyStaffRoster` (`W/hourly_roster_model.dart` – chưa đọc chi tiết).

#### 9.1 Mở từ / tham số
- Bấm header cột ngày trong ReportTimekeepingScreen; `initialDate` = ngày đó (null → hôm nay) (report_timekeeping_hour_screen.dart:11-15; bloc:84-100).

#### 9.2 Bố cục
- AppBar **"Báo cáo lịch làm việc nhân viên"**.
- Thân: đang tải → `CircularProgressIndicator`; xong → `HourlyStaffRoster` (timeline theo giờ: tài nguyên = nhân viên, appointment = ca) với `selectedDate`, chọn ngày, vuốt sang ngày trước/sau, pull refresh, bấm nhân viên (report_timekeeping_hour_screen.dart:94-132). Chi tiết hiển thị bên trong widget: chưa xác định (chưa đọc).
- Filter dưới cùng (mặc định **ẩn**, có FAB filter để mở; dải "Thu gọn"): 2 ô **Địa điểm làm việc** (multi-select, text mặc định "Địa điểm làm việc", nhiều → "{n} Vị trí") và **Nhân viên** (multi-select, mặc định "Nhân viên", nhiều → "{n} Nhân viên"); dải chip trạng thái: "Tất cả" + chip từ `status_option` (label, màu `color_code`) (dòng 134-425).

#### 9.3 Thao tác
| Thao tác | Xử lý |
|---|---|
| Đổi ngày / vuốt ±1 ngày | Reset filter về "Tất cả", gọi lại API (bloc 446-468). |
| Kéo refresh | Gọi lại API ngày hiện tại (470-473). |
| Filter chi nhánh/nhân viên/trạng thái | **Lọc hoàn toàn ở client** trên dữ liệu đã tải (256-300): NV có ca thuộc chi nhánh chọn; NV thuộc danh sách chọn; chỉ giữ ca có `status` thuộc tập trạng thái chọn; NV không còn ca bị ẩn. Ca chồng giờ khác chi nhánh được gộp (`ShiftMergeHelper.mergeOverlappingBranches`). |
| Bấm nhân viên | push `PGScreen(model{staffId, fullName}, date: ngày đang xem)` → `true` → refresh (475-492). |

#### 9.4 Rule client
- Màu nhân viên: chọn từ bảng `allStaffColors` (constant.dart:424-440) theo `staffId % n`, loại các màu gần với màu trạng thái (khoảng cách RGB trung bình < 50) (bloc 184-223, 432-444).
- Thời gian ca: ghép `working_day` (yyyy-MM-dd) + `working_time` (HH:mm); kết thúc dùng `working_end_day ?? working_day` + `working_end_time`; thiếu giờ → bỏ ca (345-426).
- Lỗi parse/API → danh sách rỗng (133-136).

#### 9.5 API
| API | Params | Response dùng |
|---|---|---|
| `time-working-staff/report-time-working-staff-detail` (API:386-387) | `day` = yyyy-MM-dd (`report_timekeeping_req_model.dart:8`) | `Data`: `staff_list[]` {`staff_id`, `full_name`, `branch_name`, `staff_avatar`, `shift_list[]` {`working_day`, `working_end_day`, `working_time`, `working_end_time`, `status`, `shift_name`, `branch_id`, `branch_name`, …}}, `branch_option[]` {`branch_id`, `branch_name`}, `status_option[]` {`value`, `label`, `color_code`} (`report_timeleeping_hour_res_model.dart`) |

---

### 10. Tổng hợp endpoint được module gọi

| # | Endpoint (POST) | Gọi từ |
|---|---|---|
| 1 | `time-working-staff/get-list-group-status` | PGList |
| 2 | `time-working-staff/get-branch-right-by-staff` | PGList, PGScreen, ChangeShift, Report tuần, AddShift |
| 3 | `time-working-staff/get-list-by-staff` | PGScreen |
| 4 | `time-working-staff/approved-all-v2` | PGScreen "Duyệt tất cả" |
| 5 | `time-working-staff/approved-all` | (khai báo trong PGBloc, không dùng UI) |
| 6 | `time-working-staff/accept-actual-time` | PGScreen "Xác nhận tất cả", PGConfirm |
| 7 | `time-working-staff/get-staff-manager` | PGScreen (đổi nhân viên) |
| 8 | `time-working-staff/get-detail` | PGDetail |
| 9 | `time-working-staff/approved-time-working-staff` | PGDetail `onApprove` |
| 10 | `time-working-staff/get-list-shift-code` | PGConfirm |
| 11 | `time-working-staff/approved-time-soon-late-staff` | PGLate |
| 12 | `time-working-staff/get-list-shift` | PGShift, ChangeShift, Report tuần, AddShift |
| 13 | `time-working-staff/approved-change-shift` | PGShift |
| 14 | `time-working-staff/change-shift` | ChangeShift |
| 15 | `time-working-staff/status-time-working-staff` | Report tuần |
| 16 | `time-working-staff/report-time-working-staff` | Report tuần |
| 17 | `time-working-staff/add-shift-staff` | Report tuần (AddShift) |
| 18 | `time-working-staff/report-time-working-staff-detail` | Report theo giờ |
| — | `v2/user/permission` | Login/Splash (quyết định menu TI000001/TI000002) |

### 11. Ghi chú / điểm bất thường phát hiện
1. Kiểm tra quyền leader để hiện "LLV nhân viên" đã bị comment (home_screen.dart:331,336-341) → chỉ dựa vào quyền `TI000001`.
2. PGScreen không cho đổi tuần (không truyền `onDate`).
3. `CustomSchedule` nhận `onSupportConfirm` nhưng không render nút.
4. PGDetail hiển thị tráo thông tin duyệt giữa đơn đi muộn và về sớm (custom_schedule_detail.dart:345-353, 390-398).
5. Duyệt đơn lẻ (`onApprove`) luôn set `approved`; duyệt tất cả / duyệt muộn-sớm / duyệt đổi ca set `not-confirm` nếu `checking_type` = 0, `approved` nếu khác.
6. "Duyệt tất cả" gửi `checking_type ?? 1` nhưng tính status với `checking_type ?? 0`.
7. PGShift: chỉ chuyển sang duyệt muộn/sớm khi có **cả hai** đơn chưa duyệt (điều kiện AND).
8. PGConfirm luôn gửi `note: ""`; mã công mặc định "1"/"1.0" nếu không chọn; không validate giờ thực tế.
9. ChangeShift không validate giờ kết thúc > giờ bắt đầu (AddShift thì có).
10. Dialog xác nhận ở PGDetail/PGLate dùng câu khẳng định "Đã duyệt thời gian làm việc" thay vì câu hỏi.
11. `if (result)` sau bottom sheet ở PGBloc (pg_bloc.dart:355,368) – nếu đóng sheet trả null, có thể lỗi (chưa xác định kiểu trả về).
