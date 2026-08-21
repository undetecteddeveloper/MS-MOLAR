# Product Feature Brief: Non-Negotiable Core Engines for 2026 Vietnamese EdTech Platform

**To:** Claude Code (Lead AI & Innovation Architect)  
**From:** Growth & Product Marketing Team  
**Date:** August 2026  
**Subject:** Technical & Behavioral Requirements for the Two Core Platform Engines  
**Target Market:** Vietnam K-12 & Adult Professional EdTech (2026)  
**Document Status:** Ready for Sprint Planning & Architectural Scaffolding  

---

## 0. Engineering Scope Decision (2026-08-05)

**Decision:** For the September 2026 ship date, scope is cut to **Engine 1 only** (Feature Spec 1, §2). **Engine 2 (Feature Spec 2, §3) is deferred** — not part of this delivery.

**Why:**
- Delivery constraint: product must ship mid/late September 2026 (~6-7 weeks from this decision), with a single AI implementer (no other engineers) and no existing infrastructure for either engine (no knowledge graph, IRT, spaced repetition, vector DB, or exam-blueprint simulation yet).
- Attempting both engines in that window risked neither "working well" — the explicit bar set for this ship.
- Engine 1 alone, scoped as an MVP (see below), fits the timeline with real buffer for testing and polish.

**Engine 1 scope for this ship is also narrower than this document's original spec** — see the working plan for the authoritative cut list:
[Kế hoạch Engine 1: Adaptive AI & Feedback (Sprint 1) — Notion](https://app.notion.com/p/K-ho-ch-Engine-1-Adaptive-AI-Feedback-Sprint-1-3b378ba6ae1281619af0fc628a898d8d)

In short: heuristic adaptive routing (not calibrated IRT/CAT — no attempt data yet to calibrate against), and a Gemini-based Socratic tutor endpoint using direct context injection ("RAG-lite," not a vector-retrieval pipeline). Spaced repetition (FSRS) is also deferred.

**Revisit Engine 2** once Engine 1 has shipped and real usage/telemetry data exists — several of its KPIs (predicted-score accuracy, percentile rank) are meaningless without a real user base and calibration history anyway.

---

## 1. Strategic Context & Rationale

In the 2026 Vietnamese EdTech market (valued at ~$1.1B USD), **content is no longer a differentiator**. Video lectures, static PDFs, and generic question banks have become commoditized or freely available via open LLMs and community platforms.

Our market research indicates that user acquisition and willingness-to-pay are now driven strictly by two core friction points:
1. **Inefficiency of "One-Size-Fits-All" Learning:** Users drop out when forced through static linear courses that don't match their specific skill gaps.
2. **Lack of Direct Outcome Correlation:** Vietnamese learners (and paying parents) view education purely through high-stakes outcomes—passing standardized university entrance exams (TSA, V-SAT, ĐHQG Competency Evaluation) or acquiring job-ready skills with verifiable credentials.

To achieve product-market fit (PMF) and maximize LTV/CAC ratios, our Innovation/Engineering sprint must focus exclusively on building **two non-negotiable engines**:

```
+-----------------------------------------------------------------------+
|                       CORE PLATFORM ARCHITECTURE                      |
+-----------------------------------+-----------------------------------+
| ENGINE 1: Adaptive AI & Feedback  | ENGINE 2: Outcome-Aligned Engine  |
| - Knowledge Graph Profiling       | - Exam Blueprint Simulation       |
| - Sub-second AI Remediation       | - Dynamic Mastery Probability     |
| - Contextual Vietnamese RAG       | - Verifiable Micro-Credentials    |
+-----------------------------------+-----------------------------------+
```

---

## 2. Feature Spec 1: AI-Driven Adaptive Personalization & Instant Feedback Engine

### 2.1 Marketing & User Psychology
Vietnamese learners demand **instant gratification and anxiety reduction**. When stuck on a complex math problem (e.g., TSA logic questions) or a syntax error in coding, waiting for a human tutor or searching forums causes immediate drop-off. The platform must feel like an omnipresent, 1-on-1 private tutor.

### 2.2 Functional Requirements for Claude Code

#### A. Diagnostic & Adaptive Engine (Knowledge Graph Navigation)
* **Cold-Start Assessment:** A 5-minute dynamic placement test using Computer Adaptive Testing (CAT) logic (Item Response Theory - IRT) to establish a baseline score $\theta$.
* **Prerequisite Mapping:** Skills are represented as a Directed Acyclic Graph (DAG). If a student fails a target concept (e.g., *Logarithms in Calculus*), the system automatically backtracks to the foundational node (e.g., *Exponent Rules*).
* **Spaced Repetition Algorithm:** Integration of an open-source spaced repetition model (e.g., FSRS / SuperMemo-2 derivative) to queue review items based on user decay curves.

#### B. Sub-Second Remediation Pipeline (AI Tutor)
* **Multi-Modal Input:** Support text, LaTeX formulas, and image-based homework upload (OCR).
* **Contextual RAG Pipeline:** When a user clicks *"Explain this step"* or fails a question twice, the engine retrieves relevant lesson snippets and generates a step-by-step hint (Socratic method) rather than giving the direct answer immediately.
* **Tone & Language:** Native Vietnamese localization with an encouraging, concise tone optimized for mobile readability.

### 2.3 Proposed Data Structure & Data Flow

```json
{
  "user_id": "usr_vn_88203",
  "skill_node_id": "math_tsa_logic_301",
  "mastery_score": 0.42,
  "confidence_interval": [0.38, 0.46],
  "error_patterns": ["premise_inversion", "calculation_timeout"],
  "next_recommended_action": "MICRO_LESSON_REMEDIATION",
  "remediation_payload": {
    "target_concept": "Logical Invalidation",
    "suggested_format": "INTERACTIVE_EXERCISE",
    "estimated_minutes": 4
  }
}
```

### 2.4 Product & Growth KPIs
* **7-Day Retention Rate:** Target $\ge 42\%$ (vs. industry average $15\%$).
* **Average Remediation Latency:** $< 1.5$ seconds for AI hint response.
* **Session Completion Rate:** Target $\ge 80\%$ once adaptive feedback is triggered.

---

## 3. Feature Spec 2: Direct Outcome-Aligned Engine (Exams & Career Skills)

> **⚠️ DEFERRED — not in scope for September 2026 ship.** See §0. Kept here as reference for the next planning cycle.

### 3.1 Marketing & User Psychology
In Vietnam, educational spending is an investment with expected concrete ROI. Parents buy "university admission safety"; professionals buy "salary increases." Marketing cannot convert users on vague promises of "learning agility." The UI/UX must constantly show progress toward the target outcome.

### 3.2 Functional Requirements for Claude Code

#### A. High-Stakes Exam Simulation Module
* **Exam Engine Specs:** Mirror exact real-world exam conditions for key Vietnamese targets:
  * **TSA (Trường ĐH Bách khoa Hà Nội):** Thinking Skills Assessment format.
  * **ĐHQG Competency Evaluation (ĐGNL):** Multi-disciplinary speed test.
  * **V-SAT & Standardized High School Modules.**
* **Dynamic Analytics Dashboard:** Generate post-test diagnostic reports detailing:
  * Percentile rank against all platform users.
  * Predicted actual score with confidence intervals.
  * Time allocation heatmaps (time spent per question vs. target average).

#### B. Outcome Mapping & Micro-Credentials
* **Career Skill Trees (Upskilling):** Module structures mapped directly to industry job roles (e.g., *Data Analyst - Python*, *AI Prompt Engineer*).
* **Cryptographically Verifiable Certificates:** Upon achieving $>85\%$ mastery on final practical capstones, issue digital badges with verifiable metadata (Open Badges standard) for direct LinkedIn / CV embedding.

### 3.3 System Architecture Integration Flow

```
[ User Interaction / Mock Exam ]
              │
              ▼
  [ Engine 2: Exam Evaluator ]
              │
   ┌──────────┴──────────┐
   ▼                     ▼
[ Score Breakdown ]   [ Gap Identified ]
                         │
                         ▼
             [ Engine 1: Adaptive AI ] ──> [ Micro-remediation Loop ]
```

### 3.4 Product & Growth KPIs
* **Free-to-Paid Conversion:** Target $\ge 8.5\%$ on landing pages promising outcome guarantees.
* **Predicted vs. Actual Score Variance:** $\le \pm 5\%$ accuracy on mock exams compared to official test results.
* **CAC Payback Period:** $< 3.5$ months due to higher upfront willingness-to-pay for target-based packs.

---

## 4. Immediate Developer Backlog & Technical Guidance for Claude Code

To assist with initial implementation, here is the prioritized action plan for Innovation Sprints 1 & 2:

### Sprint 1: Core Engine Foundations
1. **Schema Definition:** Build PostgreSQL/MongoDB schema for `UserSkillGraph`, `ExamBlueprint`, and `TelemetryLog`.
2. **AI Tutor Endpoint:** Implement FastAIP/Python API wrapping LLM call with system prompt constraint enforce Socratic tutoring in Vietnamese (`/api/v1/tutor/explain`).
3. **Adaptive Routing Logic:** Write simple IRT algorithm or heuristic lookup table to select next question based on current item difficulty $b$ and user ability $\theta$.

### Sprint 2: UI Integration & Simulation Mock — **DEFERRED (Engine 2 scope, see §0)**
1. **Exam Interface:** Create an isolated React/Next.js dynamic mock exam UI with timer, flag-for-review, and split-screen passage reading.
2. **Diagnostic Report Generator:** Build visualization components for score breakdown radar charts and time-management heatmaps.

---

## 5. Summary & Collaboration Notes

* **Marketing Pitch Alignment:** Growth campaigns will center on *"Study 50% Less Time, Achieve 100% Target Score via Personal AI."*
* **Design Philosophy:** Keep user UI minimalist, fast (mobile-first), and distraction-free. Avoid vanity gamification; prioritize real progress feedback.
* **Next Step for Claude Code:** Please review the schema specs and draft the initial API contract for the Adaptive Remediation Engine (`/api/v1/adaptive/next-step`).

---
*End of Document*
