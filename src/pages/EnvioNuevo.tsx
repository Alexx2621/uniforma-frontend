import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PersonSearchOutlined from "@mui/icons-material/PersonSearchOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import Swal from "sweetalert2";
import { api } from "../api/axios";
import { hasPermission } from "../auth/permissions";
import { useAuthStore } from "../auth/useAuthStore";
import { emptyWhenZero, parseNumberInput } from "../utils/numberInputs";

interface DocumentoRelacionable {
  tipo: string;
  documentoId: number;
  referencia?: string | null;
  titulo?: string | null;
  monto?: number | null;
  fecha?: string | null;
}

interface Bodega {
  id: number;
  nombre: string;
}

interface Cliente {
  id: number;
  nombre: string;
  telefono?: string | null;
  direccion?: string | null;
}

const toDateKey = (date: Date) => {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
};

const money = (value: number) =>
  `Q ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const tipoLabel = (tipo: string) => {
  if (tipo === "venta") return "Venta";
  if (tipo === "pedido") return "Pedido";
  if (tipo === "pagoPedido") return "Pago pedido";
  if (tipo === "pagoVenta") return "Pago venta";
  return tipo;
};

const metodoUsaRecargo = (metodo: string) => metodo === "tarjeta" || metodo === "visalink";
const metodoRequiereReferencia = (metodo: string) => metodo !== "efectivo" && metodo !== "sin_cobro";
const metodoRequiereBanco = (metodo: string) => metodo === "deposito_bancario";

export default function EnvioNuevo() {
  const today = useMemo(() => toDateKey(new Date()), []);
  const navigate = useNavigate();
  const { rol, permisos, bodegaId } = useAuthStore();
  const canManage = hasPermission(rol, permisos, "envios.manage");
  const canAccessAllBodegas = hasPermission(rol, permisos, "sistema.multi-tienda");

  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [opciones, setOpciones] = useState<DocumentoRelacionable[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoRelacionable[]>([]);
  const [loading, setLoading] = useState(false);

  const [fecha, setFecha] = useState(today);
  const [selectedBodegaId, setSelectedBodegaId] = useState<number | "">(() => Number(bodegaId || 0) || "");
  const [destinatarioNombre, setDestinatarioNombre] = useState("");
  const [destinatarioTelefono, setDestinatarioTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [empresaTransporte, setEmpresaTransporte] = useState("");
  const [numeroGuia, setNumeroGuia] = useState("");
  const [costo, setCosto] = useState(0);
  const [metodoPagoEnvio, setMetodoPagoEnvio] = useState("efectivo");
  const [porcentajeRecargo, setPorcentajeRecargo] = useState(0);
  const [referenciaPagoEnvio, setReferenciaPagoEnvio] = useState("");
  const [bancoPagoEnvio, setBancoPagoEnvio] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const usaRecargo = metodoUsaRecargo(metodoPagoEnvio);
  const requiereReferencia = metodoRequiereReferencia(metodoPagoEnvio);
  const requiereBanco = metodoRequiereBanco(metodoPagoEnvio);
  const recargo = usaRecargo ? costo * ((porcentajeRecargo || 0) / 100) : 0;
  const totalEnvio = costo + recargo;
  const datosClienteBloqueados = Boolean(clienteSeleccionado);
  const totalDocumentos = documentos.reduce((sum, doc) => sum + Number(doc.monto || 0), 0);

  useEffect(() => {
    api.get("/envios/documentos").then((resp) => setOpciones(resp.data || [])).catch(() => setOpciones([]));
    api.get("/bodegas").then((resp) => setBodegas(resp.data || [])).catch(() => setBodegas([]));
    api.get("/clientes").then((resp) => setClientes(resp.data || [])).catch(() => setClientes([]));
  }, []);

  if (!canManage) return <Navigate to="/envios" replace />;

  const seleccionarCliente = (cliente: Cliente | null) => {
    setClienteSeleccionado(cliente);
    if (!cliente) {
      setDestinatarioNombre("");
      setDestinatarioTelefono("");
      setDireccion("");
      return;
    }
    setDestinatarioNombre(cliente.nombre || "");
    setDestinatarioTelefono(cliente.telefono || "");
    setDireccion(cliente.direccion || "");
  };

  const addDocumento = (doc: DocumentoRelacionable | null) => {
    if (!doc) return;
    const exists = documentos.some((item) => item.tipo === doc.tipo && Number(item.documentoId) === Number(doc.documentoId));
    if (exists) return;
    setDocumentos((current) => [...current, doc]);
  };

  const removeDocumento = (doc: DocumentoRelacionable) => {
    setDocumentos((current) => current.filter((item) => !(item.tipo === doc.tipo && item.documentoId === doc.documentoId)));
  };

  const guardar = async () => {
    if (clienteSeleccionado && !direccion.trim()) {
      Swal.fire(
        "Cliente sin direccion",
        "El cliente seleccionado no tiene direccion registrada. Actualiza el cliente o limpia la seleccion para ingresar datos manuales.",
        "info",
      );
      return;
    }
    if (!destinatarioNombre.trim()) {
      Swal.fire("Validacion", "Ingresa el destinatario", "info");
      return;
    }
    if (!direccion.trim()) {
      Swal.fire("Validacion", "Ingresa la direccion de entrega", "info");
      return;
    }
    if (!documentos.length) {
      Swal.fire("Validacion", "Relaciona al menos una venta, pedido o pago", "info");
      return;
    }
    if (requiereReferencia && !referenciaPagoEnvio.trim()) {
      Swal.fire("Validacion", "Ingresa la referencia del pago del envio", "info");
      return;
    }
    if (requiereBanco && !bancoPagoEnvio.trim()) {
      Swal.fire("Validacion", "Ingresa el banco del deposito", "info");
      return;
    }

    const confirm = await Swal.fire({
      title: "Crear envio",
      html: `
        <div style="text-align:left">
          <p><strong>Destinatario:</strong> ${destinatarioNombre.trim()}</p>
          <p><strong>Modo cliente:</strong> ${clienteSeleccionado ? "Cliente de base de datos" : "Datos manuales"}</p>
          <p><strong>Documentos:</strong> ${documentos.length}</p>
          <p><strong>Total envio:</strong> ${money(totalEnvio)}</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Si, crear envio",
      cancelButtonText: "Revisar",
    });
    if (!confirm.isConfirmed) return;

    try {
      setLoading(true);
      const resp = await api.post("/envios", {
        fecha,
        clienteId: clienteSeleccionado?.id || null,
        destinatarioNombre: destinatarioNombre.trim(),
        destinatarioTelefono: destinatarioTelefono.trim() || null,
        direccion: direccion.trim(),
        municipio: municipio.trim() || null,
        departamento: departamento.trim() || null,
        empresaTransporte: empresaTransporte.trim() || null,
        numeroGuia: numeroGuia.trim() || null,
        costo,
        metodoPagoEnvio,
        porcentajeRecargo: usaRecargo ? porcentajeRecargo : 0,
        referenciaPagoEnvio: requiereReferencia ? referenciaPagoEnvio.trim() : null,
        bancoPagoEnvio: requiereBanco ? bancoPagoEnvio.trim() : null,
        observaciones: observaciones.trim() || null,
        bodegaId: selectedBodegaId || null,
        documentos,
      });
      Swal.fire("Listo", `Envio ${resp.data?.folio || ""} creado`, "success");
      navigate("/envios");
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.message || "No se pudo crear el envio", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, bgcolor: "background.default", minHeight: "100%" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <LocalShippingOutlined color="primary" />
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Nuevo envio
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Relaciona documentos, define destinatario y registra datos de transporte.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ArrowBackOutlined />} variant="outlined" onClick={() => navigate("/envios")}>
            Volver
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PersonSearchOutlined color="primary" />
                  <Typography variant="h6">Destinatario</Typography>
                </Stack>
                <Chip
                  size="small"
                  color={clienteSeleccionado ? "primary" : "default"}
                  label={clienteSeleccionado ? "Cliente seleccionado" : "Captura manual"}
                />
              </Stack>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Autocomplete
                    options={clientes}
                    value={clienteSeleccionado}
                    onChange={(_, value) => seleccionarCliente(value)}
                    getOptionLabel={(option) => `${option.nombre || ""}${option.telefono ? ` - ${option.telefono}` : ""}`}
                    isOptionEqualToValue={(option, value) => Number(option.id) === Number(value.id)}
                    renderInput={(params) => <TextField {...params} label="Buscar cliente existente" size="small" />}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Button fullWidth variant="outlined" disabled={!clienteSeleccionado} onClick={() => seleccionarCliente(null)}>
                    Usar datos manuales
                  </Button>
                </Grid>
                {clienteSeleccionado && (
                  <Grid size={{ xs: 12 }}>
                    <Alert severity="info">
                      Los datos del cliente seleccionado quedan bloqueados. Limpia la seleccion si necesitas capturar otro destinatario manualmente.
                    </Alert>
                  </Grid>
                )}
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Destinatario"
                    size="small"
                    fullWidth
                    value={destinatarioNombre}
                    onChange={(e) => setDestinatarioNombre(e.target.value)}
                    disabled={datosClienteBloqueados}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="Telefono"
                    size="small"
                    fullWidth
                    value={destinatarioTelefono}
                    onChange={(e) => setDestinatarioTelefono(e.target.value)}
                    disabled={datosClienteBloqueados}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="Fecha" type="date" size="small" fullWidth value={fecha} onChange={(e) => setFecha(e.target.value)} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid size={{ xs: 12, md: 9 }}>
                  <TextField
                    label="Direccion de entrega"
                    size="small"
                    fullWidth
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    disabled={datosClienteBloqueados}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    select
                    label="Bodega"
                    size="small"
                    fullWidth
                    value={selectedBodegaId}
                    onChange={(e) => setSelectedBodegaId(e.target.value as number | "")}
                    disabled={!canAccessAllBodegas}
                  >
                    <MenuItem value="">Sin bodega</MenuItem>
                    {bodegas.map((bodega) => (
                      <MenuItem key={bodega.id} value={bodega.id}>
                        {bodega.nombre}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="Municipio" size="small" fullWidth value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="Departamento" size="small" fullWidth value={departamento} onChange={(e) => setDepartamento(e.target.value)} />
                </Grid>
              </Grid>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <PaymentsOutlined color="primary" />
                <Typography variant="h6">Transporte y pago</Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="Empresa transporte" size="small" fullWidth value={empresaTransporte} onChange={(e) => setEmpresaTransporte(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="Numero de guia" size="small" fullWidth value={numeroGuia} onChange={(e) => setNumeroGuia(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="Costo envio" type="number" size="small" fullWidth value={emptyWhenZero(costo)} onChange={(e) => setCosto(parseNumberInput(e.target.value))} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    select
                    label="Metodo pago envio"
                    size="small"
                    fullWidth
                    value={metodoPagoEnvio}
                    onChange={(e) => {
                      const metodo = e.target.value;
                      setMetodoPagoEnvio(metodo);
                      if (!metodoUsaRecargo(metodo)) setPorcentajeRecargo(0);
                      if (!metodoRequiereReferencia(metodo)) setReferenciaPagoEnvio("");
                      if (!metodoRequiereBanco(metodo)) setBancoPagoEnvio("");
                    }}
                  >
                    <MenuItem value="efectivo">Efectivo</MenuItem>
                    <MenuItem value="transferencia">Transferencia</MenuItem>
                    <MenuItem value="deposito_bancario">Deposito bancario</MenuItem>
                    <MenuItem value="tarjeta">Tarjeta</MenuItem>
                    <MenuItem value="visalink">Visalink</MenuItem>
                    <MenuItem value="sin_cobro">Sin cobro</MenuItem>
                  </TextField>
                </Grid>
                {usaRecargo && (
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField label="Recargo %" type="number" size="small" fullWidth value={emptyWhenZero(porcentajeRecargo)} onChange={(e) => setPorcentajeRecargo(parseNumberInput(e.target.value))} />
                  </Grid>
                )}
                {requiereReferencia && (
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField label="Referencia pago" size="small" fullWidth value={referenciaPagoEnvio} onChange={(e) => setReferenciaPagoEnvio(e.target.value)} />
                  </Grid>
                )}
                {requiereBanco && (
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField label="Banco" size="small" fullWidth value={bancoPagoEnvio} onChange={(e) => setBancoPagoEnvio(e.target.value)} />
                  </Grid>
                )}
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="Total envio" size="small" fullWidth value={money(totalEnvio)} disabled />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField label="Observaciones" size="small" fullWidth value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                </Grid>
              </Grid>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <ReceiptLongOutlined color="primary" />
                <Typography variant="h6">Documentos relacionados</Typography>
              </Stack>
              <Autocomplete
                options={opciones}
                getOptionLabel={(option) => `${tipoLabel(option.tipo)} | ${option.referencia || ""} | ${option.titulo || ""}`}
                onChange={(_, value) => addDocumento(value)}
                renderInput={(params) => <TextField {...params} label="Relacionar venta, pedido o pago" size="small" />}
                renderOption={(props, option) => {
                  const { key: _key, ...optionProps } = props;
                  return (
                    <li key={`${option.tipo}-${option.documentoId}`} {...optionProps}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={tipoLabel(option.tipo)} />
                        <Typography>{option.referencia}</Typography>
                        <Typography color="text.secondary">{option.titulo}</Typography>
                        <Typography fontWeight={700}>{money(Number(option.monto || 0))}</Typography>
                      </Stack>
                    </li>
                  );
                }}
              />

              <Divider sx={{ my: 2 }} />
              {!documentos.length ? (
                <Typography color="text.secondary">No hay documentos relacionados.</Typography>
              ) : (
                <Stack spacing={1}>
                  {documentos.map((doc) => (
                    <Stack
                      key={`${doc.tipo}-${doc.documentoId}`}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ p: 1, border: 1, borderColor: "divider", borderRadius: 1 }}
                    >
                      <Chip size="small" label={tipoLabel(doc.tipo)} />
                      <Typography sx={{ flex: 1 }}>
                        {doc.referencia} - {doc.titulo}
                      </Typography>
                      <Typography fontWeight={700}>{money(Number(doc.monto || 0))}</Typography>
                      <IconButton size="small" color="error" onClick={() => removeDocumento(doc)}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, position: { lg: "sticky" }, top: { lg: 16 } }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              Resumen del envio
            </Typography>
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Modo destinatario</Typography>
                <Chip size="small" label={clienteSeleccionado ? "Cliente BD" : "Manual"} />
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Destinatario</Typography>
                <Typography fontWeight={700} textAlign="right">{destinatarioNombre || "-"}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Documentos</Typography>
                <Typography fontWeight={700}>{documentos.length}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Monto relacionado</Typography>
                <Typography fontWeight={700}>{money(totalDocumentos)}</Typography>
              </Stack>
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Costo envio</Typography>
                <Typography>{money(costo)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Recargo</Typography>
                <Typography>{money(recargo)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={700}>Total envio</Typography>
                <Typography fontWeight={700}>{money(totalEnvio)}</Typography>
              </Stack>
              <Divider />
              <Button startIcon={<SaveOutlined />} variant="contained" size="large" onClick={guardar} disabled={loading}>
                Crear envio
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
