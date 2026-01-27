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
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'incomplete':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Complete</Badge>;
      case 'incomplete':
        return <Badge variant="default" className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">Needs More</Badge>;
      default:
        return <Badge variant="secondary">Missing</Badge>;
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="w-5 h-5 text-primary" />
            Application Progress
          </CardTitle>
          <span className={cn("text-2xl font-bold", getProgressColor(progress.percentage))}>
            {progress.percentage}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress.percentage} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.completed} of {progress.total} required sections complete</span>
            <span>{progress.total - progress.completed} remaining</span>
          </div>
        </div>

        {/* Missing Elements Alert */}
        {missingElements.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-900 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Missing Required Elements
              </span>
            </div>
            <ul className="space-y-1">
              {missingElements.map(element => {
                const { status, wordCount } = getSectionStatus(element);
                return (
                  <li key={element.type} className="flex items-center justify-between text-sm">
                    <span className="text-yellow-700 dark:text-yellow-300">
                      • {element.title}
                      {status === 'incomplete' && (
                        <span className="text-xs ml-1">
                          ({wordCount}/{element.minWords} words)
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Section Checklist */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ListChecks className="w-4 h-4" />
            Section Checklist
          </div>
          <div className="grid gap-2">
            {SECTION_REQUIREMENTS.map(req => {
              const { status, wordCount } = getSectionStatus(req);
              return (
                <div 
                  key={req.type}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg border transition-colors",
                    status === 'complete' && "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-900",
                    status === 'incomplete' && "bg-yellow-50/50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900",
                    status === 'missing' && "bg-muted/30 border-border"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{req.title}</span>
                        {!req.required && (
                          <Badge variant="outline" className="text-xs">Optional</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{req.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {status !== 'missing' && (
                      <span className="text-xs text-muted-foreground">
                        {wordCount} words
                      </span>
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
          <div className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Ready for Review
                </span>
                <p className="text-xs text-green-600 dark:text-green-400">
                  All required sections are complete. Review and export your application.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
