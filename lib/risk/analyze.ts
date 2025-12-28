// lib/risk/analyze.ts
import type { PatientInput, DataQualityIssue } from "./types";
import { normalizePatient } from "./types";
import { scorePatient, type RiskResult } from "./scoring";

export type AnalysisOutput = {
    highRiskPatientIds: string[];      // totalRisk >= 4
    feverPatientIds: string[];         // temp >= 99.6
    dataQualityIssueIds: string[];     // missing/malformed age/temp/bp
    dataQualityIssues: DataQualityIssue[];
    scored: RiskResult[];              // optional but useful for UI
};

export function analyzePatients(patients: PatientInput[]): AnalysisOutput {
    const dataQualityIssues: DataQualityIssue[] = [];
    const scored: RiskResult[] = [];

    for (const p of patients) {
        const { vitals, issue } = normalizePatient(p);
        if (issue) {
            dataQualityIssues.push(issue);
            continue;
        }
        scored.push(scorePatient(vitals!));
    }

    const highRiskPatientIds = scored
        .filter(r => r.totalRisk >= 4)
        .map(r => r.id);

    const feverPatientIds = scored
        .filter(r => r.fever) // temp >= 99.6
        .map(r => r.id);

    const dataQualityIssueIds = dataQualityIssues.map(i => i.id);

    return {
        highRiskPatientIds,
        feverPatientIds,
        dataQualityIssueIds,
        dataQualityIssues,
        scored,
    };
}
