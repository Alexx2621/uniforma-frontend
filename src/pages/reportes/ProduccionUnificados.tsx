import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Chip,
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
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { Navigate } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../../api/axios";
import { hasPermission } from "../../auth/permissions";
import { useAuthStore } from "../../auth/useAuthStore";
import UniformaTableLoadingRow from "../../components/UniformaTableLoadingRow";
import { descargarProduccionUnificadoPdf, ProduccionArticuloUnificadoPdf } from "../../utils/produccionUnificadoPdf";

interface ProduccionUnificadoRow {
  id: number;
  correlativo: string;
  nombre: string;
  bodegaNombre?: string | null;
  resumen?: {
    filtroTienda?: string;
    pedidos?: unknown[];
    articulos?: ProduccionArticuloUnificadoPdf[];
  } | null;
  totalPedidos: number;
  creadoEn: string;
}

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const sanitizeFilename = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_");

const normalizeGroupedValue = (value: string) => `${value || ""}`.replace(/,\s*(?=\d+\.\s)/g, "\n");

const normalizeArticulo = (articulo: ProduccionArticuloUnificadoPdf): ProduccionArticuloUnificadoPdf => ({
  ...articulo,
  tela: normalizeGroupedValue(articulo.tela),
  talla: normalizeGroupedValue(articulo.talla),
  color: normalizeGroupedValue(articulo.color),
  genero: normalizeGroupedValue(articulo.genero),
  descripcion: normalizeGroupedValue(articulo.descripcion),
  cantidad: Number(articulo.cantidad || 0),
});

export default function ProduccionUnificados() {
  const [rows, setRows] = useState<ProduccionUnificadoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const { rol, permisos } = useAuthStore();
  const canView = hasPermission(rol, permisos, "produccion.view");

  const cargar = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/correlativos/produccion/unificados");
      setRows(resp.data || []);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudieron cargar los reportes unificados", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) void cargar();
  }, [canView]);

  const totalArticulos = useMemo(
    () => rows.reduce((sum, row) => sum + (Array.isArray(row.resumen?.articulos) ? row.resumen!.articulos!.length : 0), 0),
    [rows]
  );

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  const reimprimir = async (row: ProduccionUnificadoRow) => {
    const articulosGuardados = row.resumen?.articulos;
    const articulos = Array.isArray(articulosGuardados) ? articulosGuardados.map(normalizeArticulo) : [];
    if (!articulos.length) {
      Swal.fire("Aviso", "Este reporte no tiene articulos guardados para reimprimir.", "info");
      return;
    }

    try {
      setPrintingId(row.id);
      await descargarProduccionUnificadoPdf({
        articulos,
        fileName: `${sanitizeFilename(row.correlativo)}.pdf`,
        pedidoNo: row.correlativo,
        filtroTienda: row.resumen?.filtroTienda || row.bodegaNombre || row.nombre || "Todas las tiendas",
        totalPedidos: Array.isArray(row.resumen?.pedidos) ? row.resumen!.pedidos!.length : Number(row.totalPedidos || 0),
      });
    } catch (error: any) {
      Swal.fire("Error", error?.message || "No se pudo reimprimir el PDF unificado", "error");
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack>
          <Typography variant="h4">Reportes unificados</Typography>
          <Typography variant="body2" color="text.secondary">
            {rows.length} reporte(s), {totalArticulos} articulo(s) guardados
          </Typography>
        </Stack>
        <Button startIcon={<RefreshOutlined />} variant="outlined" size="small" onClick={cargar} disabled={loading}>
          Recargar
        </Button>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Correlativo</TableCell>
              <TableCell>Tienda</TableCell>
              <TableCell>Generado</TableCell>
              <TableCell align="center">Pedidos</TableCell>
              <TableCell align="center">Articulos</TableCell>
              <TableCell align="right">Accion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <UniformaTableLoadingRow colSpan={6} />
            ) : rows.map((row) => {
              const articulosGuardados = row.resumen?.articulos;
              const pedidosGuardados = row.resumen?.pedidos;
              const articulos = Array.isArray(articulosGuardados) ? articulosGuardados.length : 0;
              const pedidos = Array.isArray(pedidosGuardados) ? pedidosGuardados.length : row.totalPedidos;
              return (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography fontWeight={700}>{row.correlativo}</Typography>
                  </TableCell>
                  <TableCell>{row.resumen?.filtroTienda || row.bodegaNombre || row.nombre || "-"}</TableCell>
                  <TableCell>{formatDateTime(row.creadoEn)}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={pedidos || 0} />
                  </TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={articulos} color={articulos ? "primary" : "default"} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      color="secondary"
                      startIcon={<PictureAsPdfOutlined />}
                      disabled={printingId === row.id}
                      onClick={() => reimprimir(row)}
                    >
                      Reimprimir PDF
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && !rows.length && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No hay reportes unificados generados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
