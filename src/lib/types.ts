export interface NotificationProps {
	message: string;
	type: "error" | "success" | "info";
	isVisible: boolean;
	onClose: () => void;
}

export interface NotificationState {
	message: string;
	type: "error" | "success" | "info";
	isVisible: boolean;
}

export interface LogoProps {
	size?: "small" | "medium" | "large";
}

export type Message = {
	role: "user" | "assistant" | "developer";
	content: string;
};

export interface ChatSectionProps {
	topicTitle: string;
	isRoadmapRendered: boolean;
	messages: Message[];
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
	userLevel: "beginner" | "intermediate" | "advanced";
	onMessagesUpdate?: (messages: Message[]) => void;
	tocNode?: TocNode;
	onNotesUpdate?: (id: string, notes: string) => void;
	tocTreeRootLabel?: string;
	setUserLevel?: React.Dispatch<
		React.SetStateAction<"beginner" | "intermediate" | "advanced">
	>;
	handleApiError?: (error: unknown, operation: string) => void;
}

export interface LayoutContainerProps {
	children: React.ReactNode;
}

export interface LoadGraphModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export interface TocNode {
	id: string;
	label: string;
	chain: string[];
	messages: { role: string; content: any }[];
	children?: TocNode[];
	isExpanded?: boolean;
	isLoading?: boolean;
	isRead?: boolean;
	notes?: string;
}

export interface TocSectionProps {
	tocTree: TocNode;
	selectedNodeId: string | null;
	onNodeSelect: (node: TocNode) => void;
	onNodeExpand: (node: TocNode) => void;
	onImportJson?: (tree: TocNode) => void;
}

export interface SavedGraph {
	topic: string;
	topicTitle: string;
}

export interface MermaidDiagramProps {
	code: string;
	id?: string;
	className?: string;
}

export interface MainContainerProps {
	mainTopic?: string;
	initialSubtopics?: string[];
}
