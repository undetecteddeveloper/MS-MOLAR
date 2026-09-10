// ProfileRow — khung trình bày một hàng của thẻ /profile: nhãn nhỏ, giá trị,
// và một hành động căn phải. KHÔNG giữ state nào; mọi trạng thái (đang sửa,
// đang gửi, lỗi) thuộc về đứa con nó bọc.
//
// Còn đúng một nơi dùng (hàng mật khẩu) từ khi hàng "Tên hiển thị" bị bỏ
// (2026-08-17): nó hiển thị lại đúng cái tên nằm ngay phía trên nó. Giữ khung
// vì nó là chỗ duy nhất định nghĩa "một hàng của thẻ hồ sơ trông thế nào".

interface ProfileRowProps {
  label: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

export function ProfileRow({ label, children, action }: ProfileRowProps) {
  return (
    // flex-wrap + ml-auto: khi hẹp, nhãn/giá trị chiếm dòng một và nút rơi
    // xuống dòng hai NHƯNG VẪN căn phải. min-w-0 để giá trị dài bị cắt bên
    // trong hàng thay vì nong hàng ra và sinh cuộn ngang ở 320px. items-end:
    // cột nhãn/giá trị cao hơn nút, ghim đáy nút trùng đáy cột để khoảng trắng
    // hai bên kẻ chia bằng nhau (đo 2026-08-17: 17px trên vs 40px dưới với
    // items-center).
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        {children && <div className="text-foreground mt-1 text-base">{children}</div>}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}
