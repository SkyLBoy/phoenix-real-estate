'use client';

import { useEffect, useState } from 'react';

export function useRelojDisponibilidad() {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    const actualizar = () => setAhora(Date.now());
    const inicial = window.setTimeout(actualizar, 0);
    const intervalo = window.setInterval(actualizar, 60000);
    window.addEventListener('focus', actualizar);
    return () => {
      window.clearTimeout(inicial);
      window.clearInterval(intervalo);
      window.removeEventListener('focus', actualizar);
    };
  }, []);
  return ahora;
}
