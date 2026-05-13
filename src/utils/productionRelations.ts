import { RelationEdge, RelationNode } from "../components/TransactionRelationMap";

export type ProductionRelationData = {
  nodes: RelationNode[];
  edges: RelationEdge[];
};

const moneyValue = (value: unknown) => Number(value || 0);

export const buildProductionRelationData = (pedido: any): ProductionRelationData => {
  const pedidoId = Number(pedido?.id || pedido?.pedidoId || 0);
  const pedidoFolio = pedido?.displayFolio || pedido?.folio || `P-${pedidoId}`;
  const clienteNombre = pedido?.clienteDisplay || pedido?.cliente?.nombre || pedido?.clienteNombre || "Mostrador";

  const rootNode: RelationNode = {
    id: `pedido-${pedidoId}`,
    type: "pedido",
    title: pedidoFolio,
    subtitle: `Cliente: ${clienteNombre}`,
    amount: moneyValue(pedido?.totalEstimado),
    date: pedido?.fecha,
    sourceId: pedidoId,
    path: pedidoId ? `/produccion/${pedidoId}` : "/produccion",
  };

  const nodes: RelationNode[] = [rootNode];
  const edges: RelationEdge[] = [];

  const addNode = (node: RelationNode, label: string) => {
    nodes.push(node);
    edges.push({ from: rootNode.id, to: node.id, label });
  };

  const postventa = pedido?.postventa;
  if (postventa || pedido?.postventaId) {
    const postventaId = Number(postventa?.id ?? pedido?.postventaId ?? 0);
    const tipoPostventa = `${postventa?.tipo || ""}`.trim().toLowerCase();
    const tipoLabel = tipoPostventa === "devolucion" ? "Devolucion" : "Cambio";
    const cobroLabel = pedido?.postventaCobro === "sin_cobro" ? "Sin valor monetario" : "Con cobro normal";
    const motivo = `${postventa?.motivo || ""}`.trim();
    const estado = `${postventa?.estado || ""}`.trim();

    addNode(
      {
        id: `postventa-${postventaId || pedidoId}`,
        type: "postventa",
        title: postventa?.folio || `${tipoLabel} #${postventaId || pedido?.postventaId || pedidoId}`,
        subtitle: [tipoLabel, motivo || estado, cobroLabel].filter(Boolean).join(" | "),
        label: tipoPostventa || "cambio",
        amount: postventa?.monto != null ? moneyValue(postventa.monto) : undefined,
        date: postventa?.fecha || undefined,
        sourceId: postventaId || pedidoId,
        path: tipoPostventa === "devolucion" ? "/devoluciones" : "/cambios",
      },
      pedido?.postventaCobro === "sin_cobro" ? "Cambio/Devolucion sin cobro" : "Cambio/Devolucion",
    );
  }

  (pedido?.pagos || []).forEach((pago: any) => {
    const pagoId = Number(pago?.id || 0);
    addNode(
      {
        id: `pago-${pagoId}`,
        type: "pago",
        title: `Pago #${pagoId}`,
        subtitle: pago?.fecha || "Fecha no disponible",
        amount: moneyValue(pago?.monto) + moneyValue(pago?.recargo),
        date: pago?.fecha,
        sourceId: pagoId || pedidoId,
        path: pedidoId ? `/pagos/recibidos?pedido=${pedidoId}` : "/pagos/recibidos",
      },
      pago?.tipo === "anticipo" ? "Anticipo" : "Pago",
    );
  });

  (pedido?.avances || []).forEach((avance: any) => {
    const avanceId = Number(avance?.id || 0);
    addNode(
      {
        id: `avance-${avanceId}`,
        type: "avance",
        title: `Avance #${avanceId}`,
        subtitle: avance?.fecha || "Fecha no disponible",
        amount: moneyValue(avance?.total),
        date: avance?.fecha,
        sourceId: avanceId || pedidoId,
        path: pedidoId ? `/produccion/${pedidoId}` : "/produccion",
      },
      "Avance",
    );
  });

  return { nodes, edges };
};
