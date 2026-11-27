'use client';

import { useCallback } from 'react';
import { respuestaPrivada, solicitar } from '@/lib/api-admin';
import type { FotoDrivePanel as FotoDrive } from '@/lib/fotos-drive';

export function useDrivePanel(userId: string) {
  const listarFotos = async (carpeta: string) => {
    const params = new URLSearchParams({ carpeta });
    const { fotos } = await solicitar<{ fotos: FotoDrive[] }>(userId, `/api/admin/drive?${params}`);
    return fotos;
  };

  const abrirFoto = useCallback(async (foto: FotoDrive, signal?: AbortSignal) => {
    const params = new URLSearchParams({ foto: foto.id });
    if (foto.resourceKey) params.set('clave', foto.resourceKey);
    return (await respuestaPrivada(userId, `/api/admin/drive?${params}`, { signal })).blob();
  }, [userId]);
  const abrirOriginal = async (foto: FotoDrive, modo: 'original' | 'vista' = 'original') => {
    const params = new URLSearchParams({ foto: foto.id, [modo === 'vista' ? 'vista' : 'original']: '1' });
    if (foto.resourceKey) params.set('clave', foto.resourceKey);
    return (await respuestaPrivada(userId, `/api/admin/drive?${params}`)).blob();
  };
  return { listarFotos, abrirFoto, abrirOriginal };
}
