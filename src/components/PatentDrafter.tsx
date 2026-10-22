import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getEdgeErrorMessage } from '@/lib/edgeError';
import DOMPurify from 'dompurify';
import { 
  FileText, 
  Edit, 
  CheckCircle,
  Loader2,
  Save,
  Download,
  Eye,
  RefreshCw,
  Brain,
  Sparkles,
  FileCheck,
  ArrowRight,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PaymentGateDialog } from './PaymentGateDialog';

interface PatentSection {
  id: string;
  section_type: string;
  content: string;
  is_user_edited: boolean;
  created_at: string;
}

interface PatentDrafterProps {
  sessionId: string;
  onComplete: () => void;
}

// Clean patent content by removing markdown artifacts and ensuring proper paragraph formatting
const cleanPatentContent = (content: string): string => {
  if (!content) return '';
  
  return content
    // Remove markdown code blocks (```html, ```, etc.)
    .replace(/```(?:html|markdown|text)?\s*/gi, '')
    .replace(/```\s*/g, '')
    // Trim whitespace
    .trim();
};

const PatentDrafter: React.FC<PatentDrafterProps> = ({ 
  sessionId, 
  onComplete 
}) => {
  const [sections, setSections] = useState<PatentSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [redrafting, setRedrafting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Keys must match the patent_sections.section_type CHECK constraint
  const sectionConfig = {
    'abstract': { name: 'Abstract', icon: FileText, order: 1, required: true },
    'field': { name: 'Field of the Invention', icon: FileText, order: 2, required: true },
    'background': { name: 'Background', icon: FileText, order: 3, required: true },
    'summary': { name: 'Summary', icon: FileText, order: 4, required: true },
    'drawings': { name: 'Drawings', icon: ImageIcon, order: 5, required: false },
    'description': { name: 'Detailed Description', icon: FileText, order: 6, required: true },
    'claims': { name: 'Claims', icon: FileCheck, order: 7, required: true },
  };

  const fetchSections = async (): Promise<PatentSection[]> => {
    const { data, error: fetchError } = await supabase
      .from('patent_sections')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (fetchError) throw fetchError;
    return (data || []) as PatentSection[];
  };

  useEffect(() => {
    // Reuse an existing draft (e.g. resumed application) instead of regenerating and overwriting edits
    let cancelled = false;
    (async () => {
      try {
        const existing = await fetchSections();
        if (cancelled) return;
        if (existing.length > 0) {
          setSections(existing);
          setLoading(false);
          setGenerating(false);
          return;
        }
      } catch (e) {
        console.error('Error loading existing sections:', e);
      }
      if (!cancelled) generatePatentDraft();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const generatePatentDraft = async () => {
    setGenerating(true);
    setLoading(true);
    setProgress(0);
    setError(null);
    // Simulate progress updates with timeout protection
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 5, 85));
    }, 800);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      // Add timeout promise (180 seconds for complex AI generation)
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Patent generation timeout - this is taking longer than expected')), 180000);
      });

      // Call the enhanced patent draft generation function with timeout
      const generationPromise = supabase.functions.invoke('generate-patent-draft-enhanced', {
        body: {
          session_id: sessionId
        }
      });

      const { data, error } = await Promise.race([
        generationPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('Patent generation error:', error);
        throw new Error((await getEdgeErrorMessage(error, 'Failed to generate patent draft')).message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to generate patent draft');
      }

      setProgress(90);

      // Fetch the actual generated sections from the database
      const sectionsData = await fetchSections();

      if (sectionsData.length === 0) {
        throw new Error('No patent sections were generated. Please try again.');
      }

      setProgress(100);

      setSections(sectionsData);
      
      toast({
        title: "✅ Patent Draft Generated!",
        description: `Created ${sectionsData.length} sections successfully`,
      });
      
    } catch (error: any) {
      console.error('Error generating draft:', error);
      
      // Provide specific error messages
      let errorMessage = 'Failed to generate patent draft. ';
      if (error.message?.includes('timeout')) {
        errorMessage += 'The generation is taking longer than expected. Please try again.';
      } else if (error.message?.includes('rate limit')) {
        errorMessage += 'AI rate limit reached. Please wait a moment and try again.';
      } else if (error.message?.includes('payment')) {
        errorMessage += 'Payment required to generate patent drafts.';
      } else {
        errorMessage += error.message || 'Please check your connection and try again.';
      }
      
      setError(errorMessage);
      
      toast({
        title: "Error generating draft",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      clearInterval(progressInterval);
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
      setGenerating(false);
    }
  };

  const handleEditSection = (sectionId: string, content: string) => {
    setEditingSection(sectionId);
    setEditContent(content);
  };

  const handleSaveEdit = async (sectionId: string) => {
    try {
      const { error } = await supabase
        .from('patent_sections')
        .update({ 
          content: editContent,
          is_user_edited: true 
        })
        .eq('id', sectionId);

      if (error) throw error;

      setSections(prev => prev.map(section => 
        section.id === sectionId 
          ? { ...section, content: editContent, is_user_edited: true }
          : section
      ));

      setEditingSection(null);
      setEditContent('');

      toast({
        title: "Section updated",
        description: "Your changes have been saved.",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Error saving changes",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRegenerateSection = async (sectionType: string) => {
    setRegeneratingSection(sectionType);
    try {
      // Use enhance-patent-section function
      const { data, error } = await supabase.functions.invoke('enhance-patent-section', {
        body: {
          session_id: sessionId,
          section_type: sectionType
        }
      });

      if (error) throw new Error((await getEdgeErrorMessage(error, 'Failed to regenerate section')).message);
      if (data && data.success === false) throw new Error(data.error || 'Failed to regenerate section');

      // Fetch the updated section from the database
      const { data: updatedSection, error: fetchError } = await supabase
        .from('patent_sections')
        .select('*')
        .eq('session_id', sessionId)
        .eq('section_type', sectionType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!updatedSection) {
        throw new Error('Failed to retrieve regenerated section');
      }
      
      setSections(prev => prev.map(section => 
        section.section_type === sectionType 
          ? { ...updatedSection, is_user_edited: false }
          : section
      ));

      toast({
        title: "Section regenerated",
        description: "The section has been updated with new AI-generated content.",
        variant: "default",
      });
    } catch (error: any) {
      console.error('Error regenerating section:', error);
      toast({
        title: "Error regenerating section",
        description: error.message || 'Failed to regenerate section',
        variant: "destructive",
      });
    } finally {
      setRegeneratingSection(null);
    }
  };

  const handleRedraftAll = async () => {
    if (sections.some(s => s.is_user_edited) &&
        !window.confirm('Redrafting will replace all sections, including your manual edits. Continue?')) {
      return;
    }
    setRedrafting(true);
    setProgress(0);
    // Start progress simulation
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 500);
    try {
      // The draft function updates sections in place, so the existing draft is kept if generation fails
      const { data, error } = await supabase.functions.invoke('generate-patent-draft-enhanced', {
        body: {
          session_id: sessionId
        }
      });

      if (error) throw new Error((await getEdgeErrorMessage(error, 'Failed to redraft patent application')).message);
      if (data && data.success === false) throw new Error(data.error || 'Failed to redraft patent application');
      setProgress(100);

      // Fetch the newly generated sections from the database
      const sectionsData = await fetchSections();

      if (sectionsData.length === 0) {
        throw new Error('No patent sections were generated. Please try again.');
      }

      setSections(sectionsData);

      toast({
        title: "Draft regenerated successfully!",
        description: "Your patent application has been completely redrafted with fresh AI analysis.",
        variant: "default",
      });
    } catch (error: any) {
      console.error('Error redrafting:', error);
      toast({
        title: "Error redrafting application",
        description: error.message || 'Failed to redraft patent application',
        variant: "destructive",
      });
    } finally {
      clearInterval(progressInterval);
      setRedrafting(false);
      setProgress(0);
    }
  };

  const handleExportDraft = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-patent', {
        body: { session_id: sessionId }
      });

      if (error) {
        // FunctionsHttpError.message is generic - read the status/body to detect the paywall
        const parsed = await getEdgeErrorMessage(error, 'Failed to export patent application');
        if (parsed.status === 402 || parsed.requiresSubscription) {
          setShowPaymentDialog(true);
          return;
        }
        throw new Error(parsed.message);
      }

      if (!data?.success || !data.download_url) {
        throw new Error(data?.error || 'Export failed');
      }

      // Download the file (signed URL - navigate directly so popup blockers don't interfere)
      window.location.assign(data.download_url);

      toast({
        title: "Export successful!",
        description: "Your patent application has been exported.",
        variant: "default",
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: error.message || 'Failed to export patent application',
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      // Update patent session status
      const { error } = await supabase
        .from('patent_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Draft saved successfully!",
        description: "Your patent application draft is ready for review.",
        variant: "default",
      });

      onComplete();
    } catch (error: any) {
      toast({
        title: "Error saving draft",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const getSectionProgress = () => {
    const totalSections = Object.keys(sectionConfig).length;
    const completedSections = sections.filter(s => s.section_type in sectionConfig && s.content).length;
    return Math.min(100, (completedSections / totalSections) * 100);
  };

  if (loading || redrafting) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 p-4 sm:p-6"
      >
        <div className="flex items-center justify-center gap-3">
          <Brain className="w-8 h-8 text-primary animate-pulse" />
          <Sparkles className="w-6 h-6 text-primary/60 animate-bounce" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-semibold">
            {redrafting ? 'Redrafting Your Patent Application...' : 'Drafting Your Patent Application...'}
          </h3>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
            {redrafting 
              ? 'AI is regenerating all patent sections with fresh analysis'
              : 'AI is generating professional patent sections based on your invention'
            }
          </p>
        </div>
        <div className="space-y-3 max-w-md mx-auto">
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <motion.div 
              className="h-full bg-primary rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">
            {progress < 30 ? 'Analyzing your invention details...' :
             progress < 60 ? 'Generating patent claims...' :
             progress < 90 ? 'Creating detailed descriptions...' :
             'Finalizing patent sections...'}
          </div>
        </div>
      </motion.div>
    );
  }

  // Show error state with retry button
  if (error && sections.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 p-4 sm:p-6"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="p-4 bg-destructive/10 rounded-full">
            <FileText className="w-8 h-8 text-destructive" />
          </div>
        </div>
        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-lg sm:text-xl font-semibold">Generation Failed</h3>
          <p className="text-sm sm:text-base text-muted-foreground">
            {error}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
          <Button
            onClick={() => generatePatentDraft()}
            variant="default"
            className="w-full sm:w-auto"
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </>
            )}
          </Button>
          <Button
            onClick={() => navigate(`/session/${sessionId}`)}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Open Patent Canvas
          </Button>
        </div>
      </motion.div>
    );
  }

  const sortedSections = [...sections].sort((a, b) => 
    (sectionConfig[a.section_type as keyof typeof sectionConfig]?.order || 999) - 
    (sectionConfig[b.section_type as keyof typeof sectionConfig]?.order || 999)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <FileText className="w-8 h-8 text-primary" />
          <Brain className="w-6 h-6 text-primary/70" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Patent Application Drafter</h2>
        <p className="text-muted-foreground">
          Review and edit your AI-generated patent application sections
        </p>
      </div>

      {/* Progress Overview with Redraft Button */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold">Draft Progress</h3>
            <div className="flex items-center gap-3">
              <Badge className="bg-primary">
                {sections.filter(s => s.section_type in sectionConfig && s.content).length}/{Object.keys(sectionConfig).length} sections
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedraftAll}
                disabled={redrafting}
                className="border-primary/30 hover:bg-primary/10"
              >
                {redrafting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Redrafting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Redraft All
                  </>
                )}
              </Button>
            </div>
          </div>
          <Progress value={getSectionProgress()} className="h-2" />
        </CardContent>
      </Card>

      {/* Patent Sections */}
      <div className="space-y-6">
        {sortedSections.map((section, index) => {
          const config = sectionConfig[section.section_type as keyof typeof sectionConfig];
          const IconComponent = config?.icon || FileText;
          const isEditing = editingSection === section.id;
          const isRegenerating = regeneratingSection === section.section_type;
          // Drawings are stored as structured JSON (figures + images) - not editable/regenerable as text
          const isDrawings = section.section_type === 'drawings';

          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <IconComponent className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {config?.name || section.section_type}
                        </CardTitle>
                        {section.is_user_edited && (
                          <Badge variant="outline" className="text-xs">
                            User Edited
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Edit section"
                        onClick={() => handleEditSection(section.id, section.content)}
                        disabled={isEditing || isDrawings}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Regenerate section"
                        onClick={() => handleRegenerateSection(section.section_type)}
                        disabled={isRegenerating || isEditing || isDrawings || regeneratingSection !== null}
                      >
                        {isRegenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-4">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[200px] font-mono text-sm"
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleSaveEdit(section.id)}
                          className="gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Save Changes
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setEditingSection(null);
                            setEditContent('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : section.section_type === 'drawings' ? (
                    <div className="space-y-6">
                      {(() => {
                        try {
                          const diagrams = JSON.parse(section.content);
                          if (!Array.isArray(diagrams)) throw new Error('not a figure list');
                          return diagrams.map((diagram: any, idx: number) => (
                            <div key={idx} className="space-y-2">
                              <h4 className="font-semibold text-sm">
                                Figure {diagram.figure_number ?? idx + 1}
                              </h4>
                              {typeof diagram.image_data === 'string' && /^(data:image\/|https:\/\/)/.test(diagram.image_data) ? (
                                <img 
                                  src={diagram.image_data} 
                                  alt={`Patent diagram ${diagram.figure_number ?? idx + 1}`}
                                  className="w-full border rounded-lg"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                                  Figure image unavailable
                                </div>
                              )}
                              <div 
                                className="text-sm text-muted-foreground [&>p]:mb-3 [&>p:last-child]:mb-0"
                                dangerouslySetInnerHTML={{ 
                                  __html: DOMPurify.sanitize(cleanPatentContent(diagram.description || '')) 
                                }}
                              />
                            </div>
                          ));
                        } catch (e) {
                          return <div className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content || '') }} />;
                        }
                      })()}
                    </div>
                  ) : (
                    <div 
                      className="prose prose-sm max-w-none leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0"
                      dangerouslySetInnerHTML={{ 
                        __html: DOMPurify.sanitize(cleanPatentContent(section.content || ''), {
                          ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'div', 'span', 'br'],
                          ALLOWED_ATTR: ['class']
                        })
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Final Actions */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Patent Draft Complete!</h3>
              <p className="text-sm text-muted-foreground">
                Your patent application has been generated and is ready for review. Exporting the USPTO-ready DOCX requires the one-time application fee.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleExportDraft}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export DOCX
                  </>
                )}
              </Button>
              <Button
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="gap-2 bg-gradient-to-r from-primary to-primary/80"
              >
                {savingDraft ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    Save & Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PaymentGateDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        applicationId={sessionId}
        onPaymentSuccess={() => {
          setShowPaymentDialog(false);
          handleExportDraft();
        }}
      />
    </motion.div>
  );
};

export default PatentDrafter;