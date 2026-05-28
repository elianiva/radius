## General Patterns

- Prefer direct top-level import over dynamic import.
- Avoid typecasting to prevent lint errors, properly fix them instead.

## React Patterns

- Always use react-query over useEffect for async state managements

## Effect Patterns

- Read `~/Repositories/effect-smol` for canonical Effect patterns.
- No helper functions. Repeat is fine, small inline wrappers are discouraged.
- Whenever possible, infer Effect types instead of annotating.

## Package Manager

- Use `vp` to manage everything.
- Use `pnpm ui` to add shadcn components
