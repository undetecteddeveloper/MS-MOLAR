interface ExamRibbonProps {
  label: string;
}

// ExamRibbon — băng chéo góc thẻ báo đề "nổi nhất" (hạng 1 duy nhất của kệ
// Nổi nhất). Thuần trang trí: aria-hidden + pointer-events-none vì "hot" đã
// được nói bằng CHỮ ở tiêu đề/phụ đề kệ — băng không mang thêm nghĩa nào mà
// mất đi khi tắt màu/ảnh. Không sở hữu dữ liệu: chữ hiển thị đúng nguyên văn
// `label` truyền vào, không tự suy hay viết hoa trong JS (viết hoa là CSS
// `uppercase` trên băng, để tên khả truy cập luôn đọc đúng nếu aria-hidden
// từng bị gỡ).
//
// Ô vuông 76px clip góc (bo theo `--radius-card`) là thứ chặn hai đầu băng
// chéo 124px chạm mép thẻ — bỏ ô này thì băng tràn ra ngoài `Card`.
export function ExamRibbon({ label }: ExamRibbonProps) {
  return (
    <div
      data-slot="ribbon"
      aria-hidden
      className="rounded-tr-card pointer-events-none absolute top-0 right-0 z-10 size-[76px] overflow-hidden"
    >
      <span className="bg-sun glow-sun absolute top-4 -right-[30px] w-[124px] rotate-45 py-[3px] text-center text-[8.5px] leading-[1.2] font-extrabold tracking-[.06em] text-[color:var(--sun-on-solid)] uppercase">
        {label}
      </span>
    </div>
  );
}
