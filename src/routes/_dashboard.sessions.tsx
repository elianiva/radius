import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { Sessions } from "~/features/dashboard/sessions";
import { SessionsTableLoading } from "~/features/dashboard/loading";
export const Route = createFileRoute("/_dashboard/sessions")({
	component: SessionsRoute,
});

function SessionsRoute() {
	const filters = Route.useSearch();

	return (
		<Suspense fallback={<SessionsTableLoading rows={10} />}>
			<Sessions filters={filters} />
		</Suspense>
	);
}
