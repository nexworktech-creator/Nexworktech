"use client";
// Admin screen. Signs in through /api/auth/login and relies on the httpOnly session cookie.
import { useCallback, useEffect, useState } from "react";

type Item = { id: string; publicId: string; fullName: string; phone: string; email: string; city: string;
  budget: string | null; description: string; status: string; createdAt: string;
  service: { name: string } | null; assignee: { name: string } | null };
type Stats = { total: number; byStatus: Record<string, number>; demoSessions: number };
const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];

export default function AdminPage() {
  const [auth, setAuth] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => { setAuth("1"); }, []);   // the first API call decides whether a session exists

  const call = useCallback(async (path: string, init?: RequestInit) => {
    const r = await fetch(path, { ...init, credentials: "same-origin", headers: { "content-type": "application/json" } });
    if (r.status === 401) {
      setAuth(null);
      throw new Error("Please sign in.");
    }
    if (!r.ok) throw new Error("Request failed (" + r.status + ")");
    return r.json();
  }, [auth]);

  const load = useCallback(async () => {
    if (!auth) return;
    try {
      const p = new URLSearchParams(); if (q) p.set("q", q); if (status) p.set("status", status);
      const [s, i] = await Promise.all([call("/api/admin/stats"), call("/api/admin/inquiries?" + p)]);
      setStats(s); setItems(i.items); setErr("");
    } catch (e) { setErr((e as Error).message); }
  }, [auth, call, q, status]);

  useEffect(() => { load(); }, [load]);

  async function setItemStatus(id: string, s: string) {
    try { await call("/api/admin/inquiries/" + id, { method: "PATCH", body: JSON.stringify({ status: s }) }); load(); }
    catch (e) { setErr((e as Error).message); }
  }

  function exportCsv() {
    const safe = (v: string) => { const t = /^[=+\-@]/.test(v) ? "'" + v : v; return '"' + t.replace(/"/g, '""') + '"'; };
    const rows = [["ID", "Name", "Phone", "Email", "City", "Service", "Budget", "Status", "Created"],
      ...items.map((i) => [i.publicId, i.fullName, i.phone, i.email, i.city, i.service?.name ?? "", i.budget ?? "", i.status, i.createdAt])];
    const blob = new Blob([rows.map((r) => r.map(safe).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "inquiries.csv"; a.click();
  }

  if (!auth) return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-1 text-2xl font-bold">Admin sign in</h1>
      
      <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
        const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: f.get("u"), password: f.get("p") }) });
        if (r.ok) { setErr(""); setAuth("1"); } else setErr(r.status === 429 ? "Too many attempts. Try again in a few minutes." : "Invalid email or password."); }}>
        <label className="block text-sm">Email<input name="u" type="email" autoComplete="username" className="mb-3 w-full rounded border p-2 text-black" /></label>
        <label className="block text-sm">Password<input name="p" type="password" autoComplete="current-password" className="mb-3 w-full rounded border p-2 text-black" /></label>
        <button className="rounded bg-blue-600 px-4 py-2 text-white">Sign in</button>
      </form>
      {err && <p role="alert" className="mt-3 text-sm text-red-500">{err}</p>}
    </main>
  );

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inquiries</h1>
        <button className="text-sm underline" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); setStats(null); setItems([]); setAuth(null); }}>Sign out</button>
      </div>
      {err && <p role="alert" className="mb-3 text-sm text-red-500">{err}</p>}
      {stats && (
        <section aria-label="Summary" className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Total inquiries", stats.total], ["New", stats.byStatus.NEW ?? 0], ["Won", stats.byStatus.WON ?? 0], ["Demo sessions", stats.demoSessions]].map(([l, v]) => (
            <div key={l as string} className="rounded border p-3"><div className="text-sm opacity-70">{l}</div><div className="text-2xl font-bold">{v}</div></div>
          ))}
        </section>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        <input aria-label="Search" placeholder="Search name, email or ID" value={q} onChange={(e) => setQ(e.target.value)} className="rounded border p-2 text-black" />
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border p-2 text-black">
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button onClick={exportCsv} disabled={!items.length} className="rounded border px-3 py-2 disabled:opacity-40">Export CSV</button>
      </div>
      {!items.length ? <p className="py-8 opacity-70">No inquiries match. New submissions appear here as soon as they are saved.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b"><th className="p-2">ID</th><th>Name</th><th>Contact</th><th>Service</th><th>Received</th><th>Status</th></tr></thead>
            <tbody>{items.map((i) => (
              <tr key={i.id} className="border-b align-top">
                <td className="p-2 font-mono">{i.publicId}</td>
                <td><div>{i.fullName}</div><details><summary className="cursor-pointer opacity-70">Details</summary><p className="max-w-xs whitespace-pre-wrap">{i.description}</p><p className="opacity-70">{i.city}{i.budget ? " · " + i.budget : ""}</p></details></td>
                <td>{i.phone}<br />{i.email}</td>
                <td>{i.service?.name ?? "Not chosen"}</td>
                <td>{new Date(i.createdAt).toLocaleString()}</td>
                <td><select aria-label={"Status for " + i.publicId} value={i.status} onChange={(e) => setItemStatus(i.id, e.target.value)} className="rounded border p-1 text-black">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </main>
  );
}
