import { NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabase = await supabaseForRequest();
  await supabase?.auth.signOut();
  return NextResponse.redirect(`${new URL(request.url).origin}/`, 303);
}
