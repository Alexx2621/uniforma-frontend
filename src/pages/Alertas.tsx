import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CampaignOutlined from "@mui/icons-material/CampaignOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Swal from "sweetalert2";
import { api } from "../api/axios";

interface Rol {
  id: number;
  nombre: string;
}

interface Usuario {
  id: number;
  nombre?: string | null;
  usuario?: string | null;
}

interface CampanaAlerta {
  batchId: string;
  titulo: string;
  mensaje: string;
  prioridad: "baja" | "normal" | "alta" | "urgente";
  estado: "enviada" | "programada";
  programadaPara?: string | null;
  enviadaEn?: string | null;
  creadaEn: string;
  destinatarios: number;
  leidas: number;
  roles?: string[];
}

const prioridadColor: Record<string, "default" | "info" | "warning" | "error"> = {
  baja: "info",
  normal: "default",
  alta: "warning",
  urgente: "error",
};

export default function Alertas() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [campanas, setCampanas] = useState<CampanaAlerta[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    mensaje: "",
    prioridad: "normal",
    destinatarioTipo: "todos",
    rolIds: [] as number[],
    usuarioIds: [] as number[],
    programadaPara: "",
  });

  const cargarDatos = useCallback(async () => {
    const [rolesResp, usuariosResp, campanasResp] = await Promise.all([
      api.get("/roles").catch(() => ({ data: [] })),
      api.get("/usuarios").catch(() => ({ data: [] })),
      api.get("/alertas/campanas").catch(() => ({ data: [] })),
    ]);
    setRoles(Array.isArray(rolesResp.data) ? rolesResp.data : []);
    setUsuarios(Array.isArray(usuariosResp.data) ? usuariosResp.data : []);
    setCampanas(Array.isArray(campanasResp.data) ? campanasResp.data : []);
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const limpiar = () => {
    setForm({
      titulo: "",
      mensaje: "",
      prioridad: "normal",
      destinatarioTipo: "todos",
      rolIds: [],
      usuarioIds: [],
      programadaPara: "",
    });
  };

  const enviar = async () => {
    try {
      setLoading(true);
      const payload = {
        ...form,
        programadaPara: form.programadaPara ? new Date(form.programadaPara).toISOString() : null,
      };
      const { data } = await api.post("/alertas/manual", payload);
      await Swal.fire(
        "Listo",
        data?.estado === "programada"
          ? `Alerta programada para ${new Date(data.programadaPara).toLocaleString("es-GT")}`
          : `Alerta enviada a ${data?.creadas || 0} usuario(s).`,
        "success",
      );
      limpiar();
      await cargarDatos();
    } catch (error: any) {
      const msg = error?.response?.data?.message || "No se pudo crear la alerta";
      Swal.fire("Error", Array.isArray(msg) ? msg.join(", ") : msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo<GridColDef<CampanaAlerta>[]>(
    () => [
      { field: "titulo", headerName: "Titulo", minWidth: 220, flex: 1 },
      {
        field: "prioridad",
        headerName: "Prioridad",
        minWidth: 130,
        renderCell: (params) => (
          <Chip size="small" label={params.row.prioridad.toUpperCase()} color={prioridadColor[params.row.prioridad]} />
        ),
      },
      {
        field: "estado",
        headerName: "Estado",
        minWidth: 130,
        renderCell: (params) => (
          <Chip size="small" label={params.row.estado} color={params.row.estado === "programada" ? "warning" : "success"} />
        ),
      },
      { field: "destinatarios", headerName: "Dest.", minWidth: 90 },
      {
        field: "leidas",
        headerName: "Leidas",
        minWidth: 100,
        valueGetter: (_, row) => `${row.leidas}/${row.destinatarios}`,
      },
      {
        field: "programadaPara",
        headerName: "Programada",
        minWidth: 180,
        valueGetter: (_, row) => (row.programadaPara ? new Date(row.programadaPara).toLocaleString("es-GT") : "Inmediata"),
      },
      {
        field: "roles",
        headerName: "Roles",
        minWidth: 180,
        flex: 0.8,
        valueGetter: (_, row) => row.roles?.join(", ") || "N/D",
      },
    ],
    [],
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4">Alertas internas</Typography>
          <Typography variant="body2" color="text.secondary">
            Envia avisos en tiempo real o programalos para recordatorios operativos.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => void cargarDatos()}>
          Recargar
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <CampaignOutlined color="primary" />
          <Typography variant="h6">Nueva alerta</Typography>
        </Stack>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Titulo"
              fullWidth
              value={form.titulo}
              onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              select
              label="Prioridad"
              fullWidth
              value={form.prioridad}
              onChange={(e) => setForm((prev) => ({ ...prev, prioridad: e.target.value }))}
            >
              <MenuItem value="baja">Baja</MenuItem>
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="alta">Alta</MenuItem>
              <MenuItem value="urgente">Urgente</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              select
              label="Destinatarios"
              fullWidth
              value={form.destinatarioTipo}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, destinatarioTipo: e.target.value, rolIds: [], usuarioIds: [] }))
              }
            >
              <MenuItem value="todos">Todos los usuarios activos</MenuItem>
              <MenuItem value="roles">Por roles</MenuItem>
              <MenuItem value="usuarios">Usuarios especificos</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="Programar para"
              type="datetime-local"
              fullWidth
              value={form.programadaPara}
              onChange={(e) => setForm((prev) => ({ ...prev, programadaPara: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              helperText="Vacio envia de inmediato"
            />
          </Grid>
          {form.destinatarioTipo === "roles" && (
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Roles</InputLabel>
                <Select
                  multiple
                  label="Roles"
                  value={form.rolIds}
                  onChange={(e) => setForm((prev) => ({ ...prev, rolIds: e.target.value as number[] }))}
                  renderValue={(selected) =>
                    roles.filter((rol) => (selected as number[]).includes(rol.id)).map((rol) => rol.nombre).join(", ")
                  }
                >
                  {roles.map((rol) => (
                    <MenuItem key={rol.id} value={rol.id}>
                      <Checkbox checked={form.rolIds.includes(rol.id)} />
                      <ListItemText primary={rol.nombre} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          {form.destinatarioTipo === "usuarios" && (
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Usuarios</InputLabel>
                <Select
                  multiple
                  label="Usuarios"
                  value={form.usuarioIds}
                  onChange={(e) => setForm((prev) => ({ ...prev, usuarioIds: e.target.value as number[] }))}
                  renderValue={(selected) =>
                    usuarios
                      .filter((usuario) => (selected as number[]).includes(usuario.id))
                      .map((usuario) => usuario.nombre || usuario.usuario)
                      .join(", ")
                  }
                >
                  {usuarios.map((usuario) => (
                    <MenuItem key={usuario.id} value={usuario.id}>
                      <Checkbox checked={form.usuarioIds.includes(usuario.id)} />
                      <ListItemText primary={usuario.nombre || usuario.usuario} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Mensaje"
              fullWidth
              multiline
              minRows={3}
              value={form.mensaje}
              onChange={(e) => setForm((prev) => ({ ...prev, mensaje: e.target.value }))}
            />
          </Grid>
        </Grid>
        <Alert severity="info" sx={{ my: 2 }}>
          Las alertas urgentes y altas se resaltan con colores mas intensos en el panel de notificaciones.
        </Alert>
        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button onClick={limpiar} disabled={loading}>
            Limpiar
          </Button>
          <Button startIcon={<SendOutlined />} variant="contained" onClick={enviar} disabled={loading}>
            {form.programadaPara ? "Programar alerta" : "Enviar alerta"}
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Alertas creadas
        </Typography>
        <Box sx={{ height: 430 }}>
          <DataGrid
            rows={campanas}
            columns={columns}
            getRowId={(row) => row.batchId}
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            disableRowSelectionOnClick
            localeText={{ noRowsLabel: "No hay alertas creadas." }}
          />
        </Box>
      </Paper>
    </Box>
  );
}
