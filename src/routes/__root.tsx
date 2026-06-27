import {
	ClientOnly,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	createRootRouteWithContext,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { TooltipProvider } from "~/components/ui/tooltip";
import { DevTools } from "~/components/devtools";
import appCss from "../styles.css?url";

interface RouterContext {
	queryClient: QueryClient;
}

const isDev = import.meta.env.DEV;

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Radius" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	component: RootLayout,
	notFoundComponent: () => (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4">
			<h1 className="text-4xl font-bold">404</h1>
			<p className="text-muted-foreground">Page not found</p>
			<Link to="/" className="text-primary underline underline-offset-4">
				Go home
			</Link>
		</div>
	),
});

function RootLayout() {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<TooltipProvider>
					<Outlet />
				</TooltipProvider>
				{isDev && (
					<ClientOnly>
						<DevTools />
					</ClientOnly>
				)}
				<Scripts />
			</body>
		</html>
	);
}
