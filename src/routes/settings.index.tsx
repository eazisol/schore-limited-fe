import { createFileRoute } from "@tanstack/react-router";

/**
 * Placeholder index route — redirect to the first settings tab is handled in
 * `settings.tsx` (SettingsLayout) because it depends on login menus.
 * Do not redirect `/settings/` → `/settings` here; that creates an infinite
 * router redirect loop when the sidebar links to `/settings`.
 */
export const Route = createFileRoute("/settings/")({
  component: () => null,
});
