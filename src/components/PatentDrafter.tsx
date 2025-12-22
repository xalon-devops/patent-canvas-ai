import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
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

  const sectionConfig = {
    'title': { name: 'Title', icon: FileText, order: 1, required: true },
    'abstract': { name: 'Abstract', icon: FileText, order: 2, required: true },
    'background': { name: 'Background', icon: FileText, order: 3, required: true },
    'summary': { name: 'Summary', icon: FileText, order: 4, required: true },
    'brief_description': { name: 'Brief Description of Drawings', icon: ImageIcon, order: 5, required: false },
    'detailed_description': { name: 'Detailed Description', icon: FileText, order: 6, required: true },
    'claims': { name: 'Claims', icon: FileCheck, order: 7, required: true },
  };

  useEffect(() => {
    generatePatentDraft();
  }, []);

  const generatePatentDraft = async () => {
    setGenerating(true);
    setProgress(0);
    setError(null);
    try {
      // Simulate progress updates with timeout protection
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 85));
      }, 800);

      // Add timeout promise (180 seconds for complex AI generation)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Patent generation timeout - this is taking longer than expected')), 180000);
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

      clearInterval(progressInterval);

      if (error) {
        console.error('Patent generation error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to generate patent draft');
      }

      setProgress(90);

      // Fetch the actual generated sections from the database
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('patent_sections')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (sectionsError) {
        console.error('Sections fetch error:', sectionsError);
        throw sectionsError;
      }

      if (!sectionsData || sectionsData.length === 0) {
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

      if (error) throw error;

      // Fetch the updated section from the database
      const { data: updatedSection, error: fetchError } = await supabase
        .from('patent_sections')
        .select('*')
        .eq('session_id', sessionId)
        .eq('section_type', sectionType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

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
    setRedrafting(true);
    setProgress(0);
    try {
      // Delete existing sections first
      const { error: deleteError } = await supabase
        .from('patent_sections')
        .delete()
        .eq('session_id', sessionId);

      if (deleteError) throw deleteError;

      // Clear local sections
      setSections([]);

      // Start progress simulation
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Call the enhanced patent draft generation function
      const { data, error } = await supabase.functions.invoke('generate-patent-draft-enhanced', {
        body: {
          session_id: sessionId
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      // Fetch the newly generated sections from the database
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('patent_sections')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (sectionsError) throw sectionsError;

      if (!sectionsData || sectionsData.length === 0) {
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
        // Check if it's a payment required error
        if (error.message?.includes('Payment required') || error.message?.includes('402')) {
          setShowPaymentDialog(true);
          return;
        }
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Export failed');
      }

      // Download the file
      window.open(data.download_url, '_blank');

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
    const completedSections = sections.length;
    return (completedSections / totalSections) * 100;
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
            onClick={() => window.history.back()}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Go Back
          </Button>
        </div>
      </motion.div>
    );
  }

  const sortedSections = sections.sort((a, b) => 
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Draft Progress</h3>
            <div className="flex items-center gap-3">
              <Badge className="bg-primary">
                {sections.length}/{Object.keys(sectionConfig).length} sections
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

          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
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
                        onClick={() => handleEditSection(section.id, section.content)}
                        disabled={isEditing}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerateSection(section.section_type)}
                        disabled={isRegenerating || isEditing}
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
                          return diagrams.map((diagram: any, idx: number) => (
                            <div key={idx} className="space-y-2">
                              <h4 className="font-semibold text-sm">
                                Figure {diagram.figure_number}
                              </h4>
                              <img 
                                src={diagram.image_data} 
                                alt={`Patent diagram ${diagram.figure_number}`}
                                className="w-full border rounded-lg"
                              />
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
                Your patent application has been generated and is ready for review and filing.
              </p>
            </div>
            <div className="flex gap-4 justify-center">
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
                    Export Draft
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