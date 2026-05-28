import { createFileRoute } from "@tanstack/react-router";
import { Sessions } from "~/features/dashboard/sessions";

export const Route = createFileRoute("/_dashboard/sessions")({
  component: SessionsRoute,
});

function SessionsRoute() {
  return <Sessions />;
}
