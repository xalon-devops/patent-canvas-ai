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
  Zap,
  Scale,
  PanelRightClose
} from 'lucide-react';
import DOMPurify from 'dompurify';
import PriorArtComparisonPanel from './PriorArtComparisonPanel';
import SectionQualityScore from './SectionQualityScore';
import PatentProgressTracker from './PatentProgressTracker';

interface PatentSection {
  id: string;
  section_type: string;
  content: string;
  is_user_edited: boolean;
  created_at: string;
}

interface PriorArtResult {
  id: string;
  title: string;
  publication_number?: string;
  summary?: string;
  similarity_score: number;
  url?: string;
  overlap_claims?: string[];
  difference_claims?: string[];
}

interface PatentCanvasProps {
  sections: PatentSection[];
  onUpdateSection: (sectionId: string, content: string) => Promise<void>;
  onRegenerateSection: (sectionType: string) => Promise<void>;
  isGenerating?: boolean;
  priorArt?: PriorArtResult[];
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

export default function PatentCanvas({ sections, onUpdateSection, onRegenerateSection, isGenerating = false, priorArt = [] }: PatentCanvasProps) {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [aiThinking, setAiThinking] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState<string | null>(null);

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
        className={`relative overflow-hidden transition-all duration-200 ${
          isThinking ? 'ring-1 ring-primary animate-pulse' : ''
        } ${section?.content ? 'border-green-200/60' : 'border-muted'}`}
      >
        {isThinking && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-primary-foreground animate-pulse" />
        )}
        
        <CardHeader className="pb-1 p-2 sm:p-3">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className={`p-1 rounded ${config?.color || 'bg-gray-500'} text-white flex-shrink-0`}>
                <Icon size={12} className="sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xs sm:text-sm font-medium truncate">{config?.title}</CardTitle>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {section?.is_user_edited && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                  Edited
                </Badge>
              )}
              {isThinking ? (
                <Wand2 className="w-3 h-3 animate-spin text-primary" />
              ) : section?.content ? (
                <CheckCircle className="w-3 h-3 text-green-500" />
              ) : (
                <Clock className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          </div>
          
          {section && (
            <div className="flex items-center gap-2 mt-1.5">
              <Progress value={progress} className="h-1 flex-1" />
              <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                {section.content ? section.content.split(' ').length : 0}/{config?.targetWords || 100}
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-1.5 p-2 sm:p-3 pt-0">
          {isEditing ? (
            <div className="space-y-1.5">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[120px] text-xs font-mono"
                placeholder={`Enter ${config?.title.toLowerCase()} content...`}
              />
              <div className="flex gap-1.5">
                <Button onClick={() => handleSave(section!.id)} size="sm" className="text-[10px] h-6 px-2">
                  <Save className="w-2.5 h-2.5 mr-1" />
                  Save
                </Button>
                <Button onClick={handleCancel} variant="outline" size="sm" className="text-[10px] h-6 px-2">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {section?.content ? (
                <div 
                  className="p-1.5 sm:p-2 bg-muted/30 rounded text-[11px] sm:text-xs leading-relaxed break-words whitespace-pre-wrap max-h-[140px] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content) }}
                />
              ) : (
                <div className="py-3 text-center text-muted-foreground border border-dashed rounded">
                  {isThinking ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span className="text-[10px]">Writing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Waiting...</span>
                    </div>
                  )}
                </div>
              )}
              
              {section?.content && (
                <div className="flex flex-wrap gap-1">
                  <Button onClick={() => handleEdit(section)} variant="outline" size="sm" className="text-[10px] h-5 px-1.5">
                    <Edit3 className="w-2.5 h-2.5 mr-0.5" />
                    Edit
                  </Button>
                  <Button 
                    onClick={() => onRegenerateSection(sectionType)} 
                    variant="outline" 
                    size="sm"
                    disabled={isGenerating}
                    className="text-[10px] h-5 px-1.5"
                  >
                    <Wand2 className="w-2.5 h-2.5 mr-0.5" />
                    Regen
                  </Button>
                  {priorArt.length > 0 && (
                    <Button 
                      onClick={() => setShowComparison(showComparison === sectionType ? null : sectionType)} 
                      variant={showComparison === sectionType ? "secondary" : "outline"}
                      size="sm"
                      className="text-[10px] h-5 px-1.5"
                    >
                      <Scale className="w-2.5 h-2.5 mr-0.5" />
                      Compare
                    </Button>
                  )}
                </div>
              )}
              
              {/* Prior Art Comparison Panel */}
              {showComparison === sectionType && priorArt.length > 0 && (
                <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                  <PriorArtComparisonPanel
                    priorArt={priorArt}
                    sectionType={sectionType}
                    sectionContent={section?.content || ''}
                  />
                </div>
              )}
              
              {/* Quality Score Section */}
              {section?.content && (
                <SectionQualityScore
                  sectionType={sectionType}
                  content={section.content}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-3">
      {/* Progress Tracker */}
      <PatentProgressTracker sections={sections} />

      {/* Section Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {Object.keys(sectionConfig).map(renderSection)}
      </div>
    </div>
  );
}