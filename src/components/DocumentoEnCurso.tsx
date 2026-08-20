import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type LineaEnCurso = {
  tipoOperacion?: "venta" | "pedido";
  producto?: string | null;
  cantidad?: number;
  precioUnit?: number;
  bordado?: number;
  descuento?: number;
  estiloEspecial?: boolean;
  estiloEspecialMonto?: number;
};

export type DocumentoEnCurso = {
  tipo: "venta" | "pedido" | "orden_mixta";
  /** Como llamarlo al hablarle al usuario: "esta venta", "esta orden mixta". */
  etiqueta: string;
  lineas: LineaEnCurso[];
  envio?: number;
  recargo?: number;
  anticipo?: number;
};

type Registro = {
  /**
   * Se lee bajo demanda, cuando la persona pide la revision.
   *
   * Es una funcion y no un valor de estado a proposito: el documento cambia
   * con cada tecla, y guardarlo en estado redibujaria el asistente entero
   * mientras alguien escribe un precio. Lo unico que sube a estado es si hay
   * o no documento, que cambia dos veces por pantalla.
   */
  leer: () => DocumentoEnCurso | null;
  hayDocumento: boolean;
  publicar: (doc: DocumentoEnCurso | null) => void;
};

const Contexto = createContext<Registro | null>(null);

export function ProveedorDocumentoEnCurso({ children }: { children: React.ReactNode }) {
  const documento = useRef<DocumentoEnCurso | null>(null);
  const [hayDocumento, setHayDocumento] = useState(false);

  const publicar = useCallback((doc: DocumentoEnCurso | null) => {
    documento.current = doc;
    const hay = Boolean(doc && doc.lineas.length);
    setHayDocumento((antes) => (antes === hay ? antes : hay));
  }, []);

  const leer = useCallback(() => documento.current, []);
  const valor = useMemo(() => ({ leer, hayDocumento, publicar }), [leer, hayDocumento, publicar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDocumentoEnCurso() {
  return useContext(Contexto);
}

/**
 * Lo llama la pantalla que arma un documento para que el asistente pueda
 * revisarlo antes de guardarlo.
 *
 * Se limpia solo al salir de la pantalla: si no, el asistente seguiria
 * ofreciendo revisar una venta que ya se guardo o se abandono.
 */
export function usePublicarDocumento(doc: DocumentoEnCurso | null) {
  const registro = useContext(Contexto);
  const publicar = registro?.publicar;

  useEffect(() => {
    if (!publicar) return;
    publicar(doc);
  });

  useEffect(() => {
    return () => publicar?.(null);
  }, [publicar]);
}
