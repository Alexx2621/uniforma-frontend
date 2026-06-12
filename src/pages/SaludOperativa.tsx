import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import HealthAndSafetyOutlined from "@mui/icons-material/HealthAndSafetyOutlined";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { api } from "../api/axios";
import Swal from "sweetalert2";

type OperativoPayload = {
  checkedAt?: string;
  details?: any;
  tableSizes?: Array<{ tableName: string; rowsApprox: number; bytes: number }>;
  inconsistencies?: Array<{ key: string; title: string; description: string; severity: string; count: number; ok: boolean }>;
  drafts?: {
    abiertosAntiguos?: number;
    bloqueadosActivos?: number;
    byType?: Array<{ estado: string; tipoDocumento: string; total: number; oldestUpdatedAt?: string; newestUpdatedAt?: string }>;
  };
  migrations?: Array<{ name: string; status: string; startedAt?: string; finishedAt?: string; rolledBackAt?: string; logs?: string | null }>;
};

const formatBytes = (value?: number) => {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "N/D";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/D" : date.toLocaleString("es-GT");
};

const severityColor = (severity?: string): "success" | "warning" | "error" | "info" => {
  const normalized = `${severity || ""}`.toLowerCase();
  if (normalized === "critica" || normalized === "alta") return "error";
  if (normalized === "media") return "warning";
  return "info";
};

export default function SaludOperativa() {
  const [data, setData] = useState<OperativoPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cargar = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await api.get("/status/operativo");
      setData(resp.data || {});
    } catch (err: any) {
      setError(err?.response?.data?.message || "No se pudo cargar la salud operativa");
    } finally {
      setLoading(false);
    }
  };

  const limpiarPreliminares = async () => {
    const confirmacion = await Swal.fire({
      title: "Limpiar preliminares",
      text: "Se venceran preliminares antiguos y se liberaran bloqueos vencidos.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Si, limpiar",
      cancelButtonText: "Cancelar",
    });
    if (!confirmacion.isConfirmed) return;
    try {
      const resp = await api.post("/documentos-borradores/limpieza-admin");
      await Swal.fire(
        "Limpieza aplicada",
        `Vencidos: ${resp.data?.vencidos || 0}. Bloqueos liberados: ${resp.data?.bloqueosLiberados || 0}.`,
        "success",
      );
      await cargar();
    } catch (err: any) {
      Swal.fire("Error", err?.response?.data?.message || "No se pudo limpiar preliminares", "error");
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const mysqlStatus = data?.details?.mysql?.status || {};
  const mysqlVariables = data?.details?.mysql?.variables || {};
  const apiMemory = data?.details?.api?.memory || {};
  const inconsistencies = data?.inconsistencies || [];
  const pendingIssues = inconsistencies.reduce((sum, item) => sum + Number(item.count || 0), 0);

  const tableColumns = useMemo<GridColDef[]>(
    () => [
      { field: "tableName", headerName: "Tabla", flex: 1 },
      { field: "rowsApprox", headerName: "Filas aprox.", width: 130 },
      { field: "bytes", headerName: "Tamaño", width: 130, valueFormatter: (value) => formatBytes(Number(value)) },
    ],
    [],
  );

  const migrationColumns = useMemo<GridColDef[]>(
    () => [
      { field: "name", headerName: "Migración", flex: 1.2 },
      {
        field: "status",
        headerName: "Estado",
        width: 130,
        renderCell: (params) => (
          <Chip size="small" label={params.value || "N/D"} color={params.value === "aplicada" ? "success" : "warning"} />
        ),
      },
      { field: "startedAt", headerName: "Inicio", width: 180, valueFormatter: (value) => formatDate(value as string) },
      { field: "finishedAt", headerName: "Fin", width: 180, valueFormatter: (value) => formatDate(value as string) },
    ],
    [],
  );

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} gap={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <HealthAndSafetyOutlined color="primary" />
          <Box>
            <Typography variant="h4">Salud operativa</Typography>
            <Typography variant="body2" color="text.secondary">
              Estado del servidor, base de datos, migraciones, preliminares e inconsistencias.
            </Typography>
          </Box>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={() => void cargar()} disabled={loading}>
          Recargar
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="body2" color="text.secondary">Conexiones MySQL</Typography>
            <Typography variant="h5">{mysqlStatus.Threads_connected || mysqlStatus.threads_connected || "N/D"}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="body2" color="text.secondary">Buffer pool</Typography>
            <Typography variant="h5">{formatBytes(Number(mysqlVariables.innodb_buffer_pool_size || 0))}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="body2" color="text.secondary">Memoria API</Typography>
            <Typography variant="h5">{formatBytes(Number(apiMemory.rss || 0))}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="body2" color="text.secondary">Inconsistencias</Typography>
            <Typography variant="h5" color={pendingIssues ? "error.main" : "success.main"}>{pendingIssues}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Centro de inconsistencias</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Validación</TableCell>
                    <TableCell>Severidad</TableCell>
                    <TableCell align="right">Casos</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inconsistencies.map((item) => (
                    <TableRow key={item.key}>
                      <TableCell>
                        <Typography variant="body2">{item.title}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={item.severity} color={item.ok ? "success" : severityColor(item.severity)} />
                      </TableCell>
                      <TableCell align="right">{item.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Preliminares</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" alignItems="center">
              <Chip label={`Abiertos antiguos: ${data?.drafts?.abiertosAntiguos ?? 0}`} color={(data?.drafts?.abiertosAntiguos || 0) > 0 ? "warning" : "success"} />
              <Chip label={`Bloqueados activos: ${data?.drafts?.bloqueadosActivos ?? 0}`} color={(data?.drafts?.bloqueadosActivos || 0) > 0 ? "info" : "default"} />
              <Button size="small" variant="outlined" onClick={() => void limpiarPreliminares()}>
                Limpiar
              </Button>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Último guardado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.drafts?.byType || []).map((item, index) => (
                    <TableRow key={`${item.tipoDocumento}-${item.estado}-${index}`}>
                      <TableCell>{item.tipoDocumento}</TableCell>
                      <TableCell>{item.estado}</TableCell>
                      <TableCell align="right">{item.total}</TableCell>
                      <TableCell>{formatDate(item.newestUpdatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Tablas más pesadas</Typography>
            <Box sx={{ height: 360 }}>
              <DataGrid
                rows={(data?.tableSizes || []).map((row, id) => ({ id, ...row }))}
                columns={tableColumns}
                loading={loading}
                pageSizeOptions={[10]}
                hideFooterSelectedRowCount
              />
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Migraciones recientes</Typography>
            <Box sx={{ height: 360 }}>
              <DataGrid
                rows={(data?.migrations || []).map((row, id) => ({ id, ...row }))}
                columns={migrationColumns}
                loading={loading}
                pageSizeOptions={[10]}
                hideFooterSelectedRowCount
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );
}
