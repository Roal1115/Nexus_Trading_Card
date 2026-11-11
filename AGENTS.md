# Project rules (Geek Arena)

- Every code change follows `.claude/skills/ponytail/SKILL.md`: smallest complete change, reuse existing code, no speculative abstractions — keeps the codebase lean.
- Every UI/screen/component change also follows `.claude/skills/impeccable/SKILL.md` — consistent, intentional design.
- Any video/animation task routes through `.claude/skills/hyperframes/SKILL.md` first — framework-specific patterns are required.
- Use `/ponytail-review` or `/ponytail-audit` style checks before declaring larger changes done — catch bugs and bloat early.
- Register only `attachNexusAuth` for app server-function sessions; the unused Cloud auth attacher introduces an unnecessary dependency on Cloud environment variables.
