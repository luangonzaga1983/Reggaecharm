'use client';
import { useState, useEffect } from 'react';
import type { AppTab, BarbeiroDB } from '@/types';
import { getTabsForRole, TAB_LABEL, canDo, applyStoreTheme, initials } from '@/utils';
import { useApp } from '@/hooks/useApp';

import ThemeToggle         from '@/components/ui/ThemeToggle';
import Logo                from '@/components/ui/Logo';
import Landing             from '@/components/Landing';
import AgendarModal        from '@/components/modals/AgendarModal';
import PerfilBarbeiroModal from '@/components/modals/PerfilBarbeiroModal';
import Dashboard           from '@/components/tabs/Dashboard';
import HorariosTab         from '@/components/tabs/HorariosTab';
import PerfilBarbeiroTab   from '@/components/tabs/PerfilBarbeiroTab';
import Configuracoes       from '@/components/tabs/Configuracoes';
import GerenciaPanel       from '@/components/tabs/GerenciaPanel';
import FinanceiroPanel     from '@/components/tabs/FinanceiroPanel';

export default function App() {
  const app = useApp();
  const [tab, setTab]                   = useState<AppTab>('dashboard');
  const [agendarOpen, setAgendarOpen]   = useState(false);
  const [perfilAberto, setPerfilAberto] = useState<BarbeiroDB | null>(null);

  useEffect(() => {
    if (app.storeConfig) applyStoreTheme(app.storeConfig);
  }, [app.storeConfig]);

  if (app.loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <span className="spinner spinner-lg" />
      <p style={{ fontSize: 12, color: 'var(--text-faint)', letterSpacing: '0.04em' }}>Carregando…</p>
    </div>
  );

  if (app.maintenanceMsg) return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <h1 className="text-display" style={{ fontSize: 'clamp(2rem, 7vw, 3.5rem)', marginBottom: 12 }}>Em manutenção</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 14, maxWidth: 380, lineHeight: 1.6 }}>{app.maintenanceMsg}</p>
      <button className="btn btn-outline" style={{ marginTop: 24 }} onClick={app.loadAll}>Tentar novamente</button>
    </div>
  );

  if (!app.authed || !app.session) return <Landing onSuccess={app.loadAll} />;

  if (!app.storeConfig) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner spinner-lg" />
    </div>
  );

  const { session, usuario, agendamentos, adminAgs, clientes, barbeiros, stats, storeConfig, refresh, logout } = app;

  const tabs = getTabsForRole(session.role);
  const activeTab = tabs.includes(tab) ? tab : tabs[0];

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="bg-3d" />
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="header-glass" style={{ padding: '11px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <Logo size={34} />
            <div style={{ minWidth: 0 }}>
              <p className="text-display" style={{ fontSize: 16, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {storeConfig.nome_loja}
              </p>
              {storeConfig.slogan && (
                <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{storeConfig.slogan}</p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <ThemeToggle />
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden' }}>
              {usuario?.foto_url
                ? <img src={usuario.foto_url} alt={session.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials(session.nome)}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="scene" style={{ flex: 1, width: '100%', maxWidth: 760, margin: '0 auto', padding: '22px 16px calc(84px + env(safe-area-inset-bottom))' }}>
        <div key={activeTab} className="tab-swap">
        {activeTab === 'dashboard' && (
          <Dashboard session={session} usuario={usuario} stats={stats} agendamentos={agendamentos}
            barbeiros={barbeiros} storeConfig={storeConfig}
            onAgendar={() => setAgendarOpen(true)} onRefresh={refresh}
            onVerPerfil={b => setPerfilAberto(b)} />
        )}
        {activeTab === 'horarios' && (
          <HorariosTab session={session} usuario={usuario} barbeiros={barbeiros}
            agendamentos={adminAgs} clientes={clientes} storeConfig={storeConfig} onRefresh={refresh} />
        )}
        {activeTab === 'perfil' && (
          <PerfilBarbeiroTab session={session} usuario={usuario}
            agendamentos={adminAgs} onRefresh={refresh} />
        )}
        {activeTab === 'configuracoes' && (
          <Configuracoes session={session} usuario={usuario} barbeiros={barbeiros}
            storeConfig={storeConfig} onUpdate={refresh} onLogout={logout} />
        )}
        {activeTab === 'gerencia' && canDo(session.role, 'acesso_admin') && (
          <GerenciaPanel session={session} barbeiros={barbeiros}
            storeConfig={storeConfig} onRefresh={refresh} />
        )}
        {activeTab === 'financeiro' && session.role === 'dono' && (
          <FinanceiroPanel barbeiros={barbeiros} agendamentos={adminAgs}
            storeConfig={storeConfig} onRefresh={refresh} />
        )}
        </div>
      </main>

      {/* Bottom nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 }}>
        <div className="nav-glass" style={{ padding: '8px 12px calc(8px + env(safe-area-inset-bottom))' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 2 }}>
            {tabs.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  position: 'relative',
                  background: activeTab === t ? 'var(--surface2)' : 'transparent',
                  border: 'none',
                  borderRadius: 9,
                  padding: '9px 6px',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 600,
                  fontSize: tabs.length > 4 ? 11.5 : 12.5,
                  color: activeTab === t ? 'var(--text)' : 'var(--text-faint)',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease, background 0.15s ease',
                }}
              >
                {TAB_LABEL[t]}
                {t === 'gerencia' && session.role === 'dono' && (
                  <span style={{ position: 'absolute', top: 6, right: 10, width: 5, height: 5, borderRadius: '50%', background: 'var(--danger)' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {agendarOpen && (
        <AgendarModal session={session} usuario={usuario} stats={stats} barbeiros={barbeiros}
          storeConfig={storeConfig} onClose={() => setAgendarOpen(false)} onSuccess={refresh} />
      )}
      {perfilAberto && (
        <PerfilBarbeiroModal barbeiro={perfilAberto} agendamentos={agendamentos}
          onClose={() => setPerfilAberto(null)}
          isProprietario={session.role === 'barbeiro' && usuario?.barbeiro_id === perfilAberto.id} />
      )}
    </div>
  );
}
