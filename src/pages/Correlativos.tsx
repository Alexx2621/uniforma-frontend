import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { hasPermission } from "../auth/permissions";

interface CorrelativoRow {
  id: number | string;
  scope: string;
  nombre: string;
  abreviatura: string;
  siguienteNumero: number;
  bodegaId: number | null;
  esGlobal: boolean;
}

export default function Correlativos() {
  const [rows, setRows] = useState<CorrelativoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const denyAlertShown = useRef(false);
  const { rol, permisos } = useAuthStore();
  const canView = hasPermission(rol, permisos, "correlativos.view");
  const canManage = hasPermission(rol, permisos, "correlativos.manage");

  const cargar = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/correlativos/produccion");
      setRows(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los correlativos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      if (!denyAlertShown.current) {
        denyAlertShown.current = true;
        Swal.fire("Acceso restringido", "No tienes permisos para ingresar a Correlativos", "warning");
      }
      return;
    }
    void cargar();
  }, [canView]);

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  const actualizarCampo = (scope: string, field: "abreviatura" | "siguienteNumero", value: string) => {
    setRows((current) =>
      current.map((row) =>
        row.scope === scope
          ? {
              ...row,
              [field]: field === "siguienteNumero" ? Number(value) || 0 : value.toUpperCase(),
            }
          : row
      )
    );
  };

  const guardar = async (row: CorrelativoRow) => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para modificar correlativos", "warning");
      return;
    }

    const payload = {
      abreviatura: row.abreviatura.trim().toUpperCase(),
      siguienteNumero: Number(row.siguienteNumero),
    };

    if (!payload.abreviatura) {
      Swal.fire("Validacion", "La abreviatura es obligatoria", "info");
      return;
    }

    if (!Number.isInteger(payload.siguienteNumero) || payload.siguienteNumero < 1) {
      Swal.fire("Validacion", "El siguiente correlativo debe ser un entero mayor a 0", "info");
      return;
    }

    try {
      if (row.esGlobal) {
        await api.put("/correlativos/produccion/global", payload);
      } else if (row.bodegaId) {
        await api.put(`/correlativos/produccion/bodega/${row.bodegaId}`, payload);
      }

      Swal.fire("Guardado", "Configuracion actualizada", "success");
      await cargar();
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo guardar el correlativo", "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <SettingsOutlined color="primary" />
          <Typography variant="h4">Correlativos</Typography>
        </Stack>
        <Button startIcon={<RefreshOutlined />} variant="outlined" size="small" onClick={cargar} disabled={loading}>
          Recargar
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Configura la abreviatura y el numero inicial del correlativo para el reporte unificado de produccion.
        El formato generado sera <strong>ABR-0001</strong>.
      </Alert>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ambito</TableCell>
              <TableCell>Abreviatura</TableCell>
              <TableCell>Siguiente numero</TableCell>
              <TableCell align="right">Accion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.scope}>
                <TableCell>
                  <Typography fontWeight={700}>{row.nombre}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.esGlobal ? "Aplica cuando el unificado se genera con todas las tiendas" : `Bodega #${row.bodegaId}`}
                  </Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={row.abreviatura}
                    onChange={(e) => actualizarCampo(row.scope, "abreviatura", e.target.value)}
                    inputProps={{ maxLength: 12 }}
                    disabled={!canManage}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    value={row.siguienteNumero}
                    onChange={(e) => actualizarCampo(row.scope, "siguienteNumero", e.target.value)}
                    inputProps={{ min: 1 }}
                    disabled={!canManage}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button variant="contained" size="small" startIcon={<SaveOutlined />} onClick={() => guardar(row)} disabled={!canManage}>
                    Guardar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No hay configuraciones disponibles.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
