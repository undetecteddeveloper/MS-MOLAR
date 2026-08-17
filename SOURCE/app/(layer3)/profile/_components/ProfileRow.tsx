// ProfileRow — khung trình bày dùng ba lần trong thẻ /profile: nhãn, giá trị,
// và một hành động căn phải. KHÔNG giữ state nào; mọi trạng thái (đang sửa,
// đang gửi, lỗi) thuộc về đứa con nó bọc, nên chúng được đặc tả ở đó chứ không
// nhân bản vào đây.

interface ProfileRowProps {
  label: string;
  /** Khi có: nhãn render thành <label htmlFor> thay vì <p>, tức nhãn của HÀNG
   *  chính là nhãn của ô nhập bên dưới. Thiếu lối này thì trình sửa phải tự
   *  dựng nhãn thứ hai, và người dùng đọc "TÊN HIỂN THỊ" hai lần liền nhau. */
  labelFor?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  /** Trình sửa mở rộng, chiếm trọn bề ngang ngay dưới hàng. */
  expanded?: React.ReactNode;
}

export function ProfileRow({ label, labelFor, children, action, expanded }: ProfileRowProps) {
  const labelCls = "eyebrow block";

  return (
    <div className="py-4">
      {/* flex-wrap + ml-auto: dưới 768px nhãn/giá trị chiếm dòng một và nút rơi
          xuống dòng hai NHƯNG VẪN căn phải. min-w-0 để một email dài bị cắt
          bên trong hàng thay vì nong hàng ra và sinh cuộn ngang ở 320px.
          items-end (không phải items-center): cột nhãn/giá trị cao hơn nút
          hành động (nhãn + giá trị + hint 3 dòng > 1 nút), nên items-center
          để lại khoảng trắng dưới nút lớn hơn khoảng trắng trên nhãn — lệch
          đối xứng với py-4 của hàng (engineer 2026-08-17, PasswordRow: đáy
          nút "Change password" cách đường kẻ dưới xa hơn đỉnh nhãn "Password"
          cách đường kẻ trên). items-end ghim đáy nút trùng đáy cột nhãn/giá
          trị, khớp lại py-4 hai bên. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0">
          {labelFor ? (
            <label htmlFor={labelFor} className={labelCls}>
              {label}
            </label>
          ) : (
            <p className={labelCls}>{label}</p>
          )}
          {children && <div className="text-foreground mt-1 text-sm">{children}</div>}
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
      {expanded && <div className="mt-4">{expanded}</div>}
    </div>
  );
}
