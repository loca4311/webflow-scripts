import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import memberstackAdmin from "npm:@memberstack/admin@1.7.0";

// get-book-download v1.1 (PEER PLAN Assistant, 15.10.2026, CCWA-40)
// Auth: Memberstack member token (getMemberCookie) as Bearer, verified server-side.
// verify_jwt is off because the caller is authenticated by Memberstack, not by Supabase.
// Returns signed URLs for the files of the purchased format only.
// Download links expire after 10 min. Audio play links after 4 h, because players re-request
// byte ranges while listening and seeking through parts of up to 32 min.

const ALLOWED_ORIGINS = [
  "https://www.creativechangeworks.com",
  "https://creativechangeworks.com",
  "https://creativechangeworks-dev.webflow.io",
];

const FORMATS: Record<string, { planId: string; folder: string }> = {
  "e-book": {
    planId: "pln_das-gl-ck-der-freiheit-e-book-313j0vlp",
    folder: "e-book",
  },
  hoerbuch: {
    planId: "pln_das-gl-ck-der-freiheit-h-rbuch-1n3d0733",
    folder: "hoerbuch",
  },
};

const DOWNLOAD_SECONDS = 600;
const PLAY_SECONDS = 14400;

function cors(origin: string | null) {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function hasPlan(member: any, planId: string) {
  const connections = Array.isArray(member?.planConnections)
    ? member.planConnections
    : [];
  return connections.some(
    (c: any) =>
      c?.planId === planId && c?.active === true && c?.status === "ACTIVE",
  );
}

function label(name: string) {
  const part = name.match(/teil-(\d+)/);
  if (part) return `Teil ${Number(part[1])}`;
  if (name.endsWith(".jpg")) return "Cover";
  if (name.endsWith(".pdf")) return "E-Book (PDF)";
  return name;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST")
    return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.includes(origin))
    return json({ error: "Origin not allowed" }, 403, origin);

  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return json({ error: "not_logged_in" }, 401, origin);

    const body = await req.json().catch(() => ({}));
    const format = FORMATS[String(body.format || "")];
    if (!format) return json({ error: "unknown_format" }, 400, origin);

    const ms = memberstackAdmin.init(Deno.env.get("MEMBERSTACK_SECRET_KEY")!);
    let memberId = "";
    try {
      const payload: any = await ms.verifyToken({ token });
      memberId = String(payload?.id || "");
    } catch {
      return json({ error: "invalid_token" }, 401, origin);
    }
    if (!memberId) return json({ error: "invalid_token" }, 401, origin);

    const { data: member } = await ms.members.retrieve({ id: memberId });
    if (!hasPlan(member, format.planId))
      return json({ error: "no_access" }, 403, origin);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: list, error: listError } = await supabase.storage
      .from("book-files")
      .list(format.folder, {
        limit: 50,
        sortBy: { column: "name", order: "asc" },
      });
    if (listError) throw listError;

    const files = [];
    for (const f of list || []) {
      const path = `${format.folder}/${f.name}`;
      const isAudio = f.name.endsWith(".mp3");
      const play = await supabase.storage
        .from("book-files")
        .createSignedUrl(path, isAudio ? PLAY_SECONDS : DOWNLOAD_SECONDS);
      const dl = await supabase.storage
        .from("book-files")
        .createSignedUrl(path, DOWNLOAD_SECONDS, { download: f.name });
      if (play.error || dl.error) throw play.error || dl.error;
      files.push({
        name: f.name,
        label: label(f.name),
        type: isAudio ? "audio" : f.name.endsWith(".pdf") ? "pdf" : "image",
        url: play.data.signedUrl,
        downloadUrl: dl.data.signedUrl,
      });
    }

    return json({ files }, 200, origin);
  } catch (error) {
    console.error("get-book-download failed", error);
    return json({ error: "server_error" }, 500, origin);
  }
});
