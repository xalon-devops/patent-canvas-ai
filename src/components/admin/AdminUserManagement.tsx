import React, { useState, useEffect } from 'react';
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
  Search,
  RefreshCw,
  Trash2,
  Gift,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  role?: string;
  subscription_status?: string;
  subscription_plan?: string;
  is_free_grant?: boolean;
}

export const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserType, setNewUserType] = useState<'free_patent' | 'free_subscription' | 'admin'>('free_subscription');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch users with their roles and subscriptions
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (usersError) throw usersError;

      // Fetch roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Fetch subscriptions
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('user_id, status, plan');

      // Combine data
      const combinedUsers = (usersData || []).map(user => {
        const userRole = rolesData?.find(r => r.user_id === user.id);
        const userSub = subsData?.find(s => s.user_id === user.id);
        
        return {
          ...user,
          role: userRole?.role || 'user',
          subscription_status: userSub?.status || 'inactive',
          subscription_plan: userSub?.plan || 'free',
          is_free_grant: userSub?.plan === 'free_grant'
        };
      });

      setUsers(combinedUsers);
    } catch (error: any) {
      toast({
        title: 'Error loading users',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const grantFreeAccess = async (userId: string, accessType: 'subscription' | 'patent') => {
    try {
      if (accessType === 'subscription') {
        // Check if subscription exists
        const { data: existing } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existing) {
          // Update existing subscription
          const { error } = await supabase
            .from('subscriptions')
            .update({ 
              plan: 'free_grant', 
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
            })
            .eq('user_id', userId);
          if (error) throw error;
        } else {
          // Insert new subscription
          const { error } = await supabase
            .from('subscriptions')
            .insert({ 
              user_id: userId, 
              plan: 'free_grant', 
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            });
          if (error) throw error;
        }
      } else {
        // Grant free patent application via application_payments
        const { error } = await supabase
          .from('application_payments')
          .insert({
            user_id: userId,
            amount: 0,
            status: 'completed',
            currency: 'usd',
            stripe_payment_id: 'admin_grant_' + Date.now()
          });
        if (error) throw error;
      }

      toast({
        title: 'Access Granted',
        description: `Free ${accessType} access granted successfully`,
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error granting access',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const revokeAccess = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', plan: 'free' })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Access Revoked',
        description: 'User access has been revoked',
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error revoking access',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const toggleAdminRole = async (userId: string, isCurrentlyAdmin: boolean) => {
    try {
      if (isCurrentlyAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');
        if (error) throw error;
      } else {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });
        if (error) throw error;
      }

      toast({
        title: isCurrentlyAdmin ? 'Admin Removed' : 'Admin Added',
        description: `User ${isCurrentlyAdmin ? 'is no longer' : 'is now'} an admin`,
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error updating role',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterRole === 'all' ||
      (filterRole === 'admin' && user.role === 'admin') ||
      (filterRole === 'free_grant' && user.is_free_grant) ||
      (filterRole === 'active' && user.subscription_status === 'active') ||
      (filterRole === 'inactive' && user.subscription_status !== 'active');

    return matchesSearch && matchesFilter;
  });

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
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
            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Grant Access
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Grant Free Access</DialogTitle>
                  <DialogDescription>
                    Grant free access to a user by their email. They must already have an account.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
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
                    disabled={!newUserEmail || creating}
                    onClick={async () => {
                      setCreating(true);
                      try {
                        // Find user by email
                        const { data: userData, error: userError } = await supabase
                          .from('users')
                          .select('id')
                          .eq('email', newUserEmail.trim().toLowerCase())
                          .maybeSingle();

                        if (userError || !userData) {
                          throw new Error('User not found. They must create an account first.');
                        }

                        if (newUserType === 'admin') {
                          await toggleAdminRole(userData.id, false);
                        } else {
                          await grantFreeAccess(userData.id, newUserType === 'free_subscription' ? 'subscription' : 'patent');
                        }

                        setShowCreateDialog(false);
                        setNewUserEmail('');
                      } catch (error: any) {
                        toast({
                          title: 'Error',
                          description: error.message,
                          variant: 'destructive'
                        });
                      } finally {
                        setCreating(false);
                      }
                    }}
                  >
                    {creating ? 'Processing...' : 'Grant Access'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Input
              placeholder="Search by email or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-48">
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

        {/* Users Table */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            filteredUsers.slice(0, 50).map((user) => (
              <div 
                key={user.id} 
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user.email || 'No email'}</div>
                  <div className="text-xs text-muted-foreground">
                    Joined {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getRoleBadge(user)}
                  
                  {/* Action buttons */}
                  {user.role !== 'admin' && !user.is_free_grant && user.subscription_status !== 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => grantFreeAccess(user.id, 'subscription')}
                      title="Grant free subscription"
                    >
                      <Gift className="h-4 w-4 text-purple-500" />
                    </Button>
                  )}
                  
                  {user.is_free_grant && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeAccess(user.id)}
                      title="Revoke access"
                    >
                      <XCircle className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAdminRole(user.id, user.role === 'admin')}
                    title={user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  >
                    <Shield className={`h-4 w-4 ${user.role === 'admin' ? 'text-red-500' : 'text-muted-foreground'}`} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {filteredUsers.length > 50 && (
          <div className="text-center text-sm text-muted-foreground mt-4">
            Showing 50 of {filteredUsers.length} users
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminUserManagement;
