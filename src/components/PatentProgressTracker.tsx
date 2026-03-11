import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  FileText,
  Target,
  ListChecks
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PatentSection {
  id: string;
  section_type: string;
  content: string;
  is_user_edited: boolean;
  created_at: string;
}

interface SectionRequirement {
  type: string;
  title: string;
  required: boolean;
  minWords: number;
  description: string;
}

const SECTION_REQUIREMENTS: SectionRequirement[] = [
  { type: 'abstract', title: 'Abstract', required: true, minWords: 50, description: 'Brief summary of the invention (150 words max)' },
  { type: 'field', title: 'Field of Invention', required: true, minWords: 20, description: 'Technical field and domain classification' },
  { type: 'background', title: 'Background', required: true, minWords: 100, description: 'Prior art and technical problems solved' },
  { type: 'summary', title: 'Summary', required: true, minWords: 75, description: 'Overview of invention and key advantages' },
  { type: 'claims', title: 'Claims', required: true, minWords: 150, description: 'Legal scope of patent protection' },
  { type: 'description', title: 'Detailed Description', required: true, minWords: 300, description: 'Complete technical specification' },
  { type: 'drawings', title: 'Drawings', required: false, minWords: 25, description: 'Figure descriptions and references' },
];

interface PatentProgressTrackerProps {
  sections: PatentSection[];
}

export default function PatentProgressTracker({ sections }: PatentProgressTrackerProps) {
  const getSectionStatus = (requirement: SectionRequirement) => {
    const section = sections.find(s => s.section_type === requirement.type);
    if (!section?.content) {
      return { status: 'missing', wordCount: 0 };
    }
    
    const wordCount = section.content.split(/\s+/).filter(w => w.length > 0).length;
    
    if (wordCount >= requirement.minWords) {
      return { status: 'complete', wordCount };
    } else if (wordCount > 0) {
      return { status: 'incomplete', wordCount };
    }
    return { status: 'missing', wordCount: 0 };
  };

  const calculateProgress = () => {
    let completed = 0;
    let total = 0;
    
    SECTION_REQUIREMENTS.forEach(req => {
      if (req.required) {
        total++;
        const { status } = getSectionStatus(req);
        if (status === 'complete') completed++;
      }
    });
    
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const getMissingElements = () => {
    return SECTION_REQUIREMENTS.filter(req => {
      if (!req.required) return false;
      const { status } = getSectionStatus(req);
      return status !== 'complete';
    });
  };

  const progress = calculateProgress();
  const missingElements = getMissingElements();

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-3 h-3 text-green-500" />;
      case 'incomplete':
        return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      default:
        return <Circle className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20 text-[10px] px-1.5 py-0">Done</Badge>;
      case 'incomplete':
        return <Badge variant="default" className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 text-[10px] px-1.5 py-0">Low</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Missing</Badge>;
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="p-2 sm:p-3 pb-1.5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-xs font-semibold">
            <Target className="w-3 h-3 text-primary" />
            Progress
          </CardTitle>
          <span className={cn("text-sm font-bold", getProgressColor(progress.percentage))}>
            {progress.percentage}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-3 pt-0 space-y-2">
        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress value={progress.percentage} className="h-1" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{progress.completed}/{progress.total} req sections</span>
            <span>{progress.total - progress.completed} left</span>
          </div>
        </div>

        {/* Missing Elements Alert */}
        {missingElements.length > 0 && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-900 p-1.5">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3 text-yellow-600" />
              <span className="text-[10px] font-medium text-yellow-800 dark:text-yellow-200">
                Missing Required
              </span>
            </div>
            <ul className="space-y-0.5">
              {missingElements.map(element => {
                const { status, wordCount } = getSectionStatus(element);
                return (
                  <li key={element.type} className="text-[10px] text-yellow-700 dark:text-yellow-300 line-clamp-1">
                    • {element.title}
                    {status === 'incomplete' && (
                      <span className="ml-1 text-muted-foreground">({wordCount}/{element.minWords}w)</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Section Checklist */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-medium">
            <ListChecks className="w-3 h-3" />
            Checklist
          </div>
          <div className="grid gap-1">
            {SECTION_REQUIREMENTS.map(req => {
              const { status, wordCount } = getSectionStatus(req);
              return (
                <div 
                  key={req.type}
                  className={cn(
                    "flex items-center justify-between px-1.5 py-1 rounded border",
                    status === 'complete' && "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-900",
                    status === 'incomplete' && "bg-yellow-50/50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900",
                    status === 'missing' && "bg-muted/30 border-border"
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {getStatusIcon(status)}
                    <span className="text-[11px] font-medium truncate">{req.title}</span>
                    {!req.required && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">Opt</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {status !== 'missing' && (
                      <span className="text-[10px] text-muted-foreground">{wordCount}w</span>
                    )}
                    {getStatusBadge(status)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ready to File Indicator */}
        {progress.percentage === 100 && (
          <div className="rounded-md border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900 p-1.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <div>
                <span className="text-[11px] font-medium text-green-800 dark:text-green-200">Ready for Review</span>
                <p className="text-[10px] text-green-600 dark:text-green-400">All required sections complete.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
