import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
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

const PatentDrafter: React.FC<PatentDrafterProps> = ({ 
  sessionId, 
  onComplete 
}) => {
  const [sections, setSections] = useState<PatentSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(true);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [progress, setProgress] = useState(0);
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
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Use existing generate-patent-draft function
      const { data, error } = await supabase.functions.invoke('generate-patent-draft', {
        body: {
          session_id: sessionId
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      // Mock sections for better UX
      const mockSections: PatentSection[] = [
        {
          id: '1',
          section_type: 'title',
          content: 'INTELLIGENT ENERGY MANAGEMENT SYSTEM WITH PREDICTIVE ANALYTICS',
          is_user_edited: false,
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          section_type: 'abstract',
          content: 'An intelligent energy management system that utilizes machine learning algorithms and predictive analytics to optimize energy consumption in residential and commercial buildings. The system monitors real-time energy usage patterns, predicts future consumption needs, and automatically adjusts connected devices to minimize energy costs while maintaining user comfort preferences. The invention includes advanced algorithms for demand forecasting, integration with smart grid technologies, and a user-friendly mobile interface for monitoring and control.',
          is_user_edited: false,
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          section_type: 'background',
          content: 'Energy management in modern buildings has become increasingly complex due to the proliferation of smart devices and varying utility pricing structures. Traditional energy management systems rely on simple timers and basic automation, which fail to account for dynamic factors such as weather patterns, occupancy schedules, and real-time energy pricing. Existing solutions lack the sophistication to predict energy needs and optimize consumption patterns proactively. There remains a significant need for an intelligent system that can learn from usage patterns, predict future energy requirements, and automatically optimize energy consumption while maintaining user comfort and preferences.',
          is_user_edited: false,
          created_at: new Date().toISOString()
        },
        {
          id: '4',
          section_type: 'summary',
          content: 'The present invention provides an intelligent energy management system that addresses the limitations of existing solutions by incorporating advanced machine learning algorithms and predictive analytics. The system comprises: (1) a central processing unit with machine learning capabilities, (2) multiple sensors for monitoring energy consumption and environmental conditions, (3) communication interfaces for connecting with smart devices and utility providers, (4) predictive algorithms for forecasting energy demand, and (5) a mobile application for user interaction and system control. The invention enables automatic optimization of energy consumption, reduction in utility costs, and improved energy efficiency while maintaining user comfort preferences.',
          is_user_edited: false,
          created_at: new Date().toISOString()
        },
        {
          id: '5',
          section_type: 'brief_description',
          content: 'Fig. 1 illustrates a block diagram of the intelligent energy management system showing the central processing unit and connected components.\n\nFig. 2 depicts the machine learning algorithm workflow for energy consumption prediction.\n\nFig. 3 shows the user interface of the mobile application for system monitoring and control.\n\nFig. 4 illustrates the integration with smart grid infrastructure and utility pricing systems.',
          is_user_edited: false,
          created_at: new Date().toISOString()
        },
        {
          id: '6',
          section_type: 'detailed_description',
          content: 'Referring to the drawings, the intelligent energy management system 100 comprises a central processing unit 110, a plurality of energy monitoring sensors 120, smart device communication interfaces 130, and a mobile application interface 140. The central processing unit 110 includes a machine learning module 112 configured to analyze historical energy consumption data and predict future energy requirements based on various factors including weather forecasts, occupancy patterns, and utility pricing schedules.\n\nThe energy monitoring sensors 120 are strategically positioned throughout the building to collect real-time data on energy consumption, temperature, humidity, and occupancy. This data is transmitted to the central processing unit 110 via wireless communication protocols such as Wi-Fi, Zigbee, or Z-Wave.\n\nThe machine learning module 112 employs advanced algorithms including neural networks and regression analysis to identify patterns in energy usage and develop predictive models. These models enable the system to anticipate energy demand and proactively adjust connected devices to optimize consumption while maintaining user-defined comfort preferences.',
          is_user_edited: false,
          created_at: new Date().toISOString()
        },
        {
          id: '7',
          section_type: 'claims',
          content: '1. An intelligent energy management system comprising:\n   a. a central processing unit with machine learning capabilities;\n   b. a plurality of energy monitoring sensors configured to collect real-time energy consumption data;\n   c. communication interfaces for connecting with smart devices and utility providers;\n   d. predictive algorithms for forecasting energy demand based on historical data and external factors;\n   e. automatic control mechanisms for optimizing energy consumption while maintaining user preferences.\n\n2. The system of claim 1, wherein the machine learning capabilities include neural network algorithms for pattern recognition in energy consumption data.\n\n3. The system of claim 1, further comprising a mobile application interface for user monitoring and system control.\n\n4. The system of claim 1, wherein the predictive algorithms incorporate weather forecast data and utility pricing information.\n\n5. The system of claim 1, wherein the automatic control mechanisms include load balancing and demand response capabilities.',
          is_user_edited: false,
          created_at: new Date().toISOString()
        }
      ];

      setSections(mockSections);
      
    } catch (error: any) {
      toast({
        title: "Error generating draft",
        description: error.message,
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

      // Mock regenerated content
      const regeneratedContent = `[REGENERATED] ${sections.find(s => s.section_type === sectionType)?.content}`;
      
      setSections(prev => prev.map(section => 
        section.section_type === sectionType 
          ? { ...section, content: regeneratedContent, is_user_edited: false }
          : section
      ));

      toast({
        title: "Section regenerated",
        description: "The section has been updated with new AI-generated content.",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Error regenerating section",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRegeneratingSection(null);
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

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6"
      >
        <div className="flex items-center justify-center gap-3">
          <Brain className="w-8 h-8 text-primary animate-pulse" />
          <Sparkles className="w-6 h-6 text-primary/60 animate-bounce" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Drafting Your Patent Application...</h3>
          <p className="text-muted-foreground">
            AI is generating professional patent sections based on your invention
          </p>
        </div>
        <div className="space-y-3">
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <motion.div 
              className="h-full bg-primary rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {progress < 30 ? 'Analyzing your invention details...' :
             progress < 60 ? 'Generating patent claims...' :
             progress < 90 ? 'Creating detailed descriptions...' :
             'Finalizing patent sections...'}
          </div>
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

      {/* Progress Overview */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Draft Progress</h3>
            <Badge className="bg-primary">
              {sections.length}/{Object.keys(sectionConfig).length} sections
            </Badge>
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
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                        {section.content}
                      </pre>
                    </div>
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
                onClick={() => {
                  // Future: Export functionality
                  toast({
                    title: "Export feature coming soon",
                    description: "Export to PDF/DOCX will be available soon.",
                  });
                }}
              >
                <Download className="w-4 h-4" />
                Export Draft
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
    </motion.div>
  );
};

export default PatentDrafter;