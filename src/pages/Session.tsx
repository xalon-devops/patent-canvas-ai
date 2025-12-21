import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Session as SupabaseSession } from '@supabase/supabase-js';
import { 
  Send, 
  ArrowLeft, 
  Bot, 
  User as UserIcon, 
  Search, 
  FileText, 
  Eye,
  Edit3,
  Download,
  CheckCircle,
  TreeDeciduous,
  Sparkles,
  Clock,
  Wand2
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/dateUtils';
import { validateAiQuestion, validatePatentSection, sanitizeText, sanitizeHtml, createSafeErrorMessage } from '@/utils/security';
import SystemMessage from '@/components/SystemMessage';
import PatentCanvas from '@/components/PatentCanvas';
import PriorArtDisplay from '@/components/PriorArtDisplay';
import { PaymentGateDialog } from '@/components/PaymentGateDialog';
import { PageSEO } from '@/components/SEO';

interface PatentSession {
  id: string;
  idea_prompt: string;
  status: string;
  created_at: string;
  user_id: string;
}

interface AIQuestion {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

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
  publication_number: string;
  summary: string;
  similarity_score: number;
  url: string;
  created_at: string;
  overlap_claims?: string[];
  difference_claims?: string[];
}

const Session = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [patentSession, setPatentSession] = useState<PatentSession | null>(null);
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [sections, setSections] = useState<PatentSection[]>([]);
  const [priorArt, setPriorArt] = useState<PriorArtResult[]>([]);
  
  const [currentMessage, setCurrentMessage] = useState('');
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [analyzingGitHub, setAnalyzingGitHub] = useState(false);
  const [chatPhase, setChatPhase] = useState<'initial' | 'questioning' | 'search' | 'canvas'>('initial');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchingPriorArt, setSearchingPriorArt] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [filingPatent, setFilingPatent] = useState(false);
  const [exportingPatent, setExportingPatent] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  
  const sectionTypes = [
    'abstract',
    'field', 
    'background',
    'summary',
    'claims',
    'drawings',
    'description'
  ];

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/auth');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/auth');
      } else {
        fetchSessionData();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, id]);

  // Real-time listener for payment status updates (webhook-triggered)
  useEffect(() => {
    if (!id) return;

    const paymentChannel = supabase
      .channel(`payment-updates-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'application_payments',
          filter: `application_id=eq.${id}`,
        },
        (payload) => {
          console.log('[Session] Payment status updated:', payload);
          if (payload.new && payload.new.status === 'completed') {
            setHasPaid(true);
            toast({
              title: "✅ Payment Confirmed",
              description: "Your payment has been processed. You can now export your patent!",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentChannel);
    };
  }, [id, toast]);

  const checkPaymentStatus = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('application_payments')
        .select('*')
        .eq('application_id', id)
        .eq('status', 'completed')
        .maybeSingle();

      if (!error && data) {
        setHasPaid(true);
      }
    } catch (error) {
      console.error('Error checking payment:', error);
    }
  };

  const fetchSessionData = async () => {
    if (!id) return;
    
    try {
      // Fetch patent session
      const { data: sessionData, error: sessionError } = await supabase
        .from('patent_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (sessionError) throw sessionError;
      setPatentSession(sessionData);

      // Check payment status
      await checkPaymentStatus();

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('ai_questions')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: true });

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // Fetch sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('patent_sections')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: true });

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);

      // Fetch prior art
      const { data: priorArtData, error: priorArtError } = await supabase
        .from('prior_art_results')
        .select('*')
        .eq('session_id', id)
        .order('similarity_score', { ascending: false });

      if (priorArtError) throw priorArtError;
      setPriorArt(priorArtData || []);

      // Determine chat phase
      if (sectionsData && sectionsData.length > 0) {
        setChatPhase('canvas');
      } else if (priorArtData && priorArtData.length > 0) {
        setChatPhase('search');
      } else if (questionsData && questionsData.length > 0) {
        setChatPhase('questioning');
      } else {
        setChatPhase('initial');
      }

    } catch (error: any) {
      toast({
        title: "Error loading session",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!id || sendingMessage) return;

    // Validate and sanitize input
    const sanitizedMessage = sanitizeText(currentMessage);
    const validation = validateAiQuestion(sanitizedMessage);
    
    if (!validation.isValid) {
      toast({
        title: "Input Error",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setSendingMessage(true);
    const message = sanitizedMessage;
    setCurrentMessage('');

    try {
      if (chatPhase === 'initial') {
        // Update the session with the initial idea
        const { error: updateError } = await supabase
          .from('patent_sessions')
          .update({ idea_prompt: message })
          .eq('id', id);

        if (updateError) throw updateError;

        // Check if input is a URL
        const trimmedMessage = message.trim().toLowerCase();
        const isUrl = trimmedMessage.startsWith('http') || 
                     trimmedMessage.startsWith('www.') || 
                     /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmedMessage);

        if (isUrl) {
          // Show URL processing message
          toast({
            title: "Processing URL",
            description: "Analyzing website content...",
            variant: "default",
          });

          // First crawl the URL to show user what we understand
          let actualUrl = message.trim();
          if (!actualUrl.startsWith('http')) {
            actualUrl = 'https://' + actualUrl;
          }

          const { data: crawlData, error: crawlError } = await supabase.functions.invoke('crawl-url-content', {
            body: { url: actualUrl }
          });

          if (crawlData?.success && crawlData.content) {
            // Show what we understood from the website
            const summaryContent = crawlData.content.substring(0, 500) + (crawlData.content.length > 500 ? '...' : '');
            
            toast({
              title: "Website Analysis Complete",
              description: `Found content about: ${summaryContent.split('.')[0]}...`,
              variant: "default",
            });
          }
        }

        // Call the ask-followups edge function to generate AI questions
        console.log('Calling ask-followups edge function...');
        
        const { data: followupData, error: followupError } = await supabase.functions.invoke('ask-followups', {
          body: { 
            session_id: id,
            idea_prompt: message 
          }
        });

        if (followupError) {
          console.error('Ask-followups error:', followupError);
          throw new Error(followupError.message || 'Failed to generate follow-up questions');
        }

        if (!followupData?.success) {
          console.error('Follow-up generation failed:', followupData);
          throw new Error('Failed to generate follow-up questions');
        }

        console.log('Follow-up questions generated successfully:', followupData);
        
        // Show success message with details
        if (followupData.url_crawled) {
          toast({
            title: "AI Analysis Complete",
            description: `Generated ${followupData.questions_generated} targeted questions based on website content (${followupData.context_length} chars analyzed)`,
            variant: "default",
          });
        } else {
          toast({
            title: "Questions Generated",
            description: `Generated ${followupData.questions_generated} follow-up questions`,
            variant: "default",
          });
        }
        
        // Move to questioning phase
        setChatPhase('questioning');
        await fetchSessionData();

      } else if (chatPhase === 'questioning') {
        // Refresh questions first to get latest state
        await fetchSessionData();
        
        // Answer the current question (find the first unanswered question)
        const currentQuestion = questions.find(q => !q.answer);
        if (currentQuestion) {
          const { error: answerError } = await supabase
            .from('ai_questions')
            .update({ answer: message })
            .eq('id', currentQuestion.id);

          if (answerError) throw answerError;

          // Refresh data after updating
          await fetchSessionData();

          // Generate patent sections progressively after each answer
          await generatePatentSections();

          // Check if all questions are answered OR we have sufficient technical detail
          const allQuestionsAnswered = questions.every(q => q.answer);
          const answeredCount = questions.filter(q => q.answer).length;
          const sufficientDetail = answeredCount >= Math.min(3, questions.length);
          
          if (allQuestionsAnswered || sufficientDetail) {
            // Move to search phase
            setChatPhase('search');
            await performPriorArtSearch();
          }
        }
      }

    } catch (error: any) {
      toast({
        title: "Error sending message",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
      setCurrentMessage(message); // Restore message on error
    } finally {
      setSendingMessage(false);
    }
  };

  const performPriorArtSearch = async () => {
    if (!id) return;
    
    setSearchingPriorArt(true);
    
    try {
      console.log('Calling search-prior-art-enhanced edge function...');
      
      // Call the enhanced search-prior-art edge function with real patent databases
      const { data: searchData, error: searchError } = await supabase.functions.invoke('search-prior-art-enhanced', {
        body: { session_id: id }
      });

      if (searchError) {
        console.error('Search-prior-art error:', searchError);
        throw new Error(searchError.message || 'Failed to search prior art');
      }

      if (!searchData?.success) {
        console.error('Prior art search failed:', searchData);
        throw new Error('Prior art search failed');
      }

      console.log('Prior art search completed successfully:', searchData);
      
      await fetchSessionData();
      
      toast({
        title: "Prior Art Search Complete",
        description: `Found ${searchData.results_found} relevant patents`,
        variant: "default",
      });
      
    } catch (error: any) {
      console.error('Error performing patent search:', error);
      toast({
        title: "Error performing patent search",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSearchingPriorArt(false);
    }
  };

  const proceedToCanvas = async () => {
    if (!id || generatingDraft) return;
    
    setGeneratingDraft(true);
    
    try {
      console.log('Starting patent draft generation...');
      
      // Call the edge function to generate patent draft (ENHANCED with iterative refinement)
      const { data, error } = await supabase.functions.invoke('generate-patent-draft-enhanced', {
        body: { session_id: id }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to generate patent draft');
      }

      if (!data?.success) {
        console.error('Patent generation failed:', data);
        throw new Error('Patent draft generation failed');
      }

      console.log('Patent draft generated successfully:', data);
      
      setChatPhase('canvas');
      await fetchSessionData();
      
      toast({
        title: "🎨 Enhanced Patent Draft Generated",
        description: `${data.sections_generated} sections created with ${data.iterations_per_section}x AI refinement for maximum quality`,
        variant: "default",
      });
      
    } catch (error: any) {
      console.error('Error generating patent draft:', error);
      toast({
        title: "Error generating patent draft",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setGeneratingDraft(false);
    }
  };

  const generatePatentSections = async () => {
    if (!id) return;
    
    try {
      console.log('Generating patent sections progressively...');
      
      // Call the edge function to generate patent sections based on current answers (ENHANCED)
      const { data, error } = await supabase.functions.invoke('generate-patent-draft-enhanced', {
        body: { session_id: id }
      });

      if (error) {
        console.error('Patent generation error:', error);
        // Don't throw error for progressive generation, just log it
        return;
      }

      if (data?.success) {
        console.log('Patent sections updated:', data);
        await fetchSessionData(); // Refresh the sections display
        
        // Show live update toast with model info
        const sectionUpdated = data.section_updated || 'section';
        const modelInfo = getModelInfoForToast(sectionUpdated);
        
        toast({
          title: `✍️ ${getSectionTitle(sectionUpdated)} Updated`,
          description: `${modelInfo.icon} ${modelInfo.model} analysis complete`,
          variant: "default",
        });
      }
      
    } catch (error: any) {
      console.error('Error in progressive patent generation:', error);
      // Don't show error toast for progressive generation to avoid spam
    }
  };

  const updateSection = async (sectionId: string, newContent: string) => {
    // Validate and sanitize content
    const sanitizedContent = sanitizeHtml(newContent);
    const validation = validatePatentSection(sanitizedContent);
    
    if (!validation.isValid) {
      toast({
        title: "Input Error",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('patent_sections')
        .update({ 
          content: sanitizedContent,
          is_user_edited: true 
        })
        .eq('id', sectionId);

      if (error) throw error;
      
      // Update local state
      setSections(sections.map(section => 
        section.id === sectionId 
          ? { ...section, content: sanitizedContent, is_user_edited: true }
          : section
      ));
      
    } catch (error: any) {
      toast({
        title: "Error updating section",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const getSectionTitle = (sectionType: string) => {
    const titles: Record<string, string> = {
      'abstract': 'Abstract',
      'field': 'Field of Invention',
      'background': 'Background',
      'summary': 'Summary of Invention',
      'claims': 'Claims',
      'drawings': 'Description of Drawings',
      'description': 'Detailed Description'
    };
    return titles[sectionType] || sectionType;
  };

  const formatSimilarityScore = (score: number) => {
    return `${Math.round(score * 100)}% similar`;
  };

  const getModelInfoForToast = (sectionType: string) => {
    const modelMap: Record<string, { model: string; icon: string }> = {
      'claims': { model: 'Mixtral 8x7B', icon: '🧠' },
      'abstract': { model: 'Ollama 8B', icon: '🕵️' },
      'field': { model: 'Phi-3', icon: '✍️' },
      'background': { model: 'Phi-3', icon: '✍️' },
      'summary': { model: 'Phi-3', icon: '✍️' },
      'drawings': { model: 'Ollama 8B', icon: '🕵️' },
      'description': { model: 'Phi-3', icon: '✍️' }
    };
    return modelMap[sectionType] || { model: 'AI Generated', icon: '🤖' };
  };

  const handleExportPatent = async () => {
    if (!id) return;

    setExportingPatent(true);
    
    try {
      console.log('Exporting patent document...');
      
      const { data, error } = await supabase.functions.invoke('export-patent', {
        body: { session_id: id }
      });

      if (error) {
        // If payment is required, show the gate instead of erroring out
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('payment required') || msg.includes('402')) {
          setShowPaymentGate(true);
          return;
        }
        console.error('Export error:', error);
        throw new Error(error.message || 'Failed to export patent');
      }

      if (!data?.success) {
        console.error('Export failed:', data);
        throw new Error('Export failed');
      }

      console.log('Patent exported successfully:', data);
      
      // Download the file reliably (signed URLs must not be modified)
      if (data.download_url) {
        const url = data.download_url as string;
        const hasQuery = url.includes('?');
        const isSigned = hasQuery && /(token|signature|expires|X-Amz|signed|credential)/i.test(url);
        const downloadUrl = isSigned ? url : (hasQuery ? `${url}&download=1` : `${url}?download=1`);
        try {
          const res = await fetch(downloadUrl);
          if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = 'Patent Application.docx';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(objectUrl);
        } catch (e) {
          // Fallback to navigation
          window.location.assign(downloadUrl);
        }
      }
      
      toast({
        title: "Export Complete",
        description: `Patent application exported with ${data.sections_exported} sections`,
        variant: "default",
      });
      
    } catch (error: any) {
      console.error('Error exporting patent:', error);
      toast({
        title: "Export Error",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setExportingPatent(false);
    }
  };

  const handleRegenerateSection = async (sectionType: string) => {
    if (!id || regeneratingSection) return;
    
    setRegeneratingSection(sectionType);
    
    try {
      console.log('Regenerating section:', sectionType);
      
      const { data, error } = await supabase.functions.invoke('enhance-patent-section', {
        body: { 
          session_id: id,
          section_type: sectionType
        }
      });

      if (error) {
        console.error('Section regeneration error:', error);
        throw new Error(error.message || 'Failed to regenerate section');
      }

      if (!data?.success) {
        console.error('Section regeneration failed:', data);
        throw new Error('Section regeneration failed');
      }

      console.log('Section regenerated successfully:', data);
      
      await fetchSessionData();
      
      toast({
        title: `✨ ${getSectionTitle(sectionType)} Enhanced`,
        description: `Generated using ${data.model_used} with ${data.content_length} chars`,
        variant: "default",
      });
      
    } catch (error: any) {
      console.error('Error regenerating section:', error);
      toast({
        title: "Regeneration Error",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setRegeneratingSection(null);
    }
  };

  const handleFilePatent = async () => {
    if (!id || filingPatent) return;
    
    // Check if payment is already completed before attempting to file
    if (!hasPaid) {
      setShowPaymentGate(true);
      return;
    }
    
    setFilingPatent(true);
    
    try {
      console.log('Filing patent application...');
      
      const { data, error } = await supabase.functions.invoke('file-patent', {
        body: { session_id: id }
      });

      if (error) {
        // Handle payment required error from server (double-check)
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('payment required') || msg.includes('402')) {
          setShowPaymentGate(true);
          return;
        }
        console.error('Filing error:', error);
        throw new Error(error.message || 'Failed to file patent');
      }

      if (!data?.success) {
        console.error('Filing failed:', data);
        throw new Error('Filing failed');
      }

      console.log('Patent filed successfully:', data);
      
      // Update local session status
      setPatentSession(prev => prev ? { ...prev, status: 'filed' } : null);
      
      // Open download link
      if (data.download_url) {
        window.open(data.download_url, '_blank');
      }
      
      toast({
        title: "🎉 Patent Filed Successfully!",
        description: "Your provisional patent application has been compiled with USPTO forms",
        variant: "default",
      });
      
    } catch (error: any) {
      console.error('Error filing patent:', error);
      toast({
        title: "Filing Error",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setFilingPatent(false);
    }
  };

  const handleAnalyzeGitHub = async () => {
    if (!id || !githubRepoUrl.trim() || analyzingGitHub) return;

    // Validate GitHub URL format
    const githubUrlRegex = /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;
    if (!githubUrlRegex.test(githubRepoUrl.trim())) {
      toast({
        title: "Invalid GitHub URL",
        description: "Please enter a valid GitHub repository URL (e.g., https://github.com/username/repo)",
        variant: "destructive",
      });
      return;
    }

    setAnalyzingGitHub(true);

    try {
      console.log('Analyzing GitHub repository:', githubRepoUrl);
      
      const { data, error } = await supabase.functions.invoke('analyze-code', {
        body: { 
          source: 'github',
          repo_url: githubRepoUrl.trim(),
          session_id: id
        }
      });

      if (error) {
        console.error('GitHub analysis error:', error);
        throw new Error(error.message || 'Failed to analyze GitHub repository');
      }

      if (!data?.success) {
        console.error('GitHub analysis failed:', data);
        throw new Error(data?.error || 'GitHub analysis failed');
      }

      console.log('GitHub analysis completed successfully:', data);
      
      toast({
        title: "🔗 GitHub Analysis Complete",
        description: `Analyzed ${data.files_analyzed} code files and generated ${data.questions_generated} technical questions`,
        variant: "default",
      });

      // Move to questioning phase and fetch updated data
      setChatPhase('questioning');
      await fetchSessionData();
      
      // Clear the GitHub URL input
      setGithubRepoUrl('');
      
    } catch (error: any) {
      console.error('Error analyzing GitHub repository:', error);
      toast({
        title: "GitHub Analysis Error",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setAnalyzingGitHub(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading patent session...</p>
        </div>
      </div>
    );
  }

  if (!patentSession) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Session not found</h2>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageSEO.Session />
      {/* Header - Mobile Optimized */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/dashboard')}
                className="p-2 flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-lg font-semibold truncate">
                  {patentSession.idea_prompt ? 
                    patentSession.idea_prompt.slice(0, 60) + (patentSession.idea_prompt.length > 60 ? '...' : '') :
                    'New Patent Application'
                  }
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Created {formatDate(patentSession.created_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {chatPhase === 'canvas' && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(`/session/${id}/claims`)}
                    size="sm"
                    className="hidden md:flex"
                  >
                    <TreeDeciduous className="h-4 w-4" />
                    <span className="hidden lg:inline ml-2">Claims Tree</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleExportPatent}
                    disabled={exportingPatent}
                    size="sm"
                    className="hidden md:flex"
                  >
                    {exportingPatent ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        <span className="hidden lg:inline ml-2">Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        <span className="hidden lg:inline ml-2">Download</span>
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      try {
                        const { data, error } = await supabase.functions.invoke('download-docx', {
                          body: { session_id: id }
                        });
                        
                        if (error) throw error;
                        
                        if (data) {
                          // Create blob and download
                          const blob = new Blob([data], { 
                            type: 'application/rtf' 
                          });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `patent-${id}.rtf`;
                          document.body.appendChild(a);
                          a.click();
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                        }
                      } catch (error: any) {
                        toast({
                          title: "Download Error",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                    className="hidden sm:flex"
                  >
                    <Download className="h-4 w-4" />
                    Download RTF
                  </Button>
                  <Button 
                    variant="gradient" 
                    onClick={handleFilePatent}
                    disabled={filingPatent || patentSession.status === 'filed'}
                    className="hidden sm:flex"
                  >
                    {filingPatent ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Filing...
                      </>
                    ) : patentSession.status === 'filed' ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Filed
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        File Patent
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="lg:flex lg:h-[calc(100vh-80px)]">
        {/* Left Panel - Chat */}
        <div className="w-full lg:w-1/2 lg:border-r border-b lg:border-b-0 bg-card/50 backdrop-blur-sm flex flex-col overflow-x-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                AI Patent Assistant
              </h2>
              <div className="flex items-center gap-1 bg-black/80 px-2 py-1 rounded-md">
                <span className="text-[#00e5ff] text-xs font-medium">Powered by XALON AI™</span>
                <img 
                  src="https://i.ibb.co/D210QCV/Only-Pro-Logo-Horizontal-Transparent-6.png" 
                  alt="XALON Logo" 
                  className="h-3 w-auto opacity-80" 
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {chatPhase === 'initial' && "Tell me about your invention idea"}
              {chatPhase === 'questioning' && "Let's gather more details about your invention"}
              {chatPhase === 'search' && "Patent search completed"}
              {chatPhase === 'canvas' && "Patent draft generated"}
            </p>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatPhase === 'initial' && (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-secondary rounded-lg p-3 max-w-[80%]">
                    <p className="text-sm">
                      Hi! I'm your AI patent assistant. Let's start by understanding your invention. 
                      Please describe your idea in detail - what does it do, how does it work, and what problem does it solve?
                    </p>
                  </div>
                </div>

                {/* GitHub Repository Option */}
                <div className="bg-card/80 border border-border rounded-lg p-4 space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    🔗 Link a GitHub Repo to Help Auto-Generate Patent
                    <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <Input
                    value={githubRepoUrl}
                    onChange={(e) => setGithubRepoUrl(e.target.value)}
                    placeholder="https://github.com/yourname/yourrepo"
                    className="transition-smooth focus:shadow-glow/20"
                    disabled={analyzingGitHub}
                  />
                  <Button 
                    onClick={handleAnalyzeGitHub}
                    disabled={!githubRepoUrl.trim() || analyzingGitHub}
                    variant="gradient"
                    size="sm"
                    className="w-full"
                  >
                    {analyzingGitHub ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Analyzing Repository...
                      </>
                    ) : (
                      <>
                        🔍 Analyze GitHub Repository with XALON AI™
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Show progress bar */}
            {questions.length > 0 && chatPhase === 'questioning' && (
              <div className="bg-card/80 border border-border rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Question Progress</span>
                  <span className="text-xs text-muted-foreground">
                    {questions.filter(q => q.answer).length} of {questions.length} answered
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-gradient-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(questions.filter(q => q.answer).length / questions.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Show only answered questions and current question */}
            {questions.map((question, index) => {
              const currentQuestionIndex = questions.findIndex(q => !q.answer);
              const isCurrentQuestion = index === currentQuestionIndex;
              const isAnswered = !!question.answer;
              
              // Only show answered questions and the current unanswered question
              if (!isAnswered && !isCurrentQuestion) return null;
              
              return (
                <div key={question.id} className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3 sm:p-4 max-w-[85%] sm:max-w-[80%]">
                      <p className="text-xs sm:text-sm break-words break-all sm:break-words">{question.question}</p>
                      {isCurrentQuestion && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          💡 Tip: Be specific about technical details, materials, and measurable improvements
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {question.answer && (
                    <div className="flex gap-3 justify-end">
                    <div className="bg-primary rounded-lg p-3 sm:p-4 max-w-[85%] sm:max-w-[80%] text-primary-foreground">
                      <p className="text-xs sm:text-sm break-words break-all sm:break-words">{question.answer}</p>
                    </div>
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <UserIcon className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {searchingPriorArt && (
              <SystemMessage
                type="loading"
                title="Prior Art Search in Progress"
                description="Searching patent databases using Lens.org API"
                details={[
                  "Analyzing invention claims",
                  "Searching global patent databases",
                  "Evaluating similarity scores",
                  "Generating overlap analysis"
                ]}
                progress={searchingPriorArt ? 50 : 100}
              />
            )}

            {generatingDraft && (
              <SystemMessage
                type="loading"
                title="Generating Patent Draft"
                description="Creating USPTO-compliant patent sections"
                details={[
                  "Legal-grade AI analysis",
                  "USPTO format validation",
                  "Claims structure optimization",
                  "Abstract and description generation"
                ]}
                progress={generatingDraft ? 75 : 100}
              />
            )}

            {filingPatent && (
              <SystemMessage
                type="loading"
                title="Filing Patent Application"
                description="Compiling USPTO forms and creating filing bundle"
                details={[
                  "Generating Form SB/16",
                  "Creating ADS form",
                  "Claims map analysis",
                  "Document compilation"
                ]}
                progress={filingPatent ? 90 : 100}
              />
            )}

            {exportingPatent && (
              <SystemMessage
                type="loading"
                title="Exporting Patent Document"
                description="Creating DOCX and uploading to storage"
                details={[
                  "Formatting USPTO document",
                  "Converting to DOCX",
                  "Uploading to secure storage",
                  "Generating download link"
                ]}
                progress={exportingPatent ? 85 : 100}
              />
            )}

            {chatPhase === 'search' && (
              <div className="space-y-4">
                <PriorArtDisplay 
                  priorArt={priorArt}
                  isSearching={searchingPriorArt}
                  onRetrySearch={performPriorArtSearch}
                />
                
                {!searchingPriorArt && (
                  <div className="flex justify-center">
                    <Button 
                      onClick={proceedToCanvas}
                      disabled={generatingDraft}
                      className="w-full max-w-md"
                    >
                      {generatingDraft ? (
                        <>
                          <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                          Generating Patent Draft...
                        </>
                      ) : (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          Proceed to Patent Canvas
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Area */}
          {(chatPhase === 'initial' || (chatPhase === 'questioning' && questions.some(q => !q.answer))) && (
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder={
                    chatPhase === 'initial' 
                      ? "Describe your invention idea..." 
                      : "Type your answer..."
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sendingMessage}
                  className="transition-smooth focus:shadow-glow/20"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!currentMessage.trim() || sendingMessage}
                  variant="gradient"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Patent Canvas */}
        <div className={`${chatPhase === 'canvas' ? 'w-full lg:w-1/2' : 'hidden lg:block lg:w-1/2'} bg-background/50 backdrop-blur-sm overflow-x-hidden`}>
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              PatentBot AI™
              {chatPhase !== 'canvas' && (
                <span className="text-xs text-muted-foreground ml-2">
                  (Will appear after search)
                </span>
              )}
            </h2>
          </div>

           {chatPhase === 'canvas' ? (
            <div className="overflow-y-auto h-[calc(100vh-160px)] p-4">
              <PatentCanvas
                sections={sections}
                onUpdateSection={updateSection}
                onRegenerateSection={handleRegenerateSection}
                isGenerating={regeneratingSection !== null}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[calc(100vh-160px)]">
              <div className="text-center text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>PatentBot AI™ will appear after completing the interview</p>
              </div>
            </div>
          )}
        </div>
        
      </div>

      {/* Payment Gate Dialog */}
      {id && (
        <PaymentGateDialog
          open={showPaymentGate}
          onOpenChange={setShowPaymentGate}
          applicationId={id}
          onPaymentSuccess={async () => {
            setHasPaid(true);
            await checkPaymentStatus();
            toast({
              title: "Payment successful!",
              description: "You can now export your patent application.",
            });
          }}
        />
      )}
    </div>
  );
};

// Patent Section Card Component
interface PatentSectionCardProps {
  title: string;
  content: string;
  isUserEdited: boolean;
  onUpdate: (content: string) => void;
  onRegenerate?: () => void;
  isGenerated: boolean;
  sectionType: string;
  timestamp?: string;
}

const PatentSectionCard: React.FC<PatentSectionCardProps> = ({ 
  title, 
  content, 
  isUserEdited, 
  onUpdate, 
  onRegenerate,
  isGenerated,
  sectionType,
  timestamp
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const handleSave = () => {
    onUpdate(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  // Map section types to models used in the AI chain
  const getModelInfo = (sectionType: string) => {
    const modelMap: Record<string, { model: string; icon: string; phase: string }> = {
      'claims': { model: 'Mixtral 8x7B', icon: '🧠', phase: 'Claims Expansion' },
      'abstract': { model: 'Ollama 8B', icon: '🕵️', phase: 'Prior Art Analysis' },
      'field': { model: 'Phi-3', icon: '✍️', phase: 'Legal Formatting' },
      'background': { model: 'Phi-3', icon: '✍️', phase: 'Legal Formatting' },
      'summary': { model: 'Phi-3', icon: '✍️', phase: 'Legal Formatting' },
      'drawings': { model: 'Ollama 8B', icon: '🕵️', phase: 'Prior Art Analysis' },
      'description': { model: 'Phi-3', icon: '✍️', phase: 'Legal Formatting' }
    };
    return modelMap[sectionType] || { model: 'AI Generated', icon: '🤖', phase: 'AI Processing' };
  };

  const modelInfo = getModelInfo(sectionType);
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

  if (!isGenerated) {
    return (
      <Card className="shadow-card border-0 bg-card/80 backdrop-blur-sm opacity-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {title}
            <span className="text-xs text-muted-foreground">(Pending)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted/20 rounded border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Content will be generated automatically</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-0 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2 mb-2">
              {title}
              {isUserEdited && (
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                  User Edited
                </span>
              )}
            </CardTitle>
            
            {/* Model and stats info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <span>{modelInfo.icon}</span>
                <span>{modelInfo.model}</span>
              </div>
              <span>•</span>
              <span>{wordCount} words</span>
              {timestamp && (
                <>
                  <span>•</span>
                  <span>{formatDateTime(timestamp)}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {onRegenerate && !isEditing && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onRegenerate}
                className="text-xs h-7"
              >
                Regenerate
              </Button>
            )}
            {!isEditing && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-7"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[120px] transition-smooth focus:shadow-glow/20"
            />
            <div className="flex gap-2">
              <Button 
                variant="gradient" 
                size="sm" 
                onClick={handleSave}
              >
                Save
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words break-all sm:break-words">
              {content || 'Content will be generated...'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Session;
