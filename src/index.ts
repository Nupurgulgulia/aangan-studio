import { Hono } from "hono";
import checkArea from "../handlers/check-area.js";
import book from "../handlers/book.js";
import logCall from "../handlers/log-call.js";
import queue from "../handlers/queue.js";
import calendar from "../handlers/calendar.js";
import review from "../handlers/review.js";
import myLeads from "../handlers/my-leads.js";
import setStatus from "../handlers/set-status.js";
import telegram from "../handlers/telegram.js";
import health from "../handlers/health.js";
import login from "../handlers/login.js";
import logout from "../handlers/logout.js";
import me from "../handlers/me.js";
import changePassword from "../handlers/change-password.js";
import call from "../handlers/call.js";
import projects from "../handlers/projects.js";
import project from "../handlers/project.js";
import file from "../handlers/file.js";
import projectPhoto from "../handlers/project-photo.js";
import projectDesign from "../handlers/project-design.js";
import projectCreate from "../handlers/project-create.js";
import projectUpdate from "../handlers/project-update.js";
import eventAdd from "../handlers/event-add.js";
import itemDelete from "../handlers/item-delete.js";
import callUpdate from "../handlers/call-update.js";
import chayya from "../handlers/chayya.js";
import * as pages from "./pages";

type Handler = (req: any, res: any) => Promise<unknown>;

// The handlers were written for (req, res). This adapts a Hono request to that shape and back.
async function run(handler: Handler, c: any) {
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((v: string, k: string) => (headers[k.toLowerCase()] = v));
  let body: unknown = {};
  if (c.req.method !== "GET") body = await c.req.json().catch(() => ({}));

  let status = 200;
  let payload: unknown;
  const outHeaders: [string, string][] = [];
  let file: { buf: Uint8Array; type: string; headers: Record<string, string> } | null = null;
  const res: any = {
    writableEnded: false,
    sendFile(buf: Uint8Array, type: string, headers: Record<string, string> = {}) { file = { buf, type, headers }; res.writableEnded = true; return res; },
    status(code: number) { status = code; return res; },
    setHeader(name: string, value: string) { outHeaders.push([name, value]); return res; },
    json(b: unknown) { payload = b; res.writableEnded = true; return res; },
  };
  await handler({ method: c.req.method, headers, body, query: c.req.query() }, res);
  const fields = body && typeof body === "object" ? Object.keys(body as object).join(",") : typeof body;
  console.log(`tool ${c.req.method} ${c.req.path} -> ${status} fields=[${fields}] key_header=${headers["x-api-key"] ? "present" : "missing"}`);
  for (const [name, value] of outHeaders) c.header(name, value, { append: true });
  if (file) return c.body(file.buf, 200, { ...file.headers, "content-type": file.type });
  c.header("cache-control", "no-store");
  return c.json(payload ?? { ok: true }, status);
}

const app = new Hono();
app.use("*", async (c, next) => {
  await next();
  console.log(`req ${c.req.method} ${c.req.path} -> ${c.res.status} ua=${(c.req.header("user-agent") || "").slice(0, 40)}`);
});
app.notFound((c) => c.json({ error: "not found" }, 404));
app.get("/", (c) => c.html(pages.index));
app.get("/app.js", (c) => c.body(pages.appJs, 200, { "content-type": "text/javascript; charset=utf-8" }));
app.get("/app.css", (c) => c.body(pages.appCss, 200, { "content-type": "text/css; charset=utf-8" }));
app.get("/api/health", (c) => run(health, c));
// The voice agent's tools (shared secret)
app.post("/api/check-area", (c) => run(checkArea, c));
app.post("/api/book", (c) => run(book, c));
app.post("/api/log-call", (c) => run(logCall, c));
app.post("/api/call-update", (c) => run(callUpdate, c));
app.post("/api/telegram", (c) => run(telegram, c));
// The people (session login)
app.post("/api/login", (c) => run(login, c));
app.post("/api/logout", (c) => run(logout, c));
app.get("/api/me", (c) => run(me, c));
app.post("/api/change-password", (c) => run(changePassword, c));
app.get("/api/queue", (c) => run(queue, c));
app.get("/api/calendar", (c) => run(calendar, c));
app.post("/api/review", (c) => run(review, c));
app.get("/api/call", (c) => run(call, c));
app.get("/api/projects", (c) => run(projects, c));
app.get("/api/project", (c) => run(project, c));
app.get("/api/file", (c) => run(file, c));
app.post("/api/project-photo", (c) => run(projectPhoto, c));
app.post("/api/project-design", (c) => run(projectDesign, c));
app.post("/api/project-create", (c) => run(projectCreate, c));
app.post("/api/project-update", (c) => run(projectUpdate, c));
app.post("/api/event-add", (c) => run(eventAdd, c));
app.post("/api/item-delete", (c) => run(itemDelete, c));
app.get("/api/my-leads", (c) => run(myLeads, c));
app.post("/api/set-status", (c) => run(setStatus, c));
app.get("/api/chayya", (c) => run(chayya, c));

export default app;
