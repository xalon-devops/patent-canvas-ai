import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Edit3, 
  Save, 
  Wand2, 
  CheckCircle, 
  Clock, 
  Eye,
  FileText,
  Sparkles,
  Brain,
  Zap
} from 'lucide-react';
import DOMPurify from 'dompurify';

interface PatentSection {
  id: string;
  section_type: string;
  content: string;
  is_user_edited: boolean;
  created_at: string;
}

interface PatentCanvasProps {
  sections: PatentSection[];
  onUpdateSection: (sectionId: string, content: string) => Promise<void>;
  onRegenerateSection: (sectionType: string) => Promise<void>;
  isGenerating?: boolean;
}

const sectionConfig = {
  abstract: {
    title: 'Abstract',
    description: 'Brief summary of the invention',
    icon: Eye,
    color: 'bg-blue-500',
    targetWords: 150
  },
  field: {
    title: 'Field of Invention',
    description: 'Technical field and domain',
    icon: Sparkles,
    color: 'bg-purple-500',
    targetWords: 50
  },
  background: {
    title: 'Background',
    description: 'Prior art and technical problems',
    icon: FileText,
    color: 'bg-orange-500',
    targetWords: 300
  },
  summary: {
    title: 'Summary',
    description: 'Overview of the invention',
    icon: Brain,
    color: 'bg-green-500',
    targetWords: 200
  },
  claims: {
    title: 'Claims',
    description: 'Legal scope of protection',
    icon: Zap,
    color: 'bg-red-500',
    targetWords: 500
  },
  drawings: {
    title: 'Drawings',
    description: 'Figures and illustrations',
    icon: Edit3,
    color: 'bg-indigo-500',
    targetWords: 100
  },
  description: {
    title: 'Detailed Description',
    description: 'Complete technical specification',
    icon: FileText,
    color: 'bg-teal-500',
    targetWords: 1000
  }
};

export default function PatentCanvas({ sections, onUpdateSection, onRegenerateSection, isGenerating = false }: PatentCanvasProps) {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [aiThinking, setAiThinking] = useState<string | null>(null);

  // Simulate AI thinking animation
  useEffect(() => {
    if (isGenerating) {
      const sectionTypes = Object.keys(sectionConfig);
      let index = 0;
      const interval = setInterval(() => {
        setAiThinking(sectionTypes[index % sectionTypes.length]);
        index++;
      }, 2000);
      
      return () => clearInterval(interval);
    } else {
      setAiThinking(null);
    }
  }, [isGenerating]);

  const getSectionProgress = (section: PatentSection) => {
    const wordCount = section.content ? section.content.split(' ').length : 0;
    const targetWords = sectionConfig[section.section_type as keyof typeof sectionConfig]?.targetWords || 100;
    return Math.min((wordCount / targetWords) * 100, 100);
  };

  const getTotalProgress = () => {
    const totalSections = Object.keys(sectionConfig).length;
    const completedSections = sections.filter(s => s.content && s.content.length > 50).length;
    return (completedSections / totalSections) * 100;
  };

  const handleEdit = (section: PatentSection) => {
    setEditingSection(section.id);
    setEditContent(section.content || '');
  };

  const handleSave = async (sectionId: string) => {
    await onUpdateSection(sectionId, editContent);
    setEditingSection(null);
  };

  const handleCancel = () => {
    setEditingSection(null);
    setEditContent('');
  };

  const renderSection = (sectionType: string) => {
    const section = sections.find(s => s.section_type === sectionType);
    const config = sectionConfig[sectionType as keyof typeof sectionConfig];
    const progress = section ? getSectionProgress(section) : 0;
    const isThinking = aiThinking === sectionType;
    const isEditing = editingSection === section?.id;
    
    const Icon = config?.icon || FileText;

    return (
      <Card 
        key={sectionType} 
        className={`relative overflow-hidden transition-all duration-500 hover:scale-105 ${
          isThinking ? 'ring-2 ring-primary animate-pulse' : ''
        } ${section?.content ? 'border-green-200' : 'border-gray-200'}`}
      >
        {isThinking && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary-foreground animate-pulse" />
        )}
        
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${config?.color || 'bg-gray-500'} text-white`}>
                <Icon size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">{config?.title}</CardTitle>
                <CardDescription className="text-sm">
                  {config?.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {section?.is_user_edited && (
                <Badge variant="secondary" className="text-xs">
                  Edited
                </Badge>
              )}
              {isThinking ? (
                <div className="flex items-center gap-1">
                  <Wand2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs text-primary">AI Writing...</span>
                </div>
              ) : section?.content ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <Clock className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
          
          {section && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{section.content ? section.content.split(' ').length : 0} words</span>
                <span>Target: {config?.targetWords || 100} words</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                placeholder={`Enter ${config?.title.toLowerCase()} content...`}
              />
              <div className="flex gap-2">
                <Button onClick={() => handleSave(section!.id)} size="sm">
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
                <Button onClick={handleCancel} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {section?.content ? (
                <div className="prose prose-sm max-w-none">
                  <div 
                    className="p-3 bg-muted/50 rounded-lg text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content) }}
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                  {isThinking ? (
                    <div className="flex flex-col items-center gap-2">
                      <Wand2 className="w-8 h-8 animate-spin text-primary" />
                      <span>AI is crafting this section...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Icon className="w-8 h-8" />
                      <span>Waiting for AI generation...</span>
                    </div>
                  )}
                </div>
              )}
              
              {section?.content && (
                <div className="flex gap-2">
                  <Button onClick={() => handleEdit(section)} variant="outline" size="sm">
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    onClick={() => onRegenerateSection(sectionType)} 
                    variant="outline" 
                    size="sm"
                    disabled={isGenerating}
                  >
                    <Wand2 className="w-4 h-4 mr-1" />
                    Regenerate
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Patent Application Progress
          </CardTitle>
          <CardDescription>
            AI-powered patent drafting in real-time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Overall Completion</span>
              <span>{Math.round(getTotalProgress())}%</span>
            </div>
            <Progress value={getTotalProgress()} className="h-3" />
            <div className="text-xs text-muted-foreground">
              {sections.filter(s => s.content).length} of {Object.keys(sectionConfig).length} sections complete
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.keys(sectionConfig).map(renderSection)}
      </div>
    </div>
  );
}