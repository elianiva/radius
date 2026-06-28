import { useRef, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { WrappedData } from "./services/wrapped";
import { TitleSlide } from "./slides/title";
import { StatsSlide } from "./slides/stats";
import { BusiestDaySlide } from "./slides/busiest-day";
import { MostUsedModelSlide } from "./slides/most-used-model";
import { ModelJourneySlide } from "./slides/model-journey";
import { MostExpensiveSlide } from "./slides/most-expensive";
import { LongestSessionSlide } from "./slides/longest-session";
import { SwearingSlide } from "./slides/swearing";
import { PeakToolSlide } from "./slides/peak-tool";
import { ProjectBreakdownSlide } from "./slides/project-breakdown";
import { ThinkingModeSlide } from "./slides/thinking-mode";
import { ErrorDaysSlide } from "./slides/error-days";
import { ClosingSlide } from "./slides/closing";

interface Props {
	data: WrappedData;
	year: number | undefined;
	onYearChange: (year: number | undefined) => void;
}

function useActiveSlide(slideCount: number) {
	const [activeIndex, setActiveIndex] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);

	const scrollTo = (index: number) => {
		const container = containerRef.current;
		if (!container) return;
		const target = Math.max(0, Math.min(index, slideCount - 1));
		container.children[target]?.scrollIntoView({ behavior: "smooth" });
		setActiveIndex(target);
	};

	const handleScroll = () => {
		const container = containerRef.current;
		if (!container) return;
		const scrollTop = container.scrollTop;
		const heights = Array.from(container.children).map(
			(child) => (child as HTMLElement).offsetHeight,
		);
		let accumulated = 0;
		for (let i = 0; i < heights.length; i++) {
			accumulated += heights[i];
			if (scrollTop < accumulated - heights[i] / 2) {
				setActiveIndex(i);
				return;
			}
		}
		setActiveIndex(heights.length - 1);
	};

	return { activeIndex, containerRef, scrollTo, handleScroll, setActiveIndex };
}

export function Wrapped({ data, year, onYearChange }: Props) {
	const slides = [
		{
			id: "title",
			component: <TitleSlide data={data} year={year ?? 0} onYearChange={onYearChange} />,
		},
		{ id: "stats", component: <StatsSlide data={data.totalStats} /> },
		...(data.busiestDay
			? [{ id: "busiest-day", component: <BusiestDaySlide busiestDay={data.busiestDay} /> }]
			: []),
		...(data.mostUsedModel
			? [
					{
						id: "most-used-model",
						component: (
							<MostUsedModelSlide
								model={data.mostUsedModel}
								totalSessions={data.totalStats.totalSessions}
							/>
						),
					},
				]
			: []),
		...(data.modelJourney.length > 0
			? [{ id: "model-journey", component: <ModelJourneySlide journey={data.modelJourney} /> }]
			: []),
		...(data.mostExpensiveSession
			? [
					{
						id: "most-expensive",
						component: <MostExpensiveSlide session={data.mostExpensiveSession} />,
					},
				]
			: []),
		...(data.longestSession
			? [
					{
						id: "longest-session",
						component: <LongestSessionSlide session={data.longestSession} />,
					},
				]
			: []),
		...(data.totalStats.totalSwears > 0 && data.totalStats.topSwear
			? [
					{
						id: "swearing",
						component: (
							<SwearingSlide
								totalSwears={data.totalStats.totalSwears}
								topSwear={data.totalStats.topSwear}
							/>
						),
					},
				]
			: []),
		...(data.peakTool
			? [{ id: "peak-tool", component: <PeakToolSlide tool={data.peakTool} /> }]
			: []),
		...(data.projectBreakdown.length > 0
			? [
					{
						id: "project-breakdown",
						component: <ProjectBreakdownSlide breakdown={data.projectBreakdown} />,
					},
				]
			: []),
		...(data.thinkingLevels.length > 0
			? [{ id: "thinking-mode", component: <ThinkingModeSlide levels={data.thinkingLevels} /> }]
			: []),
		...(data.worstErrorDay
			? [{ id: "error-days", component: <ErrorDaysSlide day={data.worstErrorDay} /> }]
			: []),
		{ id: "closing", component: <ClosingSlide data={data} /> },
	];

	const { activeIndex, containerRef, scrollTo, handleScroll } = useActiveSlide(slides.length);

	return (
		<div className="relative h-[calc(100vh-5rem)]">
			<div
				ref={containerRef}
				onScroll={handleScroll}
				className="h-full snap-y snap-mandatory overflow-y-scroll scroll-smooth"
			>
				{slides.map((slide) => (
					<section key={slide.id} className="flex h-full snap-start items-center justify-center">
						{slide.component}
					</section>
				))}
			</div>

			{/* Progress bar */}
			<div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
				<div className="flex flex-col items-center gap-1">
					{slides.map((_, i) => (
						<button
							key={i}
							onClick={() => scrollTo(i)}
							className={`h-1.5 rounded-full transition-all ${
								i === activeIndex
									? "w-4 bg-primary"
									: "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
							}`}
						/>
					))}
				</div>
			</div>

			{/* Prev/Next nav */}
			<div className="absolute bottom-6 right-4 flex gap-1">
				<button
					onClick={() => scrollTo(activeIndex - 1)}
					disabled={activeIndex === 0}
					className="flex size-8 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
				>
					<ChevronUp className="size-4" />
				</button>
				<button
					onClick={() => scrollTo(activeIndex + 1)}
					disabled={activeIndex === slides.length - 1}
					className="flex size-8 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
				>
					<ChevronDown className="size-4" />
				</button>
			</div>

			{/* Slide counter */}
			<div className="absolute bottom-6 left-4 text-xs tabular-nums text-muted-foreground">
				{activeIndex + 1} / {slides.length}
			</div>
		</div>
	);
}
