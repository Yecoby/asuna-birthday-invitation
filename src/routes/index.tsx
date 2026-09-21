import { createFileRoute } from "@tanstack/react-router";
import { InvitationApp } from "@/components/invitation/InvitationApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <InvitationApp />;
}
