"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "./components/Logo";
import Notification from "./components/Notification";
import { NotificationState } from "@/lib/types";
import { slugify } from "@/lib/utils";

// Builds a search URL from slugified path segments and preserves the query string.
// Example: buildSearchUrl(['machine learning'], '?level=beginner')
//   => '/search/machine-learning?level=beginner'
function buildSearchUrl(pathSegments: string[], queryString?: string): string {
	const sluggedSegments = pathSegments.map((seg) => slugify(seg));
	const slugPath = sluggedSegments.join("/");
	return `/search/${slugPath}${queryString ?? ""}`;
}
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import LoadGraphModal from "./components/LoadGraphModal";
import { Loader2 } from "lucide-react";

export default function Home() {
	const [query, setQuery] = useState("");
	const handleQueryChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setQuery(e.target.value);
	}, []);
	const [userLevel, setUserLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
	const [isLoading, setIsLoading] = useState(false);
	const [notification, setNotification] = useState<NotificationState>({
		message: "",
		type: "info",
		isVisible: false,
	});
	const [isLoadGraphModalOpen, setIsLoadGraphModalOpen] = useState(false);
	const router = useRouter();

	const staticTopics = ["Machine Learning", "Web Development", "Psychology", "Climate Change", "Music Theory"];
	const topicUrls = React.useMemo(() => staticTopics.map((topic) => buildSearchUrl([topic], `?level=${userLevel}`)), [userLevel]);

	const handleSearch = (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		const sanitizedQuery = query.trim();

		if (sanitizedQuery && sanitizedQuery.length <= 500) {
			setIsLoading(true);
			const url = buildSearchUrl([sanitizedQuery], `?level=${userLevel}`);
			router.push(url);
		} else if (sanitizedQuery.length > 500) {
			setNotification({
				message: "Search query is too long",
				type: "error",
				isVisible: true,
			});
		}
	};

	const handleTopicClick = (topic: string) => {
		setIsLoading(true);
		const url = buildSearchUrl([topic], `?level=${userLevel}`);
		router.push(url);
	};

	return (
		<div className="container-fluid p-4 pb-0 min-h-screen flex flex-col">
			<Notification message={notification.message} type={notification.type} isVisible={notification.isVisible} onClose={() => setNotification((prev) => ({ ...prev, isVisible: false }))} />
			<div className="grow flex items-center justify-center">
				<div className="w-full max-w-xl p-4">
					<div className="flex flex-col items-center mb-8">
						<Logo size="large" />
						<h1 className="text-3xl font-bold mt-4 text-center">Topic Breakdown</h1>
						<p className="mt-2 text-center">Discover, learn, and visualize complex topics</p>
					</div>

					<form onSubmit={handleSearch} className="w-full">
						<div className="relative w-full bg-input rounded-xl">
							<Textarea
								value={query}
								onChange={handleQueryChange}
								placeholder="Type your message..."
								className="resize-none hide-scrollbar text-foreground border border-border overflow-y-auto rounded-xl"
								rows={4}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										handleSearch();
									}
								}}
							/>
							<div className="flex gap-2 absolute bottom-2 right-3">
								<Select value={userLevel} onValueChange={(value) => setUserLevel(value as "beginner" | "intermediate" | "advanced")} disabled={isLoading}>
									<SelectTrigger className="w-32">
										<SelectValue placeholder="Select level" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="beginner">Beginner</SelectItem>
										<SelectItem value="intermediate">Intermediate</SelectItem>
										<SelectItem value="advanced">Advanced</SelectItem>
									</SelectContent>
								</Select>
								<Button type="submit" disabled={isLoading} size="icon" className="w-8 h-8 rounded-full">
									{isLoading ? (
										<Loader2 className="animate-spin w-5 h-5" />
									) : (
										<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
										</svg>
									)}
								</Button>
							</div>
							<div className="flex gap-2 absolute bottom-2 left-3">
								<Button type="button" disabled={isLoading} size="icon" className="w-8 h-8 rounded-full" variant={"secondary"} onClick={() => setIsLoadGraphModalOpen(true)}>
									<svg className="h-5 w-5" fill="currentColor" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
										<path d="M5.07868 5.06891C8.87402 1.27893 15.0437 1.31923 18.8622 5.13778C22.6824 8.95797 22.7211 15.1313 18.9262 18.9262C15.1312 22.7211 8.95793 22.6824 5.13774 18.8622C2.87389 16.5984 1.93904 13.5099 2.34047 10.5812C2.39672 10.1708 2.775 9.88377 3.18537 9.94002C3.59575 9.99627 3.88282 10.3745 3.82658 10.7849C3.4866 13.2652 4.27782 15.881 6.1984 17.8016C9.44288 21.0461 14.6664 21.0646 17.8655 17.8655C21.0646 14.6664 21.046 9.44292 17.8015 6.19844C14.5587 2.95561 9.33889 2.93539 6.13935 6.12957L6.88705 6.13333C7.30126 6.13541 7.63535 6.47288 7.63327 6.88709C7.63119 7.3013 7.29372 7.63539 6.87951 7.63331L4.33396 7.62052C3.92269 7.61845 3.58981 7.28556 3.58774 6.8743L3.57495 4.32874C3.57286 3.91454 3.90696 3.57707 4.32117 3.57498C4.73538 3.5729 5.07285 3.907 5.07493 4.32121L5.07868 5.06891ZM11.9999 7.24992C12.4141 7.24992 12.7499 7.58571 12.7499 7.99992V11.6893L15.0302 13.9696C15.3231 14.2625 15.3231 14.7374 15.0302 15.0302C14.7373 15.3231 14.2624 15.3231 13.9696 15.0302L11.2499 12.3106V7.99992C11.2499 7.58571 11.5857 7.24992 11.9999 7.24992Z"></path>
									</svg>
								</Button>
							</div>
						</div>
					</form>

					<div className="mt-8">
						<p className="text-center mb-3">Try exploring these topics:</p>
						<div className="flex flex-wrap justify-center gap-2">
							{staticTopics.map((topic, index) => (
								<a
									key={index}
									href={topicUrls[index]}
									onClick={(e) => {
										e.preventDefault();
										handleTopicClick(topic);
									}}
									className="no-underline"
									tabIndex={0}
									aria-label={`Explore ${topic}`}
								>
									<Badge className="cursor-pointer px-4 py-2 text-sm font-medium rounded-full" variant="secondary">
										{topic}
									</Badge>
								</a>
							))}
						</div>
					</div>
				</div>
			</div>
			<LoadGraphModal isOpen={isLoadGraphModalOpen} onClose={() => setIsLoadGraphModalOpen(false)} />
		</div>
	);
}
