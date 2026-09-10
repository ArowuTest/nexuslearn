package narrationjson

import "testing"

func TestMarshalMatchesJavaScriptNarrationStrings(t *testing.T) {
	value := map[string]any{"text": "<>&\u2028\u2029 and \\u2028 and \\\u2028", "speed": 0.92}
	got, err := Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	want := "{\"speed\":0.92,\"text\":\"<>&\u2028\u2029 and \\\\u2028 and \\\\\u2028\"}"
	if string(got) != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
