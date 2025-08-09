"use client";

import React, { useState, memo } from "react";
import Link from "next/link";
import Logo from "./Logo";
import Notification from "./Notification";
import ThemeToggle from "./ThemeToggle";
import { NotificationState } from "@/lib/types";

const Header = () => {
	const [notification, setNotification] = useState<NotificationState>({
		message: "",
		type: "info",
		isVisible: false,
	});

	return (
		<div className="mb-4">
			<Notification message={notification.message} type={notification.type} isVisible={notification.isVisible} onClose={() => setNotification((prev) => ({ ...prev, isVisible: false }))} />

			<div className="flex justify-between items-center">
				<Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
					<Logo size="small" />
					<span className="text-xl lg:text-2xl font-semibold">Topic Breakdown</span>
				</Link>
				<div className="flex items-center gap-2">
					<ThemeToggle />
				</div>
			</div>
		</div>
	);
};

export default memo(Header);
