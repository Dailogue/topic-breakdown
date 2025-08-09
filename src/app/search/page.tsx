import React, { Suspense } from "react";
import MainContainer from "../components/MainContainer";
import LayoutContainer from "../components/LayoutContainer";

export default function SearchPage() {
	return (
		<LayoutContainer>
			<Suspense fallback={<div className="p-4 text-center">Loading search results...</div>}>
				<MainContainer />
			</Suspense>
		</LayoutContainer>
	);
}
