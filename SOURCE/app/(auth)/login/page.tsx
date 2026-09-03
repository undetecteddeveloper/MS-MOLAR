// /login — redirect tương thích (S#17). Auth form giờ nằm ngay trong content
// area của homepage (`/?auth=signin|signup`), không còn page riêng. Route này
// giữ lại để link cũ (bookmark, `/login?mode=signup`) không gãy.
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  redirect(mode === "signup" ? "/?auth=signup" : "/?auth=signin");
}
