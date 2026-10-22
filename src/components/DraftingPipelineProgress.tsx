import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2, Circle, Sparkles } from 'lucide-react';

export type PipelineStepKey =
  | 'interview'
  | 'differentiation'
  | 'claim_architect'
  | 'spec_writer'
  | 'examiner'
  | 'revision';

export type PipelineStepStatus = 'pending' | 'running' | 'complete';

interface Props {
  open: boolean;
  currentStep: PipelineStepKey | 'done' | null;
  isRunning: boolean;
}

const STEPS: Array<{ key: PipelineStepKey; label: string; description: string }> = [
  { key: 'interview', label: 'Inventor Interview', description: 'Synthesizing your invention into a technical brief' },
  { key: 'differentiation', label: 'Prior Art Analysis', description: 'Identifying novelty anchors vs. existing patents' },
  { key: 'claim_architect', label: 'Claim Architect', description: 'Drafting structured claim tree' },
  { key: 'spec_writer', label: 'Specification Writer', description: 'Writing abstract, background, description' },
  { key: 'examiner', label: 'USPTO Examiner Simulation', description: 'Testing against §101, §102, §103, §112' },
  { key: 'revision', label: 'Revision Pass', description: 'Auto-fixing examiner findings' },
];

const stepOrder = (k: PipelineStepKey | 'done' | null): number => {
  if (k === null) return -1;
  if (k === 'done') return STEPS.length;
  return STEPS.findIndex((s) => s.key === k);
};

const DraftingPipelineProgress: React.FC<Props> = ({ open, currentStep, isRunning }) => {
  const currentIdx = stepOrder(currentStep);
  const progressPct = currentStep === 'done' ? 100 : Math.max(0, ((currentIdx + 1) / STEPS.length) * 100);

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Patent Drafting Pipeline
          </DialogTitle>
          <DialogDescription>
            Six specialized agents are drafting and examiner-testing your patent. This usually takes 45–90 seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Progress value={progressPct} className="h-2" />

          <div className="space-y-3">
            {STEPS.map((step, idx) => {
              let status: PipelineStepStatus = 'pending';
              if (idx < currentIdx || currentStep === 'done') status = 'complete';
              else if (idx === currentIdx && isRunning) status = 'running';

              return (
                <div key={step.key} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {status === 'complete' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    {status === 'running' && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
                    {status === 'pending' && <Circle className="h-5 w-5 text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1">
                    <div
                      className={`text-sm font-medium ${
                        status === 'complete'
                          ? 'text-green-700'
                          : status === 'running'
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DraftingPipelineProgress;
