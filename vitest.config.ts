import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration specs hit the real free APIs. They are excluded from the
    // default run so that a normal "npm test" never depends on the network,
    // never burns a daily quota and never fails because a provider is down.
    // Run them deliberately with: npm run test:live
    // e2e holds Playwright specs, which have their own runner and their own
    // config. Vitest must not try to collect them. The e2e pattern is
    // anchored with a leading **/ rather than left bare, because a bare
    // "e2e/**" only matches at the repository root and silently lets through
    // a nested copy, such as the e2e directory inside a worktree checked out
    // under .claude/worktrees for a background agent. .claude/** is excluded
    // outright for the same reason: a worktree can contain a full copy of
    // this repository, tests and all.
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.live.test.ts", "**/e2e/**", ".claude/**"],
  },
});
