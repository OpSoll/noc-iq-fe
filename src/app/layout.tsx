import { headers } from "next/headers";
import { ReactNode } from "react";

import "./globals.css";

import Navigation from "@/components/Navigation";
import RouteGuard from "@/components/RouteGuard";
import ClientShell from "@/components/ClientShell";
import { ToastProvider } from "@/components/ui/toast";
import { ReactQueryProvider } from "@/providers/react-query";
import { SessionProvider } from "@/providers/session";
import { AccessibilityProvider } from "@/providers/accessibility";
import { FeatureFlagProvider } from "@/providers/feature-flags";
import { NetworkStatusProvider } from "@/contexts/NetworkStatusContext";
import { OfflineBanner } from "@/components/OfflineBanner";

export const metadata = {
  title: "NOCIQ",
  description: "Base app shell",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <SessionProvider>
            <FeatureFlagProvider>
              <ToastProvider>
                <AccessibilityProvider>
                  <RouteGuard>
                    <NetworkStatusProvider>
                      <OfflineBanner />
                      <Navigation />
                      <ClientShell nonce={nonce}>{children}</ClientShell>
                    </NetworkStatusProvider>
                  </RouteGuard>
                </AccessibilityProvider>
              </ToastProvider>
            </FeatureFlagProvider>
          </SessionProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
