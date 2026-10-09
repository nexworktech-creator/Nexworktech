"use client";
import { useState } from "react";

type Res = { valid?: boolean; status?: string; error?: string; studentName?: string; course?: string; issuedAt?: string;
  certId?: string; pdfUrl?: string; items?: { course: string; status: string; issuedAt: string | null }[] };

export default function VerifyPage() {
  const [v, setV] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const t = v.trim();
    const qs = /^NXC-/i.test(t) ? "id=" : "reg=";
    try { const r = await fetch("/api/certificates/verify?" + qs + encodeURIComponent(t)); setRes(await r.json()); }
    catch { setRes({ error: "Network error. Try again." }); }
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-1 text-2xl font-bold">Verify or download a certificate</h1>
      <p className="mb-4 text-sm opacity-70">Enter a certificate ID (NXC-...) to verify it and download the PDF, or a registration number (NX-...) to see its status.</p>
      <form onSubmit={check} className="flex gap-2">
        <label className="sr-only" htmlFor="v">Certificate ID or registration number</label>
        <input id="v" value={v} onChange={(e) => setV(e.target.value)} className="flex-1 rounded border p-2 text-black" required />
        <button disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{busy ? "Checking" : "Check"}</button>
      </form>
      <div role="status" className="mt-5">
        {res?.error && <p>No matching record. Check the number and try again.</p>}
        {res?.valid === false && !res.error && <p>This certificate is not valid. Status: {res.status?.toLowerCase()}.</p>}
        {res?.valid && (
          <div className="rounded border p-4">
            <p className="font-bold">Valid certificate</p>
            <p>{res.studentName}</p><p>{res.course}</p>
            <p className="text-sm opacity-70">Issued {res.issuedAt?.slice(0, 10)} · {res.certId}</p>
            <a className="mt-3 inline-block rounded bg-blue-600 px-4 py-2 text-white" href={res.pdfUrl}>Download PDF</a>
          </div>)}
        {res?.items && (
          <div className="rounded border p-4">
            <p className="font-bold">{res.studentName}</p>
            {res.items.length === 0 && <p>No enrollments yet.</p>}
            {res.items.map((i, k) => <p key={k}>{i.course}: {i.status.toLowerCase().replace("_", " ")}</p>)}
            <p className="mt-2 text-sm opacity-70">To download a certificate, enter its certificate ID.</p>
          </div>)}
      </div>
    </main>
  );
}
