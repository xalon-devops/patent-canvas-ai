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
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { validateAiQuestion, validatePatentSection, sanitizeText, sanitizeHtml, createSafeErrorMessage } from '@/utils/security';

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
  const [chatPhase, setChatPhase] = useState<'initial' | 'questioning' | 'search' | 'canvas'>('initial');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchingPriorArt, setSearchingPriorArt] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  
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

          // Check if we have enough questions answered (let's say 3 for demo)
          const answeredCount = questions.filter(q => q.answer).length;
          
          if (answeredCount >= 3) {
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
      console.log('Calling search-prior-art edge function...');
      
      // Call the search-prior-art edge function
      const { data: searchData, error: searchError } = await supabase.functions.invoke('search-prior-art', {
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
      
      // Call the edge function to generate patent draft
      const { data, error } = await supabase.functions.invoke('generate-patent-draft', {
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
        title: "Patent Draft Generated",
        description: `Successfully generated ${data.sections_generated} patent sections`,
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
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/dashboard')}
                className="p-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">
                  {patentSession.idea_prompt ? 
                    patentSession.idea_prompt.slice(0, 60) + (patentSession.idea_prompt.length > 60 ? '...' : '') :
                    'New Patent Application'
                  }
                </h1>
                <p className="text-sm text-muted-foreground">
                  Created {format(new Date(patentSession.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {chatPhase === 'canvas' && (
                <Button variant="gradient" className="hidden sm:flex">
                  <Download className="h-4 w-4" />
                  File Patent
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Panel - Chat */}
        <div className="w-full lg:w-1/2 border-r bg-card/50 backdrop-blur-sm flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Patent Assistant
            </h2>
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
            )}

            {/* Show answered questions and current question only */}
            {questions.map((question, index) => {
              const currentQuestionIndex = questions.findIndex(q => !q.answer);
              const shouldShow = question.answer || index === currentQuestionIndex;
              
              if (!shouldShow) return null;
              
              return (
                <div key={question.id} className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-secondary rounded-lg p-3 max-w-[80%]">
                      <p className="text-sm">{question.question}</p>
                    </div>
                  </div>
                  
                  {question.answer && (
                    <div className="flex gap-3 justify-end">
                      <div className="bg-primary rounded-lg p-3 max-w-[80%] text-primary-foreground">
                        <p className="text-sm">{question.answer}</p>
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
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <div className="bg-secondary rounded-lg p-3 max-w-[80%]">
                  <p className="text-sm flex items-center gap-2">
                    <Search className="h-4 w-4 animate-spin" />
                    Searching for prior art and similar patents...
                  </p>
                </div>
              </div>
            )}

            {chatPhase === 'search' && priorArt.length > 0 && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-secondary rounded-lg p-3 max-w-[80%]">
                    <p className="text-sm">
                      I found {priorArt.length} related patents. Here are the most similar ones:
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pl-11">
                  {priorArt.map((art) => (
                    <Card key={art.id} className="shadow-card border-0 bg-card/80 backdrop-blur-sm">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-sm">{art.title}</CardTitle>
                            <CardDescription className="text-xs">
                              {art.publication_number} • {formatSimilarityScore(art.similarity_score)}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground mb-2">
                          {art.summary}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(art.url, '_blank')}
                          className="text-xs h-7"
                        >
                          <Eye className="h-3 w-3" />
                          View Patent
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-secondary rounded-lg p-3 max-w-[80%]">
                    <p className="text-sm mb-3">
                      Based on this analysis, your invention appears to have novel aspects. 
                      Would you like me to proceed with generating your patent draft?
                    </p>
                    <Button 
                      variant="gradient" 
                      size="sm"
                      onClick={proceedToCanvas}
                      disabled={generatingDraft}
                      className="min-w-[160px]"
                    >
                      {generatingDraft ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Yes, Proceed to Draft
                        </>
                      )}
                    </Button>
                  </div>
                </div>
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
        <div className={`${chatPhase === 'canvas' ? 'w-full lg:w-1/2' : 'hidden lg:block lg:w-1/2'} bg-background/50 backdrop-blur-sm`}>
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Patent Canvas
              {chatPhase !== 'canvas' && (
                <span className="text-xs text-muted-foreground ml-2">
                  (Will appear after search)
                </span>
              )}
            </h2>
          </div>

          {chatPhase === 'canvas' ? (
            <div className="overflow-y-auto h-[calc(100vh-160px)] p-4 space-y-4">
              {sectionTypes.map((sectionType) => {
                const section = sections.find(s => s.section_type === sectionType);
                return (
                  <PatentSectionCard
                    key={sectionType}
                    title={getSectionTitle(sectionType)}
                    content={section?.content || ''}
                    isUserEdited={section?.is_user_edited || false}
                    onUpdate={(newContent) => {
                      if (section) {
                        updateSection(section.id, newContent);
                      }
                    }}
                    isGenerated={!!section}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[calc(100vh-160px)]">
              <div className="text-center text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>Patent canvas will appear after completing the interview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Patent Section Card Component
interface PatentSectionCardProps {
  title: string;
  content: string;
  isUserEdited: boolean;
  onUpdate: (content: string) => void;
  isGenerated: boolean;
}

const PatentSectionCard: React.FC<PatentSectionCardProps> = ({ 
  title, 
  content, 
  isUserEdited, 
  onUpdate, 
  isGenerated 
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
            <p className="text-sm text-muted-foreground">Will be generated by AI</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-0 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {title}
            {isUserEdited && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                Edited
              </span>
            )}
          </CardTitle>
          {!isEditing && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
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
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {content || 'Content will be generated...'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Session;