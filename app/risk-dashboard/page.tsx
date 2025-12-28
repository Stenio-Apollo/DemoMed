"use client";

import { useEffect, useMemo, useState } from "react";
import type { PatientInput } from "@/lib/risk/types";
import { analyzePatients } from "@/lib/risk/analyze";

type KsenseResponse = {
    page: number;
    limit: number;
    patients: any[];
    raw?: any;
};

function safeMapToPatientInput(p: any): PatientInput {
    // Try common field names; you can adjust after you see actual payload shape.
    return {
        id: String(p?.id ?? p?.patientId ?? p?.patient_id ?? p?._id ?? crypto.randomUUID()),
        age: p?.age ?? p?.Age,
        temperatureF: p?.temperatureF ?? p?.temp ?? p?.Temp ?? p?.temperature ?? p?.temperature_f,
        bp: p?.bp ?? p?.BP ?? p?.bloodPressure,
        bpSystolic: p?.systolic ?? p?.bpSystolic ?? p?.bp_systolic,
        bpDiastolic: p?.diastolic ?? p?.bpDiastolic ?? p?.bp_diastolic,
    };
}

export default function RiskDashboardPage() {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(5);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [rawPatients, setRawPatients] = useState<any[]>([]);
    const patientInputs = useMemo(
        () => rawPatients.map(safeMapToPatientInput),
        [rawPatients]
    );

    const analysis = useMemo(() => analyzePatients(patientInputs), [patientInputs]);

    async function fetchPage(p: number, l: number) {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/ksense/patients?page=${p}&limit=${l}`, {
                cache: "no-store",
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(`Fetch failed (${res.status}): ${JSON.stringify(body)}`);
            }

            const data = (await res.json()) as KsenseResponse;
            setRawPatients(data.patients ?? []);
        } catch (e: any) {
            setError(e?.message ?? "Unknown error");
        } finally {
            setLoading(false);
        }
    }

    async function loadAll() {
        // Load all pages with a small delay to avoid 429s
        setLoading(true);
        setError(null);
        try {
            const all: any[] = [];
            let p = 1;

            while (true) {
                const res = await fetch(`/api/ksense/patients?page=${p}&limit=${limit}`, { cache: "no-store" });

                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(`Fetch failed on page ${p} (${res.status}): ${JSON.stringify(body)}`);
                }

                const data = (await res.json()) as KsenseResponse;
                const batch = data.patients ?? [];

                if (batch.length === 0) break;

                all.push(...batch);

                // stop if it looks like final page (fewer than limit)
                if (batch.length < limit) break;

                p += 1;

                // gentle pacing (client-side) to reduce chance of 429
                await new Promise((r) => setTimeout(r, 250));
            }

            setRawPatients(all);
            setPage(1);
        } catch (e: any) {
            setError(e?.message ?? "Unknown error");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchPage(page, limit);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit]);

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Patient Risk Scoring Dashboard</h1>

            <div className="flex flex-wrap gap-3 items-center">
                <button
                    className="px-3 py-2 rounded border"
                    onClick={() => fetchPage(page, limit)}
                    disabled={loading}
                >
                    Refresh Page
                </button>

                <button
                    className="px-3 py-2 rounded border"
                    onClick={loadAll}
                    disabled={loading}
                >
                    Load All Patients
                </button>

                <div className="flex items-center gap-2">
                    <span className="text-sm">Limit:</span>
                    <select
                        className="border rounded px-2 py-1"
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        disabled={loading}
                    >
                        {[5, 10, 15, 20].map((n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className="px-3 py-2 rounded border"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={loading || page <= 1}
                    >
                        Prev
                    </button>
                    <span className="text-sm">Page: {page}</span>
                    <button
                        className="px-3 py-2 rounded border"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={loading}
                    >
                        Next
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 border rounded bg-red-50 text-red-800">
                    {error}
                </div>
            )}

            <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded border">
                    <h2 className="font-semibold">High-Risk Patients (total ≥ 4)</h2>
                    <p className="text-sm text-gray-600">Count: {analysis.highRiskPatientIds.length}</p>
                    <ul className="mt-2 text-sm list-disc pl-5">
                        {analysis.highRiskPatientIds.map((id) => <li key={id}>{id}</li>)}
                    </ul>
                </div>

                <div className="p-4 rounded border">
                    <h2 className="font-semibold">Fever Patients (temp ≥ 99.6°F)</h2>
                    <p className="text-sm text-gray-600">Count: {analysis.feverPatientIds.length}</p>
                    <ul className="mt-2 text-sm list-disc pl-5">
                        {analysis.feverPatientIds.map((id) => <li key={id}>{id}</li>)}
                    </ul>
                </div>

                <div className="p-4 rounded border">
                    <h2 className="font-semibold">Data Quality Issues</h2>
                    <p className="text-sm text-gray-600">Count: {analysis.dataQualityIssueIds.length}</p>
                    <ul className="mt-2 text-sm list-disc pl-5">
                        {analysis.dataQualityIssues.map((i) => (
                            <li key={i.id}>
                                <span className="font-medium">{i.id}</span>: {i.reasons.join(", ")}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="p-4 rounded border">
                <h2 className="font-semibold mb-2">Scored Patients (debug view)</h2>
                <div className="overflow-auto">
                    <table className="min-w-[900px] text-sm">
                        <thead>
                        <tr className="text-left border-b">
                            <th className="py-2 pr-4">Patient</th>
                            <th className="py-2 pr-4">Total</th>
                            <th className="py-2 pr-4">Age</th>
                            <th className="py-2 pr-4">Temp</th>
                            <th className="py-2 pr-4">BP</th>
                            <th className="py-2 pr-4">Details</th>
                        </tr>
                        </thead>
                        <tbody>
                        {analysis.scored.map((r) => {
                            const age = r.categories.find((c) => c.key === "age")?.score ?? 0;
                            const temp = r.categories.find((c) => c.key === "temp")?.score ?? 0;
                            const bp = r.categories.find((c) => c.key === "bp")?.score ?? 0;
                            return (
                                <tr key={r.id} className="border-b">
                                    <td className="py-2 pr-4">{r.id}</td>
                                    <td className="py-2 pr-4 font-semibold">{r.totalRisk}</td>
                                    <td className="py-2 pr-4">{age}</td>
                                    <td className="py-2 pr-4">{temp}</td>
                                    <td className="py-2 pr-4">{bp}</td>
                                    <td className="py-2 pr-4 text-gray-600">
                                        {r.categories
                                            .filter((c) => c.reasons.length)
                                            .map((c) => `${c.label}: ${c.reasons.join("; ")}`)
                                            .join(" | ")}
                                    </td>
                                </tr>
                            );
                        })}
                        {analysis.scored.length === 0 && (
                            <tr>
                                <td className="py-3 text-gray-500" colSpan={6}>
                                    No scored patients on this view (maybe all had data quality issues).
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {loading && <div className="text-sm text-gray-600">Loading…</div>}
        </div>
    );
}
