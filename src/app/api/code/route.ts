import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const htmlCode =
      typeof body.htmlCode === "string" ? body.htmlCode : user.saved_html;
    const cssCode =
      typeof body.cssCode === "string" ? body.cssCode : user.saved_css;

    const db = getDb();
    await db.execute({
      sql: "UPDATE users SET saved_html = ?, saved_css = ? WHERE id = ?",
      args: [htmlCode, cssCode, user.id],
    });

    return NextResponse.json({
      ok: true,
      saved_html: htmlCode,
      saved_css: cssCode,
    });
  } catch (error) {
    console.error("Save code error:", error);
    return NextResponse.json(
      { error: "Failed to save code." },
      { status: 500 }
    );
  }
}

