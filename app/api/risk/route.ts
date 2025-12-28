import { NextResponse } from "next/server";
import { analyzePatients } from "@/lib/risk/analyze";
import type { PatientInput } from "@/lib/risk/types";

function authenticate(req: Request) {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return false;
    }
    return true;
}

export async function POST(req: Request) {
    // 🔐 API KEY CHECK
    if (!authenticate(req)) {
        return NextResponse.json(
            { error: "Unauthorized: Invalid or missing API key" },
            { status: 401 }
        );
    }

    const patients = (await req.json()) as PatientInput[];
    const result = analyzePatients(patients);

    return NextResponse.json({
        alerts: {
            highRiskPatients: result.highRiskPatientIds,
            feverPatients: result.feverPatientIds,
            dataQualityIssues: result.dataQualityIssueIds,
        },
        dataQualityDetails: result.dataQualityIssues,
        scoredPatients: result.scored,
    });
}
