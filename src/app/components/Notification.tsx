"use client";

import React, { useEffect, useState, useRef } from "react";
import { NotificationProps } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

const Notification: React.FC<NotificationProps> = ({ message, type, isVisible, onClose }) => {
	const [isShowing, setIsShowing] = useState(false);
	const [progress, setProgress] = useState(100);
	const progressInterval = useRef<NodeJS.Timeout | null>(null);
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const lastMessage = useRef<string>("");
	const lastType = useRef<string>("");

	useEffect(() => {
		setIsShowing(isVisible);
	}, [isVisible]);

	useEffect(() => {
		if (isVisible) {
			const isSame = message === lastMessage.current && type === lastType.current;
			if (isSame && isShowing) {
				setTimeout(() => {
					onClose();
				}, 0);
				return;
			}

			setProgress(100);

			if (progressInterval.current) clearInterval(progressInterval.current);
			if (timerRef.current) clearTimeout(timerRef.current);

			progressInterval.current = setInterval(() => {
				setProgress((prev) => {
					if (prev <= 0) {
						if (progressInterval.current) clearInterval(progressInterval.current);
						return 0;
					}
					return prev - 2;
				});
			}, 100);

			timerRef.current = setTimeout(() => {
				onClose();
			}, 5000);

			lastMessage.current = message;
			lastType.current = type;
		}
		return () => {
			if (progressInterval.current) clearInterval(progressInterval.current);
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [isVisible, message, type, onClose]);

	const renderIcon = () => {
		switch (type) {
			case "error":
				return (
					<span className="text-destructive">
						<AlertCircle className="w-5 h-5" />
					</span>
				);
			case "success":
				return (
					<span className="text-green-600">
						<CheckCircle className="w-5 h-5" />
					</span>
				);
			case "info":
			default:
				return (
					<span className="text-blue-600">
						<Info className="w-5 h-5" />
					</span>
				);
		}
	};

	if (!isVisible) return null;

	return (
		<Card className={`fixed top-4 right-4 max-w-sm w-full z-50 shadow-lg transition-all duration-500 ease-in-out ${isShowing ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-12"}`}>
			<div className="flex items-center gap-3 p-4">
				{renderIcon()}
				<div className="flex-1">
					<span className="font-medium">{message}</span>
				</div>
				<button onClick={onClose} className="ml-4 shrink-0 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close notification" type="button">
					<X className="w-5 h-5" />
				</button>
			</div>
			<Progress value={progress} className="h-1 w-full" />
		</Card>
	);
};

export default Notification;
