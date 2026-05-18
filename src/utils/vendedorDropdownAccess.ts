export interface UsuarioConBodega {
  id: number;
  bodegaId?: number | string | null;
}

export const canUseVendedorDropdown = (
  rol: string | null | undefined,
  rolId: number | string | null | undefined,
  allowedRoleIds: number[],
  permisos: string[] | null | undefined = [],
) => {
  if (`${rol || ""}`.trim().toUpperCase() === "ADMIN") return true;
  if (permisos?.includes("sistema.selector-vendedores")) return true;
  const currentRoleId = Number(rolId);
  return Number.isFinite(currentRoleId) && allowedRoleIds.includes(currentRoleId);
};

export const filterUsuariosByBodega = <T extends UsuarioConBodega>(
  usuarios: T[],
  allowedBodegaIds: number[],
) => {
  if (!allowedBodegaIds.length) return usuarios;
  return usuarios.filter((usuario) => {
    const bodegaId = Number(usuario.bodegaId);
    return Number.isFinite(bodegaId) && allowedBodegaIds.includes(bodegaId);
  });
};
