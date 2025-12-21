# PatentBot AI™ Dynamic Variable Registry

## Overview
This document maps **all dynamic variables** in the application to their canonical Supabase data sources and UI locations. All UI components MUST reference data through the centralized `usePatentData` hook to ensure consistency.

**Last Audited:** December 21, 2025

---

## 📊 Portfolio Statistics (Single Source of Truth)

All stats are computed in `src/hooks/usePatentData.ts` via the `PortfolioStats` interface:

| Variable | Supabase Source | Computation | UI Locations |
|----------|-----------------|-------------|--------------|
| `stats.totalApplications` | `patent_sessions` | `sessions.length` | Dashboard, Pending, Admin |
| `stats.completedApplications` | `patent_sessions` | `COUNT(*) WHERE status='completed'` | Dashboard, Pending |
| `stats.inProgressApplications` | `patent_sessions` | `COUNT(*) WHERE status='in_progress'` | Dashboard, Pending, Drafts |
| `stats.activePatents` | `patent_sessions` | `COUNT(*) WHERE status='completed'` | Dashboard, Active |
| `stats.totalIdeas` | `patent_ideas` | `ideas.length` | Dashboard, Ideas |
| `stats.monitoringIdeas` | `patent_ideas` | `COUNT(*) WHERE status='monitoring'` | Ideas |
| `stats.draftedIdeas` | `patent_ideas` | `COUNT(*) WHERE status='drafted'` | Ideas |
| `stats.highSimilarityCount` | `prior_art_results` | `COUNT(*) WHERE similarity_score > 0.7` | Pending, Session |
| `stats.unreadAlerts` | `infringement_alerts` | `COUNT(*) WHERE is_read=false` | Dashboard, Active, Ideas |
| `stats.portfolioValue` | Computed | `activePatents * $125,000` | Dashboard, Active |
| `stats.maintenanceDue` | Computed | Patents with maintenance near expiry | Active |

---

## 📁 Data Tables & Their UI Mappings

### `patent_sessions` - Primary patent applications
| Column | Type | UI Components |
|--------|------|---------------|
| `id` | UUID | All pages - primary key |
| `user_id` | UUID | Auth filter (RLS) |
| `idea_prompt` | TEXT | Dashboard cards, Pending list, Active list, Session detail, Admin table |
| `status` | TEXT | Stats computation, filtering, badges |
| `patent_type` | TEXT | Type badges (software/physical) |
| `patentability_score` | NUMERIC | Pending cards, Session detail |
| `download_url` | TEXT | Export buttons |
| `created_at` | TIMESTAMP | Date displays across all cards |
| `ai_analysis_complete` | BOOLEAN | Draft progress indicator |
| `data_source` | JSONB | Session workflow state |

### `patent_ideas` - Ideas Lab entries
| Column | Type | UI Components |
|--------|------|---------------|
| `id` | UUID | Ideas cards, IdeaDetail page |
| `user_id` | UUID | Auth filter (RLS) |
| `title` | TEXT | Ideas cards title |
| `description` | TEXT | Ideas cards description |
| `patent_type` | TEXT | Type badge |
| `status` | TEXT | Status badge (monitoring/drafted/abandoned) |
| `prior_art_monitoring` | BOOLEAN | Monitoring indicator |
| `last_monitored_at` | TIMESTAMP | Last check display |
| `created_at` | TIMESTAMP | Date displays |

### `prior_art_results` - Patent search results
| Column | Type | UI Components |
|--------|------|---------------|
| `id` | UUID | Result cards |
| `session_id` | UUID | Session linking |
| `title` | TEXT | Result card title |
| `similarity_score` | FLOAT | Stats, sorting, badges |
| `publication_number` | TEXT | Patent number display |
| `summary` | TEXT | Result card description |
| `overlap_claims` | TEXT[] | Claim chart component |
| `difference_claims` | TEXT[] | Claim chart component |
| `source` | TEXT | Source badge (USPTO/Lens) |
| `created_at` | TIMESTAMP | Date displays |

### `infringement_alerts` - Patent monitoring alerts
| Column | Type | UI Components |
|--------|------|---------------|
| `id` | UUID | Alert display |
| `patent_session_id` | UUID | Session linking |
| `patent_idea_id` | UUID | Idea linking |
| `alert_type` | TEXT | Alert categorization |
| `severity` | TEXT | Badge color (critical/high/medium/low) |
| `title` | TEXT | Alert title |
| `description` | TEXT | Alert description |
| `is_read` | BOOLEAN | Unread count computation |
| `created_at` | TIMESTAMP | Date displays |

### `subscriptions` - User subscription status
| Column | Type | UI Components |
|--------|------|---------------|
| `user_id` | UUID | Auth filter |
| `status` | TEXT | Access control (active/inactive) |
| `plan` | TEXT | Plan display (check_and_see) |
| `current_period_end` | TIMESTAMP | Expiry display |
| `stripe_subscription_id` | TEXT | Stripe integration |

### `user_search_credits` - Free search tracking
| Column | Type | UI Components |
|--------|------|---------------|
| `user_id` | UUID | Auth filter |
| `free_searches_remaining` | INT | Check page banner |
| `searches_used` | INT | Analytics |

### `profiles` - User profile data
| Column | Type | UI Components |
|--------|------|---------------|
| `user_id` | UUID | Auth filter |
| `display_name` | TEXT | Header avatar, Profile page |
| `full_name` | TEXT | Profile page |
| `company` | TEXT | Profile page |
| `avatar_url` | TEXT | UserAvatar component (global) |
| `bio` | TEXT | Profile page |

### `users` - Core user data
| Column | Type | UI Components |
|--------|------|---------------|
| `id` | UUID | Primary key |
| `email` | TEXT | Settings, Profile displays |
| `email_preferences` | JSONB | Settings toggles |
| `onboarding_completed_at` | TIMESTAMP | Welcome dialog control |

---

## 🔗 Centralized Data Hooks

### `usePatentData(userId)` - Portfolio data
```typescript
import { usePatentData } from '@/hooks/usePatentData';

const {
  // Raw data arrays
  sessions,           // All patent sessions
  ideas,              // All patent ideas
  priorArtBySession,  // Prior art grouped by session
  alertsBySession,    // Alerts grouped by session
  alertsByIdea,       // Alerts grouped by idea
  subscription,       // Active subscription
  searchCredits,      // Search credit balance
  
  // Filtered views
  draftSessions,      // status='in_progress'
  completedSessions,  // status='completed'
  pendingSessions,    // All sessions
  
  // Computed stats (SINGLE SOURCE OF TRUTH)
  stats: {
    totalApplications,
    completedApplications,
    inProgressApplications,
    activePatents,
    totalIdeas,
    monitoringIdeas,
    draftedIdeas,
    highSimilarityCount,
    unreadAlerts,
    portfolioValue,
    maintenanceDue,
  },
  
  // State
  loading,
  error,
  
  // Actions
  refetch,
  refetchSessions,
  refetchIdeas,
  refetchAlerts,
} = usePatentData(userId);
```

### `useAuthenticatedPatentData()` - With auth
```typescript
import { useAuthenticatedPatentData } from '@/hooks/usePatentData';

const { ...patentData, userId, isAuthenticated, authLoading } = useAuthenticatedPatentData();
```

### `usePatentSession(sessionId)` - Individual session
```typescript
import { usePatentSession } from '@/hooks/usePatentData';

const { session, priorArt, alerts, loading, refetch } = usePatentSession(sessionId);
```

### `useUserProfile()` - Profile data (global)
```typescript
import { useUserProfile } from '@/contexts/UserProfileContext';

const { user, profile, loading, updateProfile, uploadAvatar, refreshProfile } = useUserProfile();
```

---

## 🎯 UI Component → Data Source Mapping

### Dashboard (`/dashboard`)
| UI Element | Data Source | Variable |
|------------|-------------|----------|
| Applications count | `usePatentData` | `stats.totalApplications` |
| Active Patents count | `usePatentData` | `stats.activePatents` |
| Ideas count | `usePatentData` | `stats.totalIdeas` |
| Alerts count | `usePatentData` | `stats.unreadAlerts` |
| User avatar | `useUserProfile` | `profile.avatar_url` |
| Pricing cards | Static | `$1,000` / `$9.99` |

### Pending (`/pending`)
| UI Element | Data Source | Variable |
|------------|-------------|----------|
| Total Applications | `usePatentData` | `stats.totalApplications` |
| Completed count | `usePatentData` | `stats.completedApplications` |
| In Progress count | `usePatentData` | `stats.inProgressApplications` |
| High Similarity count | `usePatentData` | `stats.highSimilarityCount` |
| Session cards | `usePatentData` | `pendingSessions` |

### Active (`/active`)
| UI Element | Data Source | Variable |
|------------|-------------|----------|
| Active Patents | `usePatentData` | `stats.activePatents` |
| Portfolio Value | `usePatentData` | `stats.portfolioValue` |
| New Alerts | `usePatentData` | `stats.unreadAlerts` |
| Maintenance Due | Computed | Local calculation |
| Patent cards | `usePatentData` | `completedSessions` |

### Ideas (`/ideas`)
| UI Element | Data Source | Variable |
|------------|-------------|----------|
| Active Ideas | `usePatentData` | `stats.totalIdeas` |
| Being Monitored | `usePatentData` | `stats.monitoringIdeas` |
| Drafted | `usePatentData` | `stats.draftedIdeas` |
| New Alerts | `usePatentData` | `stats.unreadAlerts` |
| Idea cards | `usePatentData` | `ideas` |

### Drafts (`/drafts`)
| UI Element | Data Source | Variable |
|------------|-------------|----------|
| Draft cards | `useAuthenticatedPatentData` | `draftSessions` |
| Progress indicator | Computed | `currentStep / 7` |

### Check (`/check`)
| UI Element | Data Source | Variable |
|------------|-------------|----------|
| Subscription status | `useAuthenticatedPatentData` | `subscription.status` |
| Free searches | `useAuthenticatedPatentData` | `searchCredits.free_searches_remaining` |

### Profile (`/profile`)
| UI Element | Data Source | Variable |
|------------|-------------|----------|
| Avatar | `useUserProfile` | `profile.avatar_url` |
| Display name | `useUserProfile` | `profile.display_name` |
| Full name | `useUserProfile` | `profile.full_name` |
| Company | `useUserProfile` | `profile.company` |
| Bio | `useUserProfile` | `profile.bio` |

### Settings (`/settings`)
| UI Element | Data Source | Variable |
|------------|-------------|----------|
| Email | Supabase Auth | `user.email` |
| Email preferences | `users` table | `email_preferences` |

### Admin (`/admin`)
| UI Element | Data Source | Variable |
|------------|-------------|----------|
| Total Revenue | `payment_transactions` + `application_payments` | Computed sum |
| Active Subscriptions | `subscriptions` | `COUNT(*) WHERE status='active'` |
| All Sessions | `patent_sessions` | Admin-level query |
| User stats | `users` + `profiles` | Computed counts |

---

## 🔄 Real-time Subscriptions

The `usePatentData` hook subscribes to real-time updates:

```typescript
// Subscription changes (payments)
supabase.channel('subscription-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'application_payments' })
  .subscribe();
```

Session.tsx also has real-time payment status updates:
```typescript
supabase.channel(`payment-updates-${id}`)
  .on('postgres_changes', { event: 'UPDATE', table: 'application_payments', filter: `application_id=eq.${id}` })
  .subscribe();
```

---

## ✅ Audit Checklist

- [x] `usePatentData` hook - centralized data fetching
- [x] `useAuthenticatedPatentData` hook - auth + data combo
- [x] `usePatentSession` hook - individual session data
- [x] `useUserProfile` context - global profile state
- [x] Dashboard using centralized stats
- [x] Pending using centralized stats
- [x] Active using centralized stats
- [x] Ideas using centralized stats
- [x] Drafts using centralized data
- [x] Check using centralized subscription/credits
- [x] Profile using UserProfileContext
- [x] Settings using direct user queries
- [x] Admin using admin-level queries
- [x] Session using individual session hook
- [x] Real-time subscriptions for payments
- [x] Avatar displays globally via UserAvatar component

---

## 🚨 Important Notes

1. **Never duplicate stats calculations** - Always use `stats.*` from `usePatentData`
2. **Profile data is global** - Use `useUserProfile()` for avatar, display name
3. **Admin has separate queries** - Bypasses user-level RLS for admin views
4. **Session page is special** - Uses `usePatentSession` for individual session data
5. **Real-time enabled** - Payments and subscriptions update automatically

---

*Registry maintained for end-to-end data connectivity. Any update to Supabase data automatically reflects in all bound UI elements.*
