import { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Grid,
  Stack,
  Divider,
  Chip,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InventoryIcon from "@mui/icons-material/Inventory";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { useSystemConfigStore } from "../config/useSystemConfigStore";

interface Venta {
  id: number;
  fecha: string;
  total: number;
  bodegaId?: number | null;
  vendedor?: string | null;
  bodega?: { nombre?: string };
}

interface ProductoResumen {
  id: number;
  codigo: string;
  nombre: string;
  stockMax: number;
}

interface InventarioRow {
  productoId: number;
  bodegaId: number;
  codigo: string;
  producto: string;
  stock: number;
  stockMax: number;
  bodega: string;
}

interface Bodega {
  id: number;
  nombre: string;
}

const toDateOnly = (d: string | Date) => {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
};

const LineChart = ({ data }: { data: { label: string; value: number }[] }) => {
  if (!data.length) return <Typography variant="body2">Sin datos.</Typography>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 760;
  const height = 260;
  const step = width / Math.max(data.length - 1, 1);
  const points = data.map((d, idx) => {
    const x = idx * step;
    const y = height - (d.value / max) * (height * 0.8) - 20;
    return { x, y };
  });
  const pathD = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <svg width={width} height={height} role="img">
        <path d={pathD} stroke="#1e88e5" strokeWidth={3} fill="none" />
        {points.map((p, idx) => (
          <g key={idx}>
            <title>{`${data[idx].label}: Q ${data[idx].value.toFixed(2)}`}</title>
            <circle cx={p.x} cy={p.y} r={4} fill="#1e88e5" />
          </g>
        ))}
      </svg>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: -1, mx: 0.5 }}>
        {data.map((d, idx) => (
          <Typography key={idx} variant="caption" color="text.secondary">
            {d.label}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
};

const MiniBarChart = ({ data }: { data: { label: string; value: number }[] }) => {
  if (!data.length) return <Typography variant="body2">Sin datos.</Typography>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <Stack direction="row" alignItems="flex-end" spacing={0.4} sx={{ height: 120 }}>
      {data.map((d, idx) => (
        <Box
          key={idx}
          sx={{
            width: `${100 / data.length}%`,
            minWidth: 6,
            backgroundColor: "#1e88e5",
            height: `${(d.value / max) * 100}%`,
            borderRadius: 1,
          }}
          title={`${d.label}: Q ${d.value.toFixed(2)}`}
        />
      ))}
    </Stack>
  );
};

export default function Dashboard() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [inventario, setInventario] = useState<InventarioRow[]>([]);
  const [productos, setProductos] = useState<ProductoResumen[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [loading, setLoading] = useState(true);
  const [rango, setRango] = useState<"7" | "30" | "90" | "all">("30");
  const [bodegaFiltro, setBodegaFiltro] = useState<"all" | number>("all");
  const [vendedorFiltro, setVendedorFiltro] = useState<"all" | string>("all");
  const { rol, rolId, usuario, bodegaId: userBodegaId } = useAuthStore();
  const { crossStoreRoleIds, fetchConfig } = useSystemConfigStore();
  const canAccessAllBodegas = rol === "ADMIN" || crossStoreRoleIds.includes(Number(rolId));

  useEffect(() => {
    const load = async () => {
      try {
        const [respVentas, respInv, respProd, respBod] = await Promise.all([
          api.get("/ventas"),
          api.get("/inventario/reporte"),
          api.get("/productos"),
          api.get("/bodegas").catch(() => ({ data: [] })),
        ]);
        setVentas(respVentas.data || []);
        setInventario(respInv.data || []);
        setProductos(respProd.data || []);
        setBodegas(respBod.data || []);
      } catch (error) {
        console.error("No se pudieron cargar los datos de dashboard", error);
      } finally {
        setLoading(false);
      }
    };
    load();
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (!canAccessAllBodegas) {
      if (userBodegaId) setBodegaFiltro(Number(userBodegaId));
      if (usuario) setVendedorFiltro(usuario);
    } else {
      setBodegaFiltro("all");
      setVendedorFiltro("all");
    }
  }, [canAccessAllBodegas, usuario, userBodegaId]);

  const stats = useMemo(() => {
    const hoy = new Date();
    const inventarioFiltrado =
      bodegaFiltro === "all" ? inventario : inventario.filter((r) => Number(r.bodegaId) === Number(bodegaFiltro));
    const desde =
      rango === "all"
        ? new Date(0)
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() - Number(rango) + 1);
            return d;
          })();
    const previoDesde = new Date(desde);
    previoDesde.setDate(previoDesde.getDate() - Number(rango || 0));
    const previoHasta = new Date(desde);
    previoHasta.setDate(previoHasta.getDate() - 1);

    const ventasFiltradasBase = ventas.filter((v) => {
      const pasaBodega =
        bodegaFiltro === "all" ? true : Number(v.bodegaId) === Number(bodegaFiltro);
      const pasaVendedor =
        vendedorFiltro === "all"
          ? true
          : (v.vendedor || "").toLowerCase() === (vendedorFiltro as string).toLowerCase();
      return pasaBodega && pasaVendedor;
    });

    const ventasActual = ventasFiltradasBase.filter((v) => new Date(v.fecha) >= desde);
    const ventasPrevio = ventasFiltradasBase.filter(
      (v) => new Date(v.fecha) >= previoDesde && new Date(v.fecha) <= previoHasta
    );
    const ventasHoy = ventasFiltradasBase.filter((v) => toDateOnly(v.fecha) === toDateOnly(hoy));

    const totalVentas = ventasActual.reduce((sum, v) => sum + (v.total || 0), 0);
    const totalPrevio = ventasPrevio.reduce((sum, v) => sum + (v.total || 0), 0);
    const delta = totalPrevio ? ((totalVentas - totalPrevio) / totalPrevio) * 100 : 0;

    const totalVentasHoy = ventasHoy.reduce((sum, v) => sum + (v.total || 0), 0);
    const ticketsHoy = ventasHoy.length;

    const totalStock = inventarioFiltrado.reduce((sum, r) => sum + (r.stock || 0), 0);
    const totalProductos = productos.length;

    const bajosStock = inventarioFiltrado
      .filter((r) => r.stock < r.stockMax)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 5);

    const topVentas = ventas
      .slice()
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const ventasPorDia = (() => {
      const mapa = new Map<string, number>();
      ventasActual.forEach((v) => {
        const key = toDateOnly(v.fecha);
        mapa.set(key, (mapa.get(key) || 0) + (v.total || 0));
      });
      const labels = Array.from(mapa.keys()).sort();
      return labels.map((l) => ({
        label: l.slice(5).replace("-", "/"),
        value: mapa.get(l) || 0,
      }));
    })();

    const actividadReciente = (() => {
      const mapa = new Map<string, number>();
      ventasActual.forEach((v) => {
        const key = toDateOnly(v.fecha);
        mapa.set(key, (mapa.get(key) || 0) + (v.total || 0));
      });
      return Array.from(mapa.entries())
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .slice(-14)
        .map(([label, value]) => ({ label: label.slice(5).replace("-", "/"), value }));
    })();

    const stockPorBodega = Object.values(
      inventarioFiltrado.reduce<Record<string, { nombre: string; stock: number }>>((acc, r) => {
        const key = r.bodega;
        if (!acc[key]) acc[key] = { nombre: key, stock: 0 };
        acc[key].stock += r.stock || 0;
        return acc;
      }, {})
    ).sort((a, b) => b.stock - a.stock);

    return {
      totalVentas,
      totalPrevio,
      delta,
      totalVentasHoy,
      ticketsHoy,
      totalStock,
      totalProductos,
      bajosStock,
      topVentas,
      ventasPorDia,
      actividadReciente,
      stockPorBodega,
    };
  }, [ventas, inventario, productos, rango, bodegaFiltro, vendedorFiltro]);

  return (
    <Paper sx={{ p: 3, minHeight: "100%", background: "#f7f9fb" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2, gap: 1 }}>
        <Stack spacing={0.5}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Resumen de ventas, actividad e inventario
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
          <FormControl size="small" sx={{ minWidth: 150 }} disabled={!canAccessAllBodegas}>
            <InputLabel>Filtrar por bodega</InputLabel>
            <Select
              label="Filtrar por bodega"
              value={bodegaFiltro === "all" ? "all" : String(bodegaFiltro)}
              onChange={(e) => setBodegaFiltro(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <MenuItem value="all">Todas</MenuItem>
              {bodegas.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }} disabled={!canAccessAllBodegas}>
            <InputLabel>Filtrar por vendedor</InputLabel>
            <Select
              label="Filtrar por vendedor"
              value={vendedorFiltro === "all" ? "all" : vendedorFiltro}
              onChange={(e) => setVendedorFiltro(e.target.value === "all" ? "all" : e.target.value)}
            >
              <MenuItem value="all">Todos</MenuItem>
              {Array.from(
                new Set(
                  ventas
                    .map((v) => (v.vendedor || "").trim())
                    .filter((v) => v && v.length > 0)
                )
              ).map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ToggleButtonGroup
            value={rango}
            exclusive
            size="small"
            onChange={(_, val) => val && setRango(val)}
          >
            <ToggleButton value="7">7d</ToggleButton>
            <ToggleButton value="30">30d</ToggleButton>
            <ToggleButton value="90">90d</ToggleButton>
            <ToggleButton value="all">Todo</ToggleButton>
          </ToggleButtonGroup>
          {loading && <Chip label="Cargando" size="small" />}
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="caption" color="text.secondary">
              Ventas (rango)
            </Typography>
            <Typography variant="h5">Q {stats.totalVentas.toFixed(2)}</Typography>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <ArrowDropUpIcon color={stats.delta >= 0 ? "success" : "error"} />
              <Typography variant="caption" color={stats.delta >= 0 ? "success.main" : "error.main"}>
                {stats.delta >= 0 ? "+" : ""}
                {stats.delta.toFixed(1)}% vs previo
              </Typography>
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="caption" color="text.secondary">
              Ventas hoy
            </Typography>
            <Typography variant="h5">Q {stats.totalVentasHoy.toFixed(2)}</Typography>
            <Typography variant="caption" color="text.secondary">
              Tickets: {stats.ticketsHoy}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="caption" color="text.secondary">
              Stock total
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <InventoryIcon color="primary" />
              <Typography variant="h5">{stats.totalStock}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Items en todas las bodegas
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="caption" color="text.secondary">
              Productos
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <TrendingUpIcon color="info" />
              <Typography variant="h5">{stats.totalProductos}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Catálogo activo
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">Ventas</Typography>
          <Typography variant="caption" color="text.secondary">
            Últimos {rango === "all" ? "datos" : `${rango} días`} (filtrado)
          </Typography>
        </Stack>
        <Divider sx={{ mb: 1 }} />
        <LineChart data={stats.ventasPorDia} />
      </Paper>

      <Grid container spacing={3} alignItems="stretch">
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", minHeight: 320 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <WarningAmberIcon color="warning" />
              <Typography variant="h6">Productos bajos en stock</Typography>
            </Stack>
            <Divider sx={{ mb: 1 }} />
            {stats.bajosStock.length === 0 ? (
              <Typography variant="body2">Todo en orden, no hay faltantes.</Typography>
            ) : (
              <List dense>
                {stats.bajosStock.map((r) => (
                  <ListItem key={`${r.productoId}-${r.bodegaId}`} disableGutters>
                    <ListItemText
                      primary={`${r.codigo} - ${r.producto}`}
                      secondary={`Bodega: ${r.bodega} | Stock: ${r.stock}/${r.stockMax}`}
                    />
                    <Box sx={{ minWidth: 120 }}>
                      <Divider
                        variant="middle"
                        sx={{
                          height: 8,
                          borderRadius: 999,
                          borderColor: "transparent",
                          background: `linear-gradient(90deg, #1e88e5 ${(r.stock / (r.stockMax || 1)) * 100}%, #e5e7eb ${(r.stock / (r.stockMax || 1)) * 100}%)`,
                        }}
                      />
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", minHeight: 320 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6">Actividad reciente</Typography>
              <Typography variant="caption" color="text.secondary">
                Últimos 14 registros
              </Typography>
            </Stack>
            <Divider sx={{ mb: 1 }} />
            <MiniBarChart data={stats.actividadReciente} />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6}}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", minHeight: 320, mt: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <TrendingUpIcon color="primary" />
              <Typography variant="h6">Top ventas</Typography>
            </Stack>
            <Divider sx={{ mb: 1 }} />
            {stats.topVentas.length === 0 ? (
              <Typography variant="body2">Aún no hay ventas registradas.</Typography>
            ) : (
              <List dense>
                {stats.topVentas.map((v, idx) => (
                  <ListItem key={v.id} disableGutters>
                    <ListItemText
                      primary={`V-${v.id}`}
                      secondary={new Date(v.fecha).toLocaleDateString()}
                    />
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 140 }}>
                      <Typography variant="caption" color="text.secondary">
                        Q {v.total.toFixed(2)}
                      </Typography>
                      <Box sx={{ flex: 1, height: 8, borderRadius: 999, backgroundColor: "#e5e7eb" }}>
                        <Box
                          sx={{
                            width: `${Math.min((v.total / stats.topVentas[0].total) * 100, 100)}%`,
                            height: "100%",
                            borderRadius: 999,
                            backgroundColor: "#1e88e5",
                          }}
                        />
                      </Box>
                    </Stack>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", minHeight: 320, mt: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <InventoryIcon color="secondary" />
              <Typography variant="h6">Inventario por bodega</Typography>
            </Stack>
            <Divider sx={{ mb: 1 }} />
            {stats.stockPorBodega.length === 0 ? (
              <Typography variant="body2">Sin datos de inventario.</Typography>
            ) : (
              <List dense>
                {stats.stockPorBodega.slice(0, 5).map((b) => (
                  <ListItem key={b.nombre} disableGutters>
                    <ListItemText primary={b.nombre} secondary={`${b.stock} unidades`} />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );
}
