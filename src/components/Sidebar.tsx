import React from 'react';

export default function Sidebar() {
  return (
    <div style={{ width: 200, background: '#eee', padding: 20 }}>
      <h3>MENÚ</h3>
      <ul>
        <li>Dashboard</li>
        <li>Ventas</li>
        <li>Inventario</li>
        <li>Producción</li>
      </ul>
    </div>
  );
}
