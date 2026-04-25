import { create } from 'zustand';

interface AuthState {
  token: string | null;
  usuario: string | null;
  usuarioCorrelativo: string | null;
  nombre: string | null;
  primerNombre: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
  fotoUrl: string | null;
  rol: string | null;
  rolId: number | null;
  permisos: string[];
  bodegaId: string | null;
  bodegaNombre: string | null;

  login: (data: any) => void;
  syncSession: (data: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  usuario: localStorage.getItem('usuario'),
  usuarioCorrelativo: localStorage.getItem('usuarioCorrelativo'),
  nombre: localStorage.getItem('nombre'),
  primerNombre: localStorage.getItem('primerNombre'),
  primerApellido: localStorage.getItem('primerApellido'),
  segundoApellido: localStorage.getItem('segundoApellido'),
  fotoUrl: localStorage.getItem('fotoUrl'),
  rol: localStorage.getItem('rol'),
  rolId: Number(localStorage.getItem('rolId') || '') || null,
  permisos: JSON.parse(localStorage.getItem('permisos') || '[]'),
  bodegaId: localStorage.getItem('bodegaId'),
  bodegaNombre: localStorage.getItem('bodegaNombre'),

  login: (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', data.usuario);
    localStorage.setItem('usuarioCorrelativo', data.usuarioCorrelativo ?? '');
    localStorage.setItem('nombre', data.nombre ?? '');
    localStorage.setItem('primerNombre', data.primerNombre ?? '');
    localStorage.setItem('primerApellido', data.primerApellido ?? '');
    localStorage.setItem('segundoApellido', data.segundoApellido ?? '');
    localStorage.setItem('fotoUrl', data.fotoUrl ?? '');
    localStorage.setItem('rol', data.rol);
    localStorage.setItem('rolId', data.rolId != null ? String(data.rolId) : '');
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
      usuarioCorrelativo: data.usuarioCorrelativo ?? null,
      nombre: data.nombre ?? null,
      primerNombre: data.primerNombre ?? null,
      primerApellido: data.primerApellido ?? null,
      segundoApellido: data.segundoApellido ?? null,
      fotoUrl: data.fotoUrl ?? null,
      rol: data.rol,
      rolId: data.rolId != null ? Number(data.rolId) : null,
      permisos: data.permisos ?? [],
      bodegaId: data.bodegaId ?? null,
      bodegaNombre: data.bodegaNombre ?? null,
    });
  },

  syncSession: (data) => {
    if (data.usuario !== undefined) {
      localStorage.setItem('usuario', data.usuario ?? '');
    }
    if (data.usuarioCorrelativo !== undefined) {
      localStorage.setItem('usuarioCorrelativo', data.usuarioCorrelativo ?? '');
    }
    if (data.nombre !== undefined) {
      localStorage.setItem('nombre', data.nombre ?? '');
    }
    if (data.primerNombre !== undefined) {
      localStorage.setItem('primerNombre', data.primerNombre ?? '');
    }
    if (data.primerApellido !== undefined) {
      localStorage.setItem('primerApellido', data.primerApellido ?? '');
    }
    if (data.segundoApellido !== undefined) {
      localStorage.setItem('segundoApellido', data.segundoApellido ?? '');
    }
    if (data.fotoUrl !== undefined) {
      localStorage.setItem('fotoUrl', data.fotoUrl ?? '');
    }
    if (data.rol !== undefined) {
      localStorage.setItem('rol', data.rol ?? '');
    }
    if (data.rolId !== undefined) {
      localStorage.setItem('rolId', data.rolId != null ? String(data.rolId) : '');
    }
    if (data.permisos !== undefined) {
      localStorage.setItem('permisos', JSON.stringify(data.permisos || []));
    }
    if (data.bodegaId !== undefined) {
      localStorage.setItem('bodegaId', data.bodegaId != null ? String(data.bodegaId) : '');
    }
    if (data.bodegaNombre !== undefined) {
      localStorage.setItem('bodegaNombre', data.bodegaNombre ?? '');
    }

    set((state) => ({
      token: state.token,
      usuario: data.usuario !== undefined ? data.usuario ?? null : state.usuario,
      usuarioCorrelativo:
        data.usuarioCorrelativo !== undefined ? data.usuarioCorrelativo ?? null : state.usuarioCorrelativo,
      nombre: data.nombre !== undefined ? data.nombre ?? null : state.nombre,
      primerNombre: data.primerNombre !== undefined ? data.primerNombre ?? null : state.primerNombre,
      primerApellido: data.primerApellido !== undefined ? data.primerApellido ?? null : state.primerApellido,
      segundoApellido: data.segundoApellido !== undefined ? data.segundoApellido ?? null : state.segundoApellido,
      fotoUrl: data.fotoUrl !== undefined ? data.fotoUrl ?? null : state.fotoUrl,
      rol: data.rol !== undefined ? data.rol ?? null : state.rol,
      rolId: data.rolId !== undefined ? (data.rolId != null ? Number(data.rolId) : null) : state.rolId,
      permisos: data.permisos !== undefined ? data.permisos ?? [] : state.permisos,
      bodegaId: data.bodegaId !== undefined ? (data.bodegaId != null ? String(data.bodegaId) : null) : state.bodegaId,
      bodegaNombre: data.bodegaNombre !== undefined ? data.bodegaNombre ?? null : state.bodegaNombre,
    }));
  },

  logout: () => {
    localStorage.clear();
    set({
      token: null,
      usuario: null,
      usuarioCorrelativo: null,
      nombre: null,
      primerNombre: null,
      primerApellido: null,
      segundoApellido: null,
      fotoUrl: null,
      rol: null,
      rolId: null,
      permisos: [],
      bodegaId: null,
      bodegaNombre: null,
    });
  },
}));
