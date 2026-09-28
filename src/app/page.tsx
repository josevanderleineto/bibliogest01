// ============================================
// BiblioGest - Página Inicial
// Encaminha para o painel ou para o login
// ============================================

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  redirect(token ? "/dashboard" : "/auth/login");
}
