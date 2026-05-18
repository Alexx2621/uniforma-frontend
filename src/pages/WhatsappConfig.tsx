import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { whatsappFeatureEnabled } from "../config/features";
import { useTablePagination } from "../utils/useTablePagination";

interface WhatsappConfigRow {
  id: number;
  nombre: string;
  usuario: string;
  telefono?: string | null;
  whatsappBusinessNumber?: string | null;
  whatsappPhoneNumberId?: string | null;
  rol?: { nombre?: string | null } | null;
  bodega?: { nombre?: string | null } | null;
}

type DraftConfig = Record<number, { whatsappBusinessNumber: string; whatsappPhoneNumberId: string }>;

export default function WhatsappConfig() {
  const { rol } = useAuthStore();
  const [rows, setRows] = useState<WhatsappConfigRow[]>([]);
  const [draft, setDraft] = useState<DraftConfig>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const canManage = whatsappFeatureEnabled && rol === "ADMIN";
  const { paginatedRows, paginationProps } = useTablePagination(rows, 10);

  const cargar = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/whatsapp/config");
      const nextRows = Array.isArray(data) ? data : [];
      setRows(nextRows);
      setDraft(
        nextRows.reduce((acc: DraftConfig, item: WhatsappConfigRow) => {
          acc[item.id] = {
            whatsappBusinessNumber: item.whatsappBusinessNumber || "",
            whatsappPhoneNumberId: item.whatsappPhoneNumberId || "",
          };
          return acc;
        }, {})
      );
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo cargar la configuracion de WhatsApp", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) void cargar();
  }, [canManage]);

  const updateDraft = (usuarioId: number, field: "whatsappBusinessNumber" | "whatsappPhoneNumberId", value: string) => {
    setDraft((current) => ({
      ...current,
      [usuarioId]: {
        whatsappBusinessNumber: current[usuarioId]?.whatsappBusinessNumber || "",
        whatsappPhoneNumberId: current[usuarioId]?.whatsappPhoneNumberId || "",
        [field]: value,
      },
    }));
  };

  const guardar = async (row: WhatsappConfigRow) => {
    try {
      setSavingId(row.id);
      const payload = draft[row.id] || { whatsappBusinessNumber: "", whatsappPhoneNumberId: "" };
      const { data } = await api.patch(`/whatsapp/config/${row.id}`, payload);
      setRows((current) => current.map((item) => (item.id === row.id ? data : item)));
      setDraft((current) => ({
        ...current,
        [row.id]: {
          whatsappBusinessNumber: data.whatsappBusinessNumber || "",
          whatsappPhoneNumberId: data.whatsappPhoneNumberId || "",
        },
      }));
      Swal.fire("Guardado", "Configuracion de WhatsApp actualizada", "success");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo guardar la configuracion", "error");
    } finally {
      setSavingId(null);
    }
  };

  if (!canManage) {
    return <Navigate to="/" replace />;
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <WhatsAppIcon color="success" />
          <Box>
            <Typography variant="h4">WhatsApp Business</Typography>
            <Typography variant="body2" color="text.secondary">
              Asigna el numero Business y el phone_number_id de Meta a cada vendedor.
            </Typography>
          </Box>
        </Stack>
        <Button startIcon={<RefreshOutlined />} variant="outlined" onClick={() => void cargar()} disabled={loading}>
          Recargar
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        El campo phone_number_id es el identificador que Meta envia en el webhook. Es el dato mas importante para vincular mensajes al vendedor correcto.
      </Alert>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Vendedor</TableCell>
              <TableCell>Tienda/Rol</TableCell>
              <TableCell>Telefono actual</TableCell>
              <TableCell sx={{ minWidth: 190 }}>WhatsApp Business</TableCell>
              <TableCell sx={{ minWidth: 260 }}>phone_number_id</TableCell>
              <TableCell align="right">Accion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedRows.map((row) => {
              const current = draft[row.id] || { whatsappBusinessNumber: "", whatsappPhoneNumberId: "" };
              const configured = Boolean(current.whatsappBusinessNumber && current.whatsappPhoneNumberId);
              return (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography variant="subtitle2">{row.nombre || row.usuario}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.usuario}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2">{row.bodega?.nombre || "Sin tienda"}</Typography>
                      <Chip size="small" label={row.rol?.nombre || "Sin rol"} variant="outlined" sx={{ width: "fit-content" }} />
                    </Stack>
                  </TableCell>
                  <TableCell>{row.telefono || "N/D"}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="502XXXXXXXX"
                      value={current.whatsappBusinessNumber}
                      onChange={(event) => updateDraft(row.id, "whatsappBusinessNumber", event.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="123456789012345"
                      value={current.whatsappPhoneNumberId}
                      onChange={(event) => updateDraft(row.id, "whatsappPhoneNumberId", event.target.value)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                      <Chip size="small" color={configured ? "success" : "default"} label={configured ? "Configurado" : "Pendiente"} />
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<SaveOutlined />}
                        disabled={savingId === row.id}
                        onClick={() => void guardar(row)}
                      >
                        Guardar
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && !rows.length && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary">No hay usuarios disponibles para configurar.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination {...paginationProps} />
      </Box>
    </Paper>
  );
}
