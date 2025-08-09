import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { TocNode } from "./types";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Recursively omits 'isExpanded' and 'isLoading' from a TocNode and its children.
 */
export function omitNodeProps(
	node: TocNode
): Omit<TocNode, "isExpanded" | "isLoading"> {
	const { children, ...rest } = node;
	const cleanedNode = {
		...rest,
		children: children ? children.map(omitNodeProps) : [],
	};

	delete (cleanedNode as any).isExpanded;
	delete (cleanedNode as any).isLoading;

	return cleanedNode;
}

/**
 * Removes code fences from a string, returning only the code inside.
 */
export function stripCodeBlock(input: string): string {
	const fenceRegex = /```[\w]*\n([\s\S]*?)```/g;
	return input.replace(fenceRegex, (_, codeBlock) => codeBlock);
}

/**
 * Converts a string to a URL-friendly slug.
 */
export function slugify(input: string): string {
	const lower = input.toLowerCase();
	const replaced = lower.replace(/[^a-z0-9-]+/g, "-");
	const collapsed = replaced.replace(/-+/g, "-");
	const trimmed = collapsed.replace(/^-+|-+$/g, "");
	return trimmed;
}

export function unslugify(input: string): string {
	return input.replace(/-/g, " ");
}

/**
 * Escapes HTML special characters in a string.
 */
export function escapeHtml(text: string): string {
	return text.replace(
		/[&<>"']/g,
		(m) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			}[m] || m)
	);
}

/**
 * Converts markdown to HTML. Optionally styles output based on role.
 */
export function markdownToHtml(md: string, role?: string): string {
	let html = md;
	html = html.replace(/^###### (.*)$/gm, "<strong>$1</strong>");
	html = html.replace(/^##### (.*)$/gm, "<strong>$1</strong>");
	html = html.replace(/^#### (.*)$/gm, "<strong>$1</strong>");
	html = html.replace(/^### (.*)$/gm, "<strong>$1</strong>");
	html = html.replace(/^## (.*)$/gm, "<strong>$1</strong>");
	html = html.replace(/^# (.*)$/gm, "<strong>$1</strong>");
	html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
	html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
	html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
	html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
	html = html.replace(/^- (.*)$/gm, "<li>$1</li>");
	html = html.replace(/\n{2,}/g, "</p><p>");
	html = html.replace(/\n/g, "<br>");
	html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
	html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
	let bg = "",
		color = "";
	if (role === "assistant") {
		bg = "#f3f4f6";
		color = "#222";
	} else if (role === "user") {
		bg = "#e3f0fa";
		color = "#174ea6";
	}
	const style = bg
		? `background:${bg};color:${color};padding:10px 16px;border-radius:8px;margin:8px 0;`
		: "";
	return `<div style="${style}">${html}</div>`;
}

/**
 * Fetch with retry and exponential backoff.
 */
export async function fetchWithRetry(
	url: string,
	options: RequestInit,
	retries = 3,
	backoff = 500
): Promise<Response> {
	let lastError: any;
	for (let attempt = 0; attempt < retries; attempt++) {
		try {
			const res = await fetch(url, options);
			if (res.ok) return res;
			lastError = res;
		} catch (err) {
			lastError = err;
		}
		if (attempt < retries - 1)
			await new Promise((r) =>
				setTimeout(r, backoff * Math.pow(2, attempt))
			);
	}
	if (lastError instanceof Response) return lastError;
	throw lastError;
}
