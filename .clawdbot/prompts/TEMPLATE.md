# Prompt Template — Copy this for each new task

## Context
<!-- What customer/user requested this. Include any relevant history. -->
Customer: [name]
Request: [what they asked for]
Priority: [high/medium/low]

## Customer Config (if relevant)
<!-- Paste relevant config pulled from prod DB or vault -->

## Task
<!-- Clear, bounded description of what to implement -->

Implement [feature description].

Key requirements:
- [requirement 1]
- [requirement 2]
- [requirement 3]

## Files to Focus On
<!-- Point the agent to the right places. Don't make it hunt. -->
- `src/[path]` — [what it does]
- `src/[path]` — [what it does]

## Definition of Done
- [ ] Feature implemented and working
- [ ] Lint passes (`npm run lint`)
- [ ] Build passes (`npm run build`)
- [ ] Commit with message: `feat: [short description]`
- [ ] Push branch
- [ ] Open PR: `~/.clawdbot/scripts/create-pr.sh $(pwd) main`
- [ ] If UI changed: include screenshot in PR body

## Known Pitfalls
<!-- Anything the agent should know to avoid mistakes -->
- [pitfall 1]
