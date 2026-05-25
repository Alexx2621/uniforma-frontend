import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import AssignmentTurnedInOutlined from "@mui/icons-material/AssignmentTurnedInOutlined";
import CompareArrowsOutlined from "@mui/icons-material/CompareArrowsOutlined";
import ErrorOutlineOutlined from "@mui/icons-material/ErrorOutlineOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import MoveDownOutlined from "@mui/icons-material/MoveDownOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Swal from "sweetalert2";
import { api } from "../api/axios";

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/D";
  return new Date(value).toLocaleString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const sumDetalle = (detalle?: Array<{ cantidad?: number }>) =>
  (detalle || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0);

export default function InventarioPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);

  const cargar = async () => {
    try {
      setLoading(true);
      const resp = await api.get("/inventario/panel-operativo");
      setData(resp.data || null);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo cargar el panel operativo", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const resumen = data?.resumen || {};
  const cards = [
    { label: "Solicitudes pendientes", value: resumen.solicitudesPendientes || 0, icon: <AssignmentTurnedInOutlined />, color: "#1e3a8a" },
    { label: "Traslados en proceso", value: resumen.trasladosEnProceso || 0, icon: <CompareArrowsOutlined />, color: "#0f766e" },
    { label: "Bajo minimo", value: resumen.productosBajoMinimo || 0, icon: <ErrorOutlineOutlined />, color: "#b91c1c" },
    { label: "Ingresos hoy", value: resumen.ingresosHoy || 0, icon: <MoveDownOutlined />, color: "#166534" },
    { label: "Conteos recientes", value: resumen.conteosRecientes || 0, icon: <Inventory2Outlined />, color: "#6d28d9" },
  ];

  const solicitudColumns: GridColDef[] = [
    { field: "folio", headerName: "Solicitud", width: 150, valueGetter: (_, row) => row.folio || `ST-${row.id}` },
    { field: "fecha", headerName: "Fecha", width: 170, valueGetter: (_, row) => formatDateTime(row.fecha) },
    { field: "venta", headerName: "Venta", width: 150, valueGetter: (_, row) => row.venta?.folio || (row.ventaId ? `Venta #${row.ventaId}` : "-") },
    { field: "origen", headerName: "Origen", width: 160, valueGetter: (_, row) => row.desdeBodega?.nombre || "N/D" },
    { field: "destino", headerName: "Destino", width: 160, valueGetter: (_, row) => row.haciaBodega?.nombre || "N/D" },
    { field: "items", headerName: "Items", width: 90, align: "center", headerAlign: "center", valueGetter: (_, row) => sumDetalle(row.detalle) },
    { field: "estado", headerName: "Estado", width: 170, renderCell: ({ row }) => <Chip size="small" color={row.estado === "PENDIENTE_APROBACION" ? "warning" : "info"} label={row.estado} /> },
  ];

  const alertaColumns: GridColDef[] = [
    { field: "bodega", headerName: "Bodega", width: 170, valueGetter: (_, row) => row.bodega?.nombre || "N/D" },
    { field: "codigo", headerName: "Codigo", width: 140, valueGetter: (_, row) => row.producto?.codigo || row.productoId },
    { field: "producto", headerName: "Producto", flex: 1, minWidth: 220, valueGetter: (_, row) => row.producto?.nombre || "Producto" },
    { field: "stock", headerName: "Stock", width: 90, align: "center", headerAlign: "center" },
    { field: "minimo", headerName: "Minimo", width: 90, align: "center", headerAlign: "center" },
    { field: "faltan", headerName: "Faltan", width: 90, align: "center", headerAlign: "center" },
  ];

  const conteoColumns: GridColDef[] = [
    { field: "folio", headerName: "Folio", width: 150, valueGetter: (_, row) => row.folio || `CT-${row.id}` },
    { field: "fecha", headerName: "Fecha", width: 170, valueGetter: (_, row) => formatDateTime(row.fecha) },
    { field: "bodega", headerName: "Bodega", width: 180, valueGetter: (_, row) => row.bodega?.nombre || "N/D" },
    { field: "lineas", headerName: "Lineas", width: 90, align: "center", headerAlign: "center", valueGetter: (_, row) => row.detalle?.length || 0 },
    {
      field: "diferencia",
      headerName: "Diferencia total",
      width: 140,
      align: "center",
      headerAlign: "center",
      valueGetter: (_, row) => (row.detalle || []).reduce((sum: number, item: any) => sum + Math.abs(Number(item.diferencia || 0)), 0),
    },
  ];

  const movimientoColumns: GridColDef[] = [
    { field: "fecha", headerName: "Fecha", width: 170, valueGetter: (_, row) => formatDateTime(row.fecha) },
    { field: "bodega", headerName: "Bodega", width: 170, valueGetter: (_, row) => row.bodega?.nombre || "N/D" },
    { field: "codigo", headerName: "Codigo", width: 140, valueGetter: (_, row) => row.producto?.codigo || row.productoId },
    { field: "tipo", headerName: "Movimiento", width: 170 },
    { field: "cantidad", headerName: "Cantidad", width: 100, align: "center", headerAlign: "center" },
    { field: "referencia", headerName: "Referencia", flex: 1, minWidth: 220, valueGetter: (_, row) => row.referencia || "-" },
  ];

  const tabs = [
    { label: "Solicitudes", rows: data?.solicitudes || [], columns: solicitudColumns },
    { label: "Bajo minimo", rows: data?.alertas || [], columns: alertaColumns },
    { label: "Conteos", rows: data?.conteosRecientes || [], columns: conteoColumns },
    { label: "Movimientos", rows: data?.movimientosRecientes || [], columns: movimientoColumns },
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4">Panel operativo de inventario</Typography>
          <Typography color="text.secondary">
            Control diario de traslados, alertas, conteos y movimientos recientes.
          </Typography>
        </Box>
        <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={cargar} disabled={loading}>
          Actualizar
        </Button>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        {cards.map((card) => (
          <Paper key={card.label} variant="outlined" sx={{ p: 2, flex: 1, minWidth: 160 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ color: card.color, display: "flex" }}>{card.icon}</Box>
              <Typography variant="body2" color="text.secondary">{card.label}</Typography>
            </Stack>
            <Typography variant="h4" sx={{ mt: 1, fontWeight: 600 }}>{card.value}</Typography>
          </Paper>
        ))}
      </Stack>

      {(resumen.productosBajoMinimo || 0) > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Hay productos por debajo del mínimo. Revisa la pestaña Bajo minimo antes de operar ventas o traslados.
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        {tabs.map((item) => (
          <Tab key={item.label} label={`${item.label} (${item.rows.length})`} />
        ))}
      </Tabs>

      <div style={{ height: 560, width: "100%" }}>
        <DataGrid
          loading={loading}
          rows={tabs[tab]?.rows || []}
          columns={tabs[tab]?.columns || []}
          getRowId={(row) => `${tabs[tab]?.label || "row"}-${row.id}`}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </div>
    </Paper>
  );
}
