# Open-Source Integration Guide

This repo can integrate the recommended OSS stack incrementally.

## 1) OPA (Policy Engine) - Implemented

Current status:
- `ToolExecutor` can call OPA for allow/deny decisions before tool execution.
- Local capability checks still run first.
- OPA can fail-open or fail-closed.

Env vars:
- `POLICY_ENGINE=opa|local` (default: `local`)
- `OPA_POLICY_URL=http://localhost:8181`
- `OPA_POLICY_PATH=/v1/data/agents/allow` (default)
- `OPA_TIMEOUT_MS=3000` (default)
- `OPA_FAIL_OPEN=false` (default)

Expected OPA response formats:
- `{ "result": true }`
- `{ "result": { "allow": true, "reason": "..." } }`
- `{ "result": { "allowed": true, "reason": "..." } }`

Example Rego policy (`allow` package path matches default):
```rego
package agents.allow

default allow := false

allow if {
  input.toolName == "web_search"
}

allow if {
  input.toolName == "http_request"
  "network" in input.capabilities
}
```

## 2) Temporal (Durable Workflows) - Integrated (Dispatcher Mode)

Recommended install:
```bash
npm install @temporalio/client @temporalio/worker @temporalio/workflow
```

Current status:
- `TaskQueue.enqueue` can dispatch tasks to Temporal workflows when `ORCHESTRATION_ENGINE=temporal`.
- Local queue remains as automatic fallback if Temporal is unreachable.
- Framework now starts an embedded Temporal worker (`agentTaskWorkflow`) automatically when Temporal mode is enabled.

Env vars:
- `ORCHESTRATION_ENGINE=local|temporal` (default: `local`)
- `TEMPORAL_ADDRESS=localhost:7233` (default)
- `TEMPORAL_NAMESPACE=default` (default)
- `TEMPORAL_TASK_QUEUE=agent-framework` (default)
- `TEMPORAL_WORKFLOW_TYPE=agentTaskWorkflow` (default)
- `TEMPORAL_WORKFLOW_EXECUTION_TIMEOUT_MS=900000` (default)

Suggested first workflow:
- `AgentRunWorkflow`: receive input -> run agent loop -> wait for approval signal -> resume.
- Current shipped workflow: `agentTaskWorkflow` executes `agent_run` and `approval_resume` task types.

## 3) LangGraph (Planning/Control Graph) - Next

Recommended install:
```bash
npm install @langchain/langgraph @langchain/core
```

Integrate by:
- Keeping current `BaseAgent` as execution runtime.
- Adding LangGraph planner node(s) that produce structured tool plans.
- Feeding approved plans into existing execution loop.

## 4) OpenFGA (Fine-Grained AuthZ) - Integrated

Recommended install:
```bash
npm install @openfga/sdk
```

Current status:
- `ToolExecutor` can call OpenFGA after local capability + OPA checks.
- Supports delegation/message/integration tool object mapping.
- Added starter model files:
  - `openfga/model.dsl`
  - `openfga/model.json`
- Added bootstrap command to create store/model and optionally seed tuples from DB:
  - `npm run openfga:bootstrap`

Env vars:
- `AUTHZ_ENGINE=local|openfga` (default: `local`)
- `OPENFGA_API_URL`
- `OPENFGA_STORE_ID`
- `OPENFGA_MODEL_ID` (optional)
- `OPENFGA_API_TOKEN` (optional)
- `OPENFGA_FAIL_OPEN=false` (default)
- `OPENFGA_DEFAULT_RELATION=can_execute` (default)
- `OPENFGA_MODEL_FILE=openfga/model.json` (bootstrap script)
- `OPENFGA_SEED_FROM_DB=true` (bootstrap script)

## 5) Langfuse (LLM Observability) - Integrated

Recommended install:
```bash
npm install langfuse
```

Current status:
- `BaseAgent` emits run + tool traces via an observability adapter.
- No-op provider is default; Langfuse provider is enabled by config/env.

Env vars:
- `OBSERVABILITY_ENGINE=none|langfuse` (default: `none`)
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL` (optional)
- `LANGFUSE_FLUSH_AT=15` (default)
- `LANGFUSE_FLUSH_INTERVAL_MS=10000` (default)

## Suggested Integration Order
1. OPA (done)
2. Temporal worker/workflow implementation (next)
3. LangGraph planner integration (next)
