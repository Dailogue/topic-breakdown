import React, { Suspense } from "react";
import MainContainer from "../../components/MainContainer";
import LayoutContainer from "../../components/LayoutContainer";
import { unslugify } from "@/lib/utils";

function SearchLoading() {
	return <div className="p-4 text-center">Loading search results...</div>;
}

export default function SearchSlugPage({ params }: { params: { slug?: string[] } }) {
	const slugArr = Array.isArray(params?.slug) ? params.slug : typeof params?.slug === "string" ? [params.slug] : [];
	const mainTopic = slugArr[0] ? unslugify(slugArr[0]) : "";
	const subtopics = slugArr.slice(1).map(unslugify);

	return (
		<LayoutContainer>
			<Suspense fallback={<SearchLoading />}>
				<MainContainer mainTopic={mainTopic} initialSubtopics={subtopics} />
			</Suspense>
		</LayoutContainer>
	);
}
