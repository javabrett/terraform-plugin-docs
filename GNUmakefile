TEST?=./...

default: build

.PHONY: build test testacc install-serve

build:
	go install ./cmd/tfplugindocs

test:
	go test $(TEST) $(TESTARGS) -timeout=5m

testacc:
	ACCTEST=1 go test -v -cover -race -timeout 120m ./...

# Generate copywrite headers
generate:
	cd tools; go generate ./...

# Build and install tfplugindocs-serve to $GOPATH/bin under a distinct name
# so it does not conflict with the upstream tfplugindocs binary.
install-serve:
	mise exec -- go build -o "$$(mise exec -- go env GOPATH)/bin/tfplugindocs-serve" ./cmd/tfplugindocs
