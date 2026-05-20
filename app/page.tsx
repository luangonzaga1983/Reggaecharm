'use client';
import { useState, useEffect } from 'react';
import type { AppTab, BarbeiroDB } from '@/types';
import { getTabsForRole, TAB_LABEL, canDo, applyStoreTheme } from '@/utils';
import { useApp } from '@/hooks/useApp';

import Auth            from '@/components/modals/AuthModal';
import AgendarModal    from '@/components/modals/AgendarModal';
import PerfilBarbeiroModal from '@/components/modals/PerfilBarbeiroModal';
import Dashboard       from '@/components/tabs/Dashboard';
import HorariosTab     from '@/components/tabs/HorariosTab';
import PerfilBarbeiroTab from '@/components/tabs/PerfilBarbeiroTab';
import Configuracoes   from '@/components/tabs/Configuracoes';
import GerenciaPanel   from '@/components/tabs/GerenciaPanel';

export default function App() {
  const app = useApp();
  const [tab, setTab]             = useState<AppTab>('dashboard');
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState<BarbeiroDB | null>(null);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (app.loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, background: 'var(--black)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, justifyContent: 'center' }}>
          <div style={{ width: 28, height: 5, background: '#00C853', borderRadius: '2px 0 0 2px' }} />
          <div style={{ width: 28, height: 5, background: '#FFD600' }} />
          <div style={{ width: 28, height: 5, background: '#FF3D57', borderRadius: '0 2px 2px 0' }} />
        </div>
        <span className="spinner spinner-lg" style={{ margin: '0 auto', display: 'block' }} />
        <p style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-faint)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Carregando</p>
      </div>
    </div>
  );

  // ── Maintenance ──────────────────────────────────────────────────────────────
  if (app.maintenanceMsg) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', textAlign: 'center' }}>
      <div className="rasta-bar" style={{ width: 64, borderRadius: 2, marginBottom: 32 }} />
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,8vw,4rem)', color: 'var(--yellow)', marginBottom: 12 }}>MANUTENÇÃO</p>
      <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem', maxWidth: 360, lineHeight: 1.7 }}>{app.maintenanceMsg}</p>
      <button className="btn btn-outline" style={{ marginTop: 28 }} onClick={app.loadAll}>Tentar novamente</button>
    </div>
  );

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (!app.authed || !app.session) return <Auth onSuccess={app.loadAll} />;

  // ── Config loading ───────────────────────────────────────────────────────────
  if (!app.storeConfig) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner spinner-lg" />
    </div>
  );

  const { session, usuario, agendamentos, adminAgs, barbeiros, stats, storeConfig, refresh, logout } = app;

  // Aplicar tema/reggae sempre que storeConfig mudar
  useEffect(() => {
    if (storeConfig) applyStoreTheme(storeConfig);
  }, [storeConfig]);

  const tabs      = getTabsForRole(session.role);
  const activeTab = tabs.includes(tab) ? tab : tabs[0];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Glow accent dinâmico */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 100% 50% at 50% -5%, color-mix(in srgb, var(--accent) 7%, transparent), transparent)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Header fixo com nome da loja */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <div className="rasta-bar" />
        <div style={{ background: 'rgba(12,12,11,0.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 6, height: 28, background: 'var(--accent)', borderRadius: 1 }} />
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.12em', color: 'var(--text)', lineHeight: 1 }}>{storeConfig.nome_loja.toUpperCase()}</p>
              {storeConfig.slogan && <p style={{ fontSize: '0.6rem', color: 'var(--text-faint)', letterSpacing: '0.08em', marginTop: 2 }}>{storeConfig.slogan}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{session.nome.split(' ')[0]}</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface3)', border: '1px solid var(--border-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
              {session.nome.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '88px 16px 120px', position: 'relative', zIndex: 1 }}>
        {activeTab === 'dashboard' && (
          <Dashboard session={session} usuario={usuario} stats={stats} agendamentos={agendamentos}
            barbeiros={barbeiros} storeConfig={storeConfig}
            onAgendar={() => setAgendarOpen(true)} onRefresh={refresh}
            onVerPerfil={b => setPerfilAberto(b)} />
        )}
        {activeTab === 'horarios' && (
          <HorariosTab session={session} usuario={usuario} barbeiros={barbeiros}
            agendamentos={adminAgs} storeConfig={storeConfig} onRefresh={refresh} />
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
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 }}>
        <div style={{ background: 'rgba(10,10,9,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border)', padding: '10px 14px 14px' }}>
          <div className="rasta-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
          <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', gap: 2 }}>
            {tabs.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, position: 'relative',
                  background: activeTab === t ? 'var(--surface2)' : 'transparent',
                  border: activeTab === t ? '1px solid var(--border-bright)' : '1px solid transparent',
                  borderRadius: 4,
                  padding: '9px 6px',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 700,
                  fontSize: tabs.length > 3 ? '0.62rem' : '0.7rem',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase' as const,
                  color: activeTab === t ? 'var(--accent)' : 'var(--text-faint)',
                  cursor: 'pointer',
                  transition: 'all 0.16s',
                }}
              >
                {activeTab === t && (
                  <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '40%', height: 2, background: 'var(--accent)', borderRadius: '0 0 2px 2px' }} />
                )}
                {TAB_LABEL[t]}
                {t === 'gerencia' && session.role === 'dono' && (
                  <span style={{ position: 'absolute', top: 5, right: 7, width: 5, height: 5, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 5px var(--red)' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {agendarOpen && (
        <AgendarModal session={session} stats={stats} barbeiros={barbeiros}
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
