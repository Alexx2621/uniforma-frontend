import { create } from "zustand";
import { api } from "../api/axios";

interface SystemConfigState {
  disabledPaths: string[];
  userDisabledPaths: Record<string, string[]>;
  productionInternalMode: boolean;
  crossStoreRoleIds: number[];
  unifyOrderRoleIds: number[];
  loaded: boolean;
  loading: boolean;
  fetchConfig: () => Promise<void>;
  setDisabledPaths: (disabledPaths: string[]) => Promise<void>;
  setProductionInternalMode: (productionInternalMode: boolean) => Promise<void>;
}

export const useSystemConfigStore = create<SystemConfigState>((set) => ({
  disabledPaths: [],
  userDisabledPaths: {},
  productionInternalMode: false,
  crossStoreRoleIds: [],
  unifyOrderRoleIds: [],
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
        productionInternalMode: Boolean(resp.data?.productionInternalMode),
        crossStoreRoleIds: Array.isArray(resp.data?.crossStoreRoleIds)
          ? resp.data.crossStoreRoleIds.map(Number).filter((value: number) => Number.isFinite(value) && value > 0)
          : [],
        unifyOrderRoleIds: Array.isArray(resp.data?.unifyOrderRoleIds)
          ? resp.data.unifyOrderRoleIds.map(Number).filter((value: number) => Number.isFinite(value) && value > 0)
          : [],
        loaded: true,
        loading: false,
      });
    } catch {
      set({
        loaded: true,
        loading: false,
        disabledPaths: [],
        userDisabledPaths: {},
        productionInternalMode: false,
        crossStoreRoleIds: [],
        unifyOrderRoleIds: [],
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

  setProductionInternalMode: async (productionInternalMode: boolean) => {
    set({ loading: true });
    try {
      await api.put("/config/notificaciones", { productionInternalMode });
      set({ productionInternalMode, loaded: true, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },
}));
