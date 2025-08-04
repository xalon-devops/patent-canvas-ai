import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Search, 
  FileText, 
  Upload,
  Download,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface SystemMessageProps {
  type: 'loading' | 'success' | 'error' | 'info';
  title: string;
  description?: string;
  details?: string[];
  progress?: number;
}

const SystemMessage: React.FC<SystemMessageProps> = ({ 
  type, 
  title, 
  description, 
  details, 
  progress 
}) => {
  const getIcon = () => {
    switch (type) {
      case 'loading':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'info':
        return <Bot className="h-5 w-5 text-blue-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getBadgeVariant = () => {
    switch (type) {
      case 'loading':
        return 'secondary' as const;
      case 'success':
        return 'default' as const;
      case 'error':
        return 'destructive' as const;
      case 'info':
        return 'outline' as const;
      default:
        return 'secondary' as const;
    }
  };

  const getProcessIcon = (detail: string) => {
    if (detail.toLowerCase().includes('search') || detail.toLowerCase().includes('prior art')) {
      return <Search className="h-3 w-3" />;
    }
    if (detail.toLowerCase().includes('generat') || detail.toLowerCase().includes('draft')) {
      return <Sparkles className="h-3 w-3" />;
    }
    if (detail.toLowerCase().includes('export') || detail.toLowerCase().includes('download')) {
      return <Download className="h-3 w-3" />;
    }
    if (detail.toLowerCase().includes('upload') || detail.toLowerCase().includes('stor')) {
      return <Upload className="h-3 w-3" />;
    }
    if (detail.toLowerCase().includes('file') || detail.toLowerCase().includes('patent')) {
      return <FileText className="h-3 w-3" />;
    }
    return <CheckCircle className="h-3 w-3" />;
  };

  return (
    <Card className="p-4 my-3 border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm">{title}</h4>
            <Badge variant={getBadgeVariant()} className="text-xs">
              {type.toUpperCase()}
            </Badge>
          </div>
          
          {description && (
            <p className="text-sm text-muted-foreground mb-2">
              {description}
            </p>
          )}

          {progress !== undefined && (
            <div className="mb-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {details && details.length > 0 && (
            <div className="space-y-1 mt-2">
              {details.map((detail, index) => (
                <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                  {getProcessIcon(detail)}
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default SystemMessage;