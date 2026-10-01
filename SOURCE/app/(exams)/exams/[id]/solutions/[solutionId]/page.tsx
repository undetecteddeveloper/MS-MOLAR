// SolutionViewPage — /exams/[id]/solutions/[solutionId] (S-05). Server
// Component: `getSolutionDetail(solutionId)` chạy TRƯỚC MỌI truy vấn khác —
// `null` (bài ẩn CỦA NGƯỜI KHÁC hoặc bài không tồn tại, hai ca KHÔNG PHÂN
// BIỆT) ⇒ redirect("/exams/[id]") ngay, không render một phần nào (S11/AC-063
// — không tiết lộ bài có tồn tại hay không). `community_solution_detail` tự
// tái lập rào R1 (đề published + tác giả đề không bị ban + người xem đã nộp
// bài) TRƯỚC KHI trả một hàng nào (backend DD § "community_solution_detail"
// Validation) — nên mọi truy vấn CHẠY SAU rào trên (isExamAuthor,
// getMySolutionForWriter, getExam) chắc chắn có dữ liệu, không cần rào riêng.
//
// `?q`/`?comments` PARSE Ở ĐÂY (Server Component), không phải phía client
// (frontend DD § Client State Design "URL state": "Server-parsed on every
// request") — `SolutionViewScreen` chỉ nhận kết quả đã clamp/whitelist sẵn.
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSolutionDetail, getMySolutionForWriter, type SolutionDetailQuestion } from "@/features/solutions/queries";
import { getExam, isExamAuthor } from "@/features/exams/queries";
import { SolutionViewScreen, type SolutionViewQuestionNode } from "@/features/solutions/components/SolutionViewScreen";
import { SolutionNoteBlock } from "@/features/solutions/components/SolutionNoteBlock";
import { RichText } from "@/components/shared/RichText";
import { PageContainer } from "@/components/layout/PageContainer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { t } from "@/lib/copy";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import type { AuthorIdentity } from "@/lib/solutions/identity";

const CONTENT_CLASS = "text-lg leading-relaxed font-medium text-pretty sm:text-xl";
const ANSWER_CLASS = "text-foreground text-base leading-relaxed";

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * `?q`/`?comments` — MỘT hàm thuần, xuất ra để bộ dựng liên kết của task 45
 * soi theo (frontend DD § Field Propagation Map, hàng "q"/"comments"; Boundary
 * Context của task file này, "Roundtrip check").
 *
 * `q`: `Number.parseInt` rồi kẹp vào `[1, questionCount]`. Giá trị không parse
 * được (`NaN`) hoặc đề rỗng (`questionCount === 0`, không có gì để cuộn tới)
 * ⇒ vắng mặt — KHÔNG mở hàng nào, không phải lỗi (AC-061 note: "k không còn
 * trong đề ⇒ mở trang bình thường"; một `q` trỏ vào câu đã bị xoá vẫn kẹp vào
 * một chỉ số hợp lệ, vì hàm này chỉ biết SỐ LƯỢNG câu hiện tại, không biết câu
 * ở chỉ số đó có phải câu đích ban đầu hay không — đúng ý "mở trang bình
 * thường, không báo lỗi").
 *
 * `comments`: whitelist CHUỖI ĐÚNG "1" — mọi giá trị khác (kể cả "true", vắng
 * mặt) là "đóng", không có ép kiểu truthy nào khác.
 */
export function parseSolutionDeepLink(
  rawQ: string | undefined,
  rawComments: string | undefined,
  questionCount: number
): { q?: number; commentsOpen: boolean } {
  const parsed = rawQ !== undefined ? Number.parseInt(rawQ, 10) : NaN;
  const q =
    questionCount > 0 && !Number.isNaN(parsed) ? Math.min(Math.max(parsed, 1), questionCount) : undefined;
  return { q, commentsOpen: rawComments === "1" };
}

/** Dựng ReactNode phía SERVER cho một câu của `SolutionDetail` (UI-D22) —
 *  cùng khuôn `writerQuestionNodes.tsx` (màn viết), áp cho
 *  `SolutionDetailQuestion` (`queries.ts`, backend task 14) thay vì
 *  `SolutionEditorQuestion`. `note.bodyNode` đi qua `SolutionNoteBlock` — nơi
 *  DUY NHẤT của route này gọi `RichText` cho thân ghi chú (ADR-0002,
 *  TD-021/TD-023: `SolutionQuestionRow`/`SolutionViewScreen` — cả hai "use
 *  client" — không bao giờ import `RichText`/`SolutionNoteBlock`). */
function buildQuestionNode(question: SolutionDetailQuestion): SolutionViewQuestionNode {
  const writerChoiceNode: ReactNode | undefined =
    question.writerChoiceNode !== undefined ? (
      <RichText text={toText(question.writerChoiceNode)} inline className={ANSWER_CLASS} />
    ) : undefined;

  return {
    questionId: question.questionId,
    stemNode: <RichText text={toText(question.stem)} className={CONTENT_CLASS} />,
    correctAnswerNode: <RichText text={toText(question.correctAnswer)} inline className={ANSWER_CLASS} />,
    writerChoiceNode,
    result: question.result,
    notAutoScored: question.notAutoScored,
    essayScore: question.essayScore,
    hasChanged: question.hasChanged,
    note: question.note
      ? {
          bodyNode: (
            <SolutionNoteBlock text={question.note.body} titleId={`solution-note-title-${question.questionId}`} />
          ),
          commentCount: question.note.commentCount,
        }
      : undefined,
    // Bình luận THÔ (task 28) — CommentSheet render qua RichText nạp động phía
    // client (M12), khác note.bodyNode ở trên (server-prerendered, UI-D22).
    comments: question.comments,
  };
}

export default async function SolutionViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; solutionId: string }>;
  searchParams: Promise<{ q?: string; comments?: string; thread?: string }>;
}) {
  const { id, solutionId } = await params;

  // Rào S11/AC-063 TRƯỚC TIÊN — không có lượt đọc nào khác chạy trước khi biết
  // chắc bài này render được, và null của hai ca (ẩn/không tồn tại) đi CHUNG
  // một nhánh, không phân biệt.
  const solution = await getSolutionDetail(solutionId);
  if (solution === null) {
    redirect(`/exams/${id}`);
  }

  const sp = await searchParams;
  const { q, commentsOpen } = parseSolutionDeepLink(sp.q, sp.comments, solution.questions.length);

  // Ba lượt đọc dưới đây CHẮC CHẮN có dữ liệu — community_solution_detail đã
  // tự tái lập đúng rào R1 ở trên (đề published + tác giả không bị ban + người
  // xem đã nộp bài), nên `getExam`/`getMySolutionForWriter` không cần rào
  // riêng ở route này. `getCurrentUserProfile()` đã được layout route-group
  // gọi trước (`cache()` gộp lượt, xem `lib/auth/getCurrentUser.ts`) — lượt
  // gọi lại ở đây không tốn thêm round-trip nào; chỉ dùng để dựng hàng bình
  // luận LẠC QUAN (task 28, CommentSheet) khi người xem gửi một bình luận
  // không ẩn danh.
  const [examAuthor, own, exam, viewerProfile] = await Promise.all([
    isExamAuthor(id),
    getMySolutionForWriter(id),
    getExam(id),
    getCurrentUserProfile(),
  ]);
  const viewerIdentity: AuthorIdentity = viewerProfile
    ? {
        kind: "named",
        displayName: viewerProfile.displayName,
        ...(viewerProfile.avatarUrl ? { avatarUrl: viewerProfile.avatarUrl } : {}),
      }
    : { kind: "anonymous" };

  const editHref =
    solution.isMine && own ? `/exams/${id}/attempt/${own.attemptId}/solution` : undefined;
  const resultHref = own ? `/exams/${id}/attempt/${own.attemptId}/result` : `/exams/${id}`;
  const authorLabel =
    solution.author.kind === "named" ? solution.author.displayName : t("solutions.identity.anonymous");
  const now = new Date();

  return (
    <PageContainer as="main" size="small" padding="none" className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs
        className="text-xs"
        items={[
          { label: t("nav.exams"), href: "/exams" },
          { label: exam?.title ?? "", href: `/exams/${id}` },
          { label: t("result.title"), href: resultHref },
          { label: t("solutions.list.crumb"), href: `/exams/${id}/solutions` },
          { label: authorLabel },
        ]}
      />

      <SolutionViewScreen
        solution={solution}
        examId={id}
        now={now}
        isExamAuthor={examAuthor}
        editHref={editHref}
        questionNodes={solution.questions.map(buildQuestionNode)}
        initialOpenQuestion={q}
        initialCommentsOpen={commentsOpen}
        initialThreadId={sp.thread}
        viewerIdentity={viewerIdentity}
      />
    </PageContainer>
  );
}
