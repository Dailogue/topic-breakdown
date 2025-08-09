"use client";
import Header from "./Header";
import React from "react";
import { LayoutContainerProps } from "@/lib/types";

const LayoutContainer: React.FC<LayoutContainerProps> = ({ children }) => {
	return (
		<main className="flex flex-col min-h-screen container-fluid mx-auto pt-4 pb-0 px-4">
			<Header />
			<div className="grow p-0">{children}</div>
		</main>
	);
};

export default LayoutContainer;