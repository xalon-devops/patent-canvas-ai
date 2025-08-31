import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { 
  Code, 
  Upload, 
  ArrowLeft, 
  ArrowRight,
  Github,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Zap,
  Brain,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type PatentType = 'software' | 'non-software' | null;

interface PatentIdea {
  id: string;
  title: string;
  description: string;
  patent_type: string;
}

const NewApplication = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [patentType, setPatentType] = useState<PatentType>(null);
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaDescription, setIdeaDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [existingIdea, setExistingIdea] = useState<PatentIdea | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/auth');
        return;
      }
      setUser(session.user);

      // Check if coming from an existing idea
      const ideaId = searchParams.get('ideaId');
      if (ideaId) {
        await loadExistingIdea(ideaId);
      }
    };

    checkAuth();
  }, [navigate, searchParams]);

  const loadExistingIdea = async (ideaId: string) => {
    try {
      const { data, error } = await supabase
        .from('patent_ideas')
        .select('*')
        .eq('id', ideaId)
        .single();

      if (error) throw error;
      
      setExistingIdea(data);
      setIdeaTitle(data.title);
      setIdeaDescription(data.description);
      setPatentType(data.patent_type as PatentType);
      setCurrentStep(2); // Skip type selection
    } catch (error: any) {
      toast({
        title: "Error loading idea",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePatentTypeSelect = (type: PatentType) => {
    setPatentType(type);
    setCurrentStep(2);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files));
    }
  };

  const handleNext = () => {
    if (currentStep === 2 && (!ideaTitle || !ideaDescription)) {
      toast({
        title: "Missing Information",
        description: "Please provide both a title and description for your idea.",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleSubmit = async () => {
    if (!user || !patentType) return;
    
    setLoading(true);
    try {
      // Create or update patent idea
      let ideaData;
      if (existingIdea) {
        const { data, error } = await supabase
          .from('patent_ideas')
          .update({
            title: ideaTitle,
            description: ideaDescription,
            status: 'drafted'
          })
          .eq('id', existingIdea.id)
          .select()
          .single();
        
        if (error) throw error;
        ideaData = data;
      } else {
        const { data, error } = await supabase
          .from('patent_ideas')
          .insert([{
            user_id: user.id,
            title: ideaTitle,
            description: ideaDescription,
            patent_type: patentType,
            data_source: {
              github_url: githubUrl,
              files: uploadedFiles.map(f => f.name)
            }
          }])
          .select()
          .single();
        
        if (error) throw error;
        ideaData = data;
      }

      // Create patent session
      const { data: sessionData, error: sessionError } = await supabase
        .from('patent_sessions')
        .insert([{
          user_id: user.id,
          idea_prompt: `${ideaTitle}: ${ideaDescription}`,
          patent_type: patentType,
          data_source: {
            idea_id: ideaData.id,
            github_url: githubUrl,
            files: uploadedFiles.map(f => f.name)
          }
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      toast({
        title: "Application Created!",
        description: "Your patent application has been started successfully.",
        variant: "default",
      });

      navigate('/pending');
    } catch (error: any) {
      toast({
        title: "Error creating application",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">What type of patent are you filing?</h2>
        <p className="text-muted-foreground">
          Choose the category that best describes your invention
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card 
          className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"
          onClick={() => handlePatentTypeSelect('software')}
        >
          <CardContent className="p-8 text-center">
            <div className="mb-4">
              <Code className="w-16 h-16 mx-auto text-blue-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Software Patent</h3>
            <p className="text-muted-foreground mb-4">
              Applications, algorithms, mobile apps, web platforms, AI/ML systems
            </p>
            <div className="space-y-2 text-sm text-left">
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4" />
                <span>GitHub integration</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>Code analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                <span>AI-powered documentation</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200"
          onClick={() => handlePatentTypeSelect('non-software')}
        >
          <CardContent className="p-8 text-center">
            <div className="mb-4">
              <Lightbulb className="w-16 h-16 mx-auto text-green-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Physical Patent</h3>
            <p className="text-muted-foreground mb-4">
              Mechanical devices, chemical processes, medical devices, manufacturing
            </p>
            <div className="space-y-2 text-sm text-left">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                <span>Image analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Technical drawings</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Visual recognition</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Tell us about your invention</h2>
        <p className="text-muted-foreground">
          Provide a clear title and detailed description of your innovative idea
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <Label htmlFor="title">Invention Title</Label>
          <Input
            id="title"
            value={ideaTitle}
            onChange={(e) => setIdeaTitle(e.target.value)}
            placeholder="e.g., Smart Home Energy Management System"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="description">Detailed Description</Label>
          <Textarea
            id="description"
            value={ideaDescription}
            onChange={(e) => setIdeaDescription(e.target.value)}
            placeholder="Describe your invention in detail. What problem does it solve? How does it work? What makes it unique?"
            className="mt-2 min-h-[150px]"
          />
          <p className="text-sm text-muted-foreground mt-2">
            Minimum 100 characters. Be specific about functionality and benefits.
          </p>
        </div>
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">
          {patentType === 'software' ? 'Connect Your Code' : 'Upload Supporting Materials'}
        </h2>
        <p className="text-muted-foreground">
          {patentType === 'software' 
            ? 'Link your GitHub repository or upload code files for AI analysis'
            : 'Upload images, diagrams, technical drawings, or documents'
          }
        </p>
      </div>

      {patentType === 'software' ? (
        <div className="space-y-6">
          <div>
            <Label htmlFor="github">GitHub Repository URL (Recommended)</Label>
            <Input
              id="github"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/username/repository"
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Our AI will analyze your code structure and generate technical documentation
            </p>
          </div>

          <div className="text-center text-muted-foreground">
            <span>or</span>
          </div>

          <div>
            <Label htmlFor="files">Upload Documentation Files</Label>
            <input
              id="files"
              type="file"
              multiple
              accept=".txt,.doc,.docx,.pdf,.md,.rtf"
              onChange={handleFileUpload}
              className="mt-2 block w-full text-sm text-gray-900 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-primary file:to-primary/80 file:text-primary-foreground hover:file:from-primary/90 hover:file:to-primary/70 file:shadow-lg hover:file:shadow-xl file:transition-all file:duration-300 bg-background/50 backdrop-blur-sm border border-white/20 rounded-lg p-3 hover:border-white/30 transition-all duration-300"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Upload text documents, Word files, PDFs, or Markdown files describing your software
            </p>
            {uploadedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadedFiles.map((file, index) => (
                  <p key={index} className="text-sm text-muted-foreground">
                    📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <Label htmlFor="files">Upload Supporting Materials</Label>
            <input
              id="files"
              type="file"
              multiple
              accept=".txt,.doc,.docx,.pdf,.md,.rtf,image/*,.dwg,.step,.iges"
              onChange={handleFileUpload}
              className="mt-2 block w-full text-sm text-gray-900 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-primary file:to-primary/80 file:text-primary-foreground hover:file:from-primary/90 hover:file:to-primary/70 file:shadow-lg hover:file:shadow-xl file:transition-all file:duration-300 bg-background/50 backdrop-blur-sm border border-white/20 rounded-lg p-3 hover:border-white/30 transition-all duration-300"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Upload documents, images, technical drawings, CAD files, or other files that illustrate your invention
            </p>
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {existingIdea ? 'Draft Patent Application' : 'New Patent Application'}
            </h1>
            <p className="text-muted-foreground mt-2">
              Step {currentStep} of 3: 
              {currentStep === 1 && ' Choose Patent Type'}
              {currentStep === 2 && ' Describe Your Invention'}
              {currentStep === 3 && ' Provide Supporting Materials'}
            </p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-4 mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${step <= currentStep 
                  ? 'bg-primary text-primary-foreground shadow-glow' 
                  : 'bg-muted text-muted-foreground'
                }`}>
                {step}
              </div>
              {step < 3 && (
                <div className={`w-16 h-1 rounded
                  ${step < currentStep ? 'bg-primary shadow-glow' : 'bg-muted'}
                `} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <Card className="glass-strong border-white/20 shadow-elegant backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-background/80">
          <CardContent className="relative p-12 bg-gradient-to-br from-card/60 via-transparent to-background/40 backdrop-blur-md rounded-2xl border border-white/10 shadow-[0_8px_32px_-12px_rgba(0,255,255,0.3)] before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-primary/5 before:via-transparent before:to-accent/5 before:pointer-events-none">
            <div className="relative z-10">
              <AnimatePresence mode="wait">
                {currentStep === 1 && !existingIdea && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  disabled={currentStep === 1 || (existingIdea && currentStep === 2)}
                  className="gap-2 bg-background/50 backdrop-blur-sm border-white/20 hover:bg-background/70 hover:border-white/30 transition-all duration-300"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Previous
                </Button>

                {currentStep < 3 ? (
                  <Button onClick={handleNext} className="gap-2 bg-gradient-primary hover:shadow-glow transition-all duration-300 hover:scale-105">
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSubmit} 
                    disabled={loading}
                    className="gap-2 bg-gradient-primary hover:shadow-glow transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {loading ? 'Creating...' : 'Create Application'}
                    <Sparkles className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewApplication;
