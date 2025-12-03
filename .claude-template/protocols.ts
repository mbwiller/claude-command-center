/**
 * Claude Code Command Center - Protocol Type Definitions
 * Defines structured communication between agents for HackLearn Pro
 *
 * These types ensure consistent inter-agent messaging, quality gate
 * validation, and workflow tracking across all specialized agents.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CORE PROTOCOL TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Agent execution status
 */
export type AgentStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'blocked';

/**
 * Workflow phases across all agents
 */
export type WorkflowPhase =
  | 'initialization'
  | 'clarification'
  | 'planning'
  | 'execution'
  | 'synthesis'
  | 'review'
  | 'handoff';

/**
 * Quality gate threshold (0.8 = strict mode)
 */
export const QUALITY_GATE_THRESHOLD = 0.8;

/**
 * Inter-agent communication message
 */
export interface AgentMessage {
  status: AgentStatus;
  phase: WorkflowPhase;
  confidence: number; // 0.0-1.0
  timestamp: string;
  accumulated_data: Record<string, unknown>;
  quality_metrics: QualityMetrics;
  next_action?: NextAction;
  error?: AgentError;
}

/**
 * Quality metrics tracked throughout agent execution
 */
export interface QualityMetrics {
  coverage: number;    // 0.0-1.0 - How much of the task is addressed
  depth: number;       // 0.0-1.0 - How thoroughly explored
  confidence: number;  // 0.0-1.0 - Overall confidence in output
}

/**
 * Next action to be taken (for handoffs)
 */
export interface NextAction {
  agent: string;
  input_data: Record<string, unknown>;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Agent error information
 */
export interface AgentError {
  code: string;
  message: string;
  recoverable: boolean;
  suggestions: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUALITY GATE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quality gate names used across agents
 */
export type QualityGateName =
  // Research gates
  | 'input_clarity'
  | 'source_coverage'
  | 'synthesis_quality'
  // Implementation gates
  | 'requirements_clarity'
  | 'test_coverage'
  | 'code_quality'
  | 'no_regressions'
  // Review gates
  | 'review_completeness'
  | 'security_check'
  // Consensus gates
  | 'perspective_coverage'
  | 'decision_confidence'
  // Memory gates
  | 'memory_relevance';

/**
 * Quality gate definition
 */
export interface QualityGate {
  name: QualityGateName;
  threshold: number; // Default 0.8 for strict mode
  description: string;
  validator: (context: QualityGateContext) => QualityGateResult;
}

/**
 * Context passed to quality gate validator
 */
export interface QualityGateContext {
  session_id: string;
  agent_type: string;
  phase: WorkflowPhase;
  data: Record<string, unknown>;
  history?: AgentMessage[];
}

/**
 * Quality gate validation result
 */
export interface QualityGateResult {
  passed: boolean;
  score: number;      // 0.0-1.0
  feedback: string;
  suggestions?: string[];
  blocking?: boolean; // If true and failed, blocks workflow
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT-SPECIFIC TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Researcher agent output
 */
export interface ResearchOutput {
  query: string;
  refined_query?: string;
  findings: ResearchFinding[];
  recommendations: string[];
  trade_offs: TradeOff[];
  open_questions: string[];
  references: Reference[];
  confidence: number;
}

export interface ResearchFinding {
  title: string;
  description: string;
  evidence: string[];
  confidence: 'high' | 'medium' | 'low' | 'speculative';
  sources: string[];
}

export interface TradeOff {
  option: string;
  pros: string[];
  cons: string[];
  recommendation?: string;
}

export interface Reference {
  type: 'file' | 'url' | 'documentation' | 'code';
  path: string;
  description?: string;
}

/**
 * Implementer agent output
 */
export interface ImplementationOutput {
  task: string;
  files_modified: FileChange[];
  files_created: FileChange[];
  tests_added: string[];
  test_results: TestResult[];
  quality_checks: QualityCheck[];
  effort_level: 'simple' | 'medium' | 'complex';
  confidence: number;
}

export interface FileChange {
  path: string;
  change_type: 'create' | 'modify' | 'delete';
  description: string;
  lines_changed?: number;
}

export interface TestResult {
  test_name: string;
  passed: boolean;
  duration_ms?: number;
  error?: string;
}

export interface QualityCheck {
  check_name: string;
  passed: boolean;
  details: string;
}

/**
 * Reviewer agent output
 */
export interface ReviewOutput {
  scope: string;
  verdict: 'approve' | 'request_changes' | 'block';
  issues: ReviewIssue[];
  suggestions: ReviewSuggestion[];
  security_notes: SecurityNote[];
  commendations: string[];
  confidence: number;
}

export interface ReviewIssue {
  severity: 'blocker' | 'critical' | 'major' | 'minor';
  category: 'correctness' | 'security' | 'performance' | 'maintainability' | 'style';
  location: string;
  description: string;
  suggestion?: string;
}

export interface ReviewSuggestion {
  category: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SecurityNote {
  severity: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  remediation: string;
}

/**
 * Consensus agent output
 */
export interface ConsensusOutput {
  question: string;
  perspectives: Perspective[];
  decision_matrix: DecisionMatrix;
  recommendation: Recommendation;
  confidence: number;
}

export interface Perspective {
  name: string;
  viewpoint: string;
  pros: string[];
  cons: string[];
  weight: number; // 0.0-1.0
}

export interface DecisionMatrix {
  criteria: string[];
  options: string[];
  scores: Record<string, Record<string, number>>; // option -> criterion -> score
}

export interface Recommendation {
  choice: string;
  rationale: string;
  confidence_level: 'high' | 'medium' | 'low';
  risks: string[];
  next_steps: string[];
}

/**
 * Memory keeper output
 */
export interface MemoryOutput {
  operation: 'save' | 'recall' | 'summarize' | 'audit';
  category: MemoryCategory;
  entries: MemoryEntry[];
  relevance_score?: number;
}

export type MemoryCategory =
  | 'architectural_decisions'
  | 'patterns_learned'
  | 'bug_patterns'
  | 'metrics_baselines'
  | 'module_progress'
  | 'future_considerations'
  | 'session_insights'
  | 'tech_debt';

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  content: string;
  context: string;
  timestamp: string;
  relevance: number; // 0.0-1.0
  session_id?: string;
  tags: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDOFF TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Agent handoff document
 */
export interface AgentHandoff {
  from_agent: string;
  to_agent: string;
  handoff_type: 'task_delegation' | 'escalation' | 'completion' | 'consultation';
  context: {
    session_id: string;
    task_summary: string;
    key_findings: string[];
    confidence: number;
    quality_gates_passed: string[];
    quality_gates_failed: string[];
  };
  payload: Record<string, unknown>;
  priority: 'high' | 'medium' | 'low';
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROTOCOL EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Protocol event for observability
 */
export interface ProtocolEvent {
  session_id: string;
  agent_type: string;
  event_type: 'spawn' | 'progress' | 'complete' | 'error' | 'handoff' | 'gate';
  phase: WorkflowPhase;
  confidence: number;
  context: Record<string, unknown>;
  timestamp: string;
}

/**
 * Quality gate event for observability
 */
export interface QualityGateEvent {
  session_id: string;
  agent_type: string;
  gate_name: QualityGateName;
  passed: boolean;
  score: number;
  threshold: number;
  feedback: string;
  context: Record<string, unknown>;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if confidence meets threshold
 */
export function meetsThreshold(confidence: number, threshold = QUALITY_GATE_THRESHOLD): boolean {
  return confidence >= threshold;
}

/**
 * Determine action based on confidence level (strict mode: 0.8)
 */
export function getConfidenceAction(confidence: number): 'proceed' | 'clarify' | 'block' {
  if (confidence >= 0.8) return 'proceed';
  if (confidence >= 0.6) return 'clarify';
  return 'block';
}

/**
 * Create a quality gate result
 */
export function createGateResult(
  passed: boolean,
  score: number,
  feedback: string,
  suggestions?: string[]
): QualityGateResult {
  return {
    passed,
    score,
    feedback,
    suggestions,
    blocking: !passed && score < 0.6,
  };
}

/**
 * Create an agent message
 */
export function createAgentMessage(
  status: AgentStatus,
  phase: WorkflowPhase,
  confidence: number,
  data: Record<string, unknown> = {}
): AgentMessage {
  return {
    status,
    phase,
    confidence,
    timestamp: new Date().toISOString(),
    accumulated_data: data,
    quality_metrics: {
      coverage: confidence,
      depth: confidence,
      confidence,
    },
  };
}
