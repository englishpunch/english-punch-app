package common

import (
	"bytes"
	"io"
	"os"
	"testing"
)

// captureStdout runs fn with os.Stdout redirected to a pipe and
// returns the captured output. Used to keep test output clean when
// the code under test prints to stdout.
func captureStdout(t *testing.T, fn func()) string {
	t.Helper()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	orig := os.Stdout
	os.Stdout = w
	defer func() { os.Stdout = orig }()

	done := make(chan string)
	go func() {
		var buf bytes.Buffer
		_, _ = io.Copy(&buf, r)
		done <- buf.String()
	}()

	fn()
	_ = w.Close()
	return <-done
}

func TestHandleOKOutput_NotUsed(t *testing.T) {
	f := JSONFlag{}
	var handled bool
	var err error
	out := captureStdout(t, func() {
		handled, err = f.HandleOKOutput(nil, nil)
	})
	if handled {
		t.Errorf("handled = true, want false when --json is not used")
	}
	if err != nil {
		t.Errorf("err = %v, want nil", err)
	}
	if out != "" {
		t.Errorf("output = %q, want empty when --json is not used", out)
	}
}

func TestHandleOKOutput_FieldListIncludesOK(t *testing.T) {
	f := JSONFlag{Used: true}
	extraFields := []Field{{Name: "email", Type: "string"}}
	var handled bool
	var err error
	out := captureStdout(t, func() {
		handled, err = f.HandleOKOutput(nil, extraFields)
	})
	if !handled || err != nil {
		t.Fatalf("got (%v, %v), want (true, nil)", handled, err)
	}
	if !bytes.Contains([]byte(out), []byte("ok")) {
		t.Errorf("field list missing 'ok': %s", out)
	}
	if !bytes.Contains([]byte(out), []byte("email")) {
		t.Errorf("field list missing extra field 'email': %s", out)
	}
}

func TestHandleOKOutput_FilterOKField(t *testing.T) {
	f := JSONFlag{Used: true, Fields: []string{"ok"}}
	var handled bool
	var err error
	out := captureStdout(t, func() {
		handled, err = f.HandleOKOutput(map[string]any{"email": "a@b.com"}, []Field{{Name: "email", Type: "string"}})
	})
	if !handled || err != nil {
		t.Fatalf("got (%v, %v), want (true, nil)", handled, err)
	}
	if !bytes.Contains([]byte(out), []byte("\"ok\"")) {
		t.Errorf("filtered output missing ok key: %s", out)
	}
	if bytes.Contains([]byte(out), []byte("email")) {
		t.Errorf("filtered output should not include email when only ok was requested: %s", out)
	}
}

func TestHandleOKOutput_FilterExtraField(t *testing.T) {
	f := JSONFlag{Used: true, Fields: []string{"email"}}
	var handled bool
	var err error
	out := captureStdout(t, func() {
		handled, err = f.HandleOKOutput(map[string]any{"email": "a@b.com"}, []Field{{Name: "email", Type: "string"}})
	})
	if !handled || err != nil {
		t.Fatalf("got (%v, %v), want (true, nil)", handled, err)
	}
	if !bytes.Contains([]byte(out), []byte("a@b.com")) {
		t.Errorf("filtered output missing email value: %s", out)
	}
}

func TestHandleOKOutput_InvalidField(t *testing.T) {
	f := JSONFlag{Used: true, Fields: []string{"bogus"}}
	var handled bool
	var err error
	_ = captureStdout(t, func() {
		handled, err = f.HandleOKOutput(nil, nil)
	})
	if !handled {
		t.Errorf("handled = false, want true for invalid fields path")
	}
	if err == nil {
		t.Errorf("err = nil, want error for unknown field 'bogus'")
	}
}
