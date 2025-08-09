import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { TocNode, TocSectionProps } from "@/lib/types";
import html2canvas from "html2canvas";
import { slugify, escapeHtml, markdownToHtml } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ChevronRight, FileText, MinusSquare, PlusSquare, Settings } from "lucide-react";

const LEVEL_GAP = 180;
const SIBLING_GAP = 48;
const MARGIN = 100;
const NODE_HEIGHT = 40;

function tocToHtml(node: TocNode, depth = 1): string {
	let html = `<h${depth}>${escapeHtml(node.label)}</h${depth}>`;
	if (node.messages?.length) {
		for (const msg of node.messages) {
			const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
			html += markdownToHtml(content, msg.role);
		}
	}
	if (node.children?.length) {
		node.children.forEach((child) => {
			html += tocToHtml(child, depth + 1);
		});
	}
	return html;
}

const TocSection: React.FC<TocSectionProps> = ({ tocTree, selectedNodeId, onNodeSelect, onNodeExpand, onImportJson }) => {
	const [exportMenuOpen, setExportMenuOpen] = useState(false);
	const [search, setSearch] = useState("");
	const exportBtnRef = useRef<HTMLButtonElement>(null);
	const exportMenuRef = useRef<HTMLDivElement>(null);
	const mindmapRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const areAllNodesExpanded = useCallback((): boolean => {
		function check(node: TocNode): boolean {
			if (!node.isExpanded) return false;
			if (node.children?.length) return node.children.every(check);
			return true;
		}
		return tocTree ? check(tocTree) : false;
	}, [tocTree]);

	const expandAllNodes = useCallback(() => {
		function expand(node: TocNode): TocNode {
			return {
				...node,
				isExpanded: true,
				children: node.children?.map(expand) || [],
			};
		}
		if (tocTree) onNodeExpand(expand(tocTree));
	}, [tocTree, onNodeExpand]);

	const collapseAllNodes = useCallback(() => {
		function collapse(node: TocNode, isRoot = false): TocNode {
			return {
				...node,
				isExpanded: isRoot,
				children: node.children?.map((child) => collapse(child, false)) || [],
			};
		}
		if (tocTree) onNodeExpand(collapse(tocTree, true));
	}, [tocTree, onNodeExpand]);

	const canExpand = (node: TocNode) => node.isLoading || node.isExpanded || (node.children?.length ?? 0) > 0;

	const isLeaf = (node: TocNode) => !node.children || node.children.length === 0;

	const getFullSlug = (node: TocNode) => node.chain?.map(slugify).join("/") || slugify(node.label);

	const renderNode = useCallback(
		(node: TocNode, depth = 0) => {
			const fullSlug = getFullSlug(node);
			return (
				<li key={node.id} className={`${depth > 0 ? "py-0.5" : ""}${selectedNodeId === node.id ? " rounded-xl" : ""}`}>
					<a
						href={`/search/${fullSlug}`}
						className="block focus:outline-hidden"
						onClick={(e) => {
							e.preventDefault();
							onNodeSelect(node);
						}}
						tabIndex={0}
					>
						<div className={`flex items-start ${depth > 0 ? ` pl-2` : ""}`}>
							{!search.trim() && canExpand(node) && !isLeaf(node) && (
								<Button
									variant="ghost"
									size="sm"
									aria-label={node.isExpanded ? "Collapse" : "Expand"}
									className="text-xs px-1 h-6 w-6 min-w-0"
									onClick={(ev) => {
										ev.preventDefault();
										ev.stopPropagation();
										onNodeExpand(node);
									}}
									tabIndex={0}
								>
									<span className={`transition-transform duration-200 ${node.isExpanded ? "rotate-90" : ""}`}>
										<ChevronRight className="w-4 h-4 text-gray-500" aria-hidden="true" />
									</span>
								</Button>
							)}
							{!search.trim() && isLeaf(node) && <Label className="text-xs px-2 py-0.5 text-muted-foreground bg-transparent">-</Label>}
							<Button variant="ghost" className="text-left flex-1 justify-start capitalize px-2 py-1 h-auto text-xs" tabIndex={-1}>
								{node.label}
								{node.notes && node.notes.trim().length > 0 && <FileText className="ml-2 inline-block w-4 h-4 text-foreground align-middle" aria-hidden="true" />}
								{!node.isRead && <span className="ml-2 inline-block w-1 h-1 rounded-full bg-primary align-middle" title="Unread"></span>}
							</Button>
							{depth === 0 && !search.trim() && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="text-xs h-6 w-6 min-w-0"
									onClick={(ev) => {
										ev.preventDefault();
										ev.stopPropagation();
										if (areAllNodesExpanded()) {
											collapseAllNodes();
										} else {
											expandAllNodes();
										}
									}}
									tabIndex={-1}
									aria-label={areAllNodesExpanded() ? "Collapse all" : "Expand all"}
								>
									{areAllNodesExpanded() ? (
										<MinusSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
									) : (
										<PlusSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
									)}
								</Button>
							)}
							{!search.trim() && !isLeaf(node) && node.isLoading && <span className="ml-2 animate-spin">⏳</span>}
						</div>
					</a>
					{node.isExpanded && node.children && <ul className="ml-4 border-l border-muted">{node.children.map((child) => renderNode(child, depth + 1))}</ul>}
				</li>
			);
		},
		[selectedNodeId, onNodeExpand, onNodeSelect, areAllNodesExpanded, collapseAllNodes, expandAllNodes, search]
	);

	const mindmapPositions = useMemo(() => {
		if (!tocTree) return [];
		const positions: { id: string; x: number; y: number; label: string; parent?: string; depth: number }[] = [];
		function computeTreeLayout(node: TocNode, depth: number, x: number, y: number, parentId?: string): number {
			const children = node.children || [];
			let subtreeHeight = 0,
				childY = y;
			const startY = y;
			children.forEach((child) => {
				const childHeight = computeTreeLayout(child, depth + 1, x + LEVEL_GAP, childY, node.id);
				childY += childHeight + SIBLING_GAP;
				subtreeHeight += childHeight + SIBLING_GAP;
			});
			if (children.length > 0) subtreeHeight -= SIBLING_GAP;
			const nodeY = children.length === 0 ? y : startY + subtreeHeight / 2 - NODE_HEIGHT / 2;
			positions.push({ id: node.id, x, y: nodeY, label: node.label, parent: parentId, depth });
			return Math.max(NODE_HEIGHT, subtreeHeight || NODE_HEIGHT);
		}
		computeTreeLayout(tocTree, 0, MARGIN, MARGIN);
		return positions;
	}, [tocTree]);

	const renderMindmapSVG = useCallback((positions: typeof mindmapPositions) => {
		if (!positions.length) return null;
		const maxX = Math.max(...positions.map((p) => p.x)) + MARGIN + 120;
		const maxY = Math.max(...positions.map((p) => p.y)) + MARGIN + 40;
		const nodeColor = (depth: number) => ["#ff9800", "#64b5f6", "#81c784", "#ffd54f", "#ba68c8", "#4db6ac"][depth % 6];
		return (
			<svg width={maxX} height={maxY} style={{ background: "#fff", borderRadius: 16 }}>
				{positions
					.filter((p) => p.parent)
					.map((p) => {
						const parent = positions.find((q) => q.id === p.parent);
						if (!parent) return null;
						return (
							<path
								key={`edge-${parent.id}-${p.id}`}
								d={`M${parent.x + 60},${parent.y} C${parent.x + 100},${parent.y} ${p.x - 40},${p.y} ${p.x},${p.y}`}
								stroke="#bbb"
								strokeWidth={3}
								fill="none"
							/>
						);
					})}
				{positions.map((p) => (
					<g key={`node-${p.id}-${p.parent}`}>
						<rect x={p.x - 60} y={p.y - 20} rx={22} ry={22} width={120} height={40} fill={nodeColor(p.depth)} stroke="#333" strokeWidth={p.depth === 0 ? 3 : 2} />
						<text
							x={p.x}
							y={p.y}
							textAnchor="middle"
							dy=".35em"
							fontSize={p.depth === 0 ? 20 : 16}
							fill="#fff"
							fontWeight={p.depth === 0 ? 700 : 500}
							style={{ fontFamily: "sans-serif", pointerEvents: "none" }}
						>
							{p.label}
						</text>
					</g>
				))}
			</svg>
		);
	}, []);

	const handleExportMindmap = useCallback(
		async (e?: React.MouseEvent) => {
			e?.stopPropagation();
			if (!mindmapRef.current) return;
			const canvas = await html2canvas(mindmapRef.current, { backgroundColor: "#f3f4f6", scale: 2 });
			const url = canvas.toDataURL("image/png");
			const a = document.createElement("a");
			const rootLabel = tocTree?.label?.trim() || "toc";
			const slug = slugify(rootLabel);
			a.href = url;
			a.download = `${slug}-mindmap.png`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setExportMenuOpen(false);
		},
		[tocTree]
	);

	const handleExportPdf = useCallback(
		(e?: React.MouseEvent) => {
			e?.stopPropagation();
			const htmlContent = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<title>TOC Export</title>
				<style>
					body { font-family: sans-serif; margin: 40px; }
					h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; }
					ul { margin-left: 1.5em; }
					li { margin-bottom: 0.5em; }
					pre { background: #f5f5f5; padding: 1em; border-radius: 6px; }
					code { background: #f5f5f5; border-radius: 4px; padding: 2px 4px; }
					p { margin: 0.5em 0; }
					a { color: #1976d2; text-decoration: underline; }
				</style>
			</head>
			<body>
				${tocTree ? tocToHtml(tocTree, 1) : ""}
			</body>
			</html>
		`;
			const iframe = document.createElement("iframe");
			Object.assign(iframe.style, {
				position: "fixed",
				right: "0",
				bottom: "0",
				width: "0",
				height: "0",
				border: "0",
			});
			document.body.appendChild(iframe);
			iframe.contentDocument!.open();
			iframe.contentDocument!.write(htmlContent);
			console.log(htmlContent);
			iframe.contentDocument!.close();
			iframe.onload = () => {
				iframe.contentWindow!.focus();
				iframe.contentWindow!.print();
				setTimeout(() => document.body.removeChild(iframe), 1000);
			};
			setExportMenuOpen(false);
		},
		[tocTree]
	);

	const handleExportJson = useCallback(
		(e?: React.MouseEvent) => {
			e?.stopPropagation();
			if (!tocTree) return;

			const jsonData = JSON.stringify(tocTree, null, 2);
			const blob = new Blob([jsonData], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");

			const rootLabel = tocTree.label?.trim() || "toc";
			const slug = slugify(rootLabel);
			a.href = url;
			a.download = `${slug}-toc.json`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
			setExportMenuOpen(false);
		},
		[tocTree]
	);

	const handleImportJson = useCallback((e?: React.MouseEvent) => {
		e?.stopPropagation();
		fileInputRef.current?.click();
		setExportMenuOpen(false);
	}, []);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = (event) => {
				try {
					const json = JSON.parse(event.target?.result as string);
					if (onImportJson && json) {
						onImportJson(json);
					}
				} catch {
					alert("Invalid JSON file.");
				}
			};
			reader.readAsText(file);
			e.target.value = "";
		},
		[onImportJson]
	);

	const filterTree = useCallback(
		(node: TocNode): TocNode | null => {
			if (!search.trim()) return node;
			const match = node.label.toLowerCase().includes(search.trim().toLowerCase());
			let filteredChildren: TocNode[] | undefined = undefined;
			if (node.children?.length) {
				filteredChildren = node.children.map(filterTree).filter(Boolean) as TocNode[];
			}
			if (match) {
				return { ...node, isExpanded: true, children: node.children?.map((child) => filterTree(child) || { ...child, isExpanded: true }) };
			}
			if (filteredChildren && filteredChildren.length > 0) {
				return { ...node, isExpanded: true, children: filteredChildren };
			}
			return null;
		},
		[search]
	);

	const filteredTocTree = useMemo(() => (tocTree ? filterTree(tocTree) : null), [tocTree, filterTree]);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (exportBtnRef.current && !exportBtnRef.current.contains(event.target as Node) && exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
				setExportMenuOpen(false);
			}
		}
		if (exportMenuOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [exportMenuOpen]);

	return (
		<nav aria-label="Table of Contents" className="flex flex-col relative w-full max-w-md h-full rounded-l-lg md:rounded-r-none rounded-r-lg bg-card overflow-hidden">
			<div className="h-full px-4 py-2 overflow-hidden">
				{exportMenuOpen && (
					<div style={{ position: "absolute", left: -9999, top: -9999, pointerEvents: "none" }}>
						<div ref={mindmapRef} style={{ background: "var(--background)", padding: 24, borderRadius: 12, minWidth: 900, minHeight: 600 }}>
							{mindmapPositions.length > 0 && renderMindmapSVG(mindmapPositions)}
						</div>
					</div>
				)}
				<div className="flex items-center justify-between">
					<h2 className="text-xl font-semibold capitalize">{tocTree?.label || "Table of Contents"}</h2>
					<DropdownMenu open={exportMenuOpen} onOpenChange={setExportMenuOpen}>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" ref={exportBtnRef} aria-label="Export" className="justify-end w-auto">
								<Settings className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent ref={exportMenuRef} align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
							<DropdownMenuItem onClick={handleExportMindmap}>Export Mindmap</DropdownMenuItem>
							<DropdownMenuItem onClick={handleExportPdf}>Export PDF</DropdownMenuItem>
							<DropdownMenuItem onClick={handleExportJson}>Export JSON</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={handleImportJson}>Import JSON</DropdownMenuItem>
						</DropdownMenuContent>
						<input type="file" accept="application/json" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
					</DropdownMenu>
				</div>
				<div className="mb-2">
					<Input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topics..." />
				</div>
				<ul className="list-none overflow-y-auto overflow-x-clip max-h-full hide-scrollbar">{filteredTocTree && renderNode(filteredTocTree)}</ul>
			</div>
		</nav>
	);
};

export default TocSection;
