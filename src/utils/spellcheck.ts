const BASE_DICTIONARY = new Set(
  [
    "A",
    "ABIERTO",
    "ABERTURA",
    "ABOTONADO",
    "ABOTONADA",
    "ABRIGO",
    "AGREGAR",
    "AL",
    "ALTO",
    "ALTA",
    "ANCHO",
    "ANCHA",
    "ARRIBA",
    "ATRAS",
    "AZUL",
    "BATA",
    "BIES",
    "BLANCO",
    "BLANCA",
    "BOLSA",
    "BOLSAS",
    "BORDADO",
    "BORDADA",
    "BORDAR",
    "BOTON",
    "BOTONES",
    "CABALLERO",
    "CAMBIO",
    "CAMISA",
    "CAPUCHA",
    "CENTRO",
    "CIERRE",
    "COLOR",
    "CON",
    "COSTADO",
    "COSTADOS",
    "CUELLO",
    "DAMA",
    "DE",
    "DEL",
    "DERECHA",
    "DERECHO",
    "DOBLE",
    "DOS",
    "EL",
    "EN",
    "ESPECIAL",
    "ESPALDA",
    "FALDA",
    "FILIPINA",
    "FRENTE",
    "GRIS",
    "HOMBRE",
    "IZQUIERDA",
    "IZQUIERDO",
    "LA",
    "LADO",
    "LARGA",
    "LARGO",
    "LAS",
    "LATERAL",
    "LOGO",
    "LOS",
    "MANGA",
    "MANGAS",
    "MARINO",
    "MINISTERIO",
    "MUJER",
    "NEGRO",
    "NEGRA",
    "NO",
    "NOMBRE",
    "NUTRICIONISTA",
    "PARA",
    "PECHO",
    "PEDIDO",
    "PESPUNTE",
    "PIEZA",
    "PIEZAS",
    "PILOTO",
    "POR",
    "REPEL",
    "ROJO",
    "ROSA",
    "SALUD",
    "SIN",
    "SUPERIOR",
    "TALLA",
    "TELA",
    "TIPO",
    "UN",
    "UNA",
    "VERDE",
    "ZIPPER",
  ].map((word) => word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()),
);

const normalizeWord = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const splitTerms = (value: unknown) =>
  `${value || ""}`
    .split(/[^A-ZÁÉÍÓÚÜÑ0-9]+/i)
    .map(normalizeWord)
    .filter((word) => word.length > 1);

export const findPotentialMisspellings = (text: string, extraTerms: unknown[] = []) => {
  const dictionary = new Set(BASE_DICTIONARY);
  extraTerms.flatMap(splitTerms).forEach((word) => dictionary.add(word));

  const words = splitTerms(text).filter((word) => {
    if (word.length <= 3) return false;
    if (/^\d+$/.test(word)) return false;
    if (/^[A-Z]{1,4}$/.test(word)) return false;
    return !dictionary.has(word);
  });

  return Array.from(new Set(words));
};
