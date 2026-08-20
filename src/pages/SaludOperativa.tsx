import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
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

type CronStatus = {
  key: string;
  label: string;
  ok: boolean;
  state?: "al_dia" | "atrasada" | "fallida" | "ejecutando" | "sin_configurar";
  lastRunAt?: string | null;
  lastFinishedAt?: string | null;
  lastResult?: string | null;
  durationMs?: number | null;
  error?: string | null;
  ageHours?: number | null;
  stale?: boolean;
};

type OperativoPayload = {
  checkedAt?: string;
  details?: any;
  services?: any;
  production?: {
    deployment?: {
      version?: string;
      commit?: string | null;
      builtAt?: string | null;
      deploymentRun?: string | null;
      node?: string;
      environment?: string;
      startedAt?: string;
      uptimeSeconds?: number;
    };
    prisma?: {
      ok?: boolean;
      status?: string;
      clientVersion?: string | null;
      schemaHash?: string | null;
      clientSchemaHash?: string | null;
      message?: string;
    };
    migrations?: {
      ok?: boolean;
      status?: string;
      localTotal?: number;
      appliedTotal?: number;
      pending?: string[];
      failed?: Array<{
        name: string;
        logs?: string | null;
        startedAt?: string;
      }>;
      checksumMismatch?: string[];
      startup?: {
        status?: string;
        message?: string;
        applied?: string[];
        blocked?: string[];
      };
    };
    backups?: {
      available?: boolean;
      ok?: boolean;
      stale?: boolean | null;
      count?: number;
      latest?: { name: string; bytes: number; modifiedAt: string } | null;
      ageHours?: number | null;
      message?: string;
    };
    crons?: CronStatus[];
    recentErrors?: Array<{
      id: number;
      usuario?: string;
      endpoint?: string;
      metodo?: string;
      fecha?: string;
      resultado?: string;
    }>;
  };
  tableSizes?: Array<{ tableName: string; rowsApprox: number; bytes: number }>;
  inconsistencies?: Array<{
    key: string;
    title: string;
    description: string;
    severity: string;
    count: number;
    ok: boolean;
  }>;
  drafts?: {
    abiertosAntiguos?: number;
    bloqueadosActivos?: number;
    byType?: Array<{
      estado: string;
      tipoDocumento: string;
      total: number;
      oldestUpdatedAt?: string;
      newestUpdatedAt?: string;
    }>;
  };
  migrations?: Array<{
    name: string;
    status: string;
    startedAt?: string;
    finishedAt?: string;
    rolledBackAt?: string;
    logs?: string | null;
  }>;
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

const severityColor = (
  severity?: string,
): "success" | "warning" | "error" | "info" => {
  const normalized = `${severity || ""}`.toLowerCase();
  if (normalized === "critica" || normalized === "alta") return "error";
  if (normalized === "media") return "warning";
  return "info";
};

const shortCommit = (value?: string | null) =>
  value ? value.slice(0, 8) : "N/D";

const uptimeLabel = (seconds?: number) => {
  const total = Number(seconds || 0);
  if (!total) return "N/D";
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return days
    ? `${days} d ${hours} h`
    : hours
      ? `${hours} h ${minutes} min`
      : `${minutes} min`;
};

const cronVisual = (cron: CronStatus) => {
  switch (cron.state) {
    case "al_dia":
      return { label: "Al día", color: "success" as const };
    case "fallida":
      return { label: "Falló", color: "error" as const };
    case "ejecutando":
      return { label: "Ejecutando", color: "info" as const };
    case "atrasada":
      return { label: "Atrasado", color: "warning" as const };
    default:
      return { label: "Sin configurar", color: "warning" as const };
  }
};

export default function SaludOperativa() {
  const [data, setData] = useState<OperativoPayload | null>(null);
  const [frontendVersion, setFrontendVersion] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cargar = async () => {
    setLoading(true);
    setError("");
    try {
      const [resp, frontendResp] = await Promise.all([
        api.get("/status/operativo"),
        fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" })
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null),
      ]);
      setData(resp.data || {});
      setFrontendVersion(frontendResp);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "No se pudo cargar la salud operativa",
      );
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
      Swal.fire(
        "Error",
        err?.response?.data?.message || "No se pudo limpiar preliminares",
        "error",
      );
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const inconsistencies = data?.inconsistencies || [];
  const pendingIssues = inconsistencies.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0,
  );
  const production = data?.production;
  const deployment = production?.deployment;
  const prisma = production?.prisma;
  const migrationHealth = production?.migrations;
  const backups = production?.backups;
  const crons = production?.crons || [];
  const cronIssues = crons.filter((item) => !item.ok).length;
  const recentErrors = production?.recentErrors || [];
  const database = data?.services?.database;
  const pdfRenderer = data?.services?.pdfRenderer;
  const serviceIssues = production
    ? [
        !prisma?.ok,
        !migrationHealth?.ok,
        !backups?.ok,
        Boolean(database && !database.ok),
        Boolean(pdfRenderer && !pdfRenderer.ok),
      ].filter(Boolean).length
    : 0;
  const activeIssues = pendingIssues + cronIssues + serviceIssues;
  const productionWarnings = [
    !prisma?.ok ? "Cliente Prisma desactualizado" : null,
    !migrationHealth?.ok ? "Migraciones requieren atención" : null,
    !backups?.ok ? "Respaldo no confirmado" : null,
    cronIssues ? `${cronIssues} automatización(es) sin confirmar` : null,
  ].filter(Boolean);

  const tableColumns = useMemo<GridColDef[]>(
    () => [
      { field: "tableName", headerName: "Tabla", flex: 1 },
      { field: "rowsApprox", headerName: "Filas aprox.", width: 130 },
      {
        field: "bytes",
        headerName: "Tamaño",
        width: 130,
        valueFormatter: (value) => formatBytes(Number(value)),
      },
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
          <Chip
            size="small"
            label={params.value || "N/D"}
            color={params.value === "aplicada" ? "success" : "warning"}
          />
        ),
      },
      {
        field: "startedAt",
        headerName: "Inicio",
        width: 180,
        valueFormatter: (value) => formatDate(value as string),
      },
      {
        field: "finishedAt",
        headerName: "Fin",
        width: 180,
        valueFormatter: (value) => formatDate(value as string),
      },
    ],
    [],
  );

  return (
    <Paper sx={{ p: { xs: 1.5, md: 2.5 }, bgcolor: "background.default" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
        gap={2}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <HealthAndSafetyOutlined color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={600}>
              Salud operativa
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Diagnóstico de producción, automatizaciones, datos y servicios
              críticos.
            </Typography>
          </Box>
        </Stack>
        <Button
          variant="outlined"
          startIcon={<RefreshOutlined />}
          onClick={() => void cargar()}
          disabled={loading}
        >
          Recargar
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}
      {!loading && productionWarnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {productionWarnings.join(" · ")}
        </Alert>
      )}
      {!loading && production && productionWarnings.length === 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Producción está sincronizada y sus servicios principales responden
          correctamente.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="caption" color="text.secondary">
              API
            </Typography>
            <Typography variant="h6">
              {data?.services?.status === "online"
                ? "En línea"
                : data?.services?.status || "N/D"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Activa: {uptimeLabel(deployment?.uptimeSeconds)}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="caption" color="text.secondary">
              Base de datos
            </Typography>
            <Typography
              variant="h6"
              color={database?.ok ? "success.main" : "error.main"}
            >
              {database?.ok ? "Disponible" : "Con error"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {database?.latencyMs ?? "N/D"} ms
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="caption" color="text.secondary">
              Prisma
            </Typography>
            <Typography
              variant="h6"
              color={prisma?.ok ? "success.main" : "error.main"}
            >
              {prisma?.ok ? "Sincronizado" : "Revisar"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              v{prisma?.clientVersion || "N/D"}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="caption" color="text.secondary">
              Migraciones
            </Typography>
            <Typography
              variant="h6"
              color={migrationHealth?.ok ? "success.main" : "warning.main"}
            >
              {migrationHealth?.pending?.length || 0} pendientes
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {migrationHealth?.appliedTotal ?? 0} aplicadas
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="caption" color="text.secondary">
              Último respaldo
            </Typography>
            <Typography
              variant="h6"
              color={backups?.ok ? "success.main" : "warning.main"}
            >
              {backups?.ageHours != null
                ? `${backups.ageHours} h`
                : "Sin confirmar"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {backups?.latest?.name || "No disponible"}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="caption" color="text.secondary">
              Situaciones activas
            </Typography>
            <Typography
              variant="h6"
              color={activeIssues ? "error.main" : "success.main"}
            >
              {activeIssues}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Datos, servicios y automatizaciones
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
            >
              <Typography variant="h6">Versión desplegada</Typography>
              <Chip
                size="small"
                label={deployment?.environment || "N/D"}
                variant="outlined"
              />
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  Backend
                </Typography>
                <Typography>{shortCommit(deployment?.commit)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  Frontend
                </Typography>
                <Typography>{shortCommit(frontendVersion?.commit)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  Backend compilado
                </Typography>
                <Typography>{formatDate(deployment?.builtAt)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  Frontend compilado
                </Typography>
                <Typography>{formatDate(frontendVersion?.builtAt)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  Node
                </Typography>
                <Typography>{deployment?.node || "N/D"}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  Ejecución
                </Typography>
                <Typography>{deployment?.deploymentRun || "N/D"}</Typography>
              </Grid>
            </Grid>
            <Alert severity={prisma?.ok ? "success" : "error"} sx={{ mt: 1.5 }}>
              {prisma?.message || "No se pudo verificar el cliente Prisma"}
            </Alert>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1 }}
            >
              Esquema {prisma?.schemaHash || "N/D"} · Cliente{" "}
              {prisma?.clientSchemaHash || "N/D"}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="h6">Servicios y automatizaciones</Typography>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={1.25}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Box>
                  <Typography variant="body2">Generador de PDF</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {pdfRenderer?.label || "Sin datos"}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={pdfRenderer?.ok ? "Disponible" : "Revisar"}
                  color={pdfRenderer?.ok ? "success" : "error"}
                />
              </Stack>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Box>
                  <Typography variant="body2">
                    Respaldo de base de datos
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {backups?.message || "Sin datos"}
                    {backups?.latest
                      ? ` · ${formatBytes(backups.latest.bytes)}`
                      : ""}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={backups?.ok ? "Vigente" : "Revisar"}
                  color={backups?.ok ? "success" : "warning"}
                />
              </Stack>
              {crons.map((cron) => (
                <Stack
                  key={cron.key}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box>
                    <Typography variant="body2">{cron.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {cron.lastRunAt
                        ? `Última ejecución: ${formatDate(cron.lastRunAt)}${cron.durationMs != null ? ` · ${cron.durationMs} ms` : ""}`
                        : "No se ha recibido ninguna ejecución desde cPanel"}
                    </Typography>
                    {cron.error && (
                      <Typography
                        variant="caption"
                        color="error.main"
                        sx={{ display: "block", maxWidth: 520 }}
                      >
                        {cron.error}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    size="small"
                    label={cronVisual(cron).label}
                    color={cronVisual(cron).color}
                  />
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              gap={1}
              sx={{ mb: 1 }}
            >
              <Box>
                <Typography variant="h6">
                  Errores recientes del servidor
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Solicitudes que devolvieron un error 500.
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`${recentErrors.length} en 7 días`}
                color={recentErrors.length ? "error" : "success"}
              />
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Referencia</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Operación</TableCell>
                    <TableCell>Usuario</TableCell>
                    <TableCell align="right">Resultado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentErrors.length ? (
                    recentErrors.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            ERR-{item.id}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatDate(item.fecha)}</TableCell>
                        <TableCell>
                          {item.metodo} {item.endpoint}
                        </TableCell>
                        <TableCell>{item.usuario || "Sistema"}</TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            color="error"
                            label={item.resultado || "500"}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography
                          color="text.secondary"
                          align="center"
                          sx={{ py: 2 }}
                        >
                          No hay errores 500 recientes registrados.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {migrationHealth?.pending?.length ||
      migrationHealth?.failed?.length ||
      migrationHealth?.checksumMismatch?.length ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">
            El esquema necesita atención
          </Typography>
          {!!migrationHealth?.pending?.length && (
            <Typography variant="body2">
              Pendientes: {migrationHealth.pending.join(", ")}
            </Typography>
          )}
          {!!migrationHealth?.failed?.length && (
            <Typography variant="body2">
              Fallidas:{" "}
              {migrationHealth.failed.map((item) => item.name).join(", ")}
            </Typography>
          )}
          {!!migrationHealth?.checksumMismatch?.length && (
            <Typography variant="body2">
              Contenido modificado:{" "}
              {migrationHealth.checksumMismatch.join(", ")}
            </Typography>
          )}
          <Typography variant="caption">
            {migrationHealth?.startup?.message}
          </Typography>
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Centro de inconsistencias
            </Typography>
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
                        <Typography variant="caption" color="text.secondary">
                          {item.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={item.severity}
                          color={
                            item.ok ? "success" : severityColor(item.severity)
                          }
                        />
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
            <Typography variant="h6" sx={{ mb: 1 }}>
              Preliminares
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ mb: 1 }}
              flexWrap="wrap"
              alignItems="center"
            >
              <Chip
                label={`Abiertos antiguos: ${data?.drafts?.abiertosAntiguos ?? 0}`}
                color={
                  (data?.drafts?.abiertosAntiguos || 0) > 0
                    ? "warning"
                    : "success"
                }
              />
              <Chip
                label={`Bloqueados activos: ${data?.drafts?.bloqueadosActivos ?? 0}`}
                color={
                  (data?.drafts?.bloqueadosActivos || 0) > 0
                    ? "info"
                    : "default"
                }
              />
              <Button
                size="small"
                variant="outlined"
                onClick={() => void limpiarPreliminares()}
              >
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
                    <TableRow
                      key={`${item.tipoDocumento}-${item.estado}-${index}`}
                    >
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
            <Typography variant="h6" sx={{ mb: 1 }}>
              Tablas más pesadas
            </Typography>
            <Box sx={{ height: 360 }}>
              <DataGrid
                rows={(data?.tableSizes || []).map((row, id) => ({
                  id,
                  ...row,
                }))}
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
            <Typography variant="h6" sx={{ mb: 1 }}>
              Migraciones recientes
            </Typography>
            <Box sx={{ height: 360 }}>
              <DataGrid
                rows={(data?.migrations || []).map((row, id) => ({
                  id,
                  ...row,
                }))}
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
