import { ReactNode } from "react";
import "./globals.css";
import Navigation from "@/components/Navigation";
import RouteGuard from "@/components/RouteGuard";
import ClientShell from "@/components/ClientShell";
import { ReactQueryProvider } from "@/providers/react-query";
import { SessionProvider } from "@/providers/session";
import { ToastProvider } from "@/components/ui/toast";
import { AccessibilityProvider } from "@/providers/accessibility";

export const metadata = {
  title: "NOCIQ",
  description: "Base app shell",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <SessionProvider>
            <ToastProvider>
              <RouteGuard>
                <Navigation />
                <ClientShell>
                  {children}
                </ClientShell>
              </RouteGuard>
            </ToastProvider>
          </SessionProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
