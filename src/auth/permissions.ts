export const routePermissionMap: Record<string, string> = {
  "/": "dashboard.view",
  "/ventas": "ventas.view",
  "/ventas/nueva": "ventas.manage",
  "/productos": "productos.view",
  "/productos/nuevo": "productos.manage",
  "/catalogos/categorias": "productos.manage",
  "/catalogos/telas": "productos.manage",
  "/catalogos/colores": "productos.manage",
  "/catalogos/tallas": "productos.manage",
  "/inventario": "inventario.ingreso.view",
  "/inventario/resumen": "inventario.resumen.view",
  "/inventario/traslados": "inventario.traslados.view",
  "/bodegas": "bodegas.view",
  "/produccion": "produccion.view",
  "/produccion/nuevo": "produccion.manage",
  "/cotizaciones": "ventas.view",
  "/clientes": "clientes.view",
  "/usuarios": "usuarios.view",
  "/roles": "roles.view",
  "/produccion/correlativos": "correlativos.view",
  "/correlativos": "correlativos.view",
  "/admin": "admin.view",
  "/reportes/reporte-diario": "reportes.ventas-diarias.view",
  "/reportes/reporte-quincenal": "reportes.ventas-diarias.view",
  "/reportes/ventas-diarias": "reportes.ventas-diarias.view",
  "/reportes/ventas-producto": "reportes.ventas-producto.view",
  "/reportes/top-clientes": "reportes.top-clientes.view",
  "/reportes/ingresos": "reportes.ingresos.view",
  "/reportes/traslados": "reportes.traslados.view",
  "/reportes/stock-bajo": "reportes.stock-bajo.view",
};

const defaultRoutePriority = [
  "/",
  "/ventas",
  "/productos",
  "/inventario",
  "/inventario/resumen",
  "/inventario/traslados",
  "/bodegas",
  "/produccion",
  "/cotizaciones",
  "/clientes",
  "/usuarios",
  "/roles",
  "/correlativos",
  "/admin",
  "/reportes/reporte-diario",
  "/reportes/reporte-quincenal",
  "/reportes/ventas-diarias",
  "/reportes/ventas-producto",
  "/reportes/top-clientes",
  "/reportes/ingresos",
  "/reportes/traslados",
  "/reportes/stock-bajo",
];

export function hasPermission(
  rol: string | null | undefined,
  permisos: string[] | null | undefined,
  permission: string | null | undefined
) {
  if (!permission) return true;
  if (rol === "ADMIN") return true;
  if (!permisos || permisos.length === 0) return false;
  return permisos.includes(permission);
}

export function getRequiredPermission(pathname: string) {
  const entries = Object.entries(routePermissionMap).sort((a, b) => b[0].length - a[0].length);
  const match = entries.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return match?.[1] || null;
}

export function canAccessPath(
  rol: string | null | undefined,
  permisos: string[] | null | undefined,
  pathname: string | undefined
) {
  if (!pathname) return true;
  return hasPermission(rol, permisos, getRequiredPermission(pathname));
}

export function getFirstAccessiblePath(
  rol: string | null | undefined,
  permisos: string[] | null | undefined
) {
  return defaultRoutePriority.find((path) => canAccessPath(rol, permisos, path)) || "/login";
}
