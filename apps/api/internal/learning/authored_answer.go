package learning

import (
	"bytes"
	"encoding/json"
)

// AuthoredAnswer retains the legacy value shapes, but preserves new policy
// numbers before float64 conversion. This decoder is shared by API authoring,
// database reads, catalogue imports and frozen snapshot reads.
type AuthoredAnswer map[string]any

func (answer *AuthoredAnswer) UnmarshalJSON(data []byte) error {
	var ordinary map[string]any
	if err := json.Unmarshal(data, &ordinary); err != nil {
		return err
	}
	if _, hasPolicy := ordinary["marking_policy"].(map[string]any); !hasPolicy {
		*answer = ordinary
		return nil
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var precise map[string]any
	if err := decoder.Decode(&precise); err != nil {
		return err
	}
	if policy, ok := precise["marking_policy"].(map[string]any); ok {
		legacy := ordinary["marking_policy"].(map[string]any)
		for _, key := range []string{"version", "absolute_tolerance"} {
			if value, present := policy[key]; present {
				legacy[key] = value
			}
		}
		if policy["mode"] == "numeric" {
			ordinary["value"] = precise["value"]
		}
	}
	*answer = ordinary
	return nil
}
