# Hướng dẫn Cài đặt Quản Lý Khách Hàng (PWA + Firebase)

Ứng dụng này được xây dựng bằng Vanilla JS, HTML, CSS và sử dụng Firebase Firestore làm cơ sở dữ liệu.

## 1. Cấu hình Firebase
Để ứng dụng hoạt động, bạn cần có tài khoản Firebase và tạo một Project mới.

1. Truy cập [Firebase Console](https://console.firebase.google.com/).
2. Tạo project mới.
3. Vào **Project Settings** > **General** > **Your apps** > Chọn icon web `</>`.
4. Copy đoạn `firebaseConfig`.
5. Mở file `app.js` trong thư mục dự án này.
6. Thay thế phần `const firebaseConfig = { ... }` bằng config của bạn.

> **Lưu ý quan trọng**: Đừng quên bật **Firestore Database** trong Firebase Console và thiết lập **Security Rules** cho phép đọc/ghi (để test thì có thể để mode test public, nhưng thực tế nên bảo mật).

Ví dụ Rules cho phép tất cả mọi người đọc/ghi (chỉ dùng test):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## 2. Cách chạy ứng dụng
Do ứng dụng sử dụng **ES Modules** (`import ... from ...`), bạn **KHÔNG THỂ** mở trực tiếp file `index.html` bằng cách double-click (giao thức `file://`). Bạn cần chạy qua một server ảo (`http://127.0.0.1...`).

### Cách 1: Dùng VS Code Extension (Dễ nhất)
1. Cài đặt Extension **Live Server** trong VS Code.
2. Chuột phải vào file `index.html`.
3. Chọn **Open with Live Server**.

### Cách 2: Dùng Python
Mở terminal tại thư mục dự án và chạy:
```bash
python -m http.server 8000
```
Sau đó truy cập `http://localhost:8000`.

### Cách 3: Dùng Node.js
```bash
npx serve .
```

## 3. Tính năng
- **PWA**: Có thể cài đặt trên điện thoại/máy tính như app.
- **Offline UI**: Giao diện vẫn hiển thị khung khi mất mạng (dữ liệu cần mạng mới load được từ Firebase).
- **Thêm mới**: Có popup, validate 12 số CCCD, đếm ký tự còn lại.
- **Tìm kiếm**: Realtime, tìm theo tên hoặc số CCCD.
