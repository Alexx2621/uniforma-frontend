import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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

interface UsuarioOperacionRow {
  id: number | string;
  usuarioId: number;
  usuario: string;
  nombreUsuario: string;
  usuarioCorrelativo?: string | null;
  codigoUsuario: string;
  operacion: string;
  nombreOperacion: string;
  formato: string;
  prefijo: string;
  siguienteNumero: number;
  siguienteCorrelativo: string;
}

export default function Correlativos() {
  const [rows, setRows] = useState<CorrelativoRow[]>([]);
  const [usuarioRows, setUsuarioRows] = useState<UsuarioOperacionRow[]>([]);
  const [selectedUsuarioId, setSelectedUsuarioId] = useState("");
  const [loading, setLoading] = useState(false);
  const denyAlertShown = useRef(false);
  const { rol, permisos } = useAuthStore();
  const canView = hasPermission(rol, permisos, "correlativos.view");
  const canManage = hasPermission(rol, permisos, "correlativos.manage");

  const cargar = async () => {
    try {
      setLoading(true);
      const [respProduccion, respUsuarios] = await Promise.all([
        api.get("/correlativos/produccion"),
        api.get("/correlativos/usuario-operaciones"),
      ]);
      setRows(respProduccion.data || []);
      setUsuarioRows(respUsuarios.data || []);
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

  useEffect(() => {
    if (!usuarioRows.length) {
      setSelectedUsuarioId("");
      return;
    }
    const selectedExists = usuarioRows.some((row) => `${row.usuarioId}` === selectedUsuarioId);
    if (!selectedUsuarioId || !selectedExists) {
      setSelectedUsuarioId(`${usuarioRows[0].usuarioId}`);
    }
  }, [usuarioRows, selectedUsuarioId]);

  const usuariosDisponibles = useMemo(() => {
    const byId = new Map<number, UsuarioOperacionRow>();
    usuarioRows.forEach((row) => {
      if (!byId.has(row.usuarioId)) byId.set(row.usuarioId, row);
    });
    return Array.from(byId.values()).sort((a, b) =>
      (a.nombreUsuario || a.usuario).localeCompare(b.nombreUsuario || b.usuario)
    );
  }, [usuarioRows]);

  const usuarioRowsFiltradas = useMemo(
    () => usuarioRows.filter((row) => `${row.usuarioId}` === selectedUsuarioId),
    [usuarioRows, selectedUsuarioId]
  );

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

  const actualizarCampoUsuario = (
    usuarioId: number,
    operacion: string,
    field: "prefijo" | "codigoUsuario" | "siguienteNumero",
    value: string
  ) => {
    setUsuarioRows((current) =>
      current.map((row) => {
        if (row.usuarioId !== usuarioId || row.operacion !== operacion) return row;
        const next = {
          ...row,
          [field]:
            field === "siguienteNumero"
              ? Number(value) || 0
              : value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, field === "codigoUsuario" ? 6 : 12),
        };
        return {
          ...next,
          siguienteCorrelativo: `${next.prefijo}-${next.codigoUsuario}-${`${next.siguienteNumero}`.padStart(4, "0")}`,
        };
      })
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

  const guardarUsuarioOperacion = async (row: UsuarioOperacionRow) => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para modificar correlativos", "warning");
      return;
    }

    const payload = {
      abreviatura: row.prefijo.trim().toUpperCase(),
      codigoUsuario: row.codigoUsuario.trim().toUpperCase(),
      siguienteNumero: Number(row.siguienteNumero),
    };

    if (!payload.abreviatura || !payload.codigoUsuario) {
      Swal.fire("Validacion", "Prefijo y codigo de usuario son obligatorios", "info");
      return;
    }
    if (!Number.isInteger(payload.siguienteNumero) || payload.siguienteNumero < 1) {
      Swal.fire("Validacion", "El siguiente correlativo debe ser un entero mayor a 0", "info");
      return;
    }

    try {
      await api.put(`/correlativos/usuario-operaciones/${row.usuarioId}/${row.operacion}`, payload);
      Swal.fire("Guardado", "Correlativo por usuario actualizado", "success");
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
        Configura correlativos globales y por usuario. Los correlativos por usuario usan el formato{" "}
        <strong>MODULO-USUARIO-0001</strong>, por ejemplo <strong>PE-BO-0001</strong>.
      </Alert>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Correlativos por usuario y modulo
      </Typography>

      <FormControl fullWidth size="small" sx={{ maxWidth: 420, mb: 2 }}>
        <InputLabel id="usuario-correlativos-label">Usuario</InputLabel>
        <Select
          labelId="usuario-correlativos-label"
          label="Usuario"
          value={selectedUsuarioId}
          onChange={(e) => setSelectedUsuarioId(e.target.value)}
          disabled={loading || !usuariosDisponibles.length}
        >
          {usuariosDisponibles.map((usuario) => (
            <MenuItem key={usuario.usuarioId} value={`${usuario.usuarioId}`}>
              {usuario.nombreUsuario || usuario.usuario} {usuario.usuarioCorrelativo ? `(${usuario.usuarioCorrelativo})` : ""}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TableContainer sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Modulo / operacion</TableCell>
              <TableCell>Prefijo</TableCell>
              <TableCell>Codigo usuario</TableCell>
              <TableCell>Siguiente numero</TableCell>
              <TableCell>Siguiente correlativo</TableCell>
              <TableCell align="right">Accion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usuarioRowsFiltradas.map((row) => (
              <TableRow key={`${row.usuarioId}-${row.operacion}`}>
                <TableCell>
                  <Typography fontWeight={700}>{row.nombreOperacion}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.formato}
                  </Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={row.prefijo}
                    onChange={(e) => actualizarCampoUsuario(row.usuarioId, row.operacion, "prefijo", e.target.value)}
                    disabled={!canManage}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 140 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={row.codigoUsuario}
                    onChange={(e) => actualizarCampoUsuario(row.usuarioId, row.operacion, "codigoUsuario", e.target.value)}
                    disabled={!canManage}
                    helperText={row.usuarioCorrelativo ? "Desde usuario" : "Auto si esta vacio en usuario"}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 140 }}>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    value={row.siguienteNumero}
                    onChange={(e) => actualizarCampoUsuario(row.usuarioId, row.operacion, "siguienteNumero", e.target.value)}
                    inputProps={{ min: 1 }}
                    disabled={!canManage}
                  />
                </TableCell>
                <TableCell>{row.siguienteCorrelativo}</TableCell>
                <TableCell align="right">
                  <Button variant="contained" size="small" startIcon={<SaveOutlined />} onClick={() => guardarUsuarioOperacion(row)} disabled={!canManage}>
                    Guardar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!usuarioRowsFiltradas.length && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No hay correlativos por usuario disponibles.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Reporte unificado de produccion
      </Typography>

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
