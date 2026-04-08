BINARY := ep
BUILD_DIR := bin
CMD := ./cmd/ep

.PHONY: build install clean

build:
	go build -o $(BUILD_DIR)/$(BINARY) $(CMD)

install:
	go install $(CMD)

clean:
	rm -rf $(BUILD_DIR)

.PHONY: run
run: build
	./$(BUILD_DIR)/$(BINARY) $(ARGS)
