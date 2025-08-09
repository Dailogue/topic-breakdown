"use client";
import React, { useRef, useState, useEffect, useCallback, memo } from "react";
import TocSection from "./TocSection";
import ChatSection from "./ChatSection";
import Notification from "./Notification";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { omitNodeProps, slugify } from "@/lib/utils";
import { TocNode, Message, MainContainerProps } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { buildRoadmapPrompt, sanitizeTopic } from "@/lib/prompts";

// -------------------- State Hooks --------------------
const MainContainer: React.FC<MainContainerProps> = ({
	mainTopic: mainTopicProp,
	initialSubtopics = [],
}) => {
	const [mainTopic, setMainTopic] = useState<string>(mainTopicProp || "");
	const [tocTree, setTocTree] = useState<TocNode | null>(null);
	const [selectedNode, setSelectedNode] = useState<TocNode | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [containerHeight, setContainerHeight] = useState<number | null>(null);
	const [isMobile, setIsMobile] = useState(false);
	const [isTablet, setIsTablet] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [notification, setNotification] = useState<{
		message: string;
		type: "error" | "success" | "info";
		isVisible: boolean;
	}>({
		message: "",
		type: "info",
		isVisible: false,
	});
	const [userLevel, setUserLevel] = useState<
		"beginner" | "intermediate" | "advanced"
	>("beginner");
	const [isChatModalOpen, setIsChatModalOpen] = useState(false);
	const [isFirstTokenReceived, setIsFirstTokenReceived] = useState(false);
	const abortControllerRef = useRef<AbortController | null>(null);
	const params = useParams();
	const router = useRouter();
	const searchParams = useSearchParams();
	const updateQueueRef = useRef<(() => Promise<void>)[]>([]);
	const isUpdatingRef = useRef(false);
	const slug =
		typeof params.slug === "string"
			? params.slug
			: Array.isArray(params.slug)
			? params.slug[0]
			: "";

	// Set userLevel from URL param on mount or when searchParams changes
	useEffect(() => {
		const levelParam = searchParams?.get("level");
		if (
			levelParam === "beginner" ||
			levelParam === "intermediate" ||
			levelParam === "advanced"
		) {
			setUserLevel(levelParam);
		} else {
			setUserLevel("beginner");
		}
	}, [searchParams]);

	// -------------------- Effects --------------------
	useEffect(() => {
		const handleResize = () => {
			const width = window.innerWidth;
			setIsMobile(width < 768);
			setIsTablet(width >= 768 && width < 1024);
		};
		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	// Persist the current graph and selected node to localStorage whenever they change
	useEffect(() => {
		if (!tocTree) return;
		const topic = tocTree.label;
		const cleanedTocTree = omitNodeProps(tocTree);
		const graphData = { tocTree: cleanedTocTree };
		try {
			localStorage.setItem(
				`graph_${topic.toLowerCase().replace(/\s+/g, "")}`,
				JSON.stringify(graphData)
			);
		} catch {
			// Ignore persist errors for now
		}
	}, [tocTree]);

	useEffect(() => {
		if (mainTopicProp !== undefined) {
			setMainTopic(mainTopicProp);
		} else if (slug) {
			const topic = slug.replace(/-/g, " ");
			setMainTopic(topic);
		}
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, [mainTopicProp, slug]);

	useEffect(() => {
		if (mainTopic) {
			handleGenerateGraph();
		}
	}, [mainTopic]);

	useEffect(() => {
		function calculateContainerHeight() {
			const header = document.querySelector("div.mb-6");

			const headerHeight =
				header instanceof HTMLElement ? header.offsetHeight : 0;

			const total = headerHeight;
			const vh = window.innerHeight - 104;
			const newHeight = Math.max(vh - total, 100);
			setContainerHeight(newHeight);
		}
		calculateContainerHeight();
		window.addEventListener("resize", calculateContainerHeight);

		const observer = new MutationObserver(calculateContainerHeight);
		const header = document.querySelector("div.mb-6");
		[header].forEach((el) => {
			if (el)
				observer.observe(el, {
					childList: true,
					subtree: true,
					attributes: true,
				});
		});

		return () => {
			window.removeEventListener("resize", calculateContainerHeight);
			observer.disconnect();
		};
	}, []);

	// Select subtopic node if initialSubtopics are provided and tocTree is loaded
	useEffect(() => {
		if (
			tocTree &&
			initialSubtopics.length > 0 &&
			!selectedNode &&
			mainTopic &&
			tocTree.label.toLowerCase() === mainTopic.toLowerCase()
		) {
			let node: TocNode | null = tocTree;
			for (const sub of initialSubtopics) {
				if (!node?.children) break;
				node =
					node.children.find(
						(child) =>
							child.label.toLowerCase().replace(/-/g, " ") ===
							sub.toLowerCase().replace(/-/g, " ")
					) || null;
			}
			if (node) {
				handleNodeSelect(node);
			}
		} else if (
			tocTree &&
			!selectedNode &&
			mainTopic &&
			tocTree.label.toLowerCase() === mainTopic.toLowerCase()
		) {
			// If no initial subtopics, select the main topic node
			handleNodeSelect(tocTree);
		}
		// Only run when tocTree or initialSubtopics change
	}, [tocTree, initialSubtopics, mainTopic, selectedNode]);

	// -------------------- Handlers & Utilities --------------------
	const handleApiError = useCallback((error: unknown, operation: string) => {
		setNotification({
			message: `Failed to ${operation}. Please try again later. Error: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
			type: "error",
			isVisible: true,
		});
	}, []);

	const updateRoadmap = async (topic: string) => {
		try {
			setTocTree(null);
			setIsFirstTokenReceived(false);
			// Client-side validation
			if (!topic || typeof topic !== "string" || topic.length > 500) {
				throw new Error("Invalid topic");
			}

			const sys = buildRoadmapPrompt(userLevel);
			const userContent = sanitizeTopic(topic);
			const payload: any = {
				model: "gemini-2.5-flash",
				messages: [
					{ role: "system", content: sys },
					{ role: "user", content: userContent },
				],
				stream: true,
				extra_body: {
					google: { thinkingConfig: { thinkingBudget: 0 } },
				},
			};

			const response = await fetch("/api/roadmap", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!response.ok) {
				throw response;
			}
			if (!response.body) {
				return null;
			}
			let content = "";
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let firstToken = false;
			let buffer = "";
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				if (!value) continue;
				buffer += decoder.decode(value, { stream: true });
				let idx;
				while ((idx = buffer.indexOf("\n")) !== -1) {
					const line = buffer.slice(0, idx).trim();
					buffer = buffer.slice(idx + 1);
					if (!line) continue;
					if (line === "data: [DONE]") continue;
					if (!line.startsWith("data:")) continue;
					try {
						const json = JSON.parse(line.slice(5).trim());
						const delta: string =
							json?.choices?.[0]?.delta?.content || "";
						if (!delta) continue;
						content += delta;
						if (!firstToken && delta.trim().length > 0) {
							setIsFirstTokenReceived(true);
							firstToken = true;
						}
						// Process only full lines from accumulated content
						if (!content.includes("\n")) continue;
						const split = content.split("\n");
						const lines = split.slice(0, split.length - 1);
						content = split[split.length - 1];
						for (const l of lines) {
							if (!l.trim()) continue;
							const colonIdx = l.indexOf(":");
							if (colonIdx !== -1) {
								const t = l.slice(0, colonIdx).trim();
								const subtopics = l
									.slice(colonIdx + 1)
									.trim()
									.split("|")
									.map((subtopic) => subtopic.trim());
								updateTocTree(t, subtopics);
							}
						}
					} catch {
						// ignore partial parse errors
					}
				}
			}
		} catch (error) {
			handleApiError(error, "generate roadmap");
			return null;
		} finally {
			setIsFirstTokenReceived(true);
		}
	};

	const processUpdateQueue = useCallback(async () => {
		if (isUpdatingRef.current) return;
		isUpdatingRef.current = true;
		while (updateQueueRef.current.length > 0) {
			const fn = updateQueueRef.current.shift();
			if (fn) {
				await fn();
			}
		}
		isUpdatingRef.current = false;
	}, []);

	const updateTocTree = (topic: string, subtopics: string[]): void => {
		updateQueueRef.current.push(async () => {
			setTocTree((prevTocTree) => {
				const findNodeByLabel = (
					node: TocNode | null,
					label: string
				): TocNode | null => {
					if (!node) return null;
					if (node.label === label) return node;
					if (node.children) {
						for (const child of node.children) {
							const found = findNodeByLabel(child, label);
							if (found) return found;
						}
					}
					return null;
				};

				if (prevTocTree) {
					const node = findNodeByLabel(prevTocTree, topic);
					if (node) {
						node.children = subtopics.map((subtopic) => ({
							id: subtopic,
							label: subtopic,
							chain: [...node.chain, subtopic],
							messages: [],
							children: [],
							isExpanded: true,
							isRead: false,
						}));
						return { ...prevTocTree };
					}
					return prevTocTree;
				}
				const newNode: TocNode = {
					id: topic,
					label: topic,
					chain: [topic],
					messages: [],
					children: subtopics.map((subtopic) => ({
						id: subtopic,
						label: subtopic,
						chain: [topic, subtopic],
						messages: [],
						children: [],
						isExpanded: true,
						isRead: false,
					})),
					isExpanded: true,
					isRead: false,
				};
				return newNode;
			});
		});
		processUpdateQueue();
	};

	const resetUIState = useCallback(() => {
		setTocTree(null);
		setSelectedNode(null);
		setMessages([]);
		setIsLoading(false);
		setNotification({ message: "", type: "info", isVisible: false });
	}, []);

	// -------------------- Handlers & Utilities --------------------
	const handleLoadGraph = useCallback((topic: string) => {
		const data = localStorage.getItem(
			`graph_${topic.toLowerCase().replace(/\s+/g, "")}`
		);
		if (!data) {
			setNotification({
				message: `No saved breakdown found for "${topic}".`,
				type: "error",
				isVisible: true,
			});
			return;
		}
		try {
			const { tocTree: savedTree } = JSON.parse(data);
			savedTree.isExpanded = true;
			setTocTree(savedTree);
			setNotification({
				message: `Breakdown for "${savedTree.label}" loaded.`,
				type: "success",
				isVisible: true,
			});
		} catch {
			setNotification({
				message: "Failed to load breakdown.",
				type: "error",
				isVisible: true,
			});
		}
	}, []);

	const handleGenerateGraph = useCallback(() => {
		if (!mainTopic.trim()) {
			setNotification({
				message: "Please enter a main topic.",
				type: "error",
				isVisible: true,
			});
			return;
		}
		if (mainTopic.length > 500) {
			setNotification({
				message: "Main topic is too long (max 500 characters).",
				type: "error",
				isVisible: true,
			});
			return;
		}
		const newSlug = slugify(mainTopic);
		if (newSlug !== slug) {
			router.push(`/search/${newSlug}`);
			return;
		}
		const graphKey = `graph_${mainTopic.toLowerCase().replace(/\s+/g, "")}`;
		resetUIState();

		if (localStorage.getItem(graphKey) && userLevel === "beginner") {
			handleLoadGraph(mainTopic);
			return;
		}
		setIsLoading(true);
		setIsFirstTokenReceived(false);
		updateRoadmap(mainTopic)
			.then(() => {
				setIsLoading(false);
			})
			.catch(() => setIsLoading(false));
	}, [setNotification, mainTopic, router, slug, userLevel, resetUIState]);

	const updateNodeMessages = useCallback(
		(
			tree: TocNode | null,
			nodeId: string,
			newMessages: Message[]
		): TocNode | null => {
			if (!tree) return null;
			if (tree.id === nodeId) {
				return { ...tree, messages: newMessages };
			}
			if (tree.children) {
				return {
					...tree,
					children: tree.children.map(
						(child) =>
							updateNodeMessages(
								child,
								nodeId,
								newMessages
							) as TocNode
					),
				};
			}
			return tree;
		},
		[]
	);

	const expandPathToNode = useCallback(
		(tree: TocNode | null, targetNodeId: string): TocNode | null => {
			if (!tree) return null;
			
			// If this is the target node, return it as-is
			if (tree.id === targetNodeId) {
				return tree;
			}
			
			// Check if the target node is in any of the children's subtrees
			let hasTargetInSubtree = false;
			const updatedChildren = tree.children?.map((child) => {
				const updatedChild = expandPathToNode(child, targetNodeId);
				if (updatedChild && hasTargetNodeInSubtree(updatedChild, targetNodeId)) {
					hasTargetInSubtree = true;
				}
				return updatedChild || child; // Return original child if null
			});
			
			// If target is in subtree, expand this node
			if (hasTargetInSubtree) {
				return {
					...tree,
					isExpanded: true,
					children: updatedChildren,
				};
			}
			
			return {
				...tree,
				children: updatedChildren,
			};
		},
		[]
	);

	const hasTargetNodeInSubtree = useCallback(
		(tree: TocNode | null, targetNodeId: string): boolean => {
			if (!tree) return false;
			if (tree.id === targetNodeId) return true;
			return tree.children?.some((child) => hasTargetNodeInSubtree(child, targetNodeId)) || false;
		},
		[]
	);

	const handleNodeSelect = async (node: TocNode) => {
		setSelectedNode(node);
		if (isMobile) setIsChatModalOpen(true);
		const nodeMessages = (node.messages || [])
			.map((msg: any) => ({
				role: (msg.role === "user"
					? "user"
					: msg.role === "developer"
					? "developer"
					: "assistant") as "user" | "assistant" | "developer",
				content: typeof msg.content === "string" ? msg.content : "",
			}))
			.filter(
				(msg) =>
					msg.content &&
					msg.content.trim() !== "" &&
					msg.content.trim() !== "..."
			);
		setMessages(nodeMessages);

		// Expand path to the selected node and mark node as read
		setTocTree((prev) => {
			if (!prev) return prev;
			
			// First expand the path to the selected node
			const expandedTree = expandPathToNode(prev, node.id);
			
			// Then mark the node as read
			const markRead = (n: TocNode): TocNode => {
				if (n.id === node.id) return { ...n, isRead: true };
				return { ...n, children: n.children?.map(markRead) };
			};
			
			return expandedTree ? markRead(expandedTree) : prev;
		});

		setTocTree((prev) => updateNodeMessages(prev, node.id, nodeMessages));

		// --- Shallow route update ---
		try {
			const newPathWithQuery =
				"/search/" +
				node.chain.map(slugify).join("/") +
				(window.location.search || "");
			if (
				newPathWithQuery !==
				window.location.pathname + window.location.search
			) {
				window.history.replaceState(null, "", newPathWithQuery);

				// Update metadata
				const lastSlug = node.chain[node.chain.length - 1] || "";
				const slugWithSpaces = lastSlug.replace(/-/g, " ");
				const capitalizedSlug =
					slugWithSpaces.charAt(0).toUpperCase() +
					slugWithSpaces.slice(1);
				const title = `${capitalizedSlug} Breakdown`;
				const description = `${capitalizedSlug} - Learn about subtopics, connections, and get a visual breakdown to master this subject.`;

				if (typeof document !== "undefined") {
					document.title = title;
					let metaDesc = document.querySelector(
						'meta[name="description"]'
					);
					if (!metaDesc) {
						metaDesc = document.createElement("meta");
						metaDesc.setAttribute("name", "description");
						document.head.appendChild(metaDesc);
					}
					metaDesc.setAttribute("content", description);

					let linkCanonical = document.querySelector(
						'link[rel="canonical"]'
					);
					if (!linkCanonical) {
						linkCanonical = document.createElement("link");
						linkCanonical.setAttribute("rel", "canonical");
						document.head.appendChild(linkCanonical);
					}
					const canonicalUrl =
						window.location.origin +
						window.location.pathname +
						window.location.search;
					linkCanonical.setAttribute("href", canonicalUrl);
				}
			}
		} catch (_e) {
			// Ignore history errors
		}
	};

	const handleNodeExpand = async (node: TocNode) => {
		if (node && node.id === tocTree?.id && Array.isArray(node.children)) {
			setTocTree(node);
			return;
		}
		if (node.isExpanded) {
			const update = (n: TocNode): TocNode =>
				n.id === node.id
					? { ...n, isExpanded: false }
					: { ...n, children: n.children?.map(update) };
			setTocTree((prev) => (prev ? update(prev) : prev));
			return;
		}

		const update = (n: TocNode): TocNode =>
			n.id === node.id
				? { ...n, isExpanded: true }
				: { ...n, children: n.children?.map(update) };
		setTocTree((prev) => (prev ? update(prev) : prev));
	};

	const handleImportJson = useCallback((tree: TocNode) => {
		tree.isExpanded = true;
		setTocTree(tree);
		handleNodeSelect(tree);
		setNotification({
			message: `Imported breakdown for "${tree.label}".`,
			type: "success",
			isVisible: true,
		});
	}, []);

	// Add a function to update messages for the selected node in tocTree
	const handleMessagesUpdate = useCallback(
		(newMessages: Message[]) => {
			if (!selectedNode) return;
			setTocTree((prev) =>
				updateNodeMessages(prev, selectedNode.id, newMessages)
			);
		},
		[selectedNode, updateNodeMessages]
	);

	const onNotesUpdate = useCallback(
		(id: string, notes: string) => {
			if (!selectedNode || selectedNode.id !== id) return;
			if (selectedNode.notes === notes) return;

			const updateNodeNotes = (
				tree: TocNode | null,
				nodeId: string,
				newNotes: string
			): TocNode | null => {
				if (!tree) return null;
				if (tree.id === nodeId) {
					return { ...tree, notes: newNotes };
				}
				if (tree.children) {
					return {
						...tree,
						children: tree.children.map(
							(child) =>
								updateNodeNotes(
									child,
									nodeId,
									newNotes
								) as TocNode
						),
					};
				}
				return tree;
			};

			const updatedNode = { ...selectedNode, notes };
			setSelectedNode(updatedNode);
			setTocTree((prev) => updateNodeNotes(prev, id, notes));
		},
		[selectedNode]
	);

	// -------------------- Render --------------------
	return (
		<div className="container-fluid border border-border rounded-xl">
			<Notification
				message={notification.message}
				type={notification.type}
				isVisible={notification.isVisible}
				onClose={() =>
					setNotification(
						(prev: {
							message: string;
							type: "error" | "success" | "info";
							isVisible: boolean;
						}) => ({ ...prev, isVisible: false })
					)
				}
			/>
			{isLoading && !isFirstTokenReceived && (
				<div className="flex items-center justify-center h-96">
					<Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
				</div>
			)}
			{tocTree && (
				<div style={{ height: containerHeight ?? 0 }}>
					{isMobile && (
						<>
							<TocSection
								tocTree={tocTree}
								selectedNodeId={selectedNode?.id || null}
								onNodeSelect={handleNodeSelect}
								onNodeExpand={handleNodeExpand}
								onImportJson={handleImportJson}
							/>
							{isChatModalOpen && (
								<Dialog
									open={isChatModalOpen}
									onOpenChange={setIsChatModalOpen}
								>
									<DialogContent className="p-0 max-w-full w-full h-full flex flex-col">
										<DialogHeader className="flex flex-row justify-between items-center px-4 pt-4 pb-2">
											<DialogTitle className="text-lg">
												Chat
											</DialogTitle>
										</DialogHeader>
										<div className="flex-1 overflow-y-auto px-4 pb-4">
											<ChatSection
												topicTitle={
													selectedNode?.label || ""
												}
												isRoadmapRendered={!!tocTree}
												messages={messages}
												setMessages={setMessages}
												userLevel={userLevel}
												onMessagesUpdate={
													handleMessagesUpdate
												}
												tocNode={
													selectedNode ?? undefined
												}
												onNotesUpdate={onNotesUpdate}
												tocTreeRootLabel={
													tocTree?.label
												}
												setUserLevel={setUserLevel}
											/>
										</div>
									</DialogContent>
								</Dialog>
							)}
						</>
					)}
					{isTablet && (
						<div className="flex flex-row h-full">
							<div className="w-2/5 min-w-[180px] max-w-[320px] border-r">
								<TocSection
									tocTree={tocTree}
									selectedNodeId={selectedNode?.id || null}
									onNodeSelect={handleNodeSelect}
									onNodeExpand={handleNodeExpand}
									onImportJson={handleImportJson}
								/>
							</div>
							<div className="flex-1 p-2">
								<ChatSection
									topicTitle={selectedNode?.label || ""}
									isRoadmapRendered={!!tocTree}
									messages={messages}
									setMessages={setMessages}
									userLevel={userLevel}
									onMessagesUpdate={handleMessagesUpdate}
									tocNode={selectedNode ?? undefined}
									onNotesUpdate={onNotesUpdate}
									tocTreeRootLabel={tocTree?.label}
									setUserLevel={setUserLevel}
									handleApiError={handleApiError}
								/>
							</div>
						</div>
					)}
					{/* Desktop */}
					{!isMobile && !isTablet && (
						<div className="flex flex-col lg:flex-row h-full">
							<div className="w-1/3 min-w-[220px] max-w-[420px]">
								<TocSection
									tocTree={tocTree}
									selectedNodeId={selectedNode?.id || null}
									onNodeSelect={handleNodeSelect}
									onNodeExpand={handleNodeExpand}
									onImportJson={handleImportJson}
								/>
							</div>
							<div className="w-2/3 flex-1 min-w-0">
								<ChatSection
									topicTitle={selectedNode?.label || ""}
									isRoadmapRendered={!!tocTree}
									messages={messages}
									setMessages={setMessages}
									userLevel={userLevel}
									onMessagesUpdate={handleMessagesUpdate}
									tocNode={selectedNode ?? undefined}
									onNotesUpdate={onNotesUpdate}
									tocTreeRootLabel={tocTree?.label}
									setUserLevel={setUserLevel}
									handleApiError={handleApiError}
								/>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
};
export default memo(MainContainer);
