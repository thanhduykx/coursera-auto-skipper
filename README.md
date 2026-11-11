# Coursera Auto Skipper ⚡

> **Chrome Extension tự động hóa hoàn thành khóa học Coursera: Auto Skip Video, Reading, tự chấm Peer Review và Thảo Luận**  
> *Dev by **thanh duyvp***

---

## 🌟 Giới Thiệu

**Coursera Auto Skipper** là tiện ích mở rộng gọn nhẹ, mạnh mẽ và bảo mật dành cho các trình duyệt Chromium (Google Chrome, Microsoft Edge, Cốc Cốc, Brave,...). Tiện ích tập trung giải quyết 4 tác vụ tốn nhiều thời gian nhất trên Coursera:

1. **Auto Skip Video:** Tua nhanh 16x hoặc hoàn thành trực tiếp qua API chuẩn của Coursera.
2. **Auto Skip Reading:** Tự động đánh dấu hoàn thành bài đọc ngay tức thì.
3. **Peer to Peer Review:** Tự động chấm điểm tiêu chí (Rubric) tối đa, điền nhận xét và nộp bài đánh giá ngang hàng.
4. **Discussion Prompt:** Tự động phản hồi và gửi thảo luận bài học.

Tiện ích hoạt động độc lập, **không cần cấu hình API Key bên ngoài**, không phụ thuộc AI trả phí và tuyệt đối an toàn cho tài khoản người dùng.

---

## 🚀 Tính Năng Nổi Bật

### 1. 🎬 Auto Skip Video Thông Minh
- **Chế độ API Siêu Tốc (Khuyến nghị):** Hoàn thành hàng loạt video trong khóa học chỉ trong vài giây thông qua API chính thống của Coursera, không cần mở từng video.
- **Chế độ Player 16x:** Tự động bật video, tắt tiếng, tăng tốc độ phát lên 16x và tua đến cuối video an toàn.

### 2. 📖 Auto Skip Reading
- Tự động tìm kiếm các nút *"Mark as complete"* / *"Đánh dấu đã hoàn thành"* trên trang bài đọc và thực hiện xác nhận.
- Hỗ trợ hoàn thành toàn bộ bài đọc trong chương/module qua API nền.

### 3. 👥 Peer to Peer Review (Chấm Bài Ngang Hàng)
- **Tự động chấm điểm:** Hỗ trợ các chiến lược chọn điểm:
  - *Điểm cao nhất (Highest Points):* Cho bạn học điểm tối đa theo rubric.
  - *Mục cuối cùng (Last item).*
  - *Giữ nguyên điểm đã chọn.*
- **Nhận xét thông minh:** Tự động điền nhận xét đầy đủ, lịch sự vào các ô nhận xét bắt buộc.
- **Tự nộp & chuyển tiếp:** Tự động xác nhận nộp bài và chuyển sang bài chấm tiếp theo cho đến khi đủ chỉ tiêu Coursera yêu cầu.
- **Quét toàn khóa:** Tìm kiếm và hoàn thành tất cả các bài Peer Review còn thiếu trong toàn bộ khóa học.
- **Lấy link bài nộp:** Một cú nhấp chuột để copy link bài nộp của chính mình để gửi chéo cho bạn học chấm nhanh.

### 4. 💬 Discussion Prompt (Thảo Luận Diễn Đàn)
- Tự động nhận diện đề bài thảo luận trên trang.
- Điền câu trả lời chuẩn mực (hoặc nội dung tùy chỉnh của bạn trong Cài đặt) và gửi bài để nhận tích xanh hoàn thành.

### 5. 🎨 Giao Diện UI/UX Hiện Đại & Trực Quan
- **Floating Panel trong trang:** Giao diện thẻ nổi sang trọng, hỗ trợ chế độ Tối (Dark Mode) và Sáng (Light Mode).
- **Thu nhỏ thành viên thuốc (Floating Pill):** Thu nhỏ góc màn hình kèm % tiến độ để không làm phiền việc học.
- **Extension Popup:** Bật/tắt nhanh từng tính năng trực tiếp từ thanh công cụ trình duyệt.
- **Options Dashboard:** Trang cài đặt cấu hình chi tiết, lưu trữ tự động.

---

## 📦 Hướng Dẫn Cài Đặt (Dành Cho Mọi Người)

Tiện ích tương thích với **Google Chrome**, **Microsoft Edge**, **Cốc Cốc**, **Brave**, **Opera**,...

### Bước 1: Tải mã nguồn về máy
1. Nhấn vào nút xanh **`Code`** ở đầu trang GitHub này.
2. Chọn **`Download ZIP`**.
3. Giải nén file zip vào một thư mục trên máy tính của bạn (ví dụ thư mục `coursera-auto-skipper`).

*(Hoặc dùng lệnh Git nếu bạn có cài Git: `git clone https://github.com/thanhduykx/coursera-auto-skipper.git`)*

### Bước 2: Bật chế độ Nhà phát triển (Developer Mode)
1. Mở trình duyệt của bạn (Chrome, Edge hoặc Cốc Cốc).
2. Truy cập vào trang tiện ích:
   - Trên **Chrome / Cốc Cốc / Brave**: Gõ `chrome://extensions` vào thanh địa chỉ rồi nhấn Enter.
   - Trên **Microsoft Edge**: Gõ `edge://extensions` vào thanh địa chỉ rồi nhấn Enter.
3. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải màn hình.

### Bước 3: Cài đặt tiện ích vào trình duyệt
1. Nhấn nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trên bên trái.
2. Chọn thư mục `coursera-auto-skipper` (thư mục chứa file `manifest.json`).
3. Tiện ích **Coursera Auto Skipper** sẽ xuất hiện trên danh sách tiện ích của trình duyệt!

---

## 💡 Hướng Dẫn Sử Dụng

1. Đăng nhập vào [Coursera.org](https://www.coursera.org) và mở một khóa học bạn đang học.
2. Bảng điều khiển nổi **Coursera Auto Skipper** sẽ tự động xuất hiện ở góc phải màn hình.
3. Bạn có thể:
   - Nhấn **`🚀 Bắt đầu Auto Skip`** để tự động chạy qua các bài học theo thứ tự.
   - Hoặc nhấn các nút hành động nhanh:
     - **`⚡ Skip Video + Reading (API)`**: Quét và hoàn thành toàn bộ bài đọc & video trong tích tắc.
     - **`📝 Chấm Peer Review`**: Xử lý ngay bài chấm ngang hàng đang mở.
     - **`💬 Gửi Thảo luận`**: Tự động trả lời câu hỏi thảo luận hiện tại.
4. Để tùy chỉnh mẫu nhận xét, chiến lược điểm hoặc theme hiển thị:
   - Nhấn vào biểu tượng bánh răng **Cài đặt** trên thanh công cụ hoặc mở chuột phải vào icon tiện ích chọn **Tùy chọn (Options)**.

---

## 🛡️ Bảo Mật & Quyền Riêng Tư

- **100% Client-side:** Toàn bộ mã nguồn chạy trực tiếp trên trình duyệt của bạn.
- **Không gửi dữ liệu ra bên ngoài:** Tiện ích chỉ tương tác với tên miền `coursera.org`.
- **Không thu thập mật khẩu, cookie hay thông tin cá nhân.**

---

## 📂 Cấu Trúc Thư Mục

```
coursera-auto-skipper/
├── manifest.json              # Cấu hình Chrome Extension Manifest V3
├── package.json               # Cấu hình dự án & bộ test
├── README.md                  # Hướng dẫn chi tiết
├── LICENSE                    # Giấy phép MIT
├── assets/                    # Biểu tượng tiện ích (16x16, 48x48, 128x128)
├── background/                # Service worker xử lý API nền Coursera
│   ├── background.js          # Quản lý sự kiện, tin nhắn & vòng đời
│   ├── lesson-batch.js        # Hoàn thành Reading & Video siêu tốc qua API
│   ├── video-batch.js         # Quản lý phát video tab ẩn
│   └── submission-link.js     # Trích xuất link bài nộp Peer Review
├── content/                   # Content scripts nhúng vào trang Coursera
│   ├── content.js             # Điểm khởi tạo và cầu nối sự kiện
│   ├── panel.js               # Giao diện điều khiển nổi (Floating Panel)
│   ├── runner.js              # Bộ điều phối tự động hóa
│   ├── course-map.js          # Trích xuất mục lục & điều hướng bài học
│   ├── reading.js             # Logic xử lý bài đọc Reading
│   ├── video.js               # Logic xử lý video (16x seek)
│   ├── discussion.js          # Logic phản hồi thảo luận
│   ├── peer-review.js         # Logic chấm điểm rubric & nộp nhận xét
│   ├── peer-assign.js         # Soạn bài nộp ban đầu
│   ├── peer-scan.js           # Quét danh mục Peer Review toàn khóa
│   ├── peer-tracker.js        # Theo dõi số lượt chấm Coursera yêu cầu
│   └── dom.js                 # Thư viện tiện ích DOM
├── shared/                    # Các module dùng chung
│   ├── options-schema.js      # Định dạng cấu hình tiện ích
│   ├── peer-score.js          # Bộ phân tích và tính toán điểm Rubric
│   ├── peer-progress.js       # Phân tích tiến độ số lượt chấm
│   └── peer-settings.js       # Quản lý cấu hình Peer Review
├── popup/                     # Giao diện menu Popup thanh công cụ
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                   # Trang quản lý cài đặt nâng cao
│   ├── options.html
│   ├── options.css
│   └── options.js
├── styles/                    # Giao diện CSS nhúng vào trang web
│   └── content.css
└── tests/                     # Bộ kiểm thử tự động (Unit Tests)
```

---

## 👨‍💻 Tác Giả & Bản Quyền

- **Tác giả:** `thanh duyvp`
- **GitHub:** [@thanhduykx](https://github.com/thanhduykx)
- **Giấy phép:** Được phát hành dưới giấy phép nguồn mở [MIT License](LICENSE).
