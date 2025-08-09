import { NextResponse } from "next/server";
import { fetchWithRetry } from "@/lib/utils";

export async function POST(req: Request) {
	try {
		// Read raw body and forward to Gemini
		const rawBody = await req.text();

		const response = await fetchWithRetry(
			"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
				},
				body: rawBody,
			},
			3,
			500
		);

		if (!response.body) {
			const status = response.status || 502;
			const message = await response
				.text()
				.catch(() => "Failed to process request");
			return NextResponse.json({ message }, { status });
		}

		// Relay raw SSE body to client
		return new Response(response.body, {
			status: response.status,
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Roadmap API error:", error);
		return NextResponse.json(
			{ message: "An unexpected error occurred" },
			{ status: 500 }
		);
	}
}
