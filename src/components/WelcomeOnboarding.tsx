import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Search, Lightbulb, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';

interface WelcomeOnboardingProps {
  onDismiss: () => void;
  userName?: string;
}

export const WelcomeOnboarding = ({ onDismiss, userName }: WelcomeOnboardingProps) => {
  const navigate = useNavigate();
  
  // Helper that marks onboarding complete before navigating
  const handleAction = (path: string) => {
    onDismiss(); // This saves to DB
    navigate(path);
  };
  
  return (
    <Card className="mb-8 bg-gradient-to-br from-primary/10 via-background to-secondary/10 border-primary/20 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-primary rounded-xl">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl">
                Welcome to PatentBot AI™{userName ? `, ${userName.split('@')[0]}` : ''}! 🎉
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                Let's protect your innovation. Here's how to get started:
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onDismiss} className="text-muted-foreground">
            Dismiss
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Option 1: Full Patent */}
          <div className="p-4 rounded-xl bg-card/50 border border-primary/20 hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">File a Patent</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Ready to protect your invention? Our AI guides you through the entire patent application process.
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-primary" />
                <span>AI-guided interview</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-primary" />
                <span>Prior art search included</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-primary" />
                <span>USPTO-ready documents</span>
              </div>
            </div>
            <Button 
              size="sm" 
              className="w-full bg-primary hover:bg-primary/90"
              onClick={() => handleAction('/new-application')}
            >
              Start Patent ($1,000)
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {/* Option 2: Check & See */}
          <div className="p-4 rounded-xl bg-card/50 border border-secondary/20 hover:border-secondary/40 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <Search className="h-5 w-5 text-secondary" />
              </div>
              <h3 className="font-semibold">Search First</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Not sure if your idea is patentable? Search existing patents before investing in a full application.
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-secondary" />
                <span>3 free searches to start</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-secondary" />
                <span>AI similarity analysis</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-secondary" />
                <span>Unlimited with subscription</span>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              className="w-full border-secondary/50 hover:bg-secondary/10"
              onClick={() => handleAction('/check')}
            >
              Search Patents (Free)
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {/* Option 3: Ideas Lab */}
          <div className="p-4 rounded-xl bg-card/50 border border-accent/20 hover:border-accent/40 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Lightbulb className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-semibold">Track Ideas</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Have multiple ideas? Save them in Ideas Lab with automatic prior art monitoring.
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-accent" />
                <span>Save ideas for later</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-accent" />
                <span>Monitor patent landscape</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-accent" />
                <span>Get alerts on new patents</span>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              className="w-full border-accent/50 hover:bg-accent/10"
              onClick={() => handleAction('/ideas')}
            >
              Explore Ideas Lab
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};