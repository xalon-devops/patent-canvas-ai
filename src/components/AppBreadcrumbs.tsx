import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { supabase } from '@/integrations/supabase/client';

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard', ideas: 'Ideas', idea: 'Ideas', pending: 'Pending', active: 'Active Patents',
  analytics: 'Portfolio Analytics', 'new-application': 'New Application', drafts: 'My Drafts',
  check: 'Check & See', settings: 'Settings', profile: 'Profile', session: 'My Drafts',
  admin: 'Admin', claims: 'Claims', 'trademark-check': 'Trademark Search',
  'trademark-application': 'Trademark Filing', 'select-supabase-project': 'Connect Project',
};
// Parent list pages for detail routes
const PARENT_PATH: Record<string, string> = { session: '/drafts', idea: '/ideas', 'trademark-application': '/trademark-check' };

const isId = (s: string) => /^[0-9a-f-]{20,}$/i.test(s);

async function fetchName(kind: string, id: string): Promise<string | null> {
  if (kind === 'session') {
    const { data } = await supabase.from('patent_sessions').select('title, idea_prompt').eq('id', id).maybeSingle();
    const d = data as any;
    return d?.title || (d?.idea_prompt ? String(d.idea_prompt).slice(0, 48) : null);
  }
  if (kind === 'idea') {
    const { data } = await supabase.from('patent_ideas').select('title').eq('id', id).maybeSingle();
    return (data as any)?.title ?? null;
  }
  if (kind === 'trademark-application') {
    const { data } = await supabase.from('trademark_applications').select('mark_name').eq('id', id).maybeSingle();
    return (data as any)?.mark_name ?? null;
  }
  return null;
}

export const AppBreadcrumbs: React.FC = () => {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  const [name, setName] = useState<string | null>(null);
  const idIdx = parts.findIndex(isId);
  const kind = idIdx > 0 ? parts[idIdx - 1] : '';
  const id = idIdx > 0 ? parts[idIdx] : '';

  useEffect(() => {
    setName(null);
    if (!id) return;
    let live = true;
    fetchName(kind, id).then((n) => live && setName(n));
    const onRename = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.id === id) setName(d.name);
    };
    window.addEventListener('patentbot:renamed', onRename);
    return () => { live = false; window.removeEventListener('patentbot:renamed', onRename); };
  }, [kind, id]);

  if (parts.length === 0 || pathname === '/dashboard') return null;

  const crumbs: { label: string; to?: string }[] = [];
  parts.forEach((p, i) => {
    if (isId(p)) {
      crumbs.push({ label: name || 'Untitled', to: i < parts.length - 1 ? '/' + parts.slice(0, i + 1).join('/') : undefined });
      return;
    }
    const label = LABELS[p] || p.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const to = PARENT_PATH[p] && isId(parts[i + 1] || '') ? PARENT_PATH[p] : '/' + parts.slice(0, i + 1).join('/');
    crumbs.push({ label, to: i < parts.length - 1 ? to : undefined });
  });

  return (
    <nav className="border-b border-border bg-muted/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2">
        <Breadcrumb>
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/dashboard" className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="max-w-[220px]">
                  {c.to ? (
                    <BreadcrumbLink asChild><Link to={c.to} className="truncate">{c.label}</Link></BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="truncate font-medium">{c.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </nav>
  );
};

export default AppBreadcrumbs;
