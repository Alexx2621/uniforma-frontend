import { TableCell, TableRow } from "@mui/material";
import { UniformaLoader } from "./UniformaLoader";

interface UniformaTableLoadingRowProps {
  colSpan: number;
  height?: number;
}

export default function UniformaTableLoadingRow({ colSpan, height = 220 }: UniformaTableLoadingRowProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} align="center" sx={{ height, borderBottom: 0 }}>
        <UniformaLoader />
      </TableCell>
    </TableRow>
  );
}
