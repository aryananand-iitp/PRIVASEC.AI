'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers';

export type DashboardStats = {
  totalAnalyses: number;
  totalFindings: number;
  protectedFiles: number;
  highRiskFindings: number;
  totalProcessingMs: number;
  weekly: { day: string; analyses: number; findings: number }[];
  threatDistribution: { category: string; count: number }[];
  recent: {
    id: string;
    source_kind: string;
    original_filename: string | null;
    risk_score: number | null;
    status: string;
    detection_count: number;
    created_at: string;
  }[];
  loading: boolean;
  error: string | null;
};

export function useDashboardStats() {
  const { session } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalAnalyses: 0,
    totalFindings: 0,
    protectedFiles: 0,
    highRiskFindings: 0,
    totalProcessingMs: 0,
    weekly: [],
    threatDistribution: [],
    recent: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!session) {
      setStats((s) => ({ ...s, loading: false, error: null }));
      return;
    }
    const userId = session.user.id;

    try {
      const [analysesRes, findingsRes, protectedRes, highRiskRes, recentRes] = await Promise.all([
        supabase.from('analyses').select('id, risk_score, detection_count, status, processing_ms, source_kind, original_filename, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
        supabase.from('detections').select('id, category').eq('user_id', userId).limit(2000),
        supabase.from('analyses').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'protected'),
        supabase.from('detections').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('severity', ['high', 'critical']),
        supabase.from('analyses').select('id, source_kind, original_filename, risk_score, status, detection_count, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      ]);

      if (analysesRes.error) throw new Error(analysesRes.error.message);
      if (findingsRes.error) throw new Error(findingsRes.error.message);

      const analyses = analysesRes.data ?? [];
      const findings = findingsRes.data ?? [];

      // Weekly aggregation (last 7 days) — use UTC for both filters to stay consistent with DB timestamps
      const days: { day: string; analyses: number; findings: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const dStart = new Date();
        dStart.setUTCHours(0, 0, 0, 0);
        dStart.setUTCDate(dStart.getUTCDate() - i);
        const dEnd = new Date(dStart);
        dEnd.setUTCDate(dEnd.getUTCDate() + 1);
        const label = dStart.toLocaleDateString('en-US', { weekday: 'short' });
        const startIso = dStart.toISOString();
        const endIso = dEnd.toISOString();
        const analysesCount = analyses.filter((a) => {
          const c = new Date(a.created_at);
          return c >= dStart && c < dEnd;
        }).length;
        const { count: dayFindings } = await supabase
          .from('detections')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', startIso)
          .lt('created_at', endIso);
        days.push({ day: label, analyses: analysesCount, findings: dayFindings ?? 0 });
      }

      // Threat distribution by category
      const catMap = new Map<string, number>();
      for (const f of findings) {
        catMap.set(f.category, (catMap.get(f.category) ?? 0) + 1);
      }
      const threatDistribution = Array.from(catMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      setStats({
        totalAnalyses: analyses.length,
        totalFindings: findings.length,
        protectedFiles: protectedRes.count ?? 0,
        highRiskFindings: highRiskRes.count ?? 0,
        totalProcessingMs: analyses.reduce((s, a) => s + (a.processing_ms ?? 0), 0),
        weekly: days,
        threatDistribution,
        recent: recentRes.data ?? [],
        loading: false,
        error: null,
      });
    } catch (err) {
      setStats((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load dashboard data',
      }));
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, reload: load };
}