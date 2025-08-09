// src/app/components/MermaidDiagram.tsx
import React, { useRef, useEffect, useState } from "react";
import mermaid from "mermaid";
import { useTheme } from "next-themes";
import { MermaidDiagramProps } from "@/lib/types";

let mermaidInitialized = false;
let lastMermaidTheme: string | null = null;

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code, id, className }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isClient, setIsClient] = useState(false);
	const { resolvedTheme } = useTheme();

	useEffect(() => {
		setIsClient(true);
	}, []);

	useEffect(() => {
		if (!isClient) return;
		const mermaidTheme = resolvedTheme === "dark" ? "dark" : "default";

		if (!mermaidInitialized || lastMermaidTheme !== mermaidTheme) {
			mermaid.initialize({ startOnLoad: false, theme: mermaidTheme });
			mermaidInitialized = true;
			lastMermaidTheme = mermaidTheme;
		}
		let isMounted = true;
		const renderMermaid = async () => {
			if (containerRef.current && isMounted) {
				try {
					const isValid = await mermaid.parse(code, {
						suppressErrors: true,
					});
					if (!isValid) {
						throw new Error("Invalid Mermaid code");
					}
					const response = await mermaid.render(id || `mermaid-${Math.random().toString(36).slice(2)}`, code);
					containerRef.current.innerHTML = response.svg;
				} catch (_e) {
					if (containerRef.current) {
						containerRef.current.innerHTML = `<div class='text-red-500'><pre>${code}</pre></div>`;
					}
				}
			}
		};
		renderMermaid();
		return () => {
			isMounted = false;
		};
	}, [code, id, isClient, resolvedTheme]);

	if (!isClient) {
		return null;
	}

	return <div ref={containerRef} className={`my-4 p-4 overflow-x-auto mermaid-diagram ${className || ""}`} style={{ maxWidth: "100%" }} />;
};

export default MermaidDiagram;
