# PatentBot AI™ Dynamic Variable Registry

## Overview
This document maps all dynamic variables in the application to their canonical Supabase data sources and UI locations. All UI components should reference data through the centralized `usePatentData` hook to ensure consistency.

---

## 📊 Portfolio Statistics

| Variable | Supabase Source | Computation | UI Locations |
|----------|-----------------|-------------|--------------|
| `totalApplications` | `patent_sessions` | `COUNT(*)` | Dashboard, Pending, Admin |
| `completedApplications` | `patent_sessions` | `COUNT(*) WHERE status='completed'` | Dashboard, Pending |
| `inProgressApplications` | `patent_sessions` | `COUNT(*) WHERE status='in_progress'` | Dashboard, Pending, Drafts |
| `activePatents` | `patent_sessions` | `COUNT(*) WHERE status='completed'` | Dashboard, Active |
| `totalIdeas` | `patent_ideas` | `COUNT(*)` | Dashboard, Ideas |
| `monitoringIdeas` | `patent_ideas` | `COUNT(*) WHERE status='monitoring'` | Ideas |
| `draftedIdeas` | `patent_ideas` | `COUNT(*) WHERE status='drafted'` | Ideas |
| `highSimilarityCount` | `prior_art_results` | `COUNT(*) WHERE similarity_score > 0.7` | Pending, Session |
| `unreadAlerts` | `infringement_alerts` | `COUNT(*) WHERE is_read=false` | Dashboard, Active, Ideas |
| `portfolioValue` | Computed | `activePatents * $125,000` | Dashboard, Active |
| `maintenanceDue` | Computed | Patents with maintenance_due < 6 months | Active |

---

## 📁 Data Tables

### `patent_sessions`
Primary table for patent applications.

| Column | Type | Used In |
|--------|------|---------|
| `id` | UUID | All pages |
| `user_id` | UUID | Auth filter |
| `idea_prompt` | TEXT | Dashboard, Pending, Active, Session, Admin |
| `status` | TEXT | Stats computation, filtering |
| `patent_type` | TEXT | Cards display |
| `patentability_score` | NUMERIC | Pending, Session |
| `download_url` | TEXT | Export feature |
| `created_at` | TIMESTAMP | Date displays |
| `ai_analysis_complete` | BOOLEAN | Draft progress |
| `data_source` | JSONB | Session workflow |

### `patent_ideas`
Patent ideas in the Ideas Lab.

| Column | Type | Used In |
|--------|------|---------|
| `id` | UUID | Ideas, IdeaDetail |
| `user_id` | UUID | Auth filter |
| `title` | TEXT | Ideas cards |
| `description` | TEXT | Ideas cards |
| `patent_type` | TEXT | Badge display |
| `status` | TEXT | Stats, filtering |
| `prior_art_monitoring` | BOOLEAN | Monitoring badge |
| `last_monitored_at` | TIMESTAMP | Last check display |

### `prior_art_results`
Search results from prior art analysis.

| Column | Type | Used In |
|--------|------|---------|
| `id` | UUID | PriorArtDisplay |
| `session_id` | UUID | Session linking |
| `title` | TEXT | Result cards |
| `similarity_score` | FLOAT | Stats, sorting |
| `publication_number` | TEXT | Result display |
| `summary` | TEXT | Result cards |
| `overlap_claims` | TEXT[] | Claim chart |
| `difference_claims` | TEXT[] | Claim chart |

### `infringement_alerts`
Patent monitoring alerts.

| Column | Type | Used In |
|--------|------|---------|
| `id` | UUID | Alert display |
| `patent_session_id` | UUID | Session linking |
| `patent_idea_id` | UUID | Idea linking |
| `alert_type` | TEXT | Alert categorization |
| `severity` | TEXT | Badge color |
| `title` | TEXT | Alert display |
| `is_read` | BOOLEAN | Unread count |

### `subscriptions`
User subscription status.

| Column | Type | Used In |
|--------|------|---------|
| `user_id` | UUID | Auth filter |
| `status` | TEXT | Access control |
| `plan` | TEXT | Plan display |
| `current_period_end` | TIMESTAMP | Expiry display |

### `user_search_credits`
Free search tracking.

| Column | Type | Used In |
|--------|------|---------|
| `user_id` | UUID | Auth filter |
| `free_searches_remaining` | INT | Check page |
| `searches_used` | INT | Analytics |

---

## 🔗 Centralized Data Hook

```typescript
import { useAuthenticatedPatentData } from '@/hooks/usePatentData';

function MyComponent() {
  const {
    // Raw data
    sessions,
    ideas,
    priorArtBySession,
    alertsBySession,
    subscription,
    
    // Computed stats (SINGLE SOURCE OF TRUTH)
    stats,
    
    // Filtered views
    draftSessions,
    completedSessions,
    
    // State
    loading,
    
    // Actions
    refetch,
  } = useAuthenticatedPatentData();
  
  // Use stats.totalApplications, stats.activePatents, etc.
}
```

---

## 🎯 UI Component Mapping

### Dashboard (`/dashboard`)
- **File Patent Card**: Static pricing (`$1,000`)
- **Check & See Card**: Static pricing (`$9.99/month`)
- **Portfolio Overview**: `stats.totalApplications`, `stats.activePatents`, `stats.totalIdeas`
- **Nav Cards**: Link to Ideas, Pending, Active

### Pending (`/pending`)
- **Stats Cards**:
  - Total Applications: `stats.totalApplications`
  - Completed: `stats.completedApplications`
  - In Progress: `stats.inProgressApplications`
  - High Similarity: `stats.highSimilarityCount`
- **Session Cards**: `sessions` array

### Active (`/active`)
- **Stats Cards**:
  - Active Patents: `stats.activePatents`
  - Portfolio Value: `stats.portfolioValue`
  - New Alerts: `stats.unreadAlerts`
  - Maintenance Due: `stats.maintenanceDue`
- **Patent Cards**: `completedSessions` array

### Ideas (`/ideas`)
- **Stats Cards**:
  - Active Ideas: `stats.totalIdeas`
  - Being Monitored: `stats.monitoringIdeas`
  - Drafted: `stats.draftedIdeas`
  - New Alerts: `stats.unreadAlerts`
- **Idea Cards**: `ideas` array

### Drafts (`/drafts`)
- **Draft Cards**: `draftSessions` array

### Check (`/check`)
- **Subscription Status**: `subscription`
- **Free Searches**: `searchCredits.free_searches_remaining`

### Admin (`/admin`)
- **Total Sessions**: All sessions (admin access)

---

## ✅ Implementation Checklist

- [x] Create centralized `usePatentData` hook
- [x] Create data registry documentation
- [ ] Update Dashboard to show dynamic portfolio stats
- [ ] Update Pending to use centralized hook
- [ ] Update Active to use centralized hook
- [ ] Update Ideas to use centralized hook
- [ ] Update Drafts to use centralized hook
- [ ] Add real-time subscriptions for live updates

---

## 🔄 Real-time Updates

To enable real-time updates, subscribe to table changes:

```typescript
useEffect(() => {
  const channel = supabase
    .channel('patent-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'patent_sessions' }, refetch)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'infringement_alerts' }, refetch)
    .subscribe();
    
  return () => supabase.removeChannel(channel);
}, [refetch]);
```

---

*Last Updated: December 2, 2025*
