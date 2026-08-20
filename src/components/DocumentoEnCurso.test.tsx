import { render, screen, act } from "@testing-library/react";
import { useState } from "react";
import {
  ProveedorDocumentoEnCurso,
  useDocumentoEnCurso,
  usePublicarDocumento,
  type DocumentoEnCurso,
} from "./DocumentoEnCurso";

let rendersPagina = 0;

function PaginaFalsa({ lineas }: { lineas: number }) {
  rendersPagina += 1;
  const doc: DocumentoEnCurso | null = lineas
    ? {
        tipo: "venta",
        etiqueta: "esta venta",
        // Objeto nuevo en cada render, igual que en las pantallas reales.
        lineas: Array.from({ length: lineas }, (_, i) => ({ cantidad: 1, precioUnit: 100 * (i + 1) })),
      }
    : null;
  usePublicarDocumento(doc);
  return <span>pagina</span>;
}

function AsistenteFalso() {
  const registro = useDocumentoEnCurso();
  const [leido, setLeido] = useState<string>("");
  return (
    <div>
      <span data-testid="hay">{registro?.hayDocumento ? "si" : "no"}</span>
      <span data-testid="leido">{leido}</span>
      <button onClick={() => setLeido(`${registro?.leer()?.lineas.length ?? 0} lineas`)}>leer</button>
    </div>
  );
}

function Montaje({ lineas }: { lineas: number }) {
  return (
    <ProveedorDocumentoEnCurso>
      <PaginaFalsa lineas={lineas} />
      <AsistenteFalso />
    </ProveedorDocumentoEnCurso>
  );
}

beforeEach(() => {
  rendersPagina = 0;
});

test("el asistente ve que hay un documento en curso y puede leerlo", () => {
  render(<Montaje lineas={2} />);
  expect(screen.getByTestId("hay").textContent).toBe("si");
  act(() => {
    screen.getByText("leer").click();
  });
  expect(screen.getByTestId("leido").textContent).toBe("2 lineas");
});

test("sin lineas no ofrece revisar nada", () => {
  render(<Montaje lineas={0} />);
  expect(screen.getByTestId("hay").textContent).toBe("no");
});

test("publicar en cada render no dispara un bucle", () => {
  // El hook publica sin arreglo de dependencias a proposito, porque el
  // documento es un objeto nuevo en cada render. Lo que evita el bucle es que
  // solo suba a estado el booleano, y solo cuando cambia. Si alguien
  // convirtiera el documento entero en estado, esta cuenta se dispararia.
  render(<Montaje lineas={3} />);
  expect(rendersPagina).toBeLessThanOrEqual(4);
});

test("al desmontar la pantalla deja de ofrecer la revision", () => {
  const { rerender } = render(<Montaje lineas={2} />);
  expect(screen.getByTestId("hay").textContent).toBe("si");
  rerender(
    <ProveedorDocumentoEnCurso>
      <AsistenteFalso />
    </ProveedorDocumentoEnCurso>,
  );
  expect(screen.getByTestId("hay").textContent).toBe("no");
});
