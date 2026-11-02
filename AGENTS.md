# Inview agent rules

## Check inview-docs first

`m-esm/inview-docs` holds the product truth: scope, decisions, PRD, journeys, platform, roadmap, API and infra.
Check it before you plan, build or answer a question about the product.

Clone it into `~/Desktop/myprojects` if it is absent:

```bash
git clone git@github.com:m-esm/inview-docs.git ~/Desktop/myprojects/inview-docs
```

Read the current state of `origin/main`:

```bash
git -C ~/Desktop/myprojects/inview-docs fetch origin
git -C ~/Desktop/myprojects/inview-docs show origin/main:docs/mvp-scope.md
```

Start with `docs/mvp-scope.md`. It gives the done rule and the decisions.

When your change makes a doc wrong, update `inview-docs` in a pull request for that change.
ADR 0001 is the exception. Edit it in this repository at `docs/adr/0001-architecture.md`. The docs build copies it from here.
