import { useEffect, useMemo, useState } from "react";
import { Paper, Typography, Divider, Stack, TextField, InputAdornment, IconButton } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Swal from "sweetalert2";
import { api } from "../api/axios";

interface Bodega {
  id: number;
  nombre: string;
}

interface ReporteRow {
  id: number;
  productoId: number;
  codigo: string;
  producto: string;
  tipo?: string | null;
  talla: string | null;
  color: string | null;
  tela: string | null;
  stockMax: number;
  stock: number;
  bodega: string;
  bodegaId?: number;
  total?: number;
  stocks?: Record<string | number, number>;
  [key: string]: any;
}

export default function InventarioResumen() {
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [rows, setRows] = useState<ReporteRow[]>([]);
  const [busqueda, setBusqueda] = useState("");

  const cargar = async () => {
    try {
      const [respBod, respRep] = await Promise.all([
        api.get("/bodegas"),
        api.get("/inventario/resumen"),
      ]);
      const bodegasList = respBod.data as Bodega[];
      const rawRows = (respRep.data as ReporteRow[]) || [];

      const expanded: ReporteRow[] = rawRows.map((r) => {
        const copy: any = { ...r, id: Number(r.id ?? r.productoId) };
        const tipoNormalizado = r.tipo && r.tipo !== "N/D" ? r.tipo : r.producto;
        copy.tipo = tipoNormalizado || "N/D";
        bodegasList.forEach((b) => {
          copy[`bodega_${b.id}`] = r.stocks?.[b.id] ?? r.stocks?.[String(b.id)] ?? 0;
        });
        return copy;
      });

      setBodegas(bodegasList);
      setRows(expanded);
    } catch (error) {
      Swal.fire("Error", "No se pudo cargar inventario o bodegas", "error");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const filteredRows = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.codigo.toLowerCase().includes(term));
  }, [rows, busqueda]);

  const columns: GridColDef<ReporteRow>[] = useMemo(() => {
    const base: GridColDef<ReporteRow>[] = [
      { field: "codigo", headerName: "Código", width: 140 },
      {
        field: "tipo",
        headerName: "Tipo",
        width: 140,
      },
      { field: "talla", headerName: "Talla", width: 100 },
      { field: "color", headerName: "Color", width: 120 },
      { field: "tela", headerName: "Tela", width: 140 },
      { field: "total", headerName: "Total", width: 100 },
    ];

    const dynamic = bodegas.map((b) => ({
      field: `bodega_${b.id}`,
      headerName: b.nombre,
      renderHeader: () => (
        <Typography
          variant="caption"
          sx={{ whiteSpace: "normal", textAlign: "center", lineHeight: 1.1 }}
        >
          {b.nombre}
        </Typography>
      ),
      width: 110,
      // usamos el valor precalculado en cada fila (se asigna en el loader)
    }));

    return [...base, ...dynamic];
  }, [bodegas]);

  return (
    <Paper sx={{ p: 3, height: "100%" }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="h4">Resumen de inventario por bodega</Typography>
        <TextField
          size="small"
          placeholder="Buscar por código"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: busqueda ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setBusqueda("")}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
          sx={{ minWidth: 240 }}
        />
      </Stack>
      <Divider sx={{ mb: 2 }} />

      <div style={{ height: 650, width: "100%" }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={(row) => row.id}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </div>
    </Paper>
  );
}
