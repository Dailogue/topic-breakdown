import React, { useRef, useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";
import { ChatSectionProps, Message } from "@/lib/types";
import MermaidDiagram from "./MermaidDiagram";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import { Trash2, RotateCcw, FileText, Square, ArrowUp } from "lucide-react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildChatPrompt } from "@/lib/prompts";

const ChatSection: React.FC<ChatSectionProps> = ({
	topicTitle,
	isRoadmapRendered,
	messages,
	setMessages,
	userLevel,
	onMessagesUpdate,
	tocNode,
	onNotesUpdate,
	tocTreeRootLabel,
	setUserLevel,
	handleApiError,
}) => {
	const [userInput, setUserInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [abortController, setAbortController] =
		useState<AbortController | null>(null);
	const chatContainerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [isNotesOpen, setIsNotesOpen] = useState(false);
	const [notesDraft, setNotesDraft] = useState<string>("");
	const isMobile = useIsMobile();

	const handleNotesToggle = () => {
		if (isNotesOpen && tocNode && onNotesUpdate) {
			onNotesUpdate(tocNode.id, notesDraft);
		}
		setIsNotesOpen((v) => !v);
		if (isNotesOpen && tocNode) {
			setNotesDraft(tocNode.notes || "");
		}
	};

	const extractQuestionsFromContent = (content: string): string[] => {
		const questions: string[] = [];
		if (!content) return questions;
		const regex = /<question>([\s\S]*?)<\/question>/gi;
		let match;
		while ((match = regex.exec(content))) {
			const q = match[1].trim();
			if (q && !questions.includes(q)) {
				questions.push(q);
			}
		}
		return questions;
	};

	useEffect(() => {
		if (isNotesOpen && tocNode) {
			setNotesDraft(tocNode.notes || "");
		}
	}, [isNotesOpen, tocNode]);

	// Auto-scroll to bottom on new message
	useEffect(() => {
		if (chatContainerRef.current) {
			chatContainerRef.current.scrollTop =
				chatContainerRef.current.scrollHeight;
		}
	}, [messages]);

	// Auto-resize textarea height
	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea && userInput) {
			textarea.style.height = "auto";
			textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
		}
	}, [userInput]);

	const streamResponse = async (
		messagesToSend: Message[],
		options?: { overview?: boolean; topicChain?: string }
	) => {
		const controller = new AbortController();
		setAbortController(controller);

		try {
			// Build OpenAI-compatible payload for Gemini on the client
			const systemContent = buildChatPrompt(
				options?.topicChain,
				userLevel
			);
			const normalizedMessages = messagesToSend.map((m) => ({
				// Accept developer as alias of user per earlier logic
				role: m.role === "developer" ? "user" : m.role,
				content: m.content,
			}));
			const payload: any = {
				model: "gemini-2.5-flash",
				messages: [
					{ role: "system", content: systemContent },
					...normalizedMessages,
				],
				stream: true,
				extra_body: {
					google: { thinkingConfig: { thinkingBudget: 128 } },
				},
			};

			const response = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
				signal: controller.signal,
			});
			if (!response.body || response.status !== 200) throw response;

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let done = false;
			let buffer = "";

			while (!done) {
				const { value, done: streamDone } = await reader.read();
				done = streamDone;
				if (value) {
					buffer += decoder.decode(value, { stream: true });
					let idx;
					// Parse SSE frames coming from Gemini proxy (data: ... lines)
					while ((idx = buffer.indexOf("\n")) !== -1) {
						const line = buffer.slice(0, idx).trim();
						buffer = buffer.slice(idx + 1);
						if (!line) continue;
						if (line === "data: [DONE]") continue;
						if (!line.startsWith("data:")) continue;
						try {
							const json = JSON.parse(line.slice(5).trim());
							const delta =
								json?.choices?.[0]?.delta?.content || "";
							if (!delta) continue;
							setMessages((prev) => {
								if (prev.length === 0) return prev;
								const lastIdx = prev.length - 1;
								const last = prev[lastIdx];
								if (last.role !== "assistant") return prev;
								const merged =
									last.content === "..."
										? delta
										: last.content + delta;
								const next = [...prev];
								next[lastIdx] = { ...last, content: merged };
								onMessagesUpdate?.(next);
								return next;
							});
						} catch {
							// Ignore parse errors on partial frames
						}
					}
				}
			}
			setIsSending(false);
			setAbortController(null);
		} catch (error) {
			setIsSending(false);
			setAbortController(null);
			if (handleApiError) {
				handleApiError(error, "chat");
			}
		}
	};

	useEffect(() => {
		if (
			tocNode &&
			tocTreeRootLabel &&
			(!messages || messages.length === 0)
		) {
			setIsSending(true);
			setMessages([{ role: "assistant" as const, content: "..." }]);
			onMessagesUpdate?.([
				{ role: "assistant" as const, content: "..." },
			]);
			const topicChain = [tocTreeRootLabel, ...tocNode.chain].join(
				" -> "
			);
			const overviewMessages = [
				{ role: "developer" as const, content: `${topicChain}` },
			];
			streamResponse(overviewMessages, { overview: true, topicChain });
		}
	}, [tocNode?.id, tocTreeRootLabel]);

	const handleSendMessage = async (messagesToUse?: Message[]) => {
		let finalMessages: Message[];

		if (messagesToUse) {
			finalMessages = [
				...messagesToUse,
				{ role: "assistant" as const, content: "..." },
			];
		} else {
			if (!userInput.trim()) return;
			finalMessages = [
				...messages,
				{ role: "user" as const, content: userInput },
				{ role: "assistant" as const, content: "..." },
			];
			setUserInput("");
		}

		setMessages(finalMessages);
		onMessagesUpdate?.(finalMessages);
		setIsSending(true);

		await streamResponse(
			messagesToUse || [
				...messages,
				{ role: "user" as const, content: userInput },
			]
		);
	};

	const handleResendMessage = async (messageIndex: number) => {
		if (isSending) return;
		const truncatedMessages = messages.slice(0, messageIndex);
		await handleSendMessage(truncatedMessages);
	};

	const handleStopStreaming = () => {
		if (abortController) {
			abortController.abort();
			setAbortController(null);
			setIsSending(false);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (
			e.key === "Enter" &&
			!e.shiftKey &&
			!isSending &&
			isRoadmapRendered
		) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const handleDeleteMessage = (messageIndex: number) => {
		const updatedMessages = messages.slice(0, messageIndex);
		setMessages(updatedMessages);
		onMessagesUpdate?.(updatedMessages);
	};

	const stripQuestions = (content: string) =>
		content.replace(/<question>[\s\S]*?<\/question>/gi, "").trim();

	// Memoised message rendering – avoids re-rendering on every keystroke
	const renderedMessages = useMemo(
		() =>
			messages.map((msg, index) => {
				if (msg.role !== "assistant") {
					return (
						<div className="mb-3" key={index}>
							<div className="rounded-xl w-fit px-3 py-2 ml-auto max-w-[85%] bg-primary text-primary-foreground">
								{msg.content}
							</div>
							{msg.role === "user" && !isSending && (
								<div className="flex justify-end">
									<Button
										variant="ghost"
										size="icon"
										onClick={() =>
											handleDeleteMessage(index)
										}
										title="Delete from here"
										type="button"
										className="mt-1"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							)}
						</div>
					);
				}

				// Assistant message: detect and render <mermaid>...</mermaid> blocks
				const content = stripQuestions(msg.content);
				const mermaidRegex = /<mermaid>([\s\S]*?)<\/mermaid>/gi;
				let lastIndex = 0;
				let match;
				const elements: React.ReactNode[] = [];
				let mermaidCount = 0;

				// HTML entity decoder for mermaid code
				const decodeEntities = (str: string) => {
					const textarea = document.createElement("textarea");
					textarea.innerHTML = str;
					return textarea.value;
				};

				while ((match = mermaidRegex.exec(content))) {
					const before = content.slice(lastIndex, match.index);
					if (before.trim()) {
						elements.push(
							<ReactMarkdown
								key={`md-${index}-${lastIndex}`}
								className="prose dark:prose-invert prose-sm max-w-none"
								remarkPlugins={[remarkMath, remarkGfm]}
								rehypePlugins={[rehypeKatex]}
							>
								{before}
							</ReactMarkdown>
						);
					}
					let diagram = match[1];
					if (diagram) {
						diagram = decodeEntities(diagram).trim();
						elements.push(
							<MermaidDiagram
								code={diagram}
								id={`mermaid-${index}-${mermaidCount}`}
								key={`mermaid-${index}-${mermaidCount}`}
							/>
						);
						mermaidCount++;
					}
					lastIndex = match.index + match[0].length;
				}
				const after = content.slice(lastIndex);
				if (after.trim()) {
					elements.push(
						<ReactMarkdown
							key={`md-${index}-after`}
							className="prose dark:prose-invert prose-sm max-w-none text-foreground"
							remarkPlugins={[remarkMath, remarkGfm]}
							rehypePlugins={[rehypeKatex]}
						>
							{after}
						</ReactMarkdown>
					);
				}

				return (
					<div className="mb-3" key={index}>
						<div className="rounded-xl text-foreground">
							{elements}
						</div>
						{/* Render question pills for assistant messages */}
						{(() => {
							const assistantQuestions =
								extractQuestionsFromContent(msg.content);
							if (assistantQuestions.length > 0) {
								return (
									<div className="mt-2 flex flex-wrap gap-2">
										{assistantQuestions.map(
											(question, qIndex) => (
												<Button
													variant="outline"
													size="sm"
													key={qIndex}
													disabled={
														!isRoadmapRendered
													}
													onClick={() => {
														if (isRoadmapRendered) {
															handleSendMessage([
																...messages,
																{
																	role: "user" as const,
																	content:
																		question,
																},
															]);
														}
													}}
													className="text-left text-xs font-medium"
												>
													{question}
												</Button>
											)
										)}
									</div>
								);
							}
							return null;
						})()}
						{msg.content &&
							!isSending &&
							index > 0 &&
							messages[index - 1].role === "user" && (
								<Button
									variant="ghost"
									size="icon"
									onClick={() => handleResendMessage(index)}
									title="Resend"
									type="button"
									className="mt-1"
								>
									<RotateCcw className="h-4 w-4" />
								</Button>
							)}
					</div>
				);
			}),
		[messages, isSending, isRoadmapRendered]
	);

	return (
		<div className="flex flex-row w-full h-full border-0 rounded-xl md:rounded-l-none md:p-4 md:pt-2">
			<div
				className={`flex flex-col flex-1 w-full transition-all duration-300 ${
					isNotesOpen && !isMobile ? "md:mr-4" : ""
				}`}
			>
				<div className="flex items-center justify-between mb-3">
					<h1 className="text-lg font-semibold capitalize text-foreground">
						{topicTitle}
					</h1>
					{tocNode?.id && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="p-1 rounded-xl focus:outline-hidden relative"
							title="Add/View Notes"
							onClick={handleNotesToggle}
						>
							<FileText className="h-5 w-5" />
							{tocNode?.notes &&
								tocNode.notes.trim().length > 0 && (
									<span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full"></span>
								)}
						</Button>
					)}
				</div>
				<div
					ref={chatContainerRef}
					className="overflow-x-hidden overflow-y-auto mb-4 hide-scrollbar grow"
				>
					{renderedMessages}
				</div>
				<div className="relative bg-input mt-auto flex flex-col items-center justify-center rounded-xl">
					<Textarea
						ref={textareaRef}
						value={userInput}
						onChange={(e) => setUserInput(e.target.value)}
						placeholder="Type your message..."
						className="pb-12 resize-none hide-scrollbar text-foreground border border-border overflow-y-auto rounded-xl min-h-[80px]"
						onKeyDown={handleKeyPress}
						disabled={isSending || !isRoadmapRendered}
						rows={2}
					/>
					<div className="flex gap-2 absolute bottom-2 right-3">
						<Select
							value={userLevel}
							onValueChange={(value: string) => {
								if (setUserLevel)
									setUserLevel(
										value as
											| "beginner"
											| "intermediate"
											| "advanced"
									);
							}}
							disabled={isSending}
						>
							<SelectTrigger className="w-32">
								<SelectValue placeholder="Select level" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="beginner">
									Beginner
								</SelectItem>
								<SelectItem value="intermediate">
									Intermediate
								</SelectItem>
								<SelectItem value="advanced">
									Advanced
								</SelectItem>
							</SelectContent>
						</Select>
						<Button
							variant="default"
							size="icon"
							onClick={
								isSending
									? handleStopStreaming
									: () => handleSendMessage()
							}
							className="w-8 h-8 rounded-full"
							disabled={!isRoadmapRendered}
							aria-label={isSending ? "Stop" : "Send"}
							type="button"
							tabIndex={-1}
						>
							{isSending ? (
								<Square
									className="h-4 w-4"
									fill="currentColor"
								/>
							) : (
								<ArrowUp className="h-5 w-5" />
							)}
						</Button>
					</div>
				</div>
			</div>

			{/* Mobile: Fullscreen overlay */}
			{isNotesOpen && tocNode?.id && isMobile && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<Card className="w-full h-full max-w-full max-h-full flex flex-col rounded-none">
						<CardHeader>
							<CardTitle>Notes</CardTitle>
						</CardHeader>
						<CardContent className="flex-1 overflow-y-auto pt-1">
							<Textarea
								className="min-h-full bg-input text-foreground border border-border"
								value={notesDraft}
								onChange={(e) => setNotesDraft(e.target.value)}
								placeholder="Write your notes for this topic..."
								rows={6}
							/>
						</CardContent>
						<CardFooter className="flex justify-end gap-2 pt-4 border-t">
							<Button
								variant="secondary"
								onClick={handleNotesToggle}
								type="button"
							>
								Close
							</Button>
							<Button
								variant="default"
								onClick={() => {
									if (tocNode && onNotesUpdate) {
										onNotesUpdate(tocNode.id, notesDraft);
									}
									setIsNotesOpen(false);
								}}
								type="button"
							>
								Save
							</Button>
						</CardFooter>
					</Card>
				</div>
			)}
			{/* Desktop: Notes pane inside ChatContainer */}
			{isNotesOpen && tocNode?.id && !isMobile && (
				<div className="hidden md:flex flex-col w-[400px] max-w-full h-full rounded-xl">
					<Card className="h-full flex flex-col border-0">
						<CardHeader>
							<CardTitle>Notes</CardTitle>
						</CardHeader>
						<CardContent className="flex-1 overflow-y-auto pt-1">
							<Textarea
								className="bg-input text-foreground border border-border min-h-full"
								value={notesDraft}
								onChange={(e) => setNotesDraft(e.target.value)}
								placeholder="Write your notes for this topic..."
							/>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
};

export default ChatSection;
