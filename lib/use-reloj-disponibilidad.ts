'use client';

import { useEffect, useState } from 'react';

export function useRelojDisponibilidad(inicial: number | null = null) {
  const [ahora, setAhora] = useState(inicial);
  useEffect(() => {
    const actualizar = () => setAhora(Date.now());
    const temporizadorInicial = window.setTimeout(actualizar, 0);
    const intervalo = window.setInterval(actualizar, 60000);
    window.addEventListener('focus', actualizar);
    return () => {
      window.clearTimeout(temporizadorInicial);
      window.clearInterval(intervalo);
      window.removeEventListener('focus', actualizar);
    };
  }, []);
  return ahora;
}
