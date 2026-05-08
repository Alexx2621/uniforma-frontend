import { create } from "zustand";
import { api } from "../api/axios";

interface SystemConfigState {
  disabledPaths: string[];
  userDisabledPaths: Record<string, string[]>;
  crossStoreRoleIds: number[];
  unifyOrderRoleIds: number[];
  vendedorDropdownRoleIds: number[];
  vendedorDropdownBodegaIds: number[];
  salesInventoryEnabled: boolean;
  loaded: boolean;
  loading: boolean;
  fetchConfig: () => Promise<void>;
  setDisabledPaths: (disabledPaths: string[]) => Promise<void>;
}

export const useSystemConfigStore = create<SystemConfigState>((set) => ({
  disabledPaths: [],
  userDisabledPaths: {},
  crossStoreRoleIds: [],
  unifyOrderRoleIds: [],
  vendedorDropdownRoleIds: [],
  vendedorDropdownBodegaIds: [],
  salesInventoryEnabled: true,
  loaded: false,
  loading: false,

  fetchConfig: async () => {
    try {
      set({ loading: true });
      const resp = await api.get("/config/notificaciones");
      set({
        disabledPaths: Array.isArray(resp.data?.disabledPaths) ? resp.data.disabledPaths : [],
        userDisabledPaths:
          resp.data?.userDisabledPaths && typeof resp.data.userDisabledPaths === "object"
            ? resp.data.userDisabledPaths
            : {},
        crossStoreRoleIds: Array.isArray(resp.data?.crossStoreRoleIds)
          ? resp.data.crossStoreRoleIds.map(Number).filter((value: number) => Number.isFinite(value) && value > 0)
          : [],
        unifyOrderRoleIds: Array.isArray(resp.data?.unifyOrderRoleIds)
          ? resp.data.unifyOrderRoleIds.map(Number).filter((value: number) => Number.isFinite(value) && value > 0)
          : [],
        vendedorDropdownRoleIds: Array.isArray(resp.data?.vendedorDropdownRoleIds)
          ? resp.data.vendedorDropdownRoleIds.map(Number).filter((value: number) => Number.isFinite(value) && value > 0)
          : [],
        vendedorDropdownBodegaIds: Array.isArray(resp.data?.vendedorDropdownBodegaIds)
          ? resp.data.vendedorDropdownBodegaIds.map(Number).filter((value: number) => Number.isFinite(value) && value > 0)
          : [],
        salesInventoryEnabled: resp.data?.salesInventoryEnabled !== false,
        loaded: true,
        loading: false,
      });
    } catch {
      set({
        loaded: true,
        loading: false,
        disabledPaths: [],
        userDisabledPaths: {},
        crossStoreRoleIds: [],
        unifyOrderRoleIds: [],
        vendedorDropdownRoleIds: [],
        vendedorDropdownBodegaIds: [],
        salesInventoryEnabled: true,
      });
    }
  },

  setDisabledPaths: async (disabledPaths: string[]) => {
    set({ loading: true });
    try {
      await api.put("/config/notificaciones", { disabledPaths });
      set({ disabledPaths, loaded: true, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

}));
