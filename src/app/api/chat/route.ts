import { NextResponse } from "next/server";
import { fetchWithRetry } from "@/lib/utils";

export async function POST(req: Request) {
	try {
		// Read the raw body and forward it directly to Gemini
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
				.catch(() => "Failed to get response from AI service");
			return NextResponse.json({ message }, { status });
		}

		// Relay raw SSE back to the client
		return new Response(response.body, {
			status: response.status,
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
			},
		});
	} catch (e) {
		console.error("Chat API error:", e);
		return NextResponse.json(
			{ message: "An unexpected error occurred" },
			{ status: 500 }
		);
	}
}
