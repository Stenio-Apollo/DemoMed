// lib/risk/types.ts
export type PatientInput = {
    id: string;

    // Allow "real-world messy" inputs:
    age?: number | string | null;
    temperatureF?: number | string | null;

    // BP can be either split fields or a string like "120/80"
    bpSystolic?: number | string | null;
    bpDiastolic?: number | string | null;
    bp?: string | null;
};

export type PatientVitals = {
    id: string;
    age: number;            // integer-ish
    temperatureF: number;   // float
    systolic: number;       // integer-ish
    diastolic: number;      // integer-ish
};

export type DataQualityIssue = {
    id: string;
    reasons: string[]; // e.g. ["missing age", "malformed bp"]
};

function toNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

function parseBpString(bp: string): { systolic: number | null; diastolic: number | null } {
    // Accept:
    // "120/80", "120 / 80", "120/80 mmHg", "120-80"
    const cleaned = bp.trim().toLowerCase().replace("mmhg", "").trim();

    // allow / or -
    const m = cleaned.match(/^\s*(\d{2,3})\s*[\/-]\s*(\d{2,3})\s*$/);
    if (!m) return { systolic: null, diastolic: null };

    return { systolic: Number(m[1]), diastolic: Number(m[2]) };
}

export function normalizePatient(p: PatientInput): { vitals?: PatientVitals; issue?: DataQualityIssue } {
    const reasons: string[] = [];

    const age = toNumber(p.age);
    if (age === null) reasons.push("missing/malformed age");
    else if (age < 0 || age > 125) reasons.push("age out of range");

    const temperatureF = toNumber(p.temperatureF);
    if (temperatureF === null) reasons.push("missing/malformed temperatureF");
    else if (temperatureF < 80 || temperatureF > 115) reasons.push("temperature out of range");

    let systolic = toNumber(p.bpSystolic);
    let diastolic = toNumber(p.bpDiastolic);

    if ((systolic === null || diastolic === null) && typeof p.bp === "string") {
        const parsed = parseBpString(p.bp);
        if (systolic === null) systolic = parsed.systolic;
        if (diastolic === null) diastolic = parsed.diastolic;
    }

    if (systolic === null || diastolic === null) reasons.push("missing/malformed BP");
    else {
        // sanity bounds
        if (systolic < 50 || systolic > 260) reasons.push("systolic out of range");
        if (diastolic < 30 || diastolic > 160) reasons.push("diastolic out of range");
    }

    if (reasons.length > 0) {
        return { issue: { id: p.id, reasons } };
    }

    return {
        vitals: {
            id: p.id,
            age: Math.round(age!),
            temperatureF: temperatureF!,
            systolic: Math.round(systolic!),
            diastolic: Math.round(diastolic!),
        },
    };
}
