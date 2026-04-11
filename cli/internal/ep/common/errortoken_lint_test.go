package common

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

// TestErrorTokens_Lint walks every non-test .go file under the cli/
// module and verifies that every ExitError.Token literal and every
// NewTokenError / NewAuthTokenError / NewConnectionTokenError first-arg
// value resolves to a member of CanonicalTokens.
//
// This is the static half of rule 2 in docs/cli-llm-as-caller.md:
//
//	"Every error line written to stderr MUST start with an
//	 UPPER_SNAKE_CASE token from the canonical registry."
//
// If this test fails, either (a) add the token to the const block and
// CanonicalTokens in errors.go, or (b) use an existing token.
func TestErrorTokens_Lint(t *testing.T) {
	root := findCLIModuleRoot(t)
	fset := token.NewFileSet()

	errorsFile := filepath.Join(root, "internal", "ep", "common", "errors.go")
	tokenConsts := loadTokenConstsFromErrorsFile(t, fset, errorsFile)

	var violations []string

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			name := info.Name()
			if name == "vendor" || name == ".git" || name == "bin" || name == "dist" {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") {
			return nil
		}
		if strings.HasSuffix(path, "_test.go") {
			return nil
		}
		// Skip errors.go itself — it is the source of truth for
		// constructors. NewTokenError/NewAuthTokenError take `token`
		// as a function parameter, which is unresolvable at the
		// definition site but always resolved at the call site.
		if path == errorsFile {
			return nil
		}

		file, parseErr := parser.ParseFile(fset, path, nil, 0)
		if parseErr != nil {
			return parseErr
		}

		ast.Inspect(file, func(n ast.Node) bool {
			switch node := n.(type) {
			case *ast.CompositeLit:
				if !isExitErrorType(node.Type) {
					return true
				}
				for _, elt := range node.Elts {
					kv, ok := elt.(*ast.KeyValueExpr)
					if !ok {
						continue
					}
					key, ok := kv.Key.(*ast.Ident)
					if !ok || key.Name != "Token" {
						continue
					}
					tok, resolved := resolveTokenExpr(kv.Value, tokenConsts)
					if !resolved {
						pos := fset.Position(kv.Value.Pos())
						violations = append(violations, formatViolation(pos, "ExitError.Token", "cannot statically resolve — use a Token* constant or string literal"))
						continue
					}
					if tok == "" {
						continue
					}
					if _, ok := CanonicalTokens[tok]; !ok {
						pos := fset.Position(kv.Value.Pos())
						violations = append(violations, formatViolation(pos, "ExitError.Token", "unknown token "+strconv.Quote(tok)))
					}
				}

			case *ast.CallExpr:
				if !isTokenErrorConstructor(node.Fun) {
					return true
				}
				if len(node.Args) == 0 {
					return true
				}
				tok, resolved := resolveTokenExpr(node.Args[0], tokenConsts)
				if !resolved {
					pos := fset.Position(node.Args[0].Pos())
					violations = append(violations, formatViolation(pos, callName(node.Fun), "cannot statically resolve first arg — use a Token* constant or string literal"))
					return true
				}
				if tok == "" {
					pos := fset.Position(node.Args[0].Pos())
					violations = append(violations, formatViolation(pos, callName(node.Fun), "empty token"))
					return true
				}
				if _, ok := CanonicalTokens[tok]; !ok {
					pos := fset.Position(node.Args[0].Pos())
					violations = append(violations, formatViolation(pos, callName(node.Fun), "unknown token "+strconv.Quote(tok)))
				}
			}
			return true
		})
		return nil
	})
	if err != nil {
		t.Fatalf("walk cli module: %v", err)
	}

	if len(violations) > 0 {
		t.Errorf("error-token lint failed:\n  %s", strings.Join(violations, "\n  "))
	}
}

// TestErrorTokens_ConstRegistryDrift enforces that every Token* const
// in errors.go is present in CanonicalTokens and vice versa. Prevents
// silent drift between the two sources of truth.
func TestErrorTokens_ConstRegistryDrift(t *testing.T) {
	root := findCLIModuleRoot(t)
	fset := token.NewFileSet()
	tokenConsts := loadTokenConstsFromErrorsFile(t, fset, filepath.Join(root, "internal", "ep", "common", "errors.go"))

	constValues := make(map[string]string, len(tokenConsts))
	for name, value := range tokenConsts {
		if _, ok := CanonicalTokens[value]; !ok {
			t.Errorf("const %s = %q has no entry in CanonicalTokens", name, value)
		}
		constValues[value] = name
	}

	for tok := range CanonicalTokens {
		if _, ok := constValues[tok]; !ok {
			t.Errorf("CanonicalTokens contains %q but no Token* constant defines it", tok)
		}
	}
}

// findCLIModuleRoot walks up from this test file's directory until it
// finds a go.mod, returning that directory.
func findCLIModuleRoot(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	dir := filepath.Dir(thisFile)
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatalf("could not locate go.mod above %s", filepath.Dir(thisFile))
		}
		dir = parent
	}
}

// loadTokenConstsFromErrorsFile parses the common/errors.go file and
// returns a map of Token* constant name → string value. Used to
// resolve identifier references in the lint walk.
func loadTokenConstsFromErrorsFile(t *testing.T, fset *token.FileSet, path string) map[string]string {
	t.Helper()
	file, err := parser.ParseFile(fset, path, nil, 0)
	if err != nil {
		t.Fatalf("parse %s: %v", path, err)
	}
	consts := make(map[string]string)
	for _, decl := range file.Decls {
		gen, ok := decl.(*ast.GenDecl)
		if !ok || gen.Tok != token.CONST {
			continue
		}
		for _, spec := range gen.Specs {
			vs, ok := spec.(*ast.ValueSpec)
			if !ok {
				continue
			}
			for i, name := range vs.Names {
				if !strings.HasPrefix(name.Name, "Token") {
					continue
				}
				if i >= len(vs.Values) {
					continue
				}
				lit, ok := vs.Values[i].(*ast.BasicLit)
				if !ok || lit.Kind != token.STRING {
					continue
				}
				value, err := strconv.Unquote(lit.Value)
				if err != nil {
					continue
				}
				consts[name.Name] = value
			}
		}
	}
	return consts
}

// resolveTokenExpr tries to statically extract a token string from an
// AST expression. Returns (value, resolved). When resolved is false the
// linter flags it so authors cannot sneak dynamic tokens past the check.
//
// Accepted forms:
//   - string literal:               "BAG_NOT_FOUND"
//   - same-package identifier:      TokenBagNotFound
//   - selector (any alias):         common.TokenBagNotFound, c.TokenBagNotFound, …
func resolveTokenExpr(expr ast.Expr, consts map[string]string) (string, bool) {
	switch v := expr.(type) {
	case *ast.BasicLit:
		if v.Kind != token.STRING {
			return "", false
		}
		s, err := strconv.Unquote(v.Value)
		if err != nil {
			return "", false
		}
		return s, true
	case *ast.Ident:
		if value, ok := consts[v.Name]; ok {
			return value, true
		}
		return "", false
	case *ast.SelectorExpr:
		if value, ok := consts[v.Sel.Name]; ok {
			return value, true
		}
		return "", false
	}
	return "", false
}

// isExitErrorType returns true if the composite literal type is
// ExitError or <pkg>.ExitError.
func isExitErrorType(expr ast.Expr) bool {
	switch t := expr.(type) {
	case *ast.Ident:
		return t.Name == "ExitError"
	case *ast.SelectorExpr:
		return t.Sel.Name == "ExitError"
	}
	return false
}

// isTokenErrorConstructor returns true if the call expression resolves
// to one of the token-aware constructors in this package.
func isTokenErrorConstructor(expr ast.Expr) bool {
	name := callName(expr)
	switch name {
	case "NewTokenError", "NewAuthTokenError", "NewConnectionTokenError":
		return true
	}
	return false
}

func callName(expr ast.Expr) string {
	switch fn := expr.(type) {
	case *ast.Ident:
		return fn.Name
	case *ast.SelectorExpr:
		return fn.Sel.Name
	}
	return ""
}

func formatViolation(pos token.Position, site, reason string) string {
	return pos.String() + ": " + site + ": " + reason
}
