import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import Swal from "sweetalert2";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";
import UniformaTableLoadingRow from "../components/UniformaTableLoadingRow";
import { canUseVendedorDropdown } from "../utils/vendedorDropdownAccess";
import { useTablePagination } from "../utils/useTablePagination";

interface PagoRecibido {
  id: number;
  monto: number;
  recargo: number;
  tipo?: string | null;
  metodo?: string | null;
  referenciaPago?: string | null;
  fecha?: string | null;
  pedidoId: number;
  pedidoFolio: string;
  clienteNombre: string;
  bodegaNombre: string;
  bodegaId?: number | string | null;
  estado?: string | null;
  vendedor: string;
}

const money = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PagosRecibidos() {
  const { usuario, usuarioCorrelativo, rol, rolId, permisos } = useAuthStore();
  const { vendedorDropdownRoleIds, vendedorDropdownBodegaIds, fetchConfig } = useSystemConfigStore();
  const isAdmin = Boolean(rol?.toLowerCase().includes("admin"));
  const canUseDropdown = canUseVendedorDropdown(rol, rolId, vendedorDropdownRoleIds, permisos);
  const currentUser = `${usuario || ""}`.trim().toLowerCase();
  const currentUserAlt = `${usuarioCorrelativo || ""}`.trim().toLowerCase();
  const [pagos, setPagos] = useState<PagoRecibido[]>([]);
  const [selectedPago, setSelectedPago] = useState<PagoRecibido | null>(null);
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [selectedVendedor, setSelectedVendedor] = useState("all");

  const cargarPagos = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/produccion");
      const pagosRecibidos: PagoRecibido[] = [];
      (resp.data || []).forEach((pedido: any) => {
        const clienteNombre = pedido?.cliente?.nombre || pedido?.clienteNombre || "Mostrador";
        const bodegaNombre = pedido?.bodega?.nombre || pedido?.bodegaNombre || "N/D";
        const pedidoFolio = pedido?.folio || `P-${pedido?.id}`;
        const vendedor = `${pedido?.solicitadoPor || pedido?.vendedor || pedido?.usuario || (pedido?.usuario?.usuario ?? "") || "N/D"}`.trim();
        if (Array.isArray(pedido?.pagos)) {
          pedido.pagos.forEach((pago: any) => {
            pagosRecibidos.push({
              id: Number(pago?.id || 0),
              monto: Number(pago?.monto || 0),
              recargo: Number(pago?.recargo || 0),
              tipo: pago?.tipo || null,
              metodo: pago?.metodo || null,
              referenciaPago: pago?.referenciaPago || null,
              fecha: pago?.fecha || pedido?.fecha || null,
              pedidoId: Number(pedido?.id || 0),
              pedidoFolio,
              clienteNombre,
              bodegaNombre,
              bodegaId: pedido?.bodegaId ?? null,
              estado: pedido?.estado || null,
              vendedor,
            });
          });
        }
      });
      setPagos(pagosRecibidos);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar los pagos recibidos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    void cargarPagos();
  }, []);

  const pedidoFiltro = Number(searchParams.get("pedido") || "0") || null;

  const pagosPermitidos = useMemo(
    () =>
      isAdmin || !canUseDropdown || !vendedorDropdownBodegaIds.length
        ? pagos
        : pagos.filter((pago) => {
            const bodegaId = Number(pago.bodegaId);
            return Number.isFinite(bodegaId) && vendedorDropdownBodegaIds.includes(bodegaId);
          }),
    [canUseDropdown, isAdmin, pagos, vendedorDropdownBodegaIds]
  );

  const vendedores = useMemo(
    () => Array.from(new Set(pagosPermitidos.map((pago) => pago.vendedor).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [pagosPermitidos]
  );

  const isMatchingCurrentUser = useCallback((vendedor?: string) => {
    const value = `${vendedor || ""}`.trim().toLowerCase();
    if (!value) return false;
    return [currentUser, currentUserAlt].some((key) => key && value.includes(key));
  }, [currentUser, currentUserAlt]);

  const pagosFiltrados = useMemo(
    () =>
      pagosPermitidos
        .filter((pago) => (pedidoFiltro ? pago.pedidoId === pedidoFiltro : true))
        .filter((pago) => {
          if (!canUseDropdown && currentUser) {
            return isMatchingCurrentUser(pago.vendedor);
          }
          if (canUseDropdown && selectedVendedor !== "all") {
            return pago.vendedor === selectedVendedor;
          }
          return true;
        })
        .filter((pago) => {
          const fecha = pago.fecha ? pago.fecha.slice(0, 10) : "";
          if (filtroDesde && fecha < filtroDesde) return false;
          if (filtroHasta && fecha > filtroHasta) return false;
          return true;
        }),
    [pagosPermitidos, pedidoFiltro, filtroDesde, filtroHasta, canUseDropdown, selectedVendedor, currentUser, isMatchingCurrentUser]
  );
  const { paginatedRows, paginationProps } = useTablePagination(pagosFiltrados, 10);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ReceiptLongOutlined color="primary" />
          <Typography variant="h4">Pagos recibidos</Typography>
        </Stack>
        <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={cargarPagos} disabled={loading}>
          Recargar
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        {canUseDropdown ? (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Vendedor</InputLabel>
            <Select
              label="Vendedor"
              value={selectedVendedor}
              onChange={(e) => setSelectedVendedor(e.target.value)}
            >
              <MenuItem value="all">Todos</MenuItem>
              {vendedores.map((vendedor) => (
                <MenuItem key={vendedor} value={vendedor}>
                  {vendedor}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        <TextField
          label="Desde"
          type="date"
          size="small"
          value={filtroDesde}
          onChange={(e) => setFiltroDesde(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Hasta"
          type="date"
          size="small"
          value={filtroHasta}
          onChange={(e) => setFiltroHasta(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Pago</TableCell>
              <TableCell>Pedido</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Bodega</TableCell>
              <TableCell>Vendedor</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <UniformaTableLoadingRow colSpan={9} />
            ) : paginatedRows.map((pago) => (
              <TableRow key={`${pago.pedidoId}-${pago.id}`} hover>
                <TableCell>{pago.fecha ? new Date(pago.fecha).toLocaleString() : "-"}</TableCell>
                <TableCell>#{pago.id}</TableCell>
                <TableCell>{pago.pedidoFolio}</TableCell>
                <TableCell>{pago.clienteNombre}</TableCell>
                <TableCell>{pago.bodegaNombre}</TableCell>
                <TableCell>{pago.vendedor || "-"}</TableCell>
                <TableCell align="right">{money(pago.monto + pago.recargo)}</TableCell>
                <TableCell>{pago.estado || "-"}</TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined" startIcon={<VisibilityOutlined />} onClick={() => setSelectedPago(pago)}>
                    Ver
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination {...paginationProps} />
      </TableContainer>

      {!loading && !pagosFiltrados.length && (
        <Paper variant="outlined" sx={{ p: 4, mt: 2, textAlign: "center" }}>
          <Typography color="text.secondary">No se encontraron pagos recibidos.</Typography>
        </Paper>
      )}

      <Dialog open={Boolean(selectedPago)} onClose={() => setSelectedPago(null)} fullWidth maxWidth="sm">
        <DialogTitle>Detalle de pago</DialogTitle>
        <DialogContent dividers>
          {selectedPago ? (
            <Stack spacing={1.5}>
              <Typography>
                <strong>Pago:</strong> #{selectedPago.id}
              </Typography>
              <Typography>
                <strong>Pedido:</strong> {selectedPago.pedidoFolio}
              </Typography>
              <Typography>
                <strong>Cliente:</strong> {selectedPago.clienteNombre}
              </Typography>
              <Typography>
                <strong>Bodega:</strong> {selectedPago.bodegaNombre}
              </Typography>
              <Typography>
                <strong>Vendedor:</strong> {selectedPago.vendedor || "-"}
              </Typography>
              <Typography>
                <strong>Fecha:</strong> {selectedPago.fecha ? new Date(selectedPago.fecha).toLocaleString() : "No disponible"}
              </Typography>
              <Typography>
                <strong>Monto:</strong> {money(selectedPago.monto)}
              </Typography>
              <Typography>
                <strong>Recargo:</strong> {money(selectedPago.recargo)}
              </Typography>
              <Typography>
                <strong>Total pagado:</strong> {money(selectedPago.monto + selectedPago.recargo)}
              </Typography>
              <Typography>
                <strong>Método:</strong> {selectedPago.metodo || "N/D"}
              </Typography>
              <Typography>
                <strong>Tipo:</strong> {selectedPago.tipo || "N/D"}
              </Typography>
              <Typography>
                <strong>Referencia:</strong> {selectedPago.referenciaPago || "N/D"}
              </Typography>
              <Typography>
                <strong>Estado pedido:</strong> {selectedPago.estado || "N/D"}
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedPago(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
