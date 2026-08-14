export type MuiStatusColor = "success" | "warning" | "error" | "info" | "default";

const STATUS_LABELS: Record<string, string> = {
  aprobado: "Aprobado",
  aprobada: "Aprobada",
  autorizado: "Autorizado",
  autorizada: "Autorizada",
  cancelado: "Cancelado",
  cancelada: "Cancelada",
  cerrado: "Cerrado",
  cerrada: "Cerrada",
  en_revision: "En revision",
  pendiente: "Pendiente",
  pendiente_aprobacion: "Pendiente aprobacion",
  pendiente_segunda_aprobacion: "Pendiente de segunda aprobacion",
  aplicado: "Aplicado",
  recibido: "Recibido",
  recibida: "Recibida",
  rechazado: "Rechazado",
  rechazada: "Rechazada",
  reemplazada: "Reemplazada",
  reemplazado: "Reemplazado",
};

const normalizeStatus = (status?: string | null) => `${status || ""}`.trim().toLowerCase();

export const getStatusLabel = (status?: string | null) => {
  const normalized = normalizeStatus(status);
  if (!normalized) return "N/D";
  return STATUS_LABELS[normalized] || normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getStatusColor = (status?: string | null): MuiStatusColor => {
  const value = normalizeStatus(status);
  if (["aprobado", "aprobada", "autorizado", "autorizada", "cerrado", "cerrada", "recibido", "recibida", "aplicado"].includes(value)) {
    return "success";
  }
  if (["pendiente", "pendiente_aprobacion", "pendiente_segunda_aprobacion"].includes(value)) return "warning";
  if (["rechazado", "rechazada", "anulado", "anulada", "cancelado", "cancelada"].includes(value)) return "error";
  if (["reemplazada", "reemplazado"].includes(value)) return "default";
  if (value.includes("revision") || value.includes("aprobacion") || value.includes("transito")) return "info";
  return "default";
};
