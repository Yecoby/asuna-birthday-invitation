import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { event } from "@/lib/event";
import appCss from "../styles.css?url";

const siteUrl = "https://asuna-birthday-invitation.vercel.app";
const shareImageUrl = `${siteUrl}/invitation/hero.jpg`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: event.pageTitle },
      { name: "description", content: event.pageDescription },
      { name: "theme-color", content: "#f8d8ee" },
      { property: "og:title", content: "Iria Asuna's Birthday Invitation" },
      { property: "og:description", content: "You're invited to a magical fairy garden celebration! ✨🌸" },
      { property: "og:image", content: shareImageUrl },
      { property: "og:image:alt", content: "Iria Asuna's fairy garden birthday invitation" },
      { property: "og:url", content: siteUrl },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Iria Asuna's Birthday Invitation" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Nunito:wght@400;600;700;800&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
