import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert,
  Button,
  Chip,
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
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import UniformaTableLoadingRow from "../components/UniformaTableLoadingRow";
import { useTablePagination } from "../utils/useTablePagination";
import { emptyWhenZero } from "../utils/numberInputs";

interface Bodega {
  id: number;
  nombre: string;
}

interface Usuario {
  id: number;
  nombre: string;
  usuario: string;
  bodegaId?: number | string | null;
  bodega?: Bodega | null;
}

interface MetaMensual {
  id: number;
  year: number;
  month: number;
  bodegaId?: number | null;
  usuarioId?: number | null;
  metaMes: number;
  promedioDiario: number;
  observaciones?: string | null;
  bodega?: Bodega | null;
  usuario?: Usuario | null;
}

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const money = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const countBusinessDays = (year: number, month: number) => {
  const lastDay = new Date(year, month, 0).getDate();
  let days = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    if (new Date(year, month - 1, day).getDay() !== 0) days += 1;
  }
  return days || 1;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export default function MetasMensuales() {
  const currentDate = useMemo(() => new Date(), []);
  const [metas, setMetas] = useState<MetaMensual[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [bodegaId, setBodegaId] = useState<number | "">("");
  const [usuarioId, setUsuarioId] = useState<number | "">("");
  const [metaMes, setMetaMes] = useState("");
  const [promedioDiario, setPromedioDiario] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [promedioManual, setPromedioManual] = useState(false);
  const denyAlertShown = useRef(false);
  const { rol, permisos } = useAuthStore();
  const canView = hasPermission(rol, permisos, "metas.view");
  const canManage = hasPermission(rol, permisos, "metas.manage");

  const metasOrdenadas = useMemo(
    () =>
      [...metas].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return `${a.bodega?.nombre || ""}${a.usuario?.nombre || ""}`.localeCompare(
          `${b.bodega?.nombre || ""}${b.usuario?.nombre || ""}`,
        );
      }),
    [metas],
  );
  const { paginatedRows, paginationProps } = useTablePagination(metasOrdenadas, 10);

  const cargarCatalogos = async () => {
    const [bodegasResp, usuariosResp] = await Promise.all([api.get("/bodegas"), api.get("/usuarios")]);
    setBodegas(bodegasResp.data || []);
    setUsuarios(usuariosResp.data || []);
  };

  const cargarMetas = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/metas/mensuales");
      setMetas(resp.data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las metas mensuales", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      if (!denyAlertShown.current) {
        denyAlertShown.current = true;
        Swal.fire("Acceso restringido", "No tienes permisos para ingresar a Metas mensuales", "warning");
      }
      return;
    }

    void cargarCatalogos();
    void cargarMetas();
  }, [canView]);

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  const actualizarMetaMes = (value: string) => {
    setMetaMes(value);
    if (!promedioManual) {
      const meta = Number(value || 0);
      setPromedioDiario(meta > 0 ? String(roundMoney(meta / countBusinessDays(year, month))) : "");
    }
  };

  const guardar = async () => {
    if (!canManage) {
      Swal.fire("Acceso restringido", "No tienes permisos para gestionar metas", "warning");
      return;
    }

    const meta = Number(metaMes || 0);
    const promedio = Number(promedioDiario || 0);
    if (!meta || meta <= 0) {
      Swal.fire("Validacion", "Ingresa una meta mensual mayor a cero", "info");
      return;
    }

    try {
      await api.post("/metas/mensuales", {
        year,
        month,
        bodegaId: bodegaId || null,
        usuarioId: usuarioId || null,
        metaMes: meta,
        promedioDiario: promedio,
        observaciones: observaciones.trim() || null,
      });
      Swal.fire("Listo", "Meta mensual guardada", "success");
      setMetaMes("");
      setPromedioDiario("");
      setObservaciones("");
      setPromedioManual(false);
      await cargarMetas();
    } catch (error: any) {
      const message = error?.response?.data?.message || "No se pudo guardar la meta mensual";
      Swal.fire("Error", Array.isArray(message) ? message.join(", ") : message, "error");
    }
  };

  const eliminar = async (meta: MetaMensual) => {
    if (!canManage) return;
    const confirm = await Swal.fire({
      title: "Eliminar meta",
      text: `${monthNames[meta.month - 1]} ${meta.year}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`/metas/mensuales/${meta.id}`);
      Swal.fire("Eliminado", "Meta mensual eliminada", "success");
      await cargarMetas();
    } catch {
      Swal.fire("Error", "No se pudo eliminar la meta mensual", "error");
    }
  };

  const alcanceLabel = (meta: MetaMensual) => {
    if (meta.usuarioId) return "Vendedor";
    if (meta.bodegaId) return "Tienda";
    return "Global";
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TrendingUpOutlined color="primary" />
          <Typography variant="h4">Metas mensuales</Typography>
        </Stack>
        <Button startIcon={<RefreshOutlined />} variant="outlined" size="small" onClick={cargarMetas} disabled={loading}>
          Recargar
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        El reporte quincenal toma automaticamente la meta mas especifica disponible: vendedor, tienda o global.
      </Alert>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 3, p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}
      >
        <TextField select label="Mes" size="small" value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={{ minWidth: 150 }}>
          {monthNames.map((name, index) => (
            <MenuItem key={name} value={index + 1}>
              {name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Anio"
          type="number"
          size="small"
          value={year}
          onChange={(e) => setYear(Number(e.target.value) || currentDate.getFullYear())}
          sx={{ width: 110 }}
        />
        <FormControl size="small" sx={{ minWidth: 190 }}>
          <InputLabel>Tienda</InputLabel>
          <Select label="Tienda" value={bodegaId} onChange={(e) => setBodegaId(e.target.value as number | "")}>
            <MenuItem value="">Todas</MenuItem>
            {bodegas.map((bodega) => (
              <MenuItem key={bodega.id} value={bodega.id}>
                {bodega.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Vendedor</InputLabel>
          <Select label="Vendedor" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value as number | "")}>
            <MenuItem value="">Sin vendedor</MenuItem>
            {usuarios.map((usuario) => (
              <MenuItem key={usuario.id} value={usuario.id}>
                {usuario.nombre || usuario.usuario}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Meta mes"
          type="number"
          size="small"
          value={emptyWhenZero(metaMes)}
          onChange={(e) => actualizarMetaMes(e.target.value)}
          sx={{ width: 150 }}
          disabled={!canManage}
        />
        <TextField
          label="Promedio diario"
          type="number"
          size="small"
          value={emptyWhenZero(promedioDiario)}
          onChange={(e) => {
            setPromedioManual(true);
            setPromedioDiario(e.target.value);
          }}
          sx={{ width: 160 }}
          disabled={!canManage}
        />
        <TextField
          label="Observaciones"
          size="small"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          sx={{ minWidth: 220, flex: 1 }}
          disabled={!canManage}
        />
        <Button startIcon={<AddOutlined />} variant="contained" onClick={guardar} disabled={!canManage}>
          Guardar
        </Button>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Periodo</TableCell>
              <TableCell>Alcance</TableCell>
              <TableCell>Tienda</TableCell>
              <TableCell>Vendedor</TableCell>
              <TableCell align="right">Meta mes</TableCell>
              <TableCell align="right">Promedio diario</TableCell>
              <TableCell>Observaciones</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <UniformaTableLoadingRow colSpan={8} />
            ) : (
              paginatedRows.map((meta) => (
                <TableRow key={meta.id}>
                  <TableCell>{`${monthNames[meta.month - 1]} ${meta.year}`}</TableCell>
                  <TableCell>
                    <Chip label={alcanceLabel(meta)} size="small" color={meta.usuarioId ? "primary" : meta.bodegaId ? "secondary" : "default"} />
                  </TableCell>
                  <TableCell>{meta.bodega?.nombre || "Todas"}</TableCell>
                  <TableCell>{meta.usuario?.nombre || meta.usuario?.usuario || "Todos"}</TableCell>
                  <TableCell align="right">{money(meta.metaMes)}</TableCell>
                  <TableCell align="right">{money(meta.promedioDiario)}</TableCell>
                  <TableCell>{meta.observaciones || "-"}</TableCell>
                  <TableCell align="right">
                    <Button
                      variant="text"
                      size="small"
                      color="error"
                      startIcon={<DeleteOutline />}
                      onClick={() => eliminar(meta)}
                      disabled={!canManage}
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
            {!loading && !metasOrdenadas.length && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No hay metas mensuales configuradas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination {...paginationProps} />
    </Paper>
  );
}
