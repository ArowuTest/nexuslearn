import type { StudentEngagementProfile } from "@/lib/api";

export const supportNeedOptions = [
  ["adhd", "ADHD"], ["autism", "Autism"], ["dyslexia", "Dyslexia"],
  ["dyspraxia", "Dyspraxia"], ["dyscalculia", "Dyscalculia"],
  ["speech_language", "Speech/language"], ["sensory", "Sensory sensitivity"],
  ["working_memory", "Working memory"], ["processing_speed", "Processing speed"],
  ["eal", "English as an additional language"], ["hearing", "Hearing support"],
  ["vision", "Vision support"], ["anxiety_confidence", "Anxiety/confidence"],
  ["fine_motor", "Fine motor"], ["other", "Other"],
] as const;

const accessApproaches = [
  ["simple_text", "Simple text"], ["high_contrast", "High contrast"],
  ["large_targets", "Large targets"], ["simplified_controls", "Simplified controls"],
  ["switch_access", "Switch access"],
] as const;
const teachingApproaches = [
  ["predictable_routine", "Predictable routine"], ["short_bursts", "Short bursts"],
  ["visual_steps", "Visual steps"], ["audio_read_aloud", "Read aloud"],
  ["reduced_motion", "Reduced motion"], ["low_sensory", "Low sensory"],
  ["extra_processing_time", "Extra time"], ["worked_examples", "Worked examples"],
  ["confidence_first", "Confidence first"], ["movement_breaks", "Movement breaks"],
  ["teach_back", "Teach-back"], ["high_challenge", "High challenge"],
] as const;

// Preserve each existing screen's display order and the family's friendly labels.
export const familyApproachOptions = [...teachingApproaches, ...accessApproaches];
export const supportNeeds: string[] = supportNeedOptions.map(([key]) => key);
export const learningApproaches: string[] = [...accessApproaches, ...teachingApproaches].map(([key]) => key);
export const supportChoices = {
  session_length: ["short", "standard", "extended"],
  sensory_load: ["low", "balanced", "high"],
  attention_support: ["standard", "chunked", "high_structure"],
  communication_support: ["standard", "visual", "audio_visual"],
  processing_support: ["standard", "extra_time", "step_by_step"],
  confidence_support: ["gentle", "balanced", "challenge"],
  celebration_intensity: ["quiet", "balanced", "big"],
  companion_style: ["friendly", "funny", "calm", "coach"],
  reward_style: ["world_building", "collecting", "story", "challenge"],
};

// Shared values, fresh arrays. Callers still choose their explicit approach
// defaults; this never supplies missing fields for an existing saved profile.
export function engagementDefaults(): StudentEngagementProfile {
  return {
    declared_support_needs: [], learning_approaches: [], celebration_intensity: "balanced",
    audio_support: false, reading_support: false, session_length: "standard", sensory_load: "balanced",
    attention_support: "standard", communication_support: "standard", processing_support: "standard",
    confidence_support: "balanced", companion_style: "friendly", reward_style: "world_building",
    interests: [], notes: "",
  };
}
