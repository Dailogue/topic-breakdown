"use client";
import React, { useState, useEffect } from "react";
import { LoadGraphModalProps, SavedGraph } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/utils";
import { Trash2 } from "lucide-react";

const LoadGraphModal: React.FC<LoadGraphModalProps> = ({ isOpen, onClose }) => {
	const [savedGraphs, setSavedGraphs] = useState<SavedGraph[]>([]);

	useEffect(() => {
		const graphs: SavedGraph[] = [];
		Object.keys(localStorage)
			.filter((k) => k.startsWith("graph_"))
			.forEach((k) => {
				try {
					const data = JSON.parse(localStorage.getItem(k) || "{}");
					const rootLabel =
						typeof data.tocTree?.label === "string" && data.tocTree.label.trim()
							? data.tocTree.label
							: typeof data.topic === "string" && data.topic.trim()
							? data.topic
							: k.replace("graph_", "");
					graphs.push({ topic: k.replace("graph_", ""), topicTitle: rootLabel });
				} catch {
					graphs.push({
						topic: k.replace("graph_", ""),
						topicTitle: k.replace("graph_", ""),
					});
				}
			});
		setSavedGraphs(graphs);
	}, [isOpen]);

	const handleDelete = (topic: string) => {
		localStorage.removeItem(`graph_${topic}`);
		setSavedGraphs((prev) => prev.filter((g) => g.topic !== topic));
	};

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Load Saved Graph</DialogTitle>
				</DialogHeader>
				<ul className="space-y-2">
					{savedGraphs.length === 0 && <li>No graphs saved.</li>}
					{savedGraphs.map(({ topic, topicTitle }) => (
						<li key={topic} className="flex items-center justify-between">
							<a
								href={`/search/${slugify(topicTitle)}`}
								className="flex-1 text-left px-3 py-2 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
								style={{ textDecoration: "none", color: "inherit" }}
							>
								{topicTitle}
							</a>
							<Button variant="ghost" size="icon" className="ml-2" title="Delete" aria-label={`Delete ${topicTitle}`} onClick={() => handleDelete(topic)}>
								<Trash2 className="h-4 w-4" />
							</Button>
						</li>
					))}
				</ul>
			</DialogContent>
		</Dialog>
	);
};

export default LoadGraphModal;
