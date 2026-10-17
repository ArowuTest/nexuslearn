package learning

import "testing"

func TestPrivacyDefaultsStayOffAndRegionsAreClosed(t *testing.T) {
	settings := DefaultPrivacySettings()
	if settings.AnalyticsEnabled || settings.MarketingEnabled || settings.ResearchEnabled || settings.ShareWithSchool || settings.CurriculumRegion != "england" {
		t.Fatalf("privacy is not off by default: %+v", settings)
	}
	if region, err := NormalizeCurriculumRegion(" NG "); err != nil || region != "nigeria" {
		t.Fatalf("nigeria region: %s %v", region, err)
	}
	if _, err := NormalizeCurriculumRegion("usa"); err == nil {
		t.Fatal("unknown region accepted")
	}
	policies := DefaultRetentionPolicies()
	if len(policies) < 3 || policies[0].Action == "delete_automatically" {
		t.Fatalf("retention must not silently delete: %+v", policies)
	}
	if !ValidConsentPurpose("core_learning") || ValidConsentPurpose("marketing") {
		t.Fatal("consent purposes drifted")
	}
}
