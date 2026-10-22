import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Gavel, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export interface ExaminerFinding {
  section: '101' | '102' | '103' | '112';
  severity: 'high' | 'medium' | 'low';
  affected_claims: number[];
  issue: string;
  suggested_fix: string;
}

export interface ExaminerReportData {
  overall_score: number;
  summary: string;
  findings: ExaminerFinding[];
}

const sectionLabel = (s: string) => {
  switch (s) {
    case '101':
      return '§101 Eligibility';
    case '102':
      return '§102 Novelty';
    case '103':
      return '§103 Obviousness';
    case '112':
      return '§112 Written Description';
    default:
      return `§${s}`;
  }
};

const severityStyle = (sev: string) => {
  if (sev === 'high') return 'bg-red-50 border-red-200 text-red-800';
  if (sev === 'medium') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-blue-50 border-blue-200 text-blue-800';
};

interface Props {
  report: ExaminerReportData | null;
  revisionCycles?: number;
}

const ExaminerReport: React.FC<Props> = ({ report, revisionCycles = 0 }) => {
  if (!report) return null;
  const findings = Array.isArray(report.findings) ? report.findings : [];

  const scoreColor =
    report.overall_score >= 85
      ? 'text-green-600'
      : report.overall_score >= 70
        ? 'text-yellow-600'
        : 'text-red-600';

  const ScoreIcon = report.overall_score >= 85 ? CheckCircle2 : report.overall_score >= 70 ? AlertTriangle : XCircle;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" />
              USPTO Examiner Simulation
            </CardTitle>
            <CardDescription>
              Simulated first-office-action review across §101, §102, §103, and §112.
              {revisionCycles > 0 && ` Auto-revised ${revisionCycles} time${revisionCycles > 1 ? 's' : ''}.`}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${scoreColor} flex items-center gap-1`}>
              <ScoreIcon className="h-6 w-6" />
              {report.overall_score}
            </div>
            <div className="text-xs text-muted-foreground">readiness score</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle className="text-sm">Overall assessment</AlertTitle>
          <AlertDescription className="text-sm">{report.summary}</AlertDescription>
        </Alert>

        {findings.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
            No significant examiner findings — the draft is in strong shape.
          </div>
        ) : (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Findings ({findings.length})</h4>
            {findings.map((finding, idx) => (
              <div key={idx} className={`rounded-md border p-3 ${severityStyle(finding.severity)}`}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className="text-xs bg-background">
                    {sectionLabel(finding.section)}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-background uppercase">
                    {finding.severity}
                  </Badge>
                  {Array.isArray(finding.affected_claims) && finding.affected_claims.length > 0 && (
                    <Badge variant="outline" className="text-xs bg-background">
                      Claims: {finding.affected_claims.join(', ')}
                    </Badge>
                  )}
                </div>
                <p className="text-xs font-medium mb-1">Issue:</p>
                <p className="text-xs mb-2">{finding.issue}</p>
                <p className="text-xs font-medium mb-1">Suggested fix:</p>
                <p className="text-xs">{finding.suggested_fix}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExaminerReport;
