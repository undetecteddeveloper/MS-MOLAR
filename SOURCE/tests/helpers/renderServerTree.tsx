// Test helper — render một cây ASYNC SERVER COMPONENT thành các node DOM thật.
// Không phải file test (vitest.config.ts chỉ thu thập `*.test.tsx`).
//
// VÌ SAO NÓ TỒN TẠI. Tiền lệ của repo cho một async server component là
// `render(await Component(props))` (SkillRecommendationCard.test.tsx:9-16), và
// nó chỉ chạy khi component được await KHÔNG có con async: renderer CLIENT của React 19
// từ chối một component async ("<OrderRow> is an async Client
// Component"), treo, và trả về một cây RỖNG — một test viết dựa trên
// nó hỏng vì lý do sai, hoặc tệ hơn, qua một khẳng định `not.toContain`
// trên hư không. C-07 render C-08, nên tiền lệ hết đường ở đây.
//
// Renderer server hỗ trợ chúng. `renderToReadableStream` giải quyết
// cả cây — kể cả các con client (C-09, `next/link`) — và HTML
// được phân tích ngược thành node DOM, nên các khẳng định vẫn là khẳng định DOM
// (class, href, textContent, số phần tử) thay vì khớp chuỗi.
//
// Container tách khỏi `document`, nên không cần dọn
// giữa các ca. Tương tác (focus, click) KHÔNG khả dụng ở đây — hai ca
// của file ranh giới cần nó dùng @testing-library/react, là
// đúng cho chúng: `error.tsx` và `loading.tsx` là đồng bộ.

import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server.browser";

export async function renderServerTree(node: ReactNode): Promise<{ container: HTMLElement }> {
  const stream = await renderToReadableStream(node);
  const html = await new Response(stream).text();
  const container = document.createElement("div");
  container.innerHTML = html;
  return { container };
}
