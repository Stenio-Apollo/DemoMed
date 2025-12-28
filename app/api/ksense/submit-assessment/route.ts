import { NextResponse } from "next/server";
import { fetchWithRetry } from "@/lib/http/fetchWithRetry";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const apiKey = process.env.KSENSE_API_KEY;
        const baseUrl = process.env.KSENSE_BASE_URL;

        if (!apiKey || !baseUrl) {
            return NextResponse.json(
                { error: "Server misconfiguration" },
                { status: 500 }
            );
        }

        const body = await req.json();

        // Validate payload shape defensively
        if (
            !Array.isArray(body.high_risk_patients) ||
            !Array.isArray(body.fever_patients) ||
            !Array.isArray(body.data_quality_issues)
        ) {
            return NextResponse.json(
                { error: "Invalid payload format" },
                { status: 400 }
            );
        }

        const res = await fetchWithRetry(`${baseUrl}/submit-assessment`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            body: JSON.stringify({
                high_risk_patients: body.high_risk_patients,
                fever_patients: body.fever_patients,
                data_quality_issues: body.data_quality_issues,
            }),
        });

        const text = await res.text();
        let json: any = null;
        try {
            json = text ? JSON.parse(text) : null;
        } catch {
            json = { raw: text };
        }

        if (!res.ok) {
            return NextResponse.json(
                { error: "Upstream submission failed", status: res.status, body: json },
                { status: res.status }
            );
        }

        return NextResponse.json({
            success: true,
            response: json,
        });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? "Unexpected error" },
            { status: 500 }
        );
    }
}