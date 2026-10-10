// Cal.com API v2. Verify the exact request shapes against your Cal.com account
// before go-live; these were written from the public docs, not tested live.
const API = "https://api.cal.com/v2";
const headers = (version: string) => ({
  authorization: `Bearer ${process.env.CAL_API_KEY}`,
  "cal-api-version": version,
  "content-type": "application/json",
});

export async function getSlots(startIso: string, endIso: string) {
  const url = `${API}/slots?eventTypeId=${process.env.CAL_EVENT_TYPE_ID}&start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}&timeZone=Asia%2FKolkata`;
  const res = await fetch(url, { headers: headers("2024-09-04") });
  if (!res.ok) throw new Error(`Cal.com slots ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export async function createBooking(input: { startIso: string; name: string; email?: string; phone?: string }) {
  const email =
    input.email ||
    `${(input.phone ?? "caller").replace(/\D/g, "") || "caller"}@${process.env.CAL_FALLBACK_EMAIL_DOMAIN ?? "noemail.aangan.invalid"}`;
  const res = await fetch(`${API}/bookings`, {
    method: "POST",
    headers: headers("2024-08-13"),
    body: JSON.stringify({
      start: input.startIso,
      eventTypeId: Number(process.env.CAL_EVENT_TYPE_ID),
      attendee: { name: input.name || "Caller", email, timeZone: "Asia/Kolkata", phoneNumber: input.phone },
    }),
  });
  if (!res.ok) throw new Error(`Cal.com booking ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return { uid: json?.data?.uid as string | undefined, start: json?.data?.start as string | undefined };
}

/**
 * A booking made for this attendee recently (e.g. by Vaani's Cal.com integration during the call).
 * Used to confirm the agent's "booked" claim instead of trusting it.
 */
export async function findRecentBooking(email: string, withinMs = 3 * 3600 * 1000): Promise<{ uid: string; start: string } | null> {
  if (!process.env.CAL_API_KEY || !email) return null;
  const q = new URLSearchParams({ attendeeEmail: email, sortCreated: "desc", take: "5" });
  const res = await fetch(`${API}/bookings?${q}`, { headers: headers("2024-08-13"), cache: "no-store" });
  if (!res.ok) return null;
  const j = await res.json();
  const since = Date.now() - withinMs;
  const b = (j.data ?? []).find(
    (x: any) =>
      x.status !== "cancelled" &&
      new Date(x.createdAt ?? x.created_at ?? 0).getTime() >= since &&
      (x.attendees ?? []).some((a: any) => String(a.email).toLowerCase() === email.toLowerCase()),
  );
  return b ? { uid: String(b.uid), start: new Date(b.start ?? b.startTime).toISOString() } : null;
}
