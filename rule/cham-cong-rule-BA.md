# TÀI LIỆU NGHIỆP VỤ CHẤM CÔNG — MATTHEWS
### (Bản dành cho BA / người không chuyên IT)

> **Mục đích:** Giải thích toàn bộ quy tắc chấm công đang chạy trên hệ thống Matthews, từ lúc cấu hình, xếp lịch, nhân viên chấm công, quản lý duyệt, cho tới báo cáo và tính lương. Viết bằng ngôn ngữ nghiệp vụ, không cần biết lập trình.
>
> **Nguồn:** Tổng hợp từ tài liệu kỹ thuật `cham-cong-rule.md` và đối chiếu mã nguồn của 3 hệ thống: Web quản trị (Portal), Máy chủ phục vụ app (Staff API), App nhân viên (Matthews Staff). Ngày lập: 08/10/2026.
>
> **Quy ước:**
> - "Hiện tại hệ thống đang…" = mô tả đúng hành vi đang chạy, kể cả khi hành vi đó có vẻ chưa hợp lý.
> - ⚠️ = điểm bất thường / lỗi / rủi ro cần BA lưu ý (tổng hợp lại ở **Phần 16**).
> - "Chưa xác định" = không đủ căn cứ để khẳng định (thường do giá trị nằm trong cơ sở dữ liệu thật mà lúc phân tích không truy cập được).

---

## MỤC LỤC

1. [Thuật ngữ cần biết](#1-thuật-ngữ-cần-biết)
2. [Bức tranh tổng thể](#2-bức-tranh-tổng-thể)
3. [Vòng đời của một ca làm việc](#3-vòng-đời-của-một-ca-làm-việc)
4. [Cấu hình nền (làm trước khi dùng)](#4-cấu-hình-nền-làm-trước-khi-dùng)
5. [Định nghĩa Ca làm việc](#5-định-nghĩa-ca-làm-việc)
6. [Xếp lịch làm việc cho nhân viên](#6-xếp-lịch-làm-việc-cho-nhân-viên)
7. [Duyệt lịch làm việc](#7-duyệt-lịch-làm-việc)
8. [Nhân viên chấm công hằng ngày trên app](#8-nhân-viên-chấm-công-hằng-ngày-trên-app)
9. [Đi trễ, về sớm, nghỉ không lương — hệ thống đánh giá thế nào](#9-đi-trễ-về-sớm-nghỉ-không-lương--hệ-thống-đánh-giá-thế-nào)
10. [Các yêu cầu của nhân viên: đổi ca, xin trễ/sớm, làm thêm giờ, nghỉ phép](#10-các-yêu-cầu-của-nhân-viên)
11. [Quản lý xử lý sau ca: xác nhận giờ, chấm công hộ, điều chỉnh](#11-quản-lý-xử-lý-sau-ca)
12. [Tính công, báo cáo](#12-tính-công-báo-cáo)
13. [Liên kết sang Lương](#13-liên-kết-sang-lương)
14. [Màu sắc & thông báo](#14-màu-sắc--thông-báo)
15. [Phân quyền & danh sách màn hình](#15-phân-quyền--danh-sách-màn-hình)
16. [Hạn chế, lỗi và rủi ro hiện tại](#16-hạn-chế-lỗi-và-rủi-ro-hiện-tại)
17. [Câu hỏi mở cần nghiệp vụ xác nhận](#17-câu-hỏi-mở-cần-nghiệp-vụ-xác-nhận)
18. [Phụ lục: đối chiếu thuật ngữ nghiệp vụ ↔ kỹ thuật](#18-phụ-lục-đối-chiếu-thuật-ngữ)

---

## 1. Thuật ngữ cần biết

| Thuật ngữ | Giải thích dễ hiểu |
|---|---|
| **Ca làm việc (mẫu ca)** | Khuôn mẫu khung giờ làm, ví dụ "Ca sáng 08:00–17:00, nghỉ trưa 12:00–13:00". Tạo một lần, dùng nhiều lần. |
| **Lịch làm việc / Ca của nhân viên** | Việc gán 1 mẫu ca cho 1 nhân viên vào 1 ngày cụ thể. Ví dụ: "Anh A – Ca sáng – ngày 10/10". Mọi việc chấm công, duyệt, tính công đều xoay quanh đơn vị này. |
| **Chi nhánh làm việc** | Nơi nhân viên làm ca đó. Quyết định điểm wifi/GPS dùng để kiểm tra khi chấm công. Có thể khác chi nhánh mà nhân viên trực thuộc. |
| **Check-in / Vào ca** | Nhân viên bấm "Giờ vào" trên app. |
| **Check-out / Ra ca** | Nhân viên bấm "Giờ ra" trên app. |
| **Lượt chấm công** | Một cặp vào–ra. Một ca có thể yêu cầu 1 đến 5 lượt (ví dụ ca gãy: sáng vào–ra, chiều vào–ra = 2 lượt). Có thể cấu hình 0 lượt = ca không cần chấm công. |
| **Giờ công thực tế** | Số giờ hệ thống tự tính từ giờ vào/ra của nhân viên. |
| **Giờ công được xác nhận** | Số giờ quản lý chốt lại cho ca (có thể khác giờ thực tế). Đây là con số dùng cho báo cáo giờ và lương. |
| **Hệ số công** | Ca này được tính bao nhiêu công. Ví dụ ca thường = 1, ca nửa ngày = 0,5, ca lễ có thể = 2. |
| **Giờ làm tối thiểu tính đủ công** | Số giờ tối thiểu của ca (dùng làm "giờ dự kiến/ước tính"). |
| **Mã công (loại công)** | Ký hiệu quản lý chọn khi xác nhận ca: `1` (1 công), `1/2` (nửa công), `P` (nghỉ phép năm), `P/2` (nửa phép nửa công), `OFF` (ngày nghỉ), `KL` (nghỉ không lương), `OT` (tăng ca). |
| **Quản lý trực tiếp** | Người được khai báo là quản lý của nhân viên trong hồ sơ. Là người nhận thông báo và duyệt lịch cho nhân viên đó. |
| **Kỳ công / Kỳ chốt công** | Khoảng ngày dùng để tổng hợp công tháng, ví dụ 26 tháng trước → 25 tháng này. |
| **Chốt lương** | Sau khi bảng lương được chốt, các ca trong kỳ bị khóa một số thao tác. |
| **Nhân viên linh động** | Nhân viên được miễn kiểm tra wifi/GPS khi chấm công. |
| **Nhân viên không cần duyệt lịch** | Mọi yêu cầu lịch của người này (đăng ký ca, đổi ca, xin trễ/sớm, tăng ca) được tự động duyệt. |
| **Chấm công hộ** | Quản lý/Admin nhập giờ vào/ra thay cho nhân viên (thường khi nhân viên quên chấm). |
| **OT / Tăng ca / Làm thêm giờ** | Ca làm ngoài giờ, đánh dấu riêng để tính lương OT. |

---

## 2. Bức tranh tổng thể

### 2.1. Ba kênh sử dụng

| Kênh | Ai dùng | Làm gì |
|---|---|---|
| **Web quản trị (Portal)** | HR, Admin, Quản lý | Cấu hình, tạo mẫu ca, xếp lịch, duyệt, xác nhận, chấm công hộ, đánh dấu nghỉ có/không lương, thưởng/phạt, xem báo cáo, xuất Excel, tính lương. |
| **App nhân viên — phần cá nhân** | Nhân viên | Chấm công vào/ra (có thể chụp selfie), xem lịch của mình, đăng ký ca, đổi ca, xin đi muộn/về sớm, đăng ký làm thêm giờ, xem công tháng, xem lịch sử chấm công. |
| **App nhân viên — phần quản lý** ("LLV nhân viên", "Báo cáo chấm công") | Quản lý / Leader | Xem lịch tuần của nhân viên, duyệt lịch, duyệt đổi ca, duyệt đi muộn/về sớm, xác nhận giờ làm, chấm công hộ, đổi ca hộ, thêm ca, xem báo cáo theo tuần và theo giờ. |

### 2.2. Các vai trò

| Vai trò | Quyền hạn chính |
|---|---|
| **Admin / HR** | Toàn quyền cấu hình và thao tác trên web. Nếu bật cấu hình "Cho phép Admin xác nhận ca làm việc" thì được xác nhận giờ thay quản lý. |
| **Quản lý trực tiếp** | Duyệt lịch, xác nhận giờ cho nhân viên dưới quyền; nhận thông báo khi nhân viên chấm công/gửi yêu cầu. |
| **Nhân viên** | Chấm công và gửi yêu cầu cho chính mình. |

### 2.3. Luồng tổng thể (đọc từ trên xuống)

```
 ① CẤU HÌNH NỀN (Web)
    ├─ Cấu hình chung: ngưỡng đi trễ/về sớm, được vào sớm bao lâu, kỳ chốt công, bắt buộc chụp ảnh…
    ├─ Điểm chấm công theo chi nhánh: wifi (IP) hoặc GPS (tọa độ + bán kính)
    ├─ Danh sách NV linh động, NV không cần duyệt lịch, quỹ phép năm
    └─ Danh mục thưởng/phạt, ngày lễ, mức Rate theo khung giờ
                 ↓
 ② TẠO MẪU CA (Web): giờ vào/ra, nghỉ trưa, ngày áp dụng trong tuần, hệ số công, số lượt chấm, chi nhánh
                 ↓
 ③ XẾP LỊCH cho nhân viên (Web hoặc App)  →  ca ở trạng thái "Chờ duyệt" hoặc "Đã duyệt"
                 ↓
 ④ QUẢN LÝ DUYỆT LỊCH  →  "Đã duyệt"  (chỉ ca "Đã duyệt" mới chấm công được)
                 ↓
 ⑤ NHÂN VIÊN CHẤM CÔNG (App): vào → ra (lặp theo số lượt)  →  "Chờ xác nhận"
                 ↓
 ⑥ ĐIỀU CHỈNH (nếu có): đổi ca, xin trễ/sớm, nghỉ phép, tăng ca, chấm công hộ, thưởng/phạt
                 ↓
 ⑦ QUẢN LÝ XÁC NHẬN GIỜ  →  "Đã xác nhận"  (chốt giờ công + mã công + hệ số)
                 ↓
 ⑧ BÁO CÁO (Web/App)  →  ⑨ TÍNH LƯƠNG (Web)
```

---

## 3. Vòng đời của một ca làm việc

### 3.1. Các trạng thái

| Trạng thái | Ý nghĩa | Màu trên app |
|---|---|---|
| **Chờ duyệt** | Ca vừa được đăng ký/đổi/xin trễ-sớm/xin tăng ca và đang chờ quản lý duyệt. **Chưa chấm công được.** | Hồng |
| **Đã duyệt** | Ca hợp lệ, nhân viên chấm công được. | Xanh dương |
| **Không được duyệt** | Quản lý từ chối. | Đen |
| **Chờ xác nhận** | Nhân viên đã ra ca ở lượt cuối cùng, chờ quản lý xác nhận giờ. | Cam |
| **Đã xác nhận** | Quản lý đã chốt giờ công. Đây là trạng thái cuối. | Xanh lá |
| *(Chấm công hộ)* | Không phải trạng thái riêng — là **bộ đếm** số ca đã được quản lý chấm công hộ, hiển thị ở màn tổng hợp. | Tím |

### 3.2. Sơ đồ chuyển trạng thái

```
                 (NV không cần duyệt / QL hoặc Admin tạo)
   Tạo ca ───────────────────────────────────────────────┐
     │                                                   ▼
     │ (NV cần duyệt)                              ┌───────────┐
     ▼                                             │ ĐÃ DUYỆT  │
 ┌──────────┐   QL duyệt                           └─────┬─────┘
 │ CHỜ DUYỆT├────────────────────────────────────────────►│
 └────┬─────┘                                            │ NV ra ca ở lượt cuối
      │ QL từ chối                                       ▼
      ▼                                           ┌──────────────┐
 ┌───────────────┐                                │ CHỜ XÁC NHẬN │
 │KHÔNG ĐƯỢC DUYỆT│                               └──────┬───────┘
 └───────────────┘                                       │ QL xác nhận giờ
                                                         ▼
                                                  ┌──────────────┐
          Chấm công hộ có giờ ra (Web) ──────────►│ ĐÃ XÁC NHẬN  │
          Chấm công hộ / xác nhận (App) ─────────►└──────────────┘
```

**Các quy tắc chuyển trạng thái quan trọng:**

1. Ca do Admin/Quản lý thêm trên Web → **Đã duyệt** ngay (ca có số lượt chấm = 0 → **Đã xác nhận** luôn).
2. Ca nhân viên tự đăng ký trên App → **Chờ duyệt**, trừ khi nhân viên nằm trong danh sách "không cần duyệt lịch" → **Đã duyệt**.
3. Khi nhân viên gửi **đổi ca** hoặc **xin đi trễ/về sớm**, ca quay về **Chờ duyệt** (nếu cần duyệt). ⚠️ Trong thời gian này ca **biến mất khỏi thẻ chấm công** trên app → nhân viên không chấm công được cho tới khi quản lý duyệt.
4. Nhân viên ra ca ở **lượt cuối** → **Chờ xác nhận**, đồng thời quản lý nhận thông báo.
5. Quản lý xác nhận giờ (hoặc chấm công hộ trên App) → **Đã xác nhận**.
6. Chấm công hộ trên Web: nếu có nhập giờ ra → **Đã xác nhận** ngay.
7. Khi quản lý duyệt trên App bằng "Duyệt tất cả", duyệt đổi ca, duyệt đi muộn/về sớm: ca có số lượt chấm = 0 → **Chờ xác nhận**; ngược lại → **Đã duyệt**. Riêng nút duyệt từng ca đơn lẻ luôn đưa về **Đã duyệt**.
8. Sau khi **Đã xác nhận**, nếu nhân viên vẫn bấm chấm công thì dữ liệu ca không thay đổi nữa.
9. ⚠️ **Không có cơ chế tự đóng ca**: nếu nhân viên quên ra ca, ca đứng mãi ở "Đã duyệt" cho tới khi quản lý xử lý (chấm công hộ / xác nhận giờ).

### 3.3. Các "cờ" khác gắn trên ca

| Cờ | Giá trị | Ý nghĩa |
|---|---|---|
| Đánh dấu nghỉ | Trống | Ca làm bình thường |
| | Nghỉ có lương | Ca nghỉ nhưng vẫn được trả lương (nghỉ phép…) |
| | Nghỉ không lương | Ca nghỉ, không trả lương |
| Tăng ca | Có/Không | Ca OT, hiển thị viền đỏ |
| Đã chốt lương | Có/Không | Khóa một số thao tác (xem 11.7) |
| Đã duyệt xin trễ / xin sớm | Có/Không | Đơn xin đi trễ / về sớm đã được duyệt |
| Nơi làm việc | Chi nhánh / Cửa hàng / Khách hàng | Quyết định tọa độ hiển thị trên bản đồ của app |

---

## 4. Cấu hình nền (làm trước khi dùng)

Tất cả nằm trên Web, menu **Chấm công → Cấu hình chấm công**, gồm 5 tab.

### 4.1. Tab "Cấu hình chung"

Mỗi dòng có ô tick **bật/tắt** và ô nhập **giá trị**. Đơn vị (Phút hoặc Giờ) đã cài sẵn, không sửa được trên giao diện. Dòng bị **tắt** được coi như giá trị **0**.

| Nhãn trên màn hình | Tác dụng thực tế | Khi tắt / = 0 |
|---|---|---|
| **Tính là đi trễ khi thời gian chấm công vào sau … so với giờ bắt đầu** | (1) Ngưỡng để tô màu/báo cáo "Vào trễ". (2) **Chặn chấm công vào** nếu nhân viên trễ quá số phút này **và** chưa có đơn xin đi trễ được duyệt — app báo *"Quá thời gian checkin."* | Không chặn; trễ từ 1 phút đã bị coi là trễ |
| **Tính là nghỉ không lương khi thời gian chấm công vào sau …** | Báo cáo: vào trễ quá mức này → ca bị tính **nghỉ không lương** (chỉ trên báo cáo, không đổi dữ liệu ca). | Tắt quy tắc |
| **Tính là về sớm khi thời gian chấm công ra trước … so với giờ kết thúc** | Ngưỡng tô màu/báo cáo "Ra sớm". **Không chặn** việc ra ca. | Ra sớm từ 1 phút đã bị coi là sớm |
| **Tính là nghỉ không lương khi thời gian chấm công ra trước …** | Báo cáo: ra sớm quá mức này → **nghỉ không lương** (chỉ trên báo cáo). | Tắt quy tắc |
| **Được phép checkin trước** | **Chặn chấm công vào** nếu nhân viên vào sớm hơn số phút này so với giờ bắt đầu ca — app báo *"Chưa đến thời gian được checkin cho phép."* | Không giới hạn vào sớm |
| **Thời gian chốt công hàng tháng: Từ ngày … tháng trước — Đến ngày … tháng này** | Xác định kỳ công tháng (dùng ở app "Chấm công" tháng, báo cáo kỳ). | Mặc định 26 tháng trước → 25 tháng này |
| **Nhắc nhở chấm công trước và sau** | Chưa xác định — không tìm thấy nơi nào dùng. | — |
| **Bắt buộc chấm công với ảnh** | Bật → app bắt nhân viên **chụp selfie** khi vào/ra ca. | Chấm công ngay trên Home, không ảnh |
| **Cho phép Admin xác nhận ca làm việc** | Bật → tài khoản Admin được **xác nhận giờ làm** thay quản lý trực tiếp (trên Web). | Chỉ quản lý trực tiếp xác nhận |

**Kiểm tra khi lưu:**
- Chỉ nhận số nguyên ≥ 0.
- Nếu bật cả hai: ngưỡng "đi trễ" không được lớn hơn ngưỡng "trễ tính nghỉ không lương" → báo *"Số phút đi trễ phải nhỏ hơn số phút đi trễ tính nghỉ"*. Tương tự với về sớm. (Bằng nhau vẫn cho lưu.)

> ⚠️ Ô **"Đến ngày … tháng này"** không có ô tick bật/tắt, nên mỗi lần lưu hệ thống lại ghi nó là "tắt" → app luôn dùng mặc định **ngày 25**, giá trị nhập trên web không có tác dụng.
>
> ⚠️ "Bắt buộc chấm công với ảnh": trên giao diện chỉ có ô bật/tắt; giá trị bên trong bị ẩn. App chỉ bắt chụp ảnh khi **cả hai** đều là "bật" và giá trị = 1 → cần kiểm tra dữ liệu thật.

**Ví dụ:** Ca 08:00–17:00. Cấu hình: Được checkin trước 30 phút; Đi trễ sau 15 phút; Trễ tính nghỉ không lương sau 120 phút.
- 07:20 bấm vào → bị chặn (sớm hơn 07:30).
- 07:45 bấm vào → OK, đúng giờ.
- 08:10 → OK, trễ 10 phút nhưng trong ngưỡng 15 → vẫn tô màu "đúng giờ".
- 08:20 → **bị chặn** "Quá thời gian checkin." (nếu chưa có đơn xin trễ được duyệt).
- Nếu đã được duyệt xin trễ, vào lúc 10:30 → cho vào, nhưng báo cáo tô **nghỉ không lương** (trễ 150 phút > 120).

### 4.2. Tab "Danh sách cấu hình chấm công" (điểm chấm công wifi/GPS)

Mỗi chi nhánh có thể có **nhiều** điểm chấm công. Mỗi điểm là 1 trong 2 loại:

| Loại | Thông tin nhập | Cách hệ thống kiểm tra |
|---|---|---|
| **Wifi** | Tên wifi, Địa chỉ IP (IP public của mạng văn phòng), Ghi chú | Khớp khi **địa chỉ IP** mạng mà điện thoại đang dùng trùng với IP đã khai báo. Tên wifi **chỉ để hiển thị** trong thông báo lỗi, không dùng để so khớp. |
| **GPS** | Vĩ độ, Kinh độ, Bán kính cho phép (mét, mặc định **100 m**), Ghi chú | Khớp khi khoảng cách từ điện thoại tới tọa độ ≤ bán kính. |

**Quy tắc kiểm tra vị trí khi chấm công (cả vào và ra):**
1. Lấy tất cả điểm chấm công **đang hoạt động** của **chi nhánh làm việc của ca**.
2. Chi nhánh không có điểm nào → *"Chi nhánh chưa cấu hình chấm công."*
3. Ưu tiên wifi: IP khớp bất kỳ điểm wifi nào → **hợp lệ**.
4. Không khớp wifi → thử GPS: trong bán kính của bất kỳ điểm GPS nào → **hợp lệ**.
5. Không khớp gì → báo lỗi:
   - Có cả wifi và GPS: *"Vui lòng kết nối với wifi [tên wifi] hoặc đến gần văn phòng để check-in/checkout"*
   - Chỉ có GPS: *"Vui lòng đến gần văn phòng để check-in/checkout"*
   - Chỉ có wifi: *"Vui lòng kết nối với wifi [tên wifi] để check-in/checkout"*
6. Nhân viên **linh động** (mục 4.3) → bỏ qua toàn bộ bước trên.

Ràng buộc khi nhập: bắt buộc chọn chi nhánh; loại wifi bắt buộc tên + IP; tên wifi không trùng với điểm wifi khác (trên mọi chi nhánh). Không kiểm tra định dạng IP/tọa độ.

> ⚠️ Nút "Lấy địa chỉ IP từ wifi hiện tại" chỉ mở trang web whatismyipaddress.com — người cấu hình phải đứng trong mạng văn phòng để lấy đúng IP.
>
> ⚠️ Ca làm tại **khách hàng** vẫn bị kiểm tra theo điểm chấm công của **chi nhánh**, không theo vị trí khách hàng.

### 4.3. Tab "Cấu hình chấm công linh động"

- Danh sách nhân viên được **miễn kiểm tra wifi/GPS**.
- Nút **Thêm nhân viên** → chọn nhiều người → "Thêm nhân viên vào cấu hình".
- Biểu tượng thùng rác → bỏ người đó khỏi danh sách (quay về phải kiểm tra vị trí).

### 4.4. Tab "Danh sách nhân viên không cần duyệt lịch làm việc"

- Nhân viên trong danh sách: mọi yêu cầu trên app (đăng ký ca, thêm ca, đổi ca, xin trễ/sớm, tăng ca) được **tự động duyệt**.
- Thêm/bỏ tương tự tab linh động.

> ⚠️ Popup thêm nhân viên của tab này khi tìm kiếm/chuyển trang lại hiển thị danh sách theo tiêu chí của tab "linh động" → có thể ra sai danh sách. Popup cũng có thể hiện cả nhân viên đã nghỉ việc.

### 4.5. Tab "Cấu hình ngày phép còn lại"

- Xem quỹ phép năm của từng nhân viên: Tổng số ngày phép năm, Đã nghỉ, Còn lại, Năm.
- Quỹ mặc định khi hệ thống tự tạo: **12 ngày**.

> ⚠️ Nút sửa ngày phép **chưa hoạt động** (bấm không có tác dụng). Muốn sửa phải nhờ kỹ thuật.

### 4.6. Danh mục Thưởng – Phạt

Menu **Chấm công → Thưởng phạt**.
- Mỗi mục: **Loại** (Thưởng / Phạt), **Tên nội dung** (bắt buộc, tối đa 190 ký tự, không trùng — kể cả giữa Thưởng và Phạt), **Trạng thái** bật/tắt.
- Mục "hệ thống" không sửa/xóa được trên giao diện.
- Dùng khi gán thưởng/phạt cho từng ngày công (mục 11.5) → cộng/trừ vào lương.

### 4.7. Cấu hình thông báo chấm công

Màn **Cấu hình thông báo tự động → tab Chấm công**: bật/tắt gửi email, gửi thông báo app, sửa tiêu đề/nội dung, thời gian gửi.

> ⚠️ Không tìm thấy nơi nào thực sự dùng cấu hình này để gửi thông báo. Các thông báo chấm công thực tế (mục 14.2) đang **cố định trong hệ thống**, không chịu ảnh hưởng của màn này.

### 4.8. Ngày lễ

Quản lý ở module Lương (**Ngày lễ**). Ảnh hưởng:
- Lịch hiển thị ngày lễ chữ đỏ; app lịch sử chấm công có biểu tượng ngày lễ.
- Thêm ca **hàng loạt** tự **bỏ qua** ngày lễ; thêm ca **1 ngày** chỉ hỏi xác nhận *"Ca làm việc rơi vào ngày lễ bạn có muốn thêm ca làm việc cho nhân viên?"*.
- Lương: ngày lễ được tách nhóm, nhân đơn giá lễ.
- **Không chặn** chấm công vào ngày lễ.

### 4.9. Quy tắc Rate (dùng cho báo cáo Rate 1–4)

Bảng khung giờ theo từng thứ trong tuần, mỗi khung gán 1 mức Rate (1–4). Mô tả gợi ý trên màn hình: Rate 1 = T2–T6 00:00–17:59, Rate 2 = T2–T6 18:00–23:59, Rate 3 = Thứ 7, Rate 4 = Chủ nhật (chỉ là mô tả; giá trị thật theo dữ liệu cấu hình — chưa xác định). Không có màn hình cấu hình trên web (chỉ sửa trong dữ liệu).

---

## 5. Định nghĩa Ca làm việc

Menu **Chấm công → Ca làm việc**.

### 5.1. Thông tin của một mẫu ca

| Trường | Bắt buộc | Quy tắc |
|---|---|---|
| Tên ca | Có | Tối đa 50 ký tự, không trùng với ca chưa xóa. |
| Giờ bắt đầu / kết thúc | Có | Mặc định 08:00 / 17:00. **Giờ kết thúc ≤ giờ bắt đầu = ca qua đêm** (ví dụ 22:00–06:00). |
| Nghỉ trưa bắt đầu / kết thúc | Không | Nếu nhập thì phải nhập **đủ cả hai**, và nằm trong khung giờ làm. Thời gian nghỉ **không tính công**. |
| Số giờ làm tối thiểu tính đủ công | Có | Tự điền khi đổi giờ (= tổng giờ − nghỉ trưa). Không được lớn hơn số giờ làm của ca. |
| Hệ số công | Có | Lớn hơn 0 và ≤ 999. Mặc định 1. |
| Chi nhánh làm việc | Có | Chọn 1 hoặc nhiều chi nhánh được dùng ca này. |
| Thời gian hoạt động của ca | Có | Tick các thứ trong tuần ca được áp dụng (mặc định T2–T6). Ít nhất 1 ngày. |
| Số lần chấm công | Có | Số lượt vào–ra trong ca (mặc định 1, tối đa 5). **0 = không cần chấm công** (ca được coi như đã xác nhận). |
| Ghi chú | Không | |

**Giờ làm của ca** = (giờ kết thúc − giờ bắt đầu) − nghỉ trưa. Ví dụ 08:00–17:00 nghỉ 12:00–13:00 → 8 giờ.

### 5.2. Thao tác

| Thao tác | Quy tắc |
|---|---|
| Thêm / Sửa | Như bảng trên. ⚠️ Sửa mẫu ca **không cập nhật** các ca đã xếp trước đó cho nhân viên. |
| Bật / Tắt hoạt động | Ca bị tắt sẽ không còn trong danh sách chọn khi xếp lịch. Không kiểm tra ca đang được dùng. |
| Xóa | **Bị chặn** nếu ca đang được dùng cho ngày từ hôm nay trở đi ở trạng thái Chờ duyệt / Đã duyệt / Chờ xác nhận → *"Ca làm việc đã được sử dụng, bạn không thể xoá"*. Ca chỉ dùng trong quá khứ vẫn xóa được. |

### 5.3. Ca hệ thống "OT"

Hệ thống có một mẫu ca đặc biệt mã **OT** dùng cho mọi ca tăng ca. Mẫu này cũng có cấu hình thứ trong tuần — app chỉ cho đăng ký tăng ca vào những thứ được bật trên mẫu này.

---

## 6. Xếp lịch làm việc cho nhân viên

Có nhiều cách tạo ca cho nhân viên. Tất cả đều sinh ra các "ca của nhân viên theo ngày".

### 6.1. Trên Web — Màn "Lịch làm việc" (theo nhân viên / theo ca)

Menu **Chấm công → Lịch làm việc theo nhân viên**. Lọc theo Năm, Theo tuần/Theo tháng, Tuần/Tháng, Ca làm, Chi nhánh (trực thuộc của NV), Phòng ban, Nhân viên, Trạng thái nhân viên. Có tab **"Theo ca"** để xem theo hàng ca.

| Cách thêm | Mở từ | Quy tắc |
|---|---|---|
| **Thêm ca cho 1 nhân viên, 1 ngày** | Nút "+" ở ô trống, hoặc "Thêm ca làm việc" trong menu ô | Chỉ hiện ca đang hoạt động **và áp dụng cho thứ đó**. Chọn được nhiều ca một lúc; mỗi ca chọn chi nhánh, có/không tăng ca, tính tăng ca theo **Ca** hoặc **Giờ**, hệ số công (> 0). Các ca chọn cùng lúc **không được trùng giờ** nhau và **không trùng** với ca đã có của nhân viên → *"Thời gian làm việc đã trùng với lịch khác"*. Ngày lễ → hỏi xác nhận. Không chặn ngày quá khứ. Ca tạo ra ở trạng thái **Đã duyệt**. |
| **Thêm ca cho 1 nhân viên cả tuần/tháng** | Menu "Thêm ca" cạnh tên nhân viên | Áp dụng cho mọi ngày trong tuần/tháng đang xem, **tự bỏ qua**: ngày ca không áp dụng, ngày nhân viên đã có ca trùng giờ, ngày lễ. Không còn ngày phù hợp → *"Không có ca làm việc phù hợp để thêm"*. ⚠️ Luôn dùng **năm hiện tại** bất kể bộ lọc Năm. ⚠️ Chức năng có khả năng đang **lỗi** (cần kiểm thử). |
| **Thêm nhân viên vào ca** | Tab "Theo ca" → menu ca → "Thêm nhân viên" | Chọn nhiều nhân viên, mỗi người chọn chi nhánh, tăng ca, hệ số công. Áp dụng cho khoảng ngày đang xem, bỏ qua thứ không áp dụng / trùng giờ / ngày lễ. |
| **Làm thêm giờ (OT)** | Menu ô ca → "Làm thêm giờ" | Xem mục 10.3. |
| **Ca linh động** | (Đang ẩn khỏi giao diện) | Không dùng. |

**Mục khác trong menu ô ca trên Web:** Chi tiết, Chỉnh sửa, Duyệt lịch làm việc, Confirm working time (xác nhận giờ), Chấm công hộ, Nghỉ có lương, Nghỉ không lương, Thêm công việc, Làm thêm giờ, Xóa — điều kiện hiển thị xem Phần 11.

### 6.2. Trên Web — Màn "Lịch làm việc mẫu / Phân ca" (lặp lại theo khoảng ngày)

Cho phép tạo một "lịch" áp dụng cho nhiều nhân viên trong khoảng ngày.

- Nhập: Tên lịch (không trùng), Ngày bắt đầu, Ngày kết thúc (bắt đầu phải **nhỏ hơn** kết thúc), danh sách ca (mỗi ca chọn chi nhánh, tăng ca), danh sách nhân viên.
- Các ca trong lịch không được trùng giờ nhau ở cùng thứ → *"Ca làm việc không hợp lệ"*.
- Hệ thống sinh ca cho **mỗi ngày × mỗi ca × mỗi nhân viên**, bỏ qua thứ ca không áp dụng; trùng với lịch khác → *"Thời gian làm việc đã trùng với lịch khác"*.
- **Sửa lịch:** chỉ sinh lại các ngày **sau hôm nay**; dữ liệu quá khứ giữ nguyên. ⚠️ Các ca tương lai bị xóa và tạo lại kể cả khi đã được chỉnh sửa/duyệt; rút ngắn ngày kết thúc **không xóa** ca thừa phía sau.
- **Xóa lịch:** bị chặn nếu đã có ai chấm công vào; nếu không, xóa toàn bộ ca của lịch.

> ⚠️ Màn này hiện **không có đường dẫn** từ menu (đường dẫn đã bị ẩn) và ca sinh ra từ đây không mang hệ số công, giờ làm, số lượt chấm, trạng thái → cần xác nhận còn dùng hay không.

### 6.3. Trên App — Nhân viên tự đăng ký

| Màn hình | Cách dùng | Quy tắc |
|---|---|---|
| **Lịch làm việc (LLV) → nút "+" → "Thêm ca"** | Chọn 1 ngày trong tuần đang xem, chọn Ca, Chi nhánh, có thể ghi đè giờ bắt đầu/kết thúc | Chưa chọn ca → *"Bạn chưa chọn Ca"*. Giờ kết thúc ≤ giờ bắt đầu → *"Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu"*. Chỉ hiện ca áp dụng cho thứ đó. Trùng giờ → *"Thời gian làm việc đã trùng với lịch khác"*. Trạng thái: Chờ duyệt (hoặc Đã duyệt nếu NV không cần duyệt). |
| **LLV tuần trống → "Thêm" → "Thêm lịch làm việc"** | Hệ thống lấy **lịch của tuần gần nhất** đã có, bỏ các ca tăng ca, dời sang tuần đang xem. Nhân viên có thể sửa từng dòng, nhân bản sang ngày khác, rồi "Lưu". | Danh sách rỗng → *"Vui lòng nhập thời gian làm việc"*. Mọi ca gửi lên ở trạng thái Chờ duyệt (hoặc tự duyệt). |

Khi nhân viên tạo ca (cần duyệt), quản lý nhận thông báo *"Đang có lịch làm việc ngày … của … đang chờ phê duyệt."*

### 6.4. Trên App — Quản lý thêm ca cho nhân viên

Màn **Báo cáo lịch làm việc nhân viên (theo tuần)** → ô trống hoặc nút "+" → **Thêm ca**: chọn Ca, Chi nhánh (mặc định chi nhánh của người quản lý), ghi đè giờ (tuỳ chọn). Quy tắc như 6.3.

### 6.5. Ca qua đêm

- Ca có giờ kết thúc nhỏ hơn giờ bắt đầu được coi là qua đêm; ngày kết thúc = ngày hôm sau.
- Trên app, ca qua đêm được coi là "ca hôm nay" ở **cả hai ngày**.
- ⚠️ Một số kiểm tra (trùng giờ, nghỉ trưa, ngày kết thúc khi sinh lịch hàng loạt) **chưa xử lý đúng** ca qua đêm.

---

## 7. Duyệt lịch làm việc

### 7.1. Trên Web

- Nút **"Duyệt lịch làm việc"** trong menu ô ca (màn theo nhân viên, chế độ tuần) chỉ hiện khi: người đăng nhập **là quản lý trực tiếp** của nhân viên, ca **không** đánh dấu nghỉ, ca đang **Chờ duyệt**.
- Xác nhận *"Bạn có muốn duyệt lịch làm việc không?"* → ca chuyển **Đã duyệt**, nhân viên nhận thông báo.
- Web **không có** nút từ chối.

### 7.2. Trên App (quản lý) — "LLV nhân viên"

**Bước 1 – Danh sách lịch làm việc (theo tuần):**
- Chọn tuần; lọc theo trạng thái (Tất cả, Chờ duyệt, Đã duyệt, Chờ xác nhận, Đã xác nhận, Chấm công hộ — chọn nhiều), lọc chi nhánh, tìm tên.
- Mỗi nhân viên hiển thị: số ca theo từng trạng thái, giờ dự kiến, giờ thực tế, giờ được xác nhận. Cuối màn: tổng giờ ước tính và tổng giờ thực tế.
- Chỉ hiện nhân viên **do mình quản lý trực tiếp**.

**Bước 2 – Lịch tuần của 1 nhân viên:**
- Lọc theo chi nhánh, trạng thái (mặc định "Chờ duyệt"; nếu không còn ca chờ duyệt tự chuyển "Tất cả"). Vuốt ngang để chuyển sang nhân viên trước/sau.
- Nút **"Duyệt tất cả"** (khi đang lọc Chờ duyệt): duyệt một lần mọi ca chờ duyệt đang hiển thị — đồng thời duyệt luôn các đơn đổi ca, đi muộn, về sớm kèm theo (với số phút đúng như nhân viên xin). Nhân viên nhận 1 thông báo *"Lịch làm việc tuần … của bạn đã được phê duyệt."*
- Nút **"Xác nhận tất cả"** (khi đang lọc Chờ xác nhận): xác nhận mọi ca chờ xác nhận với giờ = giờ thực tế hệ thống đã tính.
- Trên từng thẻ ca: nút **"Đổi ca"** và **"Chấm công thủ công"** (điều kiện ở mục 11).

**Bước 3 – Chi tiết 1 ca:** nút ở cuối màn hình được chọn theo thứ tự ưu tiên:

| Thứ tự | Điều kiện | Nút | Mở ra |
|---|---|---|---|
| 1 | Ca **Chờ xác nhận** | Xác nhận thời gian làm việc | Màn xác nhận giờ (mục 11.1) |
| 2 | Ca **Chờ duyệt** và có đơn **đổi ca** chưa duyệt | Duyệt lịch làm việc | Màn duyệt đổi ca (mục 10.1) |
| 3 | Ca Chờ duyệt và có đơn **về sớm** hoặc **đi muộn** chưa duyệt | Duyệt lịch làm việc | Màn duyệt đi muộn/về sớm (mục 10.2) |
| 4 | Ca Chờ duyệt, không có đơn nào | Duyệt lịch làm việc | Duyệt luôn → Đã duyệt |
| 5 | Ca **Đã duyệt** và ngày đã qua | Chấm công hộ (màu tím) | Màn chấm công hộ (mục 11.2) |
| — | Khác | Không có nút | |

> ⚠️ App quản lý **chưa có nút từ chối** (nút "Không được duyệt" đang ẩn).

---

## 8. Nhân viên chấm công hằng ngày trên app

### 8.1. Thẻ chấm công ở màn hình Home

- Hiện nếu nhân viên có quyền chấm công (mã quyền TI000001).
- Hệ thống tìm **ca của hôm nay** thỏa: **Đã duyệt**, không đánh dấu nghỉ, hôm nay nằm trong khoảng ngày bắt đầu–ngày kết thúc của ca. Có nhiều ca → lấy ca có **giờ bắt đầu sớm nhất**.
- Không có ca → **ẩn thẻ**.
- Thẻ hiển thị: tên ca, "Thời gian: giờ vào – giờ ra", và từng lượt đã chấm "Lần 1: 08:02 – 12:01", "Lần 2: …".
- Nút:

| Tình huống | Nút |
|---|---|
| Chưa vào ca | **Giờ vào** (cam) |
| Đã vào, chưa ra | **Giờ ra** (đỏ) |
| Đã vào và ra | Không còn nút |

> ⚠️ Nhân viên có **2 ca trong cùng ngày**: thẻ luôn hiển thị ca sớm nhất, kể cả khi ca đó đã xong → không chuyển sang ca thứ 2 để chấm.

### 8.2. Hai cách chấm công

| Cấu hình "Bắt buộc chấm công với ảnh" | Cách chấm |
|---|---|
| **Tắt** | Bấm nút trên Home → app lấy vị trí GPS → gửi ngay. Thành công: *"Chấm công vào thành công"* / *"Chấm công ra thành công"*. |
| **Bật** | Bấm nút → mở màn **Giờ vào / Giờ ra** (bản đồ + khung ảnh) → bấm **"Chụp ảnh"** → chụp selfie → app đóng dấu thông tin lên ảnh → tải ảnh lên → gửi chấm công. |

**Màn chụp ảnh:**
- Chỉ dùng **camera trước**, không cho chọn ảnh có sẵn.
- Ảnh được đóng dấu (watermark): *Check-in/Check-out: [họ tên] — Time: [ngày giờ] — Location: [tọa độ] — Distance: [khoảng cách tới điểm làm việc] m — Address: [địa chỉ]*.
- Bản đồ hiển thị vị trí của tôi và điểm làm việc.
- Nút **"Làm lại"**: chụp lại và gửi lại (ghi đè lần vừa chấm, tăng bộ đếm số lần thử lại). Nút **"Thoát"**.
- Sau khi thành công hiển thị "Thời gian checkin/checkout" theo giờ máy chủ trả về.

**Quyền & vị trí:**
- Định vị tắt → *"Vui lòng bật Dịch vụ Định vị…"*; chưa cho quyền → hộp thoại giải thích mục đích (chấm công, theo dõi lộ trình) → xin quyền.
- Không lấy được vị trí → *"Không thể lấy vị trí hiện tại. Vui lòng thử lại."*
- Ở chế độ chụp ảnh, nhân viên **linh động** không cần GPS. Ở chế độ không ảnh, **luôn** cần GPS.
- Mất mạng → *"Kiểm tra kết nối mạng!"*. **Không có chế độ offline** (không lưu tạm để gửi sau).

### 8.3. Trình tự kiểm tra khi bấm "Giờ vào"

| # | Kiểm tra | Ở đâu | Nếu sai |
|---|---|---|---|
| 1 | Ngày của ca phải là **ngày hôm nay** trên điện thoại | App | *"Ngày làm việc không hợp lệ"* |
| 2 | Không vào **sớm hơn** mức "Được phép checkin trước" | Máy chủ | *"Chưa đến thời gian được checkin cho phép."* |
| 3 | Không vào **trễ hơn** mức "Tính là đi trễ…" — trừ khi đã có đơn **xin đi trễ được duyệt** | Máy chủ | *"Quá thời gian checkin."* |
| 4 | Vị trí đúng wifi/GPS của chi nhánh (trừ NV linh động) | Máy chủ | Các câu báo lỗi ở mục 4.2 |
| 5 | Ghi nhận giờ vào, số phút trễ (= giờ vào − giờ bắt đầu ca, **không trừ** ân hạn), thông tin thiết bị/ảnh/vị trí | Máy chủ | — |
| 6 | Gửi thông báo cho quản lý: *"[Tên] đã checkin vào lúc [giờ] của ca [tên ca]"* | Máy chủ | — |

**Không kiểm tra:** thiết bị lạ, vị trí giả lập (fake GPS), ngày lễ, đã chấm vào rồi hay chưa (gửi lại sẽ ghi đè), nhận diện khuôn mặt.

### 8.4. Trình tự khi bấm "Giờ ra"

| # | Kiểm tra / xử lý |
|---|---|
| 1 | Ngày của ca phải là hôm nay (app) |
| 2 | Vị trí đúng wifi/GPS (như giờ vào) |
| 3 | **Không giới hạn giờ ra** (ra lúc nào cũng được, kể cả rất sớm) |
| 4 | Ghi số phút về sớm (= giờ kết thúc ca − giờ ra, **không trừ** ân hạn) |
| 5 | Tính giờ công của lượt = giờ ra − giờ vào − phần trùng với giờ nghỉ trưa |
| 6 | Nếu ca còn lượt tiếp theo → chuyển sang lượt kế. Nếu là lượt cuối → ca chuyển **Chờ xác nhận**, quản lý nhận thông báo *"Đang có lịch làm việc ngày … của … đang chờ xác nhận."* |

### 8.5. Ca nhiều lượt — ví dụ

Ca gãy 08:00–20:00, nghỉ trưa 12:00–13:00, **Số lần chấm công = 2**.

| Lượt | Vào | Ra | Giờ công lượt |
|---|---|---|---|
| 1 | 07:55 | 12:05 | 4 giờ 5 phút trừ 5 phút trùng nghỉ trưa = **4,0 giờ** |
| 2 | 13:00 | 20:00 | **7,0 giờ** |
| **Tổng giờ thực tế** | | | **11,0 giờ** → ca chuyển Chờ xác nhận |

> ⚠️ Quy tắc chặn "vào trễ" ở lượt 2 vẫn so với **giờ bắt đầu ca** (08:00), nên nếu bật ngưỡng đi trễ thì lượt 2 lúc 13:00 có thể bị chặn *"Quá thời gian checkin."* — trừ khi ca có đơn xin đi trễ được duyệt.

### 8.6. Giờ công thực tế

- = Tổng giờ công của tất cả các lượt.
- **Không** cắt theo giờ chuẩn của ca, **không** làm tròn.
- Đây chỉ là con số gợi ý; con số dùng cho báo cáo/lương là **giờ được xác nhận** do quản lý chốt (mục 11.1).

---

## 9. Đi trễ, về sớm, nghỉ không lương — hệ thống đánh giá thế nào

### 9.1. Hai con số khác nhau

| | Con số **lưu lại** khi chấm công | Cách **đánh giá trên màn hình/báo cáo** |
|---|---|---|
| Đi trễ | Số phút = giờ vào − giờ bắt đầu ca (tính cả trễ 1 phút) | Chỉ coi là **trễ** nếu vượt ngưỡng "Tính là đi trễ…" |
| Về sớm | Số phút = giờ kết thúc ca − giờ ra | Chỉ coi là **sớm** nếu vượt ngưỡng "Tính là về sớm…" |
| Nghỉ không lương do trễ/sớm | Không lưu | Vào sau ngưỡng "trễ tính nghỉ không lương" hoặc ra trước ngưỡng "sớm tính nghỉ không lương" (khi ngưỡng > 0) |

> ⚠️ Vì vậy có sự **không nhất quán**: màn tô màu có thể báo "đúng giờ" (trễ 10 phút trong ngưỡng 15), nhưng các cột **"Số lần đi trễ"** trên Bảng chấm công và file Excel lại đếm **mọi** ca có trễ > 0 phút, kể cả trong ngưỡng và kể cả đã được duyệt xin trễ.

### 9.2. Quy tắc phân loại ca (dùng chung cho tô màu và báo cáo trạng thái)

**Ca ngày tương lai:** "Chưa đến ca" — trừ khi đã đánh dấu nghỉ có lương / không lương.

**Ca hôm nay** (xét lần lượt, điều sau ghi đè điều trước):
1. Mặc định: Đúng giờ.
2. Thiếu vào hoặc thiếu ra: **Chưa vào/ra ca**.
3. Đánh dấu nghỉ có lương / không lương → theo đánh dấu.
4. Vào sau (giờ bắt đầu + ngưỡng trễ) hoặc ra trước (giờ kết thúc − ngưỡng sớm): **Vào trễ/Ra sớm**.
5. Vào sau (giờ bắt đầu + ngưỡng trễ tính nghỉ) hoặc ra trước (giờ kết thúc − ngưỡng sớm tính nghỉ): **Nghỉ không lương**.

**Ca ngày đã qua:**
1. Đã đánh dấu nghỉ có lương / không lương → theo đánh dấu.
2. **Không vào và không ra** → **Nghỉ không lương** (vắng mặt).
3. Có vào nhưng thiếu ra (hoặc ngược lại) → **Chưa vào/ra ca**.
4. Rồi áp dụng bước 4–5 như ca hôm nay; không trễ, không sớm → **Đúng giờ**.

### 9.3. Ví dụ

Ca 08:00–17:00. Ngưỡng: đi trễ 15', trễ tính nghỉ 120', về sớm 10', sớm tính nghỉ 60'.

| Vào | Ra | Kết quả |
|---|---|---|
| 08:05 | 17:00 | Đúng giờ (lưu trễ 5 phút) |
| 08:20 | 17:00 | Vào trễ (nếu được phép vào — xem 4.1) |
| 07:58 | 16:55 | Đúng giờ (sớm 5' < 10') |
| 08:00 | 16:30 | Ra sớm |
| 08:00 | 15:30 | Nghỉ không lương (sớm 90' > 60') |
| 08:00 | — (ngày đã qua) | Chưa vào/ra ca |
| — | — (ngày đã qua) | Nghỉ không lương |

### 9.4. Đơn xin đi trễ/về sớm được duyệt có tác dụng gì?

| Nơi | Tác dụng |
|---|---|
| Chấm công vào trên app | **Không bị chặn** "Quá thời gian checkin." |
| Màn tô màu, Bảng chấm công, Excel, báo cáo app | **Không** có tác dụng — vẫn bị tính trễ/sớm |
| Màn Lịch sử chấm công (Web) | Cột lý do ghi "… Đã duyệt đi trễ"; lọc "Đi đúng giờ" coi như đúng giờ |
| Tính lương | Ca được duyệt **không** bị tính vào số lần/số phút đi trễ, về sớm |

---

## 10. Các yêu cầu của nhân viên

### 10.1. Đổi ca

**Nhân viên gửi (App → LLV → thẻ ca → "Đổi ca làm"):**
- Nút hiện khi: ca chưa ra ca, đang Đã duyệt hoặc Chờ duyệt, ngày làm ≥ hôm nay, và còn ít nhất một loại đơn (đổi ca, hoặc đi muộn/về sớm) chưa được quản lý duyệt.
- Nhập: Chi nhánh, **Ca mới** (bắt buộc — *"Vui lòng chọn ca làm việc"*), Ghi chú, Ghi đè thời gian (tuỳ chọn), Hình ảnh.
- Danh sách ca chỉ gồm ca áp dụng cho thứ đó và thuộc chi nhánh đã chọn.

**Hệ thống xử lý:**
- Tự duyệt nếu nhân viên "không cần duyệt lịch" **hoặc** người gửi là quản lý của nhân viên; ngược lại ca về **Chờ duyệt** và quản lý nhận thông báo.
- Cập nhật giờ, hệ số công, giờ làm theo ca mới (hoặc theo giờ ghi đè; giờ ghi đè trùng ca khác → *"Thời gian làm việc đã trùng với lịch khác"*).
- Ca mới mã **KL** → đánh dấu nghỉ không lương; mã **P** hoặc **1/2** → nghỉ có lương.
- Ca cũ là phép (P = 1 ngày, 1/2 = 0,5 ngày) đã duyệt → **hoàn lại quỹ phép**.
- ⚠️ Nếu ca **đã chấm công vào**, đổi ca sẽ **xóa toàn bộ dữ liệu chấm công** của ca (nhân viên phải chấm lại).

**Quản lý duyệt (App → Chi tiết ca → "Duyệt lịch làm việc" → màn duyệt đổi ca):**
- Hiển thị ca cũ; chọn ca được duyệt (mặc định ca nhân viên xin, có thể chọn ca khác).
- Nếu ca **còn cả** đơn đi muộn **và** đơn về sớm chưa duyệt → sau khi duyệt đổi ca, app chuyển tiếp sang màn duyệt đi muộn/về sớm.
- Nhân viên nhận thông báo *"Lịch làm việc ngày … của bạn đã được phê duyệt đổi ca."*

**Quản lý đổi ca hộ (App → "Đổi ca" trên thẻ ca, hoặc từ Báo cáo tuần):** chọn chi nhánh, ca, ghi đè giờ → "Chấp nhận". Được tự duyệt; nhân viên nhận thông báo *"Đã đổi ca lịch làm việc ngày … của bạn thành …"*. Điều kiện hiện nút: ca chưa ra ca, đang Đã duyệt/Chờ duyệt, ngày ≥ hôm nay. ⚠️ Không kiểm tra giờ kết thúc > giờ bắt đầu.

### 10.2. Xin đi muộn / về sớm

**Nhân viên gửi (App → LLV → "Đi muộn / Về sớm"):**
- Nhập **Số phút đi muộn** + ghi chú và/hoặc **Số phút về sớm** + ghi chú. Nút "−" giảm 1, "+" tăng 5.
- Cả hai đều 0 → *"Vui lòng nhập phút hợp lệ"*.
- Ca chuyển **Chờ duyệt** (trừ khi tự duyệt) — ⚠️ trong thời gian chờ, ca không hiện ở thẻ chấm công.
- Quản lý nhận thông báo *"Đang có yêu cầu xin đi trễ / về sớm ngày … của … đang chờ phê duyệt."*

**Quản lý duyệt (App → màn "Duyệt lịch làm việc" đi muộn/về sớm):**
- Có thể **sửa số phút** được duyệt (để trống = duyệt đúng số xin). Nhập 0 = không duyệt loại đó.
- Bấm "Phê duyệt" → ca trở lại Đã duyệt (hoặc Chờ xác nhận nếu ca không cần chấm công). Nhân viên nhận thông báo.

**Duyệt trên Web (màn Lịch sử chấm công):** với ca đã có trễ/sớm, chọn "Duyệt đi trễ" / "Duyệt về sớm" (xem 12.4).

**Đơn nghỉ phép loại "Xin đi trễ" / "Xin về sớm"** (module Nghỉ phép trên Web): khi đơn được duyệt cũng đánh dấu ca là đã duyệt trễ/sớm.

**Tác dụng của việc duyệt:** xem 9.4.

### 10.3. Làm thêm giờ (OT)

**Nhân viên đăng ký (App → LLV → "Làm thêm giờ"):**
- Nút hiện khi ca Đã duyệt/Chờ duyệt và ngày ≥ hôm nay.
- Nhập: **Địa điểm làm việc** (mặc định chi nhánh của ca), **Thời gian bắt đầu** (mặc định = giờ kết thúc ca gốc), **Giờ kết thúc**, ô **"Không cần chấm công"**.
- Kiểm tra: thiếu địa điểm/bắt đầu/kết thúc → báo thiếu; kết thúc ≤ bắt đầu → *"Ngày/giờ kết thúc phải lớn hơn ngày/giờ bắt đầu"*; trùng giờ → *"Thời gian làm việc đã trùng với lịch khác"*; thứ đó không được bật trên mẫu ca OT → *"Ngày làm việc không hợp lệ"*.
- Hệ thống tạo **một ca tăng ca riêng**: tính theo giờ, giờ làm = kết thúc − bắt đầu (không trừ nghỉ trưa), hệ số công = 1, mã công OT.
  - Tick **"Không cần chấm công"** → ca coi như đã vào/ra, giờ được xác nhận = số giờ đăng ký.
  - Không tick → nhân viên phải tự chấm 1 lượt vào/ra.
- Trạng thái Chờ duyệt (trừ khi tự duyệt); quản lý nhận thông báo *"Đang có lịch làm việc thêm giờ ngày … của … đang chờ phê duyệt."*

**Admin tạo trên Web (menu ô ca → "Làm thêm giờ"):**
- Nhập Vị trí làm, **Hệ số công** (tối thiểu 1), Bắt đầu (mặc định = giờ kết thúc ca gốc + 1 phút), Kết thúc, "Không cần chấm công".
- Bắt đầu OT không được sớm hơn giờ kết thúc ca gốc; không trùng ca khác.
- ⚠️ Do lỗi kỹ thuật, ca OT tạo trên Web **không lưu được trạng thái** và một số thông tin khác (trạng thái sẽ theo mặc định của dữ liệu — chưa xác định).

### 10.4. Nghỉ phép (module Nghỉ phép trên Web)

- Nhân viên tạo đơn, **chọn các ca** muốn nghỉ (sáng/chiều = 0,5 ngày, cả ngày = 1).
- Hệ thống kiểm tra hạn mức phép của loại nghỉ; gửi thông báo người duyệt.
- **Duyệt tối đa 3 cấp** (cấp 1 = quản lý trực tiếp; cấp 2, 3 theo cấu hình loại phép).
- Khi duyệt xong, từng ca được cập nhật:
  - Loại **Xin đi trễ** → ca được đánh dấu đã duyệt trễ.
  - Loại **Xin về sớm** → ca được đánh dấu đã duyệt sớm.
  - Loại khác → ca đánh dấu **nghỉ có lương** hoặc **nghỉ không lương** tùy cấu hình loại phép.
- Khi **từ chối** → ca bị đánh dấu **nghỉ không lương** (với loại nghỉ thường), hoàn lại ngày phép.
- Trên lịch, ô ca có biểu tượng đơn phép: ✔ xanh (được chấp nhận), ✖ đỏ (không được chấp nhận), ⏱ vàng (chờ duyệt).

> ⚠️ Lỗi: ca bị cập nhật **ngay khi mới duyệt cấp 1**, không đợi đủ các cấp.
> ⚠️ Duyệt đơn phép **trên app** **không** cập nhật ca (ca không được đánh dấu nghỉ).
> ⚠️ Biểu tượng đơn phép trên màn Lịch làm việc theo nhân viên luôn hiện "không được chấp nhận" (lỗi hiển thị).
> ⚠️ Sửa/xóa đơn phép không gỡ đơn khỏi ca.

---

## 11. Quản lý xử lý sau ca

### 11.1. Xác nhận giờ làm việc

**Trên App** (Chi tiết ca → "Xác nhận thời gian làm việc", hoặc "Xác nhận tất cả"):
- Màn **"Thời gian làm việc"**: ô **Thời gian làm việc thực tế** (mặc định = giờ thực tế hệ thống tính; nếu chưa có = giờ chuẩn của ca), ô **Chấm công** chọn mã công (`1`, `1/2`, `P`, `P/2`, `OFF`, `KL` — mỗi mã kèm hệ số; mặc định "1").
- "Xác nhận" → ca **Đã xác nhận**, lưu giờ được xác nhận, mã công, hệ số công. Nhân viên nhận *"Lịch làm việc ngày … của bạn đã được xác nhận giờ làm."*
- Không giới hạn số giờ nhập.

**Trên Web** (menu ô ca → "Confirm working time"):
- Hiện khi ca **Chờ xác nhận**, không đánh dấu nghỉ, và người dùng là quản lý trực tiếp **hoặc** Admin (khi bật cấu hình 4.1).
- Nhập "Giờ làm việc thực tế" (mặc định = giờ thực tế) → **Đã xác nhận**. (Web không chọn mã công.)
- Web có kiểm tra quyền: không phải quản lý/Admin → *"Bạn không có quyền xác nhận ca làm việc này"*.

### 11.2. Chấm công hộ / Chấm công thủ công

Dùng khi nhân viên quên chấm.

| | Web — "Chấm công hộ" | App — "Chấm công hộ" / "Chấm công thủ công" |
|---|---|---|
| Điều kiện hiện | Ca **Đã duyệt**, ngày ≤ hôm nay, chưa chốt lương, còn thiếu vào hoặc ra, không đánh dấu nghỉ | "Chấm công hộ": ca Đã duyệt và ngày đã qua. "Chấm công thủ công": ca Đã duyệt, chưa ra ca, đã qua giờ kết thúc ca |
| Nhập gì | Giờ vào ca (mặc định giờ bắt đầu ca), Giờ ra ca (mặc định giờ kết thúc; để trống nếu chưa ra) | Giờ làm thực tế + mã công (như 11.1) |
| Giờ vào/ra được ghi | Theo giờ nhập | **Bằng đúng giờ bắt đầu / kết thúc ca chuẩn** |
| Kết quả | Có giờ ra → **Đã xác nhận**, giờ = ra − vào (⚠️ không trừ nghỉ trưa). Không có giờ ra → chỉ ghi giờ vào | **Đã xác nhận** |
| Ghi lịch sử | Lưu giá trị cũ/mới của giờ vào/ra | Lưu giá trị cũ/mới |
| Thông báo NV | *"Lịch làm việc ngày … của bạn đã được chấm công hộ."* | như bên trái |

> ⚠️ Chấm công hộ **ghi đè** cả giờ vào nhân viên đã tự chấm.
> ⚠️ Chấm công hộ trên Web **không tính** số phút đi trễ/về sớm.
> ⚠️ Chấm công hộ không kiểm tra wifi/GPS (đúng với nghiệp vụ).

### 11.3. Nghỉ có lương / Nghỉ không lương (đánh dấu thủ công trên Web)

- Hiện khi: ca chưa chốt lương, **chưa vào và chưa ra**, có quyền.
- "Nghỉ có lương" → ca tô màu nghỉ có lương; "Nghỉ không lương" → tô màu nghỉ không lương.
- Sau khi đánh dấu, ca **không còn** hiện các nút Chấm công hộ / Duyệt / Xác nhận.
- Không ghi lịch sử thay đổi, không trừ quỹ phép.

### 11.4. Chỉnh sửa ngày làm việc (Web)

- Hiện khi: ngày ≥ hôm nay, chưa chốt lương, **chưa vào ca**.
- Sửa được: Vị trí làm (chi nhánh), Hệ số công (chỉ với ca tăng ca), Giờ tối thiểu, Thời gian bắt đầu, Thời gian kết thúc.
- Kiểm tra: bắt đầu phải trước kết thúc; không trùng ca khác; ca có nghỉ trưa thì tổng giờ không quá 24.

### 11.5. Thưởng / Phạt theo ngày (Web)

- Trong popup **Chi tiết ngày làm việc** → tab **Thưởng** / **Phạt vi phạm** → "Thêm hình thức thưởng/phạt": chọn loại (từ danh mục 4.6) + **Mức áp dụng** (số tiền).
- Có thể xóa. Các khoản này được **cộng (thưởng) / trừ (phạt)** vào lương kỳ đó.
- ⚠️ Tắt/xóa một mục trong danh mục **không** loại bỏ các khoản đã gán.

### 11.6. Xóa ca của nhân viên (Web)

- Menu ô ca → "Xóa" → *"Bạn có muốn xóa không?"*.
- ⚠️ **Không kiểm tra** ca đã chấm công hay đã chốt lương — xóa được cả ca đã có dữ liệu chấm công.
- ⚠️ Xóa ca phép (P, 1/2) lại **trừ thêm** phép thay vì hoàn trả.
- Xóa nhân viên khỏi ca ở màn "Theo ca": **bị chặn** nếu nhân viên đã chấm vào/ra trong khoảng ngày đó.

### 11.7. Chốt lương khóa những gì?

Khi bảng lương được chốt, các ca trong kỳ:
- **Bị khóa:** Chỉnh sửa, Chấm công hộ, Nghỉ có/không lương.
- **Không bị khóa:** Xóa ca, Làm thêm giờ, Thưởng/phạt, duyệt trễ/sớm. ⚠️

### 11.8. Popup "Chi tiết ngày làm việc" (Web)

Chỉ xem: Tên NV, Ca, Giờ làm, Hệ số công, Ngày, Vị trí, Giờ tối thiểu, Tăng ca, Tính tăng ca theo. Các tab: **Danh sách công việc** (công việc trong ngày), **Thưởng**, **Phạt vi phạm**, **Lịch sử chấm công** (giờ vào/ra hiện tại + nguồn: 📱 nhân viên tự chấm / 👤 admin chấm hộ; dòng gạch ngang = giá trị cũ trước khi bị sửa).

---

## 12. Tính công, báo cáo

### 12.1. Web — "Bảng chấm công" (tổng hợp theo tuần/tháng)

Lọc: Chi nhánh (trực thuộc của NV), Phòng ban, Nhân viên, Năm, Theo tuần/tháng, Kỳ, Trạng thái NV. Mỗi dòng 1 nhân viên:

| Cột | Cách tính |
|---|---|
| Tổng ca làm | Số ca được xếp trong kỳ (mọi trạng thái, kể cả ca tương lai) |
| Tổng ca tăng ca | Số ca tăng ca |
| **Tổng số công** | Tổng hệ số công của các ca có **đủ cả vào và ra** |
| Số giờ làm yêu cầu tối thiểu | Tổng giờ tối thiểu |
| Tổng giờ làm | Tổng **giờ được xác nhận** |
| Tổng giờ tăng ca | Tổng giờ được xác nhận của ca tăng ca |
| Số lần đi trễ / về sớm | Số ca có trễ/sớm > 0 phút (⚠️ không xét ngưỡng, không xét đã duyệt) |
| Số ca nghỉ không lương | Ca đã qua, không vào/ra, đánh dấu không lương **+** ca trễ/sớm vượt ngưỡng "tính nghỉ không lương" |
| Số ca nghỉ có lương | Ca đã qua, không vào/ra, đánh dấu có lương |

Bấm tên nhân viên → **lịch chấm công tháng** của người đó (lưới thứ 2 → CN, mỗi ô tô màu theo mục 9.2, menu thao tác như mục 6.1).

> ⚠️ Khi đang xem **theo tuần**, bấm tên nhân viên sẽ mở sai tháng (link truyền số tuần thay vì số tháng).

**Xuất Excel:** cột Mã NV, Họ tên, Email, Ngày công chuẩn (= số ca được xếp), Số ngày có checkin, Quên checkin, Nghỉ phép có lương, Nghỉ phép không lương, Số ngày đúng giờ (⚠️ luôn = 0), Số ngày đi trễ, Số ngày về sớm, Tổng thời gian làm việc thực tế (giờ xác nhận).

### 12.2. Web — "Báo cáo chấm công" Rate 1–4 (theo tuần)

- Lọc: Nhân viên (nhiều), Chi nhánh của ca (nhiều), Tuần, Năm. Chỉ hiện nhân viên có ca trong tuần.
- Cột: STT, Mã NV, Họ tên, Người quản lý, **Giờ làm việc** (tổng giờ thực tế), **Tổng** (tổng giờ xác nhận), **Rate 1 – Rate 4**, và với mỗi ngày 3 cột: Ca làm (tên ca, chi nhánh, giờ thực tế vào/ra, giờ chuẩn), Giờ làm việc, Giờ duyệt.
- **Cách chia Rate:** lấy khoảng [giờ bắt đầu ca chuẩn, + giờ được xác nhận], so với các khung giờ Rate của thứ đó, chia giờ được xác nhận theo tỷ lệ phần trùng. Không có quy tắc cho thứ đó / không trùng khung nào → dồn hết vào Rate 1. Khoảng vượt quá 23:59 bị cắt.
- **Ví dụ:** Thứ 3, ca bắt đầu 15:00, xác nhận 6 giờ → 15:00–21:00. Khung Rate 1 tới 17:59 (3 giờ), Rate 2 từ 18:00 (3 giờ) → Rate 1 = 3, Rate 2 = 3.
- Dòng "Tổng" cuối bảng = tổng **trang đang xem**. Xuất Excel xuất **toàn bộ** nhân viên (⚠️ bỏ qua bộ lọc nhân viên).

### 12.3. Web — Báo cáo khác

| Báo cáo | Tình trạng |
|---|---|
| Báo cáo chấm công (Report Studio) | Nhúng từ công cụ báo cáo bên ngoài — nội dung chưa xác định |
| Bảng công tháng dự án / TimeSheet, xuất lịch sử check-in/out, nhập phiếu lương Excel | ⚠️ **Không chạy được** (thiếu giao diện và chức năng) |
| Báo cáo phép theo năm, báo cáo thời gian thực tế, xuất lịch theo tuần/tháng | ⚠️ **Không chạy được** |

### 12.4. Web — "Lịch sử chấm công"

- Mỗi dòng = 1 lần chấm vào (ca chưa chấm vào không xuất hiện).
- Lọc: Tên NV, Phòng ban, Chi nhánh, Trạng thái (Đi đúng giờ / Đi trễ / Về sớm / Chưa checkout), Hình thức (Wifi / GPS), Năm, Tháng, Khoảng ngày.
- Cột: Tên NV, Vị trí, Phòng ban, Ca, Ngày, Giờ vào (+ hình thức: WIFI / GPS có link bản đồ / Chấm công hộ / Linh động), Giờ ra, **Lý do**.
- **Lý do** tự sinh: "[Người duyệt] Đã duyệt đi trễ" / "Nhân viên đi trễ" / "Hệ thống duyệt nghỉ không lương" (trễ vượt ngưỡng tính nghỉ); tương tự cho ra sớm; "Chưa ra ca"; "[Người] Chấm công hộ".
- Menu "…": **Duyệt đi trễ**, **Duyệt về sớm** (với ca có trễ/sớm chưa duyệt), **Check out** (ca ngày cũ chưa ra).

> ⚠️ Popup "Check out" hộ ở màn này **không mở được** (lỗi giao diện).
> ⚠️ Các bộ lọc trạng thái "Đi đúng giờ", "Về sớm", "Chưa checkout" làm hỏng các bộ lọc khác → kết quả rộng hơn mong đợi.

### 12.5. App — Nhân viên

| Màn hình | Nội dung |
|---|---|
| **Chấm công** (menu Home) | Theo kỳ công tháng: Từ ngày – Đến ngày; **Giờ công chuẩn** (tổng giờ tối thiểu); **Giờ công thực tế** (tổng giờ được xác nhận); số ca theo từng mã công (chỉ ca Chờ xác nhận/Đã xác nhận); Tổng ngày nghỉ (phép năm), Đã dùng, Còn lại. Nút "Danh sách lịch làm việc". |
| **Lịch làm việc (LLV)** | Theo tuần (có khối tổng hợp số ca theo trạng thái và giờ dự kiến/thực tế/xác nhận) hoặc theo tháng. Mỗi thẻ ca: ngày, trạng thái, chi nhánh, ca + giờ, giờ vào/ra thực tế + thời lượng, thông tin đơn đổi ca/đi muộn/về sớm, hệ số công (khi đã xác nhận), thời gian ước lượng, ảnh. |
| **Chi tiết lịch làm việc** | Thông tin ca, tổng thời gian, thời gian ước lượng, hệ số công, lịch sử từng lượt vào/ra kèm ảnh selfie, nút Bản đồ, thông tin các đơn. |
| **Lịch sử chấm công** (Tài khoản) | Lịch tháng tô màu theo trạng thái, viền đỏ ngày có tăng ca, biểu tượng ngày lễ; chọn ngày xem chi tiết vào/ra từng ca. |

### 12.6. App — Quản lý

| Màn hình | Nội dung |
|---|---|
| **Lịch sử / Quản lý chấm công** (quyền TI000000) | Theo ngày: số người đã vào ca / tổng, đã ra ca / tổng; mở rộng xem từng nhân viên. Lọc chi nhánh, phòng ban, thời gian, tên. ⚠️ Hiện dữ liệu **mọi nhân viên**, không giới hạn người mình quản lý. |
| **Báo cáo lịch làm việc nhân viên — theo tuần** (quyền TI000002) | Lưới nhân viên × 7 ngày; ô ca có vạch màu theo trạng thái báo cáo. Lọc tuần, tên, địa điểm, ca, trạng thái, "Hôm nay". Bấm ô trống → Thêm ca; bấm ô có ca → chi tiết với nút Đổi ca / Chấm công thủ công; bấm tên → lịch tuần NV; bấm tiêu đề ngày → báo cáo theo giờ. ⚠️ Hiện **mọi nhân viên** có ca. |
| **Báo cáo lịch làm việc nhân viên — theo giờ** | Dòng thời gian trong 1 ngày, mỗi nhân viên một hàng, mỗi ca một khối. Lọc địa điểm, nhân viên, trạng thái. Vuốt chuyển ngày. |

**Trạng thái dùng trong báo cáo app:**

| Trạng thái | Khi nào |
|---|---|
| Chưa đến ca | Ngày tương lai |
| Chấm công đúng giờ | Mặc định / không trễ, không sớm |
| Chưa vào/ra ca | Thiếu vào hoặc ra |
| Vào trễ/ra sớm | Vượt ngưỡng trễ/sớm |
| Nghỉ phép có lương | Đánh dấu nghỉ có lương |
| Nghỉ phép không lương | Đánh dấu không lương; hoặc ngày đã qua không vào/ra; hoặc vượt ngưỡng tính nghỉ |
| Tăng ca | ⚠️ Có trong danh mục nhưng **không bao giờ được gán** |

---

## 13. Liên kết sang Lương

Module **Lương nhân viên** đọc dữ liệu ca để tính lương theo tuần hoặc tháng (theo cấu hình kỳ trả lương của từng nhân viên). Có thể chạy tự động hoặc bấm "Tính lại", rồi "Chốt".

### 13.1. Phân loại từng ca

| Tình huống ca | Được tính là |
|---|---|
| Không vào và không ra, đánh dấu **nghỉ có lương** | Ngày nghỉ có lương: +1 ngày, + giờ của ca, + hệ số công |
| Không vào và không ra, còn lại | Ngày nghỉ **không lương** |
| Có vào hoặc ra, là ca **tăng ca** | Ca OT: giờ OT += giờ được xác nhận × hệ số công |
| Có vào hoặc ra, ca thường | Ngày công: +1, + giờ được xác nhận, + hệ số công |
| Có trễ/sớm **chưa được duyệt** | Cộng vào số lần/số phút đi trễ, về sớm |

Mỗi nhóm được tách theo loại ngày: **Ngày lễ > Thứ 7 > Chủ nhật > Ngày thường**.

### 13.2. Công thức lương chính (theo loại lương của nhân viên)

| Loại lương | Công thức |
|---|---|
| **Theo tháng** | Lương tháng; nếu có ngày nghỉ không lương: trừ (lương tháng ÷ tổng số ngày [công + nghỉ có lương + nghỉ không lương]) × số ngày nghỉ không lương |
| **Theo giờ** | Đơn giá giờ ngày thường × (giờ công thường + giờ nghỉ có lương) + phần T7/CN/lễ (theo đơn giá tiền hoặc % của đơn giá ngày thường) |
| **Theo ca** | Đơn giá ngày thường × tổng hệ số công + phần T7/CN/lễ × hệ số tương ứng |

**Tổng thực lĩnh** = Lương chính + Phụ cấp + Thưởng + Tăng ca − Phạt.
- Tăng ca = đơn giá OT × giờ OT (+ T7/CN/lễ).
- Thưởng/Phạt = các khoản gán theo ngày (mục 11.5).

> ⚠️ Khi bấm **"Tính lại"** bảng lương, thưởng/phạt lại lấy từ **cấu hình cố định theo nhân viên**, không lấy từ thưởng/phạt theo ngày như khi tính tự động → hai cách cho kết quả khác nhau.
> ⚠️ Lương đọc **mọi ca**, không quan tâm ca đã được xác nhận hay chưa.

---

## 14. Màu sắc & thông báo

### 14.1. Màu trạng thái chấm công (lịch Web, lịch sử App)

| Ý nghĩa | Màu trên lưới Web (theo nhân viên) | Màu nhạt (Web theo ca, lịch chi tiết, App lịch sử) |
|---|---|---|
| Chưa đến ca | Xám `#D3D3D3` | Xám `#D3D3D3` |
| Chấm công đúng giờ | Xanh lá `#3FAE8F` | Xanh nhạt `#DBEFDC` |
| Chưa vào/ra ca | Cam `#F08A5D` | Hồng nhạt `#FDD9D7` |
| Vào trễ / ra sớm | Vàng `#F2B84B` | Vàng nhạt `#FFEACC` |
| Nghỉ phép có lương | Xanh tím `#8E9FE6` | `#D9DCF0` |
| Nghỉ phép không lương | Tím nhạt `#E5E0FF` | `#EBD4EF` |
| Tăng ca | **Viền đỏ** quanh ô | Viền đỏ |

> ⚠️ Bảng chú thích màu in dưới lưới Web **không khớp** với màu thực tế đang tô (ví dụ chú thích ghi tăng ca là ô đỏ, nhưng thực tế là viền đỏ).

### 14.2. Thông báo đẩy (cố định trong hệ thống)

| Sự kiện | Người nhận | Nội dung |
|---|---|---|
| Nhân viên chấm công vào | Quản lý | "[Tên] đã checkin vào lúc [giờ] của ca [ca]" |
| Nhân viên ra ca lượt cuối | Quản lý | "Đang có lịch làm việc ngày … của … đang chờ xác nhận." |
| Nhân viên đăng ký ca / thêm ca / đổi ca cần duyệt | Quản lý | "Đang có lịch làm việc ngày … của … đang chờ phê duyệt." |
| Nhân viên đăng ký tăng ca cần duyệt | Quản lý | "Đang có lịch làm việc thêm giờ ngày … của … đang chờ phê duyệt." |
| Nhân viên xin đi trễ/về sớm | Quản lý | "Đang có yêu cầu xin đi trễ / về sớm ngày … của … đang chờ phê duyệt." |
| Duyệt lịch | Nhân viên | "Lịch làm việc ngày … của bạn đã được phê duyệt." |
| Duyệt cả tuần | Nhân viên | "Lịch làm việc tuần … của bạn đã được phê duyệt." |
| Duyệt đổi ca | Nhân viên | "Lịch làm việc ngày … của bạn đã được phê duyệt đổi ca." |
| Quản lý đổi ca hộ | Nhân viên | "Đã đổi ca lịch làm việc ngày … của bạn thành …" |
| Duyệt đi trễ/về sớm | Nhân viên | "Lịch làm việc ngày … của bạn đã được phê duyệt đi sớm / về trễ." |
| Xác nhận giờ | Nhân viên | "Lịch làm việc ngày … của bạn đã được xác nhận giờ làm." |
| Chấm công hộ | Nhân viên | "Lịch làm việc ngày … của bạn đã được chấm công hộ." |

Bấm thông báo → mở chi tiết lịch làm việc.
> ⚠️ Thông báo "đã được phê duyệt" vẫn được gửi cả khi quản lý **từ chối**. Thông báo "chờ phê duyệt" vẫn gửi cả khi lịch đã được tự duyệt.

---

## 15. Phân quyền & danh sách màn hình

### 15.1. Phân quyền

**Web:** Quyền chỉ dùng để **ẩn/hiện nút và menu**. ⚠️ Máy chủ **không chặn** — ai đăng nhập được và biết đường dẫn đều thao tác được. Menu được lưu tạm vĩnh viễn → đổi quyền xong có thể phải xóa bộ nhớ tạm mới thấy thay đổi.

**App:** quyền nhận từ máy chủ khi đăng nhập:

| Mã quyền | Mở ra |
|---|---|
| **TI000000** | Menu "Lịch sử / Quản lý chấm công" (xem chấm công nhiều nhân viên) |
| **TI000001** | Thẻ chấm công ở Home; menu "LLV" (lịch của tôi), **"LLV nhân viên"** (duyệt cho nhân viên), "Chấm công" (công tháng); "Lịch sử chấm công" trong Tài khoản |
| **TI000002** | "Báo cáo chấm công dành cho quản lý" (báo cáo tuần/giờ) |

> ⚠️ App **không phân biệt** quản lý và nhân viên — ai có TI000001 đều thấy menu "LLV nhân viên" (danh sách sẽ rỗng nếu không quản lý ai). Máy chủ app cũng **không kiểm tra** người gọi có phải quản lý khi duyệt/xác nhận/chấm hộ.

### 15.2. Danh sách màn hình Web (menu Chấm công)

| Màn hình | Dùng để |
|---|---|
| Ca làm việc | Tạo/sửa/xóa/bật-tắt mẫu ca (Phần 5) |
| Lịch làm việc theo nhân viên / theo ca | Xếp lịch, duyệt, xác nhận, chấm công hộ, nghỉ có/không lương, tăng ca, thưởng/phạt, xóa (Phần 6, 7, 11) |
| Bảng chấm công + chi tiết nhân viên | Tổng hợp công (12.1) |
| Cấu hình chấm công (5 tab) | Phần 4 |
| Báo cáo chấm công Rate 1–4 | 12.2 |
| Lịch sử chấm công | Xem vào/ra, duyệt trễ/sớm (12.4) |
| Thưởng phạt | Danh mục (4.6) |
| Báo cáo chấm công (Report Studio) | Báo cáo nhúng ngoài |
| *(Không có trên menu)* Lịch làm việc mẫu, Cấu hình thông báo | 6.2, 4.7 |
| Hồ sơ nhân viên → tab "Lịch làm việc", tab "Bảng lương" | Xem lịch chấm công tháng và phiếu lương của 1 người |

### 15.3. Danh sách màn hình App

| Nhóm | Màn hình |
|---|---|
| Nhân viên | Home – thẻ chấm công; Giờ vào/Giờ ra (chụp selfie); Lịch làm việc; Chi tiết lịch làm việc; Đổi ca làm; Đi muộn/Về sớm; Làm thêm giờ; Thêm ca; Thêm lịch làm việc (sao chép tuần trước); Chấm công (công tháng); Lịch sử chấm công |
| Quản lý | Danh sách lịch làm việc (LLV nhân viên); Lịch làm việc của 1 nhân viên; Chi tiết lịch làm việc; Thời gian làm việc (xác nhận / chấm công hộ / chấm công thủ công); Duyệt đi muộn/về sớm; Duyệt đổi ca; Đổi ca hộ; Báo cáo tuần; Báo cáo theo giờ; Lịch sử/Quản lý chấm công |

---

## 16. Hạn chế, lỗi và rủi ro hiện tại

Sắp theo mức ảnh hưởng nghiệp vụ.

### 16.1. Ảnh hưởng nghiêm trọng (gian lận / sai công / sai lương)

| # | Vấn đề | Ảnh hưởng |
|---|---|---|
| 1 | Không kiểm tra quyền phía máy chủ (cả Web và App) | Người không phải quản lý vẫn có thể duyệt, xác nhận giờ, chấm công hộ nếu gọi trực tiếp |
| 2 | Không kiểm tra vị trí giả lập (fake GPS), không ràng buộc thiết bị; IP wifi do điện thoại tự gửi lên | Nhân viên có thể chấm công khi không ở văn phòng |
| 3 | Giờ vào của từng lượt, số lượt, trạng thái "chờ xác nhận", người nhận thông báo khi ra ca đều do app gửi lên và máy chủ tin luôn | Có thể bị sửa dữ liệu chấm công |
| 4 | Không tự đóng ca khi quên ra ca | Ca treo ở "Đã duyệt", phụ thuộc quản lý xử lý thủ công |
| 5 | Xóa ca không kiểm tra đã chấm công / đã chốt lương | Mất dữ liệu công đã phát sinh |
| 6 | Duyệt đơn phép: cập nhật ca ngay khi mới duyệt cấp 1; duyệt trên app không cập nhật ca; sửa/xóa đơn không gỡ khỏi ca | Ca nghỉ phép bị đánh dấu sai |
| 7 | Logic trừ/hoàn phép năm khi thêm/xóa ca phép không chạy hoặc chạy ngược (xóa ca phép lại trừ thêm) | Quỹ phép sai |
| 8 | "Tính lại" lương lấy thưởng/phạt khác nguồn so với tính tự động; lương không xét ca đã xác nhận hay chưa | Lương không nhất quán |
| 9 | Ca tăng ca tạo trên Web không lưu được trạng thái và một số thông tin | Ca OT có thể không hiển thị/xử lý đúng |

### 16.2. Ảnh hưởng vận hành

| # | Vấn đề |
|---|---|
| 10 | Nhân viên có 2 ca/ngày: thẻ chấm công luôn hiện ca sớm nhất, không chuyển sang ca sau |
| 11 | Lượt 2–5 vẫn so "đi trễ" với giờ bắt đầu ca → có thể bị chặn vào ca lượt sau |
| 12 | Gửi đổi ca / xin trễ-sớm làm ca về "Chờ duyệt" → ca biến khỏi thẻ chấm công đến khi được duyệt |
| 13 | Đổi ca sau khi đã vào ca → xóa sạch dữ liệu chấm công của ca |
| 14 | Ngày kết thúc kỳ chốt công nhập trên Web không có tác dụng (luôn 25) |
| 15 | "Được phép checkin trước" dùng đơn vị khác nhau giữa lúc app lấy ca và lúc chấm công (nếu cấu hình theo Giờ) |
| 16 | Ca qua đêm chưa được xử lý đúng ở kiểm tra trùng giờ, nghỉ trưa, sinh lịch hàng loạt |
| 17 | Duyệt xin trễ/sớm không giảm số lần trễ/sớm trên Bảng chấm công và Excel |
| 18 | Báo cáo quản lý trên app hiện mọi nhân viên, không chỉ người mình quản lý |
| 19 | App không có nút từ chối lịch; Web cũng không có |
| 20 | Chốt lương không khóa Xóa ca, Tăng ca, Thưởng/phạt |

### 16.3. Chức năng hỏng / chưa hoàn thiện

| # | Chức năng |
|---|---|
| 21 | Bảng công tháng dự án (TimeSheet), xuất lịch sử check-in/out, nhập phiếu lương Excel |
| 22 | Báo cáo phép theo năm, báo cáo thời gian thực tế, xuất lịch theo tuần/tháng |
| 23 | Sửa ngày phép còn lại (tab cấu hình) |
| 24 | Popup "Check out" hộ ở màn Lịch sử chấm công |
| 25 | "Thêm ca cho nhân viên cả tuần/tháng" có khả năng lỗi |
| 26 | Cấu hình thông báo chấm công không được dùng; "Nhắc nhở chấm công" không có tác dụng |
| 27 | Trạng thái báo cáo "Tăng ca" không bao giờ được gán |

### 16.4. Lỗi hiển thị / trải nghiệm

| # | Vấn đề |
|---|---|
| 28 | Chú thích màu dưới lưới Web không khớp màu thật |
| 29 | Icon nguồn chấm công (📱/👤) không hiện trên lưới theo nhân viên; icon đơn phép luôn hiện "không được chấp nhận" |
| 30 | App: màn chi tiết tráo thông tin người/ngày duyệt giữa đơn đi muộn và về sớm |
| 31 | App: lỗi có thể hiện 2 hộp thoại liên tiếp ở chấm công không ảnh |
| 32 | App: nút "+" ở chế độ xem tháng của LLV có thể làm văng app |
| 33 | App: ca "Chấm công hộ" hiển thị nhãn "Chờ duyệt" trên thẻ ca |
| 34 | Một số câu báo lỗi sai nghĩa: "Ngày bắt đầu phải lớn hơn ngày kết thúc" (đúng ra là nhỏ hơn), "Ca làm việc không tồn tại" khi thực chất là trùng giờ |
| 35 | Hộp thoại xác nhận duyệt trên app dùng câu khẳng định "Đã duyệt thời gian làm việc" thay vì câu hỏi |
| 36 | Web "Bảng chấm công": bấm tên NV khi đang xem theo tuần mở sai tháng; Excel cột "Số ngày đúng giờ" luôn 0 |

---

## 17. Câu hỏi mở cần nghiệp vụ xác nhận

1. Ngưỡng "Tính là đi trễ" hiện vừa là **ân hạn** (để tô màu) vừa là **giới hạn chặn vào ca**. Đây có phải ý đồ nghiệp vụ không?
2. Với ca nhiều lượt, lượt 2 trở đi nên so "đi trễ" với mốc nào?
3. Nhân viên có nhiều ca trong ngày: muốn thẻ chấm công tự chuyển sang ca kế tiếp?
4. Có cần tự động đóng ca khi quên ra ca (ví dụ sau X giờ) không?
5. Đơn xin trễ/sớm được duyệt có nên trừ khỏi số lần/số phút trễ trên Bảng chấm công và Excel không?
6. Khi nhân viên gửi đổi ca/xin trễ-sớm, có chấp nhận việc ca bị ẩn khỏi thẻ chấm công trong lúc chờ duyệt không?
7. Có cần nút **từ chối** lịch trên Web và App không?
8. Báo cáo quản lý trên app nên hiện mọi nhân viên hay chỉ nhân viên dưới quyền?
9. Lương nên chỉ tính các ca **Đã xác nhận** hay mọi ca?
10. "Tính lại" lương nên lấy thưởng/phạt theo ngày hay theo cấu hình cố định?
11. Màn "Lịch làm việc mẫu" còn dùng không? Cấu hình thông báo chấm công, TimeSheet, các báo cáo hỏng có cần khôi phục?
12. Ca làm tại khách hàng có cần kiểm tra vị trí theo tọa độ khách hàng thay vì chi nhánh?
13. Giá trị thật của các cấu hình chung, quy tắc Rate, danh sách loại nghỉ phép (loại nào có lương) — cần xác nhận trên dữ liệu thật.

---

## 18. Phụ lục: đối chiếu thuật ngữ

Dùng khi trao đổi với đội kỹ thuật.

| Nghiệp vụ | Tên kỹ thuật |
|---|---|
| Ca của nhân viên theo ngày | `sf_time_working_staffs` (1 dòng = 1 NV × 1 ngày × 1 ca) |
| Mẫu ca | `sf_shifts` |
| Lịch làm việc mẫu | `sf_work_schedules` |
| Lịch sử vào / ra | `sf_check_in_log` / `sf_check_out_log` |
| Lịch sử sửa giờ vào / ra | `sf_check_in_change_log` / `sf_check_out_change_log` |
| Cấu hình chung | `sf_config_general` (`late_check_in`, `off_check_in`, `back_soon_check_out`, `off_check_out`, `checkin_time_before`, `close_time_working_start/end`, `checkin_with_image`, `admin_confirm_work_schedule`, `remind_checkin_checkout`) |
| Điểm chấm công wifi/GPS | `sf_timekeeping_config` |
| NV linh động | `staffs.check_in_limit = 0` |
| NV không cần duyệt lịch | `staffs.check_approved_time_working = 0` |
| Quản lý trực tiếp | `staffs.staff_manager_id` |
| Quỹ phép năm | `sf_leave_day` |
| Danh mục thưởng/phạt; thưởng/phạt theo ngày | `sf_recompense`; `sf_time_working_staff_recompense` |
| Quy tắc Rate | `sf_attendance_rate_rules` |
| Ngày lễ | `staff_holiday` |
| Trạng thái ca | `time_working_staff_status`: `waiting` (Chờ duyệt), `approved` (Đã duyệt), `not-approved` (Không được duyệt), `not-confirm` (Chờ xác nhận), `confirmed` (Đã xác nhận) |
| Đánh dấu nghỉ | `is_deducted`: trống = làm bình thường, `0` = nghỉ có lương, `1` = nghỉ không lương |
| Số lần chấm công / lượt hiện tại | `checking_type` / `checking_curent_step` |
| Giờ thực tế / giờ được xác nhận | `actual_time_work` / `actual_time_work_confirmed` |
| Mã công | `shift_code_approved` |
| Đã chốt lương | `is_close = 1` |
| Số phút trễ / sớm | `number_late_time` / `number_time_back_soon` |
| Đã duyệt xin trễ / sớm | `is_approve_late` / `is_approve_soon` |
| API chấm công app | `/timekeeping/shift` (lấy ca), `/time-working-staff/check-in`, `/time-working-staff/check-out` |
| API xác nhận / chấm công hộ | `/time-working-staff/accept-actual-time` |
| Quyền app | `TI000000`, `TI000001`, `TI000002` |

> Chi tiết kỹ thuật đầy đủ (từng màn hình, từng trường, từng API, vị trí mã nguồn): xem `cham-cong-rule.md`.
