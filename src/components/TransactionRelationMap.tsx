import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Card, CardContent, Typography, Stack, Tooltip, IconButton } from "@mui/material";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { formatCurrency } from "../utils/currency";

export type RelationNode = {
  id: string;
  type: "pedido" | "venta" | "pago" | "avance" | "postventa" | "unificacion" | "envio" | string;
  title: string;
  subtitle?: string;
  label?: string;
  amount?: number;
  date?: string;
  sourceId: number;
  path?: string;
  isRoot?: boolean;
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
  onCardClick?: (node: RelationNode) => void;
  onCardDoubleClick?: (node: RelationNode) => void;
}

type Position = { x: number; y: number };

const NODE_WIDTH = 244;
const NODE_HEIGHT = 154;
const CANVAS_MIN_HEIGHT = 560;
const GRID_SIZE = 24;

const relationTypeLabels: Record<string, string> = {
  pedido: "Pedido",
  venta: "Venta",
  pago: "Pago",
  avance: "Avance",
  postventa: "Cambio/Devolucion",
  unificacion: "Unificacion",
  envio: "Envio",
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function RelationCard({
  node,
  onDoubleClick,
  onClick,
  isDragging,
  onOpenClick,
}: {
  node: RelationNode;
  onClick?: () => void;
  onDoubleClick?: () => void;
  isDragging?: boolean;
  onOpenClick?: () => void;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        cursor: "grab",
        userSelect: "none",
        opacity: isDragging ? 0.72 : 1,
        boxShadow: isDragging ? 8 : 1,
        borderColor: node.isRoot ? "primary.main" : "divider",
        overflow: "hidden",
        transition: isDragging ? "none" : "box-shadow 120ms ease-in-out, border-color 120ms ease-in-out",
        "&:hover": { boxShadow: 4 },
      }}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
    >
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" color="text.secondary" noWrap>
            {relationTypeLabels[node.type] || node.type}
          </Typography>
          {onOpenClick && (
            <Tooltip title="Abrir documento">
              <IconButton
                size="small"
                aria-label="Abrir documento"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenClick();
                }}
              >
                <OpenInNewOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Typography variant="h6" sx={{ mt: 0.5, lineHeight: 1.1 }} noWrap>
          {node.title}
        </Typography>
        {node.subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, minHeight: 38, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {node.subtitle}
          </Typography>
        )}
        {node.amount !== undefined && (
          <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.75 }}>
            {formatCurrency(node.amount)}
          </Typography>
        )}
        {node.date && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {new Date(node.date).toLocaleString("es-GT")}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function DraggableNode({
  node,
  position,
  draggingId,
  onClick,
  onDoubleClick,
  onOpenClick,
}: {
  node: RelationNode;
  position: Position;
  draggingId: string | null;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onOpenClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: node.id });

  return (
    <Box
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      sx={{
        position: "absolute",
        left: position.x,
        top: position.y,
        zIndex: draggingId === node.id ? 4 : node.isRoot ? 3 : 2,
        touchAction: "none",
      }}
    >
      <RelationCard node={node} onClick={onClick} onDoubleClick={onDoubleClick} onOpenClick={onOpenClick} isDragging={draggingId === node.id} />
    </Box>
  );
}

const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

const connectionPoints = (from: Position, to: Position) => {
  const fromCenter = { x: from.x + NODE_WIDTH / 2, y: from.y + NODE_HEIGHT / 2 };
  const toCenter = { x: to.x + NODE_WIDTH / 2, y: to.y + NODE_HEIGHT / 2 };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x1: dx >= 0 ? from.x + NODE_WIDTH : from.x,
      y1: fromCenter.y,
      x2: dx >= 0 ? to.x : to.x + NODE_WIDTH,
      y2: toCenter.y,
    };
  }

  return {
    x1: fromCenter.x,
    y1: dy >= 0 ? from.y + NODE_HEIGHT : from.y,
    x2: toCenter.x,
    y2: dy >= 0 ? to.y : to.y + NODE_HEIGHT,
  };
};

const buildGridPath = (from: Position, to: Position) => {
  const points = connectionPoints(from, to);
  const horizontal = Math.abs(points.x2 - points.x1) >= Math.abs(points.y2 - points.y1);
  const midA = horizontal
    ? { x: snapToGrid((points.x1 + points.x2) / 2), y: points.y1 }
    : { x: points.x1, y: snapToGrid((points.y1 + points.y2) / 2) };
  const midB = horizontal
    ? { x: midA.x, y: points.y2 }
    : { x: points.x2, y: midA.y };

  return {
    points,
    labelX: horizontal ? midA.x : points.x2,
    labelY: horizontal ? points.y2 : midA.y,
    path: `M ${points.x1} ${points.y1} L ${midA.x} ${midA.y} L ${midB.x} ${midB.y} L ${points.x2} ${points.y2}`,
  };
};

export default function TransactionRelationMap({
  open,
  title,
  nodes,
  edges,
  onClose,
  onCardClick,
  onCardDoubleClick,
}: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragStartPositionsRef = useRef<Record<string, Position>>({});
  const didDragRef = useRef(false);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 1 } }));

  const rootNode = useMemo(() => nodes.find((node) => node.isRoot) || nodes.find((node) => node.type === "pedido") || nodes[0], [nodes]);
  const orderedNodes = useMemo(() => {
    if (!rootNode) return nodes;
    return [rootNode, ...nodes.filter((node) => node.id !== rootNode.id)];
  }, [nodes, rootNode]);
  const nodeIdsKey = useMemo(() => orderedNodes.map((node) => node.id).join("|"), [orderedNodes]);

  const canvasHeight = useMemo(() => {
    const rows = Math.ceil(Math.max(orderedNodes.length - 1, 1) / 3);
    return Math.max(CANVAS_MIN_HEIGHT, 250 + rows * 200);
  }, [orderedNodes.length]);

  const buildInitialPositions = useCallback(() => {
    const width = canvasRef.current?.clientWidth || 980;
    const safeWidth = Math.max(width, NODE_WIDTH + 48);
    const next: Record<string, Position> = {};

    if (rootNode) {
      next[rootNode.id] = {
        x: Math.round((safeWidth - NODE_WIDTH) / 2),
        y: 24,
      };
    }

    const children = orderedNodes.filter((node) => node.id !== rootNode?.id);
    const columns = Math.max(1, Math.min(3, Math.floor((safeWidth - 40) / (NODE_WIDTH + 34))));
    const totalGridWidth = columns * NODE_WIDTH + (columns - 1) * 34;
    const startX = Math.max(20, Math.round((safeWidth - totalGridWidth) / 2));

    children.forEach((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      next[node.id] = {
        x: startX + col * (NODE_WIDTH + 34),
        y: 230 + row * 190,
      };
    });

    return next;
  }, [orderedNodes, rootNode]);

  useEffect(() => {
    if (!open) return;
    const initialize = () => setPositions(buildInitialPositions());
    initialize();
    window.addEventListener("resize", initialize);
    return () => window.removeEventListener("resize", initialize);
  }, [open, nodeIdsKey, buildInitialPositions]);

  const updateNodePosition = (nodeId: string, delta: { x: number; y: number }) => {
    const base = dragStartPositionsRef.current[nodeId];
    if (!base) return;
    const width = canvasRef.current?.clientWidth || 980;
    const maxX = Math.max(0, width - NODE_WIDTH - 8);
    const maxY = Math.max(0, canvasHeight - NODE_HEIGHT - 8);
    setPositions((current) => ({
      ...current,
      [nodeId]: {
        x: clamp(base.x + delta.x, 8, maxX),
        y: clamp(base.y + delta.y, 8, maxY),
      },
    }));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    didDragRef.current = true;
    dragStartPositionsRef.current = positions;
    setDraggingId(id);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    updateNodePosition(String(event.active.id), event.delta);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    updateNodePosition(String(event.active.id), event.delta);
    setDraggingId(null);
  };

  const handleCardClick = (node: RelationNode) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onCardClick?.(node);
  };

  const openNode = (node: RelationNode) => {
    didDragRef.current = false;
    onCardClick?.(node);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {!orderedNodes.length ? (
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary">No hay relaciones registradas para este documento.</Typography>
          </Box>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
            <Box
              ref={canvasRef}
              sx={{
                position: "relative",
                minHeight: canvasHeight,
                overflow: "auto",
                bgcolor: "background.default",
                backgroundImage:
                  "linear-gradient(rgba(15, 23, 42, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.045) 1px, transparent 1px)",
                backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
              }}
            >
              <svg
                width="100%"
                height={canvasHeight}
                style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}
              >
                <defs>
                  <marker id="relation-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
                  </marker>
                </defs>
                {edges.map((edge, index) => {
                  const from = positions[edge.from];
                  const to = positions[edge.to];
                  if (!from || !to) return null;
                  const route = buildGridPath(from, to);
                  return (
                    <g key={`${edge.from}-${edge.to}-${index}`}>
                      <path
                        d={route.path}
                        fill="none"
                        stroke="#64748b"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        markerEnd="url(#relation-arrow)"
                      />
                      {edge.label ? (
                        <>
                          <rect x={route.labelX - 46} y={route.labelY - 11} width="92" height="22" rx="4" fill="#f8fafc" stroke="#cbd5e1" />
                          <text x={route.labelX} y={route.labelY + 4} textAnchor="middle" fontSize="11" fill="#334155">
                            {edge.label}
                          </text>
                        </>
                      ) : null}
                    </g>
                  );
                })}
              </svg>

              {orderedNodes.map((node) => {
                const position = positions[node.id];
                if (!position) return null;
                return (
                  <DraggableNode
                    key={node.id}
                    node={node}
                    position={position}
                    draggingId={draggingId}
                    onClick={onCardClick && draggingId !== node.id ? () => handleCardClick(node) : undefined}
                    onOpenClick={onCardClick ? () => openNode(node) : undefined}
                    onDoubleClick={onCardDoubleClick ? () => onCardDoubleClick(node) : undefined}
                  />
                );
              })}
            </Box>
          </DndContext>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
