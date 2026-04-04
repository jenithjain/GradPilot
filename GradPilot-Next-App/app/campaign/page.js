'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  Loader2,
  Coffee,
  Smartphone,
  Shirt,
  Lightbulb,
  FolderOpen,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCampaignStore } from '@/lib/store';
import { toast } from 'react-hot-toast';

const quickExamples = [
  {
    icon: Coffee,
    title: 'UK University Follow-up',
    brief: 'Create a follow-up email campaign for hot leads interested in UK universities for September 2026 intake. Focus on Russell Group universities, scholarship opportunities, and visa guidance for Indian students.',
  },
  {
    icon: Smartphone,
    title: 'IELTS Prep Nurture',
    brief: 'Design a nurture campaign for warm leads who are still preparing for IELTS. Include study tips, free resources, and information about Fateh Education IELTS/PTE training programs.',
  },
  {
    icon: Shirt,
    title: 'Ireland Intake Campaign',
    brief: 'Promote Ireland as a study destination for students targeting January 2027 intake. Highlight post-study work visa, affordable tuition, and partnerships with 120+ universities.',
  },
];

// Component that uses useSearchParams - must be wrapped in Suspense
function CampaignPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [brief, setBrief] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [autoEnhanced, setAutoEnhanced] = useState(false);
  const { 
    setBrief: setStoreBrief, 
    setStrategy, 
    setWorkflow, 
    setGeneratingStrategy,
    setGeneratingWorkflow,
    setError 
  } = useCampaignStore();

  // Auto-fill and enhance brief from URL params (from segmentation)
  useEffect(() => {
    const rawParam = searchParams.get('brief');
    if (rawParam && !autoEnhanced) {
      // URLSearchParams.get already returns a decoded string; avoid double decoding
      const segmentBrief = rawParam;
      setBrief(segmentBrief);
      setCharCount(segmentBrief.length);
      setAutoEnhanced(true);
      // Auto-trigger enhancement after small delay
      setTimeout(() => {
        handleEnhanceBrief(segmentBrief);
      }, 400);
    }
  }, [searchParams, autoEnhanced]);

  const handleBriefChange = (e) => {
    const text = e.target.value;
    setBrief(text);
    setCharCount(text.length);
  };

  const handleQuickExample = (exampleBrief) => {
    setBrief(exampleBrief);
    setCharCount(exampleBrief.length);
  };

  const handleEnhanceBrief = async (textToEnhance = null) => {
    const text = String(textToEnhance || brief || '');
    if (text.trim().length < 10) {
      toast.error('Please provide at least a basic description (minimum 10 characters)');
      return;
    }

    setIsEnhancing(true);

    try {
      const response = await fetch('/api/campaign/enhance-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text }),
      });

      if (!response.ok) {
        throw new Error('Failed to enhance brief');
      }

      const data = await response.json();
      setBrief(data.enhancedBrief);
      setCharCount(data.enhancedBrief.length);
      if (data.fallback) {
        toast('⚠️ Used fallback enhancement (AI parse issue).', { icon: '⚠️' });
      } else {
        toast.success('✨ Brief enhanced! You can edit it before generating the campaign.');
      }
    } catch (error) {
      console.error('Error enhancing brief:', error);
      toast.error('Failed to enhance brief. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerateWorkflow = async () => {
    if (brief.trim().length < 50) {
      toast.error('Please provide a more detailed campaign brief (at least 50 characters)');
      return;
    }

    setStoreBrief(brief);
    setGeneratingStrategy(true);

    try {
      // Step 1: Generate Strategy
      const strategyResponse = await fetch('/api/campaign/generate-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      });

      if (!strategyResponse.ok) {
        throw new Error('Failed to generate strategy');
      }

      const strategyData = await strategyResponse.json();
      setStrategy(strategyData);
      setGeneratingStrategy(false);

      // Step 2: Generate Workflow
      setGeneratingWorkflow(true);

      const workflowResponse = await fetch('/api/campaign/generate-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rationale: strategyData.rationale,
          brief 
        }),
      });

      if (!workflowResponse.ok) {
        throw new Error('Failed to generate workflow');
      }

      const workflowData = await workflowResponse.json();
      setWorkflow(workflowData.nodes, workflowData.edges);
      setGeneratingWorkflow(false);

      // Navigate to canvas
      router.push('/campaign/canvas');

    } catch (error) {
      console.error('Error generating campaign:', error);
      setError(error.message);
      setGeneratingStrategy(false);
      setGeneratingWorkflow(false);
      toast.error('Failed to generate campaign. Please try again.');
    }
  };

  const { isGeneratingStrategy, isGeneratingWorkflow } = useCampaignStore();
  const isLoading = isGeneratingStrategy || isGeneratingWorkflow;

  // Saved workflows state
  const [savedWorkflows, setSavedWorkflows] = useState([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/workflows/list');
        const json = await res.json();
        if (json.success) setSavedWorkflows(json.workflows || []);
      } catch {}
      setIsLoadingWorkflows(false);
    })();
  }, []);

  const handleLoadWorkflow = (wf) => {
    if (wf.brief) setStoreBrief(wf.brief);
    if (wf.strategyRationale) setStrategy({ rationale: wf.strategyRationale });
    setWorkflow(wf.nodes || [], wf.edges || []);
    toast.success('Workflow loaded');
    router.push('/campaign/canvas');
  };

  // Import workflow JSON (drag/drop or file input)
  const handleImportFile = (file) => {
    if (!file) return;
    if (!file.type.includes('json')) { toast.error('Please select a JSON file'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result));
        const briefValue = parsed.brief || '';
        const strategyObj = parsed.strategy || {};
        const workflowData = parsed.workflow || parsed; // allow direct {nodes,edges}
        const rawNodes = workflowData.nodes || [];
        const rawEdges = workflowData.edges || [];
        if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) { toast.error('Invalid workflow structure'); return; }
        if (briefValue) setStoreBrief(briefValue);
        if (strategyObj.rationale || parsed.strategyRationale) {
          setStrategy({ rationale: strategyObj.rationale || parsed.strategyRationale });
        }
        setWorkflow(rawNodes, rawEdges);
        toast.success('Workflow imported');
        router.push('/campaign/canvas');
      } catch (err) {
        toast.error('Failed to parse workflow JSON');
      }
    };
    reader.readAsText(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    handleImportFile(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-transparent"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border bg-transparent"
      >
        <div className="max-w-7xl mx-auto px-14 py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI-Powered Campaign Generator</h1>
              <p className="text-sm text-muted-foreground">Share your vision, watch AI build a complete campaign workflow</p>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Input Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">Describe Your Campaign</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Share your marketing vision, and watch AI autonomously create a comprehensive campaign 
                strategy with research, creative assets, and distribution planning.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Campaign Brief
                </label>
                <span className="text-xs text-muted-foreground">
                  {charCount} characters
                </span>
              </div>
              
              <Textarea
                value={brief}
                onChange={handleBriefChange}
                placeholder="E.g., Launch a student outreach campaign targeting final-year engineering students in Maharashtra interested in UK postgraduate programs for September 2027 intake. Focus on scholarship availability, IELTS preparation support, and Fateh Education's 45,000+ placement track record..."
                className="min-h-[280px] text-sm bg-card border-border text-foreground resize-none"
                disabled={isLoading || isEnhancing}
              />
              
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground flex-1">
                  Include: target student segment, study destination, intake timing, key messaging, and outreach channels
                </p>
                <Button
                  onClick={handleEnhanceBrief}
                  disabled={isLoading || isEnhancing || brief.trim().length < 10}
                  variant="outline"
                  size="sm"
                  className="border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50 text-amber-600 dark:text-amber-400"
                >
                  {isEnhancing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Enhancing...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-3.5 h-3.5 mr-1.5" />
                      Get Idea
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Button
              onClick={handleGenerateWorkflow}
              disabled={isLoading || brief.trim().length < 50 || isEnhancing}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg hover:shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 h-12 text-base font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {isGeneratingStrategy && 'Formulating Strategy...'}
                  {isGeneratingWorkflow && 'Building Workflow...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Workflow
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11"
                onClick={() => document.getElementById('workflowImportInput')?.click()}
                disabled={isLoading}
              >
                Import Workflow
              </Button>
              <input
                id="workflowImportInput"
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => handleImportFile(e.target.files?.[0])}
              />
            </div>
          </motion.div>

          {/* Right: Quick Examples */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Quick Examples</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Click to use these example campaigns
              </p>
            </div>

            <div className="space-y-4">
              {quickExamples.map((example) => (
                <motion.button
                  key={example.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  onClick={() => handleQuickExample(example.brief)}
                  disabled={isLoading}
                  className="w-full p-5 rounded-xl border border-border bg-card hover:bg-accent hover:border-emerald-500/30 transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                      <example.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h4 className="font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {example.title}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {example.brief}
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Feature Highlights */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 p-6 rounded-xl border border-border bg-card"
            >
              <h4 className="font-semibold text-foreground mb-4">What You'll Get:</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>
                  <span>AI-powered strategic analysis and campaign concept</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>
                  <span>Audience intelligence and market research</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>
                  <span>Auto-generated copy, visuals, and creative assets</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>
                  <span>Distribution strategy and timeline planning</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>
                  <span>Interactive canvas to review and refine each element</span>
                </li>
              </ul>
            </motion.div>

            {/* Saved Workflows */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-6 p-6 rounded-xl border border-border bg-card"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <FolderOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Saved Workflows</h3>
                </div>
                {savedWorkflows.length > 0 && (
                  <span className="text-xs text-muted-foreground">{savedWorkflows.length} saved</span>
                )}
              </div>

              {isLoadingWorkflows ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : savedWorkflows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No saved workflows yet. Generate a campaign and save it from the canvas.
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {savedWorkflows.map((wf, i) => (
                    <button
                      key={wf._id ? String(wf._id) : `wf-${i}`}
                      onClick={() => handleLoadWorkflow(wf)}
                      className="w-full p-3 rounded-lg border border-border bg-muted/20 hover:bg-accent hover:border-emerald-500/30 transition-all duration-200 text-left group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {wf.brief || 'Untitled Workflow'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {new Date(wf.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              · {wf.nodes?.length || 0} nodes
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-500 transition-colors mt-0.5 shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// Wrap the component with Suspense boundary
export default function CampaignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    }>
      <CampaignPageContent />
    </Suspense>
  );
}
