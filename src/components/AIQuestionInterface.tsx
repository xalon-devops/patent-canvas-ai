import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  MessageCircle, 
  Send, 
  Loader2, 
  CheckCircle,
  Brain,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SessionData {
  sessionId: string;
  patentType: string;
  ideaTitle: string;
  ideaDescription: string;
  githubUrl?: string;
  uploadedFiles: File[];
}

interface AIQuestion {
  id: string;
  question: string;
  answer: string;
}

interface AIQuestionInterfaceProps {
  sessionData: SessionData;
  onComplete: (questions: Array<{question: string; answer: string}>) => void;
}

const AIQuestionInterface: React.FC<AIQuestionInterfaceProps> = ({ 
  sessionData, 
  onComplete 
}) => {
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    generateAIQuestions();
  }, []);

  const generateAIQuestions = async () => {
    setIsGeneratingQuestions(true);
    try {
      // Use the existing ask-followups edge function
      const { data, error } = await supabase.functions.invoke('ask-followups', {
        body: {
          session_id: sessionData.sessionId,
          idea_prompt: `${sessionData.ideaTitle}: ${sessionData.ideaDescription}`,
          patent_type: sessionData.patentType,
          github_url: sessionData.githubUrl
        }
      });

      if (error) throw error;

      // Mock AI questions generation for now
      const mockQuestions: AIQuestion[] = [
        {
          id: '1',
          question: `What specific problem does your ${sessionData.patentType === 'software' ? 'software application' : 'invention'} solve that existing solutions don't address?`,
          answer: ''
        },
        {
          id: '2',
          question: `What are the key technical components or mechanisms that make your invention work?`,
          answer: ''
        },
        {
          id: '3',
          question: `How is your invention different from existing solutions in the market?`,
          answer: ''
        },
        {
          id: '4',
          question: `What are the main benefits or advantages your invention provides to users?`,
          answer: ''
        },
        {
          id: '5',
          question: `Are there any alternative ways to achieve the same result, and how does your approach compare?`,
          answer: ''
        }
      ];

      // Add patent-type specific questions
      if (sessionData.patentType === 'software') {
        mockQuestions.push({
          id: '6',
          question: 'What algorithms or computational methods are used in your software?',
          answer: ''
        });
        if (sessionData.githubUrl) {
          mockQuestions.push({
            id: '7',
            question: 'Which specific functions or modules in your code repository represent the core innovation?',
            answer: ''
          });
        }
      } else {
        mockQuestions.push({
          id: '6',
          question: 'What materials or components are used in your invention?',
          answer: ''
        });
        mockQuestions.push({
          id: '7',
          question: 'How is your invention manufactured or assembled?',
          answer: ''
        });
      }

      setQuestions(mockQuestions);
    } catch (error: any) {
      toast({
        title: "Error generating questions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsGeneratingQuestions(false);
    }
  };

  const handleAnswerSubmit = () => {
    if (!currentAnswer.trim()) {
      toast({
        title: "Answer required",
        description: "Please provide an answer before continuing.",
        variant: "destructive",
      });
      return;
    }

    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex].answer = currentAnswer.trim();
    setQuestions(updatedQuestions);
    setCurrentAnswer('');

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      // Convert to format expected by parent
      const questionAnswerPairs = questions.map(q => ({
        question: q.question,
        answer: q.answer
      }));

      // Save to database temporarily (we'll create the actual session later)
      toast({
        title: "Questions Complete!",
        description: "Moving to prior art analysis...",
        variant: "default",
      });

      onComplete(questionAnswerPairs);
    } catch (error: any) {
      toast({
        title: "Error saving answers",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      const currentQ = questions[currentQuestionIndex];
      currentQ.answer = currentAnswer;
      setCurrentAnswer(questions[currentQuestionIndex - 1].answer);
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6"
      >
        <div className="flex items-center justify-center gap-3">
          <Brain className="w-8 h-8 text-primary animate-pulse" />
          <Sparkles className="w-6 h-6 text-primary/60 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">AI is analyzing your invention...</h3>
          <p className="text-muted-foreground">
            Generating targeted questions to gather missing information
          </p>
        </div>
        <div className="w-16 h-1 bg-primary/20 rounded-full mx-auto overflow-hidden">
          <div className="w-full h-full bg-primary rounded-full animate-pulse"></div>
        </div>
      </motion.div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredQuestions = questions.filter(q => q.answer.trim()).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <MessageCircle className="w-8 h-8 text-primary" />
          <Brain className="w-6 h-6 text-primary/70" />
        </div>
        <h2 className="text-2xl font-bold mb-2">AI Assistant Q&A</h2>
        <p className="text-muted-foreground">
          Our AI has identified some gaps in your invention description. Please answer these targeted questions to complete your patent application.
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
          <span>{answeredQuestions} answered</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <motion.div 
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Current Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="w-5 h-5" />
                Question {currentQuestionIndex + 1}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg leading-relaxed">{currentQuestion?.question}</p>
            </CardContent>
          </Card>

          {/* Answer Input */}
          <div className="space-y-4">
            <label className="text-sm font-medium">Your Answer</label>
            <Textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Please provide a detailed answer..."
              className="min-h-[120px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleAnswerSubmit();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Tip: Press Ctrl+Enter to submit your answer quickly
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Answered Questions Summary */}
      {answeredQuestions > 0 && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Answered Questions ({answeredQuestions}/{questions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {questions.slice(0, currentQuestionIndex).map((q, index) => (
                <div key={q.id} className="text-xs p-2 bg-background/50 rounded">
                  <p className="font-medium text-muted-foreground">Q{index + 1}: {q.question}</p>
                  <p className="mt-1 truncate">{q.answer}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center pt-6">
        <Button
          variant="ghost"
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0}
          className="gap-2"
        >
          Previous Question
        </Button>

        <div className="flex gap-3">
          {currentQuestionIndex === questions.length - 1 ? (
            <Button 
              onClick={handleAnswerSubmit}
              disabled={submitting || !currentAnswer.trim()}
              className="gap-2 bg-gradient-to-r from-primary to-primary/80"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  Complete Q&A
                  <CheckCircle className="w-4 h-4" />
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleAnswerSubmit}
              disabled={!currentAnswer.trim()}
              className="gap-2"
            >
              Next Question
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AIQuestionInterface;