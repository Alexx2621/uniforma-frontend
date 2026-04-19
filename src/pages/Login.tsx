import React, { useState } from "react";
import { Box, Button, Card, TextField, Typography } from "@mui/material";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { api } from "../api/axios";
import { useAuthStore } from "../auth/useAuthStore";

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
        rol: data.rol,
        bodegaId: data.bodegaId ?? null,
        bodegaNombre: data.bodegaNombre ?? null,
      });

      Swal.fire({
        icon: "success",
        title: "Bienvenido",
      });

      navigate("/");
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
        title: "Error de conexión",
        text: "No se pudo contactar el servidor",
      });
    }
  };

  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f4f6f8",
      }}
    >
      <Card sx={{ padding: 4, width: 400 }}>
        <Typography variant="h5" textAlign="center" mb={2}>
          Iniciar Sesión
        </Typography>

        <TextField
          label="Correo electrónico"
          name="correo"
          type="email"
          fullWidth
          margin="normal"
          onChange={handleChange}
        />

        <TextField
          label="Contraseña"
          name="password"
          type="password"
          fullWidth
          margin="normal"
          onChange={handleChange}
        />

        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 2 }}
          onClick={handleSubmit}
        >
          Ingresar
        </Button>
      </Card>
    </Box>
  );
}
