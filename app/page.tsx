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
    const vitals = p?.vitals ?? p?.Vitals ?? p?.clinical?.vitals;

    const bpObj =
        p?.blood_pressure ??
        p?.bloodPressure ??
        p?.bp_reading ??
        p?.bpReading ??
        vitals?.blood_pressure ??
        vitals?.bloodPressure ??
        vitals?.bp;

    return {
        id: String(p?.id ?? p?.patientId ?? p?.patient_id ?? p?._id),

        age: p?.age ?? p?.Age ?? vitals?.age,
        temperatureF: p?.temperatureF ?? p?.temp ?? p?.Temp ?? p?.temperature ?? vitals?.temp ?? vitals?.temperature,

        // BP as string (common)
        bp: p?.bp ?? p?.BP ?? p?.bloodPressure ?? p?.blood_pressure ?? vitals?.bp ?? vitals?.BP ?? bpObj,

        // BP split fields (many APIs do this)
        bpSystolic:
            p?.systolic ??
            p?.bpSystolic ??
            p?.bp_systolic ??
            p?.systolic_bp ??
            p?.sbp ??
            vitals?.systolic ??
            vitals?.sbp ??
            bpObj?.systolic,

        bpDiastolic:
            p?.diastolic ??
            p?.bpDiastolic ??
            p?.bp_diastolic ??
            p?.diastolic_bp ??
            p?.dbp ??
            vitals?.diastolic ??
            vitals?.dbp ??
            bpObj?.diastolic,
    };
}


export default function RiskDashboardPage() {
    // ✅ these were missing in your file
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(5);

    const [rawPatients, setRawPatients] = useState<any[]>([]);

    const patientInputs = useMemo(
        () => rawPatients.map(safeMapToPatientInput),
        [rawPatients]
    );

    // ✅ analysis is defined here
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
            console.log("First patient raw:", data.patients?.[0]);
            setRawPatients(data.patients ?? []);
        } catch (e: any) {
            setError(e?.message ?? "Unknown error");
        } finally {
            setLoading(false);
        }
    }

    async function loadAll() {
        setLoading(true);
        setError(null);

        try {
            const all: any[] = [];
            let p = 1;

            while (true) {
                const res = await fetch(`/api/ksense/patients?page=${p}&limit=${limit}`, {
                    cache: "no-store",
                });

                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(`Fetch failed on page ${p} (${res.status}): ${JSON.stringify(body)}`);
                }

                const data = (await res.json()) as KsenseResponse;
                const batch = data.patients ?? [];

                if (batch.length === 0) break;
                all.push(...batch);

                if (batch.length < limit) break;

                p += 1;

                // pace requests a bit to reduce 429s
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

    // ✅ this is the submit function that uses setLoading/setError/analysis
    async function submitAssessment() {
        // guard: don’t submit with no data
        if (rawPatients.length === 0) {
            setError("No patients loaded yet. Click 'Load All Patients' first.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Recompute analysis *right now* from current state (avoids stale memo issues)
            const currentInputs = rawPatients.map(safeMapToPatientInput);
            const currentAnalysis = analyzePatients(currentInputs);

            const payload = {
                high_risk_patients: currentAnalysis.highRiskPatientIds,
                fever_patients: currentAnalysis.feverPatientIds,
                data_quality_issues: currentAnalysis.dataQualityIssueIds,
            };

            console.log("Submitting payload counts:", {
                high_risk: payload.high_risk_patients.length,
                fever: payload.fever_patients.length,
                data_quality: payload.data_quality_issues.length,
            });
            console.log("Submitting payload sample:", {
                high_risk: payload.high_risk_patients.slice(0, 5),
                fever: payload.fever_patients.slice(0, 5),
                data_quality: payload.data_quality_issues.slice(0, 5),
            });

            const res = await fetch("/api/ksense/submit-assessment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) throw new Error(`Submit failed (${res.status}): ${JSON.stringify(data)}`);

            alert("Assessment submitted ✅");
            console.log("Submit response:", data);
        } catch (e: any) {
            setError(e?.message ?? "Submission failed");
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

                <button
                    className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                    onClick={submitAssessment}
                    disabled={loading || rawPatients.length === 0}
                >
                    Submit Alert List
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
                            <option key={n} value={n}>
                                {n}
                            </option>
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
                        {analysis.highRiskPatientIds.map((id) => (
                            <li key={id}>{id}</li>
                        ))}
                    </ul>
                </div>

                <div className="p-4 rounded border">
                    <h2 className="font-semibold">Fever Patients (temp ≥ 99.6°F)</h2>
                    <p className="text-sm text-gray-600">Count: {analysis.feverPatientIds.length}</p>
                    <ul className="mt-2 text-sm list-disc pl-5">
                        {analysis.feverPatientIds.map((id) => (
                            <li key={id}>{id}</li>
                        ))}
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

            {loading && <div className="text-sm text-gray-600">Loading…</div>}
            <div className="p-4 rounded border">
                <h2 className="font-semibold">Submission Payload Preview</h2>
                <div className="mt-2 text-sm space-y-2">
                    <div><span className="font-medium">high_risk_patients:</span> {analysis.highRiskPatientIds.length}</div>
                    <div><span className="font-medium">fever_patients:</span> {analysis.feverPatientIds.length}</div>
                    <div><span className="font-medium">data_quality_issues:</span> {analysis.dataQualityIssueIds.length}</div>
                </div>

                <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-blue-700">Show IDs</summary>
                    <pre className="mt-2 text-xs overflow-auto p-3 rounded bg-gray-50">
{JSON.stringify(
    {
        high_risk_patients: analysis.highRiskPatientIds,
        fever_patients: analysis.feverPatientIds,
        data_quality_issues: analysis.dataQualityIssueIds,
    },
    null,
    2
)}
    </pre>
                </details>
            </div>

        </div>

    );
}


