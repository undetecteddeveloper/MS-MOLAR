// Cây kỹ năng (dạng bài) cho CẢ 7 MÔN của Thống kê — dữ liệu + hàm kiểm tra
// tính hợp lệ của DAG (Engine 1 Adaptive AI & Feedback, PRD R1/D1, mở rộng
// từ Toán sang 7 môn ngày 2026-09-16).
//
// Nguồn nội dung: mỗi môn một bản draft ở docs/plans/analysis/
// engine1-<môn>-skill-dag-draft.md (Toán đã được engineer duyệt 2026-08; sáu
// môn còn lại tự rà theo corpus prod 2026-09-16, product owner duyệt một lượt
// theo bản tổng kết Notion). Sửa nội dung ở đây thì phải sửa cả file draft đó —
// draft là bản để người duyệt, file này chỉ là bản mã hoá; test
// skillTaxonomy.test.ts so hai bên với nhau.
//
// Đặt ở lib/ (KHÔNG phải supabase/) vì vitest.config.ts chỉ thu test dưới
// lib/**|components/**|app/**; seedSkillTaxonomy.ts ở supabase/ nhập ngược lên
// đây để lấy dữ liệu, nhờ vậy dữ liệu ship và dữ liệu được test là một.
//
// MÔN NẰM Ở CODE, KHÔNG NẰM Ở DB (quyết định D1, docs/plans/20260916-feature-
// skill-taxonomy-all-subjects.md): bảng skill_nodes không có cột subject, và
// thêm cột là một migration prod phải chờ engineer đối chiếu fingerprint lúc
// deploy. Thay vào đó `id` mang TIỀN TỐ môn (`SKILL_ID_PREFIX`) — khoá chính
// skill_nodes.id là toàn cục nên hai môn không được trùng slug. Toán giữ id
// KHÔNG tiền tố vì 20 id ấy đã có mastery thật trên prod; đổi là mất dữ liệu.
//
// Số node theo môn tỉ lệ với corpus THẬT (đo prod 2026-09-16, xem từng draft):
// môn nhiều câu và nhiều dạng (Sinh 40 câu, Lý 23, Hoá 18) chia theo chương
// của đề thi tốt nghiệp THPT (CT GDPT 2018); môn ít/không có câu (Văn 7, Sử 0)
// chỉ chia ở mức dạng bài thô — không bịa hạt mịn khi không có bằng chứng.

import { SUBJECT_ORDER, type Subject } from "@/lib/analytics/constants";

/** Một node kỹ năng. `id` là slug ổn định, dùng làm khoá chính `skill_nodes.id`. */
export interface SkillNode {
  id: string;
  /** Nhãn tiếng Việt hiển thị cho học sinh (AC-004) — không dịch sang tiếng Anh. */
  labelVi: string;
  /** Môn (giá trị canonical của SUBJECT_ORDER). Chỉ tồn tại ở code — xem D1. */
  subject: Subject;
}

/** Cạnh tiên quyết: học `skillNodeId` cần `prerequisiteNodeId` đạt ngưỡng trước. */
export interface SkillPrerequisiteEdge {
  skillNodeId: string;
  prerequisiteNodeId: string;
}

export interface SubjectTaxonomy {
  nodes: readonly SkillNode[];
  edges: readonly SkillPrerequisiteEdge[];
}

export interface DagValidationResult {
  /** true khi 0 chu trình VÀ 0 cạnh treo. */
  valid: boolean;
  /** Id các node nằm trong ít nhất một chu trình (rỗng khi hợp lệ). Đã sắp xếp. */
  cycleNodeIds: string[];
  /** Các cạnh trỏ tới (hoặc xuất phát từ) một id không có trong `nodes`. */
  danglingEdges: SkillPrerequisiteEdge[];
}

/**
 * Tiền tố id theo môn. Toán rỗng vì lý do lịch sử ở đầu file; sáu môn còn lại
 * dùng tên môn ngắn theo cách gọi trong trường ("lý", "hoá", "sinh"...), bỏ dấu.
 */
export const SKILL_ID_PREFIX: Record<Subject, string> = {
  Math: "",
  Physics: "ly-",
  Chemistry: "hoa-",
  Biology: "sinh-",
  Literature: "van-",
  English: "anh-",
  History: "su-",
};

type NodeRow = readonly [id: string, labelVi: string];
type EdgeRow = readonly [skillNodeId: string, prerequisiteNodeId: string];

function nodesOf(subject: Subject, rows: readonly NodeRow[]): SkillNode[] {
  return rows.map(([id, labelVi]) => ({ id, labelVi, subject }));
}

function edgesOf(rows: readonly EdgeRow[]): SkillPrerequisiteEdge[] {
  return rows.map(([skillNodeId, prerequisiteNodeId]) => ({ skillNodeId, prerequisiteNodeId }));
}

// ---------------------------------------------------------------------------
// Toán — 20 node, lớp 10 (6, nền tảng) + lớp 12 (14, trọng tâm ôn thi). Đã
// duyệt: docs/plans/analysis/engine1-math-skill-dag-draft.md. KHÔNG đổi id.
// ---------------------------------------------------------------------------
const MATH: SubjectTaxonomy = {
  nodes: nodesOf("Math", [
    // --- Lớp 10 (nền tảng) ---
    ["menh-de-tap-hop", "Mệnh đề và tập hợp"],
    ["bpt-bac-nhat-hai-an", "Bất phương trình bậc nhất hai ẩn"],
    ["ham-so-bac-hai", "Hàm số bậc hai"],
    ["bpt-bac-hai-mot-an", "Bất phương trình bậc hai một ẩn"],
    ["he-thuc-luong-tam-giac", "Hệ thức lượng trong tam giác"],
    ["thong-ke-xs-lop10", "Thống kê và xác suất cơ bản"],
    // --- Lớp 12 (trọng tâm ôn thi) ---
    ["tinh-don-dieu-cuc-tri", "Tính đơn điệu và cực trị của hàm số"],
    ["gtln-gtnn-tiem-can", "Giá trị lớn nhất, giá trị nhỏ nhất và tiệm cận của hàm số"],
    ["khao-sat-ve-do-thi", "Khảo sát và vẽ đồ thị hàm số"],
    [
      "ung-dung-do-thi-bien-luan",
      "Ứng dụng đồ thị hàm số để biện luận phương trình, bất phương trình",
    ],
    ["ham-so-luy-thua-mu-logarit", "Hàm số lũy thừa, hàm số mũ và hàm số lôgarit"],
    ["pt-bpt-mu-logarit", "Phương trình, bất phương trình mũ và lôgarit"],
    ["nguyen-ham", "Nguyên hàm"],
    ["tich-phan", "Tích phân"],
    ["ung-dung-tich-phan", "Ứng dụng tích phân tính diện tích, thể tích"],
    ["so-phuc", "Số phức"],
    ["the-tich-khoi-da-dien", "Thể tích khối đa diện"],
    ["mat-non-mat-tru-mat-cau", "Mặt nón, mặt trụ, mặt cầu"],
    ["pp-toa-do-khong-gian", "Phương pháp tọa độ trong không gian Oxyz"],
    ["xac-suat-co-dieu-kien", "Xác suất có điều kiện"],
  ]),
  // 5 node gốc: menh-de-tap-hop, bpt-bac-nhat-hai-an, ham-so-bac-hai,
  // he-thuc-luong-tam-giac, thong-ke-xs-lop10.
  edges: edgesOf([
    ["bpt-bac-hai-mot-an", "ham-so-bac-hai"],
    ["tinh-don-dieu-cuc-tri", "ham-so-bac-hai"],
    ["gtln-gtnn-tiem-can", "tinh-don-dieu-cuc-tri"],
    ["khao-sat-ve-do-thi", "gtln-gtnn-tiem-can"],
    ["ung-dung-do-thi-bien-luan", "khao-sat-ve-do-thi"],
    ["ham-so-luy-thua-mu-logarit", "ham-so-bac-hai"],
    ["pt-bpt-mu-logarit", "ham-so-luy-thua-mu-logarit"],
    ["nguyen-ham", "tinh-don-dieu-cuc-tri"],
    ["tich-phan", "nguyen-ham"],
    ["ung-dung-tich-phan", "tich-phan"],
    ["so-phuc", "bpt-bac-hai-mot-an"],
    ["the-tich-khoi-da-dien", "he-thuc-luong-tam-giac"],
    ["mat-non-mat-tru-mat-cau", "the-tich-khoi-da-dien"],
    ["pp-toa-do-khong-gian", "mat-non-mat-tru-mat-cau"],
    ["xac-suat-co-dieu-kien", "thong-ke-xs-lop10"],
  ]),
};

// ---------------------------------------------------------------------------
// Vật lí — 15 node theo chương của CT 2018 (lớp 10: 5, lớp 11: 5, lớp 12: 5).
// `ly-quang-hinh` là chương của CT 2006 (thấu kính, mắt, khúc xạ) — giữ vì
// corpus prod (đề Lý 11 Quảng Nam, 23 câu) có 9 câu đúng dạng ấy; bỏ là bỏ
// gần nửa corpus. docs/plans/analysis/engine1-physics-skill-dag-draft.md.
// ---------------------------------------------------------------------------
const PHYSICS: SubjectTaxonomy = {
  nodes: nodesOf("Physics", [
    // --- Lớp 10 ---
    ["ly-dong-hoc", "Động học chất điểm"],
    ["ly-dong-luc-hoc", "Động lực học: các định luật Newton và các loại lực"],
    ["ly-cong-nang-luong-cong-suat", "Công, năng lượng và công suất"],
    ["ly-dong-luong", "Động lượng và va chạm"],
    ["ly-chuyen-dong-tron-bien-dang", "Chuyển động tròn và biến dạng của vật rắn"],
    // --- Lớp 11 ---
    ["ly-dao-dong", "Dao động"],
    ["ly-song", "Sóng cơ, sóng âm, sóng ánh sáng và sóng điện từ"],
    ["ly-dien-truong", "Điện trường và điện thế"],
    ["ly-dong-dien-mach-dien", "Dòng điện không đổi và mạch điện"],
    ["ly-quang-hinh", "Quang hình học: khúc xạ, thấu kính, mắt và dụng cụ quang"],
    // --- Lớp 12 ---
    ["ly-vat-li-nhiet", "Vật lí nhiệt: nội năng, nhiệt lượng và chuyển thể"],
    ["ly-khi-li-tuong", "Khí lí tưởng"],
    ["ly-tu-truong-cam-ung", "Từ trường, lực từ và cảm ứng điện từ"],
    ["ly-dien-xoay-chieu", "Dòng điện xoay chiều"],
    ["ly-vat-li-hat-nhan", "Vật lí hạt nhân và phóng xạ"],
  ]),
  // 5 node gốc: ly-dong-hoc, ly-dien-truong, ly-quang-hinh, ly-vat-li-nhiet,
  // ly-vat-li-hat-nhan.
  edges: edgesOf([
    ["ly-dong-luc-hoc", "ly-dong-hoc"],
    ["ly-cong-nang-luong-cong-suat", "ly-dong-luc-hoc"],
    ["ly-dong-luong", "ly-dong-luc-hoc"],
    ["ly-chuyen-dong-tron-bien-dang", "ly-dong-luc-hoc"],
    ["ly-dao-dong", "ly-dong-luc-hoc"],
    ["ly-song", "ly-dao-dong"],
    ["ly-dong-dien-mach-dien", "ly-dien-truong"],
    ["ly-tu-truong-cam-ung", "ly-dong-dien-mach-dien"],
    ["ly-dien-xoay-chieu", "ly-tu-truong-cam-ung"],
    ["ly-khi-li-tuong", "ly-vat-li-nhiet"],
  ]),
};

// ---------------------------------------------------------------------------
// Hoá học — 15 node theo chương CT 2018 (lớp 10: 6, lớp 11: 2, lớp 12: 7).
// Corpus prod (đề Hoá 10 HK1, 18 câu) rơi trọn vào 4 node lớp 10 đầu tiên.
// docs/plans/analysis/engine1-chemistry-skill-dag-draft.md.
// ---------------------------------------------------------------------------
const CHEMISTRY: SubjectTaxonomy = {
  nodes: nodesOf("Chemistry", [
    // --- Lớp 10 ---
    ["hoa-cau-tao-nguyen-tu", "Cấu tạo nguyên tử"],
    ["hoa-bang-tuan-hoan", "Bảng tuần hoàn và định luật tuần hoàn"],
    ["hoa-lien-ket-hoa-hoc", "Liên kết hoá học"],
    ["hoa-phan-ung-oxi-hoa-khu", "Phản ứng oxi hoá – khử"],
    [
      "hoa-nang-luong-toc-do-can-bang",
      "Năng lượng hoá học, tốc độ phản ứng và cân bằng hoá học",
    ],
    ["hoa-phi-kim", "Nguyên tố phi kim: halogen, nitrogen và sulfur"],
    // --- Lớp 11 ---
    ["hoa-dai-cuong-huu-co-hydrocarbon", "Đại cương hoá học hữu cơ và hydrocarbon"],
    [
      "hoa-dan-xuat-hydrocarbon",
      "Dẫn xuất của hydrocarbon: alcohol, phenol, hợp chất carbonyl và carboxylic acid",
    ],
    // --- Lớp 12 ---
    ["hoa-ester-lipid", "Ester và lipid"],
    ["hoa-carbohydrate", "Carbohydrate: glucose, saccharose, tinh bột và cellulose"],
    ["hoa-hop-chat-chua-nitrogen", "Amine, amino acid, peptide và protein"],
    ["hoa-polymer", "Polymer: chất dẻo, tơ và cao su"],
    ["hoa-pin-dien-dien-phan", "Pin điện và điện phân"],
    ["hoa-dai-cuong-kim-loai", "Đại cương về kim loại"],
    [
      "hoa-kim-loai-nhom-a-chuyen-tiep",
      "Kim loại nhóm IA, IIA và kim loại chuyển tiếp dãy thứ nhất",
    ],
  ]),
  // 3 node gốc: hoa-cau-tao-nguyen-tu, hoa-nang-luong-toc-do-can-bang,
  // hoa-dai-cuong-huu-co-hydrocarbon.
  edges: edgesOf([
    ["hoa-bang-tuan-hoan", "hoa-cau-tao-nguyen-tu"],
    ["hoa-lien-ket-hoa-hoc", "hoa-cau-tao-nguyen-tu"],
    ["hoa-phan-ung-oxi-hoa-khu", "hoa-lien-ket-hoa-hoc"],
    ["hoa-phi-kim", "hoa-phan-ung-oxi-hoa-khu"],
    ["hoa-dan-xuat-hydrocarbon", "hoa-dai-cuong-huu-co-hydrocarbon"],
    ["hoa-ester-lipid", "hoa-dan-xuat-hydrocarbon"],
    ["hoa-carbohydrate", "hoa-dan-xuat-hydrocarbon"],
    ["hoa-hop-chat-chua-nitrogen", "hoa-dan-xuat-hydrocarbon"],
    ["hoa-polymer", "hoa-dai-cuong-huu-co-hydrocarbon"],
    ["hoa-pin-dien-dien-phan", "hoa-phan-ung-oxi-hoa-khu"],
    ["hoa-dai-cuong-kim-loai", "hoa-phan-ung-oxi-hoa-khu"],
    ["hoa-kim-loai-nhom-a-chuyen-tiep", "hoa-dai-cuong-kim-loai"],
  ]),
};

// ---------------------------------------------------------------------------
// Sinh học — 16 node (lớp 10: 3, lớp 11: 2, lớp 12: 11). Phần Tiến hoá tách
// làm 4 node thay vì 1 vì corpus prod (đề Sinh 12 giữa kì 2, 40 câu) nằm gần
// hết ở đó: bằng chứng / học thuyết – nhân tố / loài – hình thành loài / phát
// sinh sự sống là bốn nhóm câu hỏi thật, không phải chia cho đẹp.
// docs/plans/analysis/engine1-biology-skill-dag-draft.md.
// ---------------------------------------------------------------------------
const BIOLOGY: SubjectTaxonomy = {
  nodes: nodesOf("Biology", [
    // --- Lớp 10 ---
    ["sinh-te-bao", "Sinh học tế bào: thành phần hoá học, cấu trúc và chuyển hoá trong tế bào"],
    ["sinh-phan-bao", "Chu kì tế bào, nguyên phân và giảm phân"],
    ["sinh-vi-sinh-vat-virus", "Vi sinh vật và virus"],
    // --- Lớp 11 ---
    [
      "sinh-trao-doi-chat-sinh-vat",
      "Trao đổi chất và chuyển hoá năng lượng ở thực vật và động vật",
    ],
    [
      "sinh-cam-ung-sinh-truong-sinh-san",
      "Cảm ứng, sinh trưởng, phát triển và sinh sản ở sinh vật",
    ],
    // --- Lớp 12: Di truyền ---
    [
      "sinh-co-so-phan-tu-di-truyen",
      "Cơ sở phân tử của di truyền: DNA, gene, phiên mã, dịch mã và đột biến gene",
    ],
    ["sinh-nhiem-sac-the", "Nhiễm sắc thể và đột biến nhiễm sắc thể"],
    ["sinh-quy-luat-di-truyen", "Các quy luật di truyền"],
    ["sinh-di-truyen-quan-the", "Di truyền quần thể"],
    ["sinh-di-truyen-nguoi-ung-dung", "Di truyền học người và ứng dụng di truyền học"],
    // --- Lớp 12: Tiến hoá ---
    ["sinh-bang-chung-tien-hoa", "Bằng chứng tiến hoá"],
    ["sinh-hoc-thuyet-nhan-to-tien-hoa", "Học thuyết tiến hoá và các nhân tố tiến hoá"],
    ["sinh-loai-hinh-thanh-loai", "Loài, cách li sinh sản và quá trình hình thành loài"],
    ["sinh-phat-sinh-su-song", "Sự phát sinh, phát triển của sự sống và loài người"],
    // --- Lớp 12: Sinh thái ---
    ["sinh-quan-the-quan-xa", "Sinh thái học quần thể và quần xã"],
    ["sinh-he-sinh-thai-sinh-quyen", "Hệ sinh thái, sinh quyển và sinh thái học phục hồi"],
  ]),
  // 7 node gốc: sinh-te-bao, sinh-vi-sinh-vat-virus, sinh-trao-doi-chat-sinh-vat,
  // sinh-cam-ung-sinh-truong-sinh-san, sinh-bang-chung-tien-hoa,
  // sinh-phat-sinh-su-song, sinh-quan-the-quan-xa.
  edges: edgesOf([
    ["sinh-phan-bao", "sinh-te-bao"],
    ["sinh-co-so-phan-tu-di-truyen", "sinh-te-bao"],
    ["sinh-nhiem-sac-the", "sinh-phan-bao"],
    ["sinh-quy-luat-di-truyen", "sinh-nhiem-sac-the"],
    ["sinh-di-truyen-quan-the", "sinh-quy-luat-di-truyen"],
    ["sinh-di-truyen-nguoi-ung-dung", "sinh-quy-luat-di-truyen"],
    ["sinh-hoc-thuyet-nhan-to-tien-hoa", "sinh-di-truyen-quan-the"],
    ["sinh-loai-hinh-thanh-loai", "sinh-hoc-thuyet-nhan-to-tien-hoa"],
    ["sinh-he-sinh-thai-sinh-quyen", "sinh-quan-the-quan-xa"],
  ]),
};

// ---------------------------------------------------------------------------
// Ngữ văn — 6 node theo KỸ NĂNG của đề tốt nghiệp (đọc hiểu theo thể loại +
// tiếng Việt + hai kiểu bài viết), KHÔNG theo tác phẩm: đề từ 2025 dùng ngữ
// liệu ngoài SGK nên "tác phẩm" không còn là dạng bài. Corpus prod 7 câu (một
// đề Văn 10): 4 câu đọc hiểu thơ, 1 câu biện pháp tu từ, 1 NLVH, 1 NLXH — mỗi
// node dưới đây (trừ truyện/kí/kịch và nghị luận/thông tin) có ít nhất một câu
// thật. KHÔNG có cạnh tiên quyết: không có thứ tự học nào bảo vệ được.
// docs/plans/analysis/engine1-literature-skill-dag-draft.md.
// ---------------------------------------------------------------------------
const LITERATURE: SubjectTaxonomy = {
  nodes: nodesOf("Literature", [
    ["van-doc-hieu-tho", "Đọc hiểu văn bản thơ"],
    ["van-doc-hieu-truyen-ki-kich", "Đọc hiểu văn bản truyện, kí và kịch"],
    ["van-doc-hieu-nghi-luan-thong-tin", "Đọc hiểu văn bản nghị luận và văn bản thông tin"],
    ["van-tieng-viet", "Thực hành tiếng Việt: biện pháp tu từ, từ ngữ, ngữ pháp và lỗi câu"],
    ["van-nghi-luan-van-hoc", "Viết đoạn văn, bài văn nghị luận văn học"],
    ["van-nghi-luan-xa-hoi", "Viết đoạn văn, bài văn nghị luận xã hội"],
  ]),
  edges: [],
};

// ---------------------------------------------------------------------------
// Tiếng Anh — 9 node theo KỸ NĂNG (đề tốt nghiệp từ 2025: điền từ vào thông
// báo/quảng cáo, sắp xếp câu, đọc điền từ, đọc hiểu, điền câu vào đoạn; đề
// trường học vẫn còn ngữ âm, giao tiếp, viết lại câu, nghe). Corpus (đề Anh 11,
// 40 câu, có trên dev với subject='English'; trên prod bản upload hỏng và
// subject rỗng) phủ 8/9 node — chỉ "liên kết văn bản" chưa có câu thật.
// docs/plans/analysis/engine1-english-skill-dag-draft.md.
// ---------------------------------------------------------------------------
const ENGLISH: SubjectTaxonomy = {
  nodes: nodesOf("English", [
    ["anh-ngu-am", "Ngữ âm: phát âm và trọng âm"],
    ["anh-ngu-phap", "Ngữ pháp"],
    ["anh-tu-vung", "Từ vựng: nghĩa của từ, dạng từ, cụm từ cố định, đồng nghĩa và trái nghĩa"],
    ["anh-giao-tiep", "Chức năng giao tiếp: đáp lời trong hội thoại"],
    ["anh-doc-dien-tu", "Đọc điền từ vào đoạn văn"],
    ["anh-doc-hieu", "Đọc hiểu văn bản"],
    ["anh-lien-ket-van-ban", "Sắp xếp câu và điền câu vào đoạn: liên kết văn bản"],
    ["anh-viet-lai-cau", "Viết lại câu, chuyển đổi câu và nối câu"],
    ["anh-nghe-hieu", "Nghe hiểu"],
  ]),
  // Chỉ ba cạnh có thứ tự học thật: điền từ cần cả từ vựng lẫn ngữ pháp; viết
  // lại câu cần ngữ pháp. Đọc hiểu / giao tiếp / nghe không có tiên quyết rõ.
  edges: edgesOf([
    ["anh-doc-dien-tu", "anh-tu-vung"],
    ["anh-doc-dien-tu", "anh-ngu-phap"],
    ["anh-viet-lai-cau", "anh-ngu-phap"],
  ]),
};

// ---------------------------------------------------------------------------
// Lịch sử — 10 node theo CHỦ ĐỀ của đề tốt nghiệp (CT 2018: 6 chủ đề lớp 12 +
// phần lớp 10–11 gom thô). Corpus prod và dev đều 0 câu Sử → chia thô có chủ
// ý, chờ đề thật rồi tách. KHÔNG có cạnh: trình tự thời gian không phải thứ
// tự học. docs/plans/analysis/engine1-history-skill-dag-draft.md.
// ---------------------------------------------------------------------------
const HISTORY: SubjectTaxonomy = {
  nodes: nodesOf("History", [
    // --- Lớp 10–11 ---
    [
      "su-van-minh-co-trung-dai",
      "Các nền văn minh thế giới, Đông Nam Á và Đại Việt thời cổ – trung đại",
    ],
    [
      "su-cach-mang-tu-san-cntb-cnxh",
      "Cách mạng tư sản, chủ nghĩa tư bản và chủ nghĩa xã hội từ 1917 đến nay",
    ],
    [
      "su-viet-nam-truoc-1945",
      "Việt Nam trước 1945: chiến tranh bảo vệ Tổ quốc, cải cách và phong trào giải phóng dân tộc",
    ],
    ["su-bien-dong", "Chủ quyền của Việt Nam ở Biển Đông"],
    // --- Lớp 12 ---
    ["su-the-gioi-sau-1945", "Thế giới từ 1945: trật tự thế giới, Chiến tranh lạnh và xu thế đa cực"],
    ["su-dong-nam-a-asean", "Đông Nam Á giành độc lập và ASEAN"],
    [
      "su-cach-mang-thang-tam-khang-chien",
      "Cách mạng tháng Tám 1945 và các cuộc kháng chiến 1945 – 1975",
    ],
    ["su-bao-ve-to-quoc-doi-moi", "Bảo vệ Tổ quốc sau 1975 và công cuộc Đổi mới"],
    ["su-doi-ngoai-viet-nam", "Lịch sử đối ngoại Việt Nam thời cận – hiện đại"],
    ["su-ho-chi-minh", "Hồ Chí Minh trong lịch sử Việt Nam"],
  ]),
  edges: [],
};

/** Cây kỹ năng theo môn — nguồn duy nhất; hai mảng gộp bên dưới suy từ đây. */
export const SKILL_TAXONOMY: Record<Subject, SubjectTaxonomy> = {
  Math: MATH,
  Physics: PHYSICS,
  Chemistry: CHEMISTRY,
  Biology: BIOLOGY,
  Literature: LITERATURE,
  English: ENGLISH,
  History: HISTORY,
};

/** Mọi node của 7 môn, theo thứ tự SUBJECT_ORDER — đúng thứ seedSkillTaxonomy.ts ghi. */
export const SKILL_NODES: readonly SkillNode[] = SUBJECT_ORDER.flatMap(
  (s) => SKILL_TAXONOMY[s].nodes,
);

/** Mọi cạnh tiên quyết của 7 môn. Cạnh không bao giờ nối hai môn khác nhau. */
export const SKILL_PREREQUISITES: readonly SkillPrerequisiteEdge[] = SUBJECT_ORDER.flatMap(
  (s) => SKILL_TAXONOMY[s].edges,
);

export function skillNodesForSubject(subject: Subject): readonly SkillNode[] {
  return SKILL_TAXONOMY[subject].nodes;
}

export function skillEdgesForSubject(subject: Subject): readonly SkillPrerequisiteEdge[] {
  return SKILL_TAXONOMY[subject].edges;
}

/**
 * Môn của một id node ĐỌC TỪ DB, suy từ tiền tố. Dùng ở nơi chỉ có id trong
 * tay (queries.ts lọc định tuyến theo ROUTING_SUBJECT) mà không muốn buộc mọi
 * id trong DB phải có mặt trong SKILL_NODES — DB là nguồn sự thật của tập id
 * (tagQuestionSkills.ts cũng đọc từ đó), code chỉ biết quy ước đặt tên.
 * Id không mang tiền tố nào là Toán — quy ước lịch sử ghi ở đầu file, và test
 * "id Toán không mang tiền tố của môn nào" giữ cho quy ước ấy không mập mờ.
 */
export function subjectOfSkillNodeId(id: string): Subject {
  for (const subject of SUBJECT_ORDER) {
    const prefix = SKILL_ID_PREFIX[subject];
    if (prefix !== "" && id.startsWith(prefix)) return subject;
  }
  return "Math";
}

/**
 * Kiểm tra cây kỹ năng là DAG hợp lệ: 0 chu trình (AC-001) và 0 cạnh treo
 * (AC-002).
 *
 * Chu trình phát hiện bằng Kahn (topological peel): bóc dần các node đã hết
 * tiên quyết chưa xử lý; node nào còn sót lại sau khi bóc hết chính là node
 * nằm trong (hoặc bị chặn bởi) một chu trình. Chọn Kahn thay vì DFS đệ quy vì
 * nó không có nguy cơ tràn stack và trả thẳng ra TẬP node còn kẹt — đủ để báo
 * lỗi, không cần dựng lại đường đi cụ thể.
 *
 * Cạnh treo được loại khỏi phép đếm bậc trước khi bóc, để một cạnh treo không
 * bị báo nhầm thành chu trình.
 *
 * Thuần tuý, không I/O, không sửa tham số đầu vào. Chạy được cho một môn hay
 * cho dữ liệu gộp cả 7 môn — cổng chặn ở seedSkillTaxonomy.ts chạy bản gộp.
 */
export function validateDag(
  nodes: readonly Pick<SkillNode, "id">[],
  edges: readonly SkillPrerequisiteEdge[],
): DagValidationResult {
  const nodeIds = new Set(nodes.map((n) => n.id));

  const danglingEdges = edges.filter(
    (e) => !nodeIds.has(e.skillNodeId) || !nodeIds.has(e.prerequisiteNodeId),
  );
  const realEdges = edges.filter(
    (e) => nodeIds.has(e.skillNodeId) && nodeIds.has(e.prerequisiteNodeId),
  );

  // remainingPrereqs[x] = số tiên quyết của x chưa được bóc.
  // dependents[p] = các node có p là tiên quyết.
  const remainingPrereqs = new Map<string, number>([...nodeIds].map((id) => [id, 0]));
  const dependents = new Map<string, string[]>();

  for (const e of realEdges) {
    remainingPrereqs.set(e.skillNodeId, (remainingPrereqs.get(e.skillNodeId) ?? 0) + 1);
    const list = dependents.get(e.prerequisiteNodeId);
    if (list) list.push(e.skillNodeId);
    else dependents.set(e.prerequisiteNodeId, [e.skillNodeId]);
  }

  const queue = [...nodeIds].filter((id) => remainingPrereqs.get(id) === 0);
  const peeled = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (peeled.has(id)) continue;
    peeled.add(id);

    for (const dependent of dependents.get(id) ?? []) {
      const left = (remainingPrereqs.get(dependent) ?? 0) - 1;
      remainingPrereqs.set(dependent, left);
      if (left === 0) queue.push(dependent);
    }
  }

  const cycleNodeIds = [...nodeIds].filter((id) => !peeled.has(id)).sort();

  return {
    valid: cycleNodeIds.length === 0 && danglingEdges.length === 0,
    cycleNodeIds,
    danglingEdges,
  };
}
