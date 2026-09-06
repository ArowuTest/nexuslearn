package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestPupilLoginPreservesCaseSensitiveLearnerIdentity(t *testing.T) {
	t.Setenv("PUPIL_SESSION_SECRET", "test-identity-secret")
	for _, upperFirst := range []bool{false, true} {
		t.Run(map[bool]string{false: "credential lookup", true: "profile lookup"}[upperFirst], func(t *testing.T) {
			lower := learning.StudentCredentialConfig{StudentExternalRef: "pupil", LoginCode: "LOWER"}
			upper := learning.StudentCredentialConfig{StudentExternalRef: "PUPIL", LoginCode: "UPPER"}
			credentials := []learning.StudentCredentialConfig{lower, upper}
			if upperFirst {
				credentials = []learning.StudentCredentialConfig{upper, lower}
			}
			srv := New(fakeRepository{credentials: credentials, students: []learning.StudentProfileConfig{{ExternalRef: "pupil", DisplayName: "Lower pupil", YearGroup: 3}, {ExternalRef: "PUPIL", DisplayName: "Upper pupil", YearGroup: 4}}, hasBaseline: true}, "postgres")
			req := httptest.NewRequest(http.MethodPost, "/v1/auth/pupil-login", strings.NewReader(`{"student_external_ref":"PUPIL","login_code":"UPPER"}`))
			res := httptest.NewRecorder()
			srv.ServeHTTP(res, req)
			if res.Code != http.StatusOK {
				t.Fatalf("distinct valid account rejected: %d %s", res.Code, res.Body.String())
			}
			var body struct {
				Student learning.StudentProfileConfig `json:"student"`
				Session pupilSession                  `json:"session"`
			}
			if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			payload, ok := verifyPupilSessionToken(body.Session.Token, "test-identity-secret")
			if body.Student.ExternalRef != "PUPIL" || !ok || payload.StudentExternalRef != "PUPIL" {
				t.Fatalf("login switched identity: student=%q token learner=%q", body.Student.ExternalRef, payload.StudentExternalRef)
			}
		})
	}
}

func TestSchoolResolutionPreservesCaseSensitiveLearnerIdentity(t *testing.T) {
	srv := New(fakeRepository{classes: []learning.ClassConfig{
		{SchoolURN: "school-a", Students: []learning.StudentProfileConfig{{ExternalRef: "pupil"}}},
		{SchoolURN: "school-b", Students: []learning.StudentProfileConfig{{ExternalRef: "PUPIL"}}},
	}}, "postgres")
	for id, want := range map[string]string{"pupil": "school-a", "PUPIL": "school-b"} {
		got, ok := srv.studentSchoolURN(context.Background(), id)
		if !ok || got != want {
			t.Fatalf("%q resolved to %q, want %q", id, got, want)
		}
	}
}
