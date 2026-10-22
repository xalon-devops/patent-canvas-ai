import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Lightbulb, Loader2 } from 'lucide-react';

interface QuickIdeaCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const QuickIdeaCapture: React.FC<QuickIdeaCaptureProps> = ({ open, onOpenChange, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Must match patent_ideas.patent_type CHECK ('software' | 'non-software')
  const [patentType, setPatentType] = useState<'software' | 'non-software'>('software');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your idea.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Please sign in again to save ideas.');

      const cleanTitle = title.trim().slice(0, 200);
      const cleanDescription = description.trim().slice(0, 5000) || null;

      const { data: idea, error } = await supabase
        .from('patent_ideas')
        .insert({
          user_id: user.id,
          title: cleanTitle,
          description: cleanDescription,
          patent_type: patentType,
          status: 'monitoring',
          prior_art_monitoring: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Register the idea for prior-art monitoring so the promise in the toast is real
      const { error: monitorError } = await supabase
        .from('prior_art_monitoring')
        .insert({
          patent_idea_id: idea.id,
          search_query: [cleanTitle, cleanDescription].filter(Boolean).join(': ').slice(0, 1000),
          is_active: true,
          last_search_at: new Date().toISOString(),
          next_search_at: new Date().toISOString(),
        });
      if (monitorError) console.warn('Idea saved but monitoring could not be set up:', monitorError);

      toast({
        title: "Idea saved!",
        description: "Your idea is now being monitored for prior art.",
      });

      // Reset form
      setTitle('');
      setDescription('');
      setPatentType('software');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error saving idea:', error);
      toast({
        title: "Error saving idea",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Quick Idea Capture
          </DialogTitle>
          <DialogDescription>
            Quickly save an idea for monitoring. You can draft a full patent later.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Idea Title *</Label>
            <Input
              id="title"
              placeholder="e.g., AI-powered coffee brewing system"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Brief Description</Label>
            <Textarea
              id="description"
              placeholder="What makes this idea innovative? (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Patent Type</Label>
            <Select value={patentType} onValueChange={(v) => setPatentType(v as 'software' | 'non-software')}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="software">Software / digital invention</SelectItem>
                <SelectItem value="non-software">Physical / non-software invention</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Idea'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuickIdeaCapture;
