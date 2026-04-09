BINARY := ep
BUILD_DIR := bin
CMD := ./cmd/ep

.PHONY: build install clean generate

build:
	go build -o $(BUILD_DIR)/$(BINARY) $(CMD)

install:
	go install $(CMD)

generate:
	node codegen/generate.mjs > internal/ep/cmd/types_gen.go

clean:
	rm -rf $(BUILD_DIR)

.PHONY: run
run: build
	./$(BUILD_DIR)/$(BINARY) $(ARGS)
