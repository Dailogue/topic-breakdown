import React from "react";
import { LogoProps } from "@/lib/types";

const Logo: React.FC<LogoProps> = ({ size = "medium" }) => {
	const getSizeClass = () => {
		switch (size) {
			case "small":
				return "w-8 h-8";
			case "large":
				return "w-24 h-24";
			default:
				return "w-16 h-16";
		}
	};

	return (
		<div className={`${getSizeClass()} relative`}>
			<svg viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" className="fill-black stroke-black dark:fill-white dark:stroke-white">
				<g fill="none" fillRule="evenodd" strokeLinecap="round" strokeLinejoin="round" transform="translate(2 2)">
					<path d="m5.5.5h6v5h-6z"></path>
					<path d="m10.5 11.5h6v5h-6z"></path>
					<path d="m.5 11.5h6v5h-6z"></path>
					<path d="m3.498 11.5v-3h10v3"></path>
					<path d="m8.5 8.5v-3"></path>
				</g>
			</svg>
		</div>
	);
};

export default Logo;
