"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

export async function login(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") return { error: "E-posta ve parola zorunludur." };
  const normalizedEmail = email.trim();
  if (!normalizedEmail || !password || password.length > 256) return { error: "E-posta veya parola geçersiz." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (error) return { error: "E-posta veya parola hatalı." };
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
