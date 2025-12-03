#!/usr/bin/env python3
"""
Quality Gate Validators for Claude Code Agent Protocols v2.0

This module provides validation functions for quality gates used across
all specialized agents. Quality gates ensure work meets the 0.8 (strict)
threshold before proceeding.

Usage:
    from quality_gates import validate_gate, QualityGateResult
    result = validate_gate("input_clarity", context_dict)
"""

import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, asdict

# Configuration
SERVER_URL = os.environ.get("OBSERVABILITY_SERVER", "http://localhost:4000")
EVENTS_ENDPOINT = f"{SERVER_URL}/events"
QUALITY_GATE_THRESHOLD = 0.8  # Strict mode

# ═══════════════════════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class QualityGateResult:
    """Result of a quality gate validation."""
    gate_name: str
    passed: bool
    score: float  # 0.0-1.0
    threshold: float
    feedback: str
    suggestions: List[str]
    blocking: bool  # If true and failed, blocks workflow

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)


@dataclass
class GateContext:
    """Context passed to gate validators."""
    session_id: str
    agent_type: str
    phase: str
    data: Dict[str, Any]
    history: Optional[List[Dict]] = None


# ═══════════════════════════════════════════════════════════════════════════════
# RESEARCHER AGENT GATES
# ═══════════════════════════════════════════════════════════════════════════════

def validate_input_clarity(ctx: GateContext) -> QualityGateResult:
    """
    Validate that the research query is clear and well-defined.

    Checks:
    - Query is not empty or too vague
    - Scope boundaries are identifiable
    - Success criteria can be inferred
    """
    data = ctx.data
    score = 0.0
    suggestions = []

    query = data.get("query", "")

    # Check query exists and has substance
    if not query:
        return QualityGateResult(
            gate_name="input_clarity",
            passed=False,
            score=0.0,
            threshold=QUALITY_GATE_THRESHOLD,
            feedback="No query provided",
            suggestions=["Provide a research question or topic"],
            blocking=True
        )

    # Score based on query characteristics
    word_count = len(query.split())

    # Base score from word count (5-50 words ideal)
    if word_count >= 5:
        score += 0.3
    if word_count >= 10:
        score += 0.2
    if word_count <= 100:  # Not too verbose
        score += 0.1

    # Check for question markers
    if any(q in query.lower() for q in ["how", "what", "why", "which", "when", "where", "can"]):
        score += 0.2
    else:
        suggestions.append("Consider framing as a question for clearer scope")

    # Check for specific technical terms (indicates focused query)
    tech_indicators = ["implement", "architecture", "pattern", "performance",
                       "security", "test", "api", "component", "database"]
    if any(t in query.lower() for t in tech_indicators):
        score += 0.2
    else:
        suggestions.append("Include specific technical terms to narrow scope")

    # Clamp score
    score = min(1.0, max(0.0, score))

    passed = score >= QUALITY_GATE_THRESHOLD

    return QualityGateResult(
        gate_name="input_clarity",
        passed=passed,
        score=score,
        threshold=QUALITY_GATE_THRESHOLD,
        feedback=f"Query clarity score: {score:.2f}" + (" - Passed" if passed else " - Needs clarification"),
        suggestions=suggestions if not passed else [],
        blocking=not passed and score < 0.6
    )


def validate_source_coverage(ctx: GateContext) -> QualityGateResult:
    """
    Validate that research has covered sufficient sources.

    Checks:
    - Minimum number of sources examined
    - Variety of source types
    - Codebase coverage for relevant areas
    """
    data = ctx.data
    score = 0.0
    suggestions = []

    sources_examined = data.get("sources_examined", 0)
    files_read = data.get("files_read", 0)
    web_sources = data.get("web_sources", 0)
    patterns_found = data.get("patterns_found", 0)

    # Score based on source count
    if sources_examined >= 3:
        score += 0.3
    if sources_examined >= 5:
        score += 0.2
    if sources_examined >= 10:
        score += 0.1

    # Source variety bonus
    if files_read > 0:
        score += 0.15
    else:
        suggestions.append("Search codebase for relevant patterns")

    if web_sources > 0:
        score += 0.1

    # Patterns found indicates depth
    if patterns_found >= 2:
        score += 0.15

    score = min(1.0, max(0.0, score))
    passed = score >= 0.7  # Slightly lower threshold for coverage

    return QualityGateResult(
        gate_name="source_coverage",
        passed=passed,
        score=score,
        threshold=0.7,
        feedback=f"Source coverage: {sources_examined} sources, {files_read} files, {web_sources} web" +
                 (" - Adequate" if passed else " - Needs more research"),
        suggestions=suggestions if not passed else [],
        blocking=False
    )


def validate_synthesis_quality(ctx: GateContext) -> QualityGateResult:
    """
    Validate that research synthesis is complete and actionable.

    Checks:
    - Findings are documented with evidence
    - Recommendations are provided
    - Trade-offs are analyzed
    - Confidence levels are assigned
    """
    data = ctx.data
    score = 0.0
    suggestions = []

    findings = data.get("findings", [])
    recommendations = data.get("recommendations", [])
    trade_offs = data.get("trade_offs", [])
    has_confidence = data.get("confidence") is not None

    # Findings quality
    if len(findings) >= 1:
        score += 0.2
    if len(findings) >= 3:
        score += 0.15
    else:
        suggestions.append("Document at least 3 key findings")

    # Recommendations present
    if len(recommendations) >= 1:
        score += 0.25
    else:
        suggestions.append("Provide actionable recommendations")

    # Trade-offs analyzed
    if len(trade_offs) >= 1:
        score += 0.2
    else:
        suggestions.append("Analyze trade-offs between approaches")

    # Confidence scoring
    if has_confidence:
        score += 0.2
    else:
        suggestions.append("Assign confidence level to recommendations")

    score = min(1.0, max(0.0, score))
    passed = score >= QUALITY_GATE_THRESHOLD

    return QualityGateResult(
        gate_name="synthesis_quality",
        passed=passed,
        score=score,
        threshold=QUALITY_GATE_THRESHOLD,
        feedback=f"Synthesis quality: {len(findings)} findings, {len(recommendations)} recommendations" +
                 (" - Ready for handoff" if passed else " - Needs refinement"),
        suggestions=suggestions if not passed else [],
        blocking=not passed and score < 0.6
    )


# ═══════════════════════════════════════════════════════════════════════════════
# IMPLEMENTER AGENT GATES
# ═══════════════════════════════════════════════════════════════════════════════

def validate_requirements_clarity(ctx: GateContext) -> QualityGateResult:
    """
    Validate that implementation requirements are clear.

    Checks:
    - Task is well-defined
    - Acceptance criteria are explicit
    - Scope is bounded
    """
    data = ctx.data
    score = 0.0
    suggestions = []

    task = data.get("task", "")
    acceptance_criteria = data.get("acceptance_criteria", [])
    scope = data.get("scope", {})

    # Task definition
    if task and len(task) > 10:
        score += 0.3
    else:
        suggestions.append("Provide clear task description")

    # Acceptance criteria
    if len(acceptance_criteria) >= 1:
        score += 0.2
    if len(acceptance_criteria) >= 3:
        score += 0.15
    else:
        suggestions.append("Define explicit acceptance criteria")

    # Scope boundaries
    if scope.get("files") or scope.get("modules"):
        score += 0.2
    else:
        suggestions.append("Identify files/modules in scope")

    # Edge cases identified
    if data.get("edge_cases"):
        score += 0.15

    score = min(1.0, max(0.0, score))
    passed = score >= QUALITY_GATE_THRESHOLD

    return QualityGateResult(
        gate_name="requirements_clarity",
        passed=passed,
        score=score,
        threshold=QUALITY_GATE_THRESHOLD,
        feedback=f"Requirements clarity: {len(acceptance_criteria)} criteria defined" +
                 (" - Ready to implement" if passed else " - Needs clarification"),
        suggestions=suggestions if not passed else [],
        blocking=not passed and score < 0.6
    )


def validate_code_quality(ctx: GateContext) -> QualityGateResult:
    """
    Validate implementation code quality.

    Checks:
    - TypeScript types are comprehensive
    - Error handling is present
    - No debug code left behind
    - Follows project patterns
    """
    data = ctx.data
    score = 0.0
    suggestions = []

    checks = data.get("quality_checks", {})

    # TypeScript types
    if checks.get("typescript_types", False):
        score += 0.25
    else:
        suggestions.append("Add comprehensive TypeScript types")

    # Error handling
    if checks.get("error_handling", False):
        score += 0.25
    else:
        suggestions.append("Add error handling for edge cases")

    # No debug code
    if checks.get("no_debug_code", True):
        score += 0.15
    else:
        suggestions.append("Remove console.log and debug statements")

    # Follows patterns
    if checks.get("follows_patterns", False):
        score += 0.2
    else:
        suggestions.append("Ensure code follows existing project patterns")

    # Comments explain why
    if checks.get("comments_explain_why", False):
        score += 0.15

    score = min(1.0, max(0.0, score))
    passed = score >= QUALITY_GATE_THRESHOLD

    return QualityGateResult(
        gate_name="code_quality",
        passed=passed,
        score=score,
        threshold=QUALITY_GATE_THRESHOLD,
        feedback=f"Code quality score: {score:.2f}" +
                 (" - Quality standards met" if passed else " - Needs improvement"),
        suggestions=suggestions if not passed else [],
        blocking=not passed and score < 0.6
    )


def validate_test_coverage(ctx: GateContext) -> QualityGateResult:
    """
    Validate test coverage for implementation.

    Checks:
    - Tests exist for new code
    - Happy path covered
    - Edge cases tested
    - Error scenarios handled
    """
    data = ctx.data
    score = 0.0
    suggestions = []

    tests_added = data.get("tests_added", 0)
    coverage = data.get("coverage_percent", 0)
    test_types = data.get("test_types", {})

    # Tests exist
    if tests_added >= 1:
        score += 0.25
    if tests_added >= 3:
        score += 0.15
    else:
        suggestions.append("Add at least 3 tests for new functionality")

    # Coverage threshold
    if coverage >= 80:
        score += 0.25
    elif coverage >= 60:
        score += 0.15
        suggestions.append("Increase coverage to 80%+")
    else:
        suggestions.append(f"Test coverage ({coverage}%) below 60% threshold")

    # Test variety
    if test_types.get("happy_path"):
        score += 0.15
    else:
        suggestions.append("Add happy path tests")

    if test_types.get("edge_cases"):
        score += 0.1

    if test_types.get("error_handling"):
        score += 0.1

    score = min(1.0, max(0.0, score))
    passed = score >= QUALITY_GATE_THRESHOLD

    return QualityGateResult(
        gate_name="test_coverage",
        passed=passed,
        score=score,
        threshold=QUALITY_GATE_THRESHOLD,
        feedback=f"Test coverage: {tests_added} tests, {coverage}% coverage" +
                 (" - Well tested" if passed else " - Needs more tests"),
        suggestions=suggestions if not passed else [],
        blocking=False
    )


def validate_no_regressions(ctx: GateContext) -> QualityGateResult:
    """
    Validate that implementation doesn't break existing tests.

    Checks:
    - All existing tests pass
    - No new failures introduced
    """
    data = ctx.data

    tests_run = data.get("tests_run", 0)
    tests_passed = data.get("tests_passed", 0)
    tests_failed = data.get("tests_failed", 0)
    new_failures = data.get("new_failures", [])

    # This gate requires 100% pass rate
    if tests_run == 0:
        return QualityGateResult(
            gate_name="no_regressions",
            passed=False,
            score=0.0,
            threshold=1.0,
            feedback="No tests run - cannot verify regressions",
            suggestions=["Run test suite before completion"],
            blocking=True
        )

    pass_rate = tests_passed / tests_run if tests_run > 0 else 0

    if tests_failed > 0:
        return QualityGateResult(
            gate_name="no_regressions",
            passed=False,
            score=pass_rate,
            threshold=1.0,
            feedback=f"Regression detected: {tests_failed} test(s) failed",
            suggestions=[f"Fix failing test: {f}" for f in new_failures[:3]],
            blocking=True
        )

    return QualityGateResult(
        gate_name="no_regressions",
        passed=True,
        score=1.0,
        threshold=1.0,
        feedback=f"All {tests_run} tests pass - no regressions",
        suggestions=[],
        blocking=False
    )


# ═══════════════════════════════════════════════════════════════════════════════
# REVIEWER AGENT GATES
# ═══════════════════════════════════════════════════════════════════════════════

def validate_review_completeness(ctx: GateContext) -> QualityGateResult:
    """
    Validate that code review covered all dimensions.

    Checks:
    - Correctness reviewed
    - Security reviewed
    - Performance considered
    - Maintainability assessed
    - Test coverage verified
    """
    data = ctx.data
    score = 0.0
    suggestions = []

    dimensions = data.get("dimensions_reviewed", {})

    dimension_weights = {
        "correctness": 0.25,
        "security": 0.25,
        "performance": 0.20,
        "maintainability": 0.15,
        "test_coverage": 0.15
    }

    for dim, weight in dimension_weights.items():
        if dimensions.get(dim, False):
            score += weight
        else:
            suggestions.append(f"Review {dim} dimension")

    score = min(1.0, max(0.0, score))
    passed = score >= QUALITY_GATE_THRESHOLD

    reviewed_count = sum(1 for d in dimensions.values() if d)
    total_count = len(dimension_weights)

    return QualityGateResult(
        gate_name="review_completeness",
        passed=passed,
        score=score,
        threshold=QUALITY_GATE_THRESHOLD,
        feedback=f"Review completeness: {reviewed_count}/{total_count} dimensions" +
                 (" - Comprehensive review" if passed else " - Incomplete review"),
        suggestions=suggestions if not passed else [],
        blocking=False
    )


def validate_security_check(ctx: GateContext) -> QualityGateResult:
    """
    Validate security-specific review for HackLearn Pro.
    Higher threshold (0.9) for security-sensitive code.

    Checks:
    - Input validation present
    - Output encoding applied
    - Auth checks on protected routes
    - No sensitive data exposure
    - Injection prevention
    """
    data = ctx.data
    score = 0.0
    suggestions = []

    security_threshold = 0.9  # Higher for security
    checks = data.get("security_checks", {})

    security_items = {
        "input_validation": 0.25,
        "output_encoding": 0.2,
        "auth_checks": 0.25,
        "no_data_exposure": 0.15,
        "injection_prevention": 0.15
    }

    for item, weight in security_items.items():
        if checks.get(item, False):
            score += weight
        else:
            suggestions.append(f"Verify {item.replace('_', ' ')}")

    score = min(1.0, max(0.0, score))
    passed = score >= security_threshold

    return QualityGateResult(
        gate_name="security_check",
        passed=passed,
        score=score,
        threshold=security_threshold,
        feedback=f"Security score: {score:.2f}" +
                 (" - Security standards met" if passed else " - Security concerns found"),
        suggestions=suggestions if not passed else [],
        blocking=not passed  # Security failures always block
    )


# ═══════════════════════════════════════════════════════════════════════════════
# CONSENSUS AGENT GATES
# ═══════════════════════════════════════════════════════════════════════════════

def validate_decision_clarity(ctx: GateContext) -> QualityGateResult:
    """
    Validate that the decision question is well-framed.

    Checks:
    - Question is specific
    - Options are identified
    - Constraints are clear
    - Success criteria defined
    """
    data = ctx.data
    score = 0.0
    suggestions = []

    question = data.get("question", "")
    options = data.get("options", [])
    constraints = data.get("constraints", [])
    success_criteria = data.get("success_criteria", [])

    # Question clarity
    if question and len(question) > 20:
        score += 0.3
    else:
        suggestions.append("Provide a clear, specific decision question")

    # Options identified
    if len(options) >= 2:
        score += 0.25
    else:
        suggestions.append("Identify at least 2 options to evaluate")

    # Constraints documented
    if len(constraints) >= 1:
        score += 0.2
    else:
        suggestions.append("Document constraints affecting the decision")

    # Success criteria
    if len(success_criteria) >= 1:
        score += 0.25
    else:
        suggestions.append("Define what success looks like")

    score = min(1.0, max(0.0, score))
    passed = score >= QUALITY_GATE_THRESHOLD

    return QualityGateResult(
        gate_name="decision_clarity",
        passed=passed,
        score=score,
        threshold=QUALITY_GATE_THRESHOLD,
        feedback=f"Decision framing: {len(options)} options, {len(constraints)} constraints" +
                 (" - Well-framed" if passed else " - Needs refinement"),
        suggestions=suggestions if not passed else [],
        blocking=not passed and score < 0.6
    )


def validate_perspective_coverage(ctx: GateContext) -> QualityGateResult:
    """
    Validate that multiple perspectives have been considered.

    Checks:
    - All 6 perspectives analyzed
    - Each perspective has meaningful input
    - Weights are assigned appropriately
    """
    data = ctx.data
    score = 0.0
    suggestions = []

    perspectives = data.get("perspectives", {})
    required_perspectives = [
        "developer_experience",
        "architecture",
        "user_impact",
        "resource_cost",
        "security",
        "time_horizon"
    ]

    covered = 0
    for perspective in required_perspectives:
        if perspectives.get(perspective):
            covered += 1
            score += 1/6 * 0.9  # Each perspective worth ~15%
        else:
            suggestions.append(f"Analyze {perspective.replace('_', ' ')} perspective")

    # Bonus for weighted scoring
    if data.get("weights_assigned", False):
        score += 0.1

    score = min(1.0, max(0.0, score))
    passed = score >= QUALITY_GATE_THRESHOLD

    return QualityGateResult(
        gate_name="perspective_coverage",
        passed=passed,
        score=score,
        threshold=QUALITY_GATE_THRESHOLD,
        feedback=f"Perspective coverage: {covered}/6 perspectives analyzed" +
                 (" - Comprehensive analysis" if passed else " - Missing perspectives"),
        suggestions=suggestions if not passed else [],
        blocking=False
    )


def validate_decision_confidence(ctx: GateContext) -> QualityGateResult:
    """
    Validate confidence in the final recommendation.

    Checks:
    - Clear winner identified or tie-breaking rationale
    - Supporting evidence documented
    - Dissenting view acknowledged
    """
    data = ctx.data

    recommendation = data.get("recommendation", {})
    confidence = recommendation.get("confidence", 0)
    rationale = recommendation.get("rationale", "")
    dissenting_view = data.get("dissenting_view", "")

    suggestions = []

    # Base score from confidence
    score = confidence

    # Rationale quality
    if rationale and len(rationale) > 50:
        score = min(1.0, score + 0.1)
    else:
        suggestions.append("Provide detailed rationale for recommendation")

    # Dissenting view acknowledged
    if dissenting_view:
        score = min(1.0, score + 0.05)
    else:
        suggestions.append("Acknowledge strongest counter-argument")

    passed = score >= QUALITY_GATE_THRESHOLD

    confidence_level = "HIGH" if score >= 0.8 else "MEDIUM" if score >= 0.6 else "LOW"

    return QualityGateResult(
        gate_name="decision_confidence",
        passed=passed,
        score=score,
        threshold=QUALITY_GATE_THRESHOLD,
        feedback=f"Decision confidence: {confidence_level} ({score:.2f})" +
                 (" - Confident recommendation" if passed else " - Consider prototyping"),
        suggestions=suggestions if not passed else [],
        blocking=False
    )


# ═══════════════════════════════════════════════════════════════════════════════
# MEMORY KEEPER AGENT GATES
# ═══════════════════════════════════════════════════════════════════════════════

def validate_memory_relevance(ctx: GateContext) -> QualityGateResult:
    """
    Validate relevance of retrieved memories.
    Lower threshold (0.7) for relevance matching.

    Checks:
    - Matches address the query
    - Relevance scoring is accurate
    - Results are properly ranked
    """
    data = ctx.data

    matches = data.get("matches", [])
    query = data.get("query", "")
    top_relevance = data.get("top_relevance", 0)

    relevance_threshold = 0.7
    suggestions = []

    if not matches:
        return QualityGateResult(
            gate_name="memory_relevance",
            passed=False,
            score=0.0,
            threshold=relevance_threshold,
            feedback="No matching memories found",
            suggestions=["Broaden search terms", "Check alternative categories"],
            blocking=False
        )

    # Score based on top match relevance
    score = top_relevance

    # Bonus for multiple relevant matches
    high_relevance_count = sum(1 for m in matches if m.get("relevance", 0) >= 0.7)
    if high_relevance_count >= 2:
        score = min(1.0, score + 0.1)

    passed = score >= relevance_threshold

    if not passed:
        suggestions.append("Consider alternative search strategies")

    return QualityGateResult(
        gate_name="memory_relevance",
        passed=passed,
        score=score,
        threshold=relevance_threshold,
        feedback=f"Memory relevance: {len(matches)} matches, top relevance {top_relevance:.2f}" +
                 (" - Good matches" if passed else " - Low relevance"),
        suggestions=suggestions if not passed else [],
        blocking=False
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GATE REGISTRY AND VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

GATE_VALIDATORS: Dict[str, Callable[[GateContext], QualityGateResult]] = {
    # Researcher gates
    "input_clarity": validate_input_clarity,
    "source_coverage": validate_source_coverage,
    "synthesis_quality": validate_synthesis_quality,

    # Implementer gates
    "requirements_clarity": validate_requirements_clarity,
    "code_quality": validate_code_quality,
    "test_coverage": validate_test_coverage,
    "no_regressions": validate_no_regressions,

    # Reviewer gates
    "review_completeness": validate_review_completeness,
    "security_check": validate_security_check,

    # Consensus gates
    "decision_clarity": validate_decision_clarity,
    "perspective_coverage": validate_perspective_coverage,
    "decision_confidence": validate_decision_confidence,

    # Memory keeper gates
    "memory_relevance": validate_memory_relevance,
}


def validate_gate(gate_name: str, context: Dict[str, Any]) -> QualityGateResult:
    """
    Validate a quality gate by name.

    Args:
        gate_name: Name of the gate to validate
        context: Context dictionary containing validation data

    Returns:
        QualityGateResult with pass/fail status and feedback
    """
    if gate_name not in GATE_VALIDATORS:
        return QualityGateResult(
            gate_name=gate_name,
            passed=True,
            score=1.0,
            threshold=QUALITY_GATE_THRESHOLD,
            feedback=f"No validator defined for gate '{gate_name}' - auto-pass",
            suggestions=[],
            blocking=False
        )

    ctx = GateContext(
        session_id=context.get("session_id", "unknown"),
        agent_type=context.get("agent_type", "unknown"),
        phase=context.get("phase", "unknown"),
        data=context.get("data", {}),
        history=context.get("history")
    )

    return GATE_VALIDATORS[gate_name](ctx)


def emit_gate_event(result: QualityGateResult, agent_type: str) -> bool:
    """
    Emit quality gate result to observability server.

    Args:
        result: QualityGateResult to emit
        agent_type: Type of agent that triggered the gate

    Returns:
        True if event was sent successfully
    """
    session_id = os.environ.get("CLAUDE_SESSION_ID", f"session-{datetime.now().strftime('%Y%m%d-%H%M%S')}")

    event = {
        "source_app": "claude-code",
        "session_id": session_id,
        "hook_event_type": "QualityGate",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "agent_type": agent_type,
            **result.to_dict()
        }
    }

    try:
        data = json.dumps(event).encode("utf-8")
        req = urllib.request.Request(
            EVENTS_ENDPOINT,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status in (200, 201)
    except Exception:
        return False  # Silent failure


def get_confidence_action(confidence: float) -> str:
    """
    Determine action based on confidence level (strict mode: 0.8).

    Args:
        confidence: Confidence score 0.0-1.0

    Returns:
        Action string: 'proceed', 'clarify', or 'block'
    """
    if confidence >= 0.8:
        return "proceed"
    elif confidence >= 0.6:
        return "clarify"
    return "block"


# ═══════════════════════════════════════════════════════════════════════════════
# CLI INTERFACE
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    """CLI interface for quality gate validation."""
    import argparse

    parser = argparse.ArgumentParser(description="Validate Claude Code quality gates")
    parser.add_argument("--gate", required=True, help="Name of the gate to validate")
    parser.add_argument("--agent", required=True, help="Agent type triggering the gate")
    parser.add_argument("--emit", action="store_true", help="Emit result to observability server")
    args = parser.parse_args()

    # Read context from stdin
    try:
        if not sys.stdin.isatty():
            context = json.load(sys.stdin)
        else:
            context = {}
    except json.JSONDecodeError:
        context = {}

    context["agent_type"] = args.agent

    # Validate the gate
    result = validate_gate(args.gate, context)

    # Emit if requested
    if args.emit:
        emit_gate_event(result, args.agent)

    # Output result
    print(result.to_json())

    # Exit code based on pass/fail
    sys.exit(0 if result.passed else 1)


if __name__ == "__main__":
    main()
