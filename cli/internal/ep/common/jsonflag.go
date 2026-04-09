package common

import (
	"fmt"
	"os"
	"strings"
)

// JSONFlag holds state for the --json flag.
// Supports: --json (list fields), --json f1,f2 (filter), --json=f1,f2 (filter).
type JSONFlag struct {
	Fields []string
	Used   bool
}

// Parse reads os.Args directly to extract --json flag state.
// Call this before cobra parses flags. It rewrites os.Args to remove --json
// so cobra doesn't error on the missing value.
func (f *JSONFlag) Parse() {
	args := os.Args
	var newArgs []string
	skip := false

	for i, a := range args {
		if skip {
			skip = false
			continue
		}

		// --json=val
		if strings.HasPrefix(a, "--json=") {
			f.Used = true
			val := strings.TrimPrefix(a, "--json=")
			f.parseFields(val)
			continue // remove from args
		}

		// bare --json or --json val
		if a == "--json" {
			f.Used = true
			// Check if next arg looks like a value (not a flag)
			if i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
				f.parseFields(args[i+1])
				skip = true // skip next arg too
			}
			continue // remove from args
		}

		newArgs = append(newArgs, a)
	}

	os.Args = newArgs
}

func (f *JSONFlag) parseFields(val string) {
	val = strings.TrimSpace(val)
	if val == "" {
		return
	}
	for _, p := range strings.Split(val, ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			f.Fields = append(f.Fields, p)
		}
	}
}

// HandleOutput processes --json logic. Returns true if it handled the output.
func (f *JSONFlag) HandleOutput(data any, available []Field) (bool, error) {
	if !f.Used {
		return false, nil
	}
	if len(f.Fields) == 0 {
		PrintFieldList(available)
		return true, nil
	}

	// Validate
	validSet := make(map[string]bool, len(available))
	for _, field := range available {
		validSet[field.Name] = true
	}
	var invalid []string
	for _, r := range f.Fields {
		if !validSet[r] {
			invalid = append(invalid, r)
		}
	}
	if len(invalid) > 0 {
		return true, fmt.Errorf("unknown fields: %s\nRun with --json to see available fields", strings.Join(invalid, ", "))
	}

	return true, FilterFields(data, f.Fields, available)
}
