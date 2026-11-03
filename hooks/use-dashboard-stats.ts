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
  });

  const load = useCallback(async () => {
    if (!session) return;
    const userId = session.user.id;

    const [analysesRes, findingsRes, protectedRes, highRiskRes, recentRes] = await Promise.all([
      supabase.from('analyses').select('id, risk_score, detection_count, status, processing_ms, source_kind, original_filename, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('detections').select('id, category', { count: 'exact', head: false }).eq('user_id', userId),
      supabase.from('analyses').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'protected'),
      supabase.from('detections').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('severity', ['high', 'critical']),
      supabase.from('analyses').select('id, source_kind, original_filename, risk_score, status, detection_count, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    ]);

    const analyses = analysesRes.data ?? [];
    const findings = findingsRes.data ?? [];

    // Weekly aggregation (last 7 days)
    const days: { day: string; analyses: number; findings: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const analysesCount = analyses.filter((a) => {
        const c = new Date(a.created_at);
        return c >= d && c < next;
      }).length;
      const dayStartIso = d.toISOString();
      const dayEndIso = next.toISOString();
      const { count: dayFindings } = await supabase
        .from('detections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', dayStartIso)
        .lt('created_at', dayEndIso);
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
    });
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, reload: load };
}