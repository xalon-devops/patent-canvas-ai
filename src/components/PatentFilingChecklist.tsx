import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  FileText, 
  DollarSign, 
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  required: boolean;
  link?: string;
  fee?: string;
}

interface PatentSection {
  section_type: string;
  content: string;
}

interface PatentFilingChecklistProps {
  sections: PatentSection[];
}

const REQUIRED_DOCUMENTS: ChecklistItem[] = [
  {
    id: 'specification',
    label: 'Specification (Detailed Description)',
    description: 'Written description of the invention including drawings references',
    required: true,
  },
  {
    id: 'claims',
    label: 'Claims',
    description: 'Define the scope of patent protection sought',
    required: true,
  },
  {
    id: 'abstract',
    label: 'Abstract',
    description: 'Brief summary of the invention (max 150 words)',
    required: true,
  },
  {
    id: 'drawings',
    label: 'Drawings/Figures',
    description: 'Required when necessary to understand the invention',
    required: false,
  },
  {
    id: 'oath',
    label: 'Oath/Declaration (Form PTO/AIA/01)',
    description: 'Inventor declaration that they are the original inventor',
    required: true,
    link: 'https://www.uspto.gov/sites/default/files/documents/aia0001.pdf',
  },
  {
    id: 'ads',
    label: 'Application Data Sheet (Form PTO/AIA/14)',
    description: 'Bibliographic information about the application',
    required: true,
    link: 'https://www.uspto.gov/sites/default/files/documents/aia0014.pdf',
  },
  {
    id: 'entity_status',
    label: 'Entity Status Certification',
    description: 'Micro, small, or large entity status for fee purposes',
    required: true,
  },
  {
    id: 'cover_sheet',
    label: 'Utility Patent Application Transmittal',
    description: 'Cover sheet identifying documents being filed',
    required: true,
    link: 'https://www.uspto.gov/sites/default/files/documents/sb0021.pdf',
  },
  {
    id: 'ids',
    label: 'Information Disclosure Statement (IDS)',
    description: 'List of prior art known to the applicant',
    required: false,
  },
  {
    id: 'power_of_attorney',
    label: 'Power of Attorney (if applicable)',
    description: 'Required if filing through a registered patent attorney',
    required: false,
  },
];

const USPTO_FEES: ChecklistItem[] = [
  {
    id: 'basic_filing',
    label: 'Basic Filing Fee',
    description: 'Required fee for filing a utility patent application',
    required: true,
    fee: '$320 (micro) / $640 (small) / $1,600 (large)',
  },
  {
    id: 'search_fee',
    label: 'Search Fee',
    description: 'Fee for USPTO to search prior art',
    required: true,
    fee: '$160 (micro) / $320 (small) / $800 (large)',
  },
  {
    id: 'examination_fee',
    label: 'Examination Fee',
    description: 'Fee for examination by a patent examiner',
    required: true,
    fee: '$180 (micro) / $360 (small) / $900 (large)',
  },
  {
    id: 'claims_excess',
    label: 'Excess Claims Fee',
    description: 'Fee for each independent claim over 3, and each claim over 20',
    required: false,
    fee: '$100-$480 per excess claim (varies by entity)',
  },
  {
    id: 'issue_fee',
    label: 'Issue Fee (upon allowance)',
    description: 'Fee paid when patent is allowed before issuance',
    required: true,
    fee: '$250 (micro) / $500 (small) / $1,000 (large)',
  },
  {
    id: 'publication_fee',
    label: 'Publication Fee',
    description: 'Fee for publication of the application',
    required: true,
    fee: '$0 (included in issue fee)',
  },
];

const SUBMISSION_STEPS: ChecklistItem[] = [
  {
    id: 'efs_account',
    label: 'Create USPTO.gov Account',
    description: 'Register for an account on USPTO.gov to access Patent Center',
    required: true,
    link: 'https://patentcenter.uspto.gov/',
  },
  {
    id: 'prepare_docs',
    label: 'Prepare All Required Documents',
    description: 'Ensure all documents are in PDF format and properly formatted',
    required: true,
  },
  {
    id: 'calculate_fees',
    label: 'Calculate Total Filing Fees',
    description: 'Use USPTO Fee Schedule to determine exact fees based on entity status',
    required: true,
    link: 'https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule',
  },
  {
    id: 'patent_center',
    label: 'Access Patent Center',
    description: 'Log in to Patent Center to begin electronic filing',
    required: true,
    link: 'https://patentcenter.uspto.gov/',
  },
  {
    id: 'new_application',
    label: 'Start New Application',
    description: 'Select "File a new patent application" and choose Utility Patent',
    required: true,
  },
  {
    id: 'upload_docs',
    label: 'Upload All Documents',
    description: 'Upload specification, claims, drawings, and forms',
    required: true,
  },
  {
    id: 'pay_fees',
    label: 'Pay Filing Fees',
    description: 'Submit payment via credit card, deposit account, or EFT',
    required: true,
  },
  {
    id: 'submit',
    label: 'Submit Application',
    description: 'Review all information and submit the application',
    required: true,
  },
  {
    id: 'confirmation',
    label: 'Save Filing Receipt',
    description: 'Download and save the electronic filing receipt with application number',
    required: true,
  },
];

export default function PatentFilingChecklist({ sections }: PatentFilingChecklistProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Auto-check documents based on available sections
  const autoCheckedDocs = useMemo(() => {
    const checked = new Set<string>();
    sections.forEach(section => {
      if (section.content && section.content.length > 50) {
        if (section.section_type === 'description') checked.add('specification');
        if (section.section_type === 'claims') checked.add('claims');
        if (section.section_type === 'abstract') checked.add('abstract');
        if (section.section_type === 'drawings') checked.add('drawings');
      }
    });
    return checked;
  }, [sections]);

  const toggleItem = (id: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
    }
    setCheckedItems(newChecked);
  };

  const isChecked = (id: string) => checkedItems.has(id) || autoCheckedDocs.has(id);

  const calculateProgress = (items: ChecklistItem[]) => {
    const total = items.filter(i => i.required).length;
    const checked = items.filter(i => i.required && isChecked(i.id)).length;
    return total > 0 ? Math.round((checked / total) * 100) : 0;
  };

  const docProgress = calculateProgress(REQUIRED_DOCUMENTS);
  const feeProgress = calculateProgress(USPTO_FEES);
  const stepProgress = calculateProgress(SUBMISSION_STEPS);
  const overallProgress = Math.round((docProgress + feeProgress + stepProgress) / 3);

  const renderChecklistItem = (item: ChecklistItem, showFee = false) => (
    <div key={item.id} className="flex items-start gap-2 py-1.5">
      <Checkbox
        id={item.id}
        checked={isChecked(item.id)}
        onCheckedChange={() => toggleItem(item.id)}
        className="mt-0.5 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <label 
            htmlFor={item.id}
            className={`text-xs sm:text-sm font-medium cursor-pointer ${isChecked(item.id) ? 'line-through text-muted-foreground' : ''}`}
          >
            {item.label}
          </label>
          {item.required && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 text-red-600 border-red-300">
              Req
            </Badge>
          )}
          {autoCheckedDocs.has(item.id) && (
            <Badge className="text-[10px] px-1 py-0 bg-green-100 text-green-700">
              ✓
            </Badge>
          )}
          {item.link && (
            <a 
              href={item.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        {item.description && (
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
        )}
        {showFee && item.fee && (
          <p className="text-[10px] sm:text-xs font-medium text-primary mt-0.5">{item.fee}</p>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500 text-white flex-shrink-0">
              <ClipboardList size={16} className="sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm sm:text-base">USPTO Filing Checklist</CardTitle>
              <CardDescription className="text-xs hidden sm:block">
                Documents, fees & submission steps
              </CardDescription>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1">
                  {overallProgress === 100 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="text-xs font-medium">{overallProgress}%</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Overall filing readiness</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Progress value={overallProgress} className="h-1.5 mt-2" />
      </CardHeader>

      <CardContent className="p-3 sm:p-4 pt-0">
        <Accordion type="multiple" defaultValue={['documents']} className="space-y-1">
          {/* Required Documents */}
          <AccordionItem value="documents" className="border rounded-lg px-2 sm:px-3">
            <AccordionTrigger className="hover:no-underline py-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-semibold">Documents</span>
                <Badge variant="secondary" className="ml-auto mr-1 text-[10px] px-1.5">
                  {docProgress}%
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <div className="space-y-0.5 divide-y">
                {REQUIRED_DOCUMENTS.map(item => renderChecklistItem(item))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* USPTO Fees */}
          <AccordionItem value="fees" className="border rounded-lg px-2 sm:px-3">
            <AccordionTrigger className="hover:no-underline py-2">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-3.5 h-3.5 text-green-500" />
                <span className="font-semibold">Fees</span>
                <Badge variant="secondary" className="ml-auto mr-1 text-[10px] px-1.5">
                  {feeProgress}%
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <div className="p-2 mb-2 bg-blue-50 rounded-md border border-blue-200 flex items-start gap-1.5">
                <Info className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-blue-700">
                  Micro = 80% off, Small = 50% off.{' '}
                  <a 
                    href="https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Fee schedule
                  </a>
                </p>
              </div>
              <div className="space-y-0.5 divide-y">
                {USPTO_FEES.map(item => renderChecklistItem(item, true))}
              </div>
              <div className="mt-2 p-2 bg-muted rounded-lg">
                <p className="text-xs font-medium">Estimated Total (Micro):</p>
                <p className="text-base font-bold text-primary">$910 - $1,160</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Submission Steps */}
          <AccordionItem value="steps" className="border rounded-lg px-2 sm:px-3">
            <AccordionTrigger className="hover:no-underline py-2">
              <div className="flex items-center gap-2 text-sm">
                <ClipboardList className="w-3.5 h-3.5 text-purple-500" />
                <span className="font-semibold">Steps</span>
                <Badge variant="secondary" className="ml-auto mr-1 text-[10px] px-1.5">
                  {stepProgress}%
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <div className="space-y-0.5">
                {SUBMISSION_STEPS.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                        {index + 1}
                      </span>
                      <Checkbox
                        id={item.id}
                        checked={isChecked(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                        className="flex-shrink-0"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <label 
                          htmlFor={item.id}
                          className={`text-xs sm:text-sm font-medium cursor-pointer ${isChecked(item.id) ? 'line-through text-muted-foreground' : ''}`}
                        >
                          {item.label}
                        </label>
                        {item.link && (
                          <a 
                            href={item.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-3 pt-3 border-t">
          <Button 
            variant="outline" 
            size="sm"
            className="w-full text-xs"
            onClick={() => window.open('https://patentcenter.uspto.gov/', '_blank')}
          >
            <ExternalLink className="w-3 h-3 mr-1.5" />
            Open USPTO Patent Center
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
