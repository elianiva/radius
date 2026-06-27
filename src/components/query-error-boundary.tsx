import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Component, useCallback, useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export interface QueryErrorBoundaryProps {
	children: React.ReactNode;
	fallback?: React.ReactNode | ((props: { error: Error; reset: () => void }) => React.ReactNode);
	onReset?: () => void;
	resetKeys?: unknown[];
}

interface ErrorBoundaryState {
	error: Error | null;
}

class ErrorBoundaryClass extends Component<
	QueryErrorBoundaryProps & {
		onResetQuery: () => void;
		resetKeysRef: React.MutableRefObject<unknown[] | undefined>;
	},
	ErrorBoundaryState
> {
	state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return { error };
	}

	componentDidUpdate() {
		const { resetKeys } = this.props;
		if (this.state.error && resetKeys) {
			const prev = this.props.resetKeysRef.current;
			if (prev && (prev.length !== resetKeys.length || prev.some((k, i) => k !== resetKeys[i]))) {
				this.reset();
			}
		}
		this.props.resetKeysRef.current = resetKeys;
	}

	reset = () => {
		this.props.onResetQuery();
		this.props.onReset?.();
		this.setState({ error: null });
	};

	render() {
		if (this.state.error) {
			if (this.props.fallback) {
				if (typeof this.props.fallback === "function") {
					return this.props.fallback({ error: this.state.error, reset: this.reset });
				}
				return this.props.fallback;
			}
			return (
				<Card className="mx-auto mt-8 max-w-md">
					<CardContent className="flex flex-col items-center gap-4 py-8">
						<p className="text-sm text-muted-foreground">Something went wrong loading this data.</p>
						<Button variant="outline" onClick={this.reset}>
							Try again
						</Button>
					</CardContent>
				</Card>
			);
		}
		return this.props.children;
	}
}

export function QueryErrorBoundary({
	children,
	fallback,
	onReset,
	resetKeys,
}: QueryErrorBoundaryProps) {
	const { reset: resetQuery } = useQueryErrorResetBoundary();
	const resetKeysRef = useRef<unknown[] | undefined>(resetKeys);

	useEffect(() => {
		resetKeysRef.current = resetKeys;
	}, [resetKeys]);

	const handleResetQuery = useCallback(() => {
		resetQuery();
	}, [resetQuery]);

	return (
		<ErrorBoundaryClass
			fallback={fallback}
			onReset={onReset}
			resetKeys={resetKeys}
			onResetQuery={handleResetQuery}
			resetKeysRef={resetKeysRef}
		>
			{children}
		</ErrorBoundaryClass>
	);
}
