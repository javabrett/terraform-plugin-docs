// Copyright IBM Corp. 2020, 2026
// SPDX-License-Identifier: MPL-2.0

package cmd

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/mod/modfile"

	"github.com/hashicorp/terraform-plugin-docs/internal/serve"
	"net/http"
)

type serveCmd struct {
	commonCmd

	addr string

	flagProviderName   string
	flagRegistrySource string
}

func (cmd *serveCmd) Synopsis() string {
	return "serve a generated plugin website from markdown in the current directory using the doc preview tool at https://registry.terraform.io/tools/doc-preview"
}

func (cmd *serveCmd) Help() string {
	return `Usage: tfplugindocs serve --addr [host:port]`
}

func (cmd *serveCmd) Flags() *flag.FlagSet {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	fs.StringVar(&cmd.addr, "addr", "localhost:8080", "listen address")
	fs.StringVar(&cmd.flagProviderName, "provider-name", "", "provider name, as used in Terraform configurations")
	fs.StringVar(&cmd.flagRegistrySource, "registry-source", "", "registry source address (namespace/name, e.g. datahub-project/datahub); derived from go.mod if not set")
	return fs
}

func (cmd *serveCmd) Run(args []string) int {
	fs := cmd.Flags()
	err := fs.Parse(args)
	if err != nil {
		cmd.ui.Error(fmt.Sprintf("unable to parse flags: %s", err))
		return 1
	}

	return cmd.run(cmd.runInternal)
}

func (cmd *serveCmd) runInternal() error {
	cmd.ui.Info(fmt.Sprintf("Preview docs at http://%s/tools/doc-preview", cmd.addr))

	providerName := cmd.flagProviderName
	if providerName == "" {
		wd, err := os.Getwd()
		if err != nil {
			return err
		}

		providerName = filepath.Base(wd)
	}

	namespace, registryName := resolveRegistryCoords(cmd.flagRegistrySource)

	handler := serve.NewHandler(providerName, namespace, registryName)
	err := http.ListenAndServe(cmd.addr, handler)

	if err != nil {
		return fmt.Errorf("unable to validate website: %w", err)
	}

	return nil
}

// resolveRegistryCoords returns the registry namespace and provider name
// (e.g. "datahub-project", "datahub") from an explicit --registry-source flag
// or by parsing go.mod in the current directory. Returns empty strings if
// neither source yields a valid result; the header is silently omitted.
func resolveRegistryCoords(flagValue string) (namespace, name string) {
	if flagValue != "" {
		parts := strings.SplitN(flagValue, "/", 2)
		if len(parts) == 2 && parts[0] != "" && parts[1] != "" {
			return parts[0], parts[1]
		}
		return "", ""
	}

	data, err := os.ReadFile("go.mod")
	if err != nil {
		return "", ""
	}
	modulePath := modfile.ModulePath(data)
	if modulePath == "" {
		return "", ""
	}
	// module path: github.com/{org}/terraform-provider-{name}
	parts := strings.Split(modulePath, "/")
	if len(parts) < 2 {
		return "", ""
	}
	org := parts[len(parts)-2]
	repo := parts[len(parts)-1]
	n := strings.TrimPrefix(repo, "terraform-provider-")
	if n == repo {
		// does not follow the terraform-provider-{name} convention
		return "", ""
	}
	return strings.ToLower(org), n
}
