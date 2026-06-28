import { useState } from "react";

export function useCursorPagination() {
	const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
	const [cursorIndex, setCursorIndex] = useState(0);

	const cursor = cursorStack[cursorIndex];

	const goNext = (nextCursor: string) => {
		setCursorStack((prev) => {
			const newStack = prev.slice(0, cursorIndex + 1);
			newStack.push(nextCursor);
			return newStack;
		});
		setCursorIndex((i) => i + 1);
	};

	const goPrev = () => {
		if (cursorIndex > 0) setCursorIndex((i) => i - 1);
	};

	const reset = () => {
		setCursorStack([undefined]);
		setCursorIndex(0);
	};

	return { cursor, goNext, goPrev, reset, cursorIndex };
}
