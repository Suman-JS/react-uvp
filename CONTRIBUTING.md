# Contributing

## Development setup

Use Node.js 22.11 or later and pnpm 10. Install dependencies and run the checks before opening a
pull request:

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

This package is maintained in a separate repository from `@sumanjs/uvp`. In the development
workspace, pnpm links the local sibling core package. CI installs the published core package, so
release `@sumanjs/uvp` before the first React package release.

## Changesets

Include a changeset for a user-facing change. Run `pnpm changeset`, select `@sumanjs/react-uvp`,
choose `patch`, `minor`, or `major`, and describe the change. Commit the generated Markdown file
under `.changeset/` with your change. Documentation-only or internal maintenance changes that do not
affect published behavior can omit a changeset.

## Releases

After changesets are merged to `main`, the GitHub workflow opens a version pull request. Merge that
pull request to publish the package to npm. Configure npm trusted publishing for this repository and
the `.github/workflows/publish-npm.yml` workflow before the first release. GitHub Actions must be
allowed to create pull requests in repository settings.
