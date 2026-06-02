# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

`tfplugindocs` is a CLI tool and library for generating and validating Terraform provider plugin documentation. It reads a provider's schema (by invoking Terraform or from a JSON file), merges it with Markdown templates and `.tf` example files, and writes rendered Markdown docs to `docs/`.

## Commands

```bash
# Build (installs binary to GOPATH)
mise exec -- make build

# Unit tests
mise exec -- make test

# Acceptance tests (slower, requires network/Terraform)
ACCTEST=1 mise exec -- go test -v -cover -race -timeout 120m ./...

# Run a single test
mise exec -- go test ./internal/provider/... -run TestGenerate -v

# Lint (requires golangci-lint)
golangci-lint run ./...

# Go vet
mise exec -- go vet ./...

# License header generation
mise exec -- make generate
```

This project requires Go 1.25+ and uses `mise` for version management.

## Architecture

### Entry Point

`cmd/tfplugindocs/main.go` -> `internal/cmd.Main()` -> HashiCorp CLI dispatch -> one of three commands.

### CLI Commands (`internal/cmd/`)

- **generate** (also the default when no command given): calls `provider.Generate()`
- **validate**: calls `provider.Validate()`
- **migrate**: calls `provider.Migrate()` to convert legacy website format to template-based structure

All commands share a `commonCmd` base struct. Flags use the standard library `flag` package.

### Core Generation Pipeline (`internal/provider/`)

The `generator` struct in `generate.go` drives the main workflow:

1. Load provider schema - either by invoking `terraform` via `terraform-exec` or by reading a `--providers-schema` JSON file
2. Discover or generate missing template files (defaults are embedded)
3. For each resource/data-source/function/action: render template + schema + examples into Markdown
4. Write output to `docs/` (or `--rendered-website-dir`)

Key files:
- `generate.go` - orchestration, path management, `infof`/`warnf` logging helpers
- `template.go` - per-resource template rendering, frontmatter handling
- `schema.go` - schema extraction via `hashicorp/terraform-exec` and `hashicorp/terraform-json`
- `validate.go` - validates directory structure, file extensions, YAML frontmatter
- `migrate.go` - legacy migration

### Schema-to-Markdown Rendering (`internal/schemamd/`)

Converts `tfjson.Schema` objects into readable Markdown attribute tables. Entry point is `Render()` in `render.go`. `behaviors.go` classifies attributes (required, optional, computed, sensitive, etc.).

### Validation (`internal/check/`)

Called by `validate` command. Checks frontmatter fields (title, description, subcategory), file extensions, and that every resource/data-source has a corresponding doc file and vice versa.

### Supporting Packages

- `internal/mdplain/` - converts Markdown to plain text (used for stripping markup from schema descriptions)
- `internal/functionmd/` - renders function signatures and parameter docs
- `internal/tmplfuncs/` - custom Go template functions (`PrefixLines`, `CodeFile`) available inside Markdown templates

## Provider Directory Layout Expected

```
terraform-provider-<name>/
├── examples/
│   ├── resources/<resource-name>/resource.tf
│   └── data-sources/<ds-name>/data-source.tf
├── templates/
│   ├── index.md.tmpl
│   ├── resources/<resource-name>.md.tmpl
│   └── data-sources/<ds-name>.md.tmpl
└── docs/                  # generated output
```

Templates use Go `text/template` syntax. YAML frontmatter is separated from template body and validated independently.

## Testing Conventions

- Tests use `testdata/` directories with real provider examples
- Acceptance tests guard with `if os.Getenv("ACCTEST") == ""` or the `acctest` build tag
- `t.Parallel()` is used throughout; new tests should follow this pattern
- HashiCorp's mock CLI UI (`github.com/mitchellh/cli`) is used for capturing output in tests

## Version Injection

The release build injects version via ldflags:
```
-ldflags "-X github.com/hashicorp/terraform-plugin-docs/cmd/tfplugindocs/build.version=<version>"
```

Releases use goreleaser; changelogs are managed via Changie (`.changes/unreleased/`).

## serve Command (`internal/serve/`)

The `serve` command runs a local HTTP server that renders provider docs using the real Terraform Registry UI. It is not yet merged upstream; see [hashicorp/terraform-plugin-docs#5](https://github.com/hashicorp/terraform-plugin-docs/issues/5).

### How it works

The server acts as a reverse proxy to `https://registry.terraform.io`. All requests are forwarded transparently except three local routes:

- `GET /tools/doc-preview` - fetches the real Registry doc-preview page, injects a `<script>` tag into the `<body>` before returning it
- `GET /markdown/menu` - serves generated sidebar HTML built from the local `docs/` directory
- `GET /markdown/<path>` - serves a single markdown file as JSON (`{content, title, path, ...}`)

Because all CSS, fonts, and JS bundles are proxied from the real Registry, rendering is visually identical to what the Registry produces.

### Browser-side injection (`internal/serve/serve.js`)

The injected script runs two `MutationObserver` instances that wait for Ember to finish rendering:

- **textarea observer** - watches for a `TEXTAREA` node to appear inside `div.doc-preview`; when found, calls `fetchContent("docs/index.md")` to load the provider index page and disconnects
- **menu observer** - watches for a `DIV` with `class="provider-docs-menu"`; when found, calls `updateMenu(node)` to replace the Ember-generated sidebar with locally-generated HTML and disconnects

`fetchContent(path)` fetches `/markdown/<path>`, stuffs the markdown into the textarea, fires an `input` event so Ember re-renders the preview, and updates the active state on the sidebar link.

`updateMenu(node)` fetches `/markdown/menu`, injects the HTML, then wires up click listeners on each `.menu-list-category-link` for expand/collapse behavior (toggling the `menu-list-category-wrapper` class and icon between `fa-angle-right` and `fa-angle-down`).

### Menu generation (`internal/serve/serve.go`)

`generateMenu` walks `./docs` and classifies files into `Menu.Index`, `Menu.Guides`, `Menu.Resources`, and `Menu.Data`. Each file is read and its `page_title` frontmatter field extracted to populate `Page.Title`. The `wbr` template function inserts `<wbr>` after each underscore in resource names to match Registry soft-wrap behavior.

### Key files

| File | Purpose |
|---|---|
| `internal/serve/serve.go` | HTTP handler, proxy, menu generation, page reading |
| `internal/serve/serve.js` | Injected browser script (MutationObservers, fetchContent, updateMenu) |
| `internal/serve/menu.html.tmpl` | Go HTML template for the sidebar menu |
| `internal/serve/static.go` | `go:embed` declarations for JS and template |
| `internal/cmd/serve.go` | CLI command wiring, flags, `--addr` option |

### Known fragility

The MutationObserver targets are DOM class names generated by Ember (`div.doc-preview`, `div.provider-docs-menu`). If HashiCorp restructures the Registry SPA these selectors will break. The `menu-list-category-wrapper` CSS class used for expand/collapse state is also Ember-generated and could change.

### Building and testing

```bash
mise exec -- go build -o /tmp/tfplugindocs-serve ./cmd/tfplugindocs/main.go
cd /path/to/terraform-provider-<name>
/tmp/tfplugindocs-serve serve
# open http://localhost:8080/tools/doc-preview
```
