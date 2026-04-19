import { Paper, Typography, Stack, Divider } from "@mui/material";

interface Props {
  title: string;
  description: string;
  hint?: string;
}

export default function ReportPlaceholder({ title, description, hint }: Props) {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={1}>
        <Typography variant="h4">{title}</Typography>
        <Divider />
        <Typography variant="body1">{description}</Typography>
        {hint && (
          <Typography variant="body2" color="text.secondary">
            {hint}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
