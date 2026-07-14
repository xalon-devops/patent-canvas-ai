import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface IngestResult {
  success: boolean;
  inserted?: number;
  failed?: number;
  total?: number;
  errors?: string[];
  error?: string;
}

export function MpepKnowledgeBaseCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);

  const runIngest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-mpep", { body: {} });
      if (error) {
        setResult({ success: false, error: error.message });
      } else {
        setResult(data as IngestResult);
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6 border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          MPEP Knowledge Base
        </CardTitle>
        <CardDescription>
          Seeds the vector store with curated MPEP passages (§§ 101, 102, 103, 112) that ground the multi-agent drafting pipeline. Idempotent — safe to re-run.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={runIngest} disabled={loading} size="sm">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Embedding MPEP corpus…
            </>
          ) : (
            "Seed / Refresh MPEP Corpus"
          )}
        </Button>

        {result && (
          <div className="rounded-md border p-3 text-sm">
            {result.success ? (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Inserted {result.inserted} chunks
                {result.failed ? (
                  <Badge variant="destructive" className="ml-2">
                    {result.failed} failed
                  </Badge>
                ) : null}
              </div>
            ) : (
              <div className="flex items-start gap-2 text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{result.error ?? "Ingest failed"}</span>
              </div>
            )}
            {result.errors && result.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {result.errors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
