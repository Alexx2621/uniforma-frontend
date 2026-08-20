import { Box } from "@mui/material";

type Props = {
  /** Tamano en pixeles. El dibujo escala completo desde el viewBox. */
  tamano?: number;
  /** Hay algo pendiente: el robot se pone atento en vez de solo respirar. */
  atento?: boolean;
  /** El panel esta abierto: mira de frente y deja de llamar la atencion. */
  activo?: boolean;
};

/**
 * El asistente como personaje, no como icono.
 *
 * La animacion no es decoracion: un robot completamente quieto se lee como
 * una imagen pegada en la pantalla. Respirar, parpadear y tener una luz que
 * late es lo que hace que se perciba presente y a la espera.
 *
 * El parpadeo va con una pausa larga y dos cierres seguidos porque un
 * parpadeo perfectamente regular se siente mecanico; asi parece vivo.
 */
export default function RobotAsistente({ tamano = 46, atento = false, activo = false }: Props) {
  return (
    <Box
      sx={{
        width: tamano,
        height: tamano,
        display: "grid",
        placeItems: "center",
        position: "relative",
        // Respiracion: sube y baja siempre, un poco mas rapido si esta atento.
        animation: `flotar ${atento ? 1.8 : 3}s ease-in-out infinite`,
        "@keyframes flotar": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        "@keyframes parpadear": {
          // 92% del ciclo con los ojos abiertos: el cierre tiene que ser breve.
          "0%, 88%, 100%": { transform: "scaleY(1)" },
          "91%, 94%": { transform: "scaleY(0.08)" },
          "92.5%": { transform: "scaleY(1)" },
        },
        "@keyframes latir": {
          "0%, 100%": { opacity: 0.35, r: 2.2 },
          "50%": { opacity: 1, r: 3.1 },
        },
        "@keyframes onda": {
          "0%": { transform: "scale(0.8)", opacity: 0.5 },
          "100%": { transform: "scale(1.9)", opacity: 0 },
        },
        "& .ojo": {
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: "parpadear 5.5s ease-in-out infinite",
        },
        // El segundo ojo parpadea un pelin despues: los ojos perfectamente
        // sincronizados se ven artificiales.
        "& .ojo-der": { animationDelay: "0.04s" },
        "& .luz": { animation: `latir ${atento ? 1 : 2.2}s ease-in-out infinite` },
      }}
    >
      {/* Onda de atencion: solo cuando hay algo pendiente y el panel cerrado. */}
      {atento && !activo && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "2px solid",
            borderColor: "warning.main",
            animation: "onda 1.8s ease-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      <svg viewBox="0 0 64 64" width={tamano} height={tamano} aria-hidden="true">
        <defs>
          <linearGradient id="cuerpoRobot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="visorRobot" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <filter id="brilloOjo" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* antena */}
        <line x1="32" y1="12" x2="32" y2="6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <circle className="luz" cx="32" cy="4.5" r="2.6" fill={atento ? "#f59e0b" : "#38bdf8"} filter="url(#brilloOjo)" />

        {/* orejas */}
        <rect x="6" y="27" width="5" height="12" rx="2.5" fill="#94a3b8" />
        <rect x="53" y="27" width="5" height="12" rx="2.5" fill="#94a3b8" />

        {/* cabeza */}
        <rect x="11" y="12" width="42" height="34" rx="13" fill="url(#cuerpoRobot)" stroke="#94a3b8" strokeWidth="1.2" />

        {/* visor */}
        <rect x="16" y="19" width="32" height="20" rx="9.5" fill="url(#visorRobot)" />

        {/* ojos */}
        <circle className="ojo" cx="25.5" cy="29" r="3.4" fill="#38bdf8" filter="url(#brilloOjo)" />
        <circle className="ojo ojo-der" cx="38.5" cy="29" r="3.4" fill="#38bdf8" filter="url(#brilloOjo)" />

        {/* cuerpo */}
        <path d="M19 47 h26 a7 7 0 0 1 7 7 v3 a2 2 0 0 1 -2 2 h-36 a2 2 0 0 1 -2 -2 v-3 a7 7 0 0 1 7 -7 z" fill="url(#cuerpoRobot)" stroke="#94a3b8" strokeWidth="1.2" />
        <circle cx="32" cy="54" r="2.4" fill={atento ? "#f59e0b" : "#38bdf8"} opacity="0.9" />
      </svg>
    </Box>
  );
}
