// The monster icons split into parts that can move on their own (see LivingMonster and globals.css "lm-" rules).
// Same drawings as monster-art.tsx; only pupils are re-centred so they can look in every direction.
import type { CSSProperties, ReactNode } from "react";
import type { MonsterKind } from "@/lib/types";

/** How far a group of pupils may travel, in the 120×120 grid. */
const look = (px: number, py: number) => ({ "--px": `${px}px`, "--py": `${py}px` }) as CSSProperties;

export const LIVING_ART: Record<MonsterKind, ReactNode> = {
  wraith: (
    <>
      <ellipse cx="60" cy="114" rx="28" ry="4" fill="#000000" opacity="0.35" />
      <path d="M60 8C33 8 20 32 20 58V106L30 97L40 108L50 98L60 110L70 98L80 108L90 97L100 106V58C100 32 87 8 60 8Z" fill="#5865E6" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
      <path d="M60 18C42 18 31 34 31 54C31 74 44 86 60 86C76 86 89 74 89 54C89 34 78 18 60 18Z" fill="#3A40B0" />
      <ellipse cx="60" cy="56" rx="21" ry="25" fill="#0B0812" />
      <g className="lm-look" data-eyes="" style={look(4.5, 3.5)}>
        <g className="lm-blink">
          <ellipse cx="51" cy="54" rx="5.5" ry="4" fill="#8BF6FF" />
          <circle cx="52.5" cy="53" r="1.4" fill="#FFFFFF" />
        </g>
        <g className="lm-blink">
          <ellipse cx="69" cy="54" rx="5.5" ry="4" fill="#8BF6FF" />
          <circle cx="70.5" cy="53" r="1.4" fill="#FFFFFF" />
        </g>
      </g>
      <path d="M53 68Q60 64 67 68" stroke="#8BF6FF" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
      <circle cx="60" cy="95" r="7" fill="none" stroke="#B9C1FF" strokeWidth="3" />
      <path d="M54 101L66 89" stroke="#B9C1FF" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 44C33 28 44 17 58 15" stroke="#AEB6FF" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
    </>
  ),
  leech: (
    <>
      <ellipse cx="60" cy="113" rx="40" ry="4" fill="#000000" opacity="0.35" />
      <g className="lm-leech-body">
        <g className="lm-leech-stalks">
          <path d="M46 46L42 30M58 44L60 28" stroke="#B23F8E" strokeWidth="5" strokeLinecap="round" />
          <circle cx="42" cy="28" r="6" fill="#FFE27A" stroke="#140F1C" strokeWidth="2.5" />
          <circle cx="60" cy="26" r="6" fill="#FFE27A" stroke="#140F1C" strokeWidth="2.5" />
          <g className="lm-look" data-eyes="" style={look(2.2, 2.2)}>
            <circle cx="42" cy="28" r="2.4" fill="#140F1C" />
            <circle cx="60" cy="26" r="2.4" fill="#140F1C" />
          </g>
        </g>
        <path d="M12 76C12 50 38 38 66 42C94 46 110 60 108 80C106 98 84 104 58 102C32 100 12 96 12 76Z" fill="#B23F8E" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <path d="M46 45C40 60 40 86 46 100M66 43C60 60 60 86 66 102M86 49C80 62 80 86 86 99" stroke="#7E2464" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M52 52C70 48 92 54 100 66" stroke="#E68AC8" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85" />
        <circle cx="26" cy="76" r="13" fill="#2A0C21" stroke="#140F1C" strokeWidth="3" />
        <g className="lm-leech-mouth">
          <path d="M26 64L23 69H29Z M26 88L23 83H29Z M14 76L19 73V79Z M38 76L33 73V79Z M17.5 67.5L22 70L19.5 72Z M34.5 84.5L30 82L32.5 80Z M17.5 84.5L19.5 80L22 82Z M34.5 67.5L32.5 72L30 70Z" fill="#F7E8F1" />
        </g>
        <text className="lm-leech-mb" x="96" y="84" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fontWeight="700" fill="#FBE3F2">
          +MB
        </text>
        <path d="M78 101C80 108 82 111 80 115C77 114 76 108 78 101Z" fill="#B23F8E" stroke="#140F1C" strokeWidth="2" />
        <path d="M94 97C96 103 97 106 95 109C93 108 92 103 94 97Z" fill="#B23F8E" stroke="#140F1C" strokeWidth="2" />
      </g>
    </>
  ),
  possessor: (
    <>
      <ellipse cx="60" cy="114" rx="26" ry="4" fill="#000000" opacity="0.35" />
      <g className="lm-possessor-head">
        <path d="M36 36C22 28 16 14 20 4C27 14 37 20 46 23Z" fill="#F2E3C9" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <path d="M84 36C98 28 104 14 100 4C93 14 83 20 74 23Z" fill="#F2E3C9" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <path d="M60 14C78 14 92 24 92 42L94 70C94 92 78 108 60 108C42 108 26 92 26 70L28 42C28 24 42 14 60 14Z" fill="#D63A3A" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <path d="M60 22C46 22 36 30 35 44" stroke="#F27F6E" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M60 15L57 22L62 26L59 31" stroke="#140F1C" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <text className="lm-possessor-text" x="60" y="44" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700" fill="#2A0A0A">
          {"'; --"}
        </text>
        <path d="M34 51L54 58M86 51L66 58" stroke="#140F1C" strokeWidth="4" strokeLinecap="round" />
        <g className="lm-look" data-eyes="" style={look(2.5, 1.8)}>
          <path d="M38 59L54 63L41 68Z" fill="#FFE27A" stroke="#140F1C" strokeWidth="2" strokeLinejoin="round" />
          <path d="M82 59L66 63L79 68Z" fill="#FFE27A" stroke="#140F1C" strokeWidth="2" strokeLinejoin="round" />
        </g>
        <path d="M38 80C46 98 74 98 82 80L76 86L70 81L64 86L58 81L52 86L46 81Z" fill="#2A0A0A" stroke="#140F1C" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M46 82L49 89L52 84Z M68 84L71 89L74 82Z" fill="#FFF4E6" />
      </g>
    </>
  ),
  imp: (
    <>
      <ellipse cx="60" cy="114" rx="24" ry="4" fill="#000000" opacity="0.35" />
      <g className="lm-imp-body">
        <path d="M74 96C92 100 98 88 108 92" stroke="#1F8F6A" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M104 86L116 92L105 99Z" fill="#1F8F6A" stroke="#140F1C" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M44 82L40 108H52L56 92H64L68 108H80L76 82Z" fill="#1F8F6A" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <path d="M36 52L8 30L40 40Z" fill="#2FB98C" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <path d="M84 52L112 30L80 40Z" fill="#2FB98C" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="60" cy="56" r="28" fill="#2FB98C" stroke="#140F1C" strokeWidth="3" />
        <path d="M47 31L42 14L55 29Z" fill="#F2E3C9" stroke="#140F1C" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M73 31L78 14L65 29Z" fill="#F2E3C9" stroke="#140F1C" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M38 46Q40 37 50 33" stroke="#86F2CC" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="49" cy="54" r="9" fill="#FFFFFF" stroke="#140F1C" strokeWidth="2.5" />
        <circle cx="71" cy="54" r="9" fill="#FFFFFF" stroke="#140F1C" strokeWidth="2.5" />
        <g className="lm-look" data-eyes="" style={look(4.2, 4.2)}>
          <circle cx="50" cy="55" r="4" fill="#140F1C" />
          <circle cx="72" cy="55" r="4" fill="#140F1C" />
        </g>
        <path d="M46 70Q60 82 74 70" stroke="#140F1C" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M52 73L54 78L56 74Z" fill="#FFFFFF" />
        <g className="lm-imp-sign">
          <path d="M38 76Q30 79 25 76" stroke="#2FB98C" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M20 76V108" stroke="#8A6A4A" strokeWidth="3" strokeLinecap="round" />
          <g transform="rotate(-8 20 72)">
            <rect x="4" y="62" width="32" height="20" rx="4" fill="#F2E3C9" stroke="#140F1C" strokeWidth="2.5" />
            <text x="20" y="77" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="13" fontWeight="700" fill="#140F1C">
              +1
            </text>
          </g>
        </g>
      </g>
    </>
  ),
  twins: (
    <>
      <ellipse cx="60" cy="114" rx="42" ry="4" fill="#000000" opacity="0.35" />
      <path className="lm-twins-thread" d="M54 86C66 102 82 100 88 90" stroke="#8BF6FF" strokeWidth="2.5" fill="none" strokeDasharray="4 4" strokeLinecap="round" />
      <g className="lm-twin-right">
        <path d="M64 50C64 32 74 22 88 22C102 22 112 32 112 50V92L104 86L96 94L88 86L80 94L72 86L64 92Z" fill="#B7A9EE" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <g className="lm-look" data-eyes="" style={look(2.5, 2)}>
          <ellipse cx="82" cy="48" rx="4" ry="6" fill="#140F1C" />
          <ellipse cx="96" cy="48" rx="4" ry="6" fill="#140F1C" />
        </g>
        <ellipse cx="89" cy="63" rx="3" ry="4" fill="#140F1C" />
        <circle cx="88" cy="11" r="8" fill="#FFE27A" stroke="#140F1C" strokeWidth="2.5" />
        <path className="lm-clock-hand lm-clock-right" d="M88 6V11L91 13" stroke="#140F1C" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
      <g className="lm-twin-left">
        <path d="M8 62C8 44 18 34 32 34C46 34 56 44 56 62V104L48 98L40 106L32 98L24 106L16 98L8 104Z" fill="#EEE9FC" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <path d="M14 56C15 46 21 40 29 39" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" />
        <g className="lm-look" style={look(2.5, 2)}>
          <ellipse cx="25" cy="60" rx="4" ry="6" fill="#140F1C" />
          <ellipse cx="39" cy="60" rx="4" ry="6" fill="#140F1C" />
        </g>
        <ellipse cx="32" cy="75" rx="3.5" ry="4.5" fill="#140F1C" />
        <circle cx="32" cy="22" r="8" fill="#FFE27A" stroke="#140F1C" strokeWidth="2.5" />
        <path className="lm-clock-hand lm-clock-left" d="M32 17V22L35 24" stroke="#140F1C" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </>
  ),
  zombie: (
    <>
      <ellipse cx="60" cy="114" rx="28" ry="4" fill="#000000" opacity="0.35" />
      <g className="lm-zombie-head">
        <path d="M28 46C28 26 42 16 60 16C78 16 92 26 92 46L90 84C88 100 76 108 60 108C44 108 32 100 30 84Z" fill="#8FAE78" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <path d="M38 30C40 18 54 14 62 20C70 14 84 20 82 32C72 28 50 34 38 30Z" fill="#EE9DB5" stroke="#140F1C" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M50 24Q54 28 58 24M66 22Q68 27 74 24" stroke="#C26A86" strokeWidth="2" fill="none" strokeLinecap="round" />
        <g transform="rotate(-10 74 41)">
          <rect x="62" y="35" width="24" height="11" rx="3" fill="#F2E3C9" stroke="#140F1C" strokeWidth="2" />
          <text x="74" y="44" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fontWeight="700" fill="#140F1C">
            {"//"}
          </text>
        </g>
        <circle cx="46" cy="56" r="11" fill="#FFFDE8" stroke="#140F1C" strokeWidth="2.5" />
        <g className="lm-look lm-slow" data-eyes="" style={look(5, 5)}>
          <circle cx="46" cy="57" r="3" fill="#140F1C" />
        </g>
        <path d="M68 51L80 63M80 51L68 63" stroke="#140F1C" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M30 68L44 82M32 74L36 70M36 78L40 74M40 82L44 78" stroke="#3C4A30" strokeWidth="2.2" strokeLinecap="round" />
        <g className="lm-zombie-jaw">
          <path d="M44 90Q60 96 76 88" stroke="#140F1C" strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="50" y="91" width="5" height="6" fill="#FFFDE8" stroke="#140F1C" strokeWidth="1.5" />
          <rect x="62" y="91" width="5" height="5" fill="#FFFDE8" stroke="#140F1C" strokeWidth="1.5" />
        </g>
      </g>
    </>
  ),
  gremlin: (
    <>
      <ellipse className="lm-gremlin-shadow" cx="58" cy="114" rx="28" ry="4" fill="#000000" opacity="0.35" />
      <g className="lm-gremlin-body">
        <path d="M42 78L38 106H74L70 78Z" fill="#54446E" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <path d="M34 54L4 34L10 50L2 58L34 68Z" fill="#6E5A8A" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <path d="M30 57L14 47L30 63Z" fill="#E79AB0" />
        <path d="M78 54L108 34L102 50L110 58L78 68Z" fill="#6E5A8A" stroke="#140F1C" strokeWidth="3" strokeLinejoin="round" />
        <path d="M82 57L98 47L82 63Z" fill="#E79AB0" />
        <ellipse cx="56" cy="58" rx="26" ry="24" fill="#6E5A8A" stroke="#140F1C" strokeWidth="3" />
        <path d="M36 50Q38 40 48 36" stroke="#9C88BA" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M37 45L52 49M75 45L60 49" stroke="#140F1C" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="46" cy="56" rx="8" ry="9" fill="#FFE27A" stroke="#140F1C" strokeWidth="2" />
        <ellipse cx="66" cy="56" rx="8" ry="9" fill="#FFE27A" stroke="#140F1C" strokeWidth="2" />
        <g className="lm-look" data-eyes="" style={look(3, 2)}>
          <rect x="44.7" y="50" width="2.6" height="12" rx="1.3" fill="#140F1C" />
          <rect x="64.7" y="50" width="2.6" height="12" rx="1.3" fill="#140F1C" />
        </g>
        <path d="M42 69Q56 81 70 69Q56 75 42 69Z" fill="#140F1C" />
        <path d="M47 71L49 75L51 72Z M61 72L63 75L65 71Z" fill="#FFFFFF" />
        <path d="M70 84Q78 90 82 92" stroke="#6E5A8A" strokeWidth="6" strokeLinecap="round" fill="none" />
        <g className="lm-gremlin-key">
          <path d="M88 90L74 104M78 100L82 104M74 104L78 108" stroke="#140F1C" strokeWidth="8" strokeLinecap="round" fill="none" />
          <circle cx="94" cy="84" r="9" fill="none" stroke="#140F1C" strokeWidth="8" />
          <path d="M88 90L74 104M78 100L82 104M74 104L78 108" stroke="#FFC24B" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <circle cx="94" cy="84" r="9" fill="none" stroke="#FFC24B" strokeWidth="4.5" />
          <circle cx="84" cy="93" r="6" fill="#6E5A8A" stroke="#140F1C" strokeWidth="2.5" />
        </g>
        <path className="lm-gremlin-sparkle" d="M106 64L108 68L112 70L108 72L106 76L104 72L100 70L104 68Z" fill="#FFE27A" />
      </g>
    </>
  ),
};
