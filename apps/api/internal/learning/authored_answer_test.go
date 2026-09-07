package learning

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestAuthoredPolicyPrecisionSurvivesReleaseDecoding(t *testing.T) {
	raw := []byte(`{"questions":[{"id":"q","format":"number-input","expected_answer":{"value":0.30000000000000001,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":0.099999999999999999}}}]}`)
	canonical, err := canonicalJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	var payload ContentReleasePackPayload
	if err := json.Unmarshal(canonical, &payload); err != nil {
		t.Fatal(err)
	}
	q := payload.Questions[0]
	version := questionContractVersion(q)
	frozen, err := json.Marshal(q)
	if err != nil {
		t.Fatal(err)
	}
	for _, number := range []string{"0.30000000000000001", "0.099999999999999999"} {
		if !strings.Contains(string(frozen), number) {
			t.Fatalf("release lost authored number %s: %s", number, frozen)
		}
	}
	var restored QuestionConfig
	if err := json.Unmarshal(frozen, &restored); err != nil {
		t.Fatal(err)
	}
	if questionContractVersion(restored) != version {
		t.Fatal("snapshot decoding changed policy identity")
	}
}

func TestLegacyAuthoredAnswerShapesStayCompatible(t *testing.T) {
	var answer AuthoredAnswer
	if err := json.Unmarshal([]byte(`{"value":0.3,"sequence":[1,"2"],"unit":"cm"}`), &answer); err != nil {
		t.Fatal(err)
	}
	if answer["value"] != float64(0.3) || answer["sequence"].([]any)[0] != float64(1) {
		t.Fatalf("legacy values changed types: %#v", answer)
	}
}
