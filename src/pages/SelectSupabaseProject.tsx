import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Database, Building2, MapPin } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Project {
  id: string;
  name: string;
  ref: string;
  region: string;
  organization_id: string;
}

const SelectSupabaseProject = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [connectionId, setConnectionId] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/auth');
        return;
      }

      const error = searchParams.get('error');
      if (error) {
        toast({
          title: 'Connection Error',
          description: decodeURIComponent(error),
          variant: 'destructive',
        });
        navigate('/new-application');
        return;
      }

      await loadOrganizations();
    };

    init();
  }, [navigate, searchParams]);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      console.log('[SELECT-PROJECT] Fetching organizations...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      // Look for ANY recent connection (pending, active, or inactive) - the latest one has the fresh token
      const { data: connCheck } = await supabase
        .from('supabase_connections')
        .select('id, connection_status, created_at, access_token')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      console.log('[SELECT-PROJECT] Connection check:', connCheck);
      
      if (!connCheck) {
        throw new Error('No Supabase connection found. Please connect via OAuth first.');
      }
      
      // If status is inactive or error, the token may be stale - prompt re-auth
      if (connCheck.connection_status === 'error') {
        throw new Error('Previous connection failed. Please restart the OAuth flow.');
      }
      
      // Accept pending, active, or inactive (user may be switching projects)
      // The access_token should still be valid if within expiry window

      // Store the connection ID for later
      setConnectionId(connCheck.id);

      const { data, error } = await supabase.functions.invoke('get-supabase-organizations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      console.log('[SELECT-PROJECT] Organizations loaded:', data.organizations?.length);
      
      setOrganizations(data.organizations || []);
      // Also update connectionId from response if provided
      if (data.connectionId) {
        setConnectionId(data.connectionId);
      }
      
      if (data.organizations?.length === 1) {
        // Auto-select if only one org
        setSelectedOrg(data.organizations[0].id);
        await loadProjectsForOrg(data.organizations[0].id);
      }
    } catch (error: any) {
      console.error('Error loading organizations:', error);
      toast({
        title: 'Error Loading Organizations',
        description: error.message,
        variant: 'destructive',
      });
      // Give user option to retry instead of auto-redirecting
      setTimeout(() => {
        if (confirm('Would you like to restart the Supabase connection process?')) {
          navigate('/new-application');
        }
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectsForOrg = async (orgId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-supabase-projects', {
        body: { organizationId: orgId },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      setProjects(data.projects || []);
    } catch (error: any) {
      console.error('Error loading projects:', error);
      toast({
        title: 'Error Loading Projects',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOrgChange = async (orgId: string) => {
    setSelectedOrg(orgId);
    setSelectedProject('');
    setProjects([]);
    await loadProjectsForOrg(orgId);
  };

  const handleFinalize = async () => {
    if (!selectedOrg || !selectedProject) {
      toast({
        title: 'Selection Required',
        description: 'Please select both an organization and a project.',
        variant: 'destructive',
      });
      return;
    }

    setFinalizing(true);
    try {
      const selectedProjectData = projects.find(p => p.id === selectedProject);
      
      const { data, error } = await supabase.functions.invoke('finalize-supabase-connection', {
        body: {
          connectionId,
          organizationId: selectedOrg,
          projectId: selectedProject,
          projectRef: selectedProjectData?.ref,
          projectName: selectedProjectData?.name,
          projectRegion: selectedProjectData?.region,
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: '✅ Supabase Connected!',
        description: `Successfully connected to ${selectedProjectData?.name}`,
      });

      navigate('/new-application');
    } catch (error: any) {
      console.error('Error finalizing connection:', error);
      toast({
        title: 'Connection Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setFinalizing(false);
    }
  };

  if (loading && organizations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Select Supabase Project
            </CardTitle>
            <CardDescription>
              Choose which organization and project you want to connect
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Organization Selector */}
            <div className="space-y-2">
              <Label htmlFor="organization" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organization
              </Label>
              <Select
                value={selectedOrg}
                onValueChange={handleOrgChange}
                disabled={organizations.length === 1}
              >
                <SelectTrigger id="organization">
                  <SelectValue placeholder="Select an organization..." />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Selector */}
            {selectedOrg && (
              <div className="space-y-2">
                <Label htmlFor="project" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Project
                </Label>
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading projects...
                  </div>
                ) : (
                  <Select
                    value={selectedProject}
                    onValueChange={setSelectedProject}
                  >
                    <SelectTrigger id="project">
                      <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex flex-col">
                            <span>{project.name}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {project.region}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate('/new-application')}
                disabled={finalizing}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleFinalize}
                disabled={!selectedOrg || !selectedProject || finalizing}
                className="flex-1"
              >
                {finalizing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Project'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SelectSupabaseProject;
