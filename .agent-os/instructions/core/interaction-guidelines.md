---
description: Core interaction guidelines for Claude Code Agent OS
version: 1.0
encoding: UTF-8
---

# Agent OS Interaction Guidelines

## Overview

These are fundamental interaction patterns that should be followed consistently across all Agent OS operations to ensure clear communication and user experience.

## User Attention and Notification

### Notification Sound Protocol

**IMPORTANT**: Always play a notification sound when requiring user attention or input.

#### When to Play Notification Sound

1. **Before asking questions** - Any time you need the user to make a decision or provide input
2. **When requesting confirmation** - Before proceeding with potentially destructive operations
3. **When encountering errors** - That require user intervention to resolve
4. **When task completion requires user choice** - Multiple valid next steps exist

#### How to Play Notification Sound

Use the system Glass sound for consistency:

```bash
afplay /System/Library/Sounds/Glass.aiff
```

#### Examples

**Before asking a question:**
```
[Play notification sound]
Should I proceed with the database migration or would you prefer to review the changes first?
```

**Before requesting confirmation:**
```
[Play notification sound]
This will delete all existing data. Are you sure you want to continue?
```

**When encountering blocking errors:**
```
[Play notification sound]
The tests are failing due to schema conflicts. How would you like me to proceed?
```

### Communication Patterns

#### Clear Status Updates
- Always use TodoWrite tool to track complex task progress
- Provide clear phase indicators (Phase 1, Phase 2, Phase 3)
- Mark completion status explicitly (✅ COMPLETED, ⚠️ IN PROGRESS)

#### Error Handling
- Play notification sound before describing errors that need user input
- Provide specific error context and suggested solutions
- Ask for user preference when multiple resolution paths exist

#### Task Completion
- Use completion notification sound for finished tasks
- Provide clear summary of what was accomplished
- Update all relevant tracking documents (tasks.md, roadmap.md, etc.)

## Implementation Notes

- This notification protocol should be followed consistently
- The Glass.aiff sound provides a pleasant, non-intrusive notification
- Always play sound BEFORE asking the question, not after
- This ensures user attention is captured at the right moment

## Integration

This file should be referenced in all core Agent OS instruction files to ensure consistent behavior across all operations.