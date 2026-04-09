package common

import (
	"encoding/json"
	"fmt"
	"os"
)

// Field describes an available JSON output field.
type Field struct {
	Name string
	Type string
}

// PrintJSON writes v as indented JSON to stdout.
func PrintJSON(v any) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

// PrintFieldList prints available fields to stdout.
func PrintFieldList(fields []Field) {
	fmt.Println("Specify one or more comma-separated fields for `--json`:")
	for _, f := range fields {
		fmt.Printf("  %-20s %s\n", f.Name, f.Type)
	}
}

// FilterFields takes a JSON-serializable value and returns only the requested fields.
func FilterFields(data any, requested []string, _ []Field) error {
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}

	var items []map[string]any
	if err := json.Unmarshal(raw, &items); err != nil {
		var single map[string]any
		if err := json.Unmarshal(raw, &single); err != nil {
			return fmt.Errorf("filter fields: data must be object or array of objects")
		}
		return PrintJSON(filterMap(single, requested))
	}

	filtered := make([]map[string]any, len(items))
	for i, item := range items {
		filtered[i] = filterMap(item, requested)
	}
	return PrintJSON(filtered)
}

func filterMap(m map[string]any, fields []string) map[string]any {
	out := make(map[string]any, len(fields))
	for _, f := range fields {
		if v, ok := m[f]; ok {
			out[f] = v
		}
	}
	return out
}
