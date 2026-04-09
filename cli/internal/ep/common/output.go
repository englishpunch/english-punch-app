package common

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/olekukonko/tablewriter"
	"github.com/olekukonko/tablewriter/tw"
)

// PrintJSON writes v as indented JSON to stdout.
func PrintJSON(v any) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

// PrintTable writes tabular data to stdout.
func PrintTable(header []string, rows [][]string) {
	printTableTo(os.Stdout, header, rows)
}

func printTableTo(w io.Writer, header []string, rows [][]string) {
	if len(rows) == 0 {
		_, _ = fmt.Fprintln(w, "No results.")
		return
	}

	table := tablewriter.NewTable(w,
		tablewriter.WithHeader(header),
		tablewriter.WithHeaderAlignment(tw.AlignLeft),
		tablewriter.WithAlignment(tw.Alignment{tw.AlignLeft}),
	)
	for _, row := range rows {
		_ = table.Append(toAny(row)...)
	}
	_ = table.Render()
}

func toAny(ss []string) []any {
	out := make([]any, len(ss))
	for i, s := range ss {
		out[i] = s
	}
	return out
}
