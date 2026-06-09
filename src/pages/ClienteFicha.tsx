import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import InsightsOutlined from "@mui/icons-material/InsightsOutlined";
import LocalOfferOutlined from "@mui/icons-material/LocalOfferOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import StarBorderOutlined from "@mui/icons-material/StarBorderOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { formatCurrency } from "../utils/currency";

interface ClienteFichaData {
  cliente: {
    id: number;
    nombre: string;
    telefono?: string | null;
    correo?: string | null;
    direccion?: string | null;
    tipoCliente?: string | null;
  };
  resumen: {
    totalHistorico: number;
    totalVentas: number;
    totalPedidos: number;
    saldoPendiente: number;
    comprasMes: number;
    ventasCantidad: number;
    pedidosCantidad: number;
    postventaCantidad: number;
    pagosCantidad?: number;
    enviosCantidad?: number;
    ordenesMixtasCantidad?: number;
    totalOrdenesMixtas?: number;
    ticketPromedio: number;
    diasSinCompra?: number | null;
    ultimaActividad?: string | null;
  };
  preferencias: {
    productos: { nombre: string; cantidad: number; total: number }[];
    tallas: { nombre: string; cantidad: number }[];
    colores: { nombre: string; cantidad: number }[];
  };
  actividad: {
    tipo: string;
    id: number;
    folio: string;
    fecha: string;
    estado?: string | null;
    total: number;
    saldoPendiente?: number;
    bodega?: string | null;
    metodo?: string | null;
    referencia?: string | null;
    documentos?: number;
  }[];
  oportunidades: string[];
}

const money = formatCurrency;
const dateLabel = (value?: string | null) => (value ? new Date(value).toLocaleString("es-GT") : "Sin actividad");
const titleCase = (value?: string | null) =>
  `${value || "N/D"}`.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const MetricCard = ({ title, value, helper, icon }: { title: string; value: string | number; helper?: string; icon: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: 2, height: "100%", borderRadius: 1 }}>
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
        {helper && (
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
        )}
      </Stack>
      <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
    </Stack>
  </Paper>
);

export default function ClienteFicha() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnState = location.state as { returnTo?: string; returnLabel?: string } | null;
  const [data, setData] = useState<ClienteFichaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        const resp = await api.get(`/clientes/${id}/inteligente`);
        setData(resp.data || null);
      } catch (error: any) {
        Swal.fire("Error", error?.response?.data?.message || "No se pudo cargar la ficha del cliente", "error");
      } finally {
        setLoading(false);
      }
    };
    if (id) void cargar();
  }, [id]);

  const actividad = useMemo(() => data?.actividad || [], [data]);

  const volver = () => {
    navigate(returnState?.returnTo || "/clientes", {
      state: returnState || undefined,
      replace: true,
    });
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <LinearProgress />
      </Paper>
    );
  }

  if (!data) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="warning">No se encontro informacion del cliente.</Alert>
      </Paper>
    );
  }

  const { cliente, resumen, preferencias } = data;

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <InsightsOutlined color="primary" />
          <Box>
            <Typography variant="h4">Ficha inteligente</Typography>
            <Typography variant="body2" color="text.secondary">
              {cliente.nombre} | {cliente.telefono || "Sin telefono"} | {cliente.tipoCliente || "Sin tipo"}
            </Typography>
          </Box>
        </Stack>
        <Button startIcon={<ArrowBackOutlined />} variant="outlined" onClick={volver}>
          {returnState?.returnLabel || "Volver"}
        </Button>
      </Stack>

      {data.oportunidades.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {data.oportunidades.join(" ")}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard title="Historial total" value={money(resumen.totalHistorico)} helper={`${resumen.ventasCantidad} ventas | ${resumen.pedidosCantidad} pedidos`} icon={<ReceiptLongOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard title="Compras este mes" value={money(resumen.comprasMes)} helper={`Ticket promedio: ${money(resumen.ticketPromedio)}`} icon={<ShoppingBagOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard title="Saldo pendiente" value={money(resumen.saldoPendiente)} helper={resumen.saldoPendiente > 0 ? "Requiere seguimiento" : "Sin saldo pendiente"} icon={<PaymentsOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard title="Ultima actividad" value={resumen.diasSinCompra == null ? "N/D" : `${resumen.diasSinCompra} dias`} helper={dateLabel(resumen.ultimaActividad)} icon={<StarBorderOutlined />} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", borderRadius: 1 }}>
            <Typography variant="h6">Preferencias</Typography>
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              <Chip label={`${resumen.postventaCantidad} postventa`} color={resumen.postventaCantidad ? "warning" : "default"} variant="outlined" />
              <Chip label={`${resumen.pagosCantidad || 0} pagos`} variant="outlined" />
              <Chip label={`${resumen.enviosCantidad || 0} envios`} variant="outlined" />
              <Chip label={`${resumen.ordenesMixtasCantidad || 0} ordenes mixtas`} variant="outlined" />
            </Stack>
            <Typography variant="subtitle2">Productos frecuentes</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ my: 1 }}>
              {preferencias.productos.length ? preferencias.productos.map((item) => (
                <Chip key={item.nombre} label={`${item.nombre} (${item.cantidad})`} icon={<LocalOfferOutlined />} />
              )) : <Typography variant="body2" color="text.secondary">Sin productos frecuentes.</Typography>}
            </Stack>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>Tallas</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ my: 1 }}>
              {preferencias.tallas.length ? preferencias.tallas.map((item) => <Chip key={item.nombre} label={`${item.nombre} (${item.cantidad})`} variant="outlined" />) : <Typography variant="body2" color="text.secondary">Sin tallas detectadas.</Typography>}
            </Stack>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>Colores</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ my: 1 }}>
              {preferencias.colores.length ? preferencias.colores.map((item) => <Chip key={item.nombre} label={`${item.nombre} (${item.cantidad})`} variant="outlined" />) : <Typography variant="body2" color="text.secondary">Sin colores detectados.</Typography>}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Typography variant="h6">Linea de tiempo del cliente</Typography>
            <Divider sx={{ my: 1 }} />
            {actividad.length ? (
              <List dense disablePadding>
                {actividad.map((item) => (
                  <ListItem key={`${item.tipo}-${item.id}`} disableGutters>
                    <ListItemText
                      primary={`${item.folio} - ${titleCase(item.tipo)} - ${money(item.total)}`}
                      secondary={[
                        dateLabel(item.fecha),
                        titleCase(item.estado),
                        item.bodega,
                        item.metodo ? `Metodo ${titleCase(item.metodo)}` : null,
                        item.referencia ? `Ref. ${item.referencia}` : null,
                        item.documentos ? `${item.documentos} doc. relacionados` : null,
                        item.saldoPendiente ? `Saldo ${money(item.saldoPendiente)}` : null,
                      ].filter(Boolean).join(" | ")}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">Este cliente aun no tiene actividad registrada.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
