import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  UserPlus,
  Shield,
  Crown,
  RefreshCw,
  Gift,
  XCircle,
  FileText,
} from 'lucide-react';

interface UserRow {
  id: string;
  email: string | null;
  created_at: string | null;
  role?: string;
  subscription_status?: string;
  subscription_plan?: string;
  is_free_grant?: boolean;
}

interface SessionOption {
  id: string;
  idea_prompt: string | null;
  status: string | null;
  created_at: string;
  paid: boolean;
}

const PAGE_SIZE = 25;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Grant dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserType, setNewUserType] = useState<'free_patent' | 'free_subscription' | 'admin'>('free_subscription');
  const [creating, setCreating] = useState(false);

  // Free-patent picker (choose which application to unlock)
  const [patentTarget, setPatentTarget] = useState<{ id: string; email: string | null } | null>(null);
  const [patentSessions, setPatentSessions] = useState<SessionOption[]>([]);
  const [patentSessionsLoading, setPatentSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [grantingPatent, setGrantingPatent] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filterRole]);

  /** Server-side paginated user list; roles/subscriptions are fetched only for the visible page. */
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('users')
        .select('id, email, created_at', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (debouncedSearch) {
        query = UUID_RE.test(debouncedSearch)
          ? query.eq('id', debouncedSearch)
          : query.ilike('email', `%${debouncedSearch.replace(/[%_]/g, '')}%`);
      }

      // Role / subscription filters resolve to a set of user ids first
      if (filterRole !== 'all') {
        let ids: string[] = [];
        if (filterRole === 'admin') {
          const { data, error } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
          if (error) throw error;
          ids = (data || []).map((r) => r.user_id);
        } else {
          let subQuery = supabase.from('subscriptions').select('user_id');
          subQuery = filterRole === 'free_grant'
            ? subQuery.eq('plan', 'free_grant').eq('status', 'active')
            : subQuery.eq('status', 'active');
          const { data, error } = await subQuery;
          if (error) throw error;
          ids = (data || []).map((r) => r.user_id);
        }

        if (filterRole === 'inactive') {
          if (ids.length > 0) query = query.not('id', 'in', `(${ids.join(',')})`);
        } else {
          if (ids.length === 0) {
            setUsers([]);
            setTotal(0);
            return;
          }
          query = query.in('id', ids);
        }
      }

      const from = page * PAGE_SIZE;
      const { data: usersData, error: usersError, count } = await query.range(from, from + PAGE_SIZE - 1);
      if (usersError) throw usersError;

      const pageIds = (usersData || []).map((u) => u.id);
      const [{ data: rolesData }, { data: subsData }] = pageIds.length
        ? await Promise.all([
            supabase.from('user_roles').select('user_id, role').in('user_id', pageIds),
            supabase.from('subscriptions').select('user_id, status, plan').in('user_id', pageIds),
          ])
        : [{ data: [] as { user_id: string; role: string }[] }, { data: [] as { user_id: string; status: string; plan: string }[] }];

      const combinedUsers: UserRow[] = (usersData || []).map((user) => {
        const isAdmin = rolesData?.some((r) => r.user_id === user.id && r.role === 'admin');
        const userSub = subsData?.find((s) => s.user_id === user.id);
        return {
          ...user,
          role: isAdmin ? 'admin' : 'user',
          subscription_status: userSub?.status || 'inactive',
          subscription_plan: userSub?.plan || 'free',
          is_free_grant: userSub?.plan === 'free_grant' && userSub?.status === 'active',
        };
      });

      setUsers(combinedUsers);
      setTotal(count ?? 0);
    } catch (error: any) {
      toast({
        title: 'Error loading users',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterRole, page, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const grantFreeSubscription = async (userId: string) => {
    try {
      // subscriptions has UNIQUE(user_id) - a single atomic upsert
      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          plan: 'free_grant',
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        }, { onConflict: 'user_id' });
      if (error) throw error;

      toast({ title: 'Access Granted', description: 'Free Check & See subscription granted for 1 year' });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error granting access', description: error.message, variant: 'destructive' });
    }
  };

  /** Opens the application picker for a free patent grant. */
  const openPatentGrant = async (userId: string, email: string | null) => {
    setPatentTarget({ id: userId, email });
    setSelectedSessionId('');
    setPatentSessions([]);
    setPatentSessionsLoading(true);
    try {
      const { data: sessions, error } = await supabase
        .from('patent_sessions')
        .select('id, idea_prompt, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const ids = (sessions || []).map((s) => s.id);
      const { data: payments } = ids.length
        ? await supabase.from('application_payments').select('application_id, status').in('application_id', ids)
        : { data: [] as { application_id: string | null; status: string }[] };
      const paidIds = new Set((payments || []).filter((p) => p.status === 'completed').map((p) => p.application_id));

      const options = (sessions || []).map((s) => ({ ...s, paid: paidIds.has(s.id) }));
      setPatentSessions(options);
      const firstUnpaid = options.find((o) => !o.paid);
      if (firstUnpaid) setSelectedSessionId(firstUnpaid.id);
    } catch (error: any) {
      toast({ title: 'Error loading applications', description: error.message, variant: 'destructive' });
    } finally {
      setPatentSessionsLoading(false);
    }
  };

  const grantFreePatent = async () => {
    if (!patentTarget || !selectedSessionId) return;
    const option = patentSessions.find((s) => s.id === selectedSessionId);
    if (option?.paid) {
      toast({ title: 'Already unlocked', description: 'This application already has a completed payment.' });
      return;
    }
    setGrantingPatent(true);
    try {
      // application_payments has UNIQUE(application_id); export/filing look it up by application_id
      const { error } = await supabase
        .from('application_payments')
        .upsert({
          application_id: selectedSessionId,
          user_id: patentTarget.id,
          amount: 0,
          status: 'completed',
          currency: 'usd',
          stripe_payment_id: `admin_grant_${Date.now()}`,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'application_id' });
      if (error) throw error;

      toast({ title: 'Application unlocked', description: 'Free patent application granted.' });
      setPatentTarget(null);
    } catch (error: any) {
      toast({ title: 'Error granting application', description: error.message, variant: 'destructive' });
    } finally {
      setGrantingPatent(false);
    }
  };

  const revokeAccess = async (userId: string) => {
    if (!confirm('Revoke this free grant?')) return;
    try {
      // Only revoke admin-granted access - never touch a paying Stripe subscription
      const { data, error } = await supabase
        .from('subscriptions')
        .update({ status: 'canceled', current_period_end: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('plan', 'free_grant')
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No free grant found for this user.');

      toast({ title: 'Access Revoked', description: 'Free grant has been revoked' });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error revoking access', description: error.message, variant: 'destructive' });
    }
  };

  const toggleAdminRole = async (userId: string, isCurrentlyAdmin: boolean) => {
    if (isCurrentlyAdmin && userId === currentUserId) {
      toast({ title: 'Not allowed', description: "You can't remove your own admin role.", variant: 'destructive' });
      return;
    }
    if (isCurrentlyAdmin && !confirm('Remove admin role from this user?')) return;
    try {
      if (isCurrentlyAdmin) {
        const { data, error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin')
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Role was not removed (permission denied).');
      } else {
        const { error } = await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role', ignoreDuplicates: true });
        if (error) throw error;
      }

      toast({
        title: isCurrentlyAdmin ? 'Admin Removed' : 'Admin Added',
        description: `User ${isCurrentlyAdmin ? 'is no longer' : 'is now'} an admin`,
      });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error updating role', description: error.message, variant: 'destructive' });
    }
  };

  const getRoleBadge = (user: UserRow) => {
    if (user.role === 'admin') {
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
    }
    if (user.is_free_grant) {
      return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20"><Gift className="h-3 w-3 mr-1" />Free Grant</Badge>;
    }
    if (user.subscription_status === 'active') {
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><Crown className="h-3 w-3 mr-1" />Subscriber</Badge>;
    }
    return <Badge variant="outline">Free</Badge>;
  };

  const handleDialogGrant = async () => {
    setCreating(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', newUserEmail.trim().toLowerCase())
        .maybeSingle();

      if (userError || !userData) {
        throw new Error('User not found. They must create an account first.');
      }

      setShowCreateDialog(false);
      setNewUserEmail('');

      if (newUserType === 'admin') {
        await toggleAdminRole(userData.id, false);
      } else if (newUserType === 'free_subscription') {
        await grantFreeSubscription(userData.id);
      } else {
        await openPatentGrant(userData.id, userData.email);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const pageStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage users, grant free access, and control admin roles
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} aria-label="Refresh users">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Grant Access
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Grant Free Access</DialogTitle>
                  <DialogDescription>
                    Grant free access to a user by their email. They must already have an account.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    type="email"
                    placeholder="User email address"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                  <Select value={newUserType} onValueChange={(v: any) => setNewUserType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free_subscription">Free Subscription (Check & See)</SelectItem>
                      <SelectItem value="free_patent">Free Patent Application</SelectItem>
                      <SelectItem value="admin">Make Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full"
                    disabled={!newUserEmail.trim() || creating}
                    onClick={handleDialogGrant}
                  >
                    {creating ? 'Processing...' : newUserType === 'free_patent' ? 'Choose Application…' : 'Grant Access'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
          <div className="flex-1">
            <Input
              placeholder="Search by email or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="free_grant">Free Grants</SelectItem>
              <SelectItem value="active">Active Subscribers</SelectItem>
              <SelectItem value="inactive">Free Users</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users list */}
        <div className="space-y-2">
          {loading && users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user.email || 'No email'}</div>
                  <div className="text-xs text-muted-foreground">
                    Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                  {getRoleBadge(user)}

                  {user.role !== 'admin' && !user.is_free_grant && user.subscription_status !== 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => grantFreeSubscription(user.id)}
                      title="Grant free subscription"
                      aria-label="Grant free subscription"
                    >
                      <Gift className="h-4 w-4 text-purple-500" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openPatentGrant(user.id, user.email)}
                    title="Grant free patent application"
                    aria-label="Grant free patent application"
                  >
                    <FileText className="h-4 w-4 text-primary" />
                  </Button>

                  {user.is_free_grant && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeAccess(user.id)}
                      title="Revoke free grant"
                      aria-label="Revoke free grant"
                    >
                      <XCircle className="h-4 w-4 text-red-500" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAdminRole(user.id, user.role === 'admin')}
                    title={user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                    aria-label={user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  >
                    <Shield className={`h-4 w-4 ${user.role === 'admin' ? 'text-red-500' : 'text-muted-foreground'}`} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {pageStart}–{pageEnd} of {total} users
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={pageEnd >= total || loading} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Free patent application picker */}
      <Dialog open={!!patentTarget} onOpenChange={(open) => { if (!open) setPatentTarget(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Grant Free Patent Application</DialogTitle>
            <DialogDescription>
              Choose which of {patentTarget?.email || 'this user'}'s applications to unlock at no charge.
            </DialogDescription>
          </DialogHeader>
          {patentSessionsLoading ? (
            <div className="text-center py-6 text-muted-foreground">Loading applications...</div>
          ) : patentSessions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              This user has no patent applications yet. Ask them to start one first.
            </div>
          ) : (
            <div className="space-y-4">
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an application" />
                </SelectTrigger>
                <SelectContent>
                  {patentSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id} disabled={s.paid}>
                      {(s.idea_prompt || 'Untitled application').slice(0, 60)}
                      {s.paid ? ' (already unlocked)' : ` · ${s.status || 'draft'}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full" disabled={!selectedSessionId || grantingPatent} onClick={grantFreePatent}>
                {grantingPatent ? 'Granting...' : 'Unlock Application'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdminUserManagement;
