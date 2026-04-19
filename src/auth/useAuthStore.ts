import { create } from 'zustand';

interface AuthState {
  token: string | null;
  usuario: string | null;
  nombre: string | null;
  primerNombre: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
  fotoUrl: string | null;
  rol: string | null;
  permisos: string[];
  bodegaId: string | null;
  bodegaNombre: string | null;

  login: (data: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  usuario: localStorage.getItem('usuario'),
  nombre: localStorage.getItem('nombre'),
  primerNombre: localStorage.getItem('primerNombre'),
  primerApellido: localStorage.getItem('primerApellido'),
  segundoApellido: localStorage.getItem('segundoApellido'),
  fotoUrl: localStorage.getItem('fotoUrl'),
  rol: localStorage.getItem('rol'),
  permisos: JSON.parse(localStorage.getItem('permisos') || '[]'),
  bodegaId: localStorage.getItem('bodegaId'),
  bodegaNombre: localStorage.getItem('bodegaNombre'),

  login: (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', data.usuario);
    localStorage.setItem('nombre', data.nombre ?? '');
    localStorage.setItem('primerNombre', data.primerNombre ?? '');
    localStorage.setItem('primerApellido', data.primerApellido ?? '');
    localStorage.setItem('segundoApellido', data.segundoApellido ?? '');
    localStorage.setItem('fotoUrl', data.fotoUrl ?? '');
    localStorage.setItem('rol', data.rol);
    localStorage.setItem('permisos', JSON.stringify(data.permisos || []));
    if (data.bodegaId !== undefined) {
      localStorage.setItem('bodegaId', data.bodegaId);
    }
    if (data.bodegaNombre !== undefined && data.bodegaNombre !== null) {
      localStorage.setItem('bodegaNombre', data.bodegaNombre);
    }

    set({
      token: data.token,
      usuario: data.usuario,
      nombre: data.nombre ?? null,
      primerNombre: data.primerNombre ?? null,
      primerApellido: data.primerApellido ?? null,
      segundoApellido: data.segundoApellido ?? null,
      fotoUrl: data.fotoUrl ?? null,
      rol: data.rol,
      permisos: data.permisos ?? [],
      bodegaId: data.bodegaId ?? null,
      bodegaNombre: data.bodegaNombre ?? null,
    });
  },

  logout: () => {
    localStorage.clear();
    set({
      token: null,
      usuario: null,
      nombre: null,
      primerNombre: null,
      primerApellido: null,
      segundoApellido: null,
      fotoUrl: null,
      rol: null,
      permisos: [],
      bodegaId: null,
      bodegaNombre: null,
    });
  },
}));
