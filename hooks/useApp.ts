'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Session, Usuario, Agendamento, BarbeiroDB, StoreConfig, BarbeiroStats, UserRole, ClienteResumo } from '@/types';
import { canDo } from '@/utils';

interface AppState {
  session: Session | null;
  usuario: Usuario | null;
  agendamentos: Agendamento[];
  adminAgs: Agendamento[];
  clientes: Record<string, ClienteResumo>;
  barbeiros: BarbeiroDB[];
  stats: BarbeiroStats[];
  storeConfig: StoreConfig | null;
  loading: boolean;
  maintenanceMsg: string | null;
  authed: boolean;
}

const INIT: AppState = {
  session: null, usuario: null, agendamentos: [], adminAgs: [], clientes: {},
  barbeiros: [], stats: [], storeConfig: null,
  loading: true, maintenanceMsg: null, authed: false,
};

export function useApp() {
  const [state, setState] = useState<AppState>(INIT);

  const loadAll = useCallback(async () => {
    const [sessRes, userRes, agRes, statsRes, barbRes, cfgRes] = await Promise.all([
      fetch('/api/auth'),
      fetch('/api/usuarios'),
      fetch('/api/agendamentos?action=meus'),
      fetch('/api/agendamentos?action=stats'),
      fetch('/api/barbeiros'),
      fetch('/api/config'),
    ]);

    const sessData = await sessRes.json();
    if (sessData.banned)      { alert(`Conta banida. Motivo: ${sessData.motivo || 'Violação dos termos'}`); setState(s => ({ ...s, loading: false })); return; }
    if (sessData.maintenance) { setState(s => ({ ...s, maintenanceMsg: sessData.mensagem || 'Site em manutenção.', loading: false })); return; }

    const [userData, agData, statsData, barbData, cfgData] = await Promise.all([
      userRes.ok  ? userRes.json()  : null,
      agRes.ok    ? agRes.json()    : null,
      statsRes.ok ? statsRes.json() : null,
      barbRes.ok  ? barbRes.json()  : null,
      cfgRes.ok   ? cfgRes.json()   : null,
    ]);

    setState({
      session:      sessData.session ?? null,
      authed:       !!sessData.session,
      usuario:      userData?.usuario  ?? null,
      agendamentos: agData?.agendamentos  ?? [],
      stats:        statsData?.stats      ?? [],
      barbeiros:    barbData?.barbeiros   ?? [],
      storeConfig:  cfgData?.config       ?? null,
      adminAgs:     [],
      clientes:     {},
      loading:      false,
      maintenanceMsg: null,
    });
  }, []);

  const loadAdminAgs = useCallback(async (role: UserRole) => {
    if (!canDo(role, 'ver_todos_ag')) return;
    const res = await fetch('/api/agendamentos?action=admin');
    if (res.ok) {
      const d = await res.json();
      setState(s => ({ ...s, adminAgs: d.agendamentos ?? [], clientes: d.clientes ?? {} }));
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (state.session?.role) loadAdminAgs(state.session.role); }, [state.session?.role, loadAdminAgs]);

  const refresh = useCallback(async () => {
    await loadAll();
    if (state.session?.role) await loadAdminAgs(state.session.role);
  }, [loadAll, loadAdminAgs, state.session?.role]);

  const logout = useCallback(async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    setState({ ...INIT, loading: false });
  }, []);

  return { ...state, refresh, logout, loadAll };
}
