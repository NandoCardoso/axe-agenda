'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  CalendarDays,
  Inbox,
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/painel', label: 'Início', icon: Home },
  { href: '/painel/calendario', label: 'Agenda', icon: CalendarDays },
  { href: '/painel/pedidos', label: 'Pedidos', icon: Inbox },
  { href: '/painel/ajustes', label: 'Ajustes', icon: Settings },
];

export default function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-surface-900 flex flex-col">
      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation — mobile-first */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-800/95 backdrop-blur-md border-t border-surface-700/50 pb-safe z-50">
        <div className="flex items-center justify-around max-w-lg mx-auto h-16">
          {navItems.map((item) => {
            const isActive =
              item.href === '/painel'
                ? pathname === '/painel'
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1 px-3 rounded-xl transition-colors ${
                  isActive
                    ? 'text-brand-400'
                    : 'text-surface-400 hover:text-surface-200'
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
