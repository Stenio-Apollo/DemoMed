// app/api/risk/route.ts
import { NextResponse } from "next/server";
import { analyzePatients } from "@/lib/risk/analyze";
import type { PatientInput } from "@/lib/risk/types";

export async function POST(req: Request) {
    const patients = (await req.json()) as PatientInput[];

    const result = analyzePatients(patients);

    return NextResponse.json({
        alerts: {
            highRiskPatients: result.highRiskPatientIds,
            feverPatients: result.feverPatientIds,
            dataQualityIssues: result.dataQualityIssueIds,
        },
        // Optional extras (often helpful):
        dataQualityDetails: result.dataQualityIssues,
        scoredPatients: result.scored,
    });
}
