import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Axé Agenda — Painel do Pai de Santo',
    short_name: 'Axé Agenda',
    description: 'Sistema de agendamento e proteção de tempo para terreiro de Umbanda',
    start_url: '/painel',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#18181b',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
