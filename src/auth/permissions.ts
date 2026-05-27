export const routePermissionMap: Record<string, string> = {
  "/": "dashboard.view",
  "/ventas": "ventas.view",
  "/ventas/nueva": "ventas.manage",
  "/cambios": "postventa.view",
  "/devoluciones": "postventa.view",
  "/productos": "productos.view",
  "/productos/nuevo": "productos.manage",
  "/catalogos/categorias": "productos.manage",
  "/catalogos/telas": "productos.manage",
  "/catalogos/colores": "productos.manage",
  "/catalogos/tallas": "productos.manage",
  "/inventario": "inventario.ingreso.view",
  "/inventario/panel": "inventario.panel.view",
  "/inventario/resumen": "inventario.resumen.view",
  "/inventario/telas": "inventario.telas.view",
  "/inventario/ingreso-telas": "inventario.telas.view",
  "/inventario/conteos": "inventario.conteos.view",
  "/inventario/kardex": "inventario.kardex.view",
  "/inventario/traslados": "inventario.traslados.view",
  "/bodegas": "bodegas.view",
  "/produccion": "produccion.view",
  "/produccion/nuevo": "produccion.manage",
  "/tracking-pedidos": "tracking.view",
  "/bordados": "bordados.view",
  "/envios": "envios.view",
  "/envios/nuevo": "envios.manage",
  "/pagos/pedidos": "pagos.view",
  "/pagos/recibidos": "pagos.view",
  "/cotizaciones": "cotizaciones.view",
  "/clientes": "clientes.view",
  "/proveedores": "proveedores.view",
  "/proveedores/facturas": "proveedores.facturas.view",
  "/usuarios": "usuarios.view",
  "/roles": "roles.view",
  "/produccion/correlativos": "correlativos.view",
  "/correlativos": "correlativos.view",
  "/admin": "admin.view",
  "/auditoria": "logs.view",
  "/correcciones": "correcciones.view",
  "/metas-mensuales": "metas.view",
  "/whatsapp/config": "whatsapp.manage",
  "/reportes/reporte-diario": "reportes.reporte-diario.view",
  "/reportes/reporte-quincenal": "reportes.reporte-quincenal.view",
  "/reportes/ventas-diarias": "reportes.ventas-diarias.view",
  "/reportes/ventas-producto": "reportes.ventas-producto.view",
  "/reportes/top-clientes": "reportes.top-clientes.view",
  "/reportes/ingresos": "reportes.ingresos.view",
  "/reportes/traslados": "reportes.traslados.view",
  "/reportes/stock-bajo": "reportes.stock-bajo.view",
  "/reportes/produccion-unificados": "reportes.produccion-unificados.view",
  "/reportes/comparativo-tiendas": "reportes.comparativo-tiendas.view",
};

export function getAutoViewPermissionForPath(pathname: string) {
  const normalized = pathname.replace(/^\/+|\/+$/g, "");
  if (!normalized) return "dashboard.view";
  return `${normalized.replace(/\//g, ".")}.view`;
}

const defaultRoutePriority = [
  "/",
  "/ventas",
  "/cambios",
  "/devoluciones",
  "/productos",
  "/inventario",
  "/inventario/panel",
  "/inventario/resumen",
  "/inventario/conteos",
  "/inventario/kardex",
  "/inventario/traslados",
  "/bodegas",
  "/produccion",
  "/tracking-pedidos",
  "/bordados",
  "/envios",
  "/pagos/pedidos",
  "/cotizaciones",
  "/clientes",
  "/proveedores",
  "/proveedores/facturas",
  "/usuarios",
  "/roles",
  "/correlativos",
  "/admin",
  "/correcciones",
  "/metas-mensuales",
  "/whatsapp/config",
  "/reportes/reporte-diario",
  "/reportes/reporte-quincenal",
  "/reportes/ventas-diarias",
  "/reportes/ventas-producto",
  "/reportes/top-clientes",
  "/reportes/ingresos",
  "/reportes/traslados",
  "/reportes/stock-bajo",
  "/reportes/produccion-unificados",
  "/reportes/comparativo-tiendas",
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
  return match?.[1] || getAutoViewPermissionForPath(pathname);
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
