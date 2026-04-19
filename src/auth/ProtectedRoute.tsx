import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './useAuthStore';
import { useEffect } from 'react';
import Swal from 'sweetalert2';
import { useSystemConfigStore } from '../config/useSystemConfigStore';
import { isModuleAccessible } from '../config/moduleAccess';
import { getFirstAccessiblePath, getRequiredPermission, hasPermission } from './permissions';

interface Props {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
  const { token, usuario, rol, permisos } = useAuthStore();
  const location = useLocation();
  const { disabledPaths, userDisabledPaths, loaded, fetchConfig } = useSystemConfigStore();
  const usuarioKey = (usuario || "").trim().toUpperCase();
  const effectiveDisabledPaths = [
    ...disabledPaths,
    ...(userDisabledPaths[usuarioKey] || []),
  ];
  const blocked = loaded && !isModuleAccessible(location.pathname, effectiveDisabledPaths);
  const permissionBlocked = !hasPermission(rol, permisos, getRequiredPermission(location.pathname));

  useEffect(() => {
    if (token) {
      void fetchConfig();
    }
  }, [token, location.pathname, fetchConfig]);

  useEffect(() => {
    if (blocked) {
      void Swal.fire(
        'Modulo deshabilitado',
        'Este modulo esta temporalmente deshabilitado desde Configuracion.',
        'info',
      );
    }
  }, [blocked]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!loaded) {
    return null;
  }

  if (blocked) {
    return <Navigate to={getFirstAccessiblePath(rol, permisos)} replace />;
  }

  if (permissionBlocked) {
    return <Navigate to={getFirstAccessiblePath(rol, permisos)} replace />;
  }

  return <>{children}</>;
};
