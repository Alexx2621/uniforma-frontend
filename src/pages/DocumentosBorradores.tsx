import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import EditOutlined from "@mui/icons-material/EditOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { formatCurrency } from "../utils/currency";
import { useTablePagination } from "../utils/useTablePagination";

interface DocumentoBorrador {
  id: number;
  tipoDocumento: string;
  estado: string;
  titulo?: string | null;
  totalEstimado: number;
  bodegaId?: number | null;
  clienteId?: number | null;
  bodegaNombre?: string | null;
  clienteNombreRelacionado?: string | null;
  clienteTelefonoRelacionado?: string | null;
  documentoFinalTipo?: string | null;
  documentoFinalId?: number | null;
  documentoFinalFolio?: string | null;
  bloqueadoActivo?: boolean;
  bloqueadoPorNombre?: string | null;
  data?: any;
  creadoEn: string;
  actualizadoEn: string;
}

const tipoLabels: Record<string, string> = {
  "pedido-produccion": "Pedido de produccion",
  venta: "Venta",
  "orden-mixta": "Orden mixta",
  "ingreso-inventario": "Ingreso de inventario",
};

const tipoContinuacionPath: Record<string, string> = {
  "pedido-produccion": "/produccion/nuevo",
  venta: "/ventas/nueva",
  "orden-mixta": "/orden-mixta/nueva",
  "ingreso-inventario": "/inventario",
};

const formatPreliminar = (id: number) => `PRE-${String(id).padStart(6, "0")}`;

const getClienteTexto = (row: DocumentoBorrador) =>
  row?.data?.encabezado?.clienteNombre || row.clienteNombreRelacionado || row.titulo || "Documento preliminar";

const getAntiguedadTexto = (dateValue?: string | null) => {
  if (!dateValue) return "N/D";
  const ms = Date.now() - new Date(dateValue).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "N/D";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes || 1} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
};

export default function DocumentosBorradores() {
  const [rows, setRows] = useState<DocumentoBorrador[]>([]);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/documentos-borradores", {
        params: tipo ? { tipoDocumento: tipo } : undefined,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los documentos preliminares", "error");
    } finally {
      setLoading(false);
    }
  }, [tipo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const rowsFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [
        formatPreliminar(row.id),
        tipoLabels[row.tipoDocumento] || row.tipoDocumento,
        getClienteTexto(row),
        row.estado,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [busqueda, rows]);

  const { paginatedRows, paginationProps } = useTablePagination(rowsFiltrados, 10);

  const continuar = async (row: DocumentoBorrador) => {
    const path = tipoContinuacionPath[row.tipoDocumento];
    if (!path) {
      Swal.fire("No disponible", "Este tipo de documento aun no tiene pantalla de continuacion.", "info");
      return;
    }
    if (row.estado !== "abierto") {
      Swal.fire("No disponible", "Este preliminar ya no esta abierto.", "info");
      return;
    }
    try {
      await api.post(`/documentos-borradores/${row.id}/bloquear`);
    } catch (error: any) {
      Swal.fire("Preliminar en uso", error?.response?.data?.message || "No se pudo bloquear el preliminar para edicion.", "warning");
      await cargar();
      return;
    }
    navigate(path, { state: { borradorId: row.id } });
  };

  const descartar = async (row: DocumentoBorrador) => {
    const result = await Swal.fire({
      title: `Descartar ${formatPreliminar(row.id)}`,
      text: "El documento preliminar se eliminara y no podra recuperarse.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Descartar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d32f2f",
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/documentos-borradores/${row.id}`);
      await cargar();
    } catch {
      Swal.fire("Error", "No se pudo descartar el preliminar", "error");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <DescriptionOutlined color="primary" />
          <Typography variant="h4">Documentos preliminares</Typography>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={cargar} disabled={loading}>
          Recargar
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Buscar"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          fullWidth
        />
        <FormControl fullWidth>
          <InputLabel>Tipo</InputLabel>
          <Select label="Tipo" value={tipo} onChange={(event) => setTipo(event.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="pedido-produccion">Pedido de produccion</MenuItem>
            <MenuItem value="venta">Venta</MenuItem>
            <MenuItem value="orden-mixta">Orden mixta</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Preliminar</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Cliente / titulo</TableCell>
              <TableCell>Bodega</TableCell>
              <TableCell>Total estimado</TableCell>
              <TableCell>Antiguedad</TableCell>
              <TableCell>Ultimo guardado</TableCell>
              <TableCell>Destino</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedRows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{formatPreliminar(row.id)}</TableCell>
                <TableCell>{tipoLabels[row.tipoDocumento] || row.tipoDocumento}</TableCell>
                <TableCell>{getClienteTexto(row)}</TableCell>
                <TableCell>{row.bodegaNombre || row.data?.encabezado?.bodegaNombre || (row.bodegaId ? `Bodega ${row.bodegaId}` : "N/D")}</TableCell>
                <TableCell>{formatCurrency(row.totalEstimado || 0)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={Date.now() - new Date(row.actualizadoEn).getTime() > 1000 * 60 * 60 * 24 * 3 ? "warning" : "default"}
                    label={getAntiguedadTexto(row.actualizadoEn)}
                  />
                </TableCell>
                <TableCell>{row.actualizadoEn ? new Date(row.actualizadoEn).toLocaleString("es-GT") : "N/D"}</TableCell>
                <TableCell>
                  {row.documentoFinalFolio || row.documentoFinalId
                    ? `${row.documentoFinalFolio || row.documentoFinalId} (${row.documentoFinalTipo || "doc"})`
                    : "-"}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Chip size="small" color={row.estado === "abierto" ? "warning" : "default"} label={row.estado || "abierto"} />
                    {row.bloqueadoActivo && <Chip size="small" color="info" label={`Editando: ${row.bloqueadoPorNombre || "usuario"}`} />}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    <Button size="small" variant="outlined" startIcon={<EditOutlined />} onClick={() => void continuar(row)} disabled={row.estado !== "abierto"}>
                      Continuar
                    </Button>
                    <Button size="small" color="error" startIcon={<DeleteOutline />} onClick={() => descartar(row)}>
                      Descartar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!paginatedRows.length && (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  {loading ? "Cargando..." : "No hay documentos preliminares abiertos."}
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
