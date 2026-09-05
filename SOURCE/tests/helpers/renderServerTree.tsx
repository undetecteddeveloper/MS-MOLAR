// Test helper — render a tree of ASYNC SERVER COMPONENTS to real DOM nodes.
// Not a test file (vitest.config.ts collects `*.test.tsx` only).
//
// WHY THIS EXISTS. The repo's precedent for an async server component is
// `render(await Component(props))` (SkillRecommendationCard.test.tsx:9-16), and
// it works only while the awaited component has NO async child: React 19's
// CLIENT renderer refuses an async component ("<OrderRow> is an async Client
// Component"), suspends, and hands back an EMPTY tree — a test written against
// it fails for the wrong reason, or worse, passes a `not.toContain` assertion
// against nothing at all. C-07 renders C-08, so the precedent runs out here.
//
// The server renderer does support them. `renderToReadableStream` resolves the
// whole tree — including the client children (C-09, `next/link`) — and the HTML
// is parsed back into DOM nodes, so the assertions stay DOM assertions
// (classes, hrefs, textContent, element counts) rather than string matching.
//
// The container is detached from `document`, so nothing needs cleaning up
// between cases. Interactivity (focus, click) is NOT available here — the two
// boundary-file cases that need it use @testing-library/react, which is
// correct for them: `error.tsx` and `loading.tsx` are synchronous.

import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server.browser";

export async function renderServerTree(node: ReactNode): Promise<{ container: HTMLElement }> {
  const stream = await renderToReadableStream(node);
  const html = await new Response(stream).text();
  const container = document.createElement("div");
  container.innerHTML = html;
  return { container };
}
