package server

import (
	"sync"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

type privacyMemory struct {
	mu      sync.Mutex
	consent []learning.ConsentRecord
	deleted map[string]bool
}

func newPrivacyMemory() *privacyMemory {
	return &privacyMemory{deleted: map[string]bool{}}
}

func (s *Server) rememberConsent(record learning.ConsentRecord) learning.ConsentRecord {
	s.privacyMemory.mu.Lock()
	defer s.privacyMemory.mu.Unlock()
	record.ID = "memory-consent"
	record.GrantedAt = time.Now().UTC().Format(time.RFC3339)
	s.privacyMemory.consent = append(s.privacyMemory.consent, record)
	return record
}

func (s *Server) memoryExport(parentID string, ref string) learning.FamilyExport {
	s.privacyMemory.mu.Lock()
	defer s.privacyMemory.mu.Unlock()
	consent := []learning.ConsentRecord{}
	for _, record := range s.privacyMemory.consent {
		if record.StudentExternalRef == ref {
			consent = append(consent, record)
		}
	}
	return learning.FamilyExport{
		ExportedAt:      time.Now().UTC().Format(time.RFC3339),
		Child:           map[string]any{"external_ref": ref, "parent_user_id": parentID, "deleted": s.privacyMemory.deleted[ref]},
		Consent:         consent,
		Attempts:        []map[string]any{},
		Mastery:         []map[string]any{},
		MasteryHistory:  []map[string]any{},
		Baselines:       []map[string]any{},
		MockAssessments: []map[string]any{},
		WorldState:      []map[string]any{},
		LessonSteps:     []map[string]any{},
		Events:          []map[string]any{},
		Sharing:         map[string]bool{"school": false, "marketing": false, "research": false},
		SecretsIncluded: false,
	}
}

func (s *Server) markDeleted(ref string) {
	s.privacyMemory.mu.Lock()
	defer s.privacyMemory.mu.Unlock()
	s.privacyMemory.deleted[ref] = true
	for i := range s.privacyMemory.consent {
		if s.privacyMemory.consent[i].StudentExternalRef == ref {
			s.privacyMemory.consent[i].StudentExternalRef = ""
			s.privacyMemory.consent[i].WithdrawnAt = time.Now().UTC().Format(time.RFC3339)
		}
	}
}
