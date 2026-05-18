import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './useAuthStore';
import { getFirstAccessiblePath, getRequiredPermission, hasPermission } from './permissions';

interface Props {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
  const { token, rol, permisos } = useAuthStore();
  const { pathname } = useLocation();
  const permissionBlocked = !hasPermission(rol, permisos, getRequiredPermission(pathname));

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (permissionBlocked) {
    return <Navigate to={getFirstAccessiblePath(rol, permisos)} replace />;
  }

  return <>{children}</>;
};
