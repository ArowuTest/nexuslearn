"use client";

/**
 * Rex — the NexusLearn companion. Hand-rigged SVG: every part (eyes, jaw,
 * tail, arms, belly) is a separate group so moods are driven by CSS
 * transforms rather than swapping images.
 */
export type DinoMood = "idle" | "happy" | "thinking" | "encourage" | "celebrate";

export default function Dino({
  mood = "idle",
  size = 180,
}: {
  mood?: DinoMood;
  size?: number;
}) {
  const isHappy = mood === "happy" || mood === "celebrate";
  const bodyClass =
    mood === "celebrate" ? "anim-bob" : mood === "happy" ? "anim-squash" : "";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={bodyClass}
      style={{ overflow: "visible" }}
    >
      {/* tail */}
      <g className={isHappy ? "anim-tail" : ""}>
        <path
          d="M38 142 C 12 132, 4 110, 14 96 C 20 110, 34 120, 50 126 Z"
          fill="#3ecf8e"
        />
      </g>
      {/* body */}
      <ellipse cx="100" cy="135" rx="52" ry="46" fill="#3ecf8e" />
      {/* belly */}
      <ellipse cx="100" cy="146" rx="34" ry="30" fill="#d9f7e8" />
      {/* legs */}
      <ellipse cx="74" cy="180" rx="14" ry="10" fill="#2eb377" />
      <ellipse cx="126" cy="180" rx="14" ry="10" fill="#2eb377" />
      {/* arms */}
      <g transform={isHappy ? "rotate(-30 62 130)" : ""}>
        <ellipse cx="56" cy="132" rx="9" ry="16" fill="#2eb377" />
      </g>
      <g transform={isHappy ? "rotate(30 138 130)" : ""}>
        <ellipse cx="144" cy="132" rx="9" ry="16" fill="#2eb377" />
      </g>
      {/* head */}
      <g transform={mood === "thinking" ? "rotate(-6 100 70)" : ""}>
        <ellipse cx="100" cy="72" rx="44" ry="40" fill="#3ecf8e" />
        {/* back spikes */}
        <path d="M70 40 l8 -16 l8 14 Z" fill="#19c2c8" />
        <path d="M90 32 l9 -18 l9 16 Z" fill="#19c2c8" />
        <path d="M112 36 l8 -15 l8 14 Z" fill="#19c2c8" />
        {/* snout */}
        <ellipse cx="100" cy="88" rx="26" ry="16" fill="#d9f7e8" />
        {/* nostrils */}
        <circle cx="92" cy="84" r="2.4" fill="#1d1a3e" opacity="0.5" />
        <circle cx="108" cy="84" r="2.4" fill="#1d1a3e" opacity="0.5" />
        {/* eyes */}
        <g className="anim-blink">
          <circle cx="82" cy="64" r="9" fill="#fff" />
          <circle cx="118" cy="64" r="9" fill="#fff" />
          <circle cx={mood === "thinking" ? 80 : 84} cy="65" r="4.5" fill="#1d1a3e" />
          <circle cx={mood === "thinking" ? 116 : 120} cy="65" r="4.5" fill="#1d1a3e" />
          <circle cx="86" cy="62" r="1.6" fill="#fff" />
          <circle cx="122" cy="62" r="1.6" fill="#fff" />
        </g>
        {/* brows for encourage */}
        {mood === "encourage" && (
          <>
            <path d="M72 52 q10 -6 18 -2" stroke="#1d1a3e" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M110 50 q10 -2 18 4" stroke="#1d1a3e" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        )}
        {/* mouth */}
        {isHappy ? (
          <path d="M86 96 q14 12 28 0" stroke="#1d1a3e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        ) : mood === "encourage" ? (
          <path d="M88 98 q12 6 24 0" stroke="#1d1a3e" strokeWidth="3" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M90 97 q10 5 20 0" stroke="#1d1a3e" strokeWidth="3" fill="none" strokeLinecap="round" />
        )}
        {/* cheeks */}
        <circle cx="70" cy="80" r="6" fill="#ff6b6b" opacity="0.35" />
        <circle cx="130" cy="80" r="6" fill="#ff6b6b" opacity="0.35" />
      </g>
      {/* thinking bubble */}
      {mood === "thinking" && (
        <g className="anim-pop">
          <circle cx="152" cy="34" r="4" fill="#8d6bff" opacity="0.5" />
          <circle cx="164" cy="22" r="7" fill="#8d6bff" opacity="0.65" />
          <text x="160" y="27" fontSize="11" fill="#fff" fontWeight="bold">?</text>
        </g>
      )}
      {/* celebrate stars */}
      {mood === "celebrate" && (
        <g className="anim-pop">
          <text x="20" y="30" fontSize="20">✨</text>
          <text x="158" y="44" fontSize="18">⭐</text>
          <text x="40" y="60" fontSize="14">✨</text>
        </g>
      )}
    </svg>
  );
}
