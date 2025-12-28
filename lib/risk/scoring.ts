import type { PatientVitals } from "./types";

export type CategoryScore = {
    key: string;
    label: string;
    score: number;
    reasons: string[];
};

export type RiskResult = {
    id: string;
    totalRisk: number;        // sum of category points
    categories: CategoryScore[];
    fever: boolean;           // temp >= 99.6
};

function isFiniteNumber(n: unknown): n is number {
    return typeof n === "number" && Number.isFinite(n);
}

/**
 * Blood Pressure Risk
 * Note: If systolic and diastolic fall into different categories,
 * use the higher risk stage for scoring (max points).
 *
 * Normal (<120 AND <80): 1
 * Elevated (120-129 AND <80): 2
 * Stage 1 (130-139 OR 80-89): 3
 * Stage 2 (>=140 OR >=90): 4
 */
export function bpRiskPoints(systolic: number, diastolic: number) {
    // Systolic-only category
    let sysPoints = 1;
    let sysReason = "systolic normal";
    if (systolic >= 140) { sysPoints = 4; sysReason = "systolic ≥ 140 (stage 2)"; }
    else if (systolic >= 130) { sysPoints = 3; sysReason = "systolic 130–139 (stage 1)"; }
    else if (systolic >= 120) { sysPoints = 2; sysReason = "systolic 120–129 (elevated)"; }
    else { sysPoints = 1; sysReason = "systolic < 120 (normal)"; }

    // Diastolic-only category (note elevated requires diastolic < 80, otherwise stage1/2)
    let diaPoints = 1;
    let diaReason = "diastolic normal";
    if (diastolic >= 90) { diaPoints = 4; diaReason = "diastolic ≥ 90 (stage 2)"; }
    else if (diastolic >= 80) { diaPoints = 3; diaReason = "diastolic 80–89 (stage 1)"; }
    else { diaPoints = 1; diaReason = "diastolic < 80 (normal/elevated condition)"; }

    // Combined “Elevated” only happens when systolic 120-129 AND diastolic < 80
    const isElevatedCombo = systolic >= 120 && systolic <= 129 && diastolic < 80;

    // Determine BP points by “higher risk stage” rule
    let points = Math.max(sysPoints, diaPoints);

    // But ensure Elevated returns 2 when it applies and nothing is higher
    if (isElevatedCombo) points = Math.max(points, 2);

    const reasons: string[] = [];
    reasons.push(sysReason, diaReason);
    if (isElevatedCombo) reasons.push("meets elevated combo (120–129 AND <80)");

    return { points, reasons };
}

/**
 * Temperature Risk
 * Normal (<=99.5): 0
 * Low Fever (99.6-100.9): 1
 * High Fever (>=101.0): 2
 */
export function tempRiskPoints(tempF: number) {
    if (tempF >= 101.0) return { points: 2, reasons: ["temp ≥ 101.0°F (high fever)"] };
    if (tempF >= 99.6) return { points: 1, reasons: ["temp 99.6–100.9°F (low fever)"] };
    return { points: 0, reasons: ["temp ≤ 99.5°F (normal)"] };
}

/**
 * Age Risk
 * Under 40 (<40): 1
 * 40-65 inclusive: 1
 * Over 65 (>65): 2
 */
export function ageRiskPoints(age: number) {
    if (age > 65) return { points: 2, reasons: ["age > 65"] };
    // both <40 and 40-65 are 1 point per your rubric
    return { points: 1, reasons: ["age ≤ 65"] };
}

export function scorePatient(v: PatientVitals): RiskResult {
    const categories: CategoryScore[] = [];

    const age = ageRiskPoints(v.age);
    categories.push({ key: "age", label: "Age", score: age.points, reasons: age.reasons });

    const temp = tempRiskPoints(v.temperatureF);
    categories.push({ key: "temp", label: "Temperature", score: temp.points, reasons: temp.reasons });

    const bp = bpRiskPoints(v.systolic, v.diastolic);
    categories.push({ key: "bp", label: "Blood Pressure", score: bp.points, reasons: bp.reasons });

    const totalRisk = categories.reduce((sum, c) => sum + c.score, 0);
    const fever = v.temperatureF >= 99.6;

    return { id: v.id, totalRisk, categories, fever };
}
