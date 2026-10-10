import { NextResponse, type NextRequest } from "next/server";

// HTTP basic auth for the human-facing pages and the lead-action API.
// The webhook, tool and cron endpoints have their own secrets and are excluded.
export const config = { matcher: ["/dashboard/:path*", "/review/:path*", "/lead/:path*", "/test-call/:path*", "/api/leads/:path*", "/api/test-call/:path*"] };

export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return new NextResponse("DASHBOARD_PASSWORD is not configured", { status: 500 });

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const supplied = decoded.slice(decoded.indexOf(":") + 1);
    if (supplied.length === password.length) {
      let diff = 0;
      for (let i = 0; i < supplied.length; i++) diff |= supplied.charCodeAt(i) ^ password.charCodeAt(i);
      if (diff === 0) return NextResponse.next();
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Aangan Studio"' },
  });
}
