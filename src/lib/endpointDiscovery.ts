export type EndpointMetadata = {
  path: string;
  methods: string[];
  description: string;
  requiredRoles: string[];
  parameters: { name: string; type: string; required: boolean }[];
};

export type CapabilityGroup = {
  group: string;
  endpoints: EndpointMetadata[];
};

export function discoverCapabilities(metadata: EndpointMetadata[]): CapabilityGroup[] {
  const groups = new Map<string, EndpointMetadata[]>();
  for (const ep of metadata) {
    const group = ep.path.split("/")[1] || "general";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(ep);
  }
  return Array.from(groups.entries()).map(([group, endpoints]) => ({ group, endpoints }));
}

export function getCapabilityUX(metadata: EndpointMetadata[]): { navItems: { label: string; path: string; description: string }[] } {
  const groups = discoverCapabilities(metadata);
  return {
    navItems: groups.map((g) => ({
      label: g.group.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      path: `/${g.group}`,
      description: g.endpoints.map((e) => e.description).join("; "),
    })),
  };
}

export function filterByRole(metadata: EndpointMetadata[], role: string): EndpointMetadata[] {
  return metadata.filter((ep) => ep.requiredRoles.length === 0 || ep.requiredRoles.includes(role));
}
