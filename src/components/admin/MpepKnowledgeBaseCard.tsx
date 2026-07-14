import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

interface IngestJob {
  id: string;
  status: string;
  current_stage: string | null;
  current_chapter: string | null;
  total_urls: number;
  scraped_urls: number;
  total_chunks: number;
  completed_chunks: number;
  failed_chunks: number;
  error_log: Array<{ message: string; at: string }>;
  started_at: string;
  completed_at: string | null;
}

export function MpepKnowledgeBaseCard() {
  const [loading, setLoading] = useState(false);
  const [totalInCorpus, setTotalInCorpus] = useState<number | null>(null);
  const [activeJob, setActiveJob] = useState<IngestJob | null>(null);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  // Load current corpus size
  useEffect(() => {
    void refreshCount();
  }, []);

  const refreshCount = async () => {
    const { count } = await supabase
      .from("mpep_chunks")
      .select("*", { count: "exact", head: true });
    setTotalInCorpus(count ?? 0);
  };

  // Subscribe to job updates
  useEffect(() => {
    if (!activeJob?.id) return;
    const channel = supabase
      .channel(`ingest-job-${activeJob.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ingest_jobs", filter: `id=eq.${activeJob.id}` },
        (payload) => {
          const next = payload.new as unknown as IngestJob;
          setActiveJob(next);
          if (next.status === "completed" || next.status === "completed_with_errors" || next.status === "failed") {
            setLoading(false);
            void refreshCount();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeJob?.id]);

  const runFullIngest = async () => {
    setLoading(true);
    setActiveJob(null);
    setSeedResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-mpep-full", { body: {} });
      if (error) {
        setSeedResult(`Error: ${error.message}`);
        setLoading(false);
        return;
      }
      const jobId = (data as { job_id?: string })?.job_id;
      if (!jobId) {
        setSeedResult("No job id returned");
        setLoading(false);
        return;
      }
      // Fetch initial row
      const { data: job } = await supabase.from("ingest_jobs").select("*").eq("id", jobId).single();
      if (job) setActiveJob(job as unknown as IngestJob);
    } catch (err) {
      setSeedResult(err instanceof Error ? err.message : "Failed");
      setLoading(false);
    }
  };

  const runSeed = async () => {
    setLoading(true);
    setSeedResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-mpep", { body: {} });
      if (error) {
        setSeedResult(`Error: ${error.message}`);
      } else {
        const r = data as { inserted?: number; failed?: number };
        setSeedResult(`Inserted ${r.inserted ?? 0} seed chunks${r.failed ? `, ${r.failed} failed` : ""}`);
        await refreshCount();
      }
    } catch (err) {
      setSeedResult(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const progressPct = activeJob && activeJob.total_chunks > 0
    ? Math.floor((activeJob.completed_chunks / activeJob.total_chunks) * 100)
    : activeJob && activeJob.total_urls > 0
    ? Math.floor((activeJob.scraped_urls / activeJob.total_urls) * 100)
    : 0;

  const jobDone = activeJob?.status === "completed" ||
    activeJob?.status === "completed_with_errors" ||
    activeJob?.status === "failed";

  return (
    <Card className="mb-6 border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          MPEP Knowledge Base
          {totalInCorpus !== null && (
            <Badge variant="secondary" className="ml-2">
              {totalInCorpus.toLocaleString()} chunks
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Grounds every drafting agent in real USPTO MPEP text plus landmark Federal Circuit precedent (Alice, KSR, Nautilus, Phillips, Ariad, and more). Retrieved via pgvector semantic search on every claim, spec, and examiner-simulation call.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={runFullIngest} disabled={loading} size="sm">
            {loading && !jobDone ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Building corpus…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Build Full MPEP Corpus (top-shelf)
              </>
            )}
          </Button>
          <Button onClick={runSeed} disabled={loading} size="sm" variant="outline">
            Quick seed (27 chunks)
          </Button>
        </div>

        {activeJob && (
          <div className="rounded-md border bg-background/60 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {jobDone ? (
                  activeJob.status === "failed" ? (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                )}
                <span className="font-medium capitalize">
                  {activeJob.current_stage?.replace(/_/g, " ") ?? "queued"}
                </span>
                {activeJob.current_chapter && !jobDone && (
                  <Badge variant="outline">{activeJob.current_chapter}</Badge>
                )}
              </div>
              <span className="text-muted-foreground">{progressPct}%</span>
            </div>
            <Progress value={progressPct} />
            <div className="grid grid-cols-3 gap-3 text-xs">
              <Stat label="URLs scraped" value={`${activeJob.scraped_urls}/${activeJob.total_urls}`} />
              <Stat label="Chunks embedded" value={`${activeJob.completed_chunks}/${activeJob.total_chunks}`} />
              <Stat
                label="Failed"
                value={String(activeJob.failed_chunks)}
                tone={activeJob.failed_chunks > 0 ? "warn" : "ok"}
              />
            </div>
            {activeJob.error_log && activeJob.error_log.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {activeJob.error_log.length} error{activeJob.error_log.length === 1 ? "" : "s"} (view)
                </summary>
                <ul className="mt-2 space-y-1 max-h-40 overflow-auto rounded bg-muted p-2">
                  {activeJob.error_log.slice(-15).map((e, i) => (
                    <li key={i} className="font-mono text-[10px]">• {e.message}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {seedResult && !activeJob && (
          <div className="rounded-md border p-3 text-sm text-muted-foreground">{seedResult}</div>
        )}

        <p className="text-xs text-muted-foreground">
          Full build takes ~10-20 min and uses Firecrawl + Gemini embedding credits. Safe to close this tab — progress is tracked in the database.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "ok" | "warn" }) {
  const color = tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-green-700" : "text-foreground";
  return (
    <div className="rounded border bg-background p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm font-medium ${color}`}>{value}</div>
    </div>
  );
}
