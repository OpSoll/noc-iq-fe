"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

export function ReactQueryProvider({ children }: { children: ReactNode }) {
    const [client] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 30_000,
                        gcTime: 5 * 60_000,
                        refetchOnWindowFocus: false,
                        retry: 2,
                        // React Query v5 uses AbortController for cancellation by default.
                        // Queries are aborted when the component unmounts or the query key changes.
                    },
                    mutations: {
                        retry: false,
                    },
                },
            }),
    );

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
