import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { api } from "../api/axios";
import RobotAsistente from "./RobotAsistente";
import { useDocumentoEnCurso } from "./DocumentoEnCurso";

const CLAVE_POSICION = "uniforma.asistente.posicion";
const CLAVE_OCULTO = "uniforma.asistente.oculto";

type Hallazgo = {
  id: number;
  chequeo: string;
  entidad: string;
  entidadId: number;
  referencia: string | null;
  severidad: string;
  diferencia: number | null;
  diagnostico: string | null;
  estado: string;
};

type CasoParecido = {
  id: number;
  referencia: string | null;
  diferencia: number | null;
  resolucion: string | null;
  resueltoEn: string | null;
  resueltoPor?: { usuario?: string; nombre?: string } | null;
};

type Modulo = {
  nombre: string;
  puedo: string[];
  chequeos: string[];
};

/**
 * Que sabe hacer el asistente en cada pantalla.
 *
 * `chequeos` filtra los descuadres a los que corresponden a este modulo: en
 * Ventas no tiene sentido mostrar un pedido descuadrado.
 */
const MODULOS: Array<{ prefijo: string; modulo: Modulo }> = [
  {
    prefijo: "/ventas",
    modulo: {
      nombre: "Ventas",
      puedo: [
        "Mostrarte las ventas cuyo total no cuadra contra sus lineas",
        "Decirte en que componente esta la diferencia: lineas, envio o recargo",
        "Ensenarte como se resolvieron descuadres parecidos antes",
      ],
      chequeos: ["ventas_total_inconsistente"],
    },
  },
  {
    prefijo: "/orden-mixta",
    modulo: {
      nombre: "Ordenes mixtas",
      puedo: [
        "Avisarte de ordenes con saldo negativo",
        "Explicarte como se repartieron los anticipos entre venta y pedido",
      ],
      chequeos: ["orden_mixta_con_saldo_negativo", "ventas_total_inconsistente"],
    },
  },
  {
    prefijo: "/produccion",
    modulo: {
      nombre: "Produccion",
      puedo: [
        "Mostrarte pedidos cuyo total no cuadra contra su detalle",
        "Avisarte de pedidos con pagos que superan el total",
      ],
      chequeos: ["pedidos_total_inconsistente", "pagos_pedido_mayor_total"],
    },
  },
  {
    prefijo: "/inventario/traslados",
    modulo: {
      nombre: "Traslados",
      puedo: [
        "Recordarte que autoriza y envia la tienda que tiene el producto, y recibe la que lo pidio",
        "Avisarte de inventario negativo, que suele venir de traslados mal cerrados",
      ],
      chequeos: ["inventario_negativo"],
    },
  },
  {
    prefijo: "/inventario",
    modulo: {
      nombre: "Inventario",
      puedo: [
        "Mostrarte productos con stock negativo y en que bodega",
        "Decirte que productos no tienen stock maximo configurado",
      ],
      chequeos: ["inventario_negativo", "productos_sin_stock_max"],
    },
  },
  {
    prefijo: "/bodegas",
    modulo: {
      nombre: "Bodegas",
      puedo: [
        "Recordarte que sin 'Controlar inventario en ventas' esa bodega vende sin descontar stock",
        "Avisarte de inventario negativo por bodega",
      ],
      chequeos: ["inventario_negativo"],
    },
  },
];

const MODULO_GENERAL: Modulo = {
  nombre: "Uniforma",
  puedo: [
    "Vigilar que los totales cuadren en ventas, pedidos y ordenes mixtas",
    "Avisarte de inventario negativo o pagos que exceden el total",
    "Guardar como se resolvio cada descuadre, para consultarlo despues",
  ],
  chequeos: [],
};

type Problema = {
  nivel: "documento" | "linea";
  titulo: string;
  esperado: number;
  encontrado: number;
  diferencia: number;
  detalle?: string;
};

type LineaExplicada = {
  n: number;
  producto: string;
  cantidad: number;
  precioUnit: number;
  descuento: number;
  bordado: number;
  subtotal: number;
  formula: string;
};

type Analisis = {
  tipo: string;
  folio?: string | null;
  /** Viene de la revision en pantalla: todavia no existe en la base. */
  enConstruccion?: boolean;
  cuadra: boolean;
  resumen: Record<string, number>;
  lineas?: LineaExplicada[];
  problemas: Problema[];
  hijos?: Analisis[];
};

const moneda = (valor: number) =>
  `Q${(Number(valor) || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Que filas del resumen mostrar y en que orden. `soloSiHay` esconde envio y
 * recargo cuando van en cero, que es lo normal: son ruido en la mayoria de
 * documentos y estorban en un panel angosto.
 */
const FILAS_RESUMEN: { clave: string; etiqueta: string; fuerte?: boolean; soloSiHay?: boolean }[] = [
  { clave: "sumaLineas", etiqueta: "Suma de lineas" },
  { clave: "subtotalVenta", etiqueta: "Parte de venta" },
  { clave: "subtotalPedido", etiqueta: "Parte de pedido" },
  { clave: "envio", etiqueta: "Envio", soloSiHay: true },
  { clave: "recargo", etiqueta: "Recargo", soloSiHay: true },
  { clave: "totalRegistrado", etiqueta: "Total del documento", fuerte: true },
  { clave: "total", etiqueta: "Total del documento", fuerte: true },
  { clave: "anticipoTotal", etiqueta: "Anticipo" },
  { clave: "pagado", etiqueta: "Pagado" },
  { clave: "esperado", etiqueta: "Lo que cobraste", fuerte: true },
  { clave: "saldo", etiqueta: "Saldo pendiente", fuerte: true },
  { clave: "saldoTotal", etiqueta: "Saldo pendiente", fuerte: true },
];

const severidadColor = (severidad: string) =>
  severidad === "critica" ? "error" : severidad === "alta" ? "warning" : "info";

export default function AsistenteFlotante() {
  const { pathname } = useLocation();

  const [oculto, setOculto] = useState(() => localStorage.getItem(CLAVE_OCULTO) === "true");
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState(() => {
    try {
      const guardada = JSON.parse(localStorage.getItem(CLAVE_POSICION) || "null");
      if (guardada && typeof guardada.x === "number") return guardada;
    } catch {
      /* posicion corrupta: se usa la de por defecto */
    }
    return { x: window.innerWidth - 96, y: window.innerHeight - 128 };
  });

  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [resolviendo, setResolviendo] = useState<number | null>(null);
  const [textoResolucion, setTextoResolucion] = useState("");
  const [parecidos, setParecidos] = useState<CasoParecido[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [consulta, setConsulta] = useState("");
  const [analizando, setAnalizando] = useState(false);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);
  const enCurso = useDocumentoEnCurso();
  const [cobrado, setCobrado] = useState("");

  // Se distingue arrastrar de hacer clic por la distancia recorrida: sin esto,
  // soltar el robot tras moverlo abria el panel sin querer.
  const arrastre = useRef({ activo: false, movido: false, offsetX: 0, offsetY: 0 });

  const modulo = useMemo(() => {
    const encontrado = MODULOS.find((m) => pathname.startsWith(m.prefijo));
    return encontrado?.modulo || MODULO_GENERAL;
  }, [pathname]);

  const cargarHallazgos = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get("/consistencia/hallazgos", { params: { estado: "abierto" } });
      setHallazgos(Array.isArray(data) ? data : []);
    } catch {
      setHallazgos([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (abierto) cargarHallazgos();
  }, [abierto, cargarHallazgos]);

  const relevantes = useMemo(() => {
    if (!modulo.chequeos.length) return hallazgos;
    return hallazgos.filter((h) => modulo.chequeos.includes(h.chequeo));
  }, [hallazgos, modulo]);

  // ---- arrastre ----
  const alPresionar = (e: React.MouseEvent | React.TouchEvent) => {
    const punto = "touches" in e ? e.touches[0] : e;
    arrastre.current = {
      activo: true,
      movido: false,
      offsetX: punto.clientX - posicion.x,
      offsetY: punto.clientY - posicion.y,
    };
  };

  useEffect(() => {
    const mover = (e: MouseEvent | TouchEvent) => {
      if (!arrastre.current.activo) return;
      const punto = "touches" in e ? e.touches[0] : (e as MouseEvent);
      const x = punto.clientX - arrastre.current.offsetX;
      const y = punto.clientY - arrastre.current.offsetY;
      if (Math.abs(x - posicion.x) > 4 || Math.abs(y - posicion.y) > 4) arrastre.current.movido = true;
      // Se mantiene dentro de la ventana para que no quede inalcanzable.
      setPosicion({
        x: Math.min(Math.max(8, x), window.innerWidth - 72),
        y: Math.min(Math.max(8, y), window.innerHeight - 72),
      });
    };
    const soltar = () => {
      if (!arrastre.current.activo) return;
      arrastre.current.activo = false;
      localStorage.setItem(CLAVE_POSICION, JSON.stringify(posicion));
    };

    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
    window.addEventListener("touchmove", mover);
    window.addEventListener("touchend", soltar);
    return () => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      window.removeEventListener("touchmove", mover);
      window.removeEventListener("touchend", soltar);
    };
  }, [posicion]);

  const alSoltarBoton = () => {
    if (!arrastre.current.movido) setAbierto((v) => !v);
  };

  /**
   * Revisa lo que hay en pantalla, sin guardar nada.
   *
   * Es lo que permite ayudar mientras se arma el documento y no despues: para
   * cuando un descuadre llega a la base, el cliente ya se fue.
   */
  const revisarEnCurso = async () => {
    const doc = enCurso?.leer();
    if (!doc) return;
    setAnalisis(null);
    setErrorAnalisis(null);
    setAnalizando(true);
    try {
      const montoCobrado = Number(`${cobrado}`.replace(/[^\d.,-]/g, "").replace(",", "."));
      const { data } = await api.post("/consistencia/revisar-borrador", {
        ...doc,
        esperado: Number.isFinite(montoCobrado) && montoCobrado > 0 ? montoCobrado : null,
      });
      setAnalisis(data);
    } catch (error: any) {
      setErrorAnalisis(error?.response?.data?.message || "No pude revisar el documento");
    } finally {
      setAnalizando(false);
    }
  };

  /**
   * Manda la frase al backend, que la interpreta y responde con lo que toque.
   * La interpretacion vive en el servidor a proposito: asi la clave del modelo
   * nunca llega al navegador y el asistente sigue sirviendo aunque el modelo
   * no responda.
   */
  const preguntar = async () => {
    if (!consulta.trim()) return;
    setAnalisis(null);
    setErrorAnalisis(null);
    setAnalizando(true);
    try {
      const { data } = await api.post("/consistencia/preguntar", { texto: consulta });

      if (data?.tipo === "analisis") {
        setAnalisis(data.analisis);
      } else if (data?.tipo === "hallazgos") {
        setHallazgos(Array.isArray(data.hallazgos) ? data.hallazgos : []);
        setAviso(`Te muestro los ${data.hallazgos?.length || 0} descuadres abiertos.`);
      } else {
        setErrorAnalisis(data?.mensaje || "Todavia no se resolver eso.");
      }
    } catch (error: any) {
      setErrorAnalisis(error?.response?.data?.message || "No pude procesar esa consulta");
    } finally {
      setAnalizando(false);
    }
  };

  const abrirResolucion = async (hallazgo: Hallazgo) => {
    setResolviendo(hallazgo.id);
    setTextoResolucion("");
    setParecidos([]);
    try {
      const { data } = await api.get(`/consistencia/hallazgos/${hallazgo.id}/parecidos`);
      setParecidos(Array.isArray(data) ? data : []);
    } catch {
      setParecidos([]);
    }
  };

  const guardarResolucion = async (id: number) => {
    setGuardando(true);
    setAviso(null);
    try {
      await api.patch(`/consistencia/hallazgos/${id}/resolver`, { resolucion: textoResolucion });
      setResolviendo(null);
      setTextoResolucion("");
      await cargarHallazgos();
      setAviso("Guardado. Queda como referencia para casos parecidos.");
    } catch (error: any) {
      setAviso(error?.response?.data?.message || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const ocultar = () => {
    setOculto(true);
    setAbierto(false);
    localStorage.setItem(CLAVE_OCULTO, "true");
  };

  if (oculto) {
    return (
      <Tooltip title="Mostrar asistente">
        <IconButton
          onClick={() => {
            setOculto(false);
            localStorage.setItem(CLAVE_OCULTO, "false");
          }}
          size="small"
          sx={{
            position: "fixed",
            right: 0,
            bottom: 96,
            zIndex: 1400,
            borderRadius: "8px 0 0 8px",
            backgroundColor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: 2,
            opacity: 0.55,
            "&:hover": { opacity: 1 },
          }}
        >
          <SmartToyOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <>
      <Box
        onMouseDown={alPresionar}
        onTouchStart={alPresionar}
        onMouseUp={alSoltarBoton}
        onTouchEnd={alSoltarBoton}
        sx={{
          position: "fixed",
          left: posicion.x,
          top: posicion.y,
          zIndex: 1400,
          cursor: arrastre.current.activo ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        <Badge badgeContent={relevantes.length} color="warning" overlap="circular">
          <Box
            sx={{
              width: 60,
              height: 60,
              display: "grid",
              placeItems: "center",
              filter: "drop-shadow(0 6px 14px rgba(15, 23, 42, 0.28))",
              transition: "transform 140ms ease",
              "&:hover": { transform: "scale(1.08)" },
            }}
          >
            <RobotAsistente tamano={52} atento={relevantes.length > 0} activo={abierto} />
          </Box>
        </Badge>
      </Box>

      <Collapse in={abierto} sx={{ position: "fixed", left: Math.min(posicion.x, window.innerWidth - 380), top: Math.max(8, posicion.y - 460), zIndex: 1399 }}>
        <Paper elevation={10} sx={{ width: 360, maxHeight: 440, display: "flex", flexDirection: "column", borderRadius: 2, overflow: "hidden" }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.25, backgroundColor: "primary.main", color: "primary.contrastText" }}>
            <SmartToyOutlinedIcon fontSize="small" />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>Asistente</Typography>
              <Typography variant="caption" noWrap sx={{ opacity: 0.85 }}>Estas en {modulo.nombre}</Typography>
            </Box>
            <Tooltip title="Ocultar">
              <IconButton size="small" onClick={ocultar} sx={{ color: "inherit" }}>
                <VisibilityOffOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setAbierto(false)} sx={{ color: "inherit" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Box sx={{ p: 1.5, overflowY: "auto" }}>
            {aviso && <Alert severity="info" sx={{ mb: 1.5 }} onClose={() => setAviso(null)}>{aviso}</Alert>}

            {/*
              Va arriba de todo y solo aparece mientras se arma un documento.
              Es la ayuda que llega a tiempo: despues de guardar, el descuadre
              ya esta en la base y el cliente ya se fue.
            */}
            {enCurso?.hayDocumento && (
              <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5, borderColor: "primary.main" }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                  Estas armando un documento
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Puedo revisarlo sin guardarlo. Si me dices cuanto cobraste, busco donde esta la diferencia.
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Cuanto cobraste? (opcional)"
                    value={cobrado}
                    onChange={(e) => setCobrado(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") revisarEnCurso();
                    }}
                  />
                  <Button size="small" variant="contained" onClick={revisarEnCurso} disabled={analizando}>
                    {analizando ? "..." : "Revisar"}
                  </Button>
                </Stack>
              </Paper>
            )}

            <Stack direction="row" spacing={0.5} sx={{ mb: 1.5 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Preguntame: por que OM-0012 no me cuadra?"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") preguntar();
                }}
              />
              <Button size="small" variant="contained" onClick={preguntar} disabled={analizando}>
                {analizando ? "..." : "Preguntar"}
              </Button>
            </Stack>

            {errorAnalisis && (
              <Alert severity="warning" sx={{ mb: 1.5 }} onClose={() => setErrorAnalisis(null)}>
                {errorAnalisis}
              </Alert>
            )}

            {analisis && (
              <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                  <Chip
                    size="small"
                    color={analisis.cuadra ? "success" : "warning"}
                    label={analisis.folio || (analisis.enConstruccion ? "Sin guardar" : "documento")}
                  />
                  <Typography variant="caption" color="text.secondary">{analisis.tipo.replace("_", " ")}</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <IconButton size="small" onClick={() => setAnalisis(null)}>
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </Stack>

                {/* Los problemas primero: es lo que la persona vino a buscar. */}
                {!analisis.cuadra && (
                  <Stack spacing={0.75} sx={{ mb: 1.25 }}>
                    {[...analisis.problemas, ...(analisis.hijos || []).flatMap((h) => h.problemas)].map((p, i) => (
                      <Box key={i} sx={{ borderLeft: 3, borderColor: p.nivel === "linea" ? "warning.main" : "error.main", pl: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{p.titulo}</Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          deberia ser {p.esperado} y dice {p.encontrado} — diferencia {p.diferencia > 0 ? "+" : ""}{p.diferencia}
                        </Typography>
                        {p.detalle && (
                          <Typography variant="caption" display="block" color="text.secondary">{p.detalle}</Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}

                {analisis.cuadra && (
                  <Alert severity="success" variant="outlined" sx={{ mb: 1.25, py: 0.25 }}>
                    {analisis.enConstruccion
                      ? "Las cuentas de lo que llevas dan bien. Asi las calcule:"
                      : "Las cuentas de este documento dan bien. Asi las calcule:"}
                  </Alert>
                )}

                {/*
                  El desglose se muestra siempre, cuadre o no. Cuando cuadra es
                  la respuesta al "por que"; cuando no cuadra, deja ver la linea
                  floja al lado de la cuenta que la genera.
                */}
                {!!analisis.lineas?.length && (
                  <Stack spacing={0.5} sx={{ mb: 1.25 }}>
                    {analisis.lineas.map((l) => (
                      <Box key={l.n} sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 14 }}>{l.n}.</Typography>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap title={l.producto}>{l.producto}</Typography>
                          <Typography variant="caption" color="text.secondary">{l.formula}</Typography>
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                          {moneda(l.subtotal)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}

                <Divider sx={{ mb: 0.75 }} />
                <Stack spacing={0.25}>
                  {FILAS_RESUMEN.filter((fila) => analisis.resumen?.[fila.clave] !== undefined)
                    .filter((fila) => !fila.soloSiHay || Number(analisis.resumen[fila.clave]) !== 0)
                    .map((fila) => (
                      <Box key={fila.clave} sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="caption" color={fila.fuerte ? "text.primary" : "text.secondary"} sx={{ fontWeight: fila.fuerte ? 700 : 400 }}>
                          {fila.etiqueta}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: fila.fuerte ? 700 : 400 }}>
                          {moneda(Number(analisis.resumen[fila.clave]))}
                        </Typography>
                      </Box>
                    ))}
                </Stack>
              </Paper>
            )}

            <Typography variant="caption" color="text.secondary">Aqui puedo</Typography>
            <Stack component="ul" sx={{ pl: 2, m: 0, mb: 1.5 }} spacing={0.25}>
              {modulo.puedo.map((linea) => (
                <Typography component="li" variant="body2" key={linea}>{linea}</Typography>
              ))}
            </Stack>

            <Divider sx={{ mb: 1.5 }} />

            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                Descuadres {modulo.chequeos.length ? "de este modulo" : "abiertos"}
              </Typography>
              {cargando && <CircularProgress size={16} />}
            </Stack>

            {!cargando && !relevantes.length && (
              <Alert severity="success" variant="outlined">Todo cuadra por aqui.</Alert>
            )}

            <Stack spacing={1}>
              {relevantes.map((h) => (
                <Paper key={h.id} variant="outlined" sx={{ p: 1.25 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Chip size="small" color={severidadColor(h.severidad) as any} label={h.referencia || `#${h.entidadId ?? h.id}`} />
                    {h.diferencia != null && (
                      <Typography variant="caption" color="text.secondary">
                        diferencia: {Number(h.diferencia).toFixed(2)}
                      </Typography>
                    )}
                  </Stack>

                  {h.diagnostico && (
                    <Typography variant="body2" sx={{ mb: 1 }}>{h.diagnostico}</Typography>
                  )}

                  {resolviendo === h.id ? (
                    <Stack spacing={1}>
                      {parecidos.length > 0 && (
                        <Box sx={{ backgroundColor: "action.hover", borderRadius: 1, p: 1 }}>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                            <HistoryOutlinedIcon fontSize="inherit" />
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>Asi se resolvieron antes</Typography>
                          </Stack>
                          {parecidos.map((c) => (
                            <Typography key={c.id} variant="caption" display="block" color="text.secondary">
                              {c.referencia}: {c.resolucion}
                            </Typography>
                          ))}
                        </Box>
                      )}
                      <TextField
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        autoFocus
                        label="Que hiciste para cuadrarlo"
                        value={textoResolucion}
                        onChange={(e) => setTextoResolucion(e.target.value)}
                        helperText="Queda guardado como referencia para el proximo caso igual"
                      />
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="contained" disabled={guardando} onClick={() => guardarResolucion(h.id)}>
                          {guardando ? "Guardando..." : "Marcar resuelto"}
                        </Button>
                        <Button size="small" onClick={() => setResolviendo(null)}>Cancelar</Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Button size="small" onClick={() => abrirResolucion(h)}>Ya lo cuadre</Button>
                  )}
                </Paper>
              ))}
            </Stack>
          </Box>
        </Paper>
      </Collapse>
    </>
  );
}
