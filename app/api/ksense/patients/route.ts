import { NextResponse } from "next/server";
import { fetchWithRetry } from "@/lib/http/fetchWithRetry";

export const runtime = "nodejs"; // ensure Node runtime (not edge) for env stability

function getEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

// Normalize “inconsistent response formats”
function extractPatients(payload: any): any[] {
    if (Array.isArray(payload)) return payload;

    // common patterns
    if (payload?.patients && Array.isArray(payload.patients)) return payload.patients;
    if (payload?.data && Array.isArray(payload.data)) return payload.data;
    if (payload?.items && Array.isArray(payload.items)) return payload.items;

    // sometimes nested
    if (payload?.result?.patients && Array.isArray(payload.result.patients)) return payload.result.patients;

    return [];
}

export async function GET(req: Request) {
    try {
        const baseUrl = getEnv("KSENSE_BASE_URL");
        const apiKey = getEnv("KSENSE_API_KEY");

        const { searchParams } = new URL(req.url);
        const page = searchParams.get("page") ?? "1";
        const limit = searchParams.get("limit") ?? "5";

        const url = new URL(`${baseUrl}/patients`);
        url.searchParams.set("page", page);
        url.searchParams.set("limit", limit);

        const res = await fetchWithRetry(url, {
            headers: {
                "x-api-key": apiKey,
                "accept": "application/json",
            },
            cache: "no-store",
        });

        const text = await res.text();
        let json: any = null;
        try {
            json = text ? JSON.parse(text) : null;
        } catch {
            // If API returns non-JSON occasionally
            return NextResponse.json(
                { error: "Upstream returned non-JSON", status: res.status, raw: text },
                { status: 502 }
            );
        }

        if (!res.ok) {
            return NextResponse.json(
                { error: "Upstream error", status: res.status, body: json },
                { status: res.status }
            );
        }

        const patients = extractPatients(json);

        return NextResponse.json({
            page: Number(page),
            limit: Number(limit),
            patients,
            raw: json, // useful for debugging; you can remove later
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
    }
}
