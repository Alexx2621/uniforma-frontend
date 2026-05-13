import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ManageSearchOutlined from "@mui/icons-material/ManageSearchOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { hasPermission } from "../auth/permissions";
import { ActivityLog, getActivityLogActionLabel } from "../utils/activityLog";

interface UsuarioOption {
  id: number;
  usuario: string;
  nombre: string;
}

const todayDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const formatDateTime = (value?: string | null) => (value ? new Date(`${value}`).toLocaleString("es-GT") : "");

const normalizeEndpoint = (value?: string | null) => `${value || ""}`.split("?")[0];

const getActivityTargetLabel = (log?: ActivityLog | null) => {
  const endpoint = normalizeEndpoint(log?.endpoint);
  const parts = endpoint.split("/").filter(Boolean);

  if (endpoint === "/auth/login") return "Acceso al sistema";
  if (endpoint === "/documentos") return "Cierres y reportes";
  if (endpoint === "/inventario/reporte/pdf") return "Reporte de inventario";
  if (parts[0] === "documentos" && parts[1]) return `Documento #${parts[1]}`;
  if (parts[0] === "produccion" && parts[1] === "unificados") return parts[2] ? `Unificado #${parts[2]}` : "Pedidos unificados";
  if (parts[0] === "produccion" && parts[1]) return `Pedido #${parts[1]}${parts[2] ? ` - ${parts[2]}` : ""}`;
  if (parts[0] === "produccion") return "Pedidos de produccion";

  return endpoint || "Referencia no disponible";
};

const getResultColor = (resultado?: string | null): "success" | "warning" | "error" | "default" => {
  const status = Number(resultado || 0);
  if (!status) return "default";
  if (status >= 200 && status < 300) return "success";
  if (status >= 400) return "error";
  return "warning";
};

const escapeCsv = (value: unknown) => {
  const text = `${value ?? ""}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export default function Auditoria() {
  const { rol, permisos } = useAuthStore();
  const canView = hasPermission(rol, permisos, "logs.view");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [usuarioFiltro, setUsuarioFiltro] = useState("");
  const [textoFiltro, setTextoFiltro] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState(todayDate());
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const cargar = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      const { data } = await api.get("/logs", {
        params: {
          usuario: usuarioFiltro || undefined,
          texto: textoFiltro || undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
        },
      });
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      Swal.fire("Error", "No se pudo cargar el log de auditoria", "error");
    } finally {
      setLoading(false);
    }
  }, [canView, desde, hasta, textoFiltro, usuarioFiltro]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!canView) return;
    api
      .get("/usuarios")
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : [];
        setUsuarios(
          rows
            .filter((item: any) => typeof item?.usuario === "string")
            .map((item: any) => ({
              id: Number(item.id),
              usuario: item.usuario,
              nombre: item.nombre || item.usuario,
            }))
        );
      })
      .catch(() => setUsuarios([]));
  }, [canView]);

  const usuarioNombreByKey = useMemo(
    () =>
      new Map(
        usuarios.map((item) => [
          item.usuario.trim().toUpperCase(),
          item.nombre && item.nombre !== item.usuario ? `${item.nombre} (${item.usuario})` : item.usuario,
        ])
      ),
    [usuarios]
  );

  const getUsuarioLabel = useCallback(
    (value?: string | null) => {
      const key = `${value || ""}`.trim().toUpperCase();
      return key ? usuarioNombreByKey.get(key) || value || "" : "Registro anterior";
    },
    [usuarioNombreByKey]
  );

  const exportarExcel = () => {
    if (!logs.length) {
      Swal.fire("Sin datos", "No hay registros para exportar con los filtros actuales.", "info");
      return;
    }

    const headers = ["Fecha", "Usuario", "Accion", "Referencia", "Endpoint", "Metodo", "Resultado", "IP"];
    const rows = logs.map((log) => [
      formatDateTime(log.fecha),
      getUsuarioLabel(log.usuario),
      getActivityLogActionLabel(log),
      getActivityTargetLabel(log),
      log.endpoint,
      log.metodo,
      log.resultado || "",
      log.ip || "",
    ]);
    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `auditoria-${todayDate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<GridColDef<ActivityLog>[]>(
    () => [
      {
        field: "fecha",
        headerName: "Fecha",
        minWidth: 180,
        flex: 0.9,
        valueFormatter: (value) => formatDateTime(`${value || ""}`),
      },
      {
        field: "usuario",
        headerName: "Usuario",
        minWidth: 180,
        flex: 0.9,
        valueGetter: (value) => getUsuarioLabel(`${value || ""}`),
      },
      {
        field: "accion",
        headerName: "Accion",
        minWidth: 210,
        flex: 1,
        valueGetter: (_, row) => getActivityLogActionLabel(row),
      },
      { field: "endpoint", headerName: "Referencia", minWidth: 260, flex: 1.4 },
      { field: "metodo", headerName: "Metodo", minWidth: 100, flex: 0.4 },
      { field: "resultado", headerName: "Resultado", minWidth: 110, flex: 0.5 },
      { field: "ip", headerName: "IP", minWidth: 130, flex: 0.6 },
    ],
    [getUsuarioLabel]
  );

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ManageSearchOutlined color="primary" />
          <Typography variant="h4">Auditoria</Typography>
        </Stack>
        <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={() => void cargar()} disabled={loading}>
          Recargar
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Revisa acciones importantes por usuario: accesos, pedidos, cierres, PDFs, anulaciones y unificados.
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          select
          label="Usuario"
          size="small"
          value={usuarioFiltro}
          onChange={(e) => setUsuarioFiltro(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {usuarios.map((item) => (
            <MenuItem key={item.id} value={item.usuario}>
              {item.nombre && item.nombre !== item.usuario ? `${item.nombre} (${item.usuario})` : item.usuario}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Accion o referencia" size="small" value={textoFiltro} onChange={(e) => setTextoFiltro(e.target.value)} />
        <TextField label="Desde" type="date" size="small" value={desde} onChange={(e) => setDesde(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="Hasta" type="date" size="small" value={hasta} onChange={(e) => setHasta(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="contained" onClick={() => void cargar()} disabled={loading}>
          Filtrar
        </Button>
        <Button startIcon={<FileDownloadOutlined />} variant="outlined" onClick={exportarExcel} disabled={loading || !logs.length}>
          Exportar Excel
        </Button>
      </Stack>

      <Box sx={{ height: 560, width: "100%" }}>
        <DataGrid
          rows={logs}
          columns={columns}
          getRowId={(row) => row.id}
          loading={loading}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          disableRowSelectionOnClick
          onRowClick={(params) => setSelectedLog(params.row)}
          localeText={{ noRowsLabel: "No hay acciones registradas con estos filtros." }}
        />
      </Box>

      <Dialog open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Detalle de auditoria</DialogTitle>
        <DialogContent dividers>
          {selectedLog && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip label={selectedLog.metodo} color="primary" size="small" />
                <Chip label={selectedLog.resultado || "Sin resultado"} color={getResultColor(selectedLog.resultado)} size="small" />
              </Stack>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Accion
                </Typography>
                <Typography variant="body1">{getActivityLogActionLabel(selectedLog)}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Referencia relacionada
                </Typography>
                <Typography variant="body1">{getActivityTargetLabel(selectedLog)}</Typography>
              </Box>

              <Divider />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Usuario
                  </Typography>
                  <Typography variant="body2">{getUsuarioLabel(selectedLog.usuario)}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Fecha
                  </Typography>
                  <Typography variant="body2">{formatDateTime(selectedLog.fecha)}</Typography>
                </Box>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    IP
                  </Typography>
                  <Typography variant="body2">{selectedLog.ip || "No disponible"}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Metodo
                  </Typography>
                  <Typography variant="body2">{selectedLog.metodo}</Typography>
                </Box>
              </Stack>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Endpoint
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {selectedLog.endpoint}
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedLog(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
