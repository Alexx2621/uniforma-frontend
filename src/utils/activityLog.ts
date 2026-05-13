export interface ActivityLog {
  id: number;
  usuario?: string | null;
  endpoint: string;
  metodo: string;
  ip?: string | null;
  fecha: string;
  resultado?: string | null;
}

export const getActivityLogActionLabel = (log: ActivityLog) => {
  const endpoint = `${log.endpoint || ""}`.split("?")[0];
  const method = `${log.metodo || ""}`.toUpperCase();

  if (endpoint === "/auth/login") return "Inicio de sesion";
  if (endpoint.includes("/pdf")) return "Genero PDF";
  if (endpoint.includes("/produccion/unificados")) {
    if (method === "GET") return "Consulto/reimprimio reporte unificado";
    if (method === "POST") return "Genero pedido unificado";
    if (method === "DELETE") return "Elimino pedido unificado";
    return "Actualizo pedido unificado";
  }
  if (endpoint === "/documentos" && method === "POST") return "Genero cierre/reporte";
  if (endpoint.startsWith("/documentos") && method === "PATCH") return "Edito cierre/reporte";
  if (endpoint.startsWith("/documentos") && method === "DELETE") return "Elimino cierre/reporte";
  if (endpoint === "/produccion" && method === "POST") return "Creo pedido";
  if (endpoint.startsWith("/produccion") && method === "POST") return "Actualizo pedido";

  const methodMap: Record<string, string> = {
    GET: "Consulto",
    POST: "Creo/ejecuto",
    PUT: "Actualizo",
    PATCH: "Actualizo",
    DELETE: "Elimino",
  };
  return methodMap[method] || method;
};
