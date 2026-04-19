import React, { useState } from "react";
import {
  alpha,
  Box,
  Button,
  Card,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MailOutlineRounded from "@mui/icons-material/MailOutlineRounded";
import LockOutlined from "@mui/icons-material/LockOutlined";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";
import { getFirstAccessiblePath } from "../auth/permissions";
import fondoUniforma from "../assets/fondo-uniforma.jpg";
import uniformaLogo from "../assets/uniforma-logo.png";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [form, setForm] = useState({
    correo: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data } = await api.post("/auth/login", {
        correo: form.correo,
        password: form.password,
      });

      login({
        token: data.token,
        usuario: data.usuario,
        nombre: data.nombre ?? null,
        primerNombre: data.primerNombre ?? null,
        primerApellido: data.primerApellido ?? null,
        segundoApellido: data.segundoApellido ?? null,
        fotoUrl: data.fotoUrl ?? null,
        rol: data.rol,
        permisos: data.permisos || [],
        bodegaId: data.bodegaId ?? null,
        bodegaNombre: data.bodegaNombre ?? null,
      });

      Swal.fire({
        icon: "success",
        title: "Bienvenido",
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
      });

      navigate(getFirstAccessiblePath(data.rol, data.permisos || []));
    } catch (error: any) {
      if (error?.response?.status === 401) {
        Swal.fire({
          icon: "error",
          title: "Credenciales incorrectas",
        });
        return;
      }

      Swal.fire({
        icon: "error",
        title: "Error de conexion",
        text: "No se pudo contactar el servidor",
      });
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 5 },
        background:
          "radial-gradient(circle at top left, rgba(255,255,255,0.95), rgba(232,240,250,0.9) 34%, rgba(223,232,242,0.92) 100%)",
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 1160,
          minHeight: { xs: "auto", md: 700 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.02fr 0.98fr" },
          borderRadius: 5,
          overflow: "hidden",
          border: `1px solid ${alpha("#97aac4", 0.22)}`,
          background: alpha("#ffffff", 0.82),
          boxShadow: "0 24px 70px rgba(53, 76, 110, 0.16)",
          backdropFilter: "blur(14px)",
        }}
      >
        <Box
          sx={{
            position: "relative",
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 700,
            p: 4,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(233,241,248,0.78) 100%)",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${fondoUniforma})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
              backgroundSize: "contain",
              opacity: 0.98,
            },
          }}
        >
          <Box
            sx={{
              position: "relative",
              zIndex: 1,
              display: "inline-flex",
              alignItems: "center",
              width: "fit-content",
            }}
          >
            <Box
              component="img"
              src={uniformaLogo}
              alt="Uniforma"
              sx={{
                height: 68,
                width: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 10px 18px rgba(35, 56, 85, 0.10))",
              }}
            />
          </Box>

          <Box sx={{ position: "relative", zIndex: 1, mt: "auto" }} />
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: { xs: 3, sm: 5, md: 6 },
            background:
              "linear-gradient(180deg, rgba(251,253,255,0.96) 0%, rgba(241,246,250,0.96) 100%)",
          }}
        >
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              width: "100%",
              maxWidth: 420,
            }}
          >
            <Stack spacing={3}>
              <Stack spacing={1.25}>
                <Box
                  component="img"
                  src={uniformaLogo}
                  alt="Uniforma"
                  sx={{
                    display: { xs: "block", md: "none" },
                    height: 46,
                    width: "fit-content",
                    objectFit: "contain",
                    mb: 1,
                  }}
                />
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    fontSize: { xs: 34, md: 38 },
                    color: "#243c58",
                  }}
                >
                  Iniciar sesión
                </Typography>
                <Typography
                  sx={{
                    color: alpha("#49627b", 0.88),
                    fontSize: 15,
                    lineHeight: 1.6,
                  }}
                >
                  Ingresa con tu correo y contraseña.
                </Typography>
              </Stack>

              <Stack spacing={2}>
                <TextField
                  label="Correo electronico"
                  name="correo"
                  type="email"
                  fullWidth
                  value={form.correo}
                  onChange={handleChange}
                  autoComplete="email"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MailOutlineRounded sx={{ color: alpha("#ffffff", 0.45) }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 3,
                      backgroundColor: alpha("#ffffff", 0.92),
                      color: "#23374f",
                    },
                    "& .MuiInputLabel-root": { color: alpha("#556f89", 0.92) },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: alpha("#b8c7d6", 0.92),
                    },
                    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: alpha("#8098b2", 0.92),
                    },
                  }}
                />

                <TextField
                  label="Contraseña"
                  name="password"
                  type="password"
                  fullWidth
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined sx={{ color: alpha("#ffffff", 0.45) }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 3,
                      backgroundColor: alpha("#ffffff", 0.92),
                      color: "#23374f",
                    },
                    "& .MuiInputLabel-root": { color: alpha("#556f89", 0.92) },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: alpha("#b8c7d6", 0.92),
                    },
                    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: alpha("#8098b2", 0.92),
                    },
                  }}
                />
              </Stack>

              <Button
                fullWidth
                type="submit"
                variant="contained"
                endIcon={<ArrowForwardRounded />}
                sx={{
                  py: 1.55,
                  borderRadius: 3,
                  fontSize: 15,
                  fontWeight: 800,
                  textTransform: "none",
                  background: "linear-gradient(90deg, #d10f28 0%, #f04545 100%)",
                  "&:hover": {
                    background: "linear-gradient(90deg, #bf1126 0%, #df3d3d 100%)",
                  },
                }}
              >
                Ingresar
              </Button>

              <Typography
                sx={{
                  textAlign: "center",
                  color: alpha("#617b95", 0.78),
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Uniforma E.R.P.
              </Typography>
            </Stack>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
