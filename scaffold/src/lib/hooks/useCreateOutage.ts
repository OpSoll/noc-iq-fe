import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface CreateOutageDTO {
  title: string;
  description: string;
  status: string;
}

async function createOutage(newOutage: CreateOutageDTO) {
  const res = await api.post("/outages", newOutage);
  return res.data;
}

export function useCreateOutage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOutage,
    onSuccess: () => {
      // Invalidate outages list so UI refreshes automatically
      queryClient.invalidateQueries({ queryKey: ["outages"] });
    },
  });
}
