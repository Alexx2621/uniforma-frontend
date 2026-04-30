import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Card, CardContent, Typography, Stack } from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

export type RelationNode = {
  id: string;
  type: "pedido" | "pago" | "avance" | "postventa" | "unificacion";
  title: string;
  subtitle?: string;
  label?: string;
  amount?: number;
  date?: string;
  sourceId: number;
};

export type RelationEdge = {
  from: string;
  to: string;
  label?: string;
};

interface Props {
  open: boolean;
  title: string;
  nodes: RelationNode[];
  edges: RelationEdge[];
  onClose: () => void;
  onCardDoubleClick?: (node: RelationNode) => void;
}

const relationTypeLabels: Record<RelationNode["type"], string> = {
  pedido: "Pedido",
  pago: "Pago",
  avance: "Avance",
  postventa: "Cambio/Devolucion",
  unificacion: "Unificacion",
};

function RelationCard({
  node,
  onDoubleClick,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragging,
}: {
  node: RelationNode;
  onDoubleClick?: () => void;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
}) {
  return (
    <Card
      variant="outlined"
      draggable={Boolean(draggable)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      sx={{
        minWidth: 220,
        maxWidth: 260,
        cursor: draggable ? "grab" : onDoubleClick ? "pointer" : "default",
        opacity: isDragging ? 0.5 : 1,
        transition: "transform 120ms ease-in-out, box-shadow 120ms ease-in-out",
        '&:hover': onDoubleClick
          ? {
              transform: "translateY(-2px)",
              boxShadow: 3,
            }
          : undefined,
        }}
      onDoubleClick={onDoubleClick}
    >
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {relationTypeLabels[node.type] || node.type}
        </Typography>
        <Typography variant="h6" gutterBottom>
          {node.title}
        </Typography>
        {node.subtitle && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {node.subtitle}
          </Typography>
        )}
        {node.amount !== undefined && (
          <Typography variant="body1" sx={{ fontWeight: 600, mt: 1 }}>
            Q {node.amount.toFixed(2)}
          </Typography>
        )}
        {node.date && (
          <Typography variant="caption" color="text.secondary">
            {node.date}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function TransactionRelationMap({
  open,
  title,
  nodes,
  edges,
  onClose,
  onCardDoubleClick,
}: Props) {
  const rootNode = useMemo(() => nodes.find((node) => node.type === "pedido"), [nodes]);
  const childNodes = useMemo(() => nodes.filter((node) => node.type !== "pedido"), [nodes]);
  const [orderedChildIds, setOrderedChildIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);

  useEffect(() => {
    setOrderedChildIds((current) => {
      const ids = childNodes.map((node) => node.id);
      const next = current.filter((id) => ids.includes(id));
      ids.forEach((id) => {
        if (!next.includes(id)) next.push(id);
      });
      return next;
    });
  }, [childNodes]);

  const orderedChildNodes = useMemo(
    () => orderedChildIds.map((id) => childNodes.find((node) => node.id === id)).filter((node): node is RelationNode => Boolean(node)),
    [orderedChildIds, childNodes]
  );

  const handleDragStart = (id: string) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer?.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    draggingIdRef.current = id;
    setDraggingId(id);
    setDragOverId(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
    setDropPosition(null);
  };

  const getDragSourceId = (event?: DragEvent<HTMLDivElement>) =>
    event?.dataTransfer?.getData("text/plain") || draggingIdRef.current || draggingId;

  const handleDragOver = (targetId: string, position: "before" | "after") => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const sourceId = getDragSourceId(event);
    if (!sourceId || sourceId === targetId) {
      setDragOverId(null);
      setDropPosition(null);
      return;
    }

    setDragOverId(targetId);
    setDropPosition(position);
  };

  const handleDragEnter = (targetId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceId = getDragSourceId(event);
    if (sourceId && sourceId !== targetId) {
      setDragOverId(targetId);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return;
    setDragOverId(null);
    setDropPosition(null);
  };

  const handleDrop = (targetId: string, position: "before" | "after") => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceId = getDragSourceId(event);
    if (!sourceId || sourceId === targetId) {
      draggingIdRef.current = null;
      setDraggingId(null);
      setDragOverId(null);
      setDropPosition(null);
      return;
    }

    setOrderedChildIds((current) => {
      if (!current.includes(sourceId) || !current.includes(targetId)) return current;
      const withoutSource = current.filter((id) => id !== sourceId);
      const targetIndex = withoutSource.indexOf(targetId);
      if (targetIndex === -1) return current;
      const insertionIndex = position === "after" ? targetIndex + 1 : targetIndex;
      return [
        ...withoutSource.slice(0, insertionIndex),
        sourceId,
        ...withoutSource.slice(insertionIndex),
      ];
    });

    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
    setDropPosition(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {rootNode ? (
            <Box display="flex" justifyContent="center">
              <RelationCard node={rootNode} onDoubleClick={onCardDoubleClick ? () => onCardDoubleClick(rootNode) : undefined} />
            </Box>
          ) : (
            <Typography color="text.secondary">No se encontró el pedido principal.</Typography>
          )}

          {orderedChildNodes.length > 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
              <ArrowDownwardIcon color="disabled" sx={{ fontSize: 32 }} />
              <Box display="flex" flexWrap="wrap" justifyContent="center" gap={2}>
                {orderedChildNodes.map((node) => {
                  const relationLabel = edges.find((edge) => edge.to === node.id)?.label;
                  const isTarget = dragOverId === node.id;
                  const isAfter = isTarget && dropPosition === "after";
                  const isBefore = isTarget && dropPosition === "before";
                  return (
                    <Box
                      key={node.id}
                      onDragEnter={handleDragEnter(node.id)}
                      onDragLeave={handleDragLeave}
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        p: 0.5,
                        borderRadius: 1,
                        transition: "background-color 120ms ease-in-out, box-shadow 120ms ease-in-out",
                        ...(isTarget
                          ? {
                              bgcolor: "action.hover",
                              boxShadow: 3,
                            }
                          : {}),
                      }}
                    >
                      <Box
                        sx={{
                          width: "100%",
                          position: "relative",
                          mb: 1,
                        }}
                      >
                        <Box sx={{ width: 70, height: 1, borderBottom: "1px dashed", borderColor: "divider", mx: "auto" }} />
                        <ArrowDownwardIcon color="disabled" sx={{ fontSize: 20, mt: "-6px", mx: "auto" }} />
                        {relationLabel ? (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block", textAlign: "center" }}>
                            {relationLabel}
                          </Typography>
                        ) : null}
                        {isBefore && (
                          <Box
                            sx={{
                              position: "absolute",
                              top: -2,
                              left: 0,
                              right: 0,
                              height: 4,
                              bgcolor: "primary.main",
                              opacity: 0.7,
                              borderRadius: 2,
                            }}
                          />
                        )}
                        {isAfter && (
                          <Box
                            sx={{
                              position: "absolute",
                              bottom: -2,
                              left: 0,
                              right: 0,
                              height: 4,
                              bgcolor: "primary.main",
                              opacity: 0.7,
                              borderRadius: 2,
                            }}
                          />
                        )}
                      </Box>
                      <Box
                        onDragOver={handleDragOver(node.id, "before")}
                        onDrop={handleDrop(node.id, "before")}
                        sx={{ width: "100%", height: 8, mb: 1 }}
                      />
                      <RelationCard
                        node={node}
                        onDoubleClick={onCardDoubleClick ? () => onCardDoubleClick(node) : undefined}
                        draggable
                        onDragStart={handleDragStart(node.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                          handleDragOver(node.id, position)(event);
                        }}
                        onDrop={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                          handleDrop(node.id, position)(event);
                        }}
                        isDragging={draggingId === node.id}
                      />
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ) : (
            <Typography color="text.secondary">No hay relaciones registradas para este pedido.</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
