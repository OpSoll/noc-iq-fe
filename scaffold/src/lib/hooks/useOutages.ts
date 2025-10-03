import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface Outage {
  id: number;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

async function fetchOutages(): Promise<Outage[]> {
  const res = await api.get("/outages");
  return res.data;
}

export function useOutages() {
  return useQuery({
    queryKey: ["outages"],
    queryFn: fetchOutages,
    staleTime: 1000 * 60 * 5, // cache for 5 minutes
  });
}
