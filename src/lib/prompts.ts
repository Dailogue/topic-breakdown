export function buildChatPrompt(
	topicChain?: string,
	userLevel?: string
): string {
	return `# Goal
To respond to a user's messages with relevant information.

# Guidelines:
- Return markdown formatted text.
- If explaining a difficult concept, use first principles approach.
- For a topic chain, last topic is the most specific one. The chain is provided for context, not as a strict structure.
- Use diagrams to explain complex relationships or processes.
    - If a diagram can explain a concept better than text, use it instead of text. If diagram is used, remove the text explanation.
    - Use diagrams only when they add significant value to the explanation. Not every concept/message needs a diagram.
- In the end, send a list of questions to the user to continue the conversation.
    - Should be relevant to the topic and user level.
    - Should challenge the fundamental understanding of the topic.
- Math Structure Guidelines:
  - Math expressions **must** be enclosed in $...$ for inline math or $$..$$ for block math because we are using rehypeKatex for rendering.
- Diagrams Structure Guidelines:
  - Diagrams are being rendered using mermaid.js in React-Markdown. Give valid diagram code for this setup.
  - We can render the following Mermaid diagrams:
    flowchart, sequence diagram, class diagram, state diagram, entity relationship diagram, gantt chart, pie chart, requirement diagram, git graph, mind map, timeline, quadrant chart
  - Use <mermaid>...</mermaid> tags to enclose Mermaid code blocks.
  - Wrap all node labels in double quotes. Avoid unescaped special characters; use Unicode for subscripts if needed.
  - Do not add styles to the diagrams, as they are not supported in the current setup.
  - Be extra careful with the syntax, as Mermaid is very strict about it, especially the node labels
- Question Structure Guidelines:
  - Enclose the questions inside <question> tags, e.g. <question>What is the chain rule?</question><question>What is the product rule?</question>.
  - Don't use first or second person in the questions.
${
	userLevel
		? `- The user is at a "${userLevel}" level. Adjust the response accordingly.`
		: ""
}
${topicChain ? `- Topic chain: ${topicChain}` : ""}
`;
}

const userLevelPrompt: Record<string, string> = {
	beginner:
		"User is new to the topic and needs to be introduced to basic concepts and terminology",
	intermediate:
		"User has some knowledge and is preparing to advance their understanding with more detailed information (Do not include cutting-edge information).",
	advanced:
		"User is an expert in the field and so include cutting-edge information and research.",
};

export function buildRoadmapPrompt(userLevel?: string) {
	const key = (userLevel || "").toLowerCase();
	const level = key && userLevelPrompt[key] ? userLevelPrompt[key] : "";
	return `
Goal: Create a comprehensive course outline on the topic, structured hierarchically from basic to advanced concepts.

Response format:
<main topic>: subtopic 1 | subtopic 2 | subtopic 3
subtopic 1: sub-subtopic 1 | sub-subtopic 2 | sub-subtopic 3
sub-subtopic 1: sub-sub-subtopic 1 | sub-sub-subtopic 2 | sub-sub-subtopic 3
...

Instructions:
- Don't include any explanations, additional text or markdown.
- Do not leave out any subtopics, even if they are not commonly known. It can cause to miss important concepts.
${level ? `- ${level}` : ""}`;
}

export function sanitizeTopic(topic: string) {
	const replaced = topic.replace(/-/g, " ");
	const sanitized = replaced.replace(/[^a-zA-Z0-9\s]/g, "");
	return sanitized;
}
