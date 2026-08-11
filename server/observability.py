import time

# Pricing rates per 1k tokens (USD) for model tiers
MODEL_PRICING = {
    "gpt-4o": {"input": 0.0025, "output": 0.0100},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "claude-3-5-sonnet": {"input": 0.0030, "output": 0.0150},
    "gemini-2.0-flash": {"input": 0.0001, "output": 0.0004},
    "default": {"input": 0.0020, "output": 0.0080}
}

class LLMObservabilityTracker:
    def __init__(self):
        self.reset()

    def reset(self):
        self.agent_runs = []
        self.total_prompt_tokens = 0
        self.total_completion_tokens = 0
        self.total_cost_usd = 0.0
        self.start_timestamp = None
        self.end_timestamp = None

    def start_pipeline(self):
        self.reset()
        self.start_timestamp = time.time()

    def record_agent_step(self, agent_name: str, model_name: str, input_text: str, output_text: str, duration_sec: float):
        # Heuristic token counting (~4 chars = 1 token for code/text)
        prompt_tokens = max(1, len(input_text) // 4)
        completion_tokens = max(1, len(output_text) // 4)

        pricing = MODEL_PRICING.get(model_name.lower(), MODEL_PRICING["default"])
        cost = ((prompt_tokens / 1000.0) * pricing["input"]) + ((completion_tokens / 1000.0) * pricing["output"])

        self.total_prompt_tokens += prompt_tokens
        self.total_completion_tokens += completion_tokens
        self.total_cost_usd += cost

        run_record = {
            "agent": agent_name,
            "model": model_name,
            "duration": round(duration_sec, 2),
            "promptTokens": prompt_tokens,
            "completionTokens": completion_tokens,
            "totalTokens": prompt_tokens + completion_tokens,
            "costUSD": round(cost, 6),
            "timestamp": time.time()
        }
        self.agent_runs.append(run_record)
        return run_record

    def get_summary(self):
        total_tokens = self.total_prompt_tokens + self.total_completion_tokens
        total_time = round(time.time() - self.start_timestamp, 2) if self.start_timestamp else 0.0
        
        return {
            "totalTokens": total_tokens,
            "promptTokens": self.total_prompt_tokens,
            "completionTokens": self.total_completion_tokens,
            "totalCostUSD": round(self.total_cost_usd, 4),
            "totalDuration": total_time,
            "stepCount": len(self.agent_runs),
            "steps": self.agent_runs
        }

telemetry_tracker = LLMObservabilityTracker()
