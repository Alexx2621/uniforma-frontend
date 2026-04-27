import { useEffect, useMemo, useState, DragEvent } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Card, CardContent, Typography, Stack } from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

export type RelationNode = {
  id: string;
  type: "pedido" | "pago" | "avance";
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
          {node.type === "pedido" ? "Pedido" : node.type === "pago" ? "Pago" : "Avance"}
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
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);

  useEffect(() => {
    setOrderedChildIds(childNodes.map((node) => node.id));
  }, [childNodes]);

  const orderedChildNodes = useMemo(
    () => orderedChildIds.map((id) => childNodes.find((node) => node.id === id)).filter((node): node is RelationNode => Boolean(node)),
    [orderedChildIds, childNodes]
  );

  const handleDragStart = (id: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer?.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
    setDragOverId(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
    setDropPosition(null);
  };

  const handleDragOver = (targetId: string, position: "before" | "after") => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (!draggingId || draggingId === targetId) {
      setDragOverId(null);
      setDropPosition(null);
      return;
    }

    setDragOverId(targetId);
    setDropPosition(position);
  };

  const handleDragEnter = (targetId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (draggingId && draggingId !== targetId) {
      setDragOverId(targetId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
    setDropPosition(null);
  };

  const handleDrop = (targetId: string, position: "before" | "after") => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceId = event.dataTransfer?.getData("text/plain") || draggingId;
    if (!sourceId || sourceId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      setDropPosition(null);
      return;
    }

    setOrderedChildIds((current) => {
      const next = [...current];
      const fromIndex = next.indexOf(sourceId);
      const targetIndex = next.indexOf(targetId);
      if (fromIndex === -1 || targetIndex === -1) return next;

      next.splice(fromIndex, 1);
      const insertionIndex = position === "after"
        ? fromIndex < targetIndex
          ? targetIndex
          : targetIndex + 1
        : fromIndex < targetIndex
          ? targetIndex - 1
          : targetIndex;
      next.splice(insertionIndex, 0, sourceId);
      return next;
    });

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
                        onDragOver={handleDragOver(node.id, "after")}
                        onDrop={handleDrop(node.id, "after")}
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
