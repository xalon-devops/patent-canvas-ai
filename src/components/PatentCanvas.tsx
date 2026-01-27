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
        className={`relative overflow-hidden transition-all duration-300 ${
          isThinking ? 'ring-2 ring-primary animate-pulse' : ''
        } ${section?.content ? 'border-green-200' : 'border-muted'}`}
      >
        {isThinking && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary-foreground animate-pulse" />
        )}
        
        <CardHeader className="pb-2 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`p-1.5 sm:p-2 rounded-lg ${config?.color || 'bg-gray-500'} text-white flex-shrink-0`}>
                <Icon size={16} className="sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base truncate">{config?.title}</CardTitle>
                <CardDescription className="text-xs hidden sm:block">
                  {config?.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {section?.is_user_edited && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Edited
                </Badge>
              )}
              {isThinking ? (
                <Wand2 className="w-4 h-4 animate-spin text-primary" />
              ) : section?.content ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Clock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
          
          {section && (
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                <span>{section.content ? section.content.split(' ').length : 0} words</span>
                <span>Target: {config?.targetWords || 100}</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-2 p-3 sm:p-4 pt-0">
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[150px] text-sm font-mono"
                placeholder={`Enter ${config?.title.toLowerCase()} content...`}
              />
              <div className="flex gap-2">
                <Button onClick={() => handleSave(section!.id)} size="sm" className="text-xs">
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button onClick={handleCancel} variant="outline" size="sm" className="text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {section?.content ? (
                <div 
                  className="p-2 sm:p-3 bg-muted/50 rounded-lg text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap max-h-[200px] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content) }}
                />
              ) : (
                <div className="p-4 sm:p-6 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                  {isThinking ? (
                    <div className="flex flex-col items-center gap-1">
                      <Wand2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs">AI writing...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Icon className="w-6 h-6" />
                      <span className="text-xs">Waiting for AI...</span>
                    </div>
                  )}
                </div>
              )}
              
              {section?.content && (
                <div className="flex flex-wrap gap-1.5">
                  <Button onClick={() => handleEdit(section)} variant="outline" size="sm" className="text-xs h-7 px-2">
                    <Edit3 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    onClick={() => onRegenerateSection(sectionType)} 
                    variant="outline" 
                    size="sm"
                    disabled={isGenerating}
                    className="text-xs h-7 px-2"
                  >
                    <Wand2 className="w-3 h-3 mr-1" />
                    Regen
                  </Button>
                  {priorArt.length > 0 && (
                    <Button 
                      onClick={() => setShowComparison(showComparison === sectionType ? null : sectionType)} 
                      variant={showComparison === sectionType ? "secondary" : "outline"}
                      size="sm"
                      className="text-xs h-7 px-2"
                    >
                      <Scale className="w-3 h-3 mr-1" />
                      <span className="hidden xs:inline">Compare</span>
                    </Button>
                  )}
                </div>
              )}
              
              {/* Prior Art Comparison Panel */}
              {showComparison === sectionType && priorArt.length > 0 && (
                <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
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
    <div className="space-y-6">
      {/* Progress Tracker */}
      <PatentProgressTracker sections={sections} />

      {/* Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.keys(sectionConfig).map(renderSection)}
      </div>
    </div>
  );
}