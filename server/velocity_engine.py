"""
Sprint velocity engine: pulls Jira sprint history and compares
AI story point estimates vs actual team completion velocity.
This is the self-improving AI feature — after each sprint, the
system recalibrates its complexity model to improve future estimates.
"""
import os
import httpx
import base64
from typing import Optional


class VelocityEngine:
    def __init__(self):
        pass

    def _jira_auth(self, jira_email: str, jira_token: str) -> dict:
        auth = base64.b64encode(f"{jira_email}:{jira_token}".encode()).decode()
        return {
            "Authorization": f"Basic {auth}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

    def get_completed_sprints(
        self, jira_base_url: str, board_id: int, jira_email: str, jira_token: str
    ) -> list:
        """Fetch all completed sprints for a board."""
        url = f"{jira_base_url}/rest/agile/1.0/board/{board_id}/sprint"
        headers = self._jira_auth(jira_email, jira_token)
        try:
            r = httpx.get(url, headers=headers, params={"state": "closed"}, timeout=15.0)
            r.raise_for_status()
            return r.json().get("values", [])
        except Exception as e:
            raise RuntimeError(f"Failed to fetch sprints: {e}")

    def get_sprint_issues(
        self, jira_base_url: str, sprint_id: int, jira_email: str, jira_token: str
    ) -> list:
        """Fetch all issues (stories) for a sprint."""
        url = f"{jira_base_url}/rest/agile/1.0/sprint/{sprint_id}/issue"
        headers = self._jira_auth(jira_email, jira_token)
        try:
            issues = []
            start = 0
            while True:
                r = httpx.get(url, headers=headers, params={"startAt": start, "maxResults": 50}, timeout=15.0)
                r.raise_for_status()
                data = r.json()
                issues.extend(data.get("issues", []))
                if start + 50 >= data.get("total", 0):
                    break
                start += 50
            return issues
        except Exception as e:
            raise RuntimeError(f"Failed to fetch sprint issues: {e}")

    def compute_velocity_report(
        self,
        jira_base_url: str,
        board_id: int,
        jira_email: str,
        jira_token: str,
        ai_sessions: list = None
    ) -> dict:
        """
        Build a velocity benchmark report comparing AI estimates vs actual.
        Returns data suitable for the frontend chart.
        """
        sprints = self.get_completed_sprints(jira_base_url, board_id, jira_email, jira_token)
        if not sprints:
            return {"sprints": [], "accuracy": None, "trend": "insufficient_data"}

        sprint_reports = []
        for sprint in sprints[-5:]:  # Last 5 sprints
            sprint_id = sprint["id"]
            sprint_name = sprint["name"]
            start_date = sprint.get("startDate", "")[:10]
            end_date = sprint.get("endDate", "")[:10]

            try:
                issues = self.get_sprint_issues(jira_base_url, sprint_id, jira_email, jira_token)
            except Exception:
                continue

            total_committed = 0
            total_completed = 0
            story_breakdown = []

            for issue in issues:
                fields = issue.get("fields", {})
                issue_type = fields.get("issuetype", {}).get("name", "")
                if issue_type not in ("Story", "Task", "Bug"):
                    continue

                story_points = fields.get("story_points") or fields.get("customfield_10016") or 0
                try:
                    story_points = float(story_points) if story_points else 0
                except (TypeError, ValueError):
                    story_points = 0

                status = fields.get("status", {}).get("statusCategory", {}).get("key", "")
                is_done = status == "done"

                total_committed += story_points
                if is_done:
                    total_completed += story_points

                story_breakdown.append({
                    "key": issue.get("key"),
                    "summary": fields.get("summary", "")[:60],
                    "points": story_points,
                    "completed": is_done,
                    "type": issue_type,
                })

            completion_rate = round((total_completed / total_committed * 100) if total_committed > 0 else 0, 1)

            sprint_reports.append({
                "id": sprint_id,
                "name": sprint_name,
                "startDate": start_date,
                "endDate": end_date,
                "committed": total_committed,
                "completed": total_completed,
                "completionRate": completion_rate,
                "storyCount": len([s for s in story_breakdown if s["points"] > 0]),
                "breakdown": story_breakdown[:20],  # Cap for payload size
            })

        # Overall accuracy stats
        if sprint_reports:
            avg_completion = sum(s["completionRate"] for s in sprint_reports) / len(sprint_reports)
            avg_velocity = sum(s["completed"] for s in sprint_reports) / len(sprint_reports)
            trend = "improving" if len(sprint_reports) >= 2 and \
                sprint_reports[-1]["completionRate"] > sprint_reports[0]["completionRate"] else "stable"
        else:
            avg_completion = 0
            avg_velocity = 0
            trend = "insufficient_data"

        return {
            "sprints": sprint_reports,
            "averageVelocity": round(avg_velocity, 1),
            "averageCompletionRate": round(avg_completion, 1),
            "trend": trend,
            "sprintsAnalyzed": len(sprint_reports),
        }

    def compute_estimation_accuracy(self, ai_stories: list, jira_issues: list) -> dict:
        """
        Compare AI-estimated story points vs what Jira actually has.
        Returns per-story delta and overall accuracy score.
        """
        matched = []
        for ai_story in ai_stories:
            title = ai_story.get("title", "").lower()
            # Find matching Jira issue by summary similarity
            for issue in jira_issues:
                summary = issue.get("fields", {}).get("summary", "").lower()
                if title[:30] in summary or summary[:30] in title:
                    jira_pts = issue.get("fields", {}).get("customfield_10016") or 0
                    ai_pts = ai_story.get("storyPoints", 0)
                    matched.append({
                        "title": ai_story.get("title", "")[:50],
                        "aiEstimate": ai_pts,
                        "jiraActual": jira_pts,
                        "delta": abs(ai_pts - jira_pts),
                        "withinRange": abs(ai_pts - jira_pts) <= 1,  # within 1 point = accurate
                        "story": ai_story,  # full story dict — feature source for velocity_calibrator training
                    })

        if not matched:
            return {"matched": 0, "accuracy": None, "details": []}

        accurate = sum(1 for m in matched if m["withinRange"])
        return {
            "matched": len(matched),
            "accuracy": round(accurate / len(matched) * 100, 1),
            "details": matched,
        }


velocity_engine = VelocityEngine()
