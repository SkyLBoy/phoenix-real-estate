'use client';

import { useEffect, useState } from 'react';

export function useRelojDisponibilidad() {
  const [ahora, setAhora] = useState(Date.now);
  useEffect(() => {
    const actualizar = () => setAhora(Date.now());
    const intervalo = window.setInterval(actualizar, 60000);
    window.addEventListener('focus', actualizar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('focus', actualizar);
    };
  }, []);
  return ahora;
}
