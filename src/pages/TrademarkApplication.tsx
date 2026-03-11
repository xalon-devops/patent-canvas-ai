import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PageSEO } from '@/components/SEO';
import {
  ArrowLeft, ArrowRight, Tag, Building2, FileText, Shield, Sparkles,
  Loader2, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { TRADEMARK_FILING_PRICE_DISPLAY } from '@/lib/pricingConstants';

const STEPS = [
  { id: 1, label: 'Mark Info', icon: Tag },
  { id: 2, label: 'Classification', icon: FileText },
  { id: 3, label: 'Owner', icon: Building2 },
  { id: 4, label: 'Specimen', icon: Shield },
  { id: 5, label: 'Review', icon: Sparkles },
];

const MARK_TYPES = [
  { value: 'wordmark', label: 'Word Mark', desc: 'Text only — protects the name regardless of font or style' },
  { value: 'design', label: 'Design Mark', desc: 'Logo or stylized design with or without text' },
  { value: 'combined', label: 'Combined Mark', desc: 'Text + design elements together' },
];

const FILING_BASES = [
  { value: 'use_in_commerce', label: 'Use in Commerce (1a)', desc: 'Already using this mark in business' },
  { value: 'intent_to_use', label: 'Intent to Use (1b)', desc: 'Plan to use but haven\'t started yet' },
];

const OWNER_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'corporation', label: 'Corporation' },
  { value: 'llc', label: 'LLC' },
  { value: 'partnership', label: 'Partnership' },
];

const ALL_NICE_CLASSES = [
  { value: '001', label: 'Class 1 — Chemicals' },
  { value: '003', label: 'Class 3 — Cosmetics' },
  { value: '005', label: 'Class 5 — Pharmaceuticals' },
  { value: '009', label: 'Class 9 — Software, Electronics' },
  { value: '014', label: 'Class 14 — Jewelry, Watches' },
  { value: '016', label: 'Class 16 — Paper, Printed' },
  { value: '018', label: 'Class 18 — Leather Goods, Bags' },
  { value: '020', label: 'Class 20 — Furniture' },
  { value: '021', label: 'Class 21 — Housewares' },
  { value: '025', label: 'Class 25 — Clothing' },
  { value: '028', label: 'Class 28 — Games, Toys' },
  { value: '029', label: 'Class 29 — Processed Foods' },
  { value: '030', label: 'Class 30 — Staple Foods' },
  { value: '032', label: 'Class 32 — Beverages' },
  { value: '033', label: 'Class 33 — Alcoholic Beverages' },
  { value: '035', label: 'Class 35 — Advertising, Business' },
  { value: '036', label: 'Class 36 — Financial Services' },
  { value: '038', label: 'Class 38 — Telecommunications' },
  { value: '041', label: 'Class 41 — Education, Entertainment' },
  { value: '042', label: 'Class 42 — Technology, SaaS' },
  { value: '043', label: 'Class 43 — Food Services' },
  { value: '044', label: 'Class 44 — Medical Services' },
  { value: '045', label: 'Class 45 — Legal, Security' },
];

interface GoodsService {
  class_number: string;
  class_name: string;
  goods_services: string;
  confidence?: number;
  reasoning?: string;
}

interface AiClassification {
  suggested_classes?: GoodsService[];
  filing_tips?: string[];
  potential_issues?: string[];
}

interface AiReview {
  overall_score?: number;
  readiness?: string;
  sections?: { name: string; status: string; score: number; feedback: string; suggestions?: string[] }[];
  filing_checklist?: { item: string; met: boolean; note?: string }[];
  estimated_office_action_risk?: string;
  risk_factors?: string[];
}

export default function TrademarkApplication() {
  const [step, setStep] = useState(1);
  const [appId, setAppId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step 1: Mark Info
  const [markName, setMarkName] = useState('');
  const [markType, setMarkType] = useState('wordmark');
  const [markDescription, setMarkDescription] = useState('');
  const [filingBasis, setFilingBasis] = useState('intent_to_use');
  const [firstUseDate, setFirstUseDate] = useState('');
  const [firstUseCommerceDate, setFirstUseCommerceDate] = useState('');

  // Step 2: Classification
  const [businessDescription, setBusinessDescription] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [goodsServices, setGoodsServices] = useState<GoodsService[]>([]);
  const [aiClassification, setAiClassification] = useState<AiClassification | null>(null);

  // Step 3: Owner
  const [ownerName, setOwnerName] = useState('');
  const [ownerType, setOwnerType] = useState('individual');
  const [ownerStreet, setOwnerStreet] = useState('');
  const [ownerCity, setOwnerCity] = useState('');
  const [ownerState, setOwnerState] = useState('');
  const [ownerZip, setOwnerZip] = useState('');
  const [ownerCountry, setOwnerCountry] = useState('US');

  // Step 4: Specimen
  const [specimenDescription, setSpecimenDescription] = useState('');
  const [specimenGuidance, setSpecimenGuidance] = useState<any>(null);

  // Step 5: Review
  const [aiReview, setAiReview] = useState<AiReview | null>(null);

  const progress = (step / STEPS.length) * 100;

  const saveApplication = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/auth'); return null; }

      const payload: any = {
        user_id: session.user.id,
        mark_name: markName,
        mark_type: markType,
        mark_description: markDescription,
        filing_basis: filingBasis,
        first_use_date: firstUseDate || null,
        first_use_commerce_date: firstUseCommerceDate || null,
        nice_classes: selectedClasses,
        goods_services: goodsServices,
        owner_name: ownerName,
        owner_type: ownerType,
        owner_address: { street: ownerStreet, city: ownerCity, state: ownerState, zip: ownerZip, country: ownerCountry },
        specimen_description: specimenDescription,
        step_completed: step,
        status: 'draft',
      };

      if (appId) {
        const { error } = await supabase
          .from('trademark_applications')
          .update(payload)
          .eq('id', appId);
        if (error) throw error;
        return appId;
      } else {
        const { data, error } = await supabase
          .from('trademark_applications')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        setAppId(data.id);
        return data.id;
      }
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const callTrademarkAI = async (action: string, extraData?: any) => {
    setAiLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/draft-trademark-application`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action,
            application_id: appId,
            data: extraData,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI request failed');
      return result;
    } catch (err: any) {
      toast({ title: 'AI Analysis Failed', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setAiLoading(false);
    }
  };

  const handleClassifyGoods = async () => {
    const result = await callTrademarkAI('classify_goods', {
      mark_name: markName,
      mark_description: markDescription,
      business_description: businessDescription,
    });
    if (result?.analysis) {
      setAiClassification(result.analysis);
      if (result.analysis.suggested_classes?.length > 0) {
        const newClasses = result.analysis.suggested_classes.map((c: GoodsService) => c.class_number);
        setSelectedClasses(prev => [...new Set([...prev, ...newClasses])]);
        setGoodsServices(result.analysis.suggested_classes);
      }
      toast({ title: 'AI Classification Complete', description: 'Review the suggested classes below.' });
    }
  };

  const handleSpecimenGuidance = async () => {
    const result = await callTrademarkAI('specimen_guidance', {
      mark_name: markName,
      mark_type: markType,
      nice_classes: selectedClasses,
      filing_basis: filingBasis,
    });
    if (result?.guidance) {
      setSpecimenGuidance(result.guidance);
    }
  };

  const handleReviewApplication = async () => {
    const savedId = await saveApplication();
    if (!savedId) return;
    const result = await callTrademarkAI('review_application');
    if (result?.review) {
      setAiReview(result.review);
    }
  };

  const nextStep = async () => {
    if (step === 1 && !markName.trim()) {
      toast({ title: 'Mark name required', variant: 'destructive' });
      return;
    }
    await saveApplication();
    if (step === 4) {
      setStep(5);
      setTimeout(() => handleReviewApplication(), 300);
    } else {
      setStep(s => Math.min(s + 1, STEPS.length));
    }
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  return (
    <div className="min-h-screen bg-background">
      <PageSEO.Check />

      {/* Header */}
      <header className="border-b border-border bg-card/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-3 gap-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-muted-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                Trademark Application
              </h1>
            </div>
            <Badge variant="outline" className="text-xs">{TRADEMARK_FILING_PRICE_DISPLAY} filing fee</Badge>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
        <Progress value={progress} className="h-1.5 mb-2" />
        <div className="flex justify-between mb-6">
          {STEPS.map(s => (
            <button
              key={s.id}
              onClick={() => s.id <= step && setStep(s.id)}
              className={`flex flex-col items-center gap-1 text-[10px] transition-colors ${
                s.id === step ? 'text-primary font-medium' :
                s.id < step ? 'text-muted-foreground cursor-pointer' : 'text-muted-foreground/40'
              }`}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-24">
        {/* Step 1: Mark Information */}
        {step === 1 && (
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Mark Information</CardTitle>
                <p className="text-sm text-muted-foreground">Define your trademark and filing basis.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Trademark Name *</label>
                  <Input value={markName} onChange={e => setMarkName(e.target.value)} placeholder='e.g. "BrightPath"' className="text-base" />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Mark Type</label>
                  <div className="space-y-2">
                    {MARK_TYPES.map(mt => (
                      <label key={mt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        markType === mt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                      }`}>
                        <input type="radio" name="markType" checked={markType === mt.value} onChange={() => setMarkType(mt.value)} className="mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{mt.label}</p>
                          <p className="text-xs text-muted-foreground">{mt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
                  <Textarea value={markDescription} onChange={e => setMarkDescription(e.target.value)} placeholder="Describe what the mark looks like, colors used, etc." rows={2} className="resize-none" />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Filing Basis</label>
                  <div className="space-y-2">
                    {FILING_BASES.map(fb => (
                      <label key={fb.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        filingBasis === fb.value ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                      }`}>
                        <input type="radio" name="filingBasis" checked={filingBasis === fb.value} onChange={() => setFilingBasis(fb.value)} className="mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{fb.label}</p>
                          <p className="text-xs text-muted-foreground">{fb.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {filingBasis === 'use_in_commerce' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">First Use Anywhere</label>
                      <Input type="date" value={firstUseDate} onChange={e => setFirstUseDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">First Use in Commerce</label>
                      <Input type="date" value={firstUseCommerceDate} onChange={e => setFirstUseCommerceDate(e.target.value)} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Classification */}
        {step === 2 && (
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Goods & Services Classification</CardTitle>
                <p className="text-sm text-muted-foreground">Describe your business and let AI suggest the right Nice Classes.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Business Description</label>
                  <Textarea
                    value={businessDescription}
                    onChange={e => setBusinessDescription(e.target.value)}
                    placeholder="Describe what your business does, what products/services you offer..."
                    rows={3} className="resize-none"
                  />
                </div>
                <Button onClick={handleClassifyGoods} disabled={aiLoading || !businessDescription.trim()} className="w-full btn-dark">
                  {aiLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Sparkles className="h-4 w-4" /> AI Classify Goods & Services</>}
                </Button>

                {aiClassification?.suggested_classes && aiClassification.suggested_classes.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-semibold text-foreground">AI-Suggested Classes</h4>
                    {aiClassification.suggested_classes.map((cls, i) => (
                      <Card key={i} className="border-primary/20 bg-primary/5">
                        <CardContent className="p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">Class {cls.class_number}</Badge>
                            {cls.confidence && <span className="text-xs text-muted-foreground">{Math.round(cls.confidence * 100)}% match</span>}
                          </div>
                          <p className="text-sm text-foreground">{cls.goods_services}</p>
                          {cls.reasoning && <p className="text-xs text-muted-foreground">{cls.reasoning}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {aiClassification?.filing_tips && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1"><Info className="h-3 w-3" /> Filing Tips</h4>
                    <ul className="space-y-1">
                      {aiClassification.filing_tips.map((tip, i) => (
                        <li key={i} className="text-xs text-muted-foreground">• {tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Select Nice Classes</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_NICE_CLASSES.map(cls => (
                      <Badge
                        key={cls.value}
                        variant={selectedClasses.includes(cls.value) ? 'default' : 'outline'}
                        className="cursor-pointer text-[10px] py-0.5 px-2"
                        onClick={() => setSelectedClasses(prev =>
                          prev.includes(cls.value) ? prev.filter(c => c !== cls.value) : [...prev, cls.value]
                        )}
                      >
                        {cls.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Owner */}
        {step === 3 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Trademark Owner</CardTitle>
              <p className="text-sm text-muted-foreground">Who will own this trademark?</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Owner Name *</label>
                <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Full legal name or business name" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Entity Type</label>
                <div className="flex flex-wrap gap-2">
                  {OWNER_TYPES.map(ot => (
                    <Badge
                      key={ot.value}
                      variant={ownerType === ot.value ? 'default' : 'outline'}
                      className="cursor-pointer text-xs py-1 px-3"
                      onClick={() => setOwnerType(ot.value)}
                    >
                      {ot.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Street Address</label>
                <Input value={ownerStreet} onChange={e => setOwnerStreet(e.target.value)} placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">City</label>
                  <Input value={ownerCity} onChange={e => setOwnerCity(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">State</label>
                  <Input value={ownerState} onChange={e => setOwnerState(e.target.value)} placeholder="CA" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">ZIP Code</label>
                  <Input value={ownerZip} onChange={e => setOwnerZip(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Country</label>
                  <Input value={ownerCountry} onChange={e => setOwnerCountry(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Specimen */}
        {step === 4 && (
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Specimen of Use</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {filingBasis === 'intent_to_use'
                    ? 'You\'ll need to submit a specimen later when you begin using the mark.'
                    : 'Provide evidence showing how you use the mark in commerce.'}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleSpecimenGuidance} disabled={aiLoading} variant="outline" className="w-full">
                  {aiLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Getting guidance...</> : <><Sparkles className="h-4 w-4" /> Get AI Specimen Guidance</>}
                </Button>

                {specimenGuidance?.specimen_types && (
                  <div className="space-y-2">
                    {specimenGuidance.specimen_types.map((st: any, i: number) => (
                      <div key={i} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-foreground">{st.type}</p>
                          <Badge variant={st.acceptability === 'high' ? 'default' : 'outline'} className="text-[10px]">
                            {st.acceptability} acceptability
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{st.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {specimenGuidance?.common_rejections && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-destructive mb-1">Common Rejections</h4>
                    <ul className="space-y-0.5">
                      {specimenGuidance.common_rejections.map((r: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground">• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Describe Your Specimen</label>
                  <Textarea
                    value={specimenDescription}
                    onChange={e => setSpecimenDescription(e.target.value)}
                    placeholder="Describe how you're using (or plan to use) this mark in commerce..."
                    rows={3} className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 5: AI Review */}
        {step === 5 && (
          <div className="space-y-5">
            {aiLoading && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-foreground font-medium">AI is reviewing your application...</p>
                  <p className="text-sm text-muted-foreground mt-1">Checking for completeness and potential office action risks</p>
                </CardContent>
              </Card>
            )}

            {aiReview && !aiLoading && (
              <>
                {/* Overall Score */}
                <Card className={aiReview.readiness === 'ready' ? 'border-green-500/30' : 'border-amber-500/30'}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Application Review</h3>
                        <p className="text-sm text-muted-foreground">AI assessment of your trademark filing</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-3xl font-bold ${
                          (aiReview.overall_score || 0) >= 80 ? 'text-green-500' :
                          (aiReview.overall_score || 0) >= 60 ? 'text-amber-500' : 'text-red-500'
                        }`}>{aiReview.overall_score || 0}</p>
                        <p className="text-[10px] text-muted-foreground">/ 100</p>
                      </div>
                    </div>
                    <Badge variant={aiReview.readiness === 'ready' ? 'default' : 'outline'} className="text-xs">
                      {aiReview.readiness === 'ready' ? '✓ Ready to File' :
                       aiReview.readiness === 'needs_work' ? '⚠ Needs Revisions' : '✗ Incomplete'}
                    </Badge>
                  </CardContent>
                </Card>

                {/* Sections */}
                {aiReview.sections?.map((section, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-foreground">{section.name}</h4>
                        <Badge variant={section.status === 'complete' ? 'default' : section.status === 'needs_revision' ? 'outline' : 'destructive'} className="text-[10px]">
                          {section.status === 'complete' ? <><CheckCircle className="h-3 w-3 mr-1" />Complete</> :
                           section.status === 'needs_revision' ? <><AlertTriangle className="h-3 w-3 mr-1" />Needs Work</> : 'Missing'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{section.feedback}</p>
                      {section.suggestions?.map((sug, j) => (
                        <p key={j} className="text-xs text-primary mt-1">→ {sug}</p>
                      ))}
                    </CardContent>
                  </Card>
                ))}

                {/* Risk */}
                {aiReview.estimated_office_action_risk && (
                  <Card className={
                    aiReview.estimated_office_action_risk === 'low' ? 'border-green-500/20' :
                    aiReview.estimated_office_action_risk === 'medium' ? 'border-amber-500/20' : 'border-red-500/20'
                  }>
                    <CardContent className="p-4">
                      <h4 className="text-sm font-semibold text-foreground mb-2">Office Action Risk</h4>
                      <Badge variant={aiReview.estimated_office_action_risk === 'low' ? 'default' : 'outline'}>
                        {aiReview.estimated_office_action_risk.toUpperCase()}
                      </Badge>
                      {aiReview.risk_factors?.map((rf, i) => (
                        <p key={i} className="text-xs text-muted-foreground mt-1">• {rf}</p>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Filing Checklist */}
                {aiReview.filing_checklist && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Filing Checklist</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      {aiReview.filing_checklist.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          {item.met ? <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />}
                          <div>
                            <span className="text-foreground">{item.item}</span>
                            {item.note && <span className="text-muted-foreground ml-1">— {item.note}</span>}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {!aiLoading && !aiReview && (
              <Card>
                <CardContent className="py-8 text-center">
                  <Button onClick={handleReviewApplication} className="btn-dark">
                    <Sparkles className="h-4 w-4" /> Run AI Review
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border p-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <Button variant="outline" onClick={prevStep} disabled={step === 1} className="h-10">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              onClick={nextStep}
              disabled={saving || aiLoading}
              className="btn-dark h-10 flex-1 max-w-xs"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> :
               step === STEPS.length ? 'Save Application' :
               <>{step === 4 ? 'Review' : 'Next'} <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </div>
        </div>
      </main>

      {/* Disclaimer */}
      <div className="max-w-3xl mx-auto px-4 pb-24 text-center">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          This tool assists with trademark application preparation. It is not a substitute for legal advice.
          Always consult a trademark attorney before filing with the USPTO.
        </p>
      </div>
    </div>
  );
}
