import { create } from 'zustand';
import { getCapabilitiesForRole, hasCapability, type Capability, type Role } from '@/services/capabilities';

interface UIStoreState {
  role: Role | null;
  capabilities: Capability[];
  setRole: (role: Role | null) => void;
  checkPermission: (capability: Capability) => boolean;
}

export const useUIStore = create<UIStoreState>((set, get) => ({
  role: null,
  capabilities: [],
  setRole: (role) => set({ role, capabilities: getCapabilitiesForRole(role) }),
  checkPermission: (capability) => {
    const { role } = get();
    return role ? hasCapability(role, capability) : false;
  },
}));
