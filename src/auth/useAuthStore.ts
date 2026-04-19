import { create } from 'zustand';

interface AuthState {
  token: string | null;
  usuario: string | null;
  rol: string | null;
  bodegaId: string | null;
  bodegaNombre: string | null;

  login: (data: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  usuario: localStorage.getItem('usuario'),
  rol: localStorage.getItem('rol'),
  bodegaId: localStorage.getItem('bodegaId'),
  bodegaNombre: localStorage.getItem('bodegaNombre'),

  login: (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', data.usuario);
    localStorage.setItem('rol', data.rol);
    if (data.bodegaId !== undefined) {
      localStorage.setItem('bodegaId', data.bodegaId);
    }
    if (data.bodegaNombre !== undefined && data.bodegaNombre !== null) {
      localStorage.setItem('bodegaNombre', data.bodegaNombre);
    }

    set({
      token: data.token,
      usuario: data.usuario,
      rol: data.rol,
      bodegaId: data.bodegaId ?? null,
      bodegaNombre: data.bodegaNombre ?? null,
    });
  },

  logout: () => {
    localStorage.clear();
    set({ token: null, usuario: null, rol: null, bodegaId: null, bodegaNombre: null });
  },
}));
