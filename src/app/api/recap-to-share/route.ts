import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.RECAP_SHARE_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!secret || !supplied) return false;

  const a = Buffer.from(secret);
  const b = Buffer.from(supplied);

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Configuration Supabase manquante" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: files, error } = await supabase.storage
    .from("recaps")
    .list("", { limit: 100, sortBy: { column: "name", order: "desc" } });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const recaps = (files ?? [])
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.png$/.test(file.name))
    .map((file) => ({
      date: file.name.replace(".png", ""),
      file: file.name,
    }));

  return NextResponse.json(
    { success: true, recaps },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { date } = await request.json().catch(() => ({ date: null }));

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Date invalide" },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Configuration Supabase manquante" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.storage
    .from("recaps")
    .createSignedUrl(`${date}.png`, 300);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Récap introuvable" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      date,
      url: data.signedUrl,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}